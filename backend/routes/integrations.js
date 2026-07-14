const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/integrationsController');

// All routes are admin only
router.use(auth, authorize('admin', 'manager'));

router.get('/', controller.getAllIntegrations);
router.get('/:id', controller.getIntegrationById);
router.post('/', controller.createIntegration);
router.put('/:id', controller.updateIntegration);
router.delete('/:id', controller.deleteIntegration);
router.post('/:id/sync', controller.syncIntegration);
router.get('/:id/logs', controller.getIntegrationLogs);

module.exports = router;
