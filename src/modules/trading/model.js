'use strict';
/**
 * Trading & Investment Module - Models
 */
const { createJsonModel } = require('../../models/JsonModel');

const TradingPortfolio = createJsonModel('portfolios', {
  userId: { type: 'string', required: true },
  name: { type: 'string', required: true },
  holdings: { type: 'array', default: [] },
  cash: { type: 'number', default: 100000 },
  totalValue: { type: 'number', default: 0 },
  pnl: { type: 'number', default: 0 },
  pnlPercent: { type: 'number', default: 0 },
  riskLevel: { type: 'string', default: 'moderate' },
  currency: { type: 'string', default: 'INR' },
});

const Trade = createJsonModel('trades', {
  portfolioId: { type: 'string', required: true },
  symbol: { type: 'string', required: true },
  type: { type: 'string', required: true },
  quantity: { type: 'number', required: true },
  price: { type: 'number', required: true },
  total: { type: 'number' },
  fees: { type: 'number', default: 0 },
  status: { type: 'string', default: 'executed' },
  executedAt: { type: 'date' },
  notes: { type: 'string' },
});

const WatchList = createJsonModel('watchlists', {
  userId: { type: 'string', required: true },
  name: { type: 'string', default: 'My Watchlist' },
  symbols: { type: 'array', default: [] },
  alerts: { type: 'array', default: [] },
});

const Strategy = createJsonModel('strategies', {
  name: { type: 'string', required: true },
  type: { type: 'string', required: true },
  description: { type: 'string' },
  parameters: { type: 'object', default: {} },
  isActive: { type: 'boolean', default: false },
  userId: { type: 'string' },
  backtestResults: { type: 'object', default: null },
});

const BacktestResult = createJsonModel('backtest_results', {
  strategyId: { type: 'string', required: true },
  strategyName: { type: 'string' },
  symbol: { type: 'string' },
  period: { type: 'object' },
  initialCapital: { type: 'number' },
  finalValue: { type: 'number' },
  totalReturn: { type: 'number' },
  annualizedReturn: { type: 'number' },
  sharpeRatio: { type: 'number' },
  maxDrawdown: { type: 'number' },
  winRate: { type: 'number' },
  totalTrades: { type: 'number' },
  profitableTrades: { type: 'number' },
  trades: { type: 'array', default: [] },
  equityCurve: { type: 'array', default: [] },
  parameters: { type: 'object', default: {} },
});

const PriceAlert = createJsonModel('price_alerts', {
  userId: { type: 'string', required: true },
  symbol: { type: 'string', required: true },
  condition: { type: 'string', required: true },
  value: { type: 'number', required: true },
  triggered: { type: 'boolean', default: false },
  active: { type: 'boolean', default: true },
  triggeredAt: { type: 'date' },
});

module.exports = { TradingPortfolio, Trade, WatchList, Strategy, BacktestResult, PriceAlert };
