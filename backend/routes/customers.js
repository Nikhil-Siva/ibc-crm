const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPolicies,
  getCustomerDocuments,
} = require('../controllers/customersController');

// All routes are auth protected
router.use(auth);

router.get('/', getAllCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', authorize('admin'), deleteCustomer);
router.get('/:id/policies', getCustomerPolicies);
router.get('/:id/documents', getCustomerDocuments);

module.exports = router;
