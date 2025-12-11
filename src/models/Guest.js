/**
 * Guest Model
 * Handles guest information, verification, and loyalty management
 * @version 1.0.0
 */

const mongoose = require('mongoose');

const guestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Guest name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    index: true,
    match: [/^\+?[\d\s\-()]+$/, 'Please enter a valid phone number']
  },
  idType: {
    type: String,
    required: [true, 'ID type is required'],
    enum: {
      values: ['passport', 'aadhar', 'driving_license', 'voter_id', 'pan_card'],
      message: '{VALUE} is not a valid ID type'
    }
  },
  idNumber: {
    type: String,
    required: [true, 'ID number is required'],
    trim: true,
    uppercase: true,
    index: true
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    zipCode: { type: String, trim: true },
    full: { type: String, trim: true }
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(value) {
        // Must be at least 18 years old
        if (!value) return true;
        const age = new Date().getFullYear() - value.getFullYear();
        return age >= 18 && age <= 120;
      },
      message: 'Guest must be at least 18 years old'
    }
  },
  nationality: {
    type: String,
    default: 'Indian',
    trim: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer_not_to_say'],
    default: 'prefer_not_to_say'
  },
  preferences: [{
    type: String,
    enum: [
      'WiFi', 'Room Service', 'Late Checkout', 'Early Checkin',
      'Spa', 'Gym', 'Restaurant', 'Bar', 'Pool', 'Smoking Room',
      'Pet Friendly', 'Accessible Room', 'High Floor', 'Low Floor',
      'Quiet Room', 'City View', 'Sea View'
    ]
  }],
  dietaryRestrictions: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'halal', 'kosher', 'gluten_free', 'lactose_free', 'none']
  }],
  spendingHistory: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    date: {
      type: Date,
      default: Date.now
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      enum: ['room', 'food', 'spa', 'laundry', 'minibar', 'transport', 'other'],
      default: 'other'
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    }
  }],
  // DigiLocker Integration
  digiLockerVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  digiLockerData: {
    verificationInitiated: Date,
    verifiedAt: Date,
    documents: [{
      type: {
        type: String,
        enum: ['aadhar', 'pan', 'driving_license', 'passport', 'voter_id']
      },
      verified: {
        type: Boolean,
        default: false
      },
      number: {
        type: String,
        select: false // Don't expose document numbers by default
      },
      verifiedAt: Date,
      expiryDate: Date
    }]
  },
  // Loyalty Program
  loyaltyPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  vipStatus: {
    type: String,
    enum: ['regular', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'regular',
    index: true
  },
  // Blacklist Management
  blacklisted: {
    type: Boolean,
    default: false,
    index: true
  },
  blacklistReason: {
    type: String,
    trim: true
  },
  blacklistedDate: Date,
  blacklistedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Emergency Contact
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    }
  },
  // Additional Information
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  tags: [{
    type: String,
    trim: true
  }],
  // Marketing
  marketingConsent: {
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    phone: { type: Boolean, default: false }
  },
  // Statistics
  totalBookings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  lastVisit: Date,
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
guestSchema.index({ email: 1, blacklisted: 1 });
guestSchema.index({ phone: 1, blacklisted: 1 });
guestSchema.index({ idNumber: 1, idType: 1 });
guestSchema.index({ vipStatus: 1, loyaltyPoints: -1 });
guestSchema.index({ createdAt: -1 });

// Text index for search
guestSchema.index({ 
  name: 'text', 
  email: 'text', 
  phone: 'text' 
});

// Virtual for age
guestSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Virtual for total spending (calculated)
guestSchema.virtual('calculatedTotalSpending').get(function() {
  if (!Array.isArray(this.spendingHistory)) return 0;
  return this.spendingHistory.reduce((total, spending) => {
    return total + (spending.amount || 0);
  }, 0);
});

// Virtual for current bookings
guestSchema.virtual('currentBookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'guest',
  match: { status: { $in: ['confirmed', 'checked-in'] } }
});

// Virtual for booking history
guestSchema.virtual('bookingHistory', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'guest'
});

// Pre-save middleware to update VIP status based on spending
guestSchema.pre('save', function(next) {
  if (this.isModified('totalSpent')) {
    if (this.totalSpent >= 500000) {
      this.vipStatus = 'diamond';
    } else if (this.totalSpent >= 200000) {
      this.vipStatus = 'platinum';
    } else if (this.totalSpent >= 100000) {
      this.vipStatus = 'gold';
    } else if (this.totalSpent >= 50000) {
      this.vipStatus = 'silver';
    } else {
      this.vipStatus = 'regular';
    }
  }
  next();
});

// Method to add spending
guestSchema.methods.addSpending = async function(amount, description, category, bookingId) {
  this.spendingHistory.push({
    amount,
    description,
    category,
    booking: bookingId,
    date: new Date()
  });
  
  this.totalSpent += amount;
  
  // Award loyalty points (1 point per ₹100 spent)
  const pointsEarned = Math.floor(amount / 100);
  this.loyaltyPoints += pointsEarned;
  
  return await this.save();
};

// Method to redeem loyalty points
guestSchema.methods.redeemPoints = async function(points) {
  if (this.loyaltyPoints < points) {
    throw new Error('Insufficient loyalty points');
  }
  
  this.loyaltyPoints -= points;
  return await this.save();
};

// Method to check if guest is verified
guestSchema.methods.isVerified = function() {
  return this.digiLockerVerified && 
         this.digiLockerData?.documents?.some(doc => doc.verified);
};

// Static method to find by identification
guestSchema.statics.findByIdentification = async function(idType, idNumber) {
  return await this.findOne({
    idType,
    idNumber: idNumber.toUpperCase(),
    blacklisted: false
  });
};

// Static method to search guests
guestSchema.statics.searchGuests = async function(searchTerm, options = {}) {
  const query = {
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  if (options.excludeBlacklisted) {
    query.blacklisted = false;
  }
  
  return await this.find(query)
    .sort(options.sort || { createdAt: -1 })
    .limit(options.limit || 50);
};

module.exports = mongoose.model('Guest', guestSchema);
