/**
 * JournalEntry Model
 * Immutable double-entry accounting record (GST-ready)
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      get: (v) => (v ? parseFloat(v.toString()) : 0),
    },
    /** SHA-256 hash of the lines payload – ensures immutability */
    immutableHash: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    lines: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LedgerLine',
      },
    ],
    /** Reference to source document (invoice, booking, etc.) */
    referenceId: {
      type: String,
      trim: true,
    },
    referenceType: {
      type: String,
      enum: ['invoice', 'booking', 'manual', 'reconciliation'],
      default: 'manual',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true, virtuals: true },
    toObject: { getters: true, virtuals: true },
  }
);

journalEntrySchema.index({ tenantId: 1, createdAt: -1 });
journalEntrySchema.index({ tenantId: 1, referenceId: 1 });

if (process.env.USE_JSON_DB !== 'true') {
  module.exports = mongoose.model('JournalEntry', journalEntrySchema);
} else {
  const { createJsonModel } = require('./JsonModel');
  module.exports = createJsonModel('journal_entries', 'JournalEntry', {
    populateRefs: { lines: 'ledger_lines', createdBy: 'users' },
  });
}
