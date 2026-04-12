'use strict';
const { InventoryItem, PurchaseOrder, ERPVendor, Asset, ERPProject, Task, TimeLog, Budget } = require('./model');
const { checkReorderAlerts, calculateDepreciation, generatePONumber } = require('./service');
const logger = require('../../config/logger');

const getInventory = async (req, res) => { try { const data = await InventoryItem.find({}).lean(); res.json({ success: true, data }); } catch (e) { logger.error(e); res.status(500).json({ success: false, message: e.message }); } };
const getInventoryItem = async (req, res) => { try { const data = await InventoryItem.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createInventoryItem = async (req, res) => { try { const data = await InventoryItem.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateInventory = async (req, res) => { try { const data = await InventoryItem.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const deleteInventoryItem = async (req, res) => { try { await InventoryItem.findByIdAndDelete(req.params.id); res.json({ success: true, message: 'Deleted' }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getReorderAlerts = async (req, res) => { try { const data = await checkReorderAlerts(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getPurchaseOrders = async (req, res) => { try { const data = await PurchaseOrder.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getPurchaseOrder = async (req, res) => { try { const data = await PurchaseOrder.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createPurchaseOrder = async (req, res) => { try { const data = await PurchaseOrder.create({ ...req.body, poNumber: generatePONumber(), createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updatePOStatus = async (req, res) => { try { const data = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const approvePO = async (req, res) => { try { const data = await PurchaseOrder.findByIdAndUpdate(req.params.id, { status: 'approved', updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getVendors = async (req, res) => { try { const data = await ERPVendor.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getVendor = async (req, res) => { try { const data = await ERPVendor.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createVendor = async (req, res) => { try { const data = await ERPVendor.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateVendor = async (req, res) => { try { const data = await ERPVendor.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getAssets = async (req, res) => { try { const data = await Asset.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getAsset = async (req, res) => { try { const data = await Asset.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createAsset = async (req, res) => { try { const data = await Asset.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateAsset = async (req, res) => { try { const data = await Asset.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getAssetDepreciation = async (req, res) => { try { const asset = await Asset.findById(req.params.id); if (!asset) return res.status(404).json({ success: false, message: 'Not found' }); const dep = calculateDepreciation(asset); res.json({ success: true, data: { asset, depreciation: dep } }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getProjects = async (req, res) => { try { const data = await ERPProject.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getProject = async (req, res) => { try { const data = await ERPProject.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createProject = async (req, res) => { try { const data = await ERPProject.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateProject = async (req, res) => { try { const data = await ERPProject.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getProjectReport = async (req, res) => { try { const project = await ERPProject.findById(req.params.id); if (!project) return res.status(404).json({ success: false, message: 'Not found' }); const tasks = await Task.find({ projectId: req.params.id }).lean(); const logs = await TimeLog.find({ projectId: req.params.id }).lean(); res.json({ success: true, data: { project, tasks, timeLogs: logs, burnRate: project.spent / (project.budget || 1) } }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getTasks = async (req, res) => { try { const data = await Task.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getTask = async (req, res) => { try { const data = await Task.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createTask = async (req, res) => { try { const data = await Task.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateTask = async (req, res) => { try { const data = await Task.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const completeTask = async (req, res) => { try { const data = await Task.findByIdAndUpdate(req.params.id, { status: 'completed', updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getTimeLogs = async (req, res) => { try { const data = await TimeLog.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const logTime = async (req, res) => { try { const data = await TimeLog.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateTimeLog = async (req, res) => { try { const data = await TimeLog.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getBudgets = async (req, res) => { try { const data = await Budget.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createBudget = async (req, res) => { try { const data = await Budget.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateBudget = async (req, res) => { try { const data = await Budget.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getBudgetReport = async (req, res) => { try { const data = await Budget.find({}).lean(); const summary = data.reduce((acc, b) => { acc.totalAllocated += b.allocated || 0; acc.totalSpent += b.spent || 0; return acc; }, { totalAllocated: 0, totalSpent: 0 }); res.json({ success: true, data: { budgets: data, summary } }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getERPDashboard = async (req, res) => {
  try {
    const [inventory, orders, assets, projects, reorderAlerts] = await Promise.all([
      InventoryItem.find({}).lean(), PurchaseOrder.find({}).lean(), Asset.find({}).lean(),
      ERPProject.find({}).lean(), checkReorderAlerts()
    ]);
    res.json({ success: true, data: { inventoryCount: inventory.length, pendingOrders: orders.filter(o => o.status === 'pending').length, totalAssets: assets.length, activeProjects: projects.filter(p => p.status === 'active').length, reorderAlerts: reorderAlerts.length } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getInventory, getInventoryItem, createInventoryItem, updateInventory, deleteInventoryItem, getReorderAlerts, getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePOStatus, approvePO, getVendors, getVendor, createVendor, updateVendor, getAssets, getAsset, createAsset, updateAsset, getAssetDepreciation, getProjects, getProject, createProject, updateProject, getProjectReport, getTasks, getTask, createTask, updateTask, completeTask, getTimeLogs, logTime, updateTimeLog, getBudgets, createBudget, updateBudget, getBudgetReport, getERPDashboard };
