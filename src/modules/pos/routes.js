'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.use(protect);

router.get('/dashboard', ctrl.getPOSDashboard);
router.get('/products', ctrl.getProducts);
router.get('/products/low-stock', ctrl.getLowStockProducts);
router.get('/products/barcode/:barcode', ctrl.getProductByBarcode);
router.get('/products/:id', ctrl.getProduct);
router.post('/products', ctrl.createProduct);
router.put('/products/:id', ctrl.updateProduct);
router.delete('/products/:id', ctrl.deleteProduct);
router.put('/products/:id/stock', ctrl.updateStock);

router.get('/categories', ctrl.getCategories);
router.post('/categories', ctrl.createCategory);
router.put('/categories/:id', ctrl.updateCategory);
router.delete('/categories/:id', ctrl.deleteCategory);

router.get('/sales', ctrl.getSales);
router.get('/sales/:id', ctrl.getSale);
router.post('/sales', ctrl.createSale);
router.put('/sales/:id', ctrl.updateSale);
router.delete('/sales/:id', ctrl.deleteSale);
router.get('/sales/invoice/:invoiceNumber', ctrl.getSaleByInvoice);
router.get('/sales/return/:id', ctrl.getSaleReturn);

router.get('/customers', ctrl.getCustomers);
router.get('/customers/:id', ctrl.getCustomer);
router.post('/customers', ctrl.createCustomer);
router.put('/customers/:id', ctrl.updateCustomer);
router.delete('/customers/:id', ctrl.deleteCustomer);
router.get('/customers/:id/ledger', ctrl.getCustomerLedger);

router.get('/suppliers', ctrl.getSuppliers);
router.get('/suppliers/:id', ctrl.getSupplier);
router.post('/suppliers', ctrl.createSupplier);
router.put('/suppliers/:id', ctrl.updateSupplier);
router.delete('/suppliers/:id', ctrl.deleteSupplier);

router.get('/purchases', ctrl.getPurchases);
router.get('/purchases/:id', ctrl.getPurchase);
router.post('/purchases', ctrl.createPurchase);
router.put('/purchases/:id', ctrl.updatePurchase);
router.patch('/purchases/:id/status', ctrl.updatePurchaseStatus);

router.get('/expenses', ctrl.getExpenses);
router.post('/expenses', ctrl.createExpense);
router.put('/expenses/:id', ctrl.updateExpense);
router.delete('/expenses/:id', ctrl.deleteExpense);

router.get('/tables', ctrl.getTables);
router.post('/tables', ctrl.createTable);
router.put('/tables/:id', ctrl.updateTable);
router.delete('/tables/:id', ctrl.deleteTable);

router.get('/orders', ctrl.getOrders);
router.post('/orders', ctrl.createOrder);
router.put('/orders/:id', ctrl.updateOrder);
router.patch('/orders/:id/status', ctrl.updateOrderStatus);
router.post('/orders/:id/convert-sale', ctrl.convertToSale);

router.get('/reports/sales', ctrl.getSalesReport);
router.get('/reports/gst', ctrl.getGSTReport);
router.get('/reports/profit', ctrl.getProfitReport);
router.get('/reports/stock', ctrl.getStockReport);

router.get('/settings', ctrl.getSettings);
router.put('/settings', ctrl.updateSettings);

router.get('/gst-rates', ctrl.getGSTRates);

module.exports = router;