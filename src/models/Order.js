const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  tenantId: { type: String, default: 'default', index: true },
  orderNumber: { type: String, unique: true, index: true },
  orderType: {
    type: String,
    enum: ['product', 'food', 'service', 'hotel', 'course', 'subscription'],
    default: 'product',
  },
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'Consumer' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    sku: String,
    image: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: Number,
    variant: { name: String, attributes: [{ key: String, value: String }] },
    notes: String,
  }],
  billing: {
    subtotal: Number,
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  payment: {
    method: {
      type: String,
      enum: ['cash', 'card', 'upi', 'netbanking', 'wallet', 'emi', 'cod', 'credit', 'bank_transfer'],
      default: 'cash',
    },
    status: {
      type: String,
      enum: ['pending', 'authorized', 'captured', 'failed', 'refunded', 'partial_refund'],
      default: 'pending',
    },
    transactionId: String,
    gateway: String,
    paidAt: Date,
    paidAmount: { type: Number, default: 0 },
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned', 'refunded'],
    default: 'pending',
  },
  statusHistory: [{
    status: String,
    note: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  }],
  deliveryAddress: {
    name: String, phone: String, line1: String, line2: String,
    city: String, state: String, country: { type: String, default: 'India' },
    pincode: String, landmark: String, lat: Number, lng: Number,
  },
  deliverySlot: { date: Date, startTime: String, endTime: String },
  estimatedDelivery: Date,
  deliveredAt: Date,
  cancelledAt: Date,
  cancellationReason: String,
  refundAmount: { type: Number, default: 0 },
  notes: String,
  coupon: { code: String, discount: Number, type: { type: String, enum: ['percent', 'fixed'] } },
  source: {
    type: String,
    enum: ['web', 'mobile', 'whatsapp', 'phone', 'pos', 'api'],
    default: 'web',
  },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orderSchema.methods.addStatusHistory = function (status, note, userId) {
  this.statusHistory.push({ status, note, updatedBy: userId, timestamp: new Date() });
  this.status = status;
};

orderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(10000 + Math.random() * 90000);
    this.orderNumber = `ORD-${dateStr}-${rand}`;
  }
  next();
});

orderSchema.index({ tenantId: 1, orderType: 1, status: 1 });
orderSchema.index({ tenantId: 1, consumer: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
