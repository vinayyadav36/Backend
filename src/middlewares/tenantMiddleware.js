/**
 * Tenant Middleware
 * Enforces multi-tenant isolation by requiring x-tenant-id header
 * Falls back to the authenticated user's hotelId when JWT is present
 * @version 1.0.0
 */

/**
 * Attach tenantId from x-tenant-id header (or fall back to JWT hotelId)
 * and reject requests that carry neither.
 *
 * Usage: apply before route handlers that need tenant isolation.
 */
const tenantMiddleware = (req, res, next) => {
  const tenantId = req.headers['x-tenant-id'] || (req.user && req.user.hotelId);

  if (!tenantId) {
    return res.status(401).json({
      success: false,
      message: 'Tenant ID missing. Provide the x-tenant-id header.',
    });
  }

  req.tenantId = tenantId;
  next();
};

module.exports = tenantMiddleware;
