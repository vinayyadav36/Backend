'use strict';
const { MktClient, MktCampaign, Content, SocialPost, SEO, Analytics, MktInvoice } = require('./model');
const logger = require('../../config/logger');

const getClients = async (req, res) => { try { const data = await MktClient.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getClient = async (req, res) => { try { const data = await MktClient.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createClient = async (req, res) => { try { const data = await MktClient.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateClient = async (req, res) => { try { const data = await MktClient.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getCampaigns = async (req, res) => { try { const data = await MktCampaign.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getCampaign = async (req, res) => { try { const data = await MktCampaign.findById(req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Not found' }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createCampaign = async (req, res) => { try { const data = await MktCampaign.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateCampaign = async (req, res) => { try { const data = await MktCampaign.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getCampaignPerformance = async (req, res) => { try { const campaign = await MktCampaign.findById(req.params.id); const analytics = await Analytics.find({ campaignId: req.params.id }).lean(); res.json({ success: true, data: { campaign, analytics } }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getContent = async (req, res) => { try { const data = await Content.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createContent = async (req, res) => { try { const data = await Content.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateContent = async (req, res) => { try { const data = await Content.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const publishContent = async (req, res) => { try { const data = await Content.findByIdAndUpdate(req.params.id, { status: 'published', publishDate: new Date(), updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getSocialPosts = async (req, res) => { try { const data = await SocialPost.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createSocialPost = async (req, res) => { try { const data = await SocialPost.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const schedulePost = async (req, res) => { try { const data = await SocialPost.findByIdAndUpdate(req.params.id, { scheduledAt: req.body.scheduledAt, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const publishPost = async (req, res) => { try { const data = await SocialPost.findByIdAndUpdate(req.params.id, { published: true, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getSEOReports = async (req, res) => { try { const data = await SEO.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createSEOReport = async (req, res) => { try { const data = await SEO.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateSEOReport = async (req, res) => { try { const data = await SEO.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getAnalytics = async (req, res) => { try { const data = await Analytics.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createAnalytics = async (req, res) => { try { const data = await Analytics.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const getAggregatedAnalytics = async (req, res) => { try { const data = await Analytics.find({}).lean(); const totals = data.reduce((a, r) => { a.impressions += r.impressions || 0; a.clicks += r.clicks || 0; a.conversions += r.conversions || 0; return a; }, { impressions: 0, clicks: 0, conversions: 0 }); res.json({ success: true, data: totals }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getInvoices = async (req, res) => { try { const data = await MktInvoice.find({}).lean(); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const createInvoice = async (req, res) => { try { const data = await MktInvoice.create({ ...req.body, createdAt: new Date(), updatedAt: new Date() }); res.status(201).json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };
const updateInvoice = async (req, res) => { try { const data = await MktInvoice.findByIdAndUpdate(req.params.id, { ...req.body, updatedAt: new Date() }, { new: true }); res.json({ success: true, data }); } catch (e) { res.status(500).json({ success: false, message: e.message }); } };

const getMarketingDashboard = async (req, res) => {
  try {
    const [clients, campaigns, content, analytics] = await Promise.all([MktClient.find({}).lean(), MktCampaign.find({}).lean(), Content.find({}).lean(), Analytics.find({}).lean()]);
    const totalImpressions = analytics.reduce((s, a) => s + (a.impressions || 0), 0);
    const totalClicks = analytics.reduce((s, a) => s + (a.clicks || 0), 0);
    res.json({ success: true, data: { clientCount: clients.length, activeCampaigns: campaigns.filter(c => c.status === 'active').length, publishedContent: content.filter(c => c.status === 'published').length, totalImpressions, totalClicks, ctr: totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0 } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

module.exports = { getClients, getClient, createClient, updateClient, getCampaigns, getCampaign, createCampaign, updateCampaign, getCampaignPerformance, getContent, createContent, updateContent, publishContent, getSocialPosts, createSocialPost, schedulePost, publishPost, getSEOReports, createSEOReport, updateSEOReport, getAnalytics, createAnalytics, getAggregatedAnalytics, getInvoices, createInvoice, updateInvoice, getMarketingDashboard };
