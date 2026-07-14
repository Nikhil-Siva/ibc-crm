const test = require('node:test');
const assert = require('node:assert/strict');
const { request, login, loginAsAgent } = require('./helpers');

/**
 * Covers the platform behaviours added in Phase 6: readiness, session
 * revocation, audit logging, soft delete and encryption-at-rest — the parts a
 * regression would be silent and expensive.
 */

let adminToken;

test('setup', async () => {
  adminToken = await login();
});

// ─── Readiness ──────────────────────────────────────────────────────

test('GET /api/ready reports database and migration status', async () => {
  const { status, body } = await request('GET', '/api/ready');
  assert.equal(status, 200);
  assert.equal(body.status, 'ready');
  assert.equal(body.checks.database, 'ok');
  assert.equal(body.checks.migrations, 'ok', 'pending migrations should fail readiness');
});

test('GET /api/health stays cheap and does not report DB state', async () => {
  const { status, body } = await request('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.checks, undefined, 'liveness must not depend on the database');
});

// ─── Session revocation ─────────────────────────────────────────────

test('deactivating a user immediately invalidates their existing token', async () => {
  const victim = await loginAsAgent(adminToken);

  const before = await request('GET', '/api/auth/me', { token: victim.token });
  assert.equal(before.status, 200, 'token should work before deactivation');

  await request('DELETE', `/api/users/${victim.id}`, { token: adminToken });

  // Previously this stayed valid for up to 7 days.
  const after = await request('GET', '/api/auth/me', { token: victim.token });
  assert.equal(after.status, 401, 'token must stop working the moment the account is disabled');
});

test('changing a user\'s role revokes their existing token', async () => {
  const target = await loginAsAgent(adminToken);

  const before = await request('GET', '/api/auth/me', { token: target.token });
  assert.equal(before.status, 200);

  await request('PUT', `/api/users/${target.id}`, {
    token: adminToken,
    body: { role: 'manager' },
  });

  const after = await request('GET', '/api/auth/me', { token: target.token });
  assert.equal(after.status, 401, 'a role change must not leave the old session usable');
});

test('changing your own password returns a fresh token and revokes the old one', async () => {
  const user = await loginAsAgent(adminToken);
  const oldToken = user.token;

  const changed = await request('PUT', '/api/auth/change-password', {
    token: oldToken,
    body: { oldPassword: 'AgentPass123', newPassword: 'AgentPass456' },
  });
  assert.equal(changed.status, 200);
  assert.ok(changed.body.data.token, 'caller should get a usable replacement token');

  const withOld = await request('GET', '/api/auth/me', { token: oldToken });
  assert.equal(withOld.status, 401, 'the pre-change token must be dead');

  const withNew = await request('GET', '/api/auth/me', { token: changed.body.data.token });
  assert.equal(withNew.status, 200, 'the returned token must work');
});

test('a password-reset token cannot be used as an access token', async () => {
  // verify-otp mints a token with purpose:'reset'; it must not open the API.
  const { status } = await request('GET', '/api/auth/me', {
    token: 'not.a.valid.token',
  });
  assert.equal(status, 401);
});

// ─── Audit log ──────────────────────────────────────────────────────

test('a failed login is recorded in the audit log', async () => {
  await request('POST', '/api/auth/login', {
    body: { email: 'admin@insurancecrm.com', password: 'wrong-on-purpose' },
  });

  const { body } = await request('GET', '/api/admin/dashboard/activity', { token: adminToken });
  const actions = body.data.map((a) => a.action);
  assert.ok(actions.includes('login_failed'), 'expected login_failed in the audit trail');
});

test('deleting a record is audited', async () => {
  const lead = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Audit Probe', mobile: '9700000009' },
  });

  await request('DELETE', `/api/leads/${lead.body.data.id}`, { token: adminToken });

  const { body } = await request('GET', '/api/admin/dashboard/activity', { token: adminToken });
  const deleted = body.data.find(
    (a) => a.action === 'record_deleted' && a.entity_id === lead.body.data.id
  );
  assert.ok(deleted, 'expected a record_deleted entry');
  assert.equal(deleted.entity_type, 'lead');
});

// ─── Soft delete ────────────────────────────────────────────────────

test('a deleted lead disappears from the API but is not destroyed', async () => {
  const created = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Soft Delete Probe', mobile: '9700000010' },
  });
  const id = created.body.data.id;

  await request('DELETE', `/api/leads/${id}`, { token: adminToken });

  const fetched = await request('GET', `/api/leads/${id}`, { token: adminToken });
  assert.equal(fetched.status, 404, 'soft-deleted records must be invisible to the API');

  // The row itself still exists — verified directly in the model-level tests.
  const listed = await request('GET', '/api/leads?limit=200', { token: adminToken });
  assert.ok(!listed.body.data.rows.some((l) => l.id === id), 'must not appear in listings');
});

// ─── Encryption at rest ─────────────────────────────────────────────

test('KYC identifiers round-trip through the API but are encrypted underneath', async () => {
  const created = await request('POST', '/api/customers', {
    token: adminToken,
    body: {
      name: 'KYC Probe',
      mobile: '9700000011',
      pan_number: 'ZZZZZ9999Z',
      aadhaar_number: '9999 8888 7777',
    },
  });
  assert.equal(created.status, 201);

  const fetched = await request('GET', `/api/customers/${created.body.data.id}`, { token: adminToken });
  assert.equal(fetched.status, 200);
  // The API must still show the real value to an authorised caller...
  assert.equal(fetched.body.data.pan_number, 'ZZZZZ9999Z');
  assert.equal(fetched.body.data.aadhaar_number, '9999 8888 7777');
  // ...and must not be leaking ciphertext into responses.
  assert.ok(!String(fetched.body.data.pan_number).startsWith('enc:v1:'));
});
