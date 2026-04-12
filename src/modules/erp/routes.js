'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.use(protect);

router.get('/inventory', ctrl.getInventory);
router.get('/inventory/reorder-alerts', ctrl.getReorderAlerts);
router.get('/inventory/:id', ctrl.getInventoryItem);
router.post('/inventory', ctrl.createInventoryItem);
router.put('/inventory/:id', ctrl.updateInventory);
router.delete('/inventory/:id', ctrl.deleteInventoryItem);

router.get('/purchase-orders', ctrl.getPurchaseOrders);
router.get('/purchase-orders/:id', ctrl.getPurchaseOrder);
router.post('/purchase-orders', ctrl.createPurchaseOrder);
router.patch('/purchase-orders/:id/status', ctrl.updatePOStatus);
router.patch('/purchase-orders/:id/approve', ctrl.approvePO);

router.get('/vendors', ctrl.getVendors);
router.get('/vendors/:id', ctrl.getVendor);
router.post('/vendors', ctrl.createVendor);
router.put('/vendors/:id', ctrl.updateVendor);

router.get('/assets', ctrl.getAssets);
router.get('/assets/:id', ctrl.getAsset);
router.get('/assets/:id/depreciation', ctrl.getAssetDepreciation);
router.post('/assets', ctrl.createAsset);
router.put('/assets/:id', ctrl.updateAsset);

router.get('/projects', ctrl.getProjects);
router.get('/projects/:id', ctrl.getProject);
router.get('/projects/:id/report', ctrl.getProjectReport);
router.post('/projects', ctrl.createProject);
router.put('/projects/:id', ctrl.updateProject);

router.get('/tasks', ctrl.getTasks);
router.get('/tasks/:id', ctrl.getTask);
router.post('/tasks', ctrl.createTask);
router.put('/tasks/:id', ctrl.updateTask);
router.patch('/tasks/:id/complete', ctrl.completeTask);

router.get('/timelogs', ctrl.getTimeLogs);
router.post('/timelogs', ctrl.logTime);
router.put('/timelogs/:id', ctrl.updateTimeLog);

router.get('/budgets', ctrl.getBudgets);
router.get('/budgets/report', ctrl.getBudgetReport);
router.post('/budgets', ctrl.createBudget);
router.put('/budgets/:id', ctrl.updateBudget);

router.get('/dashboard', ctrl.getERPDashboard);

module.exports = router;
