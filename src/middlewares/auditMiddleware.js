const crypto = require('crypto');
const logger = require('../config/logger');

function writeAuditToJson(record) {
  try {
    const db = require('../config/jsonDb');
    const logs = db.loadCollection('audit_logs');
    logs.push(Object.assign({ _id: db.generateId() }, record));
    db.saveCollection('audit_logs', logs);
  } catch (err) {
    logger.error('Audit JSON write failed:', err.message);
  }
}

function writeAuditToMongo(record) {
  try {
    const mongoose = require('mongoose');
    const db2 = mongoose.connection.db;
    if (db2) {
      db2.collection('audit_logs').insertOne(record).catch((err) => {
        logger.error('Audit Mongo write failed:', err.message);
      });
    }
  } catch (err) {
    logger.error('Audit Mongo error:', err.message);
  }
}

const auditMiddleware = (req, res, next) => {
  if (req.method === 'GET') return next();

  const startTime = Date.now();

  res.on('finish', () => {
    try {
      const userId = req.user?.id || req.user?._id || 'anonymous';
      const tenantId = req.tenantId || req.user?.hotelId || 'unknown';

      const record = {
        userId,
        tenantId,
        action: `${req.method} ${req.originalUrl}`,
        payload: sanitizePayload(req.body),
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent') || '',
        timestamp: new Date().toISOString(),
      };

      const hash = crypto
        .createHash('sha256')
        .update(JSON.stringify(record))
        .digest('hex');

      record.hash = hash;
      record.hash_chain = buildHashChain(record);

      if (process.env.USE_JSON_DB === 'true') {
        writeAuditToJson(record);
      } else {
        writeAuditToMongo(record);
      }
    } catch (err) {
      logger.error('Audit middleware error:', err.message);
    }
  });

  next();
};

function sanitizePayload(body) {
  if (!body) return {};
  const sanitized = Object.assign({}, body);
  const sensitive = ['password', 'passwordResetToken', 'otpCode', 'otpExpires', 'refreshToken', 'token', 'secret', 'authorization'];
  for (const key of sensitive) {
    if (sanitized[key]) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}

function buildHashChain(record) {
  try {
    const db = require('../config/jsonDb');
    const logs = db.loadCollection('audit_logs');
    const lastLog = logs[logs.length - 1];
    const previousHash = lastLog?.hash || lastLog?.hash_chain || '0';
    return crypto.createHash('sha256').update(previousHash + record.hash).digest('hex');
  } catch (_) {
    return record.hash;
  }
}

module.exports = auditMiddleware;
