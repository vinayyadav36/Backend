'use strict';
const getCTR = (impressions, clicks) => impressions > 0 ? ((clicks / impressions) * 100).toFixed(2) : 0;
const getConversionRate = (clicks, conversions) => clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : 0;
const calculateCampaignROI = (spent, revenue) => spent > 0 ? (((revenue - spent) / spent) * 100).toFixed(2) : 0;
module.exports = { getCTR, getConversionRate, calculateCampaignROI };
