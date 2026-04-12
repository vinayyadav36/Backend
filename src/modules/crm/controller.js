const { Contact, Lead, Deal, Activity, Pipeline, Campaign, SupportTicket } = require('./model');
const { scoreLead: svcScoreLead, advanceStage, calculateCampaignROI, getSLAStatus } = require('./service');
const logger = require('../../config/logger');

const mk = (Model) => ({
  getAll: async (req, res) => {
    try { res.json({ success: true, data: await Model.find({}).lean() }); }
    catch (err) { logger.error('getAll:', err); res.status(500).json({ success: false, message: err.message }); }
  },
  getOne: async (req, res) => {
    try {
      const item = await Model.findById(req.params.id).lean();
      if (!item) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: item });
    } catch (err) { logger.error('getOne:', err); res.status(500).json({ success: false, message: err.message }); }
  },
  create: async (req, res) => {
    try {
      const now = new Date().toISOString();
      res.status(201).json({ success: true, data: await Model.create({ ...req.body, createdAt: now, updatedAt: now }) });
    } catch (err) { logger.error('create:', err); res.status(500).json({ success: false, message: err.message }); }
  },
  update: async (req, res) => {
    try {
      const item = await Model.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date().toISOString() }, { new: true });
      if (!item) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: item });
    } catch (err) { logger.error('update:', err); res.status(500).json({ success: false, message: err.message }); }
  },
  del: async (req, res) => {
    try {
      const item = await Model.findByIdAndDelete(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, message: 'Deleted' });
    } catch (err) { logger.error('delete:', err); res.status(500).json({ success: false, message: err.message }); }
  },
});

const contactCtrl = mk(Contact);
const getContacts = contactCtrl.getAll;
const getContact = contactCtrl.getOne;
const createContact = contactCtrl.create;
const updateContact = contactCtrl.update;
const deleteContact = contactCtrl.del;
const importContacts = async (req, res) => {
  try {
    const now = new Date().toISOString();
    const contacts = (req.body.contacts || []).map(c => ({ ...c, createdAt: now, updatedAt: now }));
    const inserted = await Contact.insertMany(contacts);
    res.status(201).json({ success: true, data: inserted, count: inserted.length });
  } catch (err) { logger.error('importContacts:', err); res.status(500).json({ success: false, message: err.message }); }
};

const leadCtrl = mk(Lead);
const getLeads = leadCtrl.getAll;
const getLead = leadCtrl.getOne;
const createLead = leadCtrl.create;
const updateLead = leadCtrl.update;
const convertLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, { status: 'converted', updatedAt: new Date().toISOString() }, { new: true });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (err) { logger.error('convertLead:', err); res.status(500).json({ success: false, message: err.message }); }
};
const scoreLeadCtrl = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    const score = svcScoreLead(lead);
    await Lead.findByIdAndUpdate(req.params.id, { score, updatedAt: new Date().toISOString() }, { new: true });
    res.json({ success: true, data: { score } });
  } catch (err) { logger.error('scoreLead:', err); res.status(500).json({ success: false, message: err.message }); }
};

const dealCtrl = mk(Deal);
const getDeals = dealCtrl.getAll;
const getDeal = dealCtrl.getOne;
const createDeal = dealCtrl.create;
const updateDeal = dealCtrl.update;
const deleteDeal = dealCtrl.del;
const getDealsByStage = async (req, res) => {
  try {
    const deals = await Deal.find({}).lean();
    const byStage = deals.reduce((acc, d) => { (acc[d.stage] = acc[d.stage] || []).push(d); return acc; }, {});
    res.json({ success: true, data: byStage });
  } catch (err) { logger.error('getDealsByStage:', err); res.status(500).json({ success: false, message: err.message }); }
};

const actCtrl = mk(Activity);
const getActivities = actCtrl.getAll;
const createActivity = actCtrl.create;
const updateActivity = actCtrl.update;
const completeActivity = async (req, res) => {
  try {
    const act = await Activity.findByIdAndUpdate(req.params.id, { completed: true, updatedAt: new Date().toISOString() }, { new: true });
    if (!act) return res.status(404).json({ success: false, message: 'Activity not found' });
    res.json({ success: true, data: act });
  } catch (err) { logger.error('completeActivity:', err); res.status(500).json({ success: false, message: err.message }); }
};

const pipCtrl = mk(Pipeline);
const getPipelines = pipCtrl.getAll;
const createPipeline = pipCtrl.create;
const updatePipeline = pipCtrl.update;

const campCtrl = mk(Campaign);
const getCampaigns = campCtrl.getAll;
const getCampaign = campCtrl.getOne;
const createCampaign = campCtrl.create;
const updateCampaign = campCtrl.update;
const getCampaignAnalytics = async (req, res) => {
  try {
    const roi = await calculateCampaignROI(req.params.id);
    res.json({ success: true, data: roi });
  } catch (err) { logger.error('getCampaignAnalytics:', err); res.status(500).json({ success: false, message: err.message }); }
};

const tickCtrl = mk(SupportTicket);
const getTickets = tickCtrl.getAll;
const getTicket = tickCtrl.getOne;
const createTicket = tickCtrl.create;
const updateTicket = tickCtrl.update;
const resolveTicket = async (req, res) => {
  try {
    const t = await SupportTicket.findByIdAndUpdate(req.params.id, { status: 'resolved', resolvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { new: true });
    if (!t) return res.status(404).json({ success: false, message: 'Ticket not found' });
    res.json({ success: true, data: t });
  } catch (err) { logger.error('resolveTicket:', err); res.status(500).json({ success: false, message: err.message }); }
};

const getCRMDashboard = async (req, res) => {
  try {
    const [contacts, leads, deals, tickets] = await Promise.all([
      Contact.countDocuments({}), Lead.countDocuments({}), Deal.countDocuments({}), SupportTicket.countDocuments({})
    ]);
    const allDeals = await Deal.find({}).lean();
    const pipeline = allDeals.reduce((s, d) => s + (d.value || 0), 0);
    res.json({ success: true, data: { totalContacts: contacts, totalLeads: leads, totalDeals: deals, openTickets: tickets, pipelineValue: pipeline } });
  } catch (err) { logger.error('getCRMDashboard:', err); res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getContacts, getContact, createContact, updateContact, deleteContact, importContacts,
  getLeads, getLead, createLead, updateLead, convertLead, scoreLead: scoreLeadCtrl,
  getDeals, getDeal, createDeal, updateDeal, deleteDeal, getDealsByStage,
  getActivities, createActivity, updateActivity, completeActivity,
  getPipelines, createPipeline, updatePipeline,
  getCampaigns, getCampaign, createCampaign, updateCampaign, getCampaignAnalytics,
  getTickets, getTicket, createTicket, updateTicket, resolveTicket,
  getCRMDashboard,
};
