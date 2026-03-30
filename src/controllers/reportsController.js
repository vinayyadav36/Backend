/**
 * Reports Controller
 * Finance summary and Excel export endpoints
 * @version 1.0.0
 */

const LedgerLine = require('../models/LedgerLine');
const JournalEntry = require('../models/JournalEntry');
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

module.exports = { getFinanceSummary, exportFinanceExcel };
