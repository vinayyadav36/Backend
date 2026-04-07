const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  tenantId: { type: String, default: 'default', index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String },
  description: { type: String },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  ancestors: [{ _id: { type: mongoose.Schema.Types.ObjectId }, name: String, slug: String }],
  icon: { type: String },
  image: { type: String },
  level: { type: Number, default: 0 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  productCount: { type: Number, default: 0 },
  seoMeta: { title: String, description: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

categorySchema.pre('save', function (next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  next();
});

module.exports = mongoose.model('Category', categorySchema);
