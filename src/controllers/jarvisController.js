/**
 * JARVIS Controller
 * Handles AI forecasting and anomaly detection requests
 * @version 1.0.0
 */

const jarvisService = require('../services/jarvisService');
const logger = require('../config/logger');

/**
 * POST /api/v1/jarvis/forecast
 * Request a revenue forecast
 */
const forecast = async (req, res) => {
  try {
    const { data, horizon = 30 } = req.body;

    if (!Array.isArray(data) || data.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least 2 historical data points ({ ds, y }).',
      });
    }

    const result = await jarvisService.getForecast(req.tenantId, data, parseInt(horizon));
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('JARVIS forecast controller error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/v1/jarvis/anomaly
 * Detect anomalous transactions
 */
const detectAnomaly = async (req, res) => {
  try {
    const { data, contamination = 0.01 } = req.body;

    if (!Array.isArray(data) || data.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least 5 transaction records ({ amount }).',
      });
    }

    const result = await jarvisService.detectAnomalies(req.tenantId, data, parseFloat(contamination));
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('JARVIS anomaly controller error:', err.message);
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { forecast, detectAnomaly };
