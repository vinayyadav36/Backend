const path = require('path');
const fs = require('fs');
const db = require('../config/jsonDb');
const logger = require('../config/logger');

const SCHEMAS_DIR = path.resolve(__dirname, '../models/schemas');
const schemaCache = {};

function loadSchema(name) {
  if (schemaCache[name]) return schemaCache[name];
  const fp = path.join(SCHEMAS_DIR, `${name}.schema.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    const schema = JSON.parse(fs.readFileSync(fp, 'utf8'));
    schemaCache[name] = schema;
    return schema;
  } catch (e) {
    logger.warn(`Failed to load schema ${name}: ${e.message}`);
    return null;
  }
}

function validateAgainstSchema(data, schema) {
  if (!schema) return { valid: true, errors: [] };

  const errors = [];

  function validateValue(value, schemaDef, path_str) {
    if (schemaDef.required && (value === undefined || value === null)) {
      errors.push({ path: path_str, message: `Field is required` });
      return;
    }
    if (value === undefined || value === null) return;

    const typeMap = {
      string: 'string',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      array: 'array',
      object: 'object',
      date: 'string',
    };

    const expectedType = typeMap[schemaDef.type];
    const actualType = typeof value;

    if (schemaDef.type === 'date' && value) {
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        errors.push({ path: path_str, message: `Invalid date format` });
      }
      return;
    }

    if (schemaDef.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push({ path: path_str, message: `Expected array, got ${actualType}` });
        return;
      }
      if (schemaDef.itemSchema && schemaDef.itemSchema.type === 'object') {
        value.forEach((item, i) => {
          if (schemaDef.itemSchema.properties) {
            for (const [k, v] of Object.entries(schemaDef.itemSchema.properties)) {
              validateValue(item[k], v, `${path_str}[${i}].${k}`);
            }
          }
        });
      }
      return;
    }

    if (schemaDef.type === 'object' && schemaDef.properties) {
      for (const [k, v] of Object.entries(schemaDef.properties)) {
        validateValue(value[k], v, `${path_str}.${k}`);
      }
      return;
    }

    if (expectedType && actualType !== expectedType) {
      errors.push({ path: path_str, message: `Expected ${expectedType}, got ${actualType}` });
    }

    if (schemaDef.enum && !schemaDef.enum.includes(value)) {
      errors.push({ path: path_str, message: `Value must be one of: ${schemaDef.enum.join(', ')}` });
    }

    if (schemaDef.minimum !== undefined && typeof value === 'number' && value < schemaDef.minimum) {
      errors.push({ path: path_str, message: `Minimum value is ${schemaDef.minimum}` });
    }

    if (schemaDef.maximum !== undefined && typeof value === 'number' && value > schemaDef.maximum) {
      errors.push({ path: path_str, message: `Maximum value is ${schemaDef.maximum}` });
    }

    if (schemaDef.minLength !== undefined && typeof value === 'string' && value.length < schemaDef.minLength) {
      errors.push({ path: path_str, message: `Minimum length is ${schemaDef.minLength}` });
    }

    if (schemaDef.maxLength !== undefined && typeof value === 'string' && value.length > schemaDef.maxLength) {
      errors.push({ path: path_str, message: `Maximum length is ${schemaDef.maxLength}` });
    }

    if (schemaDef.pattern && typeof value === 'string' && !new RegExp(schemaDef.pattern).test(value)) {
      errors.push({ path: path_str, message: `Does not match pattern ${schemaDef.pattern}` });
    }
  }

  if (schema.required) {
    for (const field of schema.required) {
      const val = db.getPath(data, field);
      if (val === undefined || val === null) {
        errors.push({ path: field, message: `Required field missing` });
      }
    }
  }

  if (schema.properties) {
    for (const [key, schemaDef] of Object.entries(schema.properties)) {
      const val = db.getPath(data, key);
      if (schemaDef.required && (val === undefined || val === null)) {
        errors.push({ path: key, message: `Field is required` });
        continue;
      }
      validateValue(val, schemaDef, key);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validate(collectionName) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'DELETE') return next();

    const schemaName = collectionName.replace(/_/g, '_').replace(/s$/, '') || collectionName;
    const schema = loadSchema(schemaName);

    if (!schema) return next();

    const data = req.body || {};
    const result = validateAgainstSchema(data, schema);

    if (!result.valid) {
      logger.warn(`Validation failed for ${collectionName}:`, result.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.errors,
      });
    }

    next();
  };
}

module.exports = {
  validate,
  validateAgainstSchema,
  loadSchema,
};
