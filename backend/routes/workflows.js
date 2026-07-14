const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/workflowsController');

// All routes are admin only
router.use(auth, authorize('admin'));

router.get('/', controller.getAllWorkflows);
router.get('/:id', controller.getWorkflowById);
router.post('/', controller.createWorkflow);
router.put('/:id', controller.updateWorkflow);
router.delete('/:id', controller.deleteWorkflow);
router.put('/:id/toggle', controller.toggleWorkflow);
router.get('/:id/logs', controller.getWorkflowRunLogs);
router.post('/test-run', controller.testRunWorkflow);

module.exports = router;
