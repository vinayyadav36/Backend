/**
 * Automation Service
 * In-process automation workflows using setInterval/setTimeout.
 * Call scheduleAll() to start; stopAll() to stop.
 * NOT auto-started on require.
 * @version 1.0.0
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const logger = require('../config/logger');

// Lazy-load services and models to avoid circular deps at module load time
const getEmailService = () => require('./emailService');
const getAiService    = () => require('./aiService');

// ─── Task status registry ─────────────────────────────────────────────────────

const scheduledTasks = {
  dailyReport:         { intervalMs: 24 * 60 * 60 * 1000, handle: null, lastRun: null, lastStatus: 'idle' },
  monthlyInvoice:      { intervalMs: 24 * 60 * 60 * 1000, handle: null, lastRun: null, lastStatus: 'idle' },
  roomStatusSync:      { intervalMs: 15 * 60 * 1000,       handle: null, lastRun: null, lastStatus: 'idle' },
  databaseBackup:      { intervalMs: 6 * 60 * 60 * 1000,  handle: null, lastRun: null, lastStatus: 'idle' },
  anomalyCheck:        { intervalMs: 60 * 60 * 1000,       handle: null, lastRun: null, lastStatus: 'idle' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recordRun(taskKey, status) {
  scheduledTasks[taskKey].lastRun    = new Date().toISOString();
  scheduledTasks[taskKey].lastStatus = status;
}

async function safeRun(taskKey, fn) {
  try {
    await fn();
    recordRun(taskKey, 'success');
  } catch (err) {
    recordRun(taskKey, `error: ${err.message}`);
    logger.error(`[Automation] ${taskKey} failed:`, err.message);
  }
}

// ─── runDailyReport ───────────────────────────────────────────────────────────

const runDailyReport = async () => {
  await safeRun('dailyReport', async () => {
    logger.info('[Automation] runDailyReport: generating daily summary...');

    const Booking = require('../models/Booking');
    const Invoice = require('../models/Invoice');
    const Room    = require('../models/Room');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    let totalRevenue = 0;
    let bookingCount = 0;
    let checkIns     = 0;
    let checkOuts    = 0;

    try {
      if (process.env.USE_JSON_DB === 'true') {
        const bookings = await Booking.find({});
        bookingCount = bookings.filter(b => {
          const cd = new Date(b.createdAt);
          return cd >= today && cd < tomorrow;
        }).length;
        checkIns  = bookings.filter(b => b.status === 'checked-in'  && new Date(b.checkInDate)  >= today && new Date(b.checkInDate)  < tomorrow).length;
        checkOuts = bookings.filter(b => b.status === 'checked-out' && new Date(b.checkOutDate) >= today && new Date(b.checkOutDate) < tomorrow).length;

        const invoices = await Invoice.find({ status: 'paid' });
        totalRevenue = invoices
          .filter(i => new Date(i.createdAt) >= today && new Date(i.createdAt) < tomorrow)
          .reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
      } else {
        const [bCount, cIn, cOut, rev] = await Promise.all([
          Booking.countDocuments({ createdAt: { $gte: today, $lt: tomorrow } }),
          Booking.countDocuments({ status: 'checked-in',  checkInDate:  { $gte: today, $lt: tomorrow } }),
          Booking.countDocuments({ status: 'checked-out', checkOutDate: { $gte: today, $lt: tomorrow } }),
          Invoice.aggregate([
            { $match: { status: 'paid', createdAt: { $gte: today, $lt: tomorrow } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
          ]),
        ]);
        bookingCount = bCount;
        checkIns     = cIn;
        checkOuts    = cOut;
        totalRevenue = rev[0]?.total || 0;
      }
    } catch (e) {
      logger.warn('[Automation] runDailyReport: DB query error:', e.message);
    }

    const message = [
      `Date: ${today.toLocaleDateString('en-IN')}`,
      `New Bookings Today: ${bookingCount}`,
      `Check-Ins:  ${checkIns}`,
      `Check-Outs: ${checkOuts}`,
      `Revenue:    ₹${totalRevenue.toLocaleString('en-IN')}`,
    ].join('\n');

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await getEmailService().sendAlertEmail(adminEmail, 'Daily Hotel Report', message);
    }
    logger.info('[Automation] runDailyReport: done.');
  });
};

// ─── runMonthlyInvoiceReminder ────────────────────────────────────────────────

const runMonthlyInvoiceReminder = async () => {
  await safeRun('monthlyInvoice', async () => {
    logger.info('[Automation] runMonthlyInvoiceReminder: checking pending invoices...');

    const Invoice = require('../models/Invoice');
    const emailSvc = getEmailService();

    let pendingInvoices = [];
    try {
      if (process.env.USE_JSON_DB === 'true') {
        const all = await Invoice.find({});
        pendingInvoices = all.filter(i => i.status === 'pending' || i.status === 'partial');
      } else {
        pendingInvoices = await Invoice.find({ status: { $in: ['pending', 'partial'] } })
          .populate('guest', 'name email').lean();
      }
    } catch (e) {
      logger.warn('[Automation] runMonthlyInvoiceReminder: DB error:', e.message);
    }

    let sent = 0;
    for (const inv of pendingInvoices) {
      const guestEmail = inv.guest?.email;
      const guestName  = inv.guest?.name || 'Guest';
      if (!guestEmail) continue;

      const due = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);
      if (due <= 0) continue;

      await emailSvc.sendAlertEmail(
        guestEmail,
        `Payment Reminder — Invoice ${inv.invoiceNumber || inv._id}`,
        `Dear ${guestName},\n\nThis is a reminder that invoice ${inv.invoiceNumber || inv._id} has an outstanding balance of ₹${due.toLocaleString('en-IN')}.\nPlease settle at your earliest convenience.\n\nThank you.`
      );
      sent++;
    }

    logger.info(`[Automation] runMonthlyInvoiceReminder: sent ${sent} reminders.`);
  });
};

// ─── runRoomStatusSync ────────────────────────────────────────────────────────

const runRoomStatusSync = async () => {
  await safeRun('roomStatusSync', async () => {
    logger.info('[Automation] runRoomStatusSync: syncing room statuses...');

    const Booking = require('../models/Booking');
    const Room    = require('../models/Room');

    const now = new Date();
    let updated = 0;

    try {
      // Find bookings where checkout time has passed but room still marked occupied
      let overdueBookings = [];
      if (process.env.USE_JSON_DB === 'true') {
        const all = await Booking.find({});
        overdueBookings = all.filter(b =>
          b.status === 'checked-in' && new Date(b.checkOutDate) < now
        );
      } else {
        overdueBookings = await Booking.find({
          status: 'checked-in',
          checkOutDate: { $lt: now },
        }).lean();
      }

      for (const booking of overdueBookings) {
        const roomId = booking.room?._id || booking.room;
        if (!roomId) continue;
        try {
          await Room.findByIdAndUpdate(roomId, { status: 'dirty' });
          await Booking.findByIdAndUpdate(booking._id, { status: 'checked-out' });
          updated++;
        } catch (e) {
          logger.warn(`[Automation] runRoomStatusSync: could not update room ${roomId}:`, e.message);
        }
      }
    } catch (e) {
      logger.warn('[Automation] runRoomStatusSync: DB error:', e.message);
    }

    logger.info(`[Automation] runRoomStatusSync: updated ${updated} rooms.`);
  });
};

// ─── runDatabaseBackup ────────────────────────────────────────────────────────

const runDatabaseBackup = async () => {
  await safeRun('databaseBackup', async () => {
    logger.info('[Automation] runDatabaseBackup: creating backup...');

    const dataDir   = path.resolve(__dirname, '../../data');
    const backupDir = path.join(dataDir, 'backups');

    if (!fs.existsSync(dataDir)) {
      logger.info('[Automation] runDatabaseBackup: data/ dir not found, skipping.');
      return;
    }

    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const ts      = new Date().toISOString().replace(/[:.]/g, '-');
    const destDir = path.join(backupDir, ts);
    fs.mkdirSync(destDir, { recursive: true });

    const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    jsonFiles.forEach(file => {
      fs.copyFileSync(path.join(dataDir, file), path.join(destDir, file));
    });

    // Write manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      files: jsonFiles,
      count: jsonFiles.length,
    };
    fs.writeFileSync(path.join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    // Optionally email admin with a summary (not the actual zip to avoid large payloads)
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await getEmailService().sendAlertEmail(
        adminEmail,
        'Database Backup Completed',
        `Backup completed at ${manifest.timestamp}.\nFiles backed up: ${jsonFiles.join(', ') || 'none'}.\nBackup location: ${destDir}`
      );
    }

    logger.info(`[Automation] runDatabaseBackup: backed up ${jsonFiles.length} files to ${destDir}`);
  });
};

// ─── runAnomalyCheck ─────────────────────────────────────────────────────────

const runAnomalyCheck = async () => {
  await safeRun('anomalyCheck', async () => {
    logger.info('[Automation] runAnomalyCheck: scanning for anomalies...');

    const Invoice = require('../models/Invoice');
    const aiSvc   = getAiService();

    let recentInvoices = [];
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      if (process.env.USE_JSON_DB === 'true') {
        const all = await Invoice.find({});
        recentInvoices = all.filter(i => new Date(i.createdAt) >= cutoff);
      } else {
        recentInvoices = await Invoice.find({ createdAt: { $gte: cutoff } }).lean();
      }
    } catch (e) {
      logger.warn('[Automation] runAnomalyCheck: DB error:', e.message);
    }

    if (recentInvoices.length < 5) {
      logger.info('[Automation] runAnomalyCheck: insufficient data, skipping.');
      return;
    }

    const transactions = recentInvoices.map(i => ({
      amount:      Number(i.totalAmount || 0),
      date:        i.createdAt,
      description: i.invoiceNumber || String(i._id),
    }));

    const results  = aiSvc.detectAnomalies(transactions);
    const flagged  = results.filter(r => r.isAnomaly);

    if (flagged.length > 0) {
      const lines = flagged.map(r =>
        `Invoice ${r.transaction.description}: ₹${r.transaction.amount} (score: ${r.anomalyScore})`
      );
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await getEmailService().sendAlertEmail(
          adminEmail,
          `Anomaly Detected — ${flagged.length} Suspicious Transaction(s)`,
          `The following transactions appear anomalous:\n\n${lines.join('\n')}`
        );
      }
      logger.warn(`[Automation] runAnomalyCheck: ${flagged.length} anomalies detected.`);
    } else {
      logger.info('[Automation] runAnomalyCheck: no anomalies detected.');
    }
  });
};

// ─── scheduleAll ─────────────────────────────────────────────────────────────

const scheduleAll = () => {
  logger.info('[Automation] scheduleAll: starting all scheduled tasks...');

  // Run each task once immediately on startup (offset slightly to avoid thundering herd)
  setTimeout(() => runDailyReport(),              2000);
  setTimeout(() => runRoomStatusSync(),           4000);
  setTimeout(() => runAnomalyCheck(),             6000);
  setTimeout(() => runDatabaseBackup(),           8000);
  setTimeout(() => runMonthlyInvoiceReminder(),  10000);

  // Then set recurring intervals
  scheduledTasks.dailyReport.handle    = setInterval(runDailyReport,            scheduledTasks.dailyReport.intervalMs);
  scheduledTasks.monthlyInvoice.handle = setInterval(runMonthlyInvoiceReminder, scheduledTasks.monthlyInvoice.intervalMs);
  scheduledTasks.roomStatusSync.handle = setInterval(runRoomStatusSync,         scheduledTasks.roomStatusSync.intervalMs);
  scheduledTasks.databaseBackup.handle = setInterval(runDatabaseBackup,         scheduledTasks.databaseBackup.intervalMs);
  scheduledTasks.anomalyCheck.handle   = setInterval(runAnomalyCheck,           scheduledTasks.anomalyCheck.intervalMs);

  logger.info('[Automation] All tasks scheduled.');
};

// ─── stopAll ──────────────────────────────────────────────────────────────────

const stopAll = () => {
  Object.entries(scheduledTasks).forEach(([key, task]) => {
    if (task.handle) {
      clearInterval(task.handle);
      task.handle = null;
      logger.info(`[Automation] Stopped task: ${key}`);
    }
  });
};

// ─── getStatus ────────────────────────────────────────────────────────────────

const getStatus = () =>
  Object.fromEntries(
    Object.entries(scheduledTasks).map(([key, task]) => [
      key,
      {
        running:    !!task.handle,
        intervalMs: task.intervalMs,
        lastRun:    task.lastRun,
        lastStatus: task.lastStatus,
      },
    ])
  );

module.exports = {
  scheduledTasks,
  runDailyReport,
  runMonthlyInvoiceReminder,
  runRoomStatusSync,
  runDatabaseBackup,
  runAnomalyCheck,
  scheduleAll,
  stopAll,
  getStatus,
};
