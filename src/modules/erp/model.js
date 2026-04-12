'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const InventoryItem = createJsonModel('erp_inventory', 'InventoryItem', { sku: '', name: '', quantity: 0, reorderLevel: 0, unitCost: 0, supplier: '', location: '', createdAt: null, updatedAt: null });
const PurchaseOrder = createJsonModel('erp_purchase_orders', 'PurchaseOrder', { poNumber: '', vendorId: '', items: [], total: 0, status: 'draft', deliveryDate: null, paymentTerms: '', createdAt: null, updatedAt: null });
const ERPVendor = createJsonModel('erp_vendors', 'ERPVendor', { name: '', email: '', phone: '', address: '', paymentTerms: '', rating: 0, categories: [], createdAt: null, updatedAt: null });
const Asset = createJsonModel('erp_assets', 'Asset', { name: '', category: '', purchaseDate: null, value: 0, depreciation: 0, location: '', status: 'active', createdAt: null, updatedAt: null });
const ERPProject = createJsonModel('erp_projects', 'ERPProject', { name: '', client: '', budget: 0, spent: 0, timeline: {}, status: 'planning', milestones: [], team: [], createdAt: null, updatedAt: null });
const Task = createJsonModel('erp_tasks', 'Task', { projectId: '', title: '', assignee: '', dueDate: null, priority: 'medium', status: 'open', timeSpent: 0, createdAt: null, updatedAt: null });
const TimeLog = createJsonModel('erp_timelogs', 'TimeLog', { empId: '', projectId: '', taskId: '', date: null, hours: 0, billable: false, description: '', createdAt: null, updatedAt: null });
const Budget = createJsonModel('erp_budgets', 'Budget', { department: '', fiscal_year: '', allocated: 0, spent: 0, committed: 0, remaining: 0, createdAt: null, updatedAt: null });

module.exports = { InventoryItem, PurchaseOrder, ERPVendor, Asset, ERPProject, Task, TimeLog, Budget };
