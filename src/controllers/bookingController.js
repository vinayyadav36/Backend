/**
 * Booking Controller
 * Handles booking CRUD operations, availability checks, and bulk import
 * @version 1.0.0
 */

const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Guest = require('../models/Guest');
const { validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const logger = require('../config/logger');
const mongoose = require('mongoose');
// sanitize import removed (bookings uses fixed sort)

/**
 * @desc    Get all bookings with filters and pagination
 * @route   GET /api/v1/bookings
 * @access  Private
 */
const getBookings = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      startDate,
      endDate,
      roomId,
      guestId
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.checkInDate = {};
      if (startDate) query.checkInDate.$gte = new Date(startDate);
      if (endDate) query.checkInDate.$lte = new Date(endDate);
    }

    // Room filter
    if (roomId && mongoose.Types.ObjectId.isValid(roomId)) {
      query.room = roomId;
    }

    // Guest filter
    if (guestId && mongoose.Types.ObjectId.isValid(guestId)) {
      query.guest = guestId;
    }

    // Search by guest name, email, or booking number (done post-query for efficiency)
    const bookings = await Booking.find(query)
      .populate('guest', 'name email phone')
      .populate('room', 'number type images')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Booking.countDocuments(query);

    // Transform data for frontend
    let transformedBookings = bookings.map(booking => ({
      id: booking._id,
      bookingNumber: `BK${booking._id.toString().slice(-6).toUpperCase()}`,
      guestName: booking.guest?.name || 'Unknown Guest',
      guestEmail: booking.guest?.email || '',
      guestPhone: booking.guest?.phone || '',
      roomNumber: booking.room?.number || 'N/A',
      roomType: booking.room?.type || 'N/A',
      roomImage: booking.room?.images?.[0] || null,
      checkIn: booking.checkInDate,
      checkOut: booking.checkOutDate,
      status: booking.status,
      totalAmount: booking.totalAmount,
      paidAmount: booking.paidAmount || 0,
      pendingAmount: booking.totalAmount - (booking.paidAmount || 0),
      adults: booking.adults,
      children: booking.children,
      source: booking.source || 'direct',
      specialRequests: booking.specialRequests,
      createdBy: booking.createdBy?.name || 'System',
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    }));

    // Apply search filter after transformation (for guest name/email search)
    if (search) {
      const searchLower = search.toLowerCase();
      transformedBookings = transformedBookings.filter(booking =>
        booking.guestName.toLowerCase().includes(searchLower) ||
        booking.guestEmail.toLowerCase().includes(searchLower) ||
        booking.bookingNumber.toLowerCase().includes(searchLower) ||
        booking.roomNumber.toLowerCase().includes(searchLower)
      );
    }

    logger.info(`Fetched ${transformedBookings.length} bookings`);

    res.json({
      success: true,
      data: {
        bookings: transformedBookings,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + transformedBookings.length < total
        }
      }
    });

  } catch (error) {
    logger.error('Get bookings error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single booking by ID
 * @route   GET /api/v1/bookings/:id
 * @access  Private
 */
const getBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('guest')
      .populate('room')
      .populate('createdBy', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    logger.info(`Booking fetched: ${req.params.id}`);

    res.json({
      success: true,
      data: { booking }
    });

  } catch (error) {
    logger.error('Get booking error:', {
      error: error.message,
      bookingId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Check room availability for given dates
 * @param {string} roomId - Room ID
 * @param {Date} checkIn - Check-in date
 * @param {Date} checkOut - Check-out date
 * @param {string} excludeBookingId - Booking ID to exclude (for updates)
 * @returns {Promise<boolean>}
 */
const checkRoomAvailability = async (roomId, checkIn, checkOut, excludeBookingId = null) => {
  const query = {
    room: roomId,
    status: { $in: ['confirmed', 'checked-in'] },
    $or: [
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn }
      }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflictingBookings = await Booking.countDocuments(query);
  return conflictingBookings === 0;
};

/**
 * @desc    Create new booking
 * @route   POST /api/v1/bookings
 * @access  Private
 */
const createBooking = async (req, res) => {
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
    const { 
      guest, 
      room, 
      checkInDate, 
      checkOutDate, 
      adults, 
      children,
      specialRequests,
      source,
      paidAmount
    } = req.body;

    // Validate dates
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    // Validate guest and room are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(room)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(guest)) {
      return res.status(400).json({ success: false, message: 'Invalid guest ID' });
    }

    // Check room availability
    const isAvailable = await checkRoomAvailability(room, checkIn, checkOut);
    if (!isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Room is not available for the selected dates'
      });
    }

    // Get room details for pricing and capacity validation
    const roomDetails = await Room.findById(room);
    if (!roomDetails) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!roomDetails.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Room is not available for booking'
      });
    }

    // Check room capacity
    const totalGuests = adults + (children || 0);
    const roomCapacity = (roomDetails.capacity?.adults || 2) + (roomDetails.capacity?.children || 0);
    
    if (totalGuests > roomCapacity) {
      return res.status(400).json({
        success: false,
        message: `Guest count (${totalGuests}) exceeds room capacity (${roomCapacity})`
      });
    }

    // Calculate total amount
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    const baseRate = roomDetails.rate?.baseRate || 0;
    const totalAmount = nights * baseRate;

    // Validate paid amount
    const paid = paidAmount || 0;
    if (paid > totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount cannot exceed total amount'
      });
    }

    const bookingData = {
      guest,
      room,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults,
      children: children || 0,
      totalAmount,
      paidAmount: paid,
      status: 'confirmed',
      source: source || 'direct',
      specialRequests,
      createdBy: req.user.id
    };

    const booking = await Booking.create(bookingData);

    // Populate the created booking
    const populatedBooking = await Booking.findById(booking._id)
      .populate('guest', 'name email phone')
      .populate('room', 'number type images');

    // Update room status to reserved
    await Room.findByIdAndUpdate(room, { status: 'reserved' });

    // Emit real-time update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('booking_created', {
        booking: populatedBooking,
        guestName: populatedBooking.guest?.name,
        roomNumber: populatedBooking.room?.number
      });
    }

    logger.info(`Booking created: ${booking._id} by user: ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking: populatedBooking }
    });

  } catch (error) {
    logger.error('Create booking error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update booking
 * @route   PUT /api/v1/bookings/:id
 * @access  Private
 */
const updateBooking = async (req, res) => {
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
        message: 'Invalid booking ID'
      });
    }

    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // If dates or room are being changed, check availability
    if (req.body.checkInDate || req.body.checkOutDate || req.body.room) {
      const checkIn = req.body.checkInDate ? new Date(req.body.checkInDate) : existingBooking.checkInDate;
      const checkOut = req.body.checkOutDate ? new Date(req.body.checkOutDate) : existingBooking.checkOutDate;
      const roomId = req.body.room || existingBooking.room;

      if (checkOut <= checkIn) {
        return res.status(400).json({
          success: false,
          message: 'Check-out date must be after check-in date'
        });
      }

      const isAvailable = await checkRoomAvailability(roomId, checkIn, checkOut, req.params.id);
      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Room is not available for the selected dates'
        });
      }

      // Recalculate total amount if dates changed
      if (req.body.checkInDate || req.body.checkOutDate) {
        const roomDetails = await Room.findById(roomId);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
        req.body.totalAmount = nights * (roomDetails.rate?.baseRate || 0);
      }
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )
      .populate('guest', 'name email phone')
      .populate('room', 'number type images');

    // Update room status based on booking status
    if (req.body.status) {
      let roomStatus = 'available';
      switch (req.body.status) {
        case 'confirmed':
          roomStatus = 'reserved';
          break;
        case 'checked-in':
          roomStatus = 'occupied';
          break;
        case 'checked-out':
        case 'cancelled':
          roomStatus = 'available';
          break;
      }
      await Room.findByIdAndUpdate(booking.room._id, { status: roomStatus });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('booking_updated', {
        booking,
        guestName: booking.guest?.name,
        roomNumber: booking.room?.number,
        statusChange: req.body.status
      });
    }

    logger.info(`Booking updated: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Booking updated successfully',
      data: { booking }
    });

  } catch (error) {
    logger.error('Update booking error:', {
      error: error.message,
      stack: error.stack,
      bookingId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete/Cancel booking
 * @route   DELETE /api/v1/bookings/:id
 * @access  Private
 */
const deleteBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Only allow deletion of pending or cancelled bookings
    if (!['pending', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete confirmed or active bookings. Please cancel the booking first.'
      });
    }

    await Booking.findByIdAndDelete(req.params.id);

    // Update room status to available
    await Room.findByIdAndUpdate(booking.room, { status: 'available' });

    logger.info(`Booking deleted: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });

  } catch (error) {
    logger.error('Delete booking error:', {
      error: error.message,
      stack: error.stack,
      bookingId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Bulk import bookings from Excel/CSV
 * @route   POST /api/v1/bookings/import
 * @access  Private (admin/manager)
 */
const importBookings = async (req, res) => {
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

    const requiredHeaders = ['guestemail', 'roomnumber', 'checkindate', 'checkoutdate', 'adults'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid template. Missing columns: ${missingHeaders.join(', ')}`,
        requiredHeaders: ['guestEmail', 'roomNumber', 'checkInDate', 'checkOutDate', 'adults', 'children (optional)']
      });
    }

    const guestEmailIndex = headers.indexOf('guestemail') + 1;
    const roomNumberIndex = headers.indexOf('roomnumber') + 1;
    const checkInIndex = headers.indexOf('checkindate') + 1;
    const checkOutIndex = headers.indexOf('checkoutdate') + 1;
    const adultsIndex = headers.indexOf('adults') + 1;
    const childrenIndex = headers.indexOf('children') + 1 || null;

    const toCreate = [];
    const skipped = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const guestEmail = row.getCell(guestEmailIndex).value?.toString().trim();
      const roomNumber = row.getCell(roomNumberIndex).value?.toString().trim();
      const checkInRaw = row.getCell(checkInIndex).value;
      const checkOutRaw = row.getCell(checkOutIndex).value;
      const adultsRaw = row.getCell(adultsIndex).value;
      const childrenRaw = childrenIndex ? row.getCell(childrenIndex).value : 0;

      // Validate required fields
      if (!guestEmail || !roomNumber || !checkInRaw || !checkOutRaw || !adultsRaw) {
        skipped.push({ row: rowNumber, reason: 'Missing required fields' });
        return;
      }

      // Parse dates
      const checkInDate = new Date(checkInRaw);
      const checkOutDate = new Date(checkOutRaw);
      const adults = Number(adultsRaw);
      const children = Number(childrenRaw) || 0;

      // Validate dates
      if (isNaN(checkInDate.getTime())) {
        skipped.push({ row: rowNumber, reason: 'Invalid check-in date' });
        return;
      }
      if (isNaN(checkOutDate.getTime())) {
        skipped.push({ row: rowNumber, reason: 'Invalid check-out date' });
        return;
      }
      if (checkOutDate <= checkInDate) {
        skipped.push({ row: rowNumber, reason: 'Check-out must be after check-in' });
        return;
      }

      toCreate.push({
        guestEmail,
        roomNumber,
        checkInDate,
        checkOutDate,
        adults,
        children
      });
    });

    if (toCreate.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid booking records found in the file',
        data: { imported: 0, skipped }
      });
    }

    let createdCount = 0;
    const createdBookings = [];

    // Process each booking
    for (const item of toCreate) {
      try {
        // Find guest by email
        const guest = await Guest.findOne({ email: item.guestEmail });
        if (!guest) {
          skipped.push({
            email: item.guestEmail,
            reason: `Guest not found for email: ${item.guestEmail}`
          });
          continue;
        }

        // Find room by number
        const room = await Room.findOne({ number: item.roomNumber, isActive: true });
        if (!room) {
          skipped.push({
            email: item.guestEmail,
            reason: `Room not found or inactive: ${item.roomNumber}`
          });
          continue;
        }

        // Check availability
        const isAvailable = await checkRoomAvailability(
          room._id,
          item.checkInDate,
          item.checkOutDate
        );

        if (!isAvailable) {
          skipped.push({
            email: item.guestEmail,
            reason: `Room ${item.roomNumber} not available for selected dates`
          });
          continue;
        }

        // Calculate total amount
        const nights = Math.ceil((item.checkOutDate - item.checkInDate) / (1000 * 60 * 60 * 24));
        const totalAmount = nights * (room.rate?.baseRate || 0);

        // Create booking
        const booking = await Booking.create({
          guest: guest._id,
          room: room._id,
          checkInDate: item.checkInDate,
          checkOutDate: item.checkOutDate,
          adults: item.adults,
          children: item.children,
          status: 'confirmed',
          source: 'import',
          totalAmount,
          paidAmount: 0,
          createdBy: req.user?.id
        });

        createdBookings.push(booking);
        createdCount++;

      } catch (err) {
        logger.error('Import booking item error:', err);
        skipped.push({
          email: item.guestEmail,
          reason: `Error creating booking: ${err.message}`
        });
      }
    }

    logger.info(`Bulk import completed: ${createdCount} bookings created, ${skipped.length} skipped`);

    res.status(201).json({
      success: true,
      message: `Import completed. ${createdCount} bookings created.`,
      data: {
        imported: createdCount,
        skipped: skipped.length,
        skippedDetails: skipped,
        totalProcessed: toCreate.length
      }
    });

  } catch (error) {
    logger.error('Import bookings error:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to import bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Check-in a guest
 * @route   PUT /api/v1/bookings/:id/check-in
 * @access  Private
 */
const checkInBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('room', 'number status')
      .populate('guest', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'checked-in') {
      return res.status(400).json({
        success: false,
        message: 'Guest is already checked in'
      });
    }

    if (booking.status === 'checked-out' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in a ${booking.status} booking`
      });
    }

    // Update booking status
    booking.status = 'checked-in';
    booking.actualCheckInDate = req.body.actualCheckInDate || new Date();
    if (req.body.identityVerified !== undefined) {
      booking.identityVerified = req.body.identityVerified;
    }
    if (req.body.notes) {
      booking.notes = (booking.notes || '') + '\n' + req.body.notes;
    }
    await booking.save();

    // Update room status
    await Room.findByIdAndUpdate(booking.room._id, { status: 'occupied' });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('booking_update', {
        bookingId: booking._id,
        status: 'checked-in',
        updatedBy: req.user.id
      });
    }

    logger.info(`Booking checked in: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Guest checked in successfully',
      data: { booking }
    });

  } catch (error) {
    logger.error('Check-in booking error:', {
      error: error.message,
      bookingId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to check in guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Check-out a guest
 * @route   PUT /api/v1/bookings/:id/check-out
 * @access  Private
 */
const checkOutBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID'
      });
    }

    const booking = await Booking.findById(req.params.id)
      .populate('room', 'number status')
      .populate('guest', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'checked-in') {
      return res.status(400).json({
        success: false,
        message: 'Guest must be checked in before checking out'
      });
    }

    // Calculate final amount if provided
    let finalAmount = booking.totalAmount;
    if (req.body.finalAmount) {
      finalAmount = req.body.finalAmount;
    }
    if (req.body.damageCharges) {
      finalAmount += req.body.damageCharges;
    }

    // Update booking status
    booking.status = 'checked-out';
    booking.actualCheckOutDate = req.body.actualCheckOutDate || new Date();
    booking.totalAmount = finalAmount;
    if (req.body.notes) {
      booking.notes = (booking.notes || '') + '\n' + req.body.notes;
    }
    await booking.save();

    // Update room status to dirty (needs cleaning)
    await Room.findByIdAndUpdate(booking.room._id, { status: 'dirty' });

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('booking_update', {
        bookingId: booking._id,
        status: 'checked-out',
        updatedBy: req.user.id
      });
    }

    logger.info(`Booking checked out: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Guest checked out successfully',
      data: { booking }
    });

  } catch (error) {
    logger.error('Check-out booking error:', {
      error: error.message,
      bookingId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to check out guest',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get today's arrivals
 * @route   GET /api/v1/bookings/today/arrivals
 * @access  Private
 */
const getTodayArrivals = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const arrivals = await Booking.find({
      checkInDate: { $gte: today, $lt: tomorrow },
      status: { $in: ['pending', 'confirmed'] }
    })
      .populate('guest', 'name email phone')
      .populate('room', 'number type')
      .sort({ checkInDate: 1 })
      .lean();

    res.json({
      success: true,
      data: { arrivals, count: arrivals.length }
    });

  } catch (error) {
    logger.error('Get today arrivals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today arrivals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get today's departures
 * @route   GET /api/v1/bookings/today/departures
 * @access  Private
 */
const getTodayDepartures = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const departures = await Booking.find({
      checkOutDate: { $gte: today, $lt: tomorrow },
      status: { $in: ['checked-in', 'confirmed'] }
    })
      .populate('guest', 'name email phone')
      .populate('room', 'number type')
      .sort({ checkOutDate: 1 })
      .lean();

    res.json({
      success: true,
      data: { departures, count: departures.length }
    });

  } catch (error) {
    logger.error('Get today departures error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today departures',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get booking statistics
 * @route   GET /api/v1/bookings/statistics
 * @access  Private
 */
const getBookingStatistics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [
      total,
      pending,
      confirmed,
      checkedIn,
      checkedOut,
      cancelled,
      revenue
    ] = await Promise.all([
      Booking.countDocuments(query),
      Booking.countDocuments({ ...query, status: 'pending' }),
      Booking.countDocuments({ ...query, status: 'confirmed' }),
      Booking.countDocuments({ ...query, status: 'checked-in' }),
      Booking.countDocuments({ ...query, status: 'checked-out' }),
      Booking.countDocuments({ ...query, status: 'cancelled' }),
      Booking.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$totalAmount' }, paid: { $sum: '$paidAmount' } } }
      ])
    ]);

    const revenueData = revenue[0] || { total: 0, paid: 0 };

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          pending,
          confirmed,
          checkedIn,
          checkedOut,
          cancelled
        },
        revenue: {
          total: revenueData.total,
          paid: revenueData.paid,
          pending: revenueData.total - revenueData.paid
        }
      }
    });

  } catch (error) {
    logger.error('Get booking statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
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
};
