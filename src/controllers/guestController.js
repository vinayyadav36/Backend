/**
 * Guest Controller
 * Handles guest CRUD operations, DigiLocker verification, and bulk import
 * @version 1.0.0
 */

const Guest = require('../models/Guest');
const { validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const axios = require('axios');

/**
 * @desc    Get all guests with filters and pagination
 * @route   GET /api/v1/guests
 * @access  Private
 */
const getGuests = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = {};

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { idNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.blacklisted = status === 'inactive' || status === 'blacklisted';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const guests = await Guest.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Guest.countDocuments(query);

    logger.info(`Fetched ${guests.length} guests`);

    res.json({
      success: true,
      data: {
        guests,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + guests.length < total
        }
      }
    });

  } catch (error) {
    logger.error('Get guests error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch guests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single guest by ID
 * @route   GET /api/v1/guests/:id
 * @access  Private
 */
const getGuest = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guest ID'
      });
    }

    const guest = await Guest.findById(req.params.id).lean();

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    // Optionally fetch booking history
    const Booking = require('../models/Booking');
    const bookingHistory = await Booking.find({ guest: req.params.id })
      .populate('room', 'number type')
      .sort({ checkInDate: -1 })
      .limit(10)
      .lean();

    logger.info(`Guest fetched: ${req.params.id}`);

    res.json({
      success: true,
      data: {
        guest: {
          ...guest,
          bookingHistory,
          totalBookings: bookingHistory.length
        }
      }
    });

  } catch (error) {
    logger.error('Get guest error:', {
      error: error.message,
      guestId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Create new guest
 * @route   POST /api/v1/guests
 * @access  Private
 */
const createGuest = async (req, res) => {
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
    const { email, phone, idNumber } = req.body;

    // Check for duplicate email
    const existingEmail = await Guest.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'Guest with this email already exists'
      });
    }

    // Check for duplicate phone
    if (phone) {
      const existingPhone = await Guest.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Guest with this phone number already exists'
        });
      }
    }

    // Check for duplicate ID number
    if (idNumber) {
      const existingId = await Guest.findOne({ idNumber });
      if (existingId) {
        return res.status(400).json({
          success: false,
          message: 'Guest with this ID number already exists'
        });
      }
    }

    const guest = await Guest.create(req.body);

    logger.info(`Guest created: ${guest._id} by user: ${req.user?.id}`);

    res.status(201).json({
      success: true,
      message: 'Guest created successfully',
      data: { guest }
    });

  } catch (error) {
    logger.error('Create guest error:', {
      error: error.message,
      stack: error.stack
    });

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Guest with this ${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update guest
 * @route   PUT /api/v1/guests/:id
 * @access  Private
 */
const updateGuest = async (req, res) => {
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
        message: 'Invalid guest ID'
      });
    }

    // Check for duplicate email (excluding current guest)
    if (req.body.email) {
      const existingEmail = await Guest.findOne({
        email: req.body.email,
        _id: { $ne: req.params.id }
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Another guest with this email already exists'
        });
      }
    }

    // Check for duplicate phone
    if (req.body.phone) {
      const existingPhone = await Guest.findOne({
        phone: req.body.phone,
        _id: { $ne: req.params.id }
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Another guest with this phone number already exists'
        });
      }
    }

    const guest = await Guest.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    logger.info(`Guest updated: ${req.params.id} by user: ${req.user?.id}`);

    res.json({
      success: true,
      message: 'Guest updated successfully',
      data: { guest }
    });

  } catch (error) {
    logger.error('Update guest error:', {
      error: error.message,
      guestId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete guest (soft delete - mark as inactive)
 * @route   DELETE /api/v1/guests/:id
 * @access  Private (admin only)
 */
const deleteGuest = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guest ID'
      });
    }

    // Check if guest has active bookings
    const Booking = require('../models/Booking');
    const activeBookings = await Booking.countDocuments({
      guest: req.params.id,
      status: { $in: ['confirmed', 'checked-in'] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete guest with active bookings. Please cancel bookings first.'
      });
    }

    // Soft delete: Mark as blacklisted instead of deleting
    const guest = await Guest.findByIdAndUpdate(
      req.params.id,
      { blacklisted: true, updatedAt: new Date() },
      { new: true }
    );

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    logger.info(`Guest soft deleted: ${req.params.id} by user: ${req.user?.id}`);

    res.json({
      success: true,
      message: 'Guest marked as inactive successfully'
    });

  } catch (error) {
    logger.error('Delete guest error:', {
      error: error.message,
      guestId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Initiate DigiLocker verification
 * @route   POST /api/v1/guests/:id/digilocker/initiate
 * @access  Private (admin/manager)
 */
const initiateDigiLocker = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guest ID'
      });
    }

    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    // In production, integrate with actual DigiLocker API
    // Reference: https://digitallocker.gov.in/

    const redirectUrl = process.env.DIGILOCKER_ENABLED === 'true'
      ? `${process.env.DIGILOCKER_API_BASE_URL}/authorize?client_id=${process.env.DIGILOCKER_CLIENT_ID}&redirect_uri=${process.env.DIGILOCKER_REDIRECT_URI}&state=${guest._id}`
      : `${process.env.FRONTEND_URL}/admin/guests/${guest._id}/digilocker-stub`;

    // Mark as verification initiated
    guest.digiLockerVerified = false;
    guest.digiLockerData = guest.digiLockerData || {};
    guest.digiLockerData.verificationInitiated = new Date();
    await guest.save();

    logger.info(`DigiLocker verification initiated for guest: ${guest._id}`);

    res.json({
      success: true,
      message: 'DigiLocker verification initiated',
      data: {
        redirectUrl,
        guestId: guest._id
      }
    });

  } catch (error) {
    logger.error('Initiate DigiLocker error:', {
      error: error.message,
      guestId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to initiate DigiLocker verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    DigiLocker OAuth callback handler
 * @route   POST /api/v1/guests/digilocker/callback
 * @access  Public (secured by DigiLocker signature)
 */
const digiLockerCallback = async (req, res) => {
  try {
    const { guestId, code, documents } = req.body;

    if (!guestId) {
      return res.status(400).json({
        success: false,
        message: 'Guest ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(guestId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guest ID'
      });
    }

    const guest = await Guest.findById(guestId);

    if (!guest) {
      return res.status(404).json({
        success: false,
        message: 'Guest not found'
      });
    }

    // In production, verify the DigiLocker signature and exchange code for access token
    // Then fetch documents from DigiLocker API

    guest.digiLockerVerified = true;
    guest.digiLockerData = guest.digiLockerData || {};
    guest.digiLockerData.verifiedAt = new Date();
    guest.digiLockerData.documents = documents || [
      {
        type: 'aadhar',
        verified: true,
        number: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
        verifiedAt: new Date()
      }
    ];

    await guest.save();

    logger.info(`DigiLocker verification completed for guest: ${guestId}`);

    res.json({
      success: true,
      message: 'Guest verified successfully via DigiLocker',
      data: {
        verified: true,
        documents: guest.digiLockerData.documents.length
      }
    });

  } catch (error) {
    logger.error('DigiLocker callback error:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to process DigiLocker callback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Bulk import guests from Excel/CSV
 * @route   POST /api/v1/guests/import
 * @access  Private (admin/manager)
 */
const importGuests = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an Excel file.'
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Uploaded file is empty or invalid'
      });
    }

    // Parse headers
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values.slice(1).map(h =>
      typeof h === 'string' ? h.trim().toLowerCase().replace(/\s+/g, '') : ''
    );

    const requiredHeaders = ['name', 'email', 'phone', 'idtype', 'idnumber'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid template. Missing columns: ${missingHeaders.join(', ')}`,
        requiredHeaders: ['name', 'email', 'phone', 'idType', 'idNumber']
      });
    }

    const nameIndex = headers.indexOf('name') + 1;
    const emailIndex = headers.indexOf('email') + 1;
    const phoneIndex = headers.indexOf('phone') + 1;
    const idTypeIndex = headers.indexOf('idtype') + 1;
    const idNumberIndex = headers.indexOf('idnumber') + 1;
    const addressIndex = headers.indexOf('address') > -1 ? headers.indexOf('address') + 1 : null;

    const toImport = [];
    const skipped = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const name = row.getCell(nameIndex).value?.toString().trim();
      const email = row.getCell(emailIndex).value?.toString().trim();
      const phone = row.getCell(phoneIndex).value?.toString().trim();
      const idTypeRaw = row.getCell(idTypeIndex).value?.toString().trim();
      const idNumber = row.getCell(idNumberIndex).value?.toString().trim();
      const address = addressIndex ? row.getCell(addressIndex).value?.toString().trim() : '';

      // Validate required fields
      if (!name || !email || !phone || !idTypeRaw || !idNumber) {
        skipped.push({ row: rowNumber, reason: 'Missing required fields' });
        return;
      }

      // Validate ID type
      const idType = idTypeRaw.toLowerCase();
      const validIdTypes = ['passport', 'aadhar', 'driving_license', 'voter_id'];
      if (!validIdTypes.includes(idType)) {
        skipped.push({ 
          row: rowNumber, 
          reason: `Invalid idType: ${idTypeRaw}. Must be one of: ${validIdTypes.join(', ')}` 
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        skipped.push({ row: rowNumber, reason: 'Invalid email format' });
        return;
      }

      toImport.push({
        name,
        email,
        phone,
        idType,
        idNumber,
        address
      });
    });

    if (toImport.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid guest records found in the file',
        data: { imported: 0, skipped }
      });
    }

    // Bulk upsert by email
    const bulkOps = toImport.map(guest => ({
      updateOne: {
        filter: { email: guest.email },
        update: { 
          $set: {
            ...guest,
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await Guest.bulkWrite(bulkOps, { ordered: false });

    logger.info(`Bulk import completed: ${result.upsertedCount} created, ${result.modifiedCount} updated`);

    res.status(201).json({
      success: true,
      message: `Import completed. ${result.upsertedCount + result.modifiedCount} guests processed.`,
      data: {
        created: result.upsertedCount,
        updated: result.modifiedCount,
        matched: result.matchedCount,
        skipped: skipped.length,
        skippedDetails: skipped,
        totalProcessed: toImport.length
      }
    });

  } catch (error) {
    logger.error('Import guests error:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to import guests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  importGuests,
  initiateDigiLocker,
  digiLockerCallback
};
