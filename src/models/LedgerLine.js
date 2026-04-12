/**
 * LedgerLine Model
 * Represents a single debit or credit line within a journal entry
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const ledgerLineSchema = new mongoose.Schema(
  {
    journalEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
      required: true,
      index: true,
    },
    accountId: {
      type: String,
      required: [true, 'Account ID is required'],
      trim: true,
      index: true,
    },
    debit: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    credit: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

ledgerLineSchema.index({ journalEntry: 1, accountId: 1 });

if (process.env.USE_JSON_DB !== 'true') {
  module.exports = mongoose.model('LedgerLine', ledgerLineSchema);
} else {
  const { createJsonModel } = require('./JsonModel');
  module.exports = createJsonModel('ledger_lines', 'LedgerLine', {
    populateRefs: { journalEntry: 'journal_entries' },
  });
}
