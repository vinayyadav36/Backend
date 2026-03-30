/**
 * Audit Middleware (Express — Deliverable F)
 * Records every mutating request (non-GET) to MongoDB audit_logs collection.
 * Stored as an immutable log: once written, records are never deleted.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const logger = require('../config/logger');

const auditMiddleware = (req, res, next) => {
  if (req.method === 'GET') return next();

  res.on('finish', () => {
    try {
      const userId = req.user?.id || req.user?._id || 'anonymous';
      const tenantId = req.tenantId || req.user?.hotelId || 'unknown';
      const record = {
        userId,
        tenantId,
        action: `${req.method} ${req.originalUrl}`,
        payload: req.body,
        statusCode: res.statusCode,
        timestamp: new Date(),
      };

      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(record))
        .digest('hex');

      const db = mongoose.connection.db;
      if (db) {
        db.collection('audit_logs').insertOne({ ...record, hash }).catch((err) => {
          logger.error('Audit log write failed:', err.message);
        });
      }
    } catch (err) {
      logger.error('Audit middleware error:', err.message);
    }
  });

  next();
};

module.exports = auditMiddleware;
