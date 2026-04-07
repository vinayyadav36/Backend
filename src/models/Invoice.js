/**
 * Invoice Model
 * Handles billing, invoicing, and payment tracking
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const _crypto = require('crypto');

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1'],
    max: [100, 'Quantity cannot exceed 100']
  },
  rate: {
    type: Number,
    required: [true, 'Rate is required'],
    min: [0, 'Rate cannot be negative']
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    enum: ['room', 'food', 'beverage', 'spa', 'laundry', 'minibar', 'transport', 'parking', 'internet', 'telephone', 'other'],
    default: 'other'
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

// Pre-save middleware for invoice item to calculate amount
invoiceItemSchema.pre('save', function(next) {
  this.amount = this.quantity * this.rate;
  if (this.taxRate > 0) {
    this.taxAmount = (this.amount * this.taxRate) / 100;
  }
  next();
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking is required'],
    index: true
  },
  guest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guest',
    required: [true, 'Guest is required'],
    index: true
  },
  items: {
    type: [invoiceItemSchema],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'Invoice must have at least one item'
    }
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'sent', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
      message: '{VALUE} is not a valid invoice status'
    },
    default: 'draft',
    index: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'upi', 'bank_transfer', 'online', 'cheque', 'wallet', 'corporate'],
    default: 'cash'
  },
  paymentReference: {
    type: String,
    trim: true
  },
  paidAt: Date,
  dueDate: {
    type: Date,
    index: true
  },
  issueDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Payment Terms
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_60', 'custom'],
    default: 'immediate'
  },
  // Additional Charges
  serviceCharge: {
    type: Number,
    default: 0,
    min: 0
  },
  serviceChargeRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  additionalCharges: [{
    description: String,
    amount: {
      type: Number,
      min: 0
    }
  }],
  // Notes and Terms
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  terms: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  internalNotes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // PDF Generation
  pdfUrl: String,
  pdfGeneratedAt: Date,
  // Email Tracking
  emailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: Date,
  emailSentTo: String,
  // Company/Hotel Details (for PDF)
  companyDetails: {
    name: String,
    address: String,
    phone: String,
    email: String,
    gstin: String,
    logo: String
  },
  // Guest/Customer Details (snapshot for invoice)
  customerDetails: {
    name: String,
    email: String,
    phone: String,
    address: String,
    gstin: String
  },
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for better query performance
// invoiceNumber already has unique: true, so no need for separate index
invoiceSchema.index({ booking: 1, status: 1 });
invoiceSchema.index({ guest: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ status: 1, issueDate: -1 });
invoiceSchema.index({ createdAt: -1 });

// Virtual for balance/remaining amount
invoiceSchema.virtual('balanceAmount').get(function() {
  return Math.max(0, this.totalAmount - (this.paidAmount || 0));
});

// Virtual for is overdue
invoiceSchema.virtual('isOverdue').get(function() {
  if (this.status === 'paid') return false;
  if (!this.dueDate) return false;
  return new Date() > this.dueDate && this.balanceAmount > 0;
});

// Virtual for payment status percentage
invoiceSchema.virtual('paymentProgress').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.round((this.paidAmount / this.totalAmount) * 100);
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  const diff = Date.now() - this.dueDate.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber || this.invoiceNumber === '') {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // Count invoices created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const count = await this.constructor.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });
    
    const sequence = String(count + 1).padStart(4, '0');
    this.invoiceNumber = `INV-${year}${month}${day}-${sequence}`;
  }
  
  // Calculate amounts if items changed
  if (this.isModified('items')) {
    this.subtotal = this.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  }
  
  // Recalculate totals
  if (this.isModified('subtotal') || this.isModified('taxRate') || 
      this.isModified('discount') || this.isModified('serviceChargeRate')) {
    
    // Calculate discount amount
    if (this.discount > 0) {
      this.discountAmount = (this.subtotal * this.discount) / 100;
    }
    
    // Calculate amount after discount
    const amountAfterDiscount = this.subtotal - this.discountAmount;
    
    // Calculate service charge
    if (this.serviceChargeRate > 0) {
      this.serviceCharge = (amountAfterDiscount * this.serviceChargeRate) / 100;
    }
    
    // Calculate tax
    const taxableAmount = amountAfterDiscount + this.serviceCharge;
    if (this.taxRate > 0) {
      this.taxAmount = (taxableAmount * this.taxRate) / 100;
    }
    
    // Add additional charges
    const additionalTotal = this.additionalCharges?.reduce((sum, charge) => 
      sum + (charge.amount || 0), 0) || 0;
    
    // Calculate final total
    this.totalAmount = taxableAmount + this.taxAmount + additionalTotal;
  }
  
  // Update status based on payment
  if (this.isModified('paidAmount') && this.totalAmount > 0) {
    if (this.paidAmount >= this.totalAmount) {
      this.status = 'paid';
      if (!this.paidAt) {
        this.paidAt = new Date();
      }
    } else if (this.paidAmount > 0) {
      this.status = 'partial';
    } else if (this.status === 'paid' || this.status === 'partial') {
      this.status = 'pending';
    }
  }
  
  // Set due date based on payment terms
  if (!this.dueDate && this.paymentTerms) {
    const issueDate = this.issueDate || new Date();
    switch (this.paymentTerms) {
      case 'net_15':
        this.dueDate = new Date(issueDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        break;
      case 'net_30':
        this.dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        break;
      case 'net_60':
        this.dueDate = new Date(issueDate.getTime() + 60 * 24 * 60 * 60 * 1000);
        break;
      default:
        this.dueDate = issueDate;
    }
  }
  
  next();
});

// Method to add payment
invoiceSchema.methods.addPayment = async function(amount, method, reference, userId) {
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }
  
  if (amount > this.balanceAmount) {
    throw new Error('Payment amount exceeds balance');
  }
  
  this.paidAmount += amount;
  this.paymentMethod = method;
  this.paymentReference = reference;
  this.updatedBy = userId;
  
  if (this.paidAmount >= this.totalAmount) {
    this.status = 'paid';
    this.paidAt = new Date();
  } else {
    this.status = 'partial';
  }
  
  return await this.save();
};

// Method to add item
invoiceSchema.methods.addItem = async function(item) {
  this.items.push(item);
  return await this.save();
};

// Method to mark as sent
invoiceSchema.methods.markAsSent = async function(email) {
  this.status = 'sent';
  this.emailSent = true;
  this.emailSentAt = new Date();
  this.emailSentTo = email;
  return await this.save();
};

// Static method to get overdue invoices
invoiceSchema.statics.getOverdueInvoices = async function() {
  return await this.find({
    status: { $in: ['pending', 'partial', 'sent'] },
    dueDate: { $lt: new Date() }
  })
    .populate('guest', 'name email phone')
    .populate('booking', 'confirmationNumber')
    .sort({ dueDate: 1 });
};

// Static method to calculate revenue for period
invoiceSchema.statics.calculateRevenue = async function(startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        status: 'paid',
        paidAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        totalInvoices: { $sum: 1 },
        averageAmount: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  return result[0] || {
    totalRevenue: 0,
    totalInvoices: 0,
    averageAmount: 0
  };
};

module.exports = mongoose.model('Invoice', invoiceSchema);
