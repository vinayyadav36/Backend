/**
 * Booking Routes
 * Handles bookings, reservations, check-in/out, and bulk operations
 * @version 1.0.0
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getBookings,
  getBooking,
  createBooking,
  updateBooking,
  deleteBooking,
  importBookings,
  checkInBooking,
  checkOutBooking,
  getTodayArrivals,
  getTodayDepartures,
  getBookingStatistics
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadExcel } = require('../middlewares/uploadMiddleware');
const { handleValidationErrors } = require('../middlewares/errorMiddleware');

const router = express.Router();

// ========== Validation Rules ==========

const bookingValidation = [
  body('guest')
    .notEmpty().withMessage('Guest is required')
    .isMongoId().withMessage('Valid guest ID is required'),
  
  body('room')
    .notEmpty().withMessage('Room is required')
    .isMongoId().withMessage('Valid room ID is required'),
  
  body('checkInDate')
    .notEmpty().withMessage('Check-in date is required')
    .isISO8601().withMessage('Please provide a valid check-in date')
    .custom((value) => {
      const checkIn = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Allow bookings from yesterday for walk-ins
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (checkIn < yesterday) {
        throw new Error('Check-in date cannot be more than 1 day in the past');
      }
      return true;
    }),
  
  body('checkOutDate')
    .notEmpty().withMessage('Check-out date is required')
    .isISO8601().withMessage('Please provide a valid check-out date')
    .custom((value, { req }) => {
      const checkOut = new Date(value);
      const checkIn = new Date(req.body.checkInDate);
      if (checkOut <= checkIn) {
        throw new Error('Check-out date must be after check-in date');
      }
      // Maximum booking duration: 90 days
      const maxDuration = 90 * 24 * 60 * 60 * 1000;
      if (checkOut - checkIn > maxDuration) {
        throw new Error('Booking duration cannot exceed 90 days');
      }
      return true;
    }),
  
  body('adults')
    .notEmpty().withMessage('Number of adults is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Adults must be between 1 and 10'),
  
  body('children')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Children must be between 0 and 10'),
  
  body('totalAmount')
    .notEmpty().withMessage('Total amount is required')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number')
    .custom((value) => {
      if (value > 10000000) {
        throw new Error('Total amount cannot exceed 10,000,000');
      }
      return true;
    }),
  
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number')
    .custom((value, { req }) => {
      if (value > req.body.totalAmount) {
        throw new Error('Paid amount cannot exceed total amount');
      }
      return true;
    }),
  
  body('source')
    .optional()
    .isIn(['online', 'direct', 'phone', 'walk-in', 'travel_agency', 'corporate', 'import'])
    .withMessage('Invalid booking source'),
  
  body('specialRequests')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Special requests cannot exceed 500 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  body('discountCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Discount code cannot exceed 20 characters')
    .isAlphanumeric()
    .withMessage('Discount code must be alphanumeric'),
  
  body('isGroupBooking')
    .optional()
    .isBoolean()
    .withMessage('Group booking must be a boolean'),
  
  body('groupName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Group name cannot exceed 100 characters'),
  
  handleValidationErrors
];

const updateBookingValidation = [
  body('checkInDate')
    .optional()
    .isISO8601().withMessage('Please provide a valid check-in date'),
  
  body('checkOutDate')
    .optional()
    .isISO8601().withMessage('Please provide a valid check-out date')
    .custom((value, { req }) => {
      if (req.body.checkInDate && value) {
        const checkOut = new Date(value);
        const checkIn = new Date(req.body.checkInDate);
        if (checkOut <= checkIn) {
          throw new Error('Check-out date must be after check-in date');
        }
      }
      return true;
    }),
  
  body('adults')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Adults must be between 1 and 10'),
  
  body('children')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Children must be between 0 and 10'),
  
  body('status')
    .optional()
    .isIn(['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'])
    .withMessage('Invalid booking status'),
  
  body('totalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Paid amount must be a positive number'),
  
  handleValidationErrors
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  handleValidationErrors
];

const _cancelBookingValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  body('reason')
    .trim()
    .notEmpty().withMessage('Cancellation reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Cancellation reason must be between 10 and 500 characters'),
  
  handleValidationErrors
];

const checkInValidation = [
  body('actualCheckInDate')
    .optional()
    .isISO8601().withMessage('Please provide a valid check-in date'),
  
  body('identityVerified')
    .optional()
    .isBoolean()
    .withMessage('Identity verified must be a boolean'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  handleValidationErrors
];

const checkOutValidation = [
  body('actualCheckOutDate')
    .optional()
    .isISO8601().withMessage('Please provide a valid check-out date'),
  
  body('finalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Final amount must be a positive number'),
  
  body('damageCharges')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Damage charges must be a positive number'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  handleValidationErrors
];

const _extraServiceValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  body('service')
    .notEmpty().withMessage('Service is required')
    .isIn(['breakfast', 'lunch', 'dinner', 'airport_pickup', 'airport_drop', 'spa', 'laundry', 'extra_bed'])
    .withMessage('Invalid service type'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  body('price')
    .notEmpty().withMessage('Price is required')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('date')
    .optional()
    .isISO8601().withMessage('Please provide a valid date'),
  
  handleValidationErrors
];

const _paymentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid booking ID'),
  
  body('amount')
    .notEmpty().withMessage('Payment amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  
  body('method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet'])
    .withMessage('Invalid payment method'),
  
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Payment reference cannot exceed 100 characters'),
  
  handleValidationErrors
];

const searchValidation = [
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show', 'all'])
    .withMessage('Invalid status filter'),
  
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid start date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid end date'),
  
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

// ========== All routes require authentication ==========
router.use(protect);

// ========== Booking CRUD Routes ==========

/**
 * @route   GET /api/v1/bookings
 * @desc    Get all bookings with filters and pagination
 * @access  Private (manage_bookings, view_bookings)
 */
router.get(
  '/',
  authorize('manage_bookings', 'view_bookings'),
  searchValidation,
  getBookings
);

/**
 * @route   POST /api/v1/bookings
 * @desc    Create a new booking
 * @access  Private (manage_bookings)
 */
router.post(
  '/',
  authorize('manage_bookings'),
  bookingValidation,
  createBooking
);

// TODO: Implement these functions in bookingController.js
// /**
//  * @route   GET /api/v1/bookings/search
//  * @desc    Search bookings by confirmation number, guest name, etc.
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.get(
//   '/search',
//   authorize('manage_bookings', 'view_bookings'),
//   searchValidation,
//   searchBookings
// );

/**
 * @route   GET /api/v1/bookings/statistics
 * @desc    Get booking statistics
 * @access  Private (manage_bookings, view_analytics)
 */
router.get(
  '/statistics',
  authorize('manage_bookings', 'view_analytics'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    handleValidationErrors
  ],
  getBookingStatistics
);

/**
 * @route   GET /api/v1/bookings/today/arrivals
 * @desc    Get today's arrivals
 * @access  Private (manage_bookings, view_bookings, checkin_checkout)
 */
router.get(
  '/today/arrivals',
  authorize('manage_bookings', 'view_bookings', 'checkin_checkout'),
  getTodayArrivals
);

/**
 * @route   GET /api/v1/bookings/today/departures
 * @desc    Get today's departures
 * @access  Private (manage_bookings, view_bookings, checkin_checkout)
 */
router.get(
  '/today/departures',
  authorize('manage_bookings', 'view_bookings', 'checkin_checkout'),
  getTodayDepartures
);

// /**
//  * @route   GET /api/v1/bookings/upcoming/check-ins
//  * @desc    Get upcoming check-ins (next 7 days)
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.get(
//   '/upcoming/check-ins',
//   authorize('manage_bookings', 'view_bookings'),
//   [
//     query('days').optional().isInt({ min: 1, max: 90 }),
//     handleValidationErrors
//   ],
//   getUpcomingCheckIns
// );

// /**
//  * @route   GET /api/v1/bookings/upcoming/check-outs
//  * @desc    Get upcoming check-outs (next 7 days)
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.get(
//   '/upcoming/check-outs',
//   authorize('manage_bookings', 'view_bookings'),
//   [
//     query('days').optional().isInt({ min: 1, max: 90 }),
//     handleValidationErrors
//   ],
//   getUpcomingCheckOuts
// );

// /**
//  * @route   GET /api/v1/bookings/export
//  * @desc    Export bookings to Excel
//  * @access  Private (manage_bookings, manage_staff, all)
//  */
// router.get(
//   '/export',
//   authorize('manage_bookings', 'manage_staff', 'all'),
//   exportBookings
// );

/**
 * @route   POST /api/v1/bookings/import
 * @desc    Bulk import bookings from Excel
 * @access  Private (manage_bookings, manage_staff, all)
 */
router.post(
  '/import',
  authorize('manage_bookings', 'manage_staff', 'all'),
  uploadExcel('file'),
  importBookings
);

// TODO: Implement these functions in bookingController.js
// /**
//  * @route   POST /api/v1/bookings/calculate
//  * @desc    Calculate booking amount (preview)
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.post(
//   '/calculate',
//   authorize('manage_bookings', 'view_bookings'),
//   [
//     body('roomId').isMongoId().withMessage('Valid room ID is required'),
//     body('checkInDate').isISO8601().withMessage('Valid check-in date is required'),
//     body('checkOutDate').isISO8601().withMessage('Valid check-out date is required'),
//     body('adults').optional().isInt({ min: 1, max: 10 }),
//     body('children').optional().isInt({ min: 0, max: 10 }),
//     body('discountCode').optional().trim(),
//     handleValidationErrors
//   ],
//   calculateBookingAmount
// );

// /**
//  * @route   GET /api/v1/bookings/guest/:guestId
//  * @desc    Get all bookings for a specific guest
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.get(
//   '/guest/:guestId',
//   authorize('manage_bookings', 'view_bookings'),
//   [
//     param('guestId').isMongoId().withMessage('Invalid guest ID'),
//     handleValidationErrors
//   ],
//   getBookingsByGuest
// );

// /**
//  * @route   GET /api/v1/bookings/room/:roomId
//  * @desc    Get all bookings for a specific room
//  * @access  Private (manage_bookings, view_bookings)
//  */
// router.get(
//   '/room/:roomId',
//   authorize('manage_bookings', 'view_bookings'),
//   [
//     param('roomId').isMongoId().withMessage('Invalid room ID'),
//     handleValidationErrors
//   ],
//   getBookingsByRoom
// );

/**
 * @route   GET /api/v1/bookings/:id
 * @desc    Get single booking by ID
 * @access  Private (manage_bookings, view_bookings)
 */
router.get(
  '/:id',
  authorize('manage_bookings', 'view_bookings'),
  ...mongoIdValidation,
  getBooking
);

/**
 * @route   PUT /api/v1/bookings/:id
 * @desc    Update booking
 * @access  Private (manage_bookings)
 */
router.put(
  '/:id',
  authorize('manage_bookings'),
  ...mongoIdValidation,
  ...updateBookingValidation,
  updateBooking
);

/**
 * @route   DELETE /api/v1/bookings/:id
 * @desc    Delete booking (soft delete)
 * @access  Private (manage_bookings, admin)
 */
router.delete(
  '/:id',
  authorize('manage_bookings'),
  ...mongoIdValidation,
  deleteBooking
);

// ========== Booking Operations Routes ==========
// TODO: Implement these functions in bookingController.js

// /**
//  * @route   PUT /api/v1/bookings/:id/cancel
//  * @desc    Cancel a booking
//  * @access  Private (manage_bookings)
//  */
// router.put(
//   '/:id/cancel',
//   authorize('manage_bookings'),
//   cancelBookingValidation,
//   cancelBooking
// );

/**
 * @route   PUT /api/v1/bookings/:id/check-in
 * @desc    Check-in a guest
 * @access  Private (manage_bookings, checkin_checkout)
 */
router.put(
  '/:id/check-in',
  authorize('manage_bookings', 'checkin_checkout'),
  ...mongoIdValidation,
  ...checkInValidation,
  checkInBooking
);

/**
 * @route   PUT /api/v1/bookings/:id/check-out
 * @desc    Check-out a guest
 * @access  Private (manage_bookings, checkin_checkout)
 */
router.put(
  '/:id/check-out',
  authorize('manage_bookings', 'checkin_checkout'),
  ...mongoIdValidation,
  ...checkOutValidation,
  checkOutBooking
);

// ========== Extra Services Routes ==========
// TODO: Implement these functions in bookingController.js

// /**
//  * @route   POST /api/v1/bookings/:id/extra-services
//  * @desc    Add extra service to booking
//  * @access  Private (manage_bookings)
//  */
// router.post(
//   '/:id/extra-services',
//   authorize('manage_bookings'),
//   extraServiceValidation,
//   addExtraService
// );

// /**
//  * @route   DELETE /api/v1/bookings/:id/extra-services/:serviceId
//  * @desc    Remove extra service from booking
//  * @access  Private (manage_bookings)
//  */
// router.delete(
//   '/:id/extra-services/:serviceId',
//   authorize('manage_bookings'),
//   [
//     param('id').isMongoId().withMessage('Invalid booking ID'),
//     param('serviceId').isMongoId().withMessage('Invalid service ID'),
//     handleValidationErrors
//   ],
//   removeExtraService
// );

// ========== Payment Routes ==========
// TODO: Implement these functions in bookingController.js

// /**
//  * @route   POST /api/v1/bookings/:id/payments
//  * @desc    Add payment to booking
//  * @access  Private (manage_bookings, manage_invoices)
//  */
// router.post(
//   '/:id/payments',
//   authorize('manage_bookings', 'manage_invoices'),
//   paymentValidation,
//   addPayment
// );

// /**
//  * @route   PUT /api/v1/bookings/:id/payment-status
//  * @desc    Update payment status
//  * @access  Private (manage_bookings, manage_invoices)
//  */
// router.put(
//   '/:id/payment-status',
//   authorize('manage_bookings', 'manage_invoices'),
//   [
//     param('id').isMongoId().withMessage('Invalid booking ID'),
//     body('paymentStatus')
//       .isIn(['pending', 'partial', 'paid', 'refunded', 'failed'])
//       .withMessage('Invalid payment status'),
//     handleValidationErrors
//   ],
//   updatePaymentStatus
// );

module.exports = router;
