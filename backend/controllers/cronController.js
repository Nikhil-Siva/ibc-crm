const reminderService = require('../services/reminderService');
const { runAsSystem } = require('../services/tenancy');

/**
 * Jobs reachable via POST /api/cron/run/:job (see routes/cron.js).
 *
 * Same functions server.js's in-process node-cron calls — this is a second
 * way to invoke them, not a second implementation. Each one is already
 * idempotent per day via reminder_logs' unique dedupe_key (see
 * services/reminderService.js), so it's harmless if both the in-process
 * schedule and an external ping happen to fire around the same time.
 */
const JOBS = {
  'renewal-reminders': () => reminderService.sendRenewalReminders(),
  'followup-digest': () => reminderService.sendFollowupDigest(),
  'birthday-wishes': () => reminderService.sendBirthdayWishes(),
  'weekly-summary': () => reminderService.sendWeeklySummary(),
};

const runJob = async (req, res) => {
  const { job } = req.params;
  const handler = JOBS[job];

  if (!handler) {
    return res.status(400).json({
      success: false,
      message: `Unknown job "${job}". Valid jobs: ${Object.keys(JOBS).join(', ')}.`,
    });
  }

  try {
    // Sweeps every organization, same as the in-process scheduler.
    await runAsSystem(handler);
    return res.status(200).json({ success: true, job, ranAt: new Date().toISOString() });
  } catch (error) {
    console.error(`[cron] ${job} failed:`, error.message);
    return res.status(500).json({ success: false, message: 'Job failed. Check server logs.' });
  }
};

module.exports = { runJob, JOBS };
