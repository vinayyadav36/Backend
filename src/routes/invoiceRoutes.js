/**
 * Invoice Routes
 * Handles billing, invoicing, payments, and PDF generation
 * @version 1.0.0
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF
  // TODO: Implement these functions in invoiceController.js
  // sendInvoiceEmail,
  // getOverdueInvoices,
  // getInvoiceStatistics,
  // addPaymentToInvoice,
  // voidInvoice,
  // markAsPaid,
  // getRevenueReport,
  // exportInvoices,
  // getInvoicesByGuest,
  // getInvoicesByBooking,
  // duplicateInvoice
} = require('../controllers/invoiceController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { handleValidationErrors } = require('../middlewares/errorMiddleware');

const router = express.Router();

// ========== Validation Rules ==========

const invoiceItemValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  
  body('items.*.description')
    .trim()
    .notEmpty().withMessage('Item description is required')
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  
  body('items.*.quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  body('items.*.rate')
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  
  body('items.*.category')
    .optional()
    .isIn(['room', 'food', 'beverage', 'spa', 'laundry', 'minibar', 'transport', 'parking', 'internet', 'telephone', 'other'])
    .withMessage('Invalid item category')
];

const invoiceValidation = [
  body('booking')
    .notEmpty().withMessage('Booking is required')
    .isMongoId().withMessage('Valid booking ID is required'),
  
  body('guest')
    .notEmpty().withMessage('Guest is required')
    .isMongoId().withMessage('Valid guest ID is required'),
  
  ...invoiceItemValidation,
  
  body('subtotal')
    .notEmpty().withMessage('Subtotal is required')
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  
  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
  
  body('totalAmount')
    .notEmpty().withMessage('Total amount is required')
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  
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
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet', 'corporate'])
    .withMessage('Invalid payment method'),
  
  body('paymentTerms')
    .optional()
    .isIn(['immediate', 'net_15', 'net_30', 'net_60', 'custom'])
    .withMessage('Invalid payment terms'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid due date'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  
  handleValidationErrors
];

const updateInvoiceValidation = [
  body('items')
    .optional()
    .isArray({ min: 1 })
    .withMessage('Items must be an array with at least one item'),
  
  body('items.*.description')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Description must be between 1 and 200 characters'),
  
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  body('items.*.rate')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Rate must be a positive number'),
  
  body('subtotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Subtotal must be a positive number'),
  
  body('taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Tax rate must be between 0 and 100'),
  
  body('discount')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
  
  body('totalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total amount must be a positive number'),
  
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'])
    .withMessage('Invalid invoice status'),
  
  handleValidationErrors
];

const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid invoice ID'),
  
  handleValidationErrors
];

const _paymentValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid invoice ID'),
  
  body('amount')
    .notEmpty().withMessage('Payment amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Payment amount must be greater than 0'),
  
  body('method')
    .notEmpty().withMessage('Payment method is required')
    .isIn(['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet', 'corporate'])
    .withMessage('Invalid payment method'),
  
  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Payment reference cannot exceed 100 characters'),
  
  handleValidationErrors
];

const _emailInvoiceValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid invoice ID'),
  
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject cannot exceed 200 characters'),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Message cannot exceed 1000 characters'),
  
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
    .isIn(['draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'refunded', 'all'])
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

// ========== Invoice CRUD Routes ==========

/**
 * @route   GET /api/v1/invoices
 * @desc    Get all invoices with filters and pagination
 * @access  Private (manage_invoices, view_bookings)
 */
router.get(
  '/',
  authorize('manage_invoices', 'view_bookings'),
  searchValidation,
  getInvoices
);

/**
 * @route   POST /api/v1/invoices
 * @desc    Create a new invoice
 * @access  Private (manage_invoices)
 */
router.post(
  '/',
  authorize('manage_invoices'),
  invoiceValidation,
  createInvoice
);

// TODO: Implement these functions in invoiceController.js
// /**
//  * @route   GET /api/v1/invoices/statistics
//  * @desc    Get invoice statistics (revenue, pending, overdue)
//  * @access  Private (manage_invoices, view_analytics)
//  */
// router.get(
//   '/statistics',
//   authorize('manage_invoices', 'view_analytics'),
//   [
//     query('startDate').optional().isISO8601(),
//     query('endDate').optional().isISO8601(),
//     handleValidationErrors
//   ],
//   getInvoiceStatistics
// );

// /**
//  * @route   GET /api/v1/invoices/overdue
//  * @desc    Get all overdue invoices
//  * @access  Private (manage_invoices, view_analytics)
//  */
// router.get(
//   '/overdue',
//   authorize('manage_invoices', 'view_analytics'),
//   getOverdueInvoices
// );

// /**
//  * @route   GET /api/v1/invoices/revenue-report
//  * @desc    Get revenue report for date range
//  * @access  Private (manage_invoices, view_analytics)
//  */
// router.get(
//   '/revenue-report',
//   authorize('manage_invoices', 'view_analytics'),
//   [
//     query('startDate').isISO8601().withMessage('Valid start date is required'),
//     query('endDate').isISO8601().withMessage('Valid end date is required'),
//     query('groupBy').optional().isIn(['day', 'week', 'month']),
//     handleValidationErrors
//   ],
//   getRevenueReport
// );

// /**
//  * @route   GET /api/v1/invoices/export
//  * @desc    Export invoices to Excel
//  * @access  Private (manage_invoices, manage_staff, all)
//  */
// router.get(
//   '/export',
//   authorize('manage_invoices', 'manage_staff', 'all'),
//   exportInvoices
// );

// /**
//  * @route   GET /api/v1/invoices/guest/:guestId
//  * @desc    Get all invoices for a specific guest
//  * @access  Private (manage_invoices, view_bookings)
//  */
// router.get(
//   '/guest/:guestId',
//   authorize('manage_invoices', 'view_bookings'),
//   [
//     param('guestId').isMongoId().withMessage('Invalid guest ID'),
//     handleValidationErrors
//   ],
//   getInvoicesByGuest
// );

// /**
//  * @route   GET /api/v1/invoices/booking/:bookingId
//  * @desc    Get invoice for a specific booking
//  * @access  Private (manage_invoices, view_bookings)
//  */
// router.get(
//   '/booking/:bookingId',
//   authorize('manage_invoices', 'view_bookings'),
//   [
//     param('bookingId').isMongoId().withMessage('Invalid booking ID'),
//     handleValidationErrors
//   ],
//   getInvoicesByBooking
// );

/**
 * @route   GET /api/v1/invoices/:id
 * @desc    Get single invoice by ID
 * @access  Private (manage_invoices, view_bookings)
 */
router.get(
  '/:id',
  authorize('manage_invoices', 'view_bookings'),
  ...mongoIdValidation,
  getInvoice
);

/**
 * @route   PUT /api/v1/invoices/:id
 * @desc    Update invoice
 * @access  Private (manage_invoices)
 */
router.put(
  '/:id',
  authorize('manage_invoices'),
  ...mongoIdValidation,
  ...updateInvoiceValidation,
  updateInvoice
);

/**
 * @route   DELETE /api/v1/invoices/:id
 * @desc    Delete invoice (only draft invoices)
 * @access  Private (manage_invoices, admin)
 */
router.delete(
  '/:id',
  authorize('manage_invoices'),
  ...mongoIdValidation,
  deleteInvoice
);

// ========== Invoice Operations Routes ==========
// TODO: Implement these functions in invoiceController.js

// /**
//  * @route   POST /api/v1/invoices/:id/duplicate
//  * @desc    Duplicate an existing invoice
//  * @access  Private (manage_invoices)
//  */
// router.post(
//   '/:id/duplicate',
//   authorize('manage_invoices'),
//   ...mongoIdValidation,
//   duplicateInvoice
// );

// /**
//  * @route   PUT /api/v1/invoices/:id/void
//  * @desc    Void an invoice (cannot be undone)
//  * @access  Private (manage_invoices, admin, manager)
//  */
// router.put(
//   '/:id/void',
//   authorize('manage_invoices'),
//   [
//     param('id').isMongoId().withMessage('Invalid invoice ID'),
//     body('reason')
//       .trim()
//       .notEmpty().withMessage('Void reason is required')
//       .isLength({ min: 10, max: 500 })
//       .withMessage('Void reason must be between 10 and 500 characters'),
//     handleValidationErrors
//   ],
//   voidInvoice
// );

// /**
//  * @route   PUT /api/v1/invoices/:id/mark-paid
//  * @desc    Mark invoice as fully paid
//  * @access  Private (manage_invoices)
//  */
// router.put(
//   '/:id/mark-paid',
//   authorize('manage_invoices'),
//   [
//     param('id').isMongoId().withMessage('Invalid invoice ID'),
//     body('paymentMethod')
//       .optional()
//       .isIn(['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet', 'corporate'])
//       .withMessage('Invalid payment method'),
//     body('paymentReference')
//       .optional()
//       .trim()
//       .isLength({ max: 100 }),
//     handleValidationErrors
//   ],
//   markAsPaid
// );

// ========== Payment Routes ==========
// TODO: Implement this function in invoiceController.js

// /**
//  * @route   POST /api/v1/invoices/:id/payments
//  * @desc    Add payment to invoice
//  * @access  Private (manage_invoices)
//  */
// router.post(
//   '/:id/payments',
//   authorize('manage_invoices'),
//   paymentValidation,
//   addPaymentToInvoice
// );

// ========== PDF & Email Routes ==========

/**
 * @route   GET /api/v1/invoices/:id/pdf
 * @desc    Generate and download invoice PDF
 * @access  Private (manage_invoices, view_bookings)
 */
router.get(
  '/:id/pdf',
  authorize('manage_invoices', 'view_bookings'),
  ...mongoIdValidation,
  generateInvoicePDF
);

// TODO: Implement this function in invoiceController.js
// /**
//  * @route   POST /api/v1/invoices/:id/send-email
//  * @desc    Send invoice via email
//  * @access  Private (manage_invoices)
//  */
// router.post(
//   '/:id/send-email',
//   authorize('manage_invoices'),
//   emailInvoiceValidation,
//   sendInvoiceEmail
// );

module.exports = router;
