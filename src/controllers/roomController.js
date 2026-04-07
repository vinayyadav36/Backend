/**
 * Room Controller
 * Handles room CRUD operations, availability checks, and status management
 * @version 1.0.0
 */

const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const { escapeRegex, sanitizeSortField, toSafeString } = require('../utils/sanitize');

/**
 * @desc    Get all rooms with filters and pagination
 * @route   GET /api/v1/rooms
 * @access  Private
 */
const getRooms = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status,
      type,
      floor,
      available,
      sortBy = 'number',
      sortOrder = 'asc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = { isActive: true };

    // Search by room number
    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { number: { $regex: safeSearch, $options: 'i' } },
        { type: { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // Status filter
    if (status && status !== 'all') {
      query.status = status;
    }

    // Type filter
    if (type && type !== 'all') {
      query.type = type;
    }

    // Floor filter
    if (floor) {
      query.floor = parseInt(floor);
    }

    // Available filter
    if (available === 'true') {
      query.status = 'available';
    }

    // Build sort object
    const sort = {};
    const safeSortBy = sanitizeSortField(sortBy, 'rooms', 'number');
    sort[safeSortBy] = sortOrder === 'asc' ? 1 : -1;

    const rooms = await Room.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Room.countDocuments(query);

    // Get status counts
    const statusCounts = await Room.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      total,
      available: statusCounts.find(s => s._id === 'available')?.count || 0,
      occupied: statusCounts.find(s => s._id === 'occupied')?.count || 0,
      reserved: statusCounts.find(s => s._id === 'reserved')?.count || 0,
      maintenance: statusCounts.find(s => s._id === 'maintenance')?.count || 0,
      dirty: statusCounts.find(s => s._id === 'dirty')?.count || 0
    };

    logger.info(`Fetched ${rooms.length} rooms`);

    res.json({
      success: true,
      data: {
        rooms,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
          hasMore: skip + rooms.length < total
        },
        summary
      }
    });

  } catch (error) {
    logger.error('Get rooms error:', {
      error: error.message,
      stack: error.stack,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch rooms',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get single room by ID
 * @route   GET /api/v1/rooms/:id
 * @access  Private
 */
const getRoom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID'
      });
    }

    const room = await Room.findById(req.params.id).lean();

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Get current booking if occupied
    let currentBooking = null;
    if (room.status === 'occupied' || room.status === 'reserved') {
      currentBooking = await Booking.findOne({
        room: req.params.id,
        status: { $in: ['confirmed', 'checked-in'] }
      })
        .populate('guest', 'name email phone')
        .lean();
    }

    logger.info(`Room fetched: ${req.params.id}`);

    res.json({
      success: true,
      data: {
        room: {
          ...room,
          currentBooking
        }
      }
    });

  } catch (error) {
    logger.error('Get room error:', {
      error: error.message,
      roomId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Create new room
 * @route   POST /api/v1/rooms
 * @access  Private (admin/manager)
 */
const createRoom = async (req, res) => {
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
    const { number } = req.body;
    const safeNumber = toSafeString(number);

    // Check for duplicate room number
    const existingRoom = await Room.findOne({ number: safeNumber });
    if (existingRoom) {
      return res.status(400).json({
        success: false,
        message: 'Room with this number already exists'
      });
    }

    const room = await Room.create(req.body);

    logger.info(`Room created: ${room._id} by user: ${req.user?.id}`);

    res.status(201).json({
      success: true,
      message: 'Room created successfully',
      data: { room }
    });

  } catch (error) {
    logger.error('Create room error:', {
      error: error.message,
      stack: error.stack
    });

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Room with this number already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update room
 * @route   PUT /api/v1/rooms/:id
 * @access  Private (admin/manager)
 */
const updateRoom = async (req, res) => {
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
        message: 'Invalid room ID'
      });
    }

    // Check for duplicate room number
    if (req.body.number) {
      const existingRoom = await Room.findOne({
        number: req.body.number,
        _id: { $ne: req.params.id }
      });
      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: 'Another room with this number already exists'
        });
      }
    }

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('room_status_change', {
        roomId: room._id,
        roomNumber: room.number,
        status: room.status
      });
    }

    logger.info(`Room updated: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Room updated successfully',
      data: { room }
    });

  } catch (error) {
    logger.error('Update room error:', {
      error: error.message,
      roomId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Delete room (soft delete)
 * @route   DELETE /api/v1/rooms/:id
 * @access  Private (admin only)
 */
const deleteRoom = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID'
      });
    }

    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      room: req.params.id,
      status: { $in: ['confirmed', 'checked-in'] }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete room with active bookings'
      });
    }

    // Soft delete
    room.isActive = false;
    room.status = 'maintenance';
    await room.save();

    logger.info(`Room soft deleted: ${req.params.id} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Room deactivated successfully'
    });

  } catch (error) {
    logger.error('Delete room error:', {
      error: error.message,
      roomId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Check room availability for date range
 * @route   POST /api/v1/rooms/check-availability
 * @access  Public
 */
const checkAvailability = async (req, res) => {
  try {
    const { checkInDate, checkOutDate, roomType, guests } = req.body;

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: 'Check-in and check-out dates are required'
      });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // Build room query
    const roomQuery = { isActive: true, status: { $in: ['available', 'dirty'] } };
    if (roomType && roomType !== 'all') {
      roomQuery.type = toSafeString(roomType);
    }

    // Get all potentially available rooms
    const allRooms = await Room.find(roomQuery).lean();

    // Check which rooms have conflicting bookings
    const bookedRooms = await Booking.find({
      status: { $in: ['confirmed', 'checked-in'] },
      $or: [
        {
          checkInDate: { $lt: checkOut },
          checkOutDate: { $gt: checkIn }
        }
      ]
    }).distinct('room');

    // Filter out booked rooms
    const availableRooms = allRooms.filter(room => 
      !bookedRooms.some(bookedId => bookedId.toString() === room._id.toString())
    );

    // Filter by guest capacity if provided
    let filteredRooms = availableRooms;
    if (guests) {
      filteredRooms = availableRooms.filter(room => {
        const capacity = (room.capacity?.adults || 2) + (room.capacity?.children || 0);
        return capacity >= guests;
      });
    }

    logger.info(`Availability check: ${filteredRooms.length} rooms available`);

    res.json({
      success: true,
      data: {
        availableRooms: filteredRooms,
        total: filteredRooms.length,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
      }
    });

  } catch (error) {
    logger.error('Check availability error:', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: 'Failed to check availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update room status
 * @route   PUT /api/v1/rooms/:id/status
 * @access  Private
 */
const updateRoomStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID'
      });
    }

    const { status, notes: _notes } = req.body;

    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`hotel_${req.user.hotelId || 'hotel_001'}`).emit('room_status_change', {
        roomId: room._id,
        roomNumber: room.number,
        status: room.status,
        updatedBy: req.user.id
      });
    }

    logger.info(`Room status updated: ${req.params.id} to ${status} by user: ${req.user.id}`);

    res.json({
      success: true,
      message: 'Room status updated successfully',
      data: { room }
    });

  } catch (error) {
    logger.error('Update room status error:', {
      error: error.message,
      roomId: req.params.id
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update room status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get room statistics
 * @route   GET /api/v1/rooms/statistics
 * @access  Private
 */
const getRoomStatistics = async (req, res) => {
  try {
    const [total, available, occupied, maintenance, reserved] = await Promise.all([
      Room.countDocuments({ isActive: true }),
      Room.countDocuments({ isActive: true, status: 'available' }),
      Room.countDocuments({ isActive: true, status: 'occupied' }),
      Room.countDocuments({ isActive: true, status: 'maintenance' }),
      Room.countDocuments({ isActive: true, status: 'reserved' })
    ]);

    const byType = await Room.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total,
        byStatus: {
          available,
          occupied,
          maintenance,
          reserved,
          other: total - available - occupied - maintenance - reserved
        },
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    logger.error('Get room statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get room statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
  checkAvailability,
  updateRoomStatus,
  getRoomStatistics
};
