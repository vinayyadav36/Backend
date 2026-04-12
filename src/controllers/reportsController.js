/**
 * Reports Controller
 * Finance summary, Excel export, daily/monthly/audit reports
 * @version 2.0.0
 */

const LedgerLine = require('../models/LedgerLine');
const JournalEntry = require('../models/JournalEntry');
const Booking = require('../models/Booking');
const Room    = require('../models/Room');
const Invoice = require('../models/Invoice');
const Guest   = require('../models/Guest');
const excelService = require('../services/excelService');
const logger = require('../config/logger');

/**
 * GET /api/v1/reports/finance/summary
 * Returns balance per account for the tenant (Power BI / dashboard hook)
 */
const getFinanceSummary = async (req, res) => {
  try {
    const entries = await JournalEntry.find({ tenantId: req.tenantId }).select('_id').lean();
    const entryIds = entries.map((e) => e._id);

    const summary = await LedgerLine.aggregate([
      { $match: { journalEntry: { $in: entryIds } } },
      {
        $group: {
          _id: '$accountId',
          totalDebit: { $sum: { $toDouble: '$debit' } },
          totalCredit: { $sum: { $toDouble: '$credit' } },
        },
      },
      {
        $project: {
          account_id: '$_id',
          _id: 0,
          balance: { $subtract: ['$totalDebit', '$totalCredit'] },
          total_debit: '$totalDebit',
          total_credit: '$totalCredit',
        },
      },
      { $sort: { account_id: 1 } },
    ]);

    res.json({ success: true, data: summary });
  } catch (err) {
    logger.error('Finance summary error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/v1/reports/finance/export
 * Download finance summary as an Excel workbook
 */
const exportFinanceExcel = async (req, res) => {
  try {
    const entries = await JournalEntry.find({ tenantId: req.tenantId }).select('_id').lean();
    const entryIds = entries.map((e) => e._id);

    const rows = await LedgerLine.aggregate([
      { $match: { journalEntry: { $in: entryIds } } },
      {
        $group: {
          _id: '$accountId',
          total_debit: { $sum: { $toDouble: '$debit' } },
          total_credit: { $sum: { $toDouble: '$credit' } },
        },
      },
      {
        $project: {
          account_id: '$_id',
          _id: 0,
          balance: { $subtract: ['$total_debit', '$total_credit'] },
          total_debit: 1,
          total_credit: 1,
        },
      },
      { $sort: { account_id: 1 } },
    ]);

    const buffer = await excelService.toBuffer(rows, 'Finance Summary');

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="finance-summary-${Date.now()}.xlsx"`
    );
    res.send(buffer);
  } catch (err) {
    logger.error('Finance Excel export error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getBookingsInRange(startDate, endDate) {
  if (process.env.USE_JSON_DB === 'true') {
    const all = await Booking.find({});
    return all.filter(b => {
      const cd = new Date(b.createdAt);
      return cd >= startDate && cd <= endDate;
    });
  }
  return Booking.find({ createdAt: { $gte: startDate, $lte: endDate } })
    .populate('guest', 'name email nationality')
    .populate('room', 'number type')
    .lean();
}

async function getInvoicesInRange(startDate, endDate) {
  if (process.env.USE_JSON_DB === 'true') {
    const all = await Invoice.find({});
    return all.filter(i => {
      const cd = new Date(i.createdAt);
      return cd >= startDate && cd <= endDate;
    });
  }
  return Invoice.find({ createdAt: { $gte: startDate, $lte: endDate } }).lean();
}

// ─── getDailyReport ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/daily
 * Full-day summary: bookings, revenue, checkIns, checkOuts, occupancy
 */
const getDailyReport = async (req, res) => {
  try {
    const dateParam = req.query.date;
    const day = dateParam ? new Date(dateParam) : new Date();
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day.getTime() + 86400000);

    const [bookings, invoices, totalRooms] = await Promise.all([
      getBookingsInRange(day, nextDay),
      getInvoicesInRange(day, nextDay),
      process.env.USE_JSON_DB === 'true'
        ? Room.find({}).then(rs => rs.filter(r => r.isActive !== false).length)
        : Room.countDocuments({ isActive: true }),
    ]);

    const revenue     = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const checkIns    = bookings.filter(b => {
      const ci = new Date(b.checkInDate); return ci >= day && ci < nextDay && b.status === 'checked-in';
    }).length;
    const checkOuts   = bookings.filter(b => {
      const co = new Date(b.checkOutDate); return co >= day && co < nextDay && b.status === 'checked-out';
    }).length;
    const occupiedNow = bookings.filter(b => ['confirmed','checked-in'].includes(b.status)).length;
    const occupancy   = totalRooms > 0 ? Math.round(occupiedNow / totalRooms * 100) : 0;

    const statusBreakdown = {};
    bookings.forEach(b => { statusBreakdown[b.status] = (statusBreakdown[b.status] || 0) + 1; });

    logger.info(`Daily report generated for ${day.toISOString().split('T')[0]}`);

    res.json({
      success: true,
      data: {
        date:      day.toISOString().split('T')[0],
        bookings:  bookings.length,
        revenue:   Math.round(revenue),
        checkIns,
        checkOuts,
        occupancy,
        totalRooms,
        occupiedRooms: occupiedNow,
        statusBreakdown,
        invoiceCount:  invoices.length,
        generatedAt:   new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Daily report error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getMonthlyReport ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/monthly?year=YYYY&month=M
 * Monthly summary with daily trends
 */
const getMonthlyReport = async (req, res) => {
  try {
    const now   = new Date();
    const year  = parseInt(req.query.year  || now.getFullYear(),  10);
    const month = parseInt(req.query.month || now.getMonth() + 1, 10);

    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate   = new Date(year, month,     0, 23, 59, 59, 999);

    const [bookings, invoices, totalRooms] = await Promise.all([
      getBookingsInRange(startDate, endDate),
      getInvoicesInRange(startDate, endDate),
      process.env.USE_JSON_DB === 'true'
        ? Room.find({}).then(rs => rs.filter(r => r.isActive !== false).length)
        : Room.countDocuments({ isActive: true }),
    ]);

    const totalRevenue = invoices.filter(i => i.status === 'paid')
      .reduce((s, i) => s + Number(i.totalAmount || 0), 0);
    const paidInvoices = invoices.filter(i => i.status === 'paid').length;

    // Daily trend
    const daysInMonth = endDate.getDate();
    const dailyTrend  = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(year, month - 1, d,  0,  0,  0);
      const dayEnd   = new Date(year, month - 1, d, 23, 59, 59);
      const dayBooks = bookings.filter(b => {
        const cd = new Date(b.createdAt); return cd >= dayStart && cd <= dayEnd;
      });
      const dayRev = invoices.filter(i => {
        const cd = new Date(i.createdAt);
        return cd >= dayStart && cd <= dayEnd && i.status === 'paid';
      }).reduce((s, i) => s + Number(i.totalAmount || 0), 0);
      dailyTrend.push({ day: d, bookings: dayBooks.length, revenue: Math.round(dayRev) });
    }

    // Source breakdown
    const srcMap = {};
    bookings.forEach(b => { srcMap[b.source || 'direct'] = (srcMap[b.source || 'direct'] || 0) + 1; });

    logger.info(`Monthly report generated for ${year}-${String(month).padStart(2,'0')}`);

    res.json({
      success: true,
      data: {
        year,
        month,
        period: `${year}-${String(month).padStart(2,'0')}`,
        totalBookings:  bookings.length,
        totalRevenue:   Math.round(totalRevenue),
        paidInvoices,
        pendingInvoices: invoices.filter(i => ['pending','partial'].includes(i.status)).length,
        avgDailyRevenue: daysInMonth > 0 ? Math.round(totalRevenue / daysInMonth) : 0,
        totalRooms,
        sourceBreakdown: srcMap,
        dailyTrend,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Monthly report error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getAuditReport ───────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/audit
 * Security / activity audit log snapshot
 */
const getAuditReport = async (req, res) => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 86400000);
    const end   = endDate   ? new Date(endDate)   : new Date();

    // Collect recent booking activity as audit events
    let recentBookings = [];
    try {
      recentBookings = await getBookingsInRange(start, end);
    } catch (e) {
      logger.warn('getAuditReport: booking query error', e.message);
    }

    const events = recentBookings.slice(0, parseInt(limit, 10)).map(b => ({
      timestamp:  b.createdAt,
      entityType: 'booking',
      entityId:   b._id || b.bookingNumber,
      action:     b.status,
      actor:      b.guest?.name || String(b.guest || 'unknown'),
      details:    `Room: ${b.room?.number || b.room || 'N/A'}, Amount: ₹${b.totalAmount || 0}`,
    }));

    res.json({
      success: true,
      data: {
        events,
        total:  events.length,
        period: { start: start.toISOString(), end: end.toISOString() },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Audit report error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── exportReport ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/reports/export?type=bookings|guests|finance&format=json|excel
 */
const exportReport = async (req, res) => {
  try {
    const { type = 'bookings', format = 'json', startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 86400000);
    const end   = endDate   ? new Date(endDate)   : new Date();

    if (format === 'excel') {
      let buffer;
      let filename = `report-${type}-${Date.now()}.xlsx`;

      if (type === 'bookings') {
        const bookings = await getBookingsInRange(start, end);
        buffer = await excelService.exportBookings(bookings);
        filename = `bookings-export-${Date.now()}.xlsx`;
      } else if (type === 'guests') {
        let guests = [];
        if (process.env.USE_JSON_DB === 'true') {
          guests = await Guest.find({});
        } else {
          guests = await Guest.find({}).lean();
        }
        buffer = await excelService.exportGuests(guests);
        filename = `guests-export-${Date.now()}.xlsx`;
      } else {
        const invoices = await getInvoicesInRange(start, end);
        buffer = await excelService.exportReport({
          title: 'Finance Report',
          data: invoices.map(i => ({
            invoiceNumber: i.invoiceNumber,
            status:       i.status,
            totalAmount:  i.totalAmount,
            paidAmount:   i.paidAmount,
            createdAt:    i.createdAt,
          })),
        });
        filename = `finance-export-${Date.now()}.xlsx`;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    // JSON format
    let data = [];
    if (type === 'bookings') data = await getBookingsInRange(start, end);
    else if (type === 'guests') {
      data = process.env.USE_JSON_DB === 'true'
        ? await Guest.find({})
        : await Guest.find({}).lean();
    } else {
      data = await getInvoicesInRange(start, end);
    }

    res.json({
      success: true,
      data: { type, count: data.length, records: data, period: { start, end } },
    });
  } catch (err) {
    logger.error('Export report error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getFinanceSummary,
  exportFinanceExcel,
  getDailyReport,
  getMonthlyReport,
  getAuditReport,
  exportReport,
};
