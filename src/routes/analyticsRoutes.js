const express = require('express');
const {
  getDashboardAnalytics,
  getRevenueAnalytics,
  getOccupancyAnalytics
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middlewares/authMiddleware');

const router = express.Router();

// All analytics routes require authentication and view_analytics permission
router.use(protect);
router.use(authorize('view_analytics'));

router.get('/dashboard', getDashboardAnalytics);
router.get('/revenue', getRevenueAnalytics);
router.get('/occupancy', getOccupancyAnalytics);

module.exports = router;