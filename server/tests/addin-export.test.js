const https = require('https');
const http = require('http');

let BASE = 'https://localhost:4001';

async function detectBase() {
  try {
    const r = await fetchJson('/api/v1/health', 'https');
    if (r && r.status === 200) { BASE = 'https://localhost:4001'; return; }
  } catch {}
  BASE = 'http://localhost:4001';
}

function fetchJson(path, scheme) {
  const url = `${scheme ? scheme : BASE.startsWith('https') ? 'https' : 'http'}://localhost:4001${path}`;
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(url, { method: 'GET', rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data || '{}') }); } catch (e) { reject(e); }
      });
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

async function ensureNotCheckedOut() {
  try {
    const r = await fetchJson('/api/v1/state-matrix?platform=word&userId=ensure');
    const isCheckedOut = !!(r.json && r.json.config && r.json.config.checkoutStatus && r.json.config.checkoutStatus.isCheckedOut);
    const owner = r.json && r.json.config && r.json.config.checkoutStatus && r.json.config.checkoutStatus.checkedOutUserId;
    if (isCheckedOut && owner) {
      await postJson('/api/v1/checkin', { userId: owner });
    }
  } catch {}
}

// Finalization removed – no-op
async function ensureUnfinalized() { return; }

function buildOfficeLikeBase64(totalBytes) {
  const size = Math.max(2, totalBytes|0);
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0x50; // 'P'
  buf[1] = 0x4b; // 'K'
  // Split into slices to mimic Office getFileAsync() slicing
  const sliceSize = 65536;
  const slices = [];
  for (let off = 0; off < buf.length; off += sliceSize) {
    slices.push(buf.subarray(off, Math.min(buf.length, off + sliceSize)));
  }
  // The production code concatenates into base64; we do the same via Buffer
  return Buffer.concat(slices).toString('base64');
}

describe('Add-in mocked Office export/save', () => {
  beforeAll(async () => {
    await detectBase();
  });

  test('owner can save-progress with PK-prefixed assembled base64 (>=1KB)', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    const userId = 'office-tester';
    const co = await postJson('/api/v1/checkout', { userId });
    expect(co.status).toBe(200);
    const b64 = buildOfficeLikeBase64(4096);
    const res = await postJson('/api/v1/save-progress', { userId, platform: 'word', base64: b64 });
    expect(res.status).toBe(200);
    expect(typeof res.json.revision).toBe('number');
    await postJson('/api/v1/checkin', { userId });
  });

  test('rejects small PK base64 (<1KB)', async () => {
    await ensureUnfinalized();
    await ensureNotCheckedOut();
    const userId = 'office-tester-2';
    await postJson('/api/v1/checkout', { userId });
    const small = buildOfficeLikeBase64(512);
    const res = await postJson('/api/v1/save-progress', { userId, platform: 'word', base64: small });
    expect(res.status).toBe(400);
    await postJson('/api/v1/checkin', { userId });
  });
});
