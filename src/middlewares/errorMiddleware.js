/**
 * Error Handling Middleware
 * Global error handlers for Express application
 * @version 1.0.0
 */

const logger = require('../config/logger');

/**
 * 404 Not Found Handler
 * Catches all unmatched routes
 * @middleware
 */
const notFound = (req, res, next) => {
  const error = new Error(`Route not found - ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  
  logger.warn('404 Not Found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next(error);
};

/**
 * Global Error Handler
 * Handles all errors and sends appropriate response
 * @middleware
 */
const errorHandler = (err, req, res, next) => {
  // Default to 500 if no status code is set
  let statusCode = err.statusCode || res.statusCode || 500;
  if (statusCode === 200) statusCode = 500;

  let message = err.message || 'Internal Server Error';
  let errorDetails = null;

  // Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    message = `Invalid ${err.path}: ${err.value}`;
    statusCode = 400;
  }

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    message = field 
      ? `Duplicate value for field: ${field}` 
      : 'Duplicate field value entered';
    statusCode = 400;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }));
    message = 'Validation failed';
    errorDetails = errors;
    statusCode = 400;
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid authentication token';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Authentication token has expired';
    statusCode = 401;
  }

  // Multer File Upload Errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size is too large';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    } else {
      message = 'File upload error';
    }
    statusCode = 400;
  }

  // Stripe Errors
  if (err.type && err.type.startsWith('Stripe')) {
    message = 'Payment processing error';
    statusCode = 402;
    
    if (process.env.NODE_ENV === 'development') {
      errorDetails = { stripeError: err.message };
    }
  }

  // MongoDB Connection Errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    message = 'Database connection error. Please try again.';
    statusCode = 503;
  }

  // Log error details
  const errorLog = {
    timestamp: new Date().toISOString(),
    message: err.message,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user?.id || 'unauthenticated'
  };

  // Log based on severity
  if (statusCode >= 500) {
    logger.error('Server Error:', {
      ...errorLog,
      stack: err.stack,
      body: req.body
    });
  } else if (statusCode >= 400) {
    logger.warn('Client Error:', errorLog);
  }

  // Construct response
  const response = {
    success: false,
    message,
    statusCode
  };

  // Add error details in development or for validation errors
  if (errorDetails) {
    response.errors = errorDetails;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  // Add error code if present
  if (err.code && typeof err.code === 'string') {
    response.code = err.code;
  }

  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async Error Wrapper
 * Wraps async route handlers to catch errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 * @example router.get('/users', asyncHandler(async (req, res) => {...}))
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation Error Handler
 * Handles express-validator validation results
 * @middleware
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));

    logger.warn('Validation failed:', {
      url: req.originalUrl,
      errors: formattedErrors
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Create custom error with status code
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Error} Custom error object
 */
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  handleValidationErrors,
  createError
};
