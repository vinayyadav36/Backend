'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const POSProduct = createJsonModel('pos_products', 'POSProduct', {
  name: { type: 'string', required: true },
  sku: { type: 'string', required: true },
  barcode: { type: 'string' },
  category: { type: 'string' },
  hsnCode: { type: 'string' },
  gstRate: { type: 'number', default: 18 },
  price: { type: 'number', required: true },
  costPrice: { type: 'number', default: 0 },
  stock: { type: 'number', default: 0 },
  reorderLevel: { type: 'number', default: 10 },
  unit: { type: 'string', default: 'piece' },
  images: { type: 'array', default: [] },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const POSCategory = createJsonModel('pos_categories', 'POSCategory', {
  name: { type: 'string', required: true },
  parentId: { type: 'string' },
  gstRate: { type: 'number', default: 18 },
  description: { type: 'string' },
  image: { type: 'string' },
  isActive: { type: 'boolean', default: true },
});

const POSSale = createJsonModel('pos_sales', 'POSSale', {
  invoiceNumber: { type: 'string', required: true },
  customerId: { type: 'string' },
  customerName: { type: 'string' },
  customerPhone: { type: 'string' },
  items: { type: 'array', required: true },
  subtotal: { type: 'number', required: true },
  discountAmount: { type: 'number', default: 0 },
  discountPercent: { type: 'number', default: 0 },
  taxableAmount: { type: 'number', required: true },
  cgstAmount: { type: 'number', default: 0 },
  sgstAmount: { type: 'number', default: 0 },
  igstAmount: { type: 'number', default: 0 },
  gstAmount: { type: 'number', default: 0 },
  roundOff: { type: 'number', default: 0 },
  total: { type: 'number', required: true },
  paymentMethod: { type: 'string', default: 'cash' },
  paidAmount: { type: 'number', default: 0 },
  changeAmount: { type: 'number', default: 0 },
  dueAmount: { type: 'number', default: 0 },
  status: { type: 'string', default: 'completed' },
  gstType: { type: 'string', default: 'intra-state' },
  placeOfSupply: { type: 'string', default: '24' },
  billDate: { type: 'date', required: true },
  createdBy: { type: 'string' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const POSCustomer = createJsonModel('pos_customers', 'POSCustomer', {
  name: { type: 'string', required: true },
  phone: { type: 'string' },
  email: { type: 'string' },
  gstin: { type: 'string' },
  address: { type: 'string' },
  state: { type: 'string' },
  stateCode: { type: 'string' },
  city: { type: 'string' },
  pincode: { type: 'string' },
  creditLimit: { type: 'number', default: 0 },
  openingBalance: { type: 'number', default: 0 },
  balance: { type: 'number', default: 0 },
  type: { type: 'string', default: 'retail' },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const POSSupplier = createJsonModel('pos_suppliers', 'POSSupplier', {
  name: { type: 'string', required: true },
  phone: { type: 'string' },
  email: { type: 'string' },
  gstin: { type: 'string' },
  address: { type: 'string' },
  state: { type: 'string' },
  stateCode: { type: 'string' },
  contactPerson: { type: 'string' },
  paymentTerms: { type: 'string' },
  openingBalance: { type: 'number', default: 0 },
  balance: { type: 'number', default: 0 },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const POSExpense = createJsonModel('pos_expenses', 'POSExpense', {
  date: { type: 'date', required: true },
  category: { type: 'string', required: true },
  description: { type: 'string' },
  amount: { type: 'number', required: true },
  gstAmount: { type: 'number', default: 0 },
  gstRate: { type: 'number', default: 0 },
  paymentMethod: { type: 'string', default: 'cash' },
  reference: { type: 'string' },
  attachment: { type: 'string' },
  createdBy: { type: 'string' },
  createdAt: { type: 'date' },
});

const POSPurchase = createJsonModel('pos_purchases', 'POSPurchase', {
  invoiceNumber: { type: 'string', required: true },
  supplierId: { type: 'string' },
  items: { type: 'array', required: true },
  subtotal: { type: 'number', required: true },
  discountAmount: { type: 'number', default: 0 },
  taxableAmount: { type: 'number', required: true },
  cgstAmount: { type: 'number', default: 0 },
  sgstAmount: { type: 'number', default: 0 },
  igstAmount: { type: 'number', default: 0 },
  gstAmount: { type: 'number', default: 0 },
  total: { type: 'number', required: true },
  paymentStatus: { type: 'string', default: 'pending' },
  dueDate: { type: 'date' },
  billDate: { type: 'date' },
  createdAt: { type: 'date' },
});

const POSTable = createJsonModel('pos_tables', 'POSTable', {
  number: { type: 'string', required: true },
  capacity: { type: 'number', default: 4 },
  status: { type: 'string', default: 'available' },
  section: { type: 'string' },
  position: { type: 'string' },
  isActive: { type: 'boolean', default: true },
});

const POSOrder = createJsonModel('pos_orders', 'POSOrder', {
  tableId: { type: 'string' },
  customerId: { type: 'string' },
  items: { type: 'array', required: true },
  subtotal: { type: 'number', required: true },
  taxAmount: { type: 'number', default: 0 },
  total: { type: 'number', required: true },
  status: { type: 'string', default: 'pending' },
  orderType: { type: 'string', default: 'dine-in' },
  createdBy: { type: 'string' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const POSSettings = createJsonModel('pos_settings', 'POSSettings', {
  businessName: { type: 'string' },
  address: { type: 'string' },
  phone: { type: 'string' },
  email: { type: 'string' },
  gstin: { type: 'string' },
  stateCode: { type: 'string', default: '24' },
  logo: { type: 'string' },
  invoicePrefix: { type: 'string', default: 'INV' },
  decimalPlaces: { type: 'number', default: 2 },
  defaultGstRate: { type: 'number', default: 18 },
  lowStockAlert: { type: 'boolean', default: true },
  autoBackup: { type: 'boolean', default: true },
});

module.exports = {
  POSProduct,
  POSCategory,
  POSSale,
  POSCustomer,
  POSSupplier,
  POSExpense,
  POSPurchase,
  POSTable,
  POSOrder,
  POSSettings,
};