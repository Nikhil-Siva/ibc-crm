const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const importUpload = require('../middleware/importUpload');
const controller = require('../controllers/contactImportController');

// All routes are admin only
router.use(auth, authorize('admin', 'manager'));

router.post('/upload', importUpload.single('file'), controller.uploadContacts);
router.post('/process', controller.processImport);
router.get('/', controller.getImportHistory);
router.get('/:id', controller.getImportById);
router.get('/:id/errors', controller.getImportErrors);

module.exports = router;
