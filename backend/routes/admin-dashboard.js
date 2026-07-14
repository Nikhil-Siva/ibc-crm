const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/adminDashboardController');

// ─── Telecaller route — any authenticated user (must be BEFORE the admin guard below) ───
router.get('/telecaller', auth, controller.getTelecallerDashboard);

// ─── Admin / Manager only routes ──────────────────────────────────────────────────────
router.get('/', auth, authorize('admin', 'manager'), controller.getDashboardStats);
router.get('/activity', auth, authorize('admin', 'manager'), controller.getRecentActivity);
router.get('/top-agents', auth, authorize('admin', 'manager'), controller.getTopAgents);
router.get('/quick-stats', auth, authorize('admin', 'manager'), controller.getQuickStats);

module.exports = router;
