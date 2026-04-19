'use strict';
const db = require('../../config/jsonDb');

const generateInvoiceNumber = (prefix = 'INV') => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${year}${month}${random}`;
};

const calculateGST = (amount, rate, gstType, placeOfSupply, businessStateCode) => {
  const taxableAmount = amount;
  let cgst = 0, sgst = 0, igst = 0;
  
  if (gstType === 'intra-state' || placeOfSupply === businessStateCode) {
    cgst = (taxableAmount * rate) / 200;
    sgst = (taxableAmount * rate) / 200;
  } else {
    igst = (taxableAmount * rate) / 100;
  }
  
  return { cgst, sgst, igst, totalGST: cgst + sgst + igst, taxableAmount };
};

const calculateItemGST = (item, gstRate, gstType, businessStateCode) => {
  const taxableAmount = item.quantity * item.rate;
  const discount = item.discount || 0;
  const afterDiscount = taxableAmount - discount;
  
  let cgst = 0, sgst = 0, igst = 0;
  
  if (gstType === 'intra-state' || item.stateCode === businessStateCode) {
    cgst = (afterDiscount * gstRate) / 200;
    sgst = (afterDiscount * gstRate) / 200;
  } else {
    igst = (afterDiscount * gstRate) / 100;
  }
  
  return { taxableAmount: afterDiscount, cgst, sgst, igst, totalGST: cgst + sgst + igst };
};

const POSService = {
  async getDashboard() {
    const sales = db.find('pos_sales', {});
    const products = db.find('pos_products', {});
    const customers = db.find('pos_customers', {});
    const expenses = db.find('pos_expenses', {});
    
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.billDate?.startsWith(today));
    
    const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
    const todayRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const lowStock = products.filter(p => p.stock <= p.reorderLevel);
    
    return {
      todaySales: todaySales.length,
      todayRevenue,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalProducts: products.length,
      totalCustomers: customers.length,
      lowStockCount: lowStock.length,
      recentSales: sales.slice(-10).reverse(),
    };
  },

  async createSale(data) {
    const settings = db.findOne('pos_settings', {}) || { stateCode: '24', decimalPlaces: 2 };
    let subtotal = 0, taxableAmount = 0, cgst = 0, sgst = 0, igst = 0, totalGst = 0;
    
    const items = data.items.map(item => {
      const itemSubtotal = item.quantity * item.rate;
      const discount = item.discount || 0;
      subtotal += itemSubtotal;
      
      const { taxableAmount: tx, cgst: c, sgst: s, igst: i, totalGST } = calculateItemGST(
        item, item.gstRate || 18, data.gstType || 'intra-state', settings.stateCode
      );
      
      taxableAmount += tx;
      cgst += c;
      sgst += s;
      igst += i;
      totalGst += totalGST;
      
      return {
        ...item,
        taxableAmount: tx,
        cgst: c,
        sgst: s,
        igst: i,
        gstAmount: totalGST,
        total: tx + totalGST
      };
    });
    
    const discountAmount = data.discountPercent ? (subtotal * data.discountPercent / 100) : (data.discountAmount || 0);
    const afterDiscount = taxableAmount - discountAmount;
    const roundOff = Math.round(afterDiscount + totalGst) - (afterDiscount + totalGst);
    const total = Math.round(afterDiscount + totalGst);
    
    const sale = {
      _id: db.generateId(),
      invoiceNumber: generateInvoiceNumber(),
      customerId: data.customerId,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      items,
      subtotal,
      discountAmount,
      discountPercent: data.discountPercent || 0,
      taxableAmount: afterDiscount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      gstAmount: totalGst,
      roundOff,
      total,
      paymentMethod: data.paymentMethod || 'cash',
      paidAmount: data.paidAmount || total,
      changeAmount: (data.paidAmount || total) - total,
      dueAmount: data.dueAmount || 0,
      status: 'completed',
      gstType: data.gstType || 'intra-state',
      placeOfSupply: data.placeOfSupply || settings.stateCode,
      billDate: new Date().toISOString(),
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    db.insert('pos_sales', sale);
    
    items.forEach(async item => {
      const product = db.findOne('pos_products', { _id: item.productId });
      if (product) {
        await db.update('pos_products', { _id: item.productId }, { $set: { stock: (product.stock || 0) - item.quantity } });
      }
    });
    
    return sale;
  },

  async getSalesReport(startDate, endDate) {
    const sales = db.find('pos_sales', {});
    const filtered = sales.filter(s => {
      const date = s.billDate?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
    
    const summary = {
      totalSales: filtered.length,
      totalRevenue: filtered.reduce((sum, s) => sum + s.total, 0),
      totalTax: filtered.reduce((sum, s) => sum + s.gstAmount, 0),
      totalDiscount: filtered.reduce((sum, s) => sum + s.discountAmount, 0),
      byPayment: {},
      byGST: { cgst: 0, sgst: 0, igst: 0 }
    };
    
    filtered.forEach(s => {
      summary.byPayment[s.paymentMethod] = (summary.byPayment[s.paymentMethod] || 0) + s.total;
      summary.byGST.cgst += s.cgstAmount || 0;
      summary.byGST.sgst += s.sgstAmount || 0;
      summary.byGST.igst += s.igstAmount || 0;
    });
    
    return { sales: filtered, summary };
  },

  async getGSTReport(startDate, endDate) {
    const sales = db.find('pos_sales', {});
    const filtered = sales.filter(s => {
      const date = s.billDate?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
    
    const gstSummary = {};
    filtered.forEach(s => {
      s.items?.forEach(item => {
        const hsn = item.hsnCode || '999999';
        if (!gstSummary[hsn]) {
          gstSummary[hsn] = { hsnCode: hsn, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, total: 0, count: 0 };
        }
        gstSummary[hsn].taxableAmount += item.taxableAmount || 0;
        gstSummary[hsn].cgst += item.cgst || 0;
        gstSummary[hsn].sgst += item.sgst || 0;
        gstSummary[hsn].igst += item.igst || 0;
        gstSummary[hsn].total += item.total || 0;
        gstSummary[hsn].count += item.quantity || 0;
      });
    });
    
    return {
      period: { startDate, endDate },
      totalSales: filtered.length,
      totalTaxable: Object.values(gstSummary).reduce((sum, g) => sum + g.taxableAmount, 0),
      totalGST: Object.values(gstSummary).reduce((sum, g) => sum + g.cgst + g.sgst + g.igst, 0),
      hsnSummary: Object.values(gstSummary)
    };
  },

  async createProduct(data) {
    const product = { _id: db.generateId(), ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.insert('pos_products', product);
    return product;
  },

  async createCustomer(data) {
    const customer = { _id: db.generateId(), ...data, balance: data.openingBalance || 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    db.insert('pos_customers', customer);
    return customer;
  },

  async createExpense(data) {
    const expense = { _id: db.generateId(), ...data, createdAt: new Date().toISOString() };
    db.insert('pos_expenses', expense);
    return expense;
  },

  async getProfitReport(startDate, endDate) {
    const sales = db.find('pos_sales', {});
    const purchases = db.find('pos_purchases', {});
    const expenses = db.find('pos_expenses', {});
    
    const filteredSales = sales.filter(s => {
      const date = s.billDate?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
    
    const filteredExpenses = expenses.filter(e => {
      const date = e.date?.split('T')[0];
      return date >= startDate && date <= endDate;
    });
    
    let totalCost = 0;
    filteredSales.forEach(sale => {
      sale.items?.forEach(item => {
        const product = db.findOne('pos_products', { _id: item.productId });
        if (product) {
          totalCost += (product.costPrice || 0) * item.quantity;
        }
      });
    });
    
    const revenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    return {
      revenue,
      costOfGoods: totalCost,
      grossProfit: revenue - totalCost,
      expenses: totalExpenses,
      netProfit: revenue - totalCost - totalExpenses,
      profitMargin: revenue > 0 ? ((revenue - totalCost - totalExpenses) / revenue * 100).toFixed(2) : 0
    };
  }
};

module.exports = POSService;