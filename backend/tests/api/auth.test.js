const test = require('node:test');
const assert = require('node:assert/strict');
const { request, login, ADMIN } = require('./helpers');

test('GET /api/health returns 200 and a structured body', async () => {
  const { status, body } = await request('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.success, true);
});

test('POST /api/auth/login — happy path returns a token and no password hash', async () => {
  const { status, body } = await request('POST', '/api/auth/login', { body: ADMIN });
  assert.equal(status, 200);
  assert.ok(body.data.token, 'expected a JWT');
  assert.equal(body.data.user.password_hash, undefined, 'password_hash must never be serialised');
});

test('POST /api/auth/login — wrong password returns 401, not 500', async () => {
  const { status, body } = await request('POST', '/api/auth/login', {
    body: { email: ADMIN.email, password: 'definitely-not-the-password' },
  });
  assert.equal(status, 401);
  assert.equal(body.success, false);
});

test('POST /api/auth/login — missing fields returns 400', async () => {
  const { status } = await request('POST', '/api/auth/login', { body: { email: ADMIN.email } });
  assert.equal(status, 400);
});

test('GET /api/auth/me — requires a token', async () => {
  const { status } = await request('GET', '/api/auth/me');
  assert.equal(status, 401);
});

test('GET /api/auth/me — rejects a malformed token', async () => {
  const { status } = await request('GET', '/api/auth/me', { token: 'not-a-real-jwt' });
  assert.equal(status, 401);
});

test('GET /api/auth/me — happy path', async () => {
  const token = await login();
  const { status, body } = await request('GET', '/api/auth/me', { token });
  assert.equal(status, 200);
  assert.equal(body.data.email, ADMIN.email);
  assert.equal(body.data.password_hash, undefined);
});

// Regression: register used to pass req.body.role straight into User.create,
// so anyone could POST role:'admin' and mint themselves an admin account.
test('POST /api/auth/register — cannot self-assign the admin role', async () => {
  const email = `escalation-probe-${Date.now()}@example.com`;
  const { status, body } = await request('POST', '/api/auth/register', {
    body: { name: 'Probe', email, mobile: '9000000009', password: 'ProbePass123', role: 'admin' },
  });

  assert.equal(status, 201);
  assert.equal(body.data.user.role, 'agent', 'requested role must be ignored');
});

test('POST /api/auth/register — enforces the password policy', async () => {
  const { status } = await request('POST', '/api/auth/register', {
    body: { name: 'Weak', email: `weak-${Date.now()}@example.com`, mobile: '9000000010', password: 'abc' },
  });
  assert.equal(status, 400);
});

test('POST /api/auth/register — rejects a duplicate email', async () => {
  const { status } = await request('POST', '/api/auth/register', {
    body: { name: 'Dupe', email: ADMIN.email, mobile: '9000000011', password: 'DupePass123' },
  });
  assert.equal(status, 400);
});

test('POST /api/auth/forgot-password — does not leak whether an account exists', async () => {
  const real = await request('POST', '/api/auth/forgot-password', { body: { email: ADMIN.email } });
  const fake = await request('POST', '/api/auth/forgot-password', { body: { email: 'nobody@nowhere.invalid' } });

  assert.equal(real.status, 200);
  assert.equal(fake.status, 200);
  assert.equal(real.body.success, fake.body.success);
});

test('POST /api/auth/verify-otp — rejects a bogus OTP', async () => {
  const { status } = await request('POST', '/api/auth/verify-otp', {
    body: { email: ADMIN.email, otp: '000000' },
  });
  assert.equal(status, 400);
});

test('POST /api/auth/reset-password — rejects a forged reset token', async () => {
  const { status } = await request('POST', '/api/auth/reset-password', {
    body: { resetToken: 'forged.token.value', newPassword: 'NewPass123' },
  });
  assert.equal(status, 400);
});

test('404 handler returns structured JSON, not an HTML stack trace', async () => {
  const { status, body } = await request('GET', '/api/this-route-does-not-exist');
  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.ok(body.message, 'expected a JSON message');
});
