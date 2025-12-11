/**
 * Invoice Controller
 * Handles invoice CRUD operations, payment processing, and PDF generation
 * @version 1.0.0
 */

const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const mongoose = require('mongoose');

/**
 * Generate unique invoice number
 * Format: INV-YYYYMMDD-XXXX
 * @returns {Promise<string>}
 */
const generateInvoiceNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get count of invoices created today
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await Invoice.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay }
  });
  
  const sequence = (count + 1).toString().padStart(4, '0');
  return `INV-${dateStr}-${sequence}`;
};

/**
 * @desc    Get all invoices with filters and pagination
 * @route   GET /api/v1/invoices
 * @access  Private
 */
const getInvoices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      startDate,
      endDate,
      guestId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = {};

    // Search by invoice number
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Guest filter
    if (guestId && mongoose.Types.ObjectId.isValid(guestId)) {
      query.guest = guestId;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const invoices = await Invoice.find(query)
      .populate('guest', 'name email phone')
      .populate('booking', 'bookingNumber checkInDate checkOutDate')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Invoice.countDocuments(query);

    // Calculate totals
    const totals = await Invoice.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          paidAmount: { $sum: '$paidAmount' },
          pendingAmount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } }
        }
      }
    ]);

    logger.info(`Fetched ${invoices.length} invoices`);

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + invoices.length < total
        },
        summary: totals[0] || {
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0
        }
      }
    });

  } catch (error) {
    logger.error('Get invoices error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single invoice by ID
 * @route   GET /api/v1/invoices/:id
 * @access  Private
 */
const getInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findById(req.params.id)
      .populate('guest', 'name email phone address')
      .populate('booking', 'bookingNumber checkInDate checkOutDate room')
      .populate('createdBy', 'name email')
      .populate({
        path: 'booking',
        populate: {
          path: 'room',
          select: 'number type rate'
        }
      })
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    logger.info(`Invoice fetched: ${req.params.id}`);

    res.json({
      success: true,
      data: { invoice }
    });

  } catch (error) {
    logger.error('Get invoice error:', {
      error: error.message,
      invoiceId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Create new invoice
 * @route   POST /api/v1/invoices
 * @access  Private
 */
const createInvoice = async (req, res) => {
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

  try {
    const { booking, guest, items, taxRate, discount, paidAmount } = req.body;

    // Validate booking exists
    if (booking) {
      const bookingExists = await Booking.findById(booking);
      if (!bookingExists) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
    }

    // Calculate amounts
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const discountAmount = discount ? (subtotal * discount / 100) : 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxRate ? (taxableAmount * taxRate / 100) : 0;
    const totalAmount = taxableAmount + taxAmount;

    // Validate paid amount
    const paid = paidAmount || 0;
    if (paid > totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot exceed total amount'
      });
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Determine status
    let status = 'pending';
    if (paid >= totalAmount) {
      status = 'paid';
    } else if (paid > 0) {
      status = 'partial';
    }

    const invoiceData = {
      invoiceNumber,
      booking,
      guest,
      items,
      subtotal,
      taxRate: taxRate || 0,
      taxAmount,
      discount: discount || 0,
      discountAmount,
      totalAmount,
      paidAmount: paid,
      status,
      createdBy: req.user.id
    };

    const invoice = await Invoice.create(invoiceData);

    // Populate the created invoice
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('guest', 'name email phone')
      .populate('booking', 'bookingNumber');

    // Update booking payment status if linked
    if (booking) {
      await Booking.findByIdAndUpdate(booking, {
        paidAmount: paid,
        paymentStatus: status
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('invoice_created', {
        invoice: populatedInvoice
      });
    }

    logger.info(`Invoice created: ${invoice._id} by user: ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { invoice: populatedInvoice }
    });

  } catch (error) {
    logger.error('Create invoice error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update invoice
 * @route   PUT /api/v1/invoices/:id
 * @access  Private
 */
const updateInvoice = async (req, res) => {
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

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const existingInvoice = await Invoice.findById(req.params.id);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Prevent updating paid invoices
    if (existingInvoice.status === 'paid' && req.body.items) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify items of a paid invoice'
      });
    }

    // Recalculate amounts if items changed
    if (req.body.items) {
      const subtotal = req.body.items.reduce((sum, item) => 
        sum + (item.quantity * item.rate), 0
      );
      const discountAmount = req.body.discount 
        ? (subtotal * req.body.discount / 100) 
        : 0;
      const taxableAmount = subtotal - discountAmount;
      const taxAmount = req.body.taxRate 
        ? (taxableAmount * req.body.taxRate / 100) 
        : 0;
      const totalAmount = taxableAmount + taxAmount;

      req.body.subtotal = subtotal;
      req.body.taxAmount = taxAmount;
      req.body.discountAmount = discountAmount;
      req.body.totalAmount = totalAmount;

      // Update status based on paid amount
      const paidAmount = req.body.paidAmount || existingInvoice.paidAmount;
      if (paidAmount >= totalAmount) {
        req.body.status = 'paid';
      } else if (paidAmount > 0) {
        req.body.status = 'partial';
      } else {
        req.body.status = 'pending';
      }
    }

    // Update status if paid amount changed
    if (req.body.paidAmount !== undefined) {
      const totalAmount = req.body.totalAmount || existingInvoice.totalAmount;
      if (req.body.paidAmount >= totalAmount) {
        req.body.status = 'paid';
        req.body.paidAt = new Date();
      } else if (req.body.paidAmount > 0) {
        req.body.status = 'partial';
      } else {
        req.body.status = 'pending';
      }
    }

    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('guest', 'name email phone')
      .populate('booking', 'bookingNumber');

    // Update booking payment if linked
    if (invoice.booking && req.body.paidAmount !== undefined) {
      await Booking.findByIdAndUpdate(invoice.booking._id, {
        paidAmount: req.body.paidAmount,
        paymentStatus: invoice.status
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('invoice_updated', {
        invoice
      });
    }

    logger.info(`Invoice updated: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: { invoice }
    });

  } catch (error) {
    logger.error('Update invoice error:', {
      error: error.message,
      stack: error.stack,
      invoiceId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete invoice
 * @route   DELETE /api/v1/invoices/:id
 * @access  Private (admin only)
 */
const deleteInvoice = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Prevent deleting paid invoices
    if (invoice.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a paid invoice. Please void it instead.'
      });
    }

    await Invoice.findByIdAndDelete(req.params.id);

    logger.info(`Invoice deleted: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    logger.error('Delete invoice error:', {
      error: error.message,
      stack: error.stack,
      invoiceId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete invoice',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Generate invoice PDF
 * @route   GET /api/v1/invoices/:id/pdf
 * @access  Private
 */
const generateInvoicePDF = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice ID'
      });
    }

    const invoice = await Invoice.findById(req.params.id)
      .populate('guest', 'name email phone address')
      .populate('booking', 'bookingNumber checkInDate checkOutDate')
      .populate('createdBy', 'name')
      .lean();

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // TODO: Implement PDF generation with puppeteer or pdfkit
    // For now, return invoice data
    logger.info(`Invoice PDF generated: ${req.params.id}`);

    res.json({
      success: true,
      message: 'PDF generation endpoint - to be implemented',
      data: { invoice }
    });

  } catch (error) {
    logger.error('Generate invoice PDF error:', {
      error: error.message,
      invoiceId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePDF
};
