/**
 * Room Model
 * Handles room inventory, rates, maintenance, and IoT device integration
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  number: {
    type: String,
    required: [true, 'Room number is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  type: {
    type: String,
    required: [true, 'Room type is required'],
    enum: {
      values: ['single', 'double', 'twin', 'suite', 'deluxe', 'presidential', 'family', 'studio'],
      message: '{VALUE} is not a valid room type'
    },
    index: true
  },
  status: {
    type: String,
    enum: {
      values: ['available', 'occupied', 'maintenance', 'reserved', 'dirty', 'cleaning', 'out-of-order'],
      message: '{VALUE} is not a valid status'
    },
    default: 'available',
    index: true
  },
  floor: {
    type: Number,
    required: [true, 'Floor number is required'],
    min: [0, 'Floor cannot be negative'],
    max: [100, 'Floor cannot exceed 100'],
    index: true
  },
  capacity: {
    adults: {
      type: Number,
      required: [true, 'Adult capacity is required'],
      min: [1, 'Room must accommodate at least 1 adult'],
      max: [10, 'Maximum 10 adults allowed']
    },
    children: {
      type: Number,
      default: 0,
      min: [0, 'Children capacity cannot be negative'],
      max: [5, 'Maximum 5 children allowed']
    },
    maxOccupancy: {
      type: Number,
      required: true
    }
  },
  rate: {
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: [0, 'Rate cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR', 'GBP']
    },
    seasonalRates: [{
      season: {
        type: String,
        required: true,
        enum: ['winter', 'summer', 'monsoon', 'festive', 'peak', 'off-peak']
      },
      rate: {
        type: Number,
        required: true,
        min: 0
      },
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      description: String
    }],
    weekendRate: {
      type: Number,
      min: 0
    },
    holidayRate: {
      type: Number,
      min: 0
    },
    extraPersonRate: {
      type: Number,
      min: 0,
      default: 0
    },
    extraChildRate: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  amenities: [{
    type: String,
    enum: [
      'WiFi', 'AC', 'TV', 'Mini Bar', 'Mini Fridge', 'Safe', 'Balcony',
      'Sea View', 'City View', 'Mountain View', 'Garden View',
      'Jacuzzi', 'Bathtub', 'Shower', 'Kitchen', 'Living Room',
      'Work Desk', 'Coffee Machine', 'Tea Maker', 'Hair Dryer', 
      'Iron', 'Bathrobe', 'Slippers', 'Telephone', 'Wardrobe',
      'Sofa', 'Dining Table', 'Microwave', 'Electric Kettle',
      'Smart TV', 'Sound System', 'Gaming Console', 'Air Purifier'
    ]
  }],
  size: {
    type: Number, // in square feet
    min: [50, 'Room size must be at least 50 sq ft'],
    max: [5000, 'Room size cannot exceed 5000 sq ft']
  },
  bedConfiguration: {
    kingBeds: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 3
    },
    queenBeds: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 3
    },
    singleBeds: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 4
    },
    sofaBeds: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 2
    },
    totalBeds: {
      type: Number,
      default: 0
    }
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    caption: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    },
    order: {
      type: Number,
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  features: {
    bathroom: {
      type: String,
      enum: ['private', 'shared', 'ensuite'],
      default: 'private'
    },
    smokingAllowed: {
      type: Boolean,
      default: false
    },
    petFriendly: {
      type: Boolean,
      default: false
    },
    accessible: {
      type: Boolean,
      default: false
    },
    soundproof: {
      type: Boolean,
      default: false
    },
    interconnecting: {
      type: Boolean,
      default: false
    }
  },
  maintenanceSchedule: [{
    type: {
      type: String,
      enum: ['cleaning', 'repair', 'inspection', 'renovation', 'pest_control', 'deep_cleaning'],
      required: true
    },
    scheduledDate: {
      type: Date,
      required: true
    },
    completedDate: Date,
    description: {
      type: String,
      required: true,
      trim: true
    },
    cost: {
      type: Number,
      min: 0,
      default: 0
    },
    assignedTo: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'on-hold'],
      default: 'scheduled'
    },
    notes: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  lastCleaned: {
    type: Date,
    default: Date.now
  },
  lastInspected: {
    type: Date
  },
  nextMaintenanceDate: {
    type: Date
  },
  // IoT Integration
  iotDevices: [{
    deviceId: {
      type: String,
      required: true
    },
    deviceType: {
      type: String,
      enum: ['thermostat', 'light', 'lock', 'tv', 'curtain', 'sensor', 'camera'],
      required: true
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'error'],
      default: 'offline'
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    settings: mongoose.Schema.Types.Mixed
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  // Statistics
  totalBookings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  // Audit
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
roomSchema.index({ type: 1, status: 1 });
roomSchema.index({ floor: 1, status: 1 });
roomSchema.index({ isActive: 1, status: 1 });
roomSchema.index({ 'rate.baseRate': 1 });
roomSchema.index({ createdAt: -1 });

// Text index for search
roomSchema.index({ 
  number: 'text', 
  type: 'text',
  notes: 'text'
});

// Pre-save middleware
roomSchema.pre('save', function(next) {
  // Calculate total beds
  if (this.isModified('bedConfiguration')) {
    this.bedConfiguration.totalBeds = 
      (this.bedConfiguration.kingBeds || 0) +
      (this.bedConfiguration.queenBeds || 0) +
      (this.bedConfiguration.singleBeds || 0) +
      (this.bedConfiguration.sofaBeds || 0);
  }
  
  // Calculate max occupancy if not set
  if (!this.capacity.maxOccupancy) {
    this.capacity.maxOccupancy = this.capacity.adults + this.capacity.children;
  }
  
  // Ensure only one primary image
  if (this.isModified('images')) {
    const primaryImages = this.images.filter(img => img.isPrimary);
    if (primaryImages.length > 1) {
      this.images.forEach((img, index) => {
        img.isPrimary = index === 0;
      });
    } else if (primaryImages.length === 0 && this.images.length > 0) {
      this.images[0].isPrimary = true;
    }
  }
  
  next();
});

// Virtual for current rate based on date and season
roomSchema.virtual('currentRate').get(function() {
  if (!this.rate?.baseRate) return 0;
  
  const today = new Date();
  
  // Check for seasonal rates
  const seasonalRate = this.rate.seasonalRates?.find(sr =>
    sr?.startDate && sr?.endDate && 
    today >= sr.startDate && today <= sr.endDate
  );
  
  if (seasonalRate?.rate) return seasonalRate.rate;
  
  // Check for weekend rates (Friday, Saturday, Sunday)
  const dayOfWeek = today.getDay();
  if ([5, 6, 0].includes(dayOfWeek) && this.rate?.weekendRate) {
    return this.rate.weekendRate;
  }
  
  return this.rate.baseRate;
});

// Virtual for availability status
roomSchema.virtual('isAvailable').get(function() {
  return this.isActive && this.status === 'available';
});

// Virtual for needs cleaning
roomSchema.virtual('needsCleaning').get(function() {
  if (!this.lastCleaned) return true;
  const hoursSinceCleaning = (Date.now() - this.lastCleaned.getTime()) / (1000 * 60 * 60);
  return hoursSinceCleaning > 24 || this.status === 'dirty';
});

// Virtual for maintenance due
roomSchema.virtual('maintenanceDue').get(function() {
  if (!this.nextMaintenanceDate) return false;
  return this.nextMaintenanceDate <= new Date();
});

// Virtual for IoT devices (populate separately if needed)
roomSchema.virtual('activeIotDevices').get(function() {
  if (!Array.isArray(this.iotDevices)) return [];
  return this.iotDevices.filter(device => device.status === 'online');
});

// Virtual for current booking
roomSchema.virtual('currentBooking', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'room',
  match: { status: { $in: ['confirmed', 'checked-in'] } },
  options: { sort: { checkInDate: -1 }, limit: 1 }
});

// Virtual for booking history
roomSchema.virtual('bookingHistory', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'room'
});

// Method to update room status
roomSchema.methods.updateStatus = async function(newStatus, userId) {
  this.status = newStatus;
  this.updatedBy = userId;
  
  if (newStatus === 'available') {
    this.lastCleaned = new Date();
  }
  
  return await this.save();
};

// Method to add maintenance record
roomSchema.methods.addMaintenance = async function(maintenanceData, userId) {
  this.maintenanceSchedule.push({
    ...maintenanceData,
    createdBy: userId
  });
  
  // Update status if high priority
  if (maintenanceData.priority === 'urgent' || maintenanceData.priority === 'high') {
    this.status = 'maintenance';
  }
  
  return await this.save();
};

// Method to calculate revenue for date range
roomSchema.methods.calculateRevenue = async function(startDate, endDate) {
  const Booking = mongoose.model('Booking');
  
  const bookings = await Booking.find({
    room: this._id,
    status: 'checked-out',
    checkOutDate: { $gte: startDate, $lte: endDate }
  });
  
  return bookings.reduce((total, booking) => total + booking.totalAmount, 0);
};

// Static method to get available rooms
roomSchema.statics.getAvailableRooms = async function(checkIn, checkOut, filters = {}) {
  const Booking = mongoose.model('Booking');
  
  // Find rooms with conflicting bookings
  const bookedRooms = await Booking.find({
    status: { $in: ['confirmed', 'checked-in'] },
    $or: [
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn }
      }
    ]
  }).distinct('room');
  
  // Build query for available rooms
  const query = {
    _id: { $nin: bookedRooms },
    isActive: true,
    status: { $in: ['available', 'dirty'] }
  };
  
  // Apply filters
  if (filters.type) query.type = filters.type;
  if (filters.floor) query.floor = filters.floor;
  if (filters.minRate) query['rate.baseRate'] = { $gte: filters.minRate };
  if (filters.maxRate) query['rate.baseRate'] = { ...query['rate.baseRate'], $lte: filters.maxRate };
  if (filters.amenities) query.amenities = { $all: filters.amenities };
  
  return await this.find(query).sort({ 'rate.baseRate': 1 });
};

// Static method to get occupancy statistics
roomSchema.statics.getOccupancyStats = async function(startDate, endDate) {
  const totalRooms = await this.countDocuments({ isActive: true });
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  const Booking = mongoose.model('Booking');
  const bookings = await Booking.find({
    status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
    $or: [
      {
        checkInDate: { $gte: startDate, $lte: endDate }
      },
      {
        checkOutDate: { $gte: startDate, $lte: endDate }
      },
      {
        checkInDate: { $lte: startDate },
        checkOutDate: { $gte: endDate }
      }
    ]
  });
  
  let totalRoomNights = 0;
  bookings.forEach(booking => {
    const bookingStart = booking.checkInDate > startDate ? booking.checkInDate : startDate;
    const bookingEnd = booking.checkOutDate < endDate ? booking.checkOutDate : endDate;
    const nights = Math.ceil((bookingEnd - bookingStart) / (1000 * 60 * 60 * 24));
    totalRoomNights += Math.max(0, nights);
  });
  
  const occupancyRate = totalRooms > 0 
    ? (totalRoomNights / (totalRooms * totalDays)) * 100 
    : 0;
  
  return {
    totalRooms,
    totalDays,
    totalRoomNights,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    availableRoomNights: (totalRooms * totalDays) - totalRoomNights
  };
};

if (process.env.USE_JSON_DB !== 'true') {
  module.exports = mongoose.model('Room', roomSchema);
} else {
  const { createJsonModel } = require('./JsonModel');
  const db = require('../config/jsonDb');

  const statics = {
    async findAvailableRooms(checkIn, checkOut, filters = {}) {
      const Booking = require('./Booking');
      const bookings = await Booking.find({
        status: { $in: ['confirmed', 'checked-in'] },
        checkInDate:  { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
      }).lean();
      const bookedRooms = (await bookings).map(b => String(b.room));
      const query = {
        _id: { $nin: bookedRooms },
        isActive: true,
        status: { $in: ['available', 'dirty'] },
      };
      if (filters.type)     query.type  = filters.type;
      if (filters.floor)    query.floor = filters.floor;
      if (filters.minRate)  query['rate.baseRate'] = { $gte: filters.minRate };
      if (filters.maxRate)  query['rate.baseRate'] = { ...(query['rate.baseRate'] || {}), $lte: filters.maxRate };
      if (filters.amenities) query.amenities = { $all: filters.amenities };
      return this.find(query).sort({ 'rate.baseRate': 1 });
    },

    async getOccupancyStats(startDate, endDate) {
      const totalRooms = db.count('rooms', { isActive: true });
      const totalDays  = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
      const Booking    = require('./Booking');
      const bookings   = db.find('bookings', {
        status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
        $or: [
          { checkInDate:  { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
          { checkOutDate: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
          { checkInDate: { $lte: startDate.toISOString() }, checkOutDate: { $gte: endDate.toISOString() } },
        ],
      });
      let totalRoomNights = 0;
      for (const booking of bookings) {
        const bs = new Date(booking.checkInDate)  > startDate ? new Date(booking.checkInDate)  : startDate;
        const be = new Date(booking.checkOutDate) < endDate   ? new Date(booking.checkOutDate) : endDate;
        const nights = Math.ceil((be - bs) / (1000 * 60 * 60 * 24));
        totalRoomNights += Math.max(0, nights);
      }
      const occupancyRate = totalRooms > 0 ? (totalRoomNights / (totalRooms * totalDays)) * 100 : 0;
      return { totalRooms, totalDays, totalRoomNights, occupancyRate: Math.round(occupancyRate * 10) / 10, availableRoomNights: (totalRooms * totalDays) - totalRoomNights };
    },
  };

  module.exports = createJsonModel('rooms', 'Room', { statics });
}
