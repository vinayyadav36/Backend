'use strict';
const POSService = require('./service');
const { POSProduct, POSCategory, POSSale, POSCustomer, POSSupplier, POSExpense, POSPurchase, POSTable, POSOrder, POSSettings } = require('./model');
const db = require('../../config/jsonDb');

const ctrl = {
  getPOSDashboard: async (req, res) => {
    try {
      const data = await POSService.getDashboard();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProducts: async (req, res) => {
    try {
      const { category, search, lowStock } = req.query;
      let query = { isActive: true };
      if (category) query.category = category;
      if (search) query.$or = [{ name: { $regex: search } }, { sku: { $regex: search } }, { barcode: { $regex: search } }];
      const products = lowStock === 'true' ? db.find('pos_products', {}).filter(p => p.stock <= p.reorderLevel) : db.find('pos_products', query);
      res.json({ success: true, data: products });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProduct: async (req, res) => {
    try {
      const product = await POSProduct.findById(req.params.id);
      res.json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProductByBarcode: async (req, res) => {
    try {
      const product = db.findOne('pos_products', { barcode: req.params.barcode });
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      res.json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createProduct: async (req, res) => {
    try {
      const product = await POSService.createProduct(req.body);
      res.status(201).json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateProduct: async (req, res) => {
    try {
      const product = await POSProduct.findByIdAndUpdate(req.params.id, { $set: { ...req.body, updatedAt: new Date().toISOString() } }, { new: true });
      res.json({ success: true, data: product });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteProduct: async (req, res) => {
    try {
      await POSProduct.findByIdAndUpdate(req.params.id, { $set: { isActive: false } });
      res.json({ success: true, message: 'Product deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateStock: async (req, res) => {
    try {
      const { quantity, type } = req.body;
      const product = db.findOne('pos_products', { _id: req.params.id });
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
      const newStock = type === 'add' ? (product.stock || 0) + quantity : (product.stock || 0) - quantity;
      await POSProduct.findByIdAndUpdate(req.params.id, { $set: { stock: newStock } });
      res.json({ success: true, data: { stock: newStock } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getLowStockProducts: async (req, res) => {
    try {
      const products = db.find('pos_products', {}).filter(p => p.isActive !== false && p.stock <= p.reorderLevel);
      res.json({ success: true, data: products });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCategories: async (req, res) => {
    try {
      const categories = db.find('pos_categories', { isActive: true });
      res.json({ success: true, data: categories });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createCategory: async (req, res) => {
    try {
      const category = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('pos_categories', category);
      res.status(201).json({ success: true, data: category });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateCategory: async (req, res) => {
    try {
      await db.update('pos_categories', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('pos_categories', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteCategory: async (req, res) => {
    try {
      await db.update('pos_categories', { _id: req.params.id }, { $set: { isActive: false } });
      res.json({ success: true, message: 'Category deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSales: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      let sales = db.find('pos_sales', {});
      if (startDate && endDate) {
        sales = sales.filter(s => s.billDate >= startDate && s.billDate <= endDate);
      }
      res.json({ success: true, data: sales.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSale: async (req, res) => {
    try {
      const sale = await POSSale.findById(req.params.id);
      res.json({ success: true, data: sale });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createSale: async (req, res) => {
    try {
      const sale = await POSService.createSale(req.body);
      res.status(201).json({ success: true, data: sale });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSaleByInvoice: async (req, res) => {
    try {
      const sale = db.findOne('pos_sales', { invoiceNumber: req.params.invoiceNumber });
      if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found' });
      res.json({ success: true, data: sale });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSalesReport: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await POSService.getSalesReport(startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]);
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getGSTReport: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await POSService.getGSTReport(startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]);
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProfitReport: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await POSService.getProfitReport(startDate || '2024-01-01', endDate || new Date().toISOString().split('T')[0]);
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getStockReport: async (req, res) => {
    try {
      const products = db.find('pos_products', { isActive: true });
      const report = {
        totalProducts: products.length,
        totalStockValue: products.reduce((sum, p) => sum + (p.stock || 0) * (p.costPrice || 0), 0),
        totalRetailValue: products.reduce((sum, p) => sum + (p.stock || 0) * (p.price || 0), 0),
        lowStock: products.filter(p => p.stock <= p.reorderLevel),
        outOfStock: products.filter(p => p.stock <= 0),
        byCategory: {}
      };
      products.forEach(p => {
        if (!report.byCategory[p.category]) report.byCategory[p.category] = { count: 0, stock: 0 };
        report.byCategory[p.category].count++;
        report.byCategory[p.category].stock += p.stock || 0;
      });
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCustomers: async (req, res) => {
    try {
      const customers = db.find('pos_customers', { isActive: true });
      res.json({ success: true, data: customers });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCustomer: async (req, res) => {
    try {
      const customer = await POSCustomer.findById(req.params.id);
      res.json({ success: true, data: customer });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createCustomer: async (req, res) => {
    try {
      const customer = await POSService.createCustomer(req.body);
      res.status(201).json({ success: true, data: customer });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateCustomer: async (req, res) => {
    try {
      const customer = await POSCustomer.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
      res.json({ success: true, data: customer });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteCustomer: async (req, res) => {
    try {
      await POSCustomer.findByIdAndUpdate(req.params.id, { $set: { isActive: false } });
      res.json({ success: true, message: 'Customer deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCustomerLedger: async (req, res) => {
    try {
      const sales = db.find('pos_sales', { customerId: req.params.id });
      res.json({ success: true, data: sales });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSuppliers: async (req, res) => {
    try {
      const suppliers = db.find('pos_suppliers', { isActive: true });
      res.json({ success: true, data: suppliers });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSupplier: async (req, res) => {
    try {
      const supplier = await POSSupplier.findById(req.params.id);
      res.json({ success: true, data: supplier });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createSupplier: async (req, res) => {
    try {
      const supplier = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('pos_suppliers', supplier);
      res.status(201).json({ success: true, data: supplier });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateSupplier: async (req, res) => {
    try {
      await db.update('pos_suppliers', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('pos_suppliers', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteSupplier: async (req, res) => {
    try {
      await db.update('pos_suppliers', { _id: req.params.id }, { $set: { isActive: false } });
      res.json({ success: true, message: 'Supplier deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPurchases: async (req, res) => {
    try {
      const purchases = db.find('pos_purchases', {});
      res.json({ success: true, data: purchases.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPurchase: async (req, res) => {
    try {
      const purchase = db.findById('pos_purchases', req.params.id);
      res.json({ success: true, data: purchase });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createPurchase: async (req, res) => {
    try {
      const purchase = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('pos_purchases', purchase);
      req.body.items.forEach(item => {
        const product = db.findOne('pos_products', { _id: item.productId });
        if (product) {
          db.update('pos_products', { _id: item.productId }, { $set: { stock: (product.stock || 0) + item.quantity } });
        }
      });
      res.status(201).json({ success: true, data: purchase });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updatePurchase: async (req, res) => {
    try {
      await db.update('pos_purchases', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('pos_purchases', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updatePurchaseStatus: async (req, res) => {
    try {
      await db.update('pos_purchases', { _id: req.params.id }, { $set: { paymentStatus: req.body.status } });
      res.json({ success: true, message: 'Status updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getExpenses: async (req, res) => {
    try {
      const expenses = db.find('pos_expenses', {});
      res.json({ success: true, data: expenses.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createExpense: async (req, res) => {
    try {
      const expense = await POSService.createExpense(req.body);
      res.status(201).json({ success: true, data: expense });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateExpense: async (req, res) => {
    try {
      await db.update('pos_expenses', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('pos_expenses', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteExpense: async (req, res) => {
    try {
      await db.removeById('pos_expenses', req.params.id);
      res.json({ success: true, message: 'Expense deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTables: async (req, res) => {
    try {
      const tables = db.find('pos_tables', { isActive: true });
      res.json({ success: true, data: tables });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createTable: async (req, res) => {
    try {
      const table = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('pos_tables', table);
      res.status(201).json({ success: true, data: table });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTable: async (req, res) => {
    try {
      await db.update('pos_tables', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('pos_tables', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteTable: async (req, res) => {
    try {
      await db.update('pos_tables', { _id: req.params.id }, { $set: { isActive: false } });
      res.json({ success: true, message: 'Table deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getOrders: async (req, res) => {
    try {
      const orders = db.find('pos_orders', {});
      res.json({ success: true, data: orders.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createOrder: async (req, res) => {
    try {
      const order = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('pos_orders', order);
      res.status(201).json({ success: true, data: order });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateOrder: async (req, res) => {
    try {
      await db.update('pos_orders', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('pos_orders', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateOrderStatus: async (req, res) => {
    try {
      await db.update('pos_orders', { _id: req.params.id }, { $set: { status: req.body.status, updatedAt: new Date().toISOString() } });
      res.json({ success: true, message: 'Order status updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  convertToSale: async (req, res) => {
    try {
      const order = db.findById('pos_orders', req.params.id);
      if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
      const sale = await POSService.createSale({ ...order, items: order.items.map(i => ({ ...i, productId: i.productId || i._id })) });
      await db.update('pos_orders', { _id: req.params.id }, { $set: { status: 'completed', updatedAt: new Date().toISOString() } });
      res.status(201).json({ success: true, data: sale });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSettings: async (req, res) => {
    try {
      let settings = db.findOne('pos_settings', {});
      if (!settings) {
        settings = { _id: db.generateId(), businessName: 'My Store', stateCode: '24', decimalPlaces: 2, defaultGstRate: 18 };
        db.insert('pos_settings', settings);
      }
      res.json({ success: true, data: settings });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateSettings: async (req, res) => {
    try {
      const existing = db.findOne('pos_settings', {});
      if (existing) {
        await db.update('pos_settings', { _id: existing._id }, { $set: req.body });
        res.json({ success: true, data: db.findById('pos_settings', existing._id) });
      } else {
        const settings = { _id: db.generateId(), ...req.body };
        db.insert('pos_settings', settings);
        res.status(201).json({ success: true, data: settings });
      }
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getGSTRates: async (req, res) => {
    res.json({ success: true, data: [
      { rate: 0, name: 'Exempt' },
      { rate: 0.5, name: '0.5%' },
      { rate: 3, name: '3%' },
      { rate: 5, name: '5%' },
      { rate: 12, name: '12%' },
      { rate: 18, name: '18%' },
      { rate: 28, name: '28%' }
    ]});
  },

  getSaleReturn: async (req, res) => {
    res.json({ success: true, data: { message: 'Sale return not implemented yet' } });
  },

  updateSale: async (req, res) => {
    try {
      await db.update('pos_sales', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('pos_sales', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteSale: async (req, res) => {
    try {
      await db.removeById('pos_sales', req.params.id);
      res.json({ success: true, message: 'Sale deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
};

module.exports = ctrl;