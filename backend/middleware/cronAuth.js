const crypto = require('crypto');

/**
 * Authenticates the external cron-trigger endpoint (see routes/cron.js).
 *
 * This is not a user — it's an external scheduler (cron-job.org or similar)
 * calling in over plain HTTP with a shared secret, because free hosts like
 * Render's web-service tier suspend the whole process when idle, so
 * in-process node-cron timers never fire while nobody is browsing the site.
 * An external ping both wakes the process and guarantees the job runs on
 * schedule regardless of traffic.
 *
 * Fails CLOSED: if CRON_SECRET isn't configured, the route refuses every
 * request rather than silently accepting unauthenticated ones. An unset
 * secret must never mean "anyone can trigger this."
 */
const cronAuth = (req, res, next) => {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    return res.status(503).json({
      success: false,
      message: 'Cron trigger is not configured (CRON_SECRET unset).',
    });
  }

  const provided = req.headers['x-cron-secret'];
  if (!provided) {
    return res.status(401).json({ success: false, message: 'Missing X-Cron-Secret header.' });
  }

  // Constant-time comparison — but only once lengths already match; comparing
  // lengths first leaks nothing useful (the secret is long and unguessable
  // regardless), and timingSafeEqual requires equal-length buffers anyway.
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(configured));
  const authorized = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!authorized) {
    return res.status(401).json({ success: false, message: 'Invalid cron secret.' });
  }

  next();
};

module.exports = cronAuth;
