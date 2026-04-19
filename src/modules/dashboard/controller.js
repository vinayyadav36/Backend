'use strict';
const db = require('../../config/jsonDb');

const DashboardService = {
  async getPOSData() {
    const sales = db.find('pos_sales', {});
    const products = db.find('pos_products', {});
    const customers = db.find('pos_customers', {});
    const expenses = db.find('pos_expenses', {});
    
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);
    
    const todaySales = sales.filter(s => s.billDate?.startsWith(today));
    const monthSales = sales.filter(s => s.billDate?.startsWith(thisMonth));
    
    return {
      todaySales: todaySales.length,
      todayRevenue: todaySales.reduce((s, i) => s + i.total, 0),
      monthRevenue: monthSales.reduce((s, i) => s + i.total, 0),
      totalProducts: products.length,
      lowStockCount: products.filter(p => p.stock <= p.reorderLevel).length,
      totalCustomers: customers.length,
      totalExpenses: expenses.reduce((s, i) => s + i.amount, 0),
      salesByDay: this.getSalesByDay(sales),
      topProducts: this.getTopProducts(sales),
    };
  },

  async getSalesData() {
    const sales = db.find('pos_sales', {});
    const orders = db.find('ec_orders', {});
    const returnData = { pos: sales, ecommerce: orders };
    return returnData;
  },

  async getRevenueData() {
    const posSales = db.find('pos_sales', {});
    const ecommerceOrders = db.find('ec_orders', {});
    const agencyInvoices = db.find('agency_invoices', {});
    const invoices = db.find('invoices', {});
    
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(key);
    }
    
    const revenue = {};
    months.forEach(m => revenue[m] = { pos: 0, ecommerce: 0, agency: 0, hotel: 0 });
    
    posSales.forEach(s => {
      const key = s.billDate?.slice(0, 7);
      if (revenue[key]) revenue[key].pos += s.total || 0;
    });
    
    ecommerceOrders.forEach(o => {
      const key = o.createdAt?.slice(0, 7);
      if (revenue[key]) revenue[key].ecommerce += o.total || 0;
    });
    
    agencyInvoices.forEach(i => {
      if (i.status === 'paid') {
        const key = i.paidDate?.slice(0, 7);
        if (revenue[key]) revenue[key].agency += i.total || 0;
      }
    });
    
    invoices.forEach(i => {
      const key = i.createdAt?.slice(0, 7);
      if (revenue[key]) revenue[key].hotel += i.total || 0;
    });
    
    return { months, revenue, totalRevenue: posSales.reduce((s, i) => s + i.total, 0) + ecommerceOrders.reduce((s, i) => s + i.total, 0) };
  },

  async getHRData() {
    const employees = db.find('hr_employees', {});
    const attendance = db.find('hr_attendance', {});
    const leaves = db.find('hr_leaves', {});
    const payrolls = db.find('hr_payrolls', {});
    
    const today = new Date().toISOString().split('T')[0];
    const present = attendance.filter(a => a.date?.startsWith(today) && a.status === 'present').length;
    const onLeave = leaves.filter(l => l.status === 'approved' && l.startDate <= today && l.endDate >= today).length;
    const absent = attendance.filter(a => a.date?.startsWith(today) && a.status === 'absent').length;
    
    const departmentStats = {};
    employees.forEach(e => {
      departmentStats[e.departmentId] = (departmentStats[e.departmentId] || 0) + 1;
    });
    
    return {
      totalEmployees: employees.length,
      presentToday: present,
      onLeave,
      absent,
      departmentStats,
      leaveBalance: leaves.length,
      totalPayroll: payrolls.reduce((s, p) => s + p.netPay, 0),
    };
  },

  async getInventoryData() {
    const products = db.find('ec_products', {});
    const posProducts = db.find('pos_products', {});
    const inventory = db.find('erp_inventory', {});
    
    const lowStock = [...products.filter(p => p.stock < 10), ...posProducts.filter(p => p.stock < p.reorderLevel)];
    
    return {
      ecommerce: { total: products.length, outOfStock: products.filter(p => p.stock <= 0).length, lowStock: products.filter(p => p.stock > 0 && p.stock < 10).length },
      pos: { total: posProducts.length, lowStock: posProducts.filter(p => p.stock <= p.reorderLevel).length },
      erp: { total: inventory.length },
      lowStockItems: lowStock.slice(0, 10),
    };
  },

  async getMarketingData() {
    const campaigns = db.find('mkt_campaigns', {});
    const leads = db.find('crm_leads', {});
    const analytics = db.find('mkt_analytics', {});
    
    const channelStats = {};
    campaigns.forEach(c => {
      c.channels?.forEach(ch => channelStats[ch] = (channelStats[ch] || 0) + 1);
    });
    
    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'active').length,
      leadsGenerated: leads.length,
      channelStats,
      totalSpent: campaigns.reduce((s, c) => s + (c.spent || 0), 0),
    };
  },

  async getCRMData() {
    const contacts = db.find('crm_contacts', {});
    const leads = db.find('crm_leads', {});
    const deals = db.find('crm_deals', {});
    const tickets = db.find('crm_tickets', {});
    
    const pipelineValue = deals.reduce((s, d) => s + (d.value || 0), 0);
    const dealStages = {};
    deals.forEach(d => dealStages[d.stage] = (dealStages[d.stage] || 0) + 1);
    
    return {
      totalContacts: contacts.length,
      totalLeads: leads.length,
      qualifiedLeads: leads.filter(l => l.status === 'qualified').length,
      totalDeals: deals.length,
      pipelineValue,
      dealStages,
      openTickets: tickets.filter(t => t.status === 'open').length,
    };
  },

  async getTradingData() {
    const portfolios = db.find('portfolios', {});
    const trades = db.find('trades', {});
    const strategies = db.find('strategies', {});
    
    return {
      totalPortfolios: portfolios.length,
      totalTrades: trades.length,
      activeStrategies: strategies.filter(s => s.isActive).length,
      totalValue: portfolios.reduce((s, p) => s + (p.totalValue || 0), 0),
      totalPnL: portfolios.reduce((s, p) => s + (p.pnl || 0), 0),
    };
  },

  async getUniversityData() {
    const students = db.find('students', {});
    const courses = db.find('courses', {});
    const enrollments = db.find('enrollments', {});
    const faculty = db.find('faculty', {});
    
    return {
      totalStudents: students.length,
      activeStudents: students.filter(s => s.status === 'active').length,
      totalCourses: courses.length,
      totalEnrollments: enrollments.length,
      totalFaculty: faculty.length,
      coursesByDepartment: courses.reduce((s, c) => { s[c.program] = (s[c.program] || 0) + 1; return s; }, {}),
    };
  },

  async getGSTSummary() {
    const sales = db.find('pos_sales', {});
    const purchases = db.find('pos_purchases', {});
    
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthSales = sales.filter(s => s.billDate?.startsWith(thisMonth));
    
    const totalCGST = monthSales.reduce((s, i) => s + (i.cgstAmount || 0), 0);
    const totalSGST = monthSales.reduce((s, i) => s + (i.sgstAmount || 0), 0);
    const totalIGST = monthSales.reduce((s, i) => s + (i.igstAmount || 0), 0);
    const totalITC = purchases.reduce((s, p) => s + ((p.cgstAmount || 0) + (p.sgstAmount || 0) + (p.igstAmount || 0)), 0);
    
    return {
      period: thisMonth,
      outputGST: totalCGST + totalSGST + totalIGST,
      inputGST: totalITC,
      netGST: (totalCGST + totalSGST + totalIGST) - totalITC,
      byType: { cgst: totalCGST, sgst: totalSGST, igst: totalIGST },
    };
  },

  async getAggregatedDashboard() {
    return {
      pos: await this.getPOSData(),
      sales: await this.getSalesData(),
      revenue: await this.getRevenueData(),
      hr: await this.getHRData(),
      inventory: await this.getInventoryData(),
      marketing: await this.getMarketingData(),
      crm: await this.getCRMData(),
      trading: await this.getTradingData(),
      university: await this.getUniversityData(),
      gst: await this.getGSTSummary(),
    };
  },

  getSalesByDay(sales) {
    const days = {};
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days[key] = 0;
    }
    sales.forEach(s => {
      const key = s.billDate?.split('T')[0];
      if (days[key] !== undefined) days[key] += s.total || 0;
    });
    return days;
  },

  getTopProducts(sales) {
    const productSales = {};
    sales.forEach(s => {
      s.items?.forEach(item => {
        productSales[item.productId || item.name] = (productSales[item.productId || item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, quantity: qty }));
  },

  async exportToExcel(data) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    
    if (data.rows && data.rows.length > 0) {
      worksheet.addRows(data.rows);
    }
    
    return workbook;
  },

  async exportToCSV(data) {
    if (!data.rows || data.rows.length === 0) return '';
    const headers = Object.keys(data.rows[0]).join(',');
    const rows = data.rows.map(r => Object.values(r).join(','));
    return [headers, ...rows].join('\n');
  },
};

const ctrl = {
  getAggregatedDashboard: async (req, res) => {
    try {
      const data = await DashboardService.getAggregatedDashboard();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getSalesData: async (req, res) => {
    try {
      const data = await DashboardService.getSalesData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getRevenueData: async (req, res) => {
    try {
      const data = await DashboardService.getRevenueData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getInventoryData: async (req, res) => {
    try {
      const data = await DashboardService.getInventoryData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getHRData: async (req, res) => {
    try {
      const data = await DashboardService.getHRData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getMarketingData: async (req, res) => {
    try {
      const data = await DashboardService.getMarketingData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getCRMData: async (req, res) => {
    try {
      const data = await DashboardService.getCRMData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTradingData: async (req, res) => {
    try {
      const data = await DashboardService.getTradingData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPOSData: async (req, res) => {
    try {
      const data = await DashboardService.getPOSData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getUniversityData: async (req, res) => {
    try {
      const data = await DashboardService.getUniversityData();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getGSTSummary: async (req, res) => {
    try {
      const data = await DashboardService.getGSTSummary();
      res.json({ success: true, data });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  exportToExcel: async (req, res) => {
    try {
      const workbook = await DashboardService.exportToExcel(req.body);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=export.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  exportToCSV: async (req, res) => {
    try {
      const csv = await DashboardService.exportToCSV(req.body);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
      res.send(csv);
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPowerBIEmbedToken: async (req, res) => {
    res.json({ success: true, data: { token: 'mock-embed-token', status: 'Configure Power BI API in .env' } });
  },
};

module.exports = ctrl;