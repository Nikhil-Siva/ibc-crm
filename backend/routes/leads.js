const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getAllLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  convertToCustomer,
  getLeadsByStatus,
  bulkAssign,
  addCallNote,
} = require('../controllers/leadsController');

// All routes are auth protected
router.use(auth);

router.get('/', getAllLeads);
router.get('/pipeline', getLeadsByStatus);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.put('/:id', updateLead);
router.delete('/:id', authorize('admin'), deleteLead);
router.post('/convert/:id', convertToCustomer);
router.post('/bulk-assign', authorize('admin'), bulkAssign);
router.post('/:id/call-notes', addCallNote);

module.exports = router;
