/**
 * Authentication Routes
 * Handles user registration, OTP-based login, token refresh, and logout
 * @version 1.0.0
 */

const express = require('express');
const { body } = require('express-validator');
const {
  register,
  loginWithOtp,
  login,
  getMe,
  refreshToken,
  logout,
  requestOtpLogin,
  requestPasswordReset,
  resetPassword,
  changePassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');
const { handleValidationErrors } = require('../middlewares/errorMiddleware');

const router = express.Router();

// ========== Validation Rules ==========

const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s.'-]+$/)
    .withMessage('Name can only contain letters, spaces, and basic punctuation'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email cannot exceed 255 characters'),
  
  body('password')
    .optional()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-()]+$/)
    .withMessage('Please provide a valid phone number')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  
  body('role')
    .optional()
    .isIn(['staff', 'manager', 'admin'])
    .withMessage('Invalid role specified'),
  
  handleValidationErrors
];

const requestOtpValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-()]+$/)
    .withMessage('Please provide a valid phone number'),
  
  handleValidationErrors
];

const loginOtpValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .isLength({ min: 4, max: 10 })
    .withMessage('Please provide a valid OTP')
    .isNumeric().withMessage('OTP must contain only numbers'),
  
  handleValidationErrors
];

const loginPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  handleValidationErrors
];

// FUTURE FEATURE - Not yet implemented
// const updateProfileValidation = [
//   body('name')
//     .optional()
//     .trim()
//     .isLength({ min: 2, max: 100 })
//     .withMessage('Name must be between 2 and 100 characters'),
//   
//   body('phone')
//     .optional()
//     .matches(/^\+?[\d\s\-()]+$/)
//     .withMessage('Please provide a valid phone number'),
//   
//   body('avatar')
//     .optional()
//     .isURL().withMessage('Avatar must be a valid URL'),
//   
//   body('preferences.language')
//     .optional()
//     .isIn(['en', 'hi'])
//     .withMessage('Invalid language preference'),
//   
//   body('preferences.theme')
//     .optional()
//     .isIn(['light', 'dark', 'auto'])
//     .withMessage('Invalid theme preference'),
//   
//   handleValidationErrors
// ];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),
  
  handleValidationErrors
];

const resetPasswordValidation = [
  body('token')
    .notEmpty().withMessage('Reset token is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match'),

  handleValidationErrors
];

const requestPasswordResetValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  handleValidationErrors
];

const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token is required'),
  
  handleValidationErrors
];

// ========== Public Routes ==========

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, register);

/**
 * @route   POST /api/v1/auth/request-otp
 * @desc    Request OTP for login
 * @access  Public
 */
router.post('/request-otp', requestOtpValidation, requestOtpLogin);

/**
 * @route   POST /api/v1/auth/login-otp
 * @desc    Login with OTP
 * @access  Public
 */
router.post('/login-otp', loginOtpValidation, loginWithOtp);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login with email and password
 * @access  Public
 */
router.post('/login', loginPasswordValidation, login);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 */
router.post('/forgot-password', requestPasswordResetValidation, requestPasswordReset);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', resetPasswordValidation, resetPassword);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', refreshTokenValidation, refreshToken);

// ========== Protected Routes ==========

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   PUT /api/v1/auth/me
 * @desc    Update current user profile
 * @access  Private
 * @note    Feature not yet implemented - placeholder for future
 */
// router.put('/me', protect, updateProfileValidation, updateMe);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.put('/change-password', protect, changePasswordValidation, changePassword);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout', protect, logout);

module.exports = router;
