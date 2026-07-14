const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/callReportsController');

// All routes are admin/manager only
router.use(auth, authorize('admin', 'manager'));

router.get('/user-call', controller.getUserCallReport);
router.get('/call-timeline', controller.getCallTimeline);
router.get('/agent-login', controller.getAgentLoginReport);
router.get('/agent-timeline', controller.getAgentTimeline);
router.get('/day-wise', controller.getDayWiseSummary);
router.get('/export', controller.exportCallReport);

module.exports = router;
