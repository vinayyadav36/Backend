'use strict';
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const ctrl = require('./controller');

router.use(protect);

router.get('/dashboard', ctrl.getDashboard);
router.get('/portfolios', ctrl.getPortfolios);
router.get('/portfolios/:id', ctrl.getPortfolio);
router.post('/portfolios', ctrl.createPortfolio);
router.put('/portfolios/:id', ctrl.updatePortfolio);
router.delete('/portfolios/:id', ctrl.deletePortfolio);

router.get('/trades', ctrl.getTrades);
router.get('/trades/:id', ctrl.getTrade);
router.post('/trades', ctrl.executeTrade);
router.get('/trades/history/:portfolioId', ctrl.getTradeHistory);

router.get('/watchlists', ctrl.getWatchlists);
router.get('/watchlists/:id', ctrl.getWatchlist);
router.post('/watchlists', ctrl.createWatchlist);
router.put('/watchlists/:id', ctrl.updateWatchlist);
router.delete('/watchlists/:id', ctrl.deleteWatchlist);
router.post('/watchlists/:id/add', ctrl.addToWatchlist);
router.post('/watchlists/:id/remove', ctrl.removeFromWatchlist);

router.get('/strategies', ctrl.getStrategies);
router.get('/strategies/:id', ctrl.getStrategy);
router.post('/strategies', ctrl.createStrategy);
router.put('/strategies/:id', ctrl.updateStrategy);
router.delete('/strategies/:id', ctrl.deleteStrategy);
router.post('/strategies/:id/backtest', ctrl.backtestStrategy);
router.get('/strategies/:id/results', ctrl.getBacktestResults);

router.get('/alerts', ctrl.getAlerts);
router.post('/alerts', ctrl.createAlert);
router.put('/alerts/:id', ctrl.updateAlert);
router.delete('/alerts/:id', ctrl.deleteAlert);

router.get('/price/:symbol', ctrl.getPrice);

module.exports = router;