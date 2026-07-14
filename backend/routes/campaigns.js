const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const controller = require('../controllers/campaignsController');

// All routes are auth protected
router.use(auth);

router.get('/', controller.getAllCampaigns);
router.get('/:id', controller.getCampaignById);
router.post('/', controller.createCampaign);
router.put('/:id', controller.updateCampaign);
router.delete('/:id', controller.deleteCampaign);
router.put('/:id/pause-resume', controller.pauseResumeCampaign);
router.get('/:id/leads', controller.getCampaignLeads);
router.get('/:id/agents', controller.getCampaignAgents);
router.post('/:id/assign-agents', controller.assignAgents);
router.get('/:id/stats', controller.getCampaignStats);

module.exports = router;
