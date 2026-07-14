const test = require('node:test');
const assert = require('node:assert/strict');
const { request, login, loginAsAgent } = require('./helpers');

let adminToken;
let agent;
let leadId;
let customerId;
let policyId;
let followupId;

test('setup: authenticate as admin and as an agent', async () => {
  adminToken = await login();
  agent = await loginAsAgent(adminToken);
  assert.ok(adminToken && agent.token);
});

// ─── Leads ──────────────────────────────────────────────────────────

test('POST /api/leads — happy path', async () => {
  const { status, body } = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Test Lead', mobile: '9811111111', source: 'Referral', priority: 'Hot' },
  });
  assert.equal(status, 201);
  leadId = body.data.id;
});

test('POST /api/leads — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'No Mobile' },
  });
  assert.equal(status, 400);
});

test('POST /api/leads — mass assignment of id is ignored', async () => {
  const { status, body } = await request('POST', '/api/leads', {
    token: adminToken,
    body: { id: 999999, name: 'Mass Assign Probe', mobile: '9811111112' },
  });
  assert.equal(status, 201);
  assert.notEqual(body.data.id, 999999, 'client-supplied id must not be honoured');
});

test('GET /api/leads — paginated envelope', async () => {
  const { status, body } = await request('GET', '/api/leads?page=1&limit=5', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data.rows));
  assert.equal(typeof body.data.count, 'number');
  assert.equal(body.data.page, 1);
});

test('GET /api/leads/pipeline — returns every status bucket', async () => {
  const { status, body } = await request('GET', '/api/leads/pipeline', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(body.data.New, 'expected a "New" bucket');
  assert.equal(typeof body.data.New.count, 'number');
  assert.ok(Array.isArray(body.data.New.leads));
});

test('GET /api/leads/:id — happy path', async () => {
  const { status, body } = await request('GET', `/api/leads/${leadId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.id, leadId);
});

test('GET /api/leads/:id — not found returns 404', async () => {
  const { status } = await request('GET', '/api/leads/99999999', { token: adminToken });
  assert.equal(status, 404);
});

test('GET /api/leads/:id — unauthenticated returns 401', async () => {
  const { status } = await request('GET', `/api/leads/${leadId}`);
  assert.equal(status, 401);
});

// Regression: getLeadById had no ownership check, so any agent could read any lead.
test('GET /api/leads/:id — agent cannot read a lead assigned to someone else', async () => {
  const { status } = await request('GET', `/api/leads/${leadId}`, { token: agent.token });
  assert.equal(status, 403);
});

test('PUT /api/leads/:id — happy path', async () => {
  const { status, body } = await request('PUT', `/api/leads/${leadId}`, {
    token: adminToken,
    body: { status: 'Interested' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.status, 'Interested');
});

test('PUT /api/leads/:id — agent cannot update a lead it does not own', async () => {
  const { status } = await request('PUT', `/api/leads/${leadId}`, {
    token: agent.token,
    body: { status: 'Closed Won' },
  });
  assert.equal(status, 403);
});

test('POST /api/leads/:id/call-notes — rejects an invalid outcome', async () => {
  const { status } = await request('POST', `/api/leads/${leadId}/call-notes`, {
    token: adminToken,
    body: { outcome: 'nonsense', notes: 'test' },
  });
  assert.equal(status, 400);
});

test('POST /api/leads/:id/call-notes — happy path writes a call log', async () => {
  const { status } = await request('POST', `/api/leads/${leadId}/call-notes`, {
    token: adminToken,
    body: { outcome: 'connected', duration_seconds: 42, notes: 'Spoke to customer' },
  });
  assert.equal(status, 200);
});

test('POST /api/leads/bulk-assign — requires admin', async () => {
  const { status } = await request('POST', '/api/leads/bulk-assign', {
    token: agent.token,
    body: { leadIds: [leadId], agentId: agent.id },
  });
  assert.equal(status, 403);
});

test('POST /api/leads/bulk-assign — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/leads/bulk-assign', {
    token: adminToken,
    body: { leadIds: [], agentId: agent.id },
  });
  assert.equal(status, 400);
});

test('DELETE /api/leads/:id — agent is forbidden', async () => {
  const { status } = await request('DELETE', `/api/leads/${leadId}`, { token: agent.token });
  assert.equal(status, 403);
});

// ─── Customers ──────────────────────────────────────────────────────

test('POST /api/customers — happy path', async () => {
  const { status, body } = await request('POST', '/api/customers', {
    token: adminToken,
    body: { name: 'Test Customer', mobile: '9822222222', city: 'Pune' },
  });
  assert.equal(status, 201);
  customerId = body.data.id;
});

test('POST /api/customers — validation failure returns 400', async () => {
  const { status } = await request('POST', '/api/customers', {
    token: adminToken,
    body: { name: 'No Mobile' },
  });
  assert.equal(status, 400);
});

test('GET /api/customers/:id — happy path', async () => {
  const { status, body } = await request('GET', `/api/customers/${customerId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.equal(body.data.id, customerId);
});

test('GET /api/customers/:id — not found returns 404', async () => {
  const { status } = await request('GET', '/api/customers/99999999', { token: adminToken });
  assert.equal(status, 404);
});

// Regression: customers had no agent scoping at all.
test('GET /api/customers/:id — agent cannot read a customer it does not own', async () => {
  const { status } = await request('GET', `/api/customers/${customerId}`, { token: agent.token });
  assert.equal(status, 403);
});

test('GET /api/customers/:id/policies — happy path', async () => {
  const { status, body } = await request('GET', `/api/customers/${customerId}/policies`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/customers/:id/documents — happy path', async () => {
  const { status, body } = await request('GET', `/api/customers/${customerId}/documents`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

// Regression: DELETE had auth but no authorize(), so any agent could delete any customer.
test('DELETE /api/customers/:id — agent is forbidden', async () => {
  const { status } = await request('DELETE', `/api/customers/${customerId}`, { token: agent.token });
  assert.equal(status, 403);
});

// ─── Policies ───────────────────────────────────────────────────────

test('POST /api/policies — happy path auto-calculates next_due_date', async () => {
  const { status, body } = await request('POST', '/api/policies', {
    token: adminToken,
    body: {
      customer_id: customerId,
      insurer: 'LIC',
      policy_type: 'Term',
      premium_frequency: 'Yearly',
      start_date: '2026-01-01',
      premium_amount: 12000,
    },
  });
  assert.equal(status, 201);
  assert.ok(body.data.next_due_date, 'next_due_date should be derived');
  policyId = body.data.id;
});

test('POST /api/policies — missing customer_id returns 400', async () => {
  const { status } = await request('POST', '/api/policies', {
    token: adminToken,
    body: { insurer: 'LIC' },
  });
  assert.equal(status, 400);
});

test('POST /api/policies — unknown customer returns 404', async () => {
  const { status } = await request('POST', '/api/policies', {
    token: adminToken,
    body: { customer_id: 99999999, insurer: 'LIC' },
  });
  assert.equal(status, 404);
});

test('GET /api/policies/renewals-due — happy path', async () => {
  const { status, body } = await request('GET', '/api/policies/renewals-due?days=30', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

test('GET /api/policies/:id — happy path', async () => {
  const { status } = await request('GET', `/api/policies/${policyId}`, { token: adminToken });
  assert.equal(status, 200);
});

test('DELETE /api/policies/:id — agent is forbidden', async () => {
  const { status } = await request('DELETE', `/api/policies/${policyId}`, { token: agent.token });
  assert.equal(status, 403);
});

// ─── Followups ──────────────────────────────────────────────────────

test('POST /api/followups — happy path', async () => {
  const { status, body } = await request('POST', '/api/followups', {
    token: adminToken,
    body: { lead_id: leadId, type: 'Call', scheduled_at: new Date().toISOString(), notes: 'Ring back' },
  });
  assert.equal(status, 201);
  followupId = body.data.id;
});

test('POST /api/followups — missing type returns 400', async () => {
  const { status } = await request('POST', '/api/followups', {
    token: adminToken,
    body: { lead_id: leadId, scheduled_at: new Date().toISOString() },
  });
  assert.equal(status, 400);
});

test('GET /api/followups/today — happy path', async () => {
  const { status, body } = await request('GET', '/api/followups/today', { token: adminToken });
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.data));
});

test('PUT /api/followups/:id/done — happy path', async () => {
  const { status, body } = await request('PUT', `/api/followups/${followupId}/done`, {
    token: adminToken,
    body: { outcome: 'Customer answered' },
  });
  assert.equal(status, 200);
  assert.equal(body.data.is_done, true);
});

test('DELETE /api/followups/:id — agent is forbidden', async () => {
  const { status } = await request('DELETE', `/api/followups/${followupId}`, { token: agent.token });
  assert.equal(status, 403);
});

// ─── Users ──────────────────────────────────────────────────────────

test('GET /api/users/profile/me — any role can read its own profile', async () => {
  const { status, body } = await request('GET', '/api/users/profile/me', { token: agent.token });
  assert.equal(status, 200);
  assert.equal(body.data.email, agent.email);
});

test('GET /api/users — agent is forbidden', async () => {
  const { status } = await request('GET', '/api/users', { token: agent.token });
  assert.equal(status, 403);
});

test('POST /api/users — enforces the password policy', async () => {
  const { status } = await request('POST', '/api/users', {
    token: adminToken,
    body: { name: 'Weak', email: `weak-user-${Date.now()}@example.com`, password: 'x', role: 'agent' },
  });
  assert.equal(status, 400);
});

// Regression: an admin could demote itself and lock the last admin out.
test('PUT /api/users/:id — admin cannot change its own role', async () => {
  const me = await request('GET', '/api/auth/me', { token: adminToken });
  const { status } = await request('PUT', `/api/users/${me.body.data.id}`, {
    token: adminToken,
    body: { role: 'agent' },
  });
  assert.equal(status, 400);
});

test('DELETE /api/users/:id — cannot deactivate self', async () => {
  const me = await request('GET', '/api/auth/me', { token: adminToken });
  const { status } = await request('DELETE', `/api/users/${me.body.data.id}`, { token: adminToken });
  assert.equal(status, 400);
});
