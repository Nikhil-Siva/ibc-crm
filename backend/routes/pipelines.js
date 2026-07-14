const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/pipelinesController');

// All routes are auth protected
router.use(auth);

router.get('/', controller.getAllPipelines);
router.get('/:id', controller.getPipelineById);
router.post('/', controller.createPipeline);
router.put('/:id', controller.updatePipeline);
router.delete('/:id', controller.deletePipeline);
router.put('/:id/toggle', controller.togglePipelineStatus);

module.exports = router;
