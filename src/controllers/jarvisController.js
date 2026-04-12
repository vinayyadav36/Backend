/**
 * JARVIS Controller
 * AI-powered insights, forecasting, anomaly detection, and pricing.
 * Uses the in-process aiService (no external APIs).
 * @version 2.0.0
 */

'use strict';

const aiService = require('../services/aiService');
const logger    = require('../config/logger');

// ─── forecast ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/jarvis/forecast
 * Revenue forecast via linear regression + seasonal adjustment.
 * Body: { data: [{date, revenue}], horizon?: number }
 */
const forecast = async (req, res) => {
  try {
    const { data, horizon = 30 } = req.body;

    if (!Array.isArray(data) || data.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least 2 historical data points ({ date, revenue }).',
      });
    }

    const result = aiService.predictRevenue(data, parseInt(horizon, 10) || 30);

    logger.info(`JARVIS forecast: ${data.length} points → ${result.length} predictions`);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('JARVIS forecast error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── detectAnomaly ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/jarvis/anomaly
 * Z-score based anomaly detection on transactions.
 * Body: { data: [{amount, date?, description?}], contamination? }
 */
const detectAnomaly = async (req, res) => {
  try {
    const { data, contamination = 0.01 } = req.body;

    if (!Array.isArray(data) || data.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least 5 transaction records ({ amount }).',
      });
    }

    const result = aiService.detectAnomalies(data);

    // Apply contamination threshold as secondary filter if requested
    const threshold = parseFloat(contamination) || 0.01;
    const sorted = [...result].sort((a, b) => b.anomalyScore - a.anomalyScore);
    const topN   = Math.max(1, Math.ceil(data.length * threshold));
    const flagged = sorted.slice(0, topN).filter(r => r.isAnomaly);

    logger.info(`JARVIS anomaly: ${data.length} transactions, ${flagged.length} anomalies`);
    res.json({
      success: true,
      data: {
        results:  result,
        flagged,
        total:    data.length,
        anomalyCount: result.filter(r => r.isAnomaly).length,
      },
    });
  } catch (err) {
    logger.error('JARVIS anomaly error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getInsights ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/jarvis/insights
 * Returns AI-powered dashboard insights.
 */
const getInsights = async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');
    const Booking = require('../models/Booking');
    const Room    = require('../models/Room');

    const cutoff30 = new Date(Date.now() - 30 * 86400000);
    const cutoff60 = new Date(Date.now() - 60 * 86400000);

    let recentRevData  = [];
    let occupancyData  = [];
    let totalRooms     = 0;

    try {
      if (process.env.USE_JSON_DB === 'true') {
        const invoices = await Invoice.find({});
        const rooms    = await Room.find({});
        const bookings = await Booking.find({});

        totalRooms = rooms.filter(r => r.isActive !== false).length;

        // Daily revenue last 60 days
        const revMap = {};
        invoices
          .filter(i => i.status === 'paid' && new Date(i.createdAt) >= cutoff60)
          .forEach(i => {
            const d = new Date(i.createdAt).toISOString().split('T')[0];
            revMap[d] = (revMap[d] || 0) + Number(i.totalAmount || 0);
          });
        recentRevData = Object.entries(revMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, revenue]) => ({ date, revenue }));

        // Daily occupancy last 30 days
        for (let d = 0; d < 30; d++) {
          const day = new Date(cutoff30.getTime() + d * 86400000);
          const dayStr = day.toISOString().split('T')[0];
          const occupied = bookings.filter(b => {
            const ci = new Date(b.checkInDate);
            const co = new Date(b.checkOutDate);
            return day >= ci && day < co && ['confirmed','checked-in','checked-out'].includes(b.status);
          }).length;
          occupancyData.push({ date: dayStr, occupancy: totalRooms > 0 ? Math.min(100, Math.round(occupied / totalRooms * 100)) : 0 });
        }
      } else {
        const [revAgg, totalR, bookings] = await Promise.all([
          Invoice.aggregate([
            { $match: { status: 'paid', createdAt: { $gte: cutoff60 } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, revenue: { $sum: '$totalAmount' } } },
            { $sort: { _id: 1 } },
          ]),
          Room.countDocuments({ isActive: true }),
          Booking.find({
            checkInDate: { $gte: cutoff30 },
            status: { $in: ['confirmed', 'checked-in', 'checked-out'] },
          }).select('checkInDate checkOutDate').lean(),
        ]);

        totalRooms    = totalR;
        recentRevData = revAgg.map(r => ({ date: r._id, revenue: r.revenue }));

        for (let d = 0; d < 30; d++) {
          const day = new Date(cutoff30.getTime() + d * 86400000);
          const dayStr = day.toISOString().split('T')[0];
          const occupied = bookings.filter(b => day >= new Date(b.checkInDate) && day < new Date(b.checkOutDate)).length;
          occupancyData.push({ date: dayStr, occupancy: totalRooms > 0 ? Math.min(100, Math.round(occupied / totalRooms * 100)) : 0 });
        }
      }
    } catch (e) {
      logger.warn('JARVIS getInsights: DB error', e.message);
    }

    // Run AI
    const revForecast  = recentRevData.length >= 2 ? aiService.predictRevenue(recentRevData, 7)  : [];
    const occForecast  = occupancyData.length >= 2  ? aiService.predictOccupancy(occupancyData, 7) : [];

    const insights = {
      revenueForecast7d:   revForecast,
      occupancyForecast7d: occForecast,
      dataPoints: { revenue: recentRevData.length, occupancy: occupancyData.length, totalRooms },
      generatedAt: new Date().toISOString(),
    };

    res.json({ success: true, data: insights });
  } catch (err) {
    logger.error('JARVIS getInsights error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── optimizePricing ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/jarvis/pricing
 * Body: { roomId?, room?, occupancyRate, dayOfWeek, season }
 */
const optimizePricing = async (req, res) => {
  try {
    const { roomId, room: roomBody, occupancyRate = 50, dayOfWeek, season = 'regular' } = req.body;

    let room = roomBody;

    if (!room && roomId) {
      try {
        const Room = require('../models/Room');
        room = await Room.findById(roomId).lean();
        if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      } catch (e) {
        logger.warn('JARVIS optimizePricing: room lookup failed', e.message);
      }
    }

    if (!room) {
      return res.status(400).json({ success: false, message: 'Provide roomId or room object' });
    }

    const dow = dayOfWeek !== undefined ? Number(dayOfWeek) : new Date().getDay();
    const result = aiService.optimizePricing(room, Number(occupancyRate), dow, season);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('JARVIS optimizePricing error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── getRecommendations ───────────────────────────────────────────────────────

/**
 * GET /api/v1/jarvis/recommendations/:guestId
 */
const getRecommendations = async (req, res) => {
  try {
    const { guestId } = req.params;
    if (!guestId) return res.status(400).json({ success: false, message: 'guestId required' });

    const Guest   = require('../models/Guest');
    const Booking = require('../models/Booking');
    const Room    = require('../models/Room');

    let guest, allBookings, allRooms;
    try {
      [guest, allBookings, allRooms] = await Promise.all([
        Guest.findById(guestId).lean(),
        Booking.find({}).populate('room', 'type number').lean(),
        Room.find({ isActive: true }).lean(),
      ]);
    } catch (e) {
      logger.warn('JARVIS getRecommendations: DB error', e.message);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!guest) return res.status(404).json({ success: false, message: 'Guest not found' });

    const recommendations = aiService.getGuestRecommendations(guest, allBookings || [], allRooms || []);
    res.json({ success: true, data: recommendations });
  } catch (err) {
    logger.error('JARVIS getRecommendations error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── analyzeSentiment ────────────────────────────────────────────────────────

/**
 * POST /api/v1/jarvis/sentiment
 * Body: { text: string } or { reviews: [string] }
 */
const analyzeSentiment = async (req, res) => {
  try {
    const { text, reviews } = req.body;

    if (!text && !Array.isArray(reviews)) {
      return res.status(400).json({ success: false, message: 'Provide text or reviews array' });
    }

    if (Array.isArray(reviews)) {
      const results = reviews.map(r => ({ text: r, ...aiService.analyzeSentiment(r) }));
      const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
      return res.json({
        success: true,
        data: {
          results,
          aggregate: {
            averageScore: Math.round(avg * 100) / 100,
            label: avg > 0.1 ? 'positive' : avg < -0.1 ? 'negative' : 'neutral',
            total: results.length,
          },
        },
      });
    }

    const result = aiService.analyzeSentiment(text);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('JARVIS analyzeSentiment error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  forecast,
  detectAnomaly,
  getInsights,
  optimizePricing,
  getRecommendations,
  analyzeSentiment,
};
