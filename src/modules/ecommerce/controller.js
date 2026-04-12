const { Product, Order, Cart, Category, Vendor, Review, Coupon, Shipment } = require('./model');
const { calculateOrderTotal, validateCoupon: svcValidateCoupon, updateInventory, processCheckout } = require('./service');
const logger = require('../../config/logger');

const getProducts = async (req, res) => {
  try {
    const { search, category, sort, page = 1, limit = 20 } = req.query;
    let items = await Product.find({}).lean();
    if (search) items = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    if (category) items = items.filter(p => p.category === category);
    const start = (page - 1) * limit;
    res.json({ success: true, data: items.slice(start, start + Number(limit)), total: items.length });
  } catch (err) { logger.error('getProducts:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getProduct = async (req, res) => {
  try {
    const item = await Product.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: item });
  } catch (err) { logger.error('getProduct:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createProduct = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const item = await Product.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: item });
  } catch (err) { logger.error('createProduct:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateProduct = async (req, res) => {
  try {
    const item = await Product.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: item });
  } catch (err) { logger.error('updateProduct:', err); res.status(500).json({ success: false, message: err.message }); }
};
const deleteProduct = async (req, res) => {
  try {
    const item = await Product.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) { logger.error('deleteProduct:', err); res.status(500).json({ success: false, message: err.message }); }
};
const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const items = await Product.find({}).lean();
    const results = q ? items.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || (p.description || '').toLowerCase().includes(q.toLowerCase())) : items;
    res.json({ success: true, data: results });
  } catch (err) { logger.error('searchProducts:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getOrders = async (req, res) => {
  try { res.json({ success: true, data: await Order.find({}).lean() }); }
  catch (err) { logger.error('getOrders:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) { logger.error('getOrder:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createOrder = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const totals = await calculateOrderTotal(req.body.items || [], req.body.couponCode);
    const order = await Order.create({ ...req.body, ...totals, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: order });
  } catch (err) { logger.error('createOrder:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date().toISOString() }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) { logger.error('updateOrderStatus:', err); res.status(500).json({ success: false, message: err.message }); }
};
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: 'cancelled', updatedAt: new Date().toISOString() }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: order });
  } catch (err) { logger.error('cancelOrder:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ customerId: req.params.customerId }).lean();
    res.json({ success: true, data: cart || { items: [], total: 0 } });
  } catch (err) { logger.error('getCart:', err); res.status(500).json({ success: false, message: err.message }); }
};
const addToCart = async (req, res) => {
  try {
    const { customerId, item } = req.body;
    const now = new Date().toISOString();
    let cart = await Cart.findOne({ customerId }).lean();
    if (!cart) {
      cart = await Cart.create({ customerId, items: [item], total: item.price * item.quantity, createdAt: now, updatedAt: now });
    } else {
      const items = [...(cart.items || [])];
      const idx = items.findIndex(i => i.productId === item.productId);
      if (idx >= 0) items[idx].quantity += item.quantity;
      else items.push(item);
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      cart = await Cart.findByIdAndUpdate(cart._id, { items, total, updatedAt: now }, { new: true });
    }
    res.json({ success: true, data: cart });
  } catch (err) { logger.error('addToCart:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateCart = async (req, res) => {
  try {
    const cart = await Cart.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    res.json({ success: true, data: cart });
  } catch (err) { logger.error('updateCart:', err); res.status(500).json({ success: false, message: err.message }); }
};
const removeFromCart = async (req, res) => {
  try {
    const cart = await Cart.findById(req.params.id).lean();
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    const items = (cart.items || []).filter(i => i.productId !== req.params.productId);
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const updated = await Cart.findByIdAndUpdate(req.params.id, { items, total, updatedAt: new Date().toISOString() }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) { logger.error('removeFromCart:', err); res.status(500).json({ success: false, message: err.message }); }
};
const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findByIdAndUpdate(req.params.id, { items: [], total: 0, updatedAt: new Date().toISOString() }, { new: true });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
    res.json({ success: true, data: cart });
  } catch (err) { logger.error('clearCart:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getCategories = async (req, res) => {
  try { res.json({ success: true, data: await Category.find({}).lean() }); }
  catch (err) { logger.error('getCategories:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createCategory = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const cat = await Category.create({ ...req.body, createdAt: now, updatedAt: now });
    res.status(201).json({ success: true, data: cat });
  } catch (err) { logger.error('createCategory:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateCategory = async (req, res) => {
  try {
    const cat = await Category.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
    if (!cat) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: cat });
  } catch (err) { logger.error('updateCategory:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getVendors = async (req, res) => {
  try { res.json({ success: true, data: await Vendor.find({}).lean() }); }
  catch (err) { logger.error('getVendors:', err); res.status(500).json({ success: false, message: err.message }); }
};
const getVendor = async (req, res) => {
  try {
    const v = await Vendor.findById(req.params.id).lean();
    if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: v });
  } catch (err) { logger.error('getVendor:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createVendor = async (req, res) => {
  try {
    const now = new Date().toISOString();
    res.status(201).json({ success: true, data: await Vendor.create({ ...req.body, createdAt: now, updatedAt: now }) });
  } catch (err) { logger.error('createVendor:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateVendor = async (req, res) => {
  try {
    const v = await Vendor.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
    if (!v) return res.status(404).json({ success: false, message: 'Vendor not found' });
    res.json({ success: true, data: v });
  } catch (err) { logger.error('updateVendor:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getReviews = async (req, res) => {
  try { res.json({ success: true, data: await Review.find({}).lean() }); }
  catch (err) { logger.error('getReviews:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createReview = async (req, res) => {
  try {
    const now = new Date().toISOString();
    res.status(201).json({ success: true, data: await Review.create({ ...req.body, createdAt: now, updatedAt: now }) });
  } catch (err) { logger.error('createReview:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateReview = async (req, res) => {
  try {
    const r = await Review.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
    if (!r) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, data: r });
  } catch (err) { logger.error('updateReview:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getCoupons = async (req, res) => {
  try { res.json({ success: true, data: await Coupon.find({}).lean() }); }
  catch (err) { logger.error('getCoupons:', err); res.status(500).json({ success: false, message: err.message }); }
};
const createCoupon = async (req, res) => {
  try {
    const now = new Date().toISOString();
    res.status(201).json({ success: true, data: await Coupon.create({ ...req.body, createdAt: now, updatedAt: now }) });
  } catch (err) { logger.error('createCoupon:', err); res.status(500).json({ success: false, message: err.message }); }
};
const validateCouponCtrl = async (req, res) => {
  try {
    const result = await svcValidateCoupon(req.body.code, req.body.orderValue);
    res.json({ success: result.valid, data: result });
  } catch (err) { logger.error('validateCoupon:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getShipments = async (req, res) => {
  try { res.json({ success: true, data: await Shipment.find({}).lean() }); }
  catch (err) { logger.error('getShipments:', err); res.status(500).json({ success: false, message: err.message }); }
};
const updateShipmentStatus = async (req, res) => {
  try {
    const s = await Shipment.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date().toISOString() }, { new: true });
    if (!s) return res.status(404).json({ success: false, message: 'Shipment not found' });
    res.json({ success: true, data: s });
  } catch (err) { logger.error('updateShipmentStatus:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getEcommerceDashboard = async (req, res) => {
  try {
    const [products, orders, vendors, reviews] = await Promise.all([
      Product.countDocuments({}), Order.countDocuments({}), Vendor.countDocuments({}), Review.countDocuments({})
    ]);
    const allOrders = await Order.find({}).lean();
    const revenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
    res.json({ success: true, data: { totalProducts: products, totalOrders: orders, totalVendors: vendors, totalReviews: reviews, totalRevenue: revenue } });
  } catch (err) { logger.error('getEcommerceDashboard:', err); res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, searchProducts,
  getOrders, getOrder, createOrder, updateOrderStatus, cancelOrder,
  getCart, addToCart, updateCart, removeFromCart, clearCart,
  getCategories, createCategory, updateCategory,
  getVendors, getVendor, createVendor, updateVendor,
  getReviews, createReview, updateReview,
  getCoupons, createCoupon, validateCoupon: validateCouponCtrl,
  getShipments, updateShipmentStatus,
  getEcommerceDashboard,
};
