const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getAllAgents,
  getAgentById,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentStats,
} = require('../controllers/agentsController');

// All routes are auth protected
router.use(auth);

router.get('/', getAllAgents);
router.get('/stats', getAgentStats);
router.get('/:id', getAgentById);
router.post('/', createAgent);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);

module.exports = router;
