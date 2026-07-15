/**
 * Shared helpers for the API integration tests.
 *
 * These run against a server that is already listening (npm run dev), rather
 * than importing server.js — server.js calls app.listen() and schedules cron
 * jobs on require, so importing it would bind a port and never settle.
 */

// Load .env so `npm test` works on its own, the way the README says it does.
// Some tests need the same secrets the server was started with (CRON_SECRET,
// for one) — without this they'd only pass when the caller happened to export
// them by hand. CI sets these as real env vars, which take precedence, so this
// changes nothing there.
require('dotenv').config();

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5000';

const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@insurancecrm.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'Admin@123',
};

/**
 * Perform an API request. Returns { status, body } — never throws on non-2xx,
 * because asserting on status codes is the point of these tests.
 */
const request = async (method, path, { token, body, raw } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Keep the raw text so a test failure shows an HTML error page or a stack
    // trace rather than a confusing JSON parse error.
    parsed = { __unparsed: text.slice(0, 500) };
  }

  return { status: res.status, body: parsed };
};

/**
 * Log in and return a bearer token.
 *
 * Memoised per credential: /api/auth is rate limited to 30 POSTs per 15 minutes
 * per IP, and re-logging in for every test burns that budget for no benefit.
 */
const tokenCache = new Map();

const login = async (credentials = ADMIN) => {
  const cacheKey = credentials.email;
  if (tokenCache.has(cacheKey)) return tokenCache.get(cacheKey);

  const { status, body } = await request('POST', '/api/auth/login', { body: credentials });
  if (status === 429) {
    throw new Error(
      'Login rate limited (429). Start the server with RATE_LIMIT_AUTH_MAX=500 to run the suite.'
    );
  }
  if (status !== 200 || !body?.data?.token) {
    throw new Error(`Login failed (${status}): ${JSON.stringify(body).slice(0, 200)}`);
  }

  tokenCache.set(cacheKey, body.data.token);
  return body.data.token;
};

/**
 * Create an agent-role user and return its token, for testing role boundaries.
 * Reuses the account across runs — registration is idempotent by email here.
 */
const loginAsAgent = async (adminToken) => {
  const email = `test-agent-${Date.now()}@example.com`;
  const password = 'AgentPass123';

  const created = await request('POST', '/api/users', {
    token: adminToken,
    body: { name: 'Test Agent', email, mobile: '9000000001', password, role: 'agent' },
  });
  if (created.status !== 201) {
    throw new Error(`Could not create agent (${created.status}): ${JSON.stringify(created.body).slice(0, 200)}`);
  }

  return { token: await login({ email, password }), email, id: created.body.data.id };
};

module.exports = { BASE_URL, ADMIN, request, login, loginAsAgent };
