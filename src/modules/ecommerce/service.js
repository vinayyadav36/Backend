const { Coupon, Product, Order, Cart } = require('./model');
const logger = require('../../config/logger');

const calculateOrderTotal = async (items, couponCode) => {
  let subtotal = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  let discount = 0;
  if (couponCode) {
    const coupon = await Coupon.findOne({ code: couponCode }).lean();
    if (coupon && coupon.uses < coupon.maxUses && subtotal >= coupon.minOrder) {
      discount = coupon.type === 'percent' ? subtotal * (coupon.value / 100) : coupon.value;
    }
  }
  const tax = (subtotal - discount) * 0.1;
  const shipping = subtotal > 100 ? 0 : 10;
  const total = subtotal - discount + tax + shipping;
  return { subtotal, discount, tax, shipping, total };
};

const validateCoupon = async (code, orderValue) => {
  try {
    const coupon = await Coupon.findOne({ code }).lean();
    if (!coupon) return { valid: false, message: 'Coupon not found' };
    if (coupon.uses >= coupon.maxUses) return { valid: false, message: 'Coupon exhausted' };
    if (orderValue < coupon.minOrder) return { valid: false, message: `Minimum order ${coupon.minOrder} required` };
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return { valid: false, message: 'Coupon expired' };
    return { valid: true, coupon };
  } catch (err) {
    logger.error('validateCoupon error:', err);
    return { valid: false, message: err.message };
  }
};

const updateInventory = async (productId, quantity, operation) => {
  try {
    const product = await Product.findById(productId).lean();
    if (!product) return { success: false, message: 'Product not found' };
    const newStock = operation === 'add' ? product.stock + quantity : product.stock - quantity;
    if (newStock < 0) return { success: false, message: 'Insufficient stock' };
    await Product.findByIdAndUpdate(productId, { stock: newStock, updatedAt: new Date().toISOString() }, { new: true });
    return { success: true, stock: newStock };
  } catch (err) {
    logger.error('updateInventory error:', err);
    return { success: false, message: err.message };
  }
};

const processCheckout = async (customerId, cartId, paymentInfo) => {
  try {
    const cart = await Cart.findById(cartId).lean();
    if (!cart) return { success: false, message: 'Cart not found' };
    const totals = await calculateOrderTotal(cart.items, null);
    const now = new Date().toISOString();
    const order = await Order.create({ customerId, items: cart.items, ...totals, status: 'confirmed', paymentInfo, createdAt: now, updatedAt: now });
    for (const item of cart.items) {
      await updateInventory(item.productId, item.quantity, 'subtract');
    }
    await Cart.findByIdAndUpdate(cartId, { items: [], total: 0, updatedAt: now }, { new: true });
    return { success: true, order };
  } catch (err) {
    logger.error('processCheckout error:', err);
    return { success: false, message: err.message };
  }
};

module.exports = { calculateOrderTotal, validateCoupon, updateInventory, processCheckout };
