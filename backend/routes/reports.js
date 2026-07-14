const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getSalesSummary,
  getAgentPerformance,
  getMonthlyTrend,
  getSourceWiseReport,
  getPremiumReport,
} = require('../controllers/reportsController');

// All routes require auth + admin or manager role
router.use(auth);
router.use(authorize('admin', 'manager'));

router.get('/dashboard', getDashboardStats);
router.get('/sales-summary', getSalesSummary);
router.get('/agent-performance', getAgentPerformance);
router.get('/monthly-trend', getMonthlyTrend);
router.get('/source-wise', getSourceWiseReport);
router.get('/premium', getPremiumReport);

module.exports = router;
