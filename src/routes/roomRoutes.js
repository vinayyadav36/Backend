/**
 * Room Routes
 * Handles room inventory, availability, maintenance, and IoT integration
 * @version 1.0.0
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  checkAvailability,
  updateRoomStatus,
  getRoomStatistics
  // TODO: Implement these functions in roomController.js
  // getRoomAvailabilityCalendar,
  // assignRoomToBooking,
  // addMaintenanceRecord,
  // updateMaintenanceRecord,
  // getMaintenanceSchedule,
  // uploadRoomImages,
  // deleteRoomImage,
  // getRoomRevenue,
  // bulkUpdateRoomStatus,
  // getOccupancyReport
} = require('../controllers/roomController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadMultiple } = require('../middlewares/uploadMiddleware');
const { handleValidationErrors } = require('../middlewares/errorMiddleware');

const router = express.Router();

// ========== Validation Rules ==========

const roomValidation = [
  body('number')
    .trim()
    .notEmpty().withMessage('Room number is required')
    .isLength({ min: 1, max: 10 })
    .withMessage('Room number must be between 1 and 10 characters')
    .matches(/^[A-Z0-9\-]+$/)
    .withMessage('Room number can only contain uppercase letters, numbers, and hyphens'),
  
  body('type')
    .notEmpty().withMessage('Room type is required')
    .isIn(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family', 'studio'])
    .withMessage('Invalid room type'),
  
  body('floor')
    .notEmpty().withMessage('Floor number is required')
    .isInt({ min: 0, max: 100 })
    .withMessage('Floor must be between 0 and 100'),
  
  body('rate.baseRate')
    .notEmpty().withMessage('Base rate is required')
    .isFloat({ min: 0 })
    .withMessage('Base rate must be a positive number')
    .custom((value) => {
      if (value > 1000000) {
        throw new Error('Base rate cannot exceed 1,000,000');
      }
      return true;
    }),
  
  body('rate.currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR', 'GBP'])
    .withMessage('Invalid currency'),
  
  body('rate.weekendRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Weekend rate must be a positive number'),
  
  body('rate.holidayRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Holiday rate must be a positive number'),
  
  body('capacity.adults')
    .notEmpty().withMessage('Adult capacity is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Adult capacity must be between 1 and 10'),
  
  body('capacity.children')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Children capacity must be between 0 and 5'),
  
  body('size')
    .optional()
    .isInt({ min: 50, max: 5000 })
    .withMessage('Room size must be between 50 and 5000 sq ft'),
  
  body('amenities')
    .optional()
    .isArray()
    .withMessage('Amenities must be an array'),
  
  body('amenities.*')
    .optional()
    .isString()
    .withMessage('Each amenity must be a string'),
  
  body('features.smokingAllowed')
    .optional()
    .isBoolean()
    .withMessage('Smoking allowed must be a boolean'),
  
  body('features.petFriendly')
    .optional()
    .isBoolean()
    .withMessage('Pet friendly must be a boolean'),
  
  body('features.accessible')
    .optional()
    .isBoolean()
    .withMessage('Accessible must be a boolean'),
  
  handleValidationErrors
];

const updateRoomValidation = [
  body('number')
    .optional()
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Room number must be between 1 and 10 characters'),
  
  body('type')
    .optional()
    .isIn(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family', 'studio'])
    .withMessage('Invalid room type'),
  
  body('floor')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Floor must be between 0 and 100'),
  
  body('rate.baseRate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Base rate must be a positive number'),
  
  body('capacity.adults')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Adult capacity must be between 1 and 10'),
  
  body('status')
    .optional()
    .isIn(['available', 'occupied', 'maintenance', 'reserved', 'dirty', 'cleaning', 'out-of-order'])
    .withMessage('Invalid room status'),
  
  handleValidationErrors
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid room ID'),
  
  handleValidationErrors
];

const availabilityValidation = [
  body('checkInDate')
    .notEmpty().withMessage('Check-in date is required')
    .isISO8601().withMessage('Please provide a valid check-in date')
    .custom((value) => {
      const checkIn = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkIn < today) {
        throw new Error('Check-in date cannot be in the past');
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
      return true;
    }),
  
  body('roomType')
    .optional()
    .isIn(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family', 'studio', 'all'])
    .withMessage('Invalid room type'),
  
  body('guests')
    .optional()
    .isInt({ min: 1, max: 15 })
    .withMessage('Number of guests must be between 1 and 15'),
  
  handleValidationErrors
];

const statusUpdateValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid room ID'),
  
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['available', 'occupied', 'maintenance', 'reserved', 'dirty', 'cleaning', 'out-of-order'])
    .withMessage('Invalid room status'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  handleValidationErrors
];

const maintenanceValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid room ID'),
  
  body('type')
    .notEmpty().withMessage('Maintenance type is required')
    .isIn(['cleaning', 'repair', 'inspection', 'renovation', 'pest_control', 'deep_cleaning'])
    .withMessage('Invalid maintenance type'),
  
  body('scheduledDate')
    .notEmpty().withMessage('Scheduled date is required')
    .isISO8601().withMessage('Please provide a valid scheduled date'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a positive number'),
  
  body('assignedTo')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Assigned to cannot exceed 100 characters'),
  
  handleValidationErrors
];

const bulkStatusUpdateValidation = [
  body('roomIds')
    .isArray({ min: 1 })
    .withMessage('Room IDs array is required with at least one ID'),
  
  body('roomIds.*')
    .isMongoId()
    .withMessage('Each room ID must be valid'),
  
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['available', 'occupied', 'maintenance', 'reserved', 'dirty', 'cleaning', 'out-of-order'])
    .withMessage('Invalid room status'),
  
  handleValidationErrors
];

// ========== All routes require authentication ==========
router.use(protect);

// ========== Room CRUD Routes ==========

/**
 * @route   GET /api/v1/rooms
 * @desc    Get all rooms with filters and pagination
 * @access  Private (manage_rooms, view_bookings)
 */
router.get(
  '/',
  authorize('manage_rooms', 'view_bookings'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['available', 'occupied', 'maintenance', 'reserved', 'dirty', 'cleaning', 'out-of-order', 'all']),
    query('type').optional().isIn(['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family', 'studio', 'all']),
    query('floor').optional().isInt({ min: 0, max: 100 }),
    handleValidationErrors
  ],
  getRooms
);

/**
 * @route   POST /api/v1/rooms
 * @desc    Create a new room
 * @access  Private (manage_rooms, admin, manager)
 */
router.post(
  '/',
  authorize('manage_rooms'),
  roomValidation,
  createRoom
);

/**
 * @route   GET /api/v1/rooms/statistics
 * @desc    Get room statistics (total, by status, by type)
 * @access  Private (manage_rooms, view_analytics)
 */
router.get(
  '/statistics',
  authorize('manage_rooms', 'view_analytics'),
  getRoomStatistics
);

// /**
//  * @route   GET /api/v1/rooms/occupancy-report
//  * @desc    Get occupancy report for date range
//  * @access  Private (manage_rooms, view_analytics)
//  */
// router.get(
//   '/occupancy-report',
//   authorize('manage_rooms', 'view_analytics'),
//   [
//     query('startDate').isISO8601().withMessage('Valid start date is required'),
//     query('endDate').isISO8601().withMessage('Valid end date is required'),
//     handleValidationErrors
//   ],
//   getOccupancyReport
// );

/**
 * @route   POST /api/v1/rooms/check-availability
 * @desc    Check room availability for date range
 * @access  Private (manage_rooms, view_bookings, manage_bookings)
 */
router.post(
  '/check-availability',
  authorize('manage_rooms', 'view_bookings', 'manage_bookings'),
  availabilityValidation,
  checkAvailability
);

// TODO: Implement this function in roomController.js
// /**
//  * @route   PUT /api/v1/rooms/bulk-update-status
//  * @desc    Bulk update room status
//  * @access  Private (manage_rooms, admin, manager)
//  */
// router.put(
//   '/bulk-update-status',
//   authorize('manage_rooms'),
//   bulkStatusUpdateValidation,
//   bulkUpdateRoomStatus
// );

/**
 * @route   GET /api/v1/rooms/:id
 * @desc    Get single room by ID
 * @access  Private (manage_rooms, view_bookings)
 */
router.get(
  '/:id',
  authorize('manage_rooms', 'view_bookings'),
  ...mongoIdValidation,
  getRoom
);

/**
 * @route   PUT /api/v1/rooms/:id
 * @desc    Update room
 * @access  Private (manage_rooms)
 */
router.put(
  '/:id',
  authorize('manage_rooms'),
  ...mongoIdValidation,
  ...updateRoomValidation,
  updateRoom
);

/**
 * @route   DELETE /api/v1/rooms/:id
 * @desc    Delete room (soft delete)
 * @access  Private (manage_rooms, admin)
 */
router.delete(
  '/:id',
  authorize('manage_rooms'),
  ...mongoIdValidation,
  deleteRoom
);

// ========== Room Status & Assignment Routes ==========

/**
 * @route   PUT /api/v1/rooms/:id/status
 * @desc    Update room status (available, occupied, maintenance, etc.)
 * @access  Private (manage_rooms, checkin_checkout)
 */
router.put(
  '/:id/status',
  authorize('manage_rooms', 'checkin_checkout'),
  ...statusUpdateValidation,
  updateRoomStatus
);

// /**
//  * @route   POST /api/v1/rooms/:id/assign
//  * @desc    Assign room to booking
//  * @access  Private (manage_rooms, manage_bookings)
//  */
// router.post(
//   '/:id/assign',
//   authorize('manage_rooms', 'manage_bookings'),
//   [
//     param('id').isMongoId().withMessage('Invalid room ID'),
//     body('bookingId').isMongoId().withMessage('Valid booking ID is required'),
//     handleValidationErrors
//   ],
//   assignRoomToBooking
// );

// ========== Room Availability & Calendar Routes ==========
// TODO: Implement these functions in roomController.js

// /**
//  * @route   GET /api/v1/rooms/:id/availability
//  * @desc    Get room availability calendar for month
//  * @access  Private (manage_rooms, view_bookings)
//  */
// router.get(
//   '/:id/availability',
//   authorize('manage_rooms', 'view_bookings'),
//   [
//     param('id').isMongoId().withMessage('Invalid room ID'),
//     query('month').optional().isInt({ min: 1, max: 12 }),
//     query('year').optional().isInt({ min: 2020, max: 2100 }),
//     handleValidationErrors
//   ],
//   getRoomAvailabilityCalendar
// );

// /**
//  * @route   GET /api/v1/rooms/:id/revenue
//  * @desc    Get room revenue for date range
//  * @access  Private (manage_rooms, view_analytics)
//  */
// router.get(
//   '/:id/revenue',
//   authorize('manage_rooms', 'view_analytics'),
//   [
//     param('id').isMongoId().withMessage('Invalid room ID'),
//     query('startDate').isISO8601().withMessage('Valid start date is required'),
//     query('endDate').isISO8601().withMessage('Valid end date is required'),
//     handleValidationErrors
//   ],
//   getRoomRevenue
// );

// ========== Room Maintenance Routes ==========
// TODO: Implement these functions in roomController.js

// /**
//  * @route   GET /api/v1/rooms/:id/maintenance
//  * @desc    Get maintenance schedule for room
//  * @access  Private (manage_rooms)
//  */
// router.get(
//   '/:id/maintenance',
//   authorize('manage_rooms'),
//   ...mongoIdValidation,
//   getMaintenanceSchedule
// );

// /**
//  * @route   POST /api/v1/rooms/:id/maintenance
//  * @desc    Add maintenance record
//  * @access  Private (manage_rooms)
//  */
// router.post(
//   '/:id/maintenance',
//   authorize('manage_rooms'),
//   maintenanceValidation,
//   addMaintenanceRecord
// );

// /**
//  * @route   PUT /api/v1/rooms/:id/maintenance/:maintenanceId
//  * @desc    Update maintenance record
//  * @access  Private (manage_rooms)
//  */
// router.put(
//   '/:id/maintenance/:maintenanceId',
//   authorize('manage_rooms'),
//   [
//     param('id').isMongoId().withMessage('Invalid room ID'),
//     param('maintenanceId').isMongoId().withMessage('Invalid maintenance ID'),
//     body('status').optional().isIn(['scheduled', 'in-progress', 'completed', 'cancelled', 'on-hold']),
//     body('completedDate').optional().isISO8601(),
//     body('cost').optional().isFloat({ min: 0 }),
//     handleValidationErrors
//   ],
//   updateMaintenanceRecord
// );

// ========== Room Image Management Routes ==========
// TODO: Implement these functions in roomController.js

// /**
//  * @route   POST /api/v1/rooms/:id/images
//  * @desc    Upload room images
//  * @access  Private (manage_rooms)
//  */
// router.post(
//   '/:id/images',
//   authorize('manage_rooms'),
//   ...mongoIdValidation,
//   uploadMultiple('images', 5),
//   uploadRoomImages
// );

// /**
//  * @route   DELETE /api/v1/rooms/:id/images/:imageId
//  * @desc    Delete room image
//  * @access  Private (manage_rooms)
//  */
// router.delete(
//   '/:id/images/:imageId',
//   authorize('manage_rooms'),
//   [
//     param('id').isMongoId().withMessage('Invalid room ID'),
//     param('imageId').isMongoId().withMessage('Invalid image ID'),
//     handleValidationErrors
//   ],
//   deleteRoomImage
// );

module.exports = router;
