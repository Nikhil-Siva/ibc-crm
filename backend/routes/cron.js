const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const cronAuth = require('../middleware/cronAuth');
const { runJob } = require('../controllers/cronController');

// Legitimate use is ~4 requests/day (one per scheduled job). This is on top
// of the shared secret — defense in depth against someone trying to guess it.
const cronLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many cron trigger requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/run/:job', cronLimiter, cronAuth, runJob);

module.exports = router;
