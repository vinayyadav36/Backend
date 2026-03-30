/**
 * PendingTask Model
 * MongoDB collection for AI-generated suggestions that require human approval.
 *
 * SAFETY RULE: The AI agent (FastAPI) ONLY writes to this collection.
 * It is NEVER allowed to write directly to journal_entries or ledger_lines.
 * Only after a manager approves a pending task does the NestJS service
 * commit the corresponding journal entry to Postgres.
 */
const mongoose = require('mongoose');

const pendingTaskSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ['ai_reconcile', 'ai_forecast', 'manual'],
      default: 'ai_reconcile',
    },
    status: {
      type: String,
      enum: ['awaiting_approval', 'approved', 'rejected', 'committed'],
      default: 'awaiting_approval',
      index: true,
    },
    suggestions: { type: mongoose.Schema.Types.Mixed, required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: String,
    journalEntryId: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

pendingTaskSchema.index({ tenantId: 1, status: 1 });

module.exports = mongoose.model('PendingTask', pendingTaskSchema);
