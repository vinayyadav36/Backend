/**
 * Authentication Controller
 * Handles user registration, OTP login, token management
 * @version 1.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');

/**
 * Generate JWT access and refresh tokens
 * @param {string} userId - User ID
 * @param {Object} additionalPayload - Additional JWT payload data
 * @returns {Object} Token pair
 */
const generateTokens = (userId, additionalPayload = {}) => {
  const accessToken = jwt.sign(
    { 
      userId,
      id: userId, // For backward compatibility
      type: 'access',
      ...additionalPayload 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );

  const refreshToken = jwt.sign(
    { 
      userId,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Generate a secure 6-digit OTP
 * @returns {string} OTP code
 */
const generateOtpCode = () => {
  // Use crypto for better randomness
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Send OTP via email/SMS (stub - implement actual service)
 * @param {string} email - User email
 * @param {string} phone - User phone
 * @param {string} otpCode - OTP code
 */
const sendOtp = async (email, _phone, otpCode) => {
  const sent = await sendOtpEmail(email, otpCode);
  if (!sent) {
    // Fallback: log OTP in development when email service not configured
    logger.info(`🔐 OTP for ${email}: ${otpCode}`);
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`\n╔════════════════════════════════╗`);
      // eslint-disable-next-line no-console
      console.log(`║  OTP CODE: ${otpCode}           ║`);
      // eslint-disable-next-line no-console
      console.log(`║  Email: ${email.padEnd(20)} ║`);
      // eslint-disable-next-line no-console
      console.log(`╚════════════════════════════════╝\n`);
    }
  }
};

/**
 * @desc    Register new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  const { name, email, password, role, permissions, phone, hotelId } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Check if phone exists (if provided)
    if (phone) {
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this phone number'
        });
      }
    }

    // Set default permissions based on role
    let userPermissions = permissions || [];
    if (!userPermissions.length) {
      switch (role) {
        case 'admin':
          userPermissions = ['all'];
          break;
        case 'manager':
          userPermissions = [
            'view_analytics',
            'manage_bookings',
            'manage_guests',
            'manage_rooms',
            'manage_invoices',
            'view_reports'
          ];
          break;
        case 'staff':
          userPermissions = [
            'view_bookings',
            'checkin_checkout',
            'view_guests',
            'view_rooms'
          ];
          break;
        case 'guest':
          userPermissions = ['view_bookings', 'view_profile'];
          break;
        default:
          userPermissions = ['view_bookings'];
      }
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'staff',
      permissions: userPermissions,
      hotelId: hotelId || 'hotel_001',
      isActive: true
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, {
      role: user.role,
      hotelId: user.hotelId
    });

    // Save refresh token
    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User registered: ${email}, Role: ${role}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          permissions: user.permissions,
          hotelId: user.hotelId,
          avatar: user.avatar
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration error:', {
      error: error.message,
      stack: error.stack,
      email
    });

    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Request OTP for passwordless login
 * @route   POST /api/v1/auth/request-otp
 * @access  Public
 */
const requestOtpLogin = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  const { email, phone, name } = req.body;

  try {
    let user = await User.findOne({ email });

    // Auto-create guest user if not exists
    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        phone,
        role: 'guest',
        permissions: ['view_bookings', 'view_profile'],
        isActive: true,
        hotelId: 'hotel_001'
      });

      logger.info(`New guest user created: ${email}`);
    } else {
      // Validate phone if both provided
      if (user.phone && phone && user.phone !== phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number does not match our records for this email'
        });
      }

      // Update phone if not set
      if (!user.phone && phone) {
        user.phone = phone;
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been deactivated. Please contact support.'
        });
      }
    }

    // Generate OTP
    const otpCode = generateOtpCode();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to user
    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    user.otpAttempts = (user.otpAttempts || 0) + 1;
    await user.save();

    // Send OTP via email/SMS
    await sendOtp(email, phone, otpCode);

    logger.info(`OTP requested for: ${email}`);

    res.json({
      success: true,
      message: 'OTP sent successfully. Please check your email/phone.',
      data: {
        expiresIn: 300, // seconds
        maskedEmail: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      }
    });

  } catch (error) {
    logger.error('Request OTP error:', {
      error: error.message,
      stack: error.stack,
      email
    });

    res.status(500).json({
      success: false,
      message: 'Server error while generating OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Login with OTP
 * @route   POST /api/v1/auth/login-otp
 * @access  Public
 */
const loginWithOtp = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email }).select('+otpCode +otpExpires +password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check if OTP exists
    if (!user.otpCode || !user.otpExpires) {
      return res.status(400).json({
        success: false,
        message: 'No active OTP found. Please request a new OTP.'
      });
    }

    // Check OTP expiration
    if (user.otpExpires < new Date()) {
      user.otpCode = null;
      user.otpExpires = null;
      user.otpAttempts = 0;
      await user.save();

      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (user.otpCode !== otp) {
      logger.warn(`Invalid OTP attempt for: ${email}`);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // Clear OTP fields
    user.otpCode = null;
    user.otpExpires = null;
    user.otpAttempts = 0;
    user.lastLogin = new Date();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, {
      role: user.role,
      hotelId: user.hotelId
    });

    user.refreshToken = refreshToken;
    await user.save();

    logger.info(`User logged in with OTP: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar,
          phone: user.phone,
          hotelId: user.hotelId || 'hotel_001'
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login with OTP error:', {
      error: error.message,
      stack: error.stack,
      email
    });

    res.status(500).json({
      success: false,
      message: 'Server error during OTP login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Traditional login with email/password
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }

  const { email, password } = req.body;

  try {
    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn(`Invalid password attempt for: ${email}`);
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, {
      role: user.role,
      hotelId: user.hotelId
    });

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar,
          phone: user.phone,
          hotelId: user.hotelId
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login error:', {
      error: error.message,
      stack: error.stack,
      email
    });

    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get current authenticated user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-refreshToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          avatar: user.avatar,
          phone: user.phone,
          hotelId: user.hotelId,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    logger.error('Get me error:', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh
 * @access  Public
 */
const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'Refresh token required'
    });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    const user = await User.findById(decoded.userId).select('+refreshToken');

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    // Generate new token pair
    const tokens = generateTokens(user._id, {
      role: user.role,
      hotelId: user.hotelId
    });

    // Update refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save();

    logger.info(`Token refreshed for user: ${user.email}`);

    res.json({
      success: true,
      data: tokens
    });

  } catch (error) {
    logger.error('Refresh token error:', {
      error: error.message,
      stack: error.stack
    });

    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (user) {
      user.refreshToken = null;
      await user.save();
      
      logger.info(`User logged out: ${user.email}`);
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout error:', {
      error: error.message,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Request password reset email
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const requestPasswordReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    // Always respond with success to avoid email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    await sendPasswordResetEmail(email, resetToken);

    logger.info(`Password reset requested for: ${email}`);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    logger.error('Request password reset error:', { error: error.message, email });
    res.status(500).json({ success: false, message: 'Server error during password reset request' });
  }
};

/**
 * @desc    Reset password using token
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const { token, newPassword } = req.body;

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = null;
    await user.save();

    logger.info(`Password reset completed for: ${user.email}`);

    res.json({ success: true, message: 'Password has been reset successfully. Please log in.' });
  } catch (error) {
    logger.error('Reset password error:', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error during password reset' });
  }
};

/**
 * @desc    Change password for authenticated user
 * @route   PUT /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.refreshToken = null;
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    res.json({ success: true, message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    logger.error('Change password error:', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, message: 'Server error during password change' });
  }
};

module.exports = {
  register,
  login,
  loginWithOtp,
  requestOtpLogin,
  getMe,
  refreshToken,
  logout,
  requestPasswordReset,
  resetPassword,
  changePassword,
};
