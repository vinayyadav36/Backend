/**
 * AI Service — In-Process Intelligence Engine
 * All algorithms implemented from scratch. No external API calls required.
 * @version 1.0.0
 */

'use strict';

const logger = require('../config/logger');

// ─── Utilities ────────────────────────────────────────────────────────────────

function dateToOrdinal(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 86400000);
}

function mean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function variance(arr, mu) {
  if (!arr || arr.length === 0) return 0;
  const m = mu !== undefined ? mu : mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function stddev(arr, mu) {
  return Math.sqrt(variance(arr, mu));
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── predictRevenue ───────────────────────────────────────────────────────────

/**
 * Predict future revenue using simple linear regression + day-of-week seasonal adjustment.
 * @param {Array<{date: string, revenue: number}>} historicalData
 * @param {number} [horizon=30]  Number of days to forecast
 * @returns {Array<{date: string, predicted: number, confidence: number}>}
 */
const predictRevenue = (historicalData, horizon = 30) => {
  if (!Array.isArray(historicalData) || historicalData.length < 2) {
    logger.warn('predictRevenue: insufficient data points');
    return [];
  }

  const n = historicalData.length;
  const xs = historicalData.map((_, i) => i);               // sequential indices
  const ys = historicalData.map(d => Number(d.revenue) || 0);

  // Least-squares linear regression
  const sumX  = xs.reduce((a, v) => a + v, 0);
  const sumY  = ys.reduce((a, v) => a + v, 0);
  const sumXY = xs.reduce((a, v, i) => a + v * ys[i], 0);
  const sumX2 = xs.reduce((a, v) => a + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope  = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Day-of-week seasonal factors (based on historical data)
  const dowAccum = Array.from({ length: 7 }, () => ({ sum: 0, cnt: 0 }));
  historicalData.forEach(d => {
    const dow = new Date(d.date).getDay();
    dowAccum[dow].sum += Number(d.revenue) || 0;
    dowAccum[dow].cnt += 1;
  });
  const dowMean = dowAccum.map(e => (e.cnt > 0 ? e.sum / e.cnt : 0));
  const overallMean = mean(ys) || 1;
  const seasonalFactor = dowMean.map(v => (overallMean > 0 ? v / overallMean : 1));

  // Residuals for confidence estimation
  const residuals = ys.map((y, i) => y - (slope * i + intercept));
  const rmse = Math.sqrt(mean(residuals.map(r => r ** 2)));

  // Last date in historical data
  const lastDate = historicalData[n - 1].date;

  const predictions = [];
  for (let h = 1; h <= horizon; h++) {
    const x    = n - 1 + h;
    const trendVal = slope * x + intercept;
    const forecastDate = addDays(lastDate, h);
    const dow  = new Date(forecastDate).getDay();
    const sf   = seasonalFactor[dow] || 1;
    const predicted = Math.max(0, Math.round(trendVal * sf));

    // Confidence narrows as RMSE relative to predicted decreases
    const relErr = predicted > 0 ? rmse / predicted : 1;
    const confidence = Math.round(Math.max(0.1, Math.min(1, 1 - relErr)) * 100) / 100;

    predictions.push({ date: forecastDate, predicted, confidence });
  }

  logger.info(`predictRevenue: slope=${slope.toFixed(2)}, horizon=${horizon}, points=${n}`);
  return predictions;
};

// ─── predictOccupancy ────────────────────────────────────────────────────────

/**
 * Predict occupancy using 7-day moving average with trend.
 * @param {Array<{date: string, occupancy: number}>} historicalData
 * @param {number} [horizon=7]
 * @returns {Array<{date: string, predicted: number}>}
 */
const predictOccupancy = (historicalData, horizon = 7) => {
  if (!Array.isArray(historicalData) || historicalData.length === 0) return [];

  const values = historicalData.map(d => Number(d.occupancy) || 0);
  const n = values.length;
  const windowSize = Math.min(7, n);

  // Moving average
  const movingAvgs = [];
  for (let i = windowSize - 1; i < n; i++) {
    const window = values.slice(i - windowSize + 1, i + 1);
    movingAvgs.push(mean(window));
  }

  // Trend from moving averages
  const maLen = movingAvgs.length;
  let trend = 0;
  if (maLen >= 2) {
    trend = (movingAvgs[maLen - 1] - movingAvgs[0]) / maLen;
  }

  const lastMA   = movingAvgs[maLen - 1] || mean(values);
  const lastDate = historicalData[n - 1].date;

  return Array.from({ length: horizon }, (_, h) => ({
    date:      addDays(lastDate, h + 1),
    predicted: Math.min(100, Math.max(0, Math.round(lastMA + trend * (h + 1)))),
  }));
};

// ─── getGuestRecommendations ──────────────────────────────────────────────────

/**
 * Simple collaborative filtering — finds guests with similar room-type preferences
 * and recommends room types the target guest hasn't tried.
 * @param {object} guest
 * @param {Array}  allBookings
 * @param {Array}  allRooms
 * @returns {Array<{roomType: string, score: number, reason: string}>}
 */
const getGuestRecommendations = (guest, allBookings, allRooms) => {
  if (!guest || !Array.isArray(allBookings) || !Array.isArray(allRooms)) return [];

  const guestId = String(guest._id || guest.id || '');

  // Collect this guest's booked room types
  const guestBookings = allBookings.filter(b =>
    String(b.guest?._id || b.guest) === guestId
  );
  const guestRoomTypes = new Set(
    guestBookings.map(b => b.room?.type || b.roomType).filter(Boolean)
  );

  // Build user-item matrix: { guestId: Set<roomType> }
  const userItems = {};
  allBookings.forEach(b => {
    const uid = String(b.guest?._id || b.guest || '');
    const rtype = b.room?.type || b.roomType;
    if (!uid || !rtype) return;
    if (!userItems[uid]) userItems[uid] = new Set();
    userItems[uid].add(rtype);
  });

  // Jaccard similarity between target guest and others
  const similarities = [];
  Object.entries(userItems).forEach(([uid, items]) => {
    if (uid === guestId) return;
    const intersection = [...guestRoomTypes].filter(t => items.has(t)).length;
    const union = new Set([...guestRoomTypes, ...items]).size;
    if (union > 0) similarities.push({ uid, sim: intersection / union, items });
  });
  similarities.sort((a, b) => b.sim - a.sim);
  const topNeighbors = similarities.slice(0, 10);

  // Score candidate room types not yet tried by this guest
  const candidateScores = {};
  topNeighbors.forEach(({ sim, items }) => {
    items.forEach(rt => {
      if (guestRoomTypes.has(rt)) return;
      candidateScores[rt] = (candidateScores[rt] || 0) + sim;
    });
  });

  // Available room types from allRooms
  const availableTypes = new Set(allRooms.map(r => r.type).filter(Boolean));

  const results = Object.entries(candidateScores)
    .filter(([rt]) => availableTypes.has(rt))
    .map(([roomType, score]) => ({
      roomType,
      score: Math.round(score * 100) / 100,
      reason: `Recommended based on similar guests' preferences`,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Fallback: popular room types guest hasn't tried
  if (results.length === 0) {
    const typeCounts = {};
    allBookings.forEach(b => {
      const rt = b.room?.type || b.roomType;
      if (rt) typeCounts[rt] = (typeCounts[rt] || 0) + 1;
    });
    Object.entries(typeCounts)
      .filter(([rt]) => !guestRoomTypes.has(rt) && availableTypes.has(rt))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([roomType, cnt]) =>
        results.push({ roomType, score: cnt, reason: 'Popular room type' })
      );
  }

  return results;
};

// ─── detectAnomalies ─────────────────────────────────────────────────────────

/**
 * Z-score based anomaly detection. Flags items > 2.5 std deviations from mean.
 * @param {Array<{amount: number, date?: string, description?: string}>} transactions
 * @returns {Array<{transaction, anomalyScore: number, isAnomaly: boolean}>}
 */
const detectAnomalies = (transactions) => {
  if (!Array.isArray(transactions) || transactions.length === 0) return [];

  const amounts = transactions.map(t => Number(t.amount) || 0);
  const mu  = mean(amounts);
  const sd  = stddev(amounts, mu);

  return transactions.map(t => {
    const amount = Number(t.amount) || 0;
    const score  = sd > 0 ? Math.abs((amount - mu) / sd) : 0;
    return {
      transaction:  t,
      anomalyScore: Math.round(score * 100) / 100,
      isAnomaly:    score > 2.5,
    };
  });
};

// ─── optimizePricing ─────────────────────────────────────────────────────────

/**
 * Dynamic pricing optimizer.
 * @param {object} room           - { price|rate: number }
 * @param {number} occupancyRate  - 0–100
 * @param {number} dayOfWeek      - 0 (Sun) – 6 (Sat)
 * @param {string} season         - 'peak' | 'off-peak' | 'regular'
 * @returns {{ suggestedRate: number, baseRate: number, factors: object }}
 */
const optimizePricing = (room, occupancyRate, dayOfWeek, season) => {
  const baseRate = Number(room?.price || room?.rate || 0);
  if (baseRate <= 0) return { suggestedRate: 0, baseRate: 0, factors: {} };

  const factors = {};
  let multiplier = 1;

  // Occupancy factor
  if (occupancyRate > 80) {
    factors.highOccupancy = 0.20;
    multiplier += 0.20;
  }

  // Weekend factor (Fri=5, Sat=6)
  if (dayOfWeek === 5 || dayOfWeek === 6) {
    factors.weekend = 0.15;
    multiplier += 0.15;
  }

  // Seasonal factor
  if (season === 'peak') {
    factors.peakSeason = 0.25;
    multiplier += 0.25;
  } else if (season === 'off-peak') {
    factors.offPeak = -0.10;
    multiplier -= 0.10;
  }

  const suggestedRate = Math.round(baseRate * multiplier);
  return { suggestedRate, baseRate, factors };
};

// ─── analyzeSentiment ────────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'excellent', 'amazing', 'great', 'wonderful', 'fantastic', 'perfect',
  'outstanding', 'superb', 'exceptional', 'brilliant', 'awesome', 'love',
  'loved', 'best', 'good', 'nice', 'clean', 'comfortable', 'friendly',
  'helpful', 'beautiful', 'delicious', 'recommend', 'happy', 'satisfied',
  'pleasant', 'enjoy', 'enjoyed', 'cozy', 'luxurious', 'spacious', 'value',
  'impressed', 'polite', 'efficient', 'professional', 'attentive', 'welcoming',
]);

const NEGATIVE_WORDS = new Set([
  'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'bad', 'poor',
  'disappointing', 'dirty', 'rude', 'unfriendly', 'noisy', 'uncomfortable',
  'broken', 'smelly', 'slow', 'unhelpful', 'overpriced', 'cold', 'boring',
  'mediocre', 'cramped', 'outdated', 'avoid', 'never', 'waste', 'unacceptable',
  'disgusted', 'problem', 'issue', 'complaint', 'failed', 'worse', 'filthy',
]);

const NEGATION_WORDS = new Set(['not', 'no', 'never', "don't", "didn't", "wasn't", "isn't", "aren't", 'neither']);

/**
 * Lexicon-based sentiment analysis.
 * @param {string} text
 * @returns {{ score: number, label: 'positive'|'neutral'|'negative' }}
 */
const analyzeSentiment = (text) => {
  if (!text || typeof text !== 'string') return { score: 0, label: 'neutral' };

  const tokens = text.toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).filter(Boolean);
  let score = 0;
  let total = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const negated = i > 0 && NEGATION_WORDS.has(tokens[i - 1]);
    const flip = negated ? -1 : 1;

    if (POSITIVE_WORDS.has(token)) { score += 1 * flip; total++; }
    else if (NEGATIVE_WORDS.has(token)) { score -= 1 * flip; total++; }
  }

  const normalised = total > 0 ? Math.max(-1, Math.min(1, score / total)) : 0;
  const rounded    = Math.round(normalised * 100) / 100;
  const label      = rounded > 0.1 ? 'positive' : rounded < -0.1 ? 'negative' : 'neutral';

  return { score: rounded, label };
};

// ─── clusterGuests ────────────────────────────────────────────────────────────

/**
 * K-means clustering (k=3) on: stay frequency, total spend, avg advance booking days.
 * Labels clusters as 'Budget Traveler', 'Business Guest', 'Luxury Guest'.
 * @param {Array} guests - Guest objects with booking data
 * @returns {Array} - Guests annotated with `cluster` field
 */
const clusterGuests = (guests) => {
  if (!Array.isArray(guests) || guests.length === 0) return [];

  const K = 3;
  const MAX_ITER = 100;

  // Feature extraction
  const features = guests.map(g => [
    Number(g.totalBookings || 0),
    Number(g.totalSpent    || 0),
    Number(g.avgAdvanceDays || 0),
  ]);

  // Normalise features to [0,1]
  const featureCount = 3;
  const mins = Array(featureCount).fill(Infinity);
  const maxs = Array(featureCount).fill(-Infinity);
  features.forEach(f => f.forEach((v, i) => {
    if (v < mins[i]) mins[i] = v;
    if (v > maxs[i]) maxs[i] = v;
  }));
  const ranges = mins.map((mn, i) => maxs[i] - mn || 1);
  const normalised = features.map(f => f.map((v, i) => (v - mins[i]) / ranges[i]));

  // Seed centroids using k-means++ strategy (deterministic: pick spread-out points)
  const centroids = [];
  const usedIdx = new Set();
  // First centroid: index 0
  centroids.push([...normalised[0]]);
  usedIdx.add(0);

  for (let k = 1; k < K; k++) {
    let bestIdx = -1, bestDist = -Infinity;
    normalised.forEach((pt, idx) => {
      if (usedIdx.has(idx)) return;
      const minDist = centroids.reduce((mn, c) => {
        const d = pt.reduce((s, v, i) => s + (v - c[i]) ** 2, 0);
        return Math.min(mn, d);
      }, Infinity);
      if (minDist > bestDist) { bestDist = minDist; bestIdx = idx; }
    });
    if (bestIdx === -1) bestIdx = k; // fallback
    centroids.push([...normalised[bestIdx]]);
    usedIdx.add(bestIdx);
  }

  let assignments = new Array(normalised.length).fill(0);

  // Iterate
  for (let iter = 0; iter < MAX_ITER; iter++) {
    const newAssign = normalised.map(pt => {
      let bestK = 0, bestD = Infinity;
      centroids.forEach((c, k) => {
        const d = pt.reduce((s, v, i) => s + (v - c[i]) ** 2, 0);
        if (d < bestD) { bestD = d; bestK = k; }
      });
      return bestK;
    });

    // Converged?
    const changed = newAssign.some((a, i) => a !== assignments[i]);
    assignments = newAssign;
    if (!changed) break;

    // Update centroids
    centroids.forEach((c, k) => {
      const members = normalised.filter((_, i) => assignments[i] === k);
      if (members.length === 0) return;
      for (let d = 0; d < featureCount; d++) {
        c[d] = mean(members.map(m => m[d]));
      }
    });
  }

  // Label clusters: sort by average total spend (centroid dimension 1 in normalised space)
  const clusterSpend = centroids.map((c, k) => ({ k, spend: c[1] }))
    .sort((a, b) => a.spend - b.spend);
  const labelMap = {
    [clusterSpend[0].k]: 'Budget Traveler',
    [clusterSpend[1].k]: 'Business Guest',
    [clusterSpend[2].k]: 'Luxury Guest',
  };

  return guests.map((g, i) => ({
    ...g,
    cluster: labelMap[assignments[i]] || 'Budget Traveler',
  }));
};

module.exports = {
  predictRevenue,
  predictOccupancy,
  getGuestRecommendations,
  detectAnomalies,
  optimizePricing,
  analyzeSentiment,
  clusterGuests,
};
