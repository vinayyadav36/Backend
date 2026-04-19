'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const AgencyClient = createJsonModel('agency_clients', 'AgencyClient', {
  name: { type: 'string', required: true },
  company: { type: 'string' },
  email: { type: 'string' },
  phone: { type: 'string' },
  industry: { type: 'string' },
  budget: { type: 'number', default: 0 },
  status: { type: 'string', default: 'lead' },
  source: { type: 'string' },
  assignedTo: { type: 'string' },
  notes: { type: 'string' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const AgencyProject = createJsonModel('agency_projects', 'AgencyProject', {
  title: { type: 'string', required: true },
  clientId: { type: 'string', required: true },
  type: { type: 'string', required: true },
  description: { type: 'string' },
  status: { type: 'string', default: 'planning' },
  startDate: { type: 'date' },
  deadline: { type: 'date' },
  budget: { type: 'number', default: 0 },
  cost: { type: 'number', default: 0 },
  team: { type: 'array', default: [] },
  milestones: { type: 'array', default: [] },
  deliverables: { type: 'array', default: [] },
  attachments: { type: 'array', default: [] },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const AgencyTask = createJsonModel('agency_tasks', 'AgencyTask', {
  projectId: { type: 'string', required: true },
  title: { type: 'string', required: true },
  description: { type: 'string' },
  assigneeId: { type: 'string' },
  priority: { type: 'string', default: 'medium' },
  status: { type: 'string', default: 'todo' },
  dueDate: { type: 'date' },
  estimatedHours: { type: 'number', default: 0 },
  actualHours: { type: 'number', default: 0 },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
});

const AgencyTeam = createJsonModel('agency_team', 'AgencyTeam', {
  name: { type: 'string', required: true },
  role: { type: 'string', required: true },
  email: { type: 'string' },
  phone: { type: 'string' },
  avatar: { type: 'string' },
  skills: { type: 'array', default: [] },
  hourlyRate: { type: 'number', default: 0 },
  availability: { type: 'number', default: 40 },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
});

const AgencyInvoice = createJsonModel('agency_invoices', 'AgencyInvoice', {
  invoiceNumber: { type: 'string', required: true },
  clientId: { type: 'string', required: true },
  projectId: { type: 'string' },
  items: { type: 'array', required: true },
  subtotal: { type: 'number', required: true },
  tax: { type: 'number', default: 0 },
  total: { type: 'number', required: true },
  status: { type: 'string', default: 'draft' },
  issuedDate: { type: 'date' },
  dueDate: { type: 'date' },
  paidDate: { type: 'date' },
  notes: { type: 'string' },
  createdAt: { type: 'date' },
});

const AgencyService = createJsonModel('agency_services', 'AgencyService', {
  name: { type: 'string', required: true },
  description: { type: 'string' },
  category: { type: 'string' },
  price: { type: 'number', default: 0 },
  unit: { type: 'string', default: 'project' },
  features: { type: 'array', default: [] },
  isActive: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
});

const AgencyTimeEntry = createJsonModel('agency_time_entries', 'AgencyTimeEntry', {
  projectId: { type: 'string', required: true },
  taskId: { type: 'string' },
  userId: { type: 'string', required: true },
  description: { type: 'string' },
  hours: { type: 'number', required: true },
  date: { type: 'date', required: true },
  billable: { type: 'boolean', default: true },
  createdAt: { type: 'date' },
});

const AgencyReport = createJsonModel('agency_reports', 'AgencyReport', {
  type: { type: 'string', required: true },
  period: { type: 'object' },
  data: { type: 'object' },
  generatedAt: { type: 'date' },
});

module.exports = {
  AgencyClient,
  AgencyProject,
  AgencyTask,
  AgencyTeam,
  AgencyInvoice,
  AgencyService,
  AgencyTimeEntry,
  AgencyReport,
};