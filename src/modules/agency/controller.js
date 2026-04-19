'use strict';
const db = require('../../config/jsonDb');

const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `INV${year}${month}${random}`;
};

const ctrl = {
  getDashboard: async (req, res) => {
    try {
      const clients = db.find('agency_clients', {});
      const projects = db.find('agency_projects', {});
      const invoices = db.find('agency_invoices', {});
      const tasks = db.find('agency_tasks', {});
      
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const pendingInvoices = invoices.filter(i => i.status === 'pending').length;
      const revenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
      const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.total || 0), 0);
      
      const taskStats = { todo: 0, in_progress: 0, done: 0 };
      tasks.forEach(t => taskStats[t.status] = (taskStats[t.status] || 0) + 1);
      
      res.json({ success: true, data: {
        totalClients: clients.length,
        activeProjects,
        totalProjects: projects.length,
        pendingInvoices,
        revenue,
        pendingRevenue,
        taskStats,
        recentProjects: projects.slice(-5).reverse(),
      }});
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getClients: async (req, res) => {
    try {
      const clients = db.find('agency_clients', {});
      res.json({ success: true, data: clients });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getClient: async (req, res) => {
    try {
      const client = db.findById('agency_clients', req.params.id);
      if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
      res.json({ success: true, data: client });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createClient: async (req, res) => {
    try {
      const client = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.insert('agency_clients', client);
      res.status(201).json({ success: true, data: client });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateClient: async (req, res) => {
    try {
      await db.update('agency_clients', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('agency_clients', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteClient: async (req, res) => {
    try {
      await db.removeById('agency_clients', req.params.id);
      res.json({ success: true, message: 'Client deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProjects: async (req, res) => {
    try {
      const { status, clientId } = req.query;
      let projects = db.find('agency_projects', {});
      if (status) projects = projects.filter(p => p.status === status);
      if (clientId) projects = projects.filter(p => p.clientId === clientId);
      res.json({ success: true, data: projects.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProject: async (req, res) => {
    try {
      const project = db.findById('agency_projects', req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      res.json({ success: true, data: project });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProjectTasks: async (req, res) => {
    try {
      const tasks = db.find('agency_tasks', { projectId: req.params.id });
      res.json({ success: true, data: tasks });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createProject: async (req, res) => {
    try {
      const project = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.insert('agency_projects', project);
      res.status(201).json({ success: true, data: project });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateProject: async (req, res) => {
    try {
      await db.update('agency_projects', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('agency_projects', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteProject: async (req, res) => {
    try {
      await db.removeById('agency_projects', req.params.id);
      res.json({ success: true, message: 'Project deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  addMilestone: async (req, res) => {
    try {
      const project = db.findById('agency_projects', req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      const milestone = { _id: db.generateId(), ...req.body };
      const milestones = [...(project.milestones || []), milestone];
      await db.update('agency_projects', { _id: req.params.id }, { $set: { milestones, updatedAt: new Date().toISOString() } });
      res.status(201).json({ success: true, data: milestone });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateMilestone: async (req, res) => {
    try {
      const project = db.findById('agency_projects', req.params.id);
      if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
      const milestones = (project.milestones || []).map(m => m._id === req.params.milestoneId ? { ...m, ...req.body } : m);
      await db.update('agency_projects', { _id: req.params.id }, { $set: { milestones, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: milestones });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTasks: async (req, res) => {
    try {
      const { projectId, status, assigneeId } = req.query;
      let tasks = db.find('agency_tasks', {});
      if (projectId) tasks = tasks.filter(t => t.projectId === projectId);
      if (status) tasks = tasks.filter(t => t.status === status);
      if (assigneeId) tasks = tasks.filter(t => t.assigneeId === assigneeId);
      res.json({ success: true, data: tasks });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTask: async (req, res) => {
    try {
      const task = db.findById('agency_tasks', req.params.id);
      if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
      res.json({ success: true, data: task });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createTask: async (req, res) => {
    try {
      const task = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.insert('agency_tasks', task);
      res.status(201).json({ success: true, data: task });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTask: async (req, res) => {
    try {
      await db.update('agency_tasks', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('agency_tasks', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteTask: async (req, res) => {
    try {
      await db.removeById('agency_tasks', req.params.id);
      res.json({ success: true, message: 'Task deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTaskStatus: async (req, res) => {
    try {
      await db.update('agency_tasks', { _id: req.params.id }, { $set: { status: req.body.status, updatedAt: new Date().toISOString() } });
      res.json({ success: true, message: 'Task status updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTeam: async (req, res) => {
    try {
      const team = db.find('agency_team', { isActive: true });
      res.json({ success: true, data: team });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTeamMember: async (req, res) => {
    try {
      const member = db.findById('agency_team', req.params.id);
      if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
      res.json({ success: true, data: member });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  addTeamMember: async (req, res) => {
    try {
      const member = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('agency_team', member);
      res.status(201).json({ success: true, data: member });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTeamMember: async (req, res) => {
    try {
      await db.update('agency_team', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('agency_team', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  removeTeamMember: async (req, res) => {
    try {
      await db.update('agency_team', { _id: req.params.id }, { $set: { isActive: false } });
      res.json({ success: true, message: 'Team member removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getInvoices: async (req, res) => {
    try {
      const { status, clientId } = req.query;
      let invoices = db.find('agency_invoices', {});
      if (status) invoices = invoices.filter(i => i.status === status);
      if (clientId) invoices = invoices.filter(i => i.clientId === clientId);
      res.json({ success: true, data: invoices.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getInvoice: async (req, res) => {
    try {
      const invoice = db.findById('agency_invoices', req.params.id);
      if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
      res.json({ success: true, data: invoice });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createInvoice: async (req, res) => {
    try {
      const invoice = { _id: db.generateId(), invoiceNumber: generateInvoiceNumber(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('agency_invoices', invoice);
      res.status(201).json({ success: true, data: invoice });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateInvoice: async (req, res) => {
    try {
      await db.update('agency_invoices', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('agency_invoices', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateInvoiceStatus: async (req, res) => {
    try {
      const update = { status: req.body.status };
      if (req.body.status === 'paid') update.paidDate = new Date().toISOString();
      await db.update('agency_invoices', { _id: req.params.id }, { $set: update });
      res.json({ success: true, message: 'Invoice status updated' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  sendInvoice: async (req, res) => {
    res.json({ success: true, message: 'Invoice email sent (mock)' });
  },

  getServices: async (req, res) => {
    try {
      const services = db.find('agency_services', { isActive: true });
      res.json({ success: true, data: services });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createService: async (req, res) => {
    try {
      const service = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('agency_services', service);
      res.status(201).json({ success: true, data: service });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateService: async (req, res) => {
    try {
      await db.update('agency_services', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('agency_services', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTimeEntries: async (req, res) => {
    try {
      const { projectId, userId, startDate, endDate } = req.query;
      let entries = db.find('agency_time_entries', {});
      if (projectId) entries = entries.filter(e => e.projectId === projectId);
      if (userId) entries = entries.filter(e => e.userId === userId);
      res.json({ success: true, data: entries });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  logTime: async (req, res) => {
    try {
      const entry = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('agency_time_entries', entry);
      res.status(201).json({ success: true, data: entry });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateTimeEntry: async (req, res) => {
    try {
      await db.update('agency_time_entries', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('agency_time_entries', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getRevenueReport: async (req, res) => {
    try {
      const invoices = db.find('agency_invoices', {});
      const now = new Date();
      const monthly = {};
      
      invoices.forEach(inv => {
        const date = new Date(inv.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthly[key]) monthly[key] = { revenue: 0, pending: 0, count: 0 };
        if (inv.status === 'paid') monthly[key].revenue += inv.total || 0;
        if (inv.status === 'pending') monthly[key].pending += inv.total || 0;
        monthly[key].count++;
      });
      
      res.json({ success: true, data: { monthly, total: invoices.reduce((s, i) => s + (i.total || 0), 0) }});
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getUtilizationReport: async (req, res) => {
    try {
      const team = db.find('agency_team', { isActive: true });
      const entries = db.find('agency_time_entries', {});
      const report = team.map(member => {
        const memberEntries = entries.filter(e => e.userId === member._id);
        return {
          member,
          totalHours: memberEntries.reduce((s, e) => s + (e.hours || 0), 0),
          billableHours: memberEntries.filter(e => e.billable).reduce((s, e) => s + (e.hours || 0), 0),
          utilization: member.availability > 0 ? ((memberEntries.reduce((s, e) => s + (e.hours || 0), 0) / member.availability) * 100).toFixed(1) : 0
        };
      });
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getProjectStatusReport: async (req, res) => {
    try {
      const projects = db.find('agency_projects', {});
      const tasks = db.find('agency_tasks', {});
      const report = projects.map(p => {
        const projectTasks = tasks.filter(t => t.projectId === p._id);
        return {
          project: p,
          totalTasks: projectTasks.length,
          completed: projectTasks.filter(t => t.status === 'done').length,
          inProgress: projectTasks.filter(t => t.status === 'in_progress').length,
          progress: projectTasks.length > 0 ? Math.round((projectTasks.filter(t => t.status === 'done').length / projectTasks.length) * 100) : 0
        };
      });
      res.json({ success: true, data: report });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },
};

module.exports = ctrl;