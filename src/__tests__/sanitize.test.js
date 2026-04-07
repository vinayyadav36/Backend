const { escapeRegex, sanitizeSortField, toSafeString, sanitizeStatus } = require('../utils/sanitize');

describe('sanitize utils', () => {
  describe('escapeRegex', () => {
    it('escapes special regex chars', () => {
      expect(escapeRegex('test.name')).toBe('test\\.name');
      expect(escapeRegex('a+b')).toBe('a\\+b');
      expect(escapeRegex('a(b)')).toBe('a\\(b\\)');
    });
    it('handles normal strings', () => {
      expect(escapeRegex('hello')).toBe('hello');
    });
  });

  describe('sanitizeSortField', () => {
    it('allows whitelisted fields', () => {
      expect(sanitizeSortField('number', 'rooms')).toBe('number');
      expect(sanitizeSortField('createdAt', 'rooms')).toBe('createdAt');
    });
    it('falls back to default for non-whitelisted fields', () => {
      expect(sanitizeSortField('__proto__', 'rooms')).toBe('createdAt');
      expect(sanitizeSortField('$where', 'rooms')).toBe('createdAt');
    });
    it('uses provided default', () => {
      expect(sanitizeSortField('bad', 'rooms', 'number')).toBe('number');
    });
  });

  describe('toSafeString', () => {
    it('converts primitives to string', () => {
      expect(toSafeString('hello')).toBe('hello');
      expect(toSafeString(123)).toBe('123');
    });
    it('returns undefined for objects (prevents operator injection)', () => {
      expect(toSafeString({ $gt: '' })).toBeUndefined();
      expect(toSafeString(null)).toBeUndefined();
    });
  });

  describe('sanitizeStatus', () => {
    it('allows valid status', () => {
      expect(sanitizeStatus('active', ['active', 'inactive'])).toBe('active');
    });
    it('rejects invalid status', () => {
      expect(sanitizeStatus('$ne', ['active', 'inactive'])).toBeNull();
    });
  });
});
