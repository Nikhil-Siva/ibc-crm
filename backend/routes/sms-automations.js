const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/smsAutomationController');

// All routes are admin only
router.use(auth, authorize('admin'));

router.get('/', controller.getAllAutomations);
router.get('/:id', controller.getAutomationById);
router.post('/', controller.createAutomation);
router.put('/:id', controller.updateAutomation);
router.delete('/:id', controller.deleteAutomation);
router.put('/:id/toggle', controller.toggleAutomation);
router.get('/:id/logs', controller.getAutomationLogs);
router.post('/test-send', controller.testSendSms);

module.exports = router;
