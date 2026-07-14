const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/marketplaceController');

// All routes are admin only
router.use(auth, authorize('admin'));

router.get('/', controller.getAllProviders);
router.get('/:id', controller.getProviderById);
router.post('/connect', controller.connectProvider);
router.put('/disconnect/:id', controller.disconnectProvider);
router.put('/reconfigure/:id', controller.reconfigureProvider);
router.post('/test/:id', controller.testConnection);

module.exports = router;
