const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  register,
  login,
  getMe,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', auth, getMe);
router.put('/change-password', auth, changePassword);

module.exports = router;
