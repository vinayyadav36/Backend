/**
 * Ledger Service
 * Implements strict double-entry bookkeeping with GST support
 * @version 1.0.0
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const JournalEntry = require('../models/JournalEntry');
const LedgerLine = require('../models/LedgerLine');
const logger = require('../config/logger');

/**
 * Post a balanced journal entry.
 * Validates that total debits === total credits before persisting.
 *
 * @param {string} tenantId  - Tenant / hotel identifier
 * @param {Array}  lines     - Array of { accountId, debit, credit, description }
 * @param {object} [opts]    - Optional metadata { description, referenceId, referenceType, createdBy }
 * @returns {Promise<JournalEntry>}
 */
const postEntry = async (tenantId, lines, opts = {}) => {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw Object.assign(new Error('A journal entry requires at least two lines'), {
      statusCode: 400,
    });
  }

  // Validate balance: sum(debit) must equal sum(credit)
  const totalDebit = lines.reduce((acc, l) => acc + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (parseFloat(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw Object.assign(
      new Error(`Ledger unbalanced: debits (${totalDebit}) ≠ credits (${totalCredit})`),
      { statusCode: 400 }
    );
  }

  // Immutability hash covers the canonical lines payload
  const immutableHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(lines))
    .digest('hex');

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create the parent journal entry
    const [entry] = await JournalEntry.create(
      [
        {
          tenantId,
          amount: totalDebit,
          immutableHash,
          description: opts.description,
          referenceId: opts.referenceId,
          referenceType: opts.referenceType || 'manual',
          createdBy: opts.createdBy,
          lines: [],
        },
      ],
      { session }
    );

    // Create ledger lines linked to the entry
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

    // Link line IDs back to the entry
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
};

/**
 * Get account balances (running balance per account) for a tenant.
 *
 * @param {string} tenantId
 * @returns {Promise<Array<{ accountId, balance }>>}
 */
const getBalances = async (tenantId) => {
  const entries = await JournalEntry.find({ tenantId }).select('_id').lean();
  const entryIds = entries.map((e) => e._id);

  const balances = await LedgerLine.aggregate([
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

  return balances;
};

/**
 * Get journal entries for a tenant (paginated).
 *
 * @param {string} tenantId
 * @param {object} [opts] - { page, limit }
 * @returns {Promise<{ entries, total }>}
 */
const getEntries = async (tenantId, { page = 1, limit = 20 } = {}) => {
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
};

module.exports = { postEntry, getBalances, getEntries };
