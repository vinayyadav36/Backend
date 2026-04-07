/**
 * Sanitization utilities to prevent injection attacks
 */

/** Allowed sort fields per collection - prevents dynamic key injection */
const ALLOWED_SORT_FIELDS = {
  rooms: ['number', 'type', 'status', 'floor', 'rate', 'createdAt', 'updatedAt'],
  bookings: ['checkInDate', 'checkOutDate', 'createdAt', 'updatedAt', 'status', 'totalAmount'],
  guests: ['name', 'email', 'createdAt', 'updatedAt', 'vipStatus', 'totalSpent'],
  invoices: ['createdAt', 'updatedAt', 'totalAmount', 'status', 'invoiceNumber'],
  reconciliations: ['createdAt', 'updatedAt', 'status'],
};

/**
 * Escape special regex characters from user input to prevent ReDoS
 */
const escapeRegex = (str) => {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize a sort field against an allowlist
 */
const sanitizeSortField = (field, collection, defaultField = 'createdAt') => {
  const allowed = ALLOWED_SORT_FIELDS[collection] || [];
  return allowed.includes(field) ? field : defaultField;
};

/**
 * Cast a value to string to prevent operator injection
 */
const toSafeString = (val) => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'object') return undefined; // reject objects (prevent $gt, $regex injection)
  return String(val);
};

/**
 * Whitelist allowed status values
 */
const sanitizeStatus = (status, allowedValues, defaultValue = null) => {
  if (!status) return defaultValue;
  return allowedValues.includes(status) ? status : defaultValue;
};

module.exports = { escapeRegex, sanitizeSortField, toSafeString, sanitizeStatus };
