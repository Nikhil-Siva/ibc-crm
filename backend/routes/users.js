const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getMyProfile,
  updateMyProfile,
} = require('../controllers/usersController');

router.use(auth);

// Own profile (any role — must be BEFORE /:id to avoid route conflict)
router.get('/profile/me', getMyProfile);
router.put('/profile/me', updateMyProfile);

// Admin/manager routes
router.get('/', authorize('admin', 'manager'), getAllUsers);
router.get('/:id', authorize('admin', 'manager'), getUserById);
router.post('/', authorize('admin'), createUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deactivateUser);

module.exports = router;
