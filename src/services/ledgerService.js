const crypto = require('crypto');
const logger = require('../config/logger');

const isJsonDb = () => process.env.USE_JSON_DB === 'true';

async function postEntry(tenantId, lines, opts = {}) {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw Object.assign(new Error('A journal entry requires at least two lines'), { statusCode: 400 });
  }

  const totalDebit = lines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw Object.assign(
      new Error(`Ledger unbalanced: debits (${totalDebit}) ≠ credits (${totalCredit})`),
      { statusCode: 400 }
    );
  }

  const immutableHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(lines))
    .digest('hex');

  if (isJsonDb()) {
    return postEntryJson(tenantId, lines, totalDebit, immutableHash, opts);
  }

  return postEntryMongo(tenantId, lines, totalDebit, immutableHash, opts);
}

async function postEntryJson(tenantId, lines, totalDebit, immutableHash, opts) {
  const db = require('../config/jsonDb');
  const now = new Date().toISOString();

  const entry = {
    _id: db.generateId(),
    tenantId,
    amount: totalDebit,
    immutableHash,
    description: opts.description || '',
    referenceId: opts.referenceId || null,
    referenceType: opts.referenceType || 'manual',
    createdBy: opts.createdBy || 'system',
    lines: [],
    createdAt: now,
    updatedAt: now,
  };

  const createdLines = lines.map((l) => ({
    _id: db.generateId(),
    journalEntry: entry._id,
    accountId: l.accountId,
    debit: parseFloat(l.debit) || 0,
    credit: parseFloat(l.credit) || 0,
    description: l.description || '',
    createdAt: now,
  }));

  entry.lines = createdLines.map((l) => l._id);

  db.insert('journal_entries', entry);
  for (const line of createdLines) {
    db.insert('ledger_lines', line);
  }

  logger.info(`Journal entry posted: ${entry._id} for tenant ${tenantId}`);
  return { ...entry, lines: createdLines };
}

async function postEntryMongo(tenantId, lines, totalDebit, immutableHash, opts) {
  const mongoose = require('mongoose');
  const JournalEntry = require('../models/JournalEntry');
  const LedgerLine = require('../models/LedgerLine');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [entry] = await JournalEntry.create(
      [{
        tenantId,
        amount: totalDebit,
        immutableHash,
        description: opts.description,
        referenceId: opts.referenceId,
        referenceType: opts.referenceType || 'manual',
        createdBy: opts.createdBy,
        lines: [],
      }],
      { session }
    );

    const createdLines = await LedgerLine.create(
      lines.map((l) => ({
        journalEntry: entry._id,
        accountId: l.accountId,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description,
      })),
      { session }
    );

    entry.lines = createdLines.map((l) => l._id);
    await entry.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info(`Journal entry posted: ${entry._id} for tenant ${tenantId}`);
    return entry.populate('lines');
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error('Failed to post journal entry:', err.message);
    throw err;
  }
}

async function getBalances(tenantId) {
  if (isJsonDb()) {
    const db = require('../config/jsonDb');
    const entries = db.find('journal_entries', { tenantId });
    const entryIds = entries.map(e => e._id);
    const lines = db.find('ledger_lines', {}).filter(l => entryIds.includes(l.journalEntry));

    const agg = {};
    for (const line of lines) {
      if (!agg[line.accountId]) {
        agg[line.accountId] = { totalDebit: 0, totalCredit: 0 };
      }
      agg[line.accountId].totalDebit += line.debit || 0;
      agg[line.accountId].totalCredit += line.credit || 0;
    }

    return Object.entries(agg).map(([accountId, vals]) => ({
      accountId,
      balance: vals.totalDebit - vals.totalCredit,
      totalDebit: vals.totalDebit,
      totalCredit: vals.totalCredit,
    }));
  }

  const JournalEntry = require('../models/JournalEntry');
  const LedgerLine = require('../models/LedgerLine');
  const entries = await JournalEntry.find({ tenantId }).select('_id').lean();
  const entryIds = entries.map((e) => e._id);

  return LedgerLine.aggregate([
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
        accountId: '$_id',
        _id: 0,
        balance: { $subtract: ['$totalDebit', '$totalCredit'] },
        totalDebit: 1,
        totalCredit: 1,
      },
    },
    { $sort: { accountId: 1 } },
  ]);
}

async function getEntries(tenantId, { page = 1, limit = 20 } = {}) {
  if (isJsonDb()) {
    const db = require('../config/jsonDb');
    const entries = db.find('journal_entries', { tenantId });

    entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = entries.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paged = entries.slice(skip, skip + parseInt(limit));

    const entriesWithLines = paged.map(e => {
      const lines = db.find('ledger_lines', { journalEntry: e._id });
      return { ...e, lines };
    });

    return { entries: entriesWithLines, total };
  }

  const JournalEntry = require('../models/JournalEntry');
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [entries, total] = await Promise.all([
    JournalEntry.find({ tenantId })
      .populate('lines')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    JournalEntry.countDocuments({ tenantId }),
  ]);
  return { entries, total };
}

module.exports = { postEntry, getBalances, getEntries };
