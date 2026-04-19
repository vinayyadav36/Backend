'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.use(protect);

router.get('/dashboard', ctrl.getDashboard);

router.get('/clients', ctrl.getClients);
router.get('/clients/:id', ctrl.getClient);
router.post('/clients', ctrl.createClient);
router.put('/clients/:id', ctrl.updateClient);
router.delete('/clients/:id', ctrl.deleteClient);

router.get('/projects', ctrl.getProjects);
router.get('/projects/:id', ctrl.getProject);
router.get('/projects/:id/tasks', ctrl.getProjectTasks);
router.post('/projects', ctrl.createProject);
router.put('/projects/:id', ctrl.updateProject);
router.delete('/projects/:id', ctrl.deleteProject);
router.post('/projects/:id/milestones', ctrl.addMilestone);
router.put('/projects/:id/milestones/:milestoneId', ctrl.updateMilestone);

router.get('/tasks', ctrl.getTasks);
router.get('/tasks/:id', ctrl.getTask);
router.post('/tasks', ctrl.createTask);
router.put('/tasks/:id', ctrl.updateTask);
router.delete('/tasks/:id', ctrl.deleteTask);
router.patch('/tasks/:id/status', ctrl.updateTaskStatus);

router.get('/team', ctrl.getTeam);
router.get('/team/:id', ctrl.getTeamMember);
router.post('/team', ctrl.addTeamMember);
router.put('/team/:id', ctrl.updateTeamMember);
router.delete('/team/:id', ctrl.removeTeamMember);

router.get('/invoices', ctrl.getInvoices);
router.get('/invoices/:id', ctrl.getInvoice);
router.post('/invoices', ctrl.createInvoice);
router.put('/invoices/:id', ctrl.updateInvoice);
router.patch('/invoices/:id/status', ctrl.updateInvoiceStatus);
router.get('/invoices/:id/send', ctrl.sendInvoice);

router.get('/services', ctrl.getServices);
router.post('/services', ctrl.createService);
router.put('/services/:id', ctrl.updateService);

router.get('/time-entries', ctrl.getTimeEntries);
router.post('/time-entries', ctrl.logTime);
router.put('/time-entries/:id', ctrl.updateTimeEntry);

router.get('/reports/revenue', ctrl.getRevenueReport);
router.get('/reports/utilization', ctrl.getUtilizationReport);
router.get('/reports/project-status', ctrl.getProjectStatusReport);

module.exports = router;