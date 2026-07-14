const test = require('node:test');
const assert = require('node:assert/strict');
const { BASE_URL } = require('./helpers');

/**
 * POST /api/cron/run/:job — the external-scheduler trigger that lets reminder
 * jobs run even while a free-tier host (Render) has suspended the process for
 * inactivity. Requires CRON_SECRET (set in CI — see .github/workflows/ci.yml).
 */

const SECRET = process.env.CRON_SECRET;

const triggerCron = (job, secret) =>
  fetch(`${BASE_URL}/api/cron/run/${job}`, {
    method: 'POST',
    headers: secret !== undefined ? { 'X-Cron-Secret': secret } : {},
  });

test('POST /api/cron/run/:job — missing secret returns 401', async () => {
  const res = await triggerCron('renewal-reminders');
  assert.equal(res.status, 401);
});

test('POST /api/cron/run/:job — wrong secret returns 401', async () => {
  const res = await triggerCron('renewal-reminders', 'definitely-not-the-secret');
  assert.equal(res.status, 401);
});

test('POST /api/cron/run/:job — unknown job name returns 400', async () => {
  const res = await triggerCron('not-a-real-job', SECRET);
  assert.equal(res.status, 400);
});

// One test per job — each must actually run, not just pass auth.
for (const job of ['renewal-reminders', 'followup-digest', 'birthday-wishes', 'weekly-summary']) {
  test(`POST /api/cron/run/${job} — correct secret runs the job`, async () => {
    const res = await triggerCron(job, SECRET);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.job, job);
    assert.ok(body.ranAt, 'expected a ranAt timestamp');
  });
}

// Regression: an unset CRON_SECRET must refuse every request, not silently
// allow them. Tested at the middleware level (tests/api/helpers.js's server
// runs with CRON_SECRET set, and dotenv won't let a runtime env deletion
// stick — see middleware/cronAuth.js for the direct unit-style check this
// mirrors).
test('cronAuth middleware fails closed when CRON_SECRET is unset', () => {
  delete process.env.CRON_SECRET;
  const cronAuth = require('../../middleware/cronAuth');

  let statusSeen;
  let bodySeen;
  const res = {
    status(code) { statusSeen = code; return this; },
    json(body) { bodySeen = body; return this; },
  };

  cronAuth({ headers: {} }, res, () => {
    throw new Error('next() must not be called when CRON_SECRET is unset');
  });

  assert.equal(statusSeen, 503);
  assert.equal(bodySeen.success, false);

  // Restore for any test that runs after this one in the same process.
  process.env.CRON_SECRET = SECRET;
});
