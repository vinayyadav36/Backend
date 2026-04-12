const { Lead, Deal, Campaign, SupportTicket } = require('./model');
const logger = require('../../config/logger');

const scoreLead = (lead) => {
  let score = 0;
  if (lead.email) score += 10;
  if (lead.phone) score += 10;
  if (lead.company) score += 15;
  if (lead.source === 'referral') score += 20;
  else if (lead.source === 'website') score += 10;
  if (lead.notes && lead.notes.length > 50) score += 5;
  return Math.min(score, 100);
};

const advanceStage = async (dealId, newStage) => {
  try {
    const stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const idx = stages.indexOf(newStage);
    const probability = idx >= 0 ? Math.round((idx / (stages.length - 1)) * 100) : 0;
    const deal = await Deal.findByIdAndUpdate(dealId, { stage: newStage, probability, updatedAt: new Date().toISOString() }, { new: true });
    return deal;
  } catch (err) {
    logger.error('advanceStage error:', err);
    return null;
  }
};

const calculateCampaignROI = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign || !campaign.spent) return { roi: 0, revenue: 0, cost: campaign ? campaign.spent : 0 };
    const revenue = campaign.conversions * 500;
    const roi = campaign.spent > 0 ? ((revenue - campaign.spent) / campaign.spent) * 100 : 0;
    return { roi: Math.round(roi * 100) / 100, revenue, cost: campaign.spent };
  } catch (err) {
    logger.error('calculateCampaignROI error:', err);
    return { roi: 0, revenue: 0, cost: 0 };
  }
};

const getSLAStatus = async (ticketId) => {
  try {
    const ticket = await SupportTicket.findById(ticketId).lean();
    if (!ticket) return { status: 'unknown' };
    if (ticket.status === 'resolved') return { status: 'resolved', resolvedAt: ticket.resolvedAt };
    const now = new Date();
    const deadline = ticket.slaDeadline ? new Date(ticket.slaDeadline) : null;
    if (!deadline) return { status: 'no_sla' };
    if (now > deadline) return { status: 'breached', overdue: Math.round((now - deadline) / 60000) + ' minutes' };
    return { status: 'on_track', remaining: Math.round((deadline - now) / 60000) + ' minutes' };
  } catch (err) {
    logger.error('getSLAStatus error:', err);
    return { status: 'error' };
  }
};

module.exports = { scoreLead, advanceStage, calculateCampaignROI, getSLAStatus };
