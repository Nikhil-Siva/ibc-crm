const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getUpcomingRenewals,
  getOverdueRenewals,
  sendRenewalReminder,
  getRenewalStats,
} = require('../controllers/renewalsController');

// All routes are auth protected
router.use(auth);

router.get('/upcoming', getUpcomingRenewals);
router.get('/overdue', getOverdueRenewals);
router.get('/stats', getRenewalStats);
router.post('/send-reminder/:policyId', sendRenewalReminder);

module.exports = router;
