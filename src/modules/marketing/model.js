'use strict';
const { createJsonModel } = require('../../models/JsonModel');

const MktClient = createJsonModel('mkt_clients', 'MktClient', { name: '', industry: '', budget: 0, projects: [], contacts: [], createdAt: null, updatedAt: null });
const MktCampaign = createJsonModel('mkt_campaigns', 'MktCampaign', { name: '', clientId: '', type: '', channels: [], budget: 0, spent: 0, kpis: {}, status: 'draft', createdAt: null, updatedAt: null });
const Content = createJsonModel('mkt_content', 'Content', { title: '', type: '', clientId: '', status: 'draft', publishDate: null, performance: {}, createdAt: null, updatedAt: null });
const SocialPost = createJsonModel('mkt_social_posts', 'SocialPost', { platform: '', content: '', scheduledAt: null, published: false, metrics: {}, createdAt: null, updatedAt: null });
const SEO = createJsonModel('mkt_seo', 'SEO', { url: '', keywords: [], rankings: {}, traffic: 0, backlinks: 0, score: 0, createdAt: null, updatedAt: null });
const Analytics = createJsonModel('mkt_analytics', 'Analytics', { campaignId: '', impressions: 0, clicks: 0, conversions: 0, ctr: 0, roas: 0, date: null, createdAt: null, updatedAt: null });
const MktInvoice = createJsonModel('mkt_invoices', 'MktInvoice', { clientId: '', campaignId: '', amount: 0, services: [], status: 'pending', createdAt: null, updatedAt: null });

module.exports = { MktClient, MktCampaign, Content, SocialPost, SEO, Analytics, MktInvoice };
