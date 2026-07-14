const test = require('node:test');
const assert = require('node:assert/strict');
const { request, login, loginAsAgent } = require('./helpers');

let adminToken;
let agent;
let leadId;
let agentLeadId;
let noteId;

test('setup: authenticate and create leads', async () => {
  adminToken = await login();
  agent = await loginAsAgent(adminToken);

  const lead = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Notes Lead', mobile: '9700000001' },
  });
  leadId = lead.body.data.id;

  // A lead the agent actually owns.
  const owned = await request('POST', '/api/leads', {
    token: adminToken,
    body: { name: 'Agent Lead', mobile: '9700000002', assigned_to: agent.id },
  });
  agentLeadId = owned.body.data.id;
});

test('POST /api/notes — happy path', async () => {
  const { status, body } = await request('POST', '/api/notes', {
    token: adminToken,
    body: { lead_id: leadId, body: 'Customer asked for a term quote.' },
  });
  assert.equal(status, 201);
  assert.equal(body.data.kind, 'manual');
  noteId = body.data.id;
});

test('POST /api/notes — empty body returns 400', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: adminToken,
    body: { lead_id: leadId, body: '   ' },
  });
  assert.equal(status, 400);
});

// A note must hang off exactly one subject — the model enforces it too.
test('POST /api/notes — both lead_id and customer_id returns 400', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: adminToken,
    body: { lead_id: leadId, customer_id: 1, body: 'ambiguous' },
  });
  assert.equal(status, 400);
});

test('POST /api/notes — neither subject returns 400', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: adminToken,
    body: { body: 'orphan note' },
  });
  assert.equal(status, 400);
});

test('POST /api/notes — unknown lead returns 404', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: adminToken,
    body: { lead_id: 99999999, body: 'ghost' },
  });
  assert.equal(status, 404);
});

// Notes must not become a side door onto records the agent can't read.
test('POST /api/notes — agent cannot note a lead it does not own', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: agent.token,
    body: { lead_id: leadId, body: 'should be blocked' },
  });
  assert.equal(status, 403);
});

test('POST /api/notes — agent can note its own lead', async () => {
  const { status } = await request('POST', '/api/notes', {
    token: agent.token,
    body: { lead_id: agentLeadId, body: 'my own lead' },
  });
  assert.equal(status, 201);
});

test('GET /api/notes — lists notes for a lead, newest first', async () => {
  const { status, body } = await request('GET', `/api/notes?lead_id=${leadId}`, { token: adminToken });
  assert.equal(status, 200);
  assert.ok(body.data.count >= 1);
  assert.ok(body.data.rows[0].author, 'expected the author to be included');
});

test('GET /api/notes — requires a subject', async () => {
  const { status } = await request('GET', '/api/notes', { token: adminToken });
  assert.equal(status, 400);
});

test('GET /api/notes — agent cannot read notes on another agent\'s lead', async () => {
  const { status } = await request('GET', `/api/notes?lead_id=${leadId}`, { token: agent.token });
  assert.equal(status, 403);
});

test('PUT /api/notes/:id — happy path', async () => {
  const { status, body } = await request('PUT', `/api/notes/${noteId}`, {
    token: adminToken,
    body: { body: 'Updated: wants 1cr cover.' },
  });
  assert.equal(status, 200);
  assert.match(body.data.body, /1cr cover/);
});

test('PUT /api/notes/:id — not found returns 404', async () => {
  const { status } = await request('PUT', '/api/notes/99999999', {
    token: adminToken,
    body: { body: 'nope' },
  });
  assert.equal(status, 404);
});

// A call note should produce a real Note row, not a string appended to a blob.
test('POST /api/leads/:id/call-notes writes a queryable note', async () => {
  await request('POST', `/api/leads/${leadId}/call-notes`, {
    token: adminToken,
    body: { outcome: 'connected', notes: 'Discussed premium options', duration_seconds: 90 },
  });

  const { body } = await request('GET', `/api/notes?lead_id=${leadId}`, { token: adminToken });
  const callNote = body.data.rows.find((n) => n.kind === 'call');
  assert.ok(callNote, 'expected a note with kind=call');
  assert.match(callNote.body, /premium options/);
});

test('DELETE /api/notes/:id — happy path (soft delete)', async () => {
  const { status } = await request('DELETE', `/api/notes/${noteId}`, { token: adminToken });
  assert.equal(status, 200);

  const after = await request('GET', `/api/notes?lead_id=${leadId}`, { token: adminToken });
  assert.ok(!after.body.data.rows.some((n) => n.id === noteId), 'deleted note must not be listed');
});
