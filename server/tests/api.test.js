const https = require('https');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

let BASE = 'https://localhost:4001';
let serverChild = null;

async function detectBase() {
  // Try HTTPS health; if it fails, fall back to HTTP
  try {
    const r = await fetchJson('/api/v1/health', 'https');
    if (r && r.status === 200) { BASE = 'https://localhost:4001'; return; }
  } catch {}
  BASE = 'http://localhost:4001';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ensureServerRunning() {
  try {
    const r = await fetchJson('/api/v1/health');
    if (r && r.status === 200) return true;
  } catch {}
  // Start server as child
  try {
    const cwd = path.join(__dirname, '..');
    serverChild = spawn(process.execPath, ['src/server.js'], { cwd, stdio: 'ignore' });
    // Wait for health
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      try { const r = await fetchJson('/api/v1/health'); if (r && r.status === 200) return true; } catch {}
    }
  } catch {}
  return false;
}

function fetchJson(path, scheme) {
  const url = `${scheme ? scheme : BASE.startsWith('https') ? 'https' : 'http'}://localhost:4001${path}`;
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method: 'GET', rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const ct = String(res.headers['content-type'] || '').toLowerCase();
          if (ct.includes('application/json')) {
            resolve({ status: res.statusCode, json: data ? JSON.parse(data) : {} });
          } else {
            try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, json: {}, text: data }); }
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchText(path) {
  const url = `${BASE}${path}`;
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method: 'GET', rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, text: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

function fetchHead(path) {
  const url = `${BASE}${path}`;
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method: 'HEAD', rejectUnauthorized: false }, (res) => {
      resolve({ status: res.statusCode, headers: res.headers || {} });
    });
    req.on('error', reject);
    req.end();
  });
}

function postJson(path, body) {
  const url = `${BASE}${path}`;
  const mod = url.startsWith('https') ? https : http;
  const payload = Buffer.from(JSON.stringify(body || {}));
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method: 'POST', rejectUnauthorized: false, headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: data ? JSON.parse(data) : {} }); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchMatrixFor(userId) {
  const r = await fetchJson(`/api/v1/state-matrix?platform=web&userId=${encodeURIComponent(userId || 'tester')}`);
  if (r.status !== 200) throw new Error('matrix');
  return r.json?.config?.checkoutStatus || r.json.checkoutStatus || r.json.config.checkoutStatus;
}

async function ensureNotCheckedOut() {
  const status = await fetchMatrixFor('ensure');
  if (status.isCheckedOut && status.checkedOutUserId) {
    await postJson('/api/v1/checkin', { userId: status.checkedOutUserId });
  }
}

async function ensureUnfinalized() {
  try { await postJson('/api/v1/unfinalize', { userId: 'ensure' }); } catch {}
}

async function ensureFinalized() {
  try { await postJson('/api/v1/finalize', { userId: 'ensure' }); } catch {}
}

describe('API', () => {
  beforeAll(async () => {
    await detectBase();
    await ensureServerRunning();
  });
  afterAll(() => {
    try { if (serverChild) serverChild.kill(); } catch {}
  });
  test('health', async () => {
    const r = await fetchJson('/api/v1/health');
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
  });

  test('state-matrix', async () => {
    const r = await fetchJson('/api/v1/state-matrix?platform=web&userId=tester');
    expect(r.status).toBe(200);
    expect(r.json.config).toBeTruthy();
  });

  test('saveProgressBtn true only for owner checkout and not final', async () => {
    // Ensure unfinalized and not checked out
    await ensureUnfinalized();
    await ensureNotCheckedOut();

    // No checkout -> false
    let r = await fetchJson('/api/v1/state-matrix?platform=web&userId=a');
    expect(r.json.config.buttons.saveProgressBtn).toBeFalsy();

    // Checkout by A -> true for A, false for B
    await postJson('/api/v1/checkout', { userId: 'a' });
    await sleep(100); // allow state to persist
    r = await fetchJson('/api/v1/state-matrix?platform=web&userId=a');
    expect(r.json.config.buttons.saveProgressBtn).toBe(true);
    r = await fetchJson('/api/v1/state-matrix?platform=web&userId=b');
    expect(r.json.config.buttons.saveProgressBtn).toBeFalsy();

    // Finalize -> false even for owner
    await postJson('/api/v1/finalize', { userId: 'a' });
    r = await fetchJson('/api/v1/state-matrix?platform=web&userId=a');
    expect(r.json.config.buttons.saveProgressBtn).toBeFalsy();

    // Cleanup
    await postJson('/api/v1/unfinalize', { userId: 'a' });
    await ensureNotCheckedOut();
  });

  test('send-vendor modal schema is available', async () => {
    const r = await fetchJson('/api/v1/ui/modal/send-vendor?userId=tester');
    expect(r.status).toBe(200);
    expect(r.json.schema).toBeTruthy();
    expect(Array.isArray(r.json.schema.fields)).toBe(true);
  });

  test('save-progress endpoint enforces ownership/final and accepts valid docx-like bytes', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    // Not checked out -> 409
    let res = await postJson('/api/v1/save-progress', { userId: 'x', base64: Buffer.from('PKTEST').toString('base64') });
    expect(res.status).toBe(409);

    // Checkout by a
    await postJson('/api/v1/checkout', { userId: 'a' });
    // Wrong user -> 409
    res = await postJson('/api/v1/save-progress', { userId: 'b', base64: Buffer.from('PKTEST').toString('base64') });
    expect(res.status).toBe(409);
    // Invalid payload -> 400
    res = await postJson('/api/v1/save-progress', { userId: 'a', base64: Buffer.from('NOTZIP').toString('base64') });
    expect(res.status).toBe(400);
    // Valid payload with PK header and sufficient size -> 200
    const okBuf = Buffer.alloc(2048, 0);
    okBuf[0] = 0x50; // 'P'
    okBuf[1] = 0x4b; // 'K'
    res = await postJson('/api/v1/save-progress', { userId: 'a', base64: okBuf.toString('base64') });
    expect(res.status).toBe(200);
    expect(typeof res.json.revision).toBe('number');

    // Finalize blocks save-progress
    await postJson('/api/v1/finalize', { userId: 'a' });
    const okBuf2 = Buffer.alloc(2048, 0); okBuf2[0]=0x50; okBuf2[1]=0x4b;
    res = await postJson('/api/v1/save-progress', { userId: 'a', base64: okBuf2.toString('base64') });
    expect(res.status).toBe(409);
    await postJson('/api/v1/unfinalize', { userId: 'a' });
    await ensureNotCheckedOut();
  });

  test('HEAD content-length reflects working overlay size', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    const user = 'head-check';
    // Checkout and write a small-but-valid DOCX-like payload (2KB, PK header)
    await postJson('/api/v1/checkout', { userId: user });
    const small = Buffer.alloc(2048, 0); small[0] = 0x50; small[1] = 0x4b;
    let r = await postJson('/api/v1/save-progress', { userId: user, base64: small.toString('base64') });
    expect(r.status).toBe(200);
    // HEAD should report 2048
    const h1 = await fetchHead('/documents/working/default.docx');
    expect(h1.status).toBe(200);
    const len1 = Number(h1.headers['content-length'] || h1.headers['Content-Length'] || '0');
    expect(len1).toBe(2048);
    // Now write a larger payload (16KB)
    const large = Buffer.alloc(16384, 0); large[0] = 0x50; large[1] = 0x4b;
    r = await postJson('/api/v1/save-progress', { userId: user, base64: large.toString('base64') });
    expect(r.status).toBe(200);
    const h2 = await fetchHead('/documents/working/default.docx');
    expect(h2.status).toBe(200);
    const len2 = Number(h2.headers['content-length'] || h2.headers['Content-Length'] || '0');
    expect(len2).toBe(16384);
    // Cleanup: revert working overlay and release checkout
    await postJson('/api/v1/document/revert', {});
    await postJson('/api/v1/checkin', { userId: user });
  });

  test('react entry is served', async () => {
    const r = await fetchText('/ui/components.react.js');
    expect(r.status).toBe(200);
    expect(r.text.includes('mountReactApp')).toBe(true);
  });

  test('checkout/checkin', async () => {
    await ensureNotCheckedOut();
    const u = 'jest-user';
    const c1 = await postJson('/api/v1/checkout', { userId: u });
    expect(c1.status).toBe(200);
    expect(c1.json.checkedOutBy).toBe(u);
    const c2 = await postJson('/api/v1/checkin', { userId: u });
    expect(c2.status).toBe(200);
  });

  test('finalize/unfinalize', async () => {
    await ensureNotCheckedOut();
    const u = 'jest-user';
    const f1 = await postJson('/api/v1/finalize', { userId: u });
    expect(f1.status).toBe(200);
    const f2 = await postJson('/api/v1/unfinalize', { userId: u });
    expect(f2.status).toBe(200);
  });

  test('checkin without checkout returns 409', async () => {
    await ensureNotCheckedOut();
    const r = await postJson('/api/v1/checkin', { userId: 'nobody' });
    expect(r.status).toBe(409);
  });

  test('checkout by A then checkin by B returns 409', async () => {
    await ensureNotCheckedOut();
    const a = 'jest-a', b = 'jest-b';
    const c = await postJson('/api/v1/checkout', { userId: a });
    expect(c.status).toBe(200);
    const r = await postJson('/api/v1/checkin', { userId: b });
    expect(r.status).toBe(409);
    await postJson('/api/v1/checkin', { userId: a }); // cleanup
  });

  test('cannot finalize when checked out by another user', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    const a = 'jest-a', b = 'jest-b';
    await postJson('/api/v1/checkout', { userId: a });
    const r = await postJson('/api/v1/finalize', { userId: b });
    expect(r.status).toBe(409);
    await postJson('/api/v1/checkin', { userId: a }); // cleanup
  });

  test('while finalized, checkout is blocked and unfinalize succeeds', async () => {
    await ensureFinalized();
    const a = 'jest-a', b = 'jest-b';
    const c = await postJson('/api/v1/checkout', { userId: a });
    expect(c.status).toBe(409);
    const r = await postJson('/api/v1/unfinalize', { userId: b });
    expect(r.status).toBe(200);
    await ensureUnfinalized();
  });

  test('approvals API: GET/set/reset/notify', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    // GET
    let r = await fetchJson('/api/v1/approvals');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.approvers)).toBe(true);
    const total = r.json.summary.total;
    // set self approval
    const me = 'user1';
    let res = await postJson('/api/v1/approvals/set', { documentId: 'default', actorUserId: me, targetUserId: me, approved: true });
    expect(res.status).toBe(200);
    expect(res.json.summary.approved).toBeGreaterThanOrEqual(1);
    // reset
    res = await postJson('/api/v1/approvals/reset', { documentId: 'default', actorUserId: me });
    expect(res.status).toBe(200);
    expect(res.json.summary.approved).toBe(0);
    expect(res.json.summary.total).toBe(total);
    // notify (no change)
    res = await postJson('/api/v1/approvals/notify', { documentId: 'default', actorUserId: me });
    expect(res.status).toBe(200);
    expect(res.json.summary.total).toBe(total);
  });
});


