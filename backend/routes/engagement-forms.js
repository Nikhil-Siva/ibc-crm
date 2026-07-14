const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/engagementFormsController');

// Auth protected routes
router.use(auth);

router.get('/campaign/:campaignId', controller.getFormByCampaign);
router.post('/', controller.createOrUpdateForm);
router.delete('/:id', controller.deleteForm);
router.post('/submit', controller.submitForm);
router.get('/:formId/submissions', controller.getFormSubmissions);
router.get('/submission/:id', controller.getSubmissionById);

module.exports = router;
