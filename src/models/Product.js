const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  tenantId: { type: String, default: 'default', index: true },
  name: { type: String, required: true, trim: true, maxlength: 500 },
  slug: { type: String },
  description: { type: String, maxlength: 5000 },
  shortDescription: { type: String, maxlength: 500 },
  sku: { type: String, trim: true, index: true },
  barcode: { type: String, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  subcategory: { type: String },
  productType: {
    type: String,
    enum: ['physical', 'digital', 'service', 'food', 'course', 'subscription', 'hotel_room'],
    default: 'physical',
  },
  images: [{ url: String, alt: String, isPrimary: { type: Boolean, default: false } }],
  pricing: {
    basePrice: { type: Number, required: true },
    salePrice: Number,
    currency: { type: String, default: 'INR' },
    taxIncluded: { type: Boolean, default: false },
  },
  tax: {
    rate: { type: Number, default: 0 },
    type: { type: String, enum: ['GST', 'VAT', 'IGST', 'none'], default: 'GST' },
    hsn: String,
  },
  inventory: {
    quantity: { type: Number, default: 0 },
    trackInventory: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 10 },
    inStock: { type: Boolean, default: true },
  },
  attributes: [{ key: String, value: String }],
  variants: [{
    name: String,
    sku: String,
    price: Number,
    inventory: Number,
    attributes: [{ key: String, value: String }],
  }],
  ratings: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
  tags: [String],
  seoMeta: { title: String, description: String, keywords: [String] },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryInfo: {
    freeDelivery: Boolean,
    estimatedDays: Number,
    deliveryCharge: { type: Number, default: 0 },
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

productSchema.pre('save', function (next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index({ tenantId: 1, category: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Product', productSchema);
