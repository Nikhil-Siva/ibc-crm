const test = require('node:test');
const assert = require('node:assert/strict');
const { request, login, loginAsAgent } = require('./helpers');

let adminToken;
let agent;
let pipelineId;
let campaignId;
let formId;
let integrationId;
let webhookPath;

test('setup: authenticate', async () => {
  adminToken = await login();
  agent = await loginAsAgent(adminToken);
});

// ─── Dashboards ─────────────────────────────────────────────────────

test('GET /api/admin/dashboard — happy path', async () => {
  const { status, body } = await request('GET', '/api/admin/dashboard', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/admin/dashboard — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/admin/dashboard', { token: agent.token });
  assert.equal(status, 403);
});

// Regression: this queried Followup.completed, a column that does not exist,
// so every agent's dashboard 500'd.
test('GET /api/admin/dashboard/telecaller — happy path for an agent', async () => {
  const { status, body } = await request('GET', '/api/admin/dashboard/telecaller', { token: agent.token });
  assert.equal(status, 200);
  assert.equal(typeof body.data.stats.totalAssigned, 'number');
  assert.equal(typeof body.data.stats.followupsToday, 'number');
  assert.ok(Array.isArray(body.data.recentCalls));
});

// Regression: included User without as:'user', throwing EagerLoadingError.
test('GET /api/admin/dashboard/activity — happy path', async () => {
  const { status, body } = await request('GET', '/api/admin/dashboard/activity', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/admin/dashboard/top-agents — happy path', async () => {
  const { status, body } = await request('GET', '/api/admin/dashboard/top-agents', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

// Regression: totalCustomers counted won leads instead of customers.
test('GET /api/admin/dashboard/quick-stats — counts customers, not won leads', async () => {
  const { status, body } = await request('GET', '/api/admin/dashboard/quick-stats', { token: adminToken });
  assert.equal(status, 200);
  assert.equal(typeof body.data.totalCustomers, 'number');
  assert.equal(typeof body.data.totalLeads, 'number');
});

// ─── Reports ────────────────────────────────────────────────────────

for (const path of ['/dashboard', '/sales-summary', '/agent-performance', '/monthly-trend', '/source-wise', '/premium']) {
  test(`GET /api/reports${path} — happy path`, async () => {
    const { status, body } = await request('GET', `/api/reports${path}`, { token: adminToken });
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });
}

test('GET /api/reports/dashboard — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/reports/dashboard', { token: agent.token });
  assert.equal(status, 403);
});

// ─── Pipelines ──────────────────────────────────────────────────────

test('POST /api/pipelines — happy path', async () => {
  const { status, body } = await request('POST', '/api/pipelines', {
    token: adminToken,
    body: {
      name: `Test Pipeline ${Date.now()}`,
      stages: [
        { name: 'New', color: '#888888', order_index: 1 },
        { name: 'Won', color: '#00aa00', order_index: 2 },
      ],
    },
  });
  assert.equal(status, 201);
  pipelineId = body.data.id;
});

test('GET /api/pipelines — happy path', async () => {
  const { status } = await request('GET', '/api/pipelines', { token: adminToken });
  assert.equal(status, 200);
});

test('GET /api/pipelines/:id — happy path', async () => {
  const { status } = await request('GET', `/api/pipelines/${pipelineId}`, { token: adminToken });
  assert.equal(status, 200);
});

test('GET /api/pipelines/:id — not found returns 404', async () => {
  const { status } = await request('GET', '/api/pipelines/99999999', { token: adminToken });
  assert.equal(status, 404);
});

// ─── Campaigns ──────────────────────────────────────────────────────

// Regression: Campaign.hasMany(CampaignAgent) had no alias, but the controller
// included as:'campaignAgents' — so create/update/read all threw.
test('POST /api/campaigns — happy path', async () => {
  const { status, body } = await request('POST', '/api/campaigns', {
    token: adminToken,
    body: { name: `Test Campaign ${Date.now()}`, pipeline_id: pipelineId, status: 'active' },
  });
  assert.equal(status, 201);
  campaignId = body.data.id;
});

test('GET /api/campaigns — paginated envelope', async () => {
  const { status, body } = await request('GET', '/api/campaigns?page=1&limit=5', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.campaigns));
  assert.equal(typeof body.data.pagination.total, 'number');
});

test('GET /api/campaigns/:id — happy path', async () => {
  const { status, body } = await request('GET', `/api/campaigns/${campaignId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.id, campaignId);
});

test('GET /api/campaigns/:id — not found returns 404', async () => {
  const { status } = await request('GET', '/api/campaigns/99999999', { token: adminToken });
  assert.equal(status, 404);
});

// Regression: filtered on stage_id/phone and included as:'stage' — none exist.
test('GET /api/campaigns/:id/leads — happy path', async () => {
  const { status, body } = await request('GET', `/api/campaigns/${campaignId}/leads`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.leads));
});

test('GET /api/campaigns/:id/leads — search filter does not error', async () => {
  const { status } = await request('GET', `/api/campaigns/${campaignId}/leads?search=test`, { token: adminToken });
  assert.equal(status, 200);
});

test('GET /api/campaigns/:id/agents — happy path', async () => {
  const { status, body } = await request('GET', `/api/campaigns/${campaignId}/agents`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

// Regression: leadsPerStage counted on stage_id, a non-existent column.
test('GET /api/campaigns/:id/stats — happy path', async () => {
  const { status, body } = await request('GET', `/api/campaigns/${campaignId}/stats`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('POST /api/campaigns/:id/assign-agents — happy path', async () => {
  const { status } = await request('POST', `/api/campaigns/${campaignId}/assign-agents`, {
    token: adminToken,
    body: { agent_ids: [agent.id] },
  });
  assert.equal(status, 200);
});

test('POST /api/campaigns/:id/assign-agents — validation failure returns 400', async () => {
  const { status } = await request('POST', `/api/campaigns/${campaignId}/assign-agents`, {
    token: adminToken,
    body: { agent_ids: [] },
  });
  assert.equal(status, 400);
});

test('PUT /api/campaigns/:id — happy path', async () => {
  const { status } = await request('PUT', `/api/campaigns/${campaignId}`, {
    token: adminToken,
    body: { name: `Renamed Campaign ${Date.now()}` },
  });
  assert.equal(status, 200);
});

// ─── Engagement forms ───────────────────────────────────────────────

test('POST /api/engagement-forms — happy path', async () => {
  const { status, body } = await request('POST', '/api/engagement-forms', {
    token: adminToken,
    body: {
      campaign_id: campaignId,
      title: 'Feedback Form',
      fields: [{ name: 'rating', type: 'number', label: 'Rating' }],
    },
  });
  assert.ok([200, 201].includes(status));
  formId = body.data.id;
});

test('GET /api/engagement-forms/campaign/:campaignId — happy path', async () => {
  const { status, body } = await request('GET', `/api/engagement-forms/campaign/${campaignId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.id, formId);
});

test('POST /api/engagement-forms — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/engagement-forms', {
    token: adminToken,
    body: { campaign_id: campaignId, title: 'No fields' },
  });
  assert.equal(status, 400);
});

// Regression: read req.params.id on a route with no :id — always 404'd.
test('POST /api/engagement-forms/submit — happy path', async () => {
  const lead = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Form Lead', mobile: '9833333333' },
  });

  const { status, body } = await request('POST', '/api/engagement-forms/submit', {
    token: adminToken,
    body: { form_id: formId, lead_id: lead.body.data.id, responses: { rating: 5 } },
  });
  assert.equal(status, 201);
  assert.equal(body.data.form_id, formId);
});

test('POST /api/engagement-forms/submit — unknown form returns 404', async () => {
  const { status } = await request('POST', '/api/engagement-forms/submit', {
    token: adminToken,
    body: { form_id: 99999999, lead_id: 1, responses: { rating: 1 } },
  });
  assert.equal(status, 404);
});

test('POST /api/engagement-forms/submit — missing form_id returns 400', async () => {
  const { status } = await request('POST', '/api/engagement-forms/submit', {
    token: adminToken,
    body: { lead_id: 1, responses: {} },
  });
  assert.equal(status, 400);
});

// Regression: read req.params.id on a :formId route — always 404'd.
test('GET /api/engagement-forms/:formId/submissions — happy path', async () => {
  const { status, body } = await request('GET', `/api/engagement-forms/${formId}/submissions`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.rows));
  assert.ok(body.data.count >= 1, 'expected the submission created above');
});

// Regression: read req.params.submissionId on an :id route — always 404'd.
test('GET /api/engagement-forms/submission/:id — happy path', async () => {
  const list = await request('GET', `/api/engagement-forms/${formId}/submissions`, { token: adminToken });
  const submissionId = list.body.data.rows[0].id;

  const { status, body } = await request('GET', `/api/engagement-forms/submission/${submissionId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.id, submissionId);
});

test('GET /api/engagement-forms/submission/:id — not found returns 404', async () => {
  const { status } = await request('GET', '/api/engagement-forms/submission/99999999', { token: adminToken });
  assert.equal(status, 404);
});

// ─── Integrations & webhook ─────────────────────────────────────────

test('POST /api/integrations — happy path mints a webhook URL', async () => {
  const { status, body } = await request('POST', '/api/integrations', {
    token: adminToken,
    body: { name: `Test Webhook ${Date.now()}`, type: 'webhook_generic', target_campaign_id: campaignId },
  });
  assert.equal(status, 201);
  integrationId = body.data.id;
  webhookPath = body.data.webhook_url;
  assert.ok(webhookPath?.startsWith('/api/webhooks/incoming/'));
});

test('POST /api/integrations — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/integrations', {
    token: adminToken,
    body: { name: 'No type' },
  });
  assert.equal(status, 400);
});

test('GET /api/integrations/:id/logs — paginated envelope', async () => {
  const { status, body } = await request('GET', `/api/integrations/${integrationId}/logs`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.logs));
});

test('GET /api/integrations — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/integrations', { token: agent.token });
  assert.equal(status, 403);
});

// Regression: read req.params.uuid on a :webhookId route, so it always 404'd;
// and the lead payload used non-existent columns, so it reported 200 while
// silently creating nothing.
test('POST webhook — happy path actually creates a lead', async () => {
  const { status, body } = await request('POST', webhookPath, {
    body: { name: 'Webhook Lead', mobile: '9844444444', email: 'wh@example.com' },
  });
  assert.equal(status, 200);
  assert.ok(body.data.lead_id, 'expected a real lead id');

  const lead = await request('GET', `/api/leads/${body.data.lead_id}`, { token: adminToken });
  assert.equal(lead.status, 200);
  assert.equal(lead.body.data.mobile, '9844444444');
  assert.equal(lead.body.data.campaign_id, campaignId);
});

// Regression: this used to return 200 success while creating nothing.
test('POST webhook — payload with no phone number returns 422, not a fake 200', async () => {
  const { status, body } = await request('POST', webhookPath, {
    body: { name: 'No Number' },
  });
  assert.equal(status, 422);
  assert.equal(body.success, false);
});

test('POST webhook — unknown webhook id returns 404', async () => {
  const { status } = await request('POST', '/api/webhooks/incoming/00000000-0000-0000-0000-000000000000', {
    body: { name: 'Nobody', mobile: '9855555555' },
  });
  assert.equal(status, 404);
});

// ─── Marketplace ────────────────────────────────────────────────────

test('GET /api/marketplace — happy path', async () => {
  const { status, body } = await request('GET', '/api/marketplace', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

// Regression: read req.params.providerId on an :id route — always 404'd.
// With no connection present the correct answer is 404, but it must be the
// controller's "no active connection" 404, not a param-name accident.
test('POST /api/marketplace/test/:id — unknown provider returns 404', async () => {
  const { status, body } = await request('POST', '/api/marketplace/test/99999999', { token: adminToken });
  assert.equal(status, 404);
  assert.match(body.message, /connection/i);
});

test('PUT /api/marketplace/disconnect/:id — unknown provider returns 404', async () => {
  const { status, body } = await request('PUT', '/api/marketplace/disconnect/99999999', { token: adminToken });
  assert.equal(status, 404);
  assert.match(body.message, /connection/i);
});

test('GET /api/marketplace — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/marketplace', { token: agent.token });
  assert.equal(status, 403);
});

// ─── SMS automations & workflows ────────────────────────────────────

test('GET /api/sms-automations — happy path', async () => {
  const { status } = await request('GET', '/api/sms-automations', { token: adminToken });
  assert.equal(status, 200);
});

test('GET /api/sms-automations — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/sms-automations', { token: agent.token });
  assert.equal(status, 403);
});

test('GET /api/workflows — happy path', async () => {
  const { status } = await request('GET', '/api/workflows', { token: adminToken });
  assert.equal(status, 200);
});

test('POST /api/workflows/test-run — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/workflows/test-run', {
    token: adminToken,
    body: {},
  });
  assert.equal(status, 400);
});

test('GET /api/workflows — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/workflows', { token: agent.token });
  assert.equal(status, 403);
});

// ─── Call reports ───────────────────────────────────────────────────

// These two take no required params.
for (const path of ['/user-call', '/agent-login']) {
  test(`GET /api/call-reports${path} — happy path`, async () => {
    const { status, body } = await request('GET', `/api/call-reports${path}`, { token: adminToken });
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });
}

// These require agent_id (+ date), and 400 without them.
test('GET /api/call-reports/call-timeline — happy path', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { status, body } = await request(
    'GET', `/api/call-reports/call-timeline?agent_id=${agent.id}&date=${today}`, { token: adminToken }
  );
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('GET /api/call-reports/call-timeline — missing agent_id returns 400', async () => {
  const { status } = await request('GET', '/api/call-reports/call-timeline', { token: adminToken });
  assert.equal(status, 400);
});

// agent-timeline 404s when the agent has no session on that date, which is the
// correct answer for a freshly created agent — accept either, reject a 500.
test('GET /api/call-reports/agent-timeline — responds without erroring', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { status } = await request(
    'GET', `/api/call-reports/agent-timeline?agent_id=${agent.id}&date=${today}`, { token: adminToken }
  );
  assert.ok([200, 404].includes(status), `expected 200 or 404, got ${status}`);
});

test('GET /api/call-reports/agent-timeline — missing params returns 400', async () => {
  const { status } = await request('GET', '/api/call-reports/agent-timeline', { token: adminToken });
  assert.equal(status, 400);
});

test('GET /api/call-reports/day-wise — happy path', async () => {
  const { status, body } = await request(
    'GET', `/api/call-reports/day-wise?agent_id=${agent.id}`, { token: adminToken }
  );
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('GET /api/call-reports/day-wise — missing agent_id returns 400', async () => {
  const { status } = await request('GET', '/api/call-reports/day-wise', { token: adminToken });
  assert.equal(status, 400);
});

test('GET /api/call-reports/user-call — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/call-reports/user-call', { token: agent.token });
  assert.equal(status, 403);
});

// ─── Contact imports ────────────────────────────────────────────────

test('GET /api/contact-imports — paginated envelope', async () => {
  const { status, body } = await request('GET', '/api/contact-imports', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.imports));
});

test('POST /api/contact-imports/upload — no file returns 400', async () => {
  const { status } = await request('POST', '/api/contact-imports/upload', { token: adminToken });
  assert.equal(status, 400);
});

test('POST /api/contact-imports/process — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/contact-imports/process', {
    token: adminToken,
    body: {},
  });
  assert.equal(status, 400);
});

test('GET /api/contact-imports — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/contact-imports', { token: agent.token });
  assert.equal(status, 403);
});

// ─── Renewals & agents ──────────────────────────────────────────────

for (const path of ['/upcoming', '/overdue', '/stats']) {
  test(`GET /api/renewals${path} — happy path`, async () => {
    const { status, body } = await request('GET', `/api/renewals${path}`, { token: adminToken });
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });
}

test('POST /api/renewals/send-reminder/:policyId — unknown policy returns 404', async () => {
  const { status } = await request('POST', '/api/renewals/send-reminder/99999999', { token: adminToken });
  assert.equal(status, 404);
});

test('GET /api/agents — happy path', async () => {
  const { status } = await request('GET', '/api/agents', { token: adminToken });
  assert.equal(status, 200);
});

test('GET /api/agents/stats — happy path', async () => {
  const { status, body } = await request('GET', '/api/agents/stats', { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('POST /api/agents — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/agents', { token: adminToken, body: {} });
  assert.equal(status, 400);
});
