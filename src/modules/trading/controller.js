'use strict';
const db = require('../../config/jsonDb');

const ctrl = {
  getDashboard: async (req, res) => {
    try {
      const portfolios = db.find('portfolios', {});
      const trades = db.find('trades', {});
      const strategies = db.find('strategies', {});
      
      const totalValue = portfolios.reduce((s, p) => s + (p.totalValue || 0), 0);
      const totalPnL = portfolios.reduce((s, p) => s + (p.pnl || 0), 0);
      
      res.json({ success: true, data: {
        totalPortfolios: portfolios.length,
        totalValue,
        totalPnL,
        totalTrades: trades.length,
        activeStrategies: strategies.filter(s => s.isActive).length,
        recentTrades: trades.slice(-10).reverse(),
      }});
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPortfolios: async (req, res) => {
    try {
      const portfolios = db.find('portfolios', {});
      res.json({ success: true, data: portfolios });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPortfolio: async (req, res) => {
    try {
      const portfolio = db.findById('portfolios', req.params.id);
      if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
      res.json({ success: true, data: portfolio });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createPortfolio: async (req, res) => {
    try {
      const portfolio = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.insert('portfolios', portfolio);
      res.status(201).json({ success: true, data: portfolio });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updatePortfolio: async (req, res) => {
    try {
      await db.update('portfolios', { _id: req.params.id }, { $set: { ...req.body, updatedAt: new Date().toISOString() } });
      res.json({ success: true, data: db.findById('portfolios', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deletePortfolio: async (req, res) => {
    try {
      await db.removeById('portfolios', req.params.id);
      res.json({ success: true, message: 'Portfolio deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTrades: async (req, res) => {
    try {
      const { portfolioId, symbol } = req.query;
      let trades = db.find('trades', {});
      if (portfolioId) trades = trades.filter(t => t.portfolioId === portfolioId);
      if (symbol) trades = trades.filter(t => t.symbol === symbol);
      res.json({ success: true, data: trades.reverse() });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTrade: async (req, res) => {
    try {
      const trade = db.findById('trades', req.params.id);
      if (!trade) return res.status(404).json({ success: false, message: 'Trade not found' });
      res.json({ success: true, data: trade });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  executeTrade: async (req, res) => {
    try {
      const { portfolioId, symbol, type, quantity, price, fees } = req.body;
      const portfolio = db.findById('portfolios', portfolioId);
      if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
      
      const total = quantity * price;
      const trade = { _id: db.generateId(), portfolioId, symbol, type, quantity, price, total, fees: fees || 0, status: 'executed', executedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      db.insert('trades', trade);
      
      let holdings = portfolio.holdings || [];
      if (type === 'buy') {
        const existing = holdings.find(h => h.symbol === symbol);
        if (existing) {
          existing.quantity += quantity;
          existing.avgPrice = ((existing.avgPrice * existing.quantity) + total) / (existing.quantity + quantity);
        } else {
          holdings.push({ symbol, quantity, avgPrice: price });
        }
      } else {
        const existing = holdings.find(h => h.symbol === symbol);
        if (existing) {
          existing.quantity -= quantity;
          holdings = holdings.filter(h => h.quantity > 0);
        }
      }
      
      const cashChange = type === 'buy' ? -total : total;
      await db.update('portfolios', { _id: portfolioId }, { $set: { holdings, cash: (portfolio.cash || 0) + cashChange, updatedAt: new Date().toISOString() } });
      
      res.status(201).json({ success: true, data: trade });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getTradeHistory: async (req, res) => {
    try {
      const trades = db.find('trades', { portfolioId: req.params.portfolioId });
      res.json({ success: true, data: trades });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getWatchlists: async (req, res) => {
    try {
      const watchlists = db.find('watchlists', {});
      res.json({ success: true, data: watchlists });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getWatchlist: async (req, res) => {
    try {
      const watchlist = db.findById('watchlists', req.params.id);
      if (!watchlist) return res.status(404).json({ success: false, message: 'Watchlist not found' });
      res.json({ success: true, data: watchlist });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createWatchlist: async (req, res) => {
    try {
      const watchlist = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('watchlists', watchlist);
      res.status(201).json({ success: true, data: watchlist });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateWatchlist: async (req, res) => {
    try {
      await db.update('watchlists', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('watchlists', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteWatchlist: async (req, res) => {
    try {
      await db.removeById('watchlists', req.params.id);
      res.json({ success: true, message: 'Watchlist deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  addToWatchlist: async (req, res) => {
    try {
      const watchlist = db.findById('watchlists', req.params.id);
      if (!watchlist) return res.status(404).json({ success: false, message: 'Watchlist not found' });
      
      const symbols = watchlist.symbols || [];
      if (!symbols.includes(req.body.symbol)) {
        symbols.push(req.body.symbol);
        await db.update('watchlists', { _id: req.params.id }, { $set: { symbols } });
      }
      res.json({ success: true, message: 'Symbol added' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  removeFromWatchlist: async (req, res) => {
    try {
      const watchlist = db.findById('watchlists', req.params.id);
      if (!watchlist) return res.status(404).json({ success: false, message: 'Watchlist not found' });
      
      const symbols = (watchlist.symbols || []).filter(s => s !== req.body.symbol);
      await db.update('watchlists', { _id: req.params.id }, { $set: { symbols } });
      res.json({ success: true, message: 'Symbol removed' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getStrategies: async (req, res) => {
    try {
      const strategies = db.find('strategies', {});
      res.json({ success: true, data: strategies });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getStrategy: async (req, res) => {
    try {
      const strategy = db.findById('strategies', req.params.id);
      if (!strategy) return res.status(404).json({ success: false, message: 'Strategy not found' });
      res.json({ success: true, data: strategy });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createStrategy: async (req, res) => {
    try {
      const strategy = { _id: db.generateId(), ...req.body, createdAt: new Date().toISOString() };
      db.insert('strategies', strategy);
      res.status(201).json({ success: true, data: strategy });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateStrategy: async (req, res) => {
    try {
      await db.update('strategies', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('strategies', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteStrategy: async (req, res) => {
    try {
      await db.removeById('strategies', req.params.id);
      res.json({ success: true, message: 'Strategy deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  backtestStrategy: async (req, res) => {
    try {
      const strategy = db.findById('strategies', req.params.id);
      if (!strategy) return res.status(404).json({ success: false, message: 'Strategy not found' });
      
      const result = { _id: db.generateId(), strategyId: req.params.id, strategyName: strategy.name, initialCapital: req.body.initialCapital || 100000, finalValue: req.body.initialCapital || 100000, totalReturn: 0, trades: [], createdAt: new Date().toISOString() };
      db.insert('backtest_results', result);
      
      res.status(201).json({ success: true, data: result });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getBacktestResults: async (req, res) => {
    try {
      const results = db.find('backtest_results', { strategyId: req.params.id });
      res.json({ success: true, data: results });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getAlerts: async (req, res) => {
    try {
      const alerts = db.find('price_alerts', {});
      res.json({ success: true, data: alerts });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  createAlert: async (req, res) => {
    try {
      const alert = { _id: db.generateId(), ...req.body, triggered: false, active: true, createdAt: new Date().toISOString() };
      db.insert('price_alerts', alert);
      res.status(201).json({ success: true, data: alert });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  updateAlert: async (req, res) => {
    try {
      await db.update('price_alerts', { _id: req.params.id }, { $set: req.body });
      res.json({ success: true, data: db.findById('price_alerts', req.params.id) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  deleteAlert: async (req, res) => {
    try {
      await db.removeById('price_alerts', req.params.id);
      res.json({ success: true, message: 'Alert deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },

  getPrice: async (req, res) => {
    try {
      const { symbol } = req.params;
      const mockPrice = Math.random() * 1000 + 100;
      res.json({ success: true, data: { symbol, price: mockPrice, change: (Math.random() - 0.5) * 10, changePercent: (Math.random() - 0.5) * 2 } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  },
};

module.exports = ctrl;