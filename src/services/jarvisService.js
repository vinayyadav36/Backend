/**
 * JARVIS Service
 * Axios bridge to the Python FastAPI ML microservice
 * @version 1.0.0
 */

const axios = require('axios');
const logger = require('../config/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Create an axios instance pre-configured for the ML service.
 * @param {string} tenantId
 */
const mlClient = (tenantId) =>
  axios.create({
    baseURL: ML_SERVICE_URL,
    timeout: 60000,
    headers: { 'x-tenant-id': tenantId },
  });

/**
 * Request a revenue forecast from the ML service.
 *
 * @param {string}  tenantId
 * @param {Array}   data      - Array of { ds: 'YYYY-MM-DD', y: number }
 * @param {number}  horizon   - Number of future periods to forecast
 * @returns {Promise<object>}
 */
const getForecast = async (tenantId, data, horizon = 30) => {
  try {
    const response = await mlClient(tenantId).post('/forecast', { data, horizon });
    logger.info(`Forecast requested by tenant ${tenantId}: ${horizon} periods`);
    return response.data;
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    logger.error(`JARVIS forecast error [tenant=${tenantId}]: ${msg}`);
    throw Object.assign(new Error(msg), { statusCode: err.response?.status || 502 });
  }
};

/**
 * Detect anomalous transactions via the ML service.
 *
 * @param {string}  tenantId
 * @param {Array}   data          - Array of { amount, date?, description? }
 * @param {number}  contamination - Expected fraction of outliers (0–0.5)
 * @returns {Promise<object>}
 */
const detectAnomalies = async (tenantId, data, contamination = 0.01) => {
  try {
    const response = await mlClient(tenantId).post('/anomaly', { data, contamination });
    logger.info(`Anomaly detection by tenant ${tenantId}: ${data.length} records`);
    return response.data;
  } catch (err) {
    const msg = err.response?.data?.detail || err.message;
    logger.error(`JARVIS anomaly error [tenant=${tenantId}]: ${msg}`);
    throw Object.assign(new Error(msg), { statusCode: err.response?.status || 502 });
  }
};

module.exports = { getForecast, detectAnomalies };
