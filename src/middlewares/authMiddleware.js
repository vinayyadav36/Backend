/**
 * Authentication & Authorization Middleware
 * Handles JWT verification, role-based access control, and permissions
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Protect routes - Verify JWT token and attach user to request
 * @middleware
 */
const protect = async (req, res, next) => {
  let token;

  try {
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Extract token
      token = req.headers.authorization.split(' ')[1];
    }
    // Also check for token in cookies (if using cookie-based auth)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check token type (should be access token)
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type. Please use an access token.'
      });
    }

    // Get user from token (exclude sensitive fields)
    const user = await User.findById(decoded.userId || decoded.id)
      .select('-password -refreshToken -otpCode -otpExpires')
      .lean();

    if (!user) {
      logger.warn(`Token valid but user not found: ${decoded.userId || decoded.id}`);
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      logger.warn(`Inactive user attempted access: ${user.email}`);
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Attach user info to request
    req.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions || [],
      hotelId: user.hotelId
    };

    next();

  } catch (error) {
    logger.error('Authentication error:', {
      error: error.message,
      token: token ? 'present' : 'missing',
      url: req.originalUrl
    });

    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please login again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please login again.'
    });
  }
};

/**
 * Optional authentication - Attach user if token exists, but don't require it
 * Useful for endpoints that work differently for authenticated vs unauthenticated users
 * @middleware
 */
const optionalAuth = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId || decoded.id)
        .select('-password -refreshToken -otpCode -otpExpires')
        .lean();

      if (user && user.isActive) {
        req.user = {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions || [],
          hotelId: user.hotelId
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue without user if token is invalid
    next();
  }
};

/**
 * Check if user has required permissions
 * @param {...string} requiredPermissions - Required permission(s)
 * @middleware
 * @example authorize('manage_bookings', 'manage_guests')
 */
const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    // Admin has all permissions (superuser)
    if (req.user.role === 'admin' || req.user.permissions.includes('all')) {
      return next();
    }

    // Check if user has at least one of the required permissions
    const hasPermission = requiredPermissions.some(permission =>
      req.user.permissions.includes(permission)
    );

    if (!hasPermission) {
      logger.warn(`Permission denied for user ${req.user.email}`, {
        required: requiredPermissions,
        userPermissions: req.user.permissions,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have the required permissions.',
        required: requiredPermissions
      });
    }

    next();
  };
};

/**
 * Check if user has all specified permissions (stricter than authorize)
 * @param {...string} requiredPermissions - All required permissions
 * @middleware
 * @example authorizeAll('manage_bookings', 'view_analytics')
 */
const authorizeAll = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'admin' || req.user.permissions.includes('all')) {
      return next();
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      req.user.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      logger.warn(`Insufficient permissions for user ${req.user.email}`, {
        required: requiredPermissions,
        userPermissions: req.user.permissions,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You need all specified permissions.',
        required: requiredPermissions
      });
    }

    next();
  };
};

/**
 * Check if user has specific role(s)
 * @param {...string} allowedRoles - Allowed role(s)
 * @middleware
 * @example requireRole('admin', 'manager')
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Role restriction for user ${req.user.email}`, {
        userRole: req.user.role,
        allowedRoles,
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: `Access denied. This endpoint requires one of these roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Verify user owns the resource or is admin/manager
 * Pass the resource owner field name (defaults to 'user' or 'createdBy')
 * @param {string} ownerField - Field name containing owner ID
 * @middleware
 * @example verifyOwnership('createdBy')
 */
const verifyOwnership = (ownerField = 'createdBy') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin and manager can access any resource
    if (['admin', 'manager'].includes(req.user.role)) {
      return next();
    }

    // Get resource ID from params
    const resourceId = req.params.id;
    if (!resourceId) {
      return res.status(400).json({
        success: false,
        message: 'Resource ID is required'
      });
    }

    try {
      // This requires the route to fetch and attach the resource to req
      // Or you can fetch it here based on the model
      const resource = req.resource; // Assumes resource is attached by previous middleware

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found'
        });
      }

      const ownerId = resource[ownerField]?.toString() || resource[ownerField];
      const userId = req.user.id.toString();

      if (ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources.'
        });
      }

      next();
    } catch (error) {
      logger.error('Ownership verification error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying resource ownership'
      });
    }
  };
};

/**
 * Rate limiting per user (in addition to global rate limiting)
 * Track requests per user to prevent abuse
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @middleware
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);

    // Filter out old requests
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= maxRequests) {
      logger.warn(`User rate limit exceeded: ${req.user.email}`);
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    requests.set(userId, recentRequests);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      for (const [key, timestamps] of requests.entries()) {
        const recent = timestamps.filter(t => t > windowStart);
        if (recent.length === 0) {
          requests.delete(key);
        } else {
          requests.set(key, recent);
        }
      }
    }

    next();
  };
};

module.exports = {
  protect,
  optionalAuth,
  authorize,
  authorizeAll,
  requireRole,
  verifyOwnership,
  userRateLimit
};
