/**
 * Guest Routes
 * Handles guest management, verification, and bulk operations
 * @version 1.0.0
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuests,
  initiateDigiLocker,
  digiLockerCallback
} = require('../controllers/guestController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadExcel } = require('../middlewares/uploadMiddleware');
const { handleValidationErrors } = require('../middlewares/errorMiddleware');

const router = express.Router();

// ========== Validation Rules ==========

const guestValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Guest name is required')
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
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(/^\+?[\d\s\-()]+$/)
    .withMessage('Please provide a valid phone number')
    .isLength({ min: 10, max: 20 })
    .withMessage('Phone number must be between 10 and 20 characters'),
  
  body('idType')
    .notEmpty().withMessage('ID type is required')
    .isIn(['passport', 'aadhar', 'driving_license', 'voter_id', 'pan_card'])
    .withMessage('Invalid ID type'),
  
  body('idNumber')
    .trim()
    .notEmpty().withMessage('ID number is required')
    .isLength({ min: 5, max: 20 })
    .withMessage('ID number must be between 5 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('ID number must contain only uppercase letters and numbers'),
  
  body('dateOfBirth')
    .optional()
    .isISO8601().withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const age = new Date().getFullYear() - new Date(value).getFullYear();
      if (age < 18 || age > 120) {
        throw new Error('Guest must be between 18 and 120 years old');
      }
      return true;
    }),
  
  body('nationality')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nationality must be between 2 and 50 characters'),
  
  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  
  body('address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  
  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  
  body('address.zipCode')
    .optional()
    .trim()
    .matches(/^[A-Z0-9\s-]{3,10}$/)
    .withMessage('Please provide a valid zip code'),
  
  body('emergencyContact.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Emergency contact name must be between 2 and 100 characters'),
  
  body('emergencyContact.phone')
    .optional()
    .matches(/^\+?[\d\s\-()]+$/)
    .withMessage('Please provide a valid emergency contact phone'),
  
  handleValidationErrors
];

const updateGuestValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .optional()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .matches(/^\+?[\d\s\-()]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('idType')
    .optional()
    .isIn(['passport', 'aadhar', 'driving_license', 'voter_id', 'pan_card'])
    .withMessage('Invalid ID type'),
  
  body('idNumber')
    .optional()
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('ID number must be between 5 and 20 characters'),
  
  handleValidationErrors
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid guest ID'),
  
  handleValidationErrors
];

const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const loyaltyPointsValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid guest ID'),
  
  body('points')
    .isInt({ min: -10000, max: 10000 })
    .withMessage('Points must be between -10000 and 10000'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Reason cannot exceed 200 characters'),
  
  handleValidationErrors
];

const blacklistValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid guest ID'),
  
  body('reason')
    .trim()
    .notEmpty().withMessage('Blacklist reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
  
  handleValidationErrors
];

// ========== All routes require authentication ==========
router.use(protect);

// ========== Guest CRUD Routes ==========

/**
 * @route   GET /api/v1/guests
 * @desc    Get all guests with filters and pagination
 * @access  Private (manage_guests, view_bookings)
 */
router.get(
  '/',
  authorize('manage_guests', 'view_bookings'),
  searchValidation,
  getGuests
);

/**
 * @route   POST /api/v1/guests
 * @desc    Create a new guest
 * @access  Private (manage_guests)
 */
router.post(
  '/',
  authorize('manage_guests'),
  guestValidation,
  createGuest
);

/**
 * @route   GET /api/v1/guests/search
 * @desc    Search guests by name, email, phone
 * @access  Private (manage_guests, view_bookings)
 * @note    Feature not yet implemented
 */
// router.get(
//   '/search',
//   authorize('manage_guests', 'view_bookings'),
//   searchValidation,
//   searchGuests
// );

/**
 * @route   GET /api/v1/guests/export
 * @desc    Export guests to Excel
 * @access  Private (manage_guests, manage_staff, all)
 * @note    Feature not yet implemented
 */
// router.get(
//   '/export',
//   authorize('manage_guests', 'manage_staff', 'all'),
//   exportGuests
// );

/**
 * @route   POST /api/v1/guests/import
 * @desc    Bulk import guests from Excel
 * @access  Private (manage_guests, manage_staff, all)
 */
router.post(
  '/import',
  authorize('manage_guests', 'manage_staff', 'all'),
  uploadExcel('file'),
  importGuests
);

/**
 * @route   GET /api/v1/guests/:id
 * @desc    Get single guest by ID
 * @access  Private (manage_guests, view_bookings)
 */
router.get(
  '/:id',
  authorize('manage_guests', 'view_bookings'),
  ...mongoIdValidation,
  getGuest
);

/**
 * @route   PUT /api/v1/guests/:id
 * @desc    Update guest
 * @access  Private (manage_guests)
 */
router.put(
  '/:id',
  authorize('manage_guests'),
  ...mongoIdValidation,
  ...updateGuestValidation,
  updateGuest
);

/**
 * @route   DELETE /api/v1/guests/:id
 * @desc    Delete guest (soft delete)
 * @access  Private (manage_guests)
 */
router.delete(
  '/:id',
  authorize('manage_guests'),
  ...mongoIdValidation,
  deleteGuest
);

// ========== Guest History Routes ==========

/**
 * @route   GET /api/v1/guests/:id/bookings
 * @desc    Get guest booking history
 * @access  Private (manage_guests, view_bookings)
 * @note    Feature not yet implemented
 */
// router.get(
//   '/:id/bookings',
//   authorize('manage_guests', 'view_bookings'),
//   ...mongoIdValidation,
//   getGuestBookingHistory
// );

/**
 * @route   GET /api/v1/guests/:id/spending
 * @desc    Get guest spending history
 * @access  Private (manage_guests, view_analytics)
 * @note    Feature not yet implemented
 */
// router.get(
//   '/:id/spending',
//   authorize('manage_guests', 'view_analytics'),
//   ...mongoIdValidation,
//   getGuestSpendingHistory
// );

// ========== Loyalty & Blacklist Routes ==========

/**
 * @route   PUT /api/v1/guests/:id/loyalty
 * @desc    Update guest loyalty points
 * @access  Private (manage_guests, manager, admin)
 * @note    Feature not yet implemented
 */
// router.put(
//   '/:id/loyalty',
//   authorize('manage_guests'),
//   loyaltyPointsValidation,
//   updateLoyaltyPoints
// );

/**
 * @route   PUT /api/v1/guests/:id/blacklist
 * @desc    Blacklist a guest
 * @access  Private (manage_guests, manager, admin)
 * @note    Feature not yet implemented
 */
// router.put(
//   '/:id/blacklist',
//   authorize('manage_guests'),
//   blacklistValidation,
//   blacklistGuest
// );

/**
 * @route   PUT /api/v1/guests/:id/unblacklist
 * @desc    Remove guest from blacklist
 * @access  Private (manage_guests, manager, admin)
 * @note    Feature not yet implemented
 */
// router.put(
//   '/:id/unblacklist',
//   authorize('manage_guests'),
//   ...mongoIdValidation,
//   unblacklistGuest
// );

// ========== DigiLocker Integration Routes ==========

/**
 * @route   POST /api/v1/guests/:id/digilocker/initiate
 * @desc    Initiate DigiLocker verification
 * @access  Private (manage_guests, manage_staff, all)
 */
router.post(
  '/:id/digilocker/initiate',
  authorize('manage_guests', 'manage_staff', 'all'),
  ...mongoIdValidation,
  initiateDigiLocker
);

/**
 * @route   POST /api/v1/guests/digilocker/callback
 * @desc    DigiLocker verification callback
 * @access  Public (webhook)
 */
router.post('/digilocker/callback', digiLockerCallback);

/**
 * @route   POST /api/v1/guests/:id/verify-document
 * @desc    Manually verify guest document
 * @access  Private (manage_guests, manager, admin)
 * @note    Feature not yet implemented
 */
// router.post(
//   '/:id/verify-document',
//   authorize('manage_guests'),
//   ...mongoIdValidation,
//   [
//     body('documentType')
//       .isIn(['aadhar', 'pan', 'driving_license', 'passport', 'voter_id'])
//       .withMessage('Invalid document type'),
//     handleValidationErrors
//   ],
//   verifyGuestDocument
// );

module.exports = router;
