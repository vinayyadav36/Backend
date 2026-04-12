/**
 * Booking Model
 * Handles room bookings, reservations, and guest stays
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guest',
    required: [true, 'Guest is required'],
    index: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room is required'],
    index: true
  },
  checkInDate: {
    type: Date,
    required: [true, 'Check-in date is required'],
    index: true
  },
  checkOutDate: {
    type: Date,
    required: [true, 'Check-out date is required'],
    index: true
  },
  adults: {
    type: Number,
    required: [true, 'Number of adults is required'],
    min: [1, 'At least one adult is required'],
    max: [10, 'Maximum 10 adults allowed']
  },
  children: {
    type: Number,
    default: 0,
    min: [0, 'Children cannot be negative'],
    max: [10, 'Maximum 10 children allowed']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'],
      message: '{VALUE} is not a valid status'
    },
    default: 'pending',
    index: true
  },
  source: {
    type: String,
    enum: ['online', 'direct', 'phone', 'walk-in', 'travel_agency', 'corporate', 'import'],
    default: 'direct',
    index: true
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded', 'failed'],
    default: 'pending',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet'],
    default: 'cash'
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  // Cancellation Details
  cancellationReason: {
    type: String,
    trim: true
  },
  cancellationDate: Date,
  cancellationFee: {
    type: Number,
    min: 0,
    default: 0
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Check-in/out Details
  checkInTime: Date,
  checkOutTime: Date,
  actualCheckInDate: Date,
  actualCheckOutDate: Date,
  earlyCheckIn: {
    type: Boolean,
    default: false
  },
  lateCheckOut: {
    type: Boolean,
    default: false
  },
  // Additional Services
  extraServices: [{
    service: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'airport_pickup', 'airport_drop', 'spa', 'laundry', 'extra_bed'],
      required: true
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  // Discount & Promotions
  discountCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  // Guest Rating
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  reviewDate: Date,
  // Corporate/Group Booking
  isGroupBooking: {
    type: Boolean,
    default: false
  },
  groupName: {
    type: String,
    trim: true
  },
  corporateId: {
    type: String,
    trim: true
  },
  // Confirmation
  confirmationNumber: {
    type: String,
    unique: true,
    sparse: true
    // unique: true already creates an index, no need for index: true
  },
  confirmedAt: Date,
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ guest: 1, status: 1 });
bookingSchema.index({ room: 1, status: 1 });
bookingSchema.index({ status: 1, checkInDate: 1 });
bookingSchema.index({ createdAt: -1 });
// confirmationNumber already has unique: true, so no need for separate index

// Virtual for duration in nights
bookingSchema.virtual('duration').get(function() {
  if (!this.checkOutDate || !this.checkInDate) return 0;
  const diffTime = Math.abs(this.checkOutDate - this.checkInDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for remaining amount
bookingSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, (this.totalAmount || 0) - (this.paidAmount || 0));
});

// Virtual for total guests
bookingSchema.virtual('totalGuests').get(function() {
  return (this.adults || 0) + (this.children || 0);
});

// Virtual for extra services total
bookingSchema.virtual('extraServicesTotal').get(function() {
  if (!Array.isArray(this.extraServices)) return 0;
  return this.extraServices.reduce((total, service) => {
    return total + (service.price * service.quantity);
  }, 0);
});

// Virtual for grand total
bookingSchema.virtual('grandTotal').get(function() {
  const base = this.totalAmount || 0;
  const extras = this.extraServicesTotal || 0;
  const discount = this.discountAmount || 0;
  return base + extras - discount;
});

// Virtual for booking status display
bookingSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': 'Pending Confirmation',
    'confirmed': 'Confirmed',
    'checked-in': 'Checked In',
    'checked-out': 'Checked Out',
    'cancelled': 'Cancelled',
    'no-show': 'No Show'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for invoice
bookingSchema.virtual('invoice', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'booking',
  justOne: true
});

// Pre-save middleware to validate dates
bookingSchema.pre('save', function(next) {
  // Validate check-out is after check-in
  if (this.checkOutDate <= this.checkInDate) {
    return next(new Error('Check-out date must be after check-in date'));
  }
  
  // Validate booking is not in the past (for new bookings)
  if (this.isNew && this.checkInDate < new Date()) {
    return next(new Error('Cannot create booking with past check-in date'));
  }
  
  // Update payment status based on paid amount
  if (this.isModified('paidAmount') || this.isModified('totalAmount')) {
    const grandTotal = this.grandTotal;
    if (this.paidAmount >= grandTotal) {
      this.paymentStatus = 'paid';
    } else if (this.paidAmount > 0) {
      this.paymentStatus = 'partial';
    } else {
      this.paymentStatus = 'pending';
    }
  }
  
  // Generate confirmation number if confirmed
  if (this.isModified('status') && this.status === 'confirmed' && !this.confirmationNumber) {
    this.confirmationNumber = `BK${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    this.confirmedAt = new Date();
  }
  
  next();
});

// Method to add extra service
bookingSchema.methods.addExtraService = async function(service, quantity, price) {
  this.extraServices.push({
    service,
    quantity,
    price,
    date: new Date()
  });
  return await this.save();
};

// Method to calculate cancellation fee
bookingSchema.methods.calculateCancellationFee = function() {
  const daysUntilCheckIn = Math.ceil((this.checkInDate - new Date()) / (1000 * 60 * 60 * 24));
  
  // Cancellation policy
  if (daysUntilCheckIn > 7) {
    return 0; // Free cancellation
  } else if (daysUntilCheckIn > 3) {
    return this.totalAmount * 0.25; // 25% fee
  } else if (daysUntilCheckIn > 1) {
    return this.totalAmount * 0.50; // 50% fee
  } else {
    return this.totalAmount * 0.75; // 75% fee
  }
};

// Static method to check room availability
bookingSchema.statics.checkAvailability = async function(roomId, checkIn, checkOut, excludeBookingId = null) {
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
  
  const conflictingBookings = await this.countDocuments(query);
  return conflictingBookings === 0;
};

// Static method to get upcoming bookings
bookingSchema.statics.getUpcomingBookings = async function(days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  
  return await this.find({
    checkInDate: { $gte: today, $lte: futureDate },
    status: { $in: ['confirmed', 'pending'] }
  })
    .populate('guest', 'name email phone')
    .populate('room', 'number type')
    .sort({ checkInDate: 1 });
};

if (process.env.USE_JSON_DB !== 'true') {
  module.exports = mongoose.model('Booking', bookingSchema);
} else {
  const { createJsonModel } = require('./JsonModel');
  const db = require('../config/jsonDb');

  const instanceMethods = {
    addPayment(amount, method, reference) {
      const payments = this.payments || [];
      payments.push({ amount, method, reference: reference || null, date: new Date().toISOString() });
      this.payments = payments;
      this.paidAmount = (this.paidAmount || 0) + amount;
      return this.save();
    },
    calculateCancellationFee() {
      const daysUntilCheckIn = Math.ceil((new Date(this.checkInDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilCheckIn > 7) return 0;
      if (daysUntilCheckIn > 3) return this.totalAmount * 0.25;
      if (daysUntilCheckIn > 1) return this.totalAmount * 0.50;
      return this.totalAmount * 0.75;
    },
  };

  const statics = {
    async checkAvailability(roomId, checkIn, checkOut, excludeBookingId = null) {
      const query = {
        room:   String(roomId),
        status: { $in: ['confirmed', 'checked-in'] },
        checkInDate:  { $lt: (checkOut instanceof Date ? checkOut : new Date(checkOut)).toISOString() },
        checkOutDate: { $gt: (checkIn  instanceof Date ? checkIn  : new Date(checkIn)).toISOString() },
      };
      if (excludeBookingId) query._id = { $ne: String(excludeBookingId) };
      return db.count('bookings', query) === 0;
    },

    async getUpcomingBookings(days = 7) {
      const today  = new Date(); today.setHours(0, 0, 0, 0);
      const future = new Date(today); future.setDate(future.getDate() + days);
      return this.find({
        checkInDate: { $gte: today.toISOString(), $lte: future.toISOString() },
        status:      { $in: ['confirmed', 'pending'] },
      }).populate('guest').populate('room').sort({ checkInDate: 1 });
    },
  };

  module.exports = createJsonModel('bookings', 'Booking', {
    instanceMethods,
    statics,
    populateRefs: { guest: 'guests', room: 'rooms', invoice: 'invoices' },
  });
}
