const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getAllPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getRenewalsDue,
} = require('../controllers/policiesController');

// All routes are auth protected
router.use(auth);

router.get('/', getAllPolicies);
router.get('/renewals-due', getRenewalsDue);
router.get('/:id', getPolicyById);
router.post('/', createPolicy);
router.put('/:id', updatePolicy);
router.delete('/:id', authorize('admin'), deletePolicy);

module.exports = router;
