/**
 * Reconciliation Model
 * Tracks the state of each stateful reconciliation workflow
 * (Human-in-the-Loop pattern)
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const reconciliationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    /** Raw input transactions to be matched */
    input: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    /** AI-generated match suggestions */
    aiMatches: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending_ai', 'awaiting_approval', 'approved', 'rejected', 'committed'],
      default: 'pending_ai',
      index: true,
    },
    /** Manager who approved or rejected */
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    reviewNote: String,
    /** Journal entry created after commit */
    journalEntryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'JournalEntry',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

reconciliationSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('Reconciliation', reconciliationSchema);
