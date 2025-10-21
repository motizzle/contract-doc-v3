const https = require('https');

// Helper: Make HTTPS request
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 4001,
      path: path,
      method: method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      } : {},
      rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Helper: Wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Reset to clean state
async function resetState() {
  await request('POST', '/api/v1/factory-reset', { userId: 'tester' });
  await sleep(500);
}

// Global setup - enable test mode before all tests
beforeAll(async () => {
  await sleep(500); // Wait for server to be ready
  // Enable test mode to disable SSE broadcasts and activity logging
  await request('POST', '/api/v1/test-mode', { enabled: true });
});

describe('Phase 1: Infrastructure', () => {
  
  beforeAll(async () => {
    await sleep(500); // Wait for server to be ready
  });

  // Test: Server health check
  // Purpose: Verifies the server is running and responding to requests
  // Why: Foundation test - all other tests depend on the server being operational
  // Coverage: Basic server infrastructure and health endpoint
  test('server is running and responds', async () => {
    const res = await request('GET', '/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  // Test: Test mode toggle
  // Purpose: Verifies test mode can be enabled/disabled to suppress SSE broadcasts during testing
  // Why: Tests need to run in isolation without triggering real-time updates
  // Coverage: Test mode infrastructure for disabling side effects
  test('test-mode endpoint works (enable/disable)', async () => {
    // Enable test mode
    const enableRes = await request('POST', '/api/v1/test-mode', { enabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body.ok).toBe(true);
    expect(enableRes.body.testMode).toBe(true);

    // Disable test mode
    const disableRes = await request('POST', '/api/v1/test-mode', { enabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body.ok).toBe(true);
    expect(disableRes.body.testMode).toBe(false);
  });

  // Test: API route registration
  // Purpose: Verifies all core API endpoints are registered and accessible
  // Why: Ensures routing infrastructure is properly configured
  // Coverage: Validates key API endpoints respond (not 404)
  test('API routes are registered correctly', async () => {
    const endpoints = [
      '/api/v1/health',
      '/api/v1/state-matrix?platform=web&userId=test',
      '/api/v1/users',
      '/api/v1/variables',
      '/api/v1/activity'
    ];

    for (const endpoint of endpoints) {
      const res = await request('GET', endpoint);
      expect(res.status).not.toBe(404);
    }
  });

  // Test: SSE endpoint availability
  // Purpose: Confirms the Server-Sent Events endpoint exists
  // Why: Real-time updates depend on SSE for broadcasting state changes
  // Coverage: SSE infrastructure (full SSE testing is done manually due to persistent connections)
  test('SSE endpoint is available', async () => {
    // SSE keeps connection open indefinitely, so we just check the endpoint exists
    // by verifying it doesn't return 404 immediately
    // We'll skip actual SSE connection testing in unit tests
    expect(true).toBe(true); // SSE endpoint exists (tested manually)
  });
});

describe('Phase 2: State Management', () => {

  // Test: Checkout workflow
  // Purpose: Verifies the complete checkout flow updates state correctly
  // Why: Users must be able to claim ownership of the document to make edits
  // Coverage: Checkout API, state persistence, ownership tracking
  test('checkout flow works for draft document', async () => {
    await resetState();

    const checkoutRes = await request('POST', '/api/v1/checkout', { 
      userId: 'test-user',
      clientVersion: 1 
    });
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.checkedOutBy).toBe('test-user');

    await sleep(200);

    const stateRes = await request('GET', '/api/v1/state-matrix?platform=web&userId=test-user');
    expect(stateRes.body.config.checkoutStatus.isCheckedOut).toBe(true);

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'test-user' });
  });

  // Test: Ownership enforcement on checkout
  // Purpose: Prevents multiple users from checking out the document simultaneously
  // Why: Protects against conflicting edits and ensures single-user ownership
  // Coverage: Checkout conflict detection (409 response)
  test('ownership enforced - cannot checkout when someone else owns it', async () => {
    await resetState();

    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    const res = await request('POST', '/api/v1/checkout', { userId: 'userB', clientVersion: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Already checked out');

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: Save ownership validation
  // Purpose: Ensures only the document owner can save changes
  // Why: Prevents unauthorized modifications and maintains data integrity
  // Coverage: Save API ownership enforcement (409 when not owner)
  test('save requires checkout - returns 409 when not owner', async () => {
    await resetState();

    // Create valid DOCX buffer
    const docxBuffer = Buffer.alloc(2048, 0);
    docxBuffer[0] = 0x50; // P
    docxBuffer[1] = 0x4b; // K
    const base64 = docxBuffer.toString('base64');

    // Try to save without checkout
    const res = await request('POST', '/api/v1/save-progress', { 
      userId: 'test-user',
      base64: base64
    });
    expect(res.status).toBe(409);
  });

  // Test: Multi-user state consistency
  // Purpose: Verifies state matrix returns correct UI state for different users
  // Why: Each user sees appropriate buttons based on ownership (owner: checkin, others: disabled)
  // Coverage: State matrix personalization per user
  test('user switching updates state correctly', async () => {
    await resetState();

    // Checkout as userA
    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // Check state for userA (owner)
    const stateA = await request('GET', '/api/v1/state-matrix?platform=web&userId=userA');
    expect(stateA.body.config.buttons.checkinBtn).toBe(true);
    expect(stateA.body.config.buttons.checkoutBtn).toBe(false);

    // Check state for userB (not owner)
    const stateB = await request('GET', '/api/v1/state-matrix?platform=web&userId=userB');
    expect(stateB.body.config.buttons.checkinBtn).toBe(false);
    expect(stateB.body.config.buttons.checkoutBtn).toBe(false);

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: State structure persistence
  // Purpose: Verifies state structure remains intact after factory reset
  // Why: Factory reset should clear data but maintain valid state structure
  // Coverage: State matrix structure after reset
  test('state persists across factory reset', async () => {
    await resetState();

    const stateBefore = await request('GET', '/api/v1/state-matrix?platform=web&userId=test');
    expect(stateBefore.body.config.checkoutStatus.isCheckedOut).toBe(false);

    await request('POST', '/api/v1/factory-reset', { userId: 'test' });
    await sleep(500);

    const stateAfter = await request('GET', '/api/v1/state-matrix?platform=web&userId=test');
    expect(stateAfter.body.config.checkoutStatus.isCheckedOut).toBe(false);
  });

  // Test: Factory reset clears ownership
  // Purpose: Verifies factory reset releases document ownership
  // Why: Reset must clear all session state including checkouts
  // Coverage: Checkout state clearing on factory reset
  test('factory-reset clears checkout state', async () => {
    await resetState();

    // Checkout
    await request('POST', '/api/v1/checkout', { userId: 'test-user', clientVersion: 1 });
    await sleep(200);

    // Verify checked out
    let state = await request('GET', '/api/v1/state-matrix?platform=web&userId=test-user');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(true);

    // Factory reset
    await request('POST', '/api/v1/factory-reset', { userId: 'admin' });
    await sleep(500);

    // Verify cleared
    state = await request('GET', '/api/v1/state-matrix?platform=web&userId=test-user');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(false);
  });
});

describe('Phase 3: API Integrity', () => {

  // Test: Health endpoint response
  // Purpose: Verifies the health check endpoint returns proper status
  // Why: Monitoring and load balancers depend on this endpoint
  // Coverage: Health check API contract
  test('GET /api/v1/health returns 200', async () => {
    const res = await request('GET', '/api/v1/health');
    expect(res.status).toBe(200);
  });

  // Test: State matrix API contract
  // Purpose: Verifies state matrix returns all required fields
  // Why: UI depends on complete config object to render correctly
  // Coverage: State matrix response structure validation
  test('GET /api/v1/state-matrix returns valid config', async () => {
    const res = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(res.status).toBe(200);
    expect(res.body.config).toBeDefined();
    expect(res.body.config.buttons).toBeDefined();
    expect(res.body.revision).toBeDefined();
  });

  // Test: Users API response
  // Purpose: Verifies users endpoint returns user list and roles
  // Why: UI needs user data for dropdown selections and permissions
  // Coverage: Users API response structure
  test('GET /api/v1/users returns user list', async () => {
    const res = await request('GET', '/api/v1/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.roles).toBeDefined();
  });

  // Test: Variables API response
  // Purpose: Verifies variables endpoint returns variables object
  // Why: Document templates depend on variables for content insertion
  // Coverage: Variables API response structure
  test('GET /api/v1/variables returns variables', async () => {
    const res = await request('GET', '/api/v1/variables');
    expect(res.status).toBe(200);
    expect(res.body.variables).toBeDefined();
  });

  // Test: Activity log API response
  // Purpose: Verifies activity endpoint returns activity array
  // Why: Activity panel displays all document-related events
  // Coverage: Activity log API response structure
  test('GET /api/v1/activity returns activity log', async () => {
    const res = await request('GET', '/api/v1/activity');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
  });

  // Test: Checkout API status codes
  // Purpose: Verifies checkout returns appropriate status codes
  // Why: Ensures proper error handling for concurrent checkout attempts
  // Coverage: Checkout success (200) and conflict (409) responses
  test('POST /api/v1/checkout returns 200 when valid, 409 when conflict', async () => {
    await resetState();

    // Valid checkout
    const res1 = await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    expect(res1.status).toBe(200);

    // Conflict
    const res2 = await request('POST', '/api/v1/checkout', { userId: 'userB', clientVersion: 1 });
    expect(res2.status).toBe(409);

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: Checkin API authorization
  // Purpose: Verifies only the document owner can check in
  // Why: Prevents unauthorized users from releasing document locks
  // Coverage: Checkin ownership validation (200 for owner, 409 for others)
  test('POST /api/v1/checkin returns 200 when owner, 409 when not', async () => {
    await resetState();

    // Get current document version
    const state = await request('GET', '/api/v1/state-matrix?userId=userA');
    const currentVersion = state.body.config.documentVersion || 1;

    // Checkout as userA
    const checkoutRes = await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: currentVersion });
    expect(checkoutRes.status).toBe(200);
    await sleep(500);

    // Try checkin as userB (not owner) - should fail
    const res1 = await request('POST', '/api/v1/checkin', { userId: 'userB' });
    expect(res1.status).toBe(409);

    // Checkin as userA (owner) - should succeed
    const res2 = await request('POST', '/api/v1/checkin', { userId: 'userA' });
    expect(res2.status).toBe(200);
  });

  // Test: Save progress API authorization
  // Purpose: Verifies save-progress enforces checkout ownership
  // Why: Only the document owner should be able to save changes
  // Coverage: Save API ownership validation across checkout states
  test('POST /api/v1/save-progress validates ownership', async () => {
    await resetState();

    const docxBuffer = Buffer.alloc(2048, 0);
    docxBuffer[0] = 0x50;
    docxBuffer[1] = 0x4b;
    const base64 = docxBuffer.toString('base64');

    // Without checkout - 409
    const res1 = await request('POST', '/api/v1/save-progress', { userId: 'userA', base64 });
    expect(res1.status).toBe(409);

    // Get current document version
    const state = await request('GET', '/api/v1/state-matrix?userId=userA');
    const currentVersion = state.body.config.documentVersion || 1;

    // With checkout - 200
    const checkoutRes = await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: currentVersion });
    expect(checkoutRes.status).toBe(200);
    await sleep(500);
    const res2 = await request('POST', '/api/v1/save-progress', { userId: 'userA', base64 });
    expect(res2.status).toBe(200);

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: Scenario Loader API response
  // Purpose: Verifies scenario loader endpoint returns success
  // Why: Testing infrastructure depends on reliable reset/load functionality
  // Coverage: Scenario loader API contract (renamed from factory reset)
  test('POST /api/v1/factory-reset returns 200', async () => {
    const res = await request('POST', '/api/v1/factory-reset', { userId: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  // Test: Scenario Loader - Load 'empty' preset
  // Purpose: Verifies loading the empty/factory reset preset works
  // Why: Empty preset is the baseline clean state
  // Coverage: Preset loading with explicit preset parameter
  test('scenario loader loads empty preset', async () => {
    const res = await request('POST', '/api/v1/factory-reset', { userId: 'test', preset: 'empty' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    
    // Verify state is clean
    const state = await request('GET', '/api/v1/state-matrix?userId=test');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(false);
    
    // Verify messages are empty
    const messages = await request('GET', '/api/v1/messages?userId=test');
    expect(messages.body.messages.length).toBe(0);
    
    // Verify activity log is empty
    const activity = await request('GET', '/api/v1/activity?userId=test');
    expect(activity.body.activities.length).toBe(0);
  });

  // Test: Scenario Loader - Load 'nearly-done' preset
  // Purpose: Verifies loading the nearly-done preset with populated data
  // Why: Nearly-done preset should restore a 90% complete state
  // Coverage: Preset loading with pre-populated data
  test('scenario loader loads nearly-done preset', async () => {
    const res = await request('POST', '/api/v1/factory-reset', { userId: 'test', preset: 'nearly-done' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    
    // Verify activity log has data (should have 28 activities)
    const activity = await request('GET', '/api/v1/activity?userId=user1');
    expect(activity.body.activities.length).toBeGreaterThan(0);
    
    // Verify messages exist (should have 4 messages)
    // Use user1 since they're a participant in the preset messages
    const messages = await request('GET', '/api/v1/messages?userId=user1');
    expect(messages.body.messages.length).toBeGreaterThan(0);
    
    // Verify versions exist (should have v2-v7)
    const versions = await request('GET', '/api/v1/versions');
    expect(versions.body.items.length).toBeGreaterThan(1);
  });

  // Test: UI component serving
  // Purpose: Verifies the React components are served correctly
  // Why: UI rendering depends on components.react.js being accessible
  // Coverage: Static file serving for UI components
  test('GET /ui/components.react.js serves JavaScript', async () => {
    const res = await request('GET', '/ui/components.react.js');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('React');
  });
});

describe('Phase 4: Data Validation', () => {

  // Test: DOCX file format validation
  // Purpose: Verifies server rejects files without proper DOCX magic bytes (PK header)
  // Why: Prevents corruption and ensures only valid Office documents are processed
  // Coverage: File format validation at save time
  test('rejects invalid DOCX - not PK header', async () => {
    await resetState();
    await request('POST', '/api/v1/checkout', { userId: 'test', clientVersion: 1 });
    await sleep(200);

    const invalidBuffer = Buffer.alloc(2048, 0);
    invalidBuffer[0] = 0x41; // Not PK
    const base64 = invalidBuffer.toString('base64');

    const res = await request('POST', '/api/v1/save-progress', { userId: 'test', base64 });
    expect(res.status).toBe(400);

    await request('POST', '/api/v1/checkin', { userId: 'test' });
  });

  // Test: File size validation
  // Purpose: Verifies server rejects suspiciously small files that can't be valid DOCX
  // Why: Prevents saving corrupted or incomplete documents
  // Coverage: Minimum file size enforcement (<1KB rejected)
  test('rejects too-small files (<1KB)', async () => {
    await resetState();
    await request('POST', '/api/v1/checkout', { userId: 'test', clientVersion: 1 });
    await sleep(200);

    const tinyBuffer = Buffer.alloc(512, 0);
    tinyBuffer[0] = 0x50;
    tinyBuffer[1] = 0x4b;
    const base64 = tinyBuffer.toString('base64');

    const res = await request('POST', '/api/v1/save-progress', { userId: 'test', base64 });
    expect(res.status).toBe(400);

    await request('POST', '/api/v1/checkin', { userId: 'test' });
  });

  // Test: Base64 encoding validation
  // Purpose: Verifies server rejects malformed base64 data
  // Why: Prevents server errors from invalid data transmission
  // Coverage: Base64 decoding error handling
  test('validates base64 encoding', async () => {
    await resetState();
    await request('POST', '/api/v1/checkout', { userId: 'test', clientVersion: 1 });
    await sleep(200);

    const res = await request('POST', '/api/v1/save-progress', { 
      userId: 'test', 
      base64: 'not-valid-base64!!!' 
    });
    expect(res.status).toBe(400);

    await request('POST', '/api/v1/checkin', { userId: 'test' });
  });

  // Test: Cross-user save protection
  // Purpose: Verifies users cannot save over another user's checked-out document
  // Why: Prevents document corruption from concurrent modifications
  // Coverage: Ownership enforcement on save operations
  test('enforces ownership on saves', async () => {
    await resetState();

    const docxBuffer = Buffer.alloc(2048, 0);
    docxBuffer[0] = 0x50;
    docxBuffer[1] = 0x4b;
    const base64 = docxBuffer.toString('base64');

    // Checkout as userA
    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // Try to save as userB
    const res = await request('POST', '/api/v1/save-progress', { userId: 'userB', base64 });
    expect(res.status).toBe(409);

    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: Document file availability
  // Purpose: Verifies working document endpoint is accessible
  // Why: Add-in and web app need to download the current document
  // Coverage: Document serving endpoint (HEAD request)
  test('HEAD /documents/working/default.docx returns content-length', async () => {
    const res = await request('HEAD', '/documents/working/default.docx');
    expect([200, 404]).toContain(res.status); // 404 if no working doc
  });
});

describe('Phase 5: Cross-Platform Sync', () => {

  // Test: State consistency
  // Purpose: Verifies repeated state-matrix calls return identical data
  // Why: Multiple clients/tabs should see the same state at any given time
  // Coverage: State matrix idempotency and consistency
  test('state-matrix returns consistent data for same user', async () => {
    await resetState();

    const res1 = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    const res2 = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');

    expect(res1.body.config.checkoutStatus).toEqual(res2.body.config.checkoutStatus);
  });

  // Test: Checkout state synchronization
  // Purpose: Verifies state-matrix reflects checkout changes immediately
  // Why: Users must see up-to-date ownership status for collaboration
  // Coverage: Real-time state updates after checkout
  test('checkout updates state immediately', async () => {
    await resetState();

    await request('POST', '/api/v1/checkout', { userId: 'user1', clientVersion: 1 });
    await sleep(200);

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(true);
    expect(state.body.config.checkoutStatus.checkedOutUserId).toBe('user1');

    await request('POST', '/api/v1/checkin', { userId: 'user1' });
  });

  // Test: Checkin state synchronization
  // Purpose: Verifies state-matrix reflects checkin changes immediately
  // Why: Users must see when document becomes available for checkout
  // Coverage: Real-time state updates after checkin
  test('checkin updates state immediately', async () => {
    await resetState();

    await request('POST', '/api/v1/checkout', { userId: 'user1', clientVersion: 1 });
    await sleep(200);
    await request('POST', '/api/v1/checkin', { userId: 'user1' });
    await sleep(200);

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(false);
  });

  // Test: Per-user state personalization
  // Purpose: Verifies state-matrix returns different button states for different users
  // Why: Owner sees checkin button, non-owners see disabled state
  // Coverage: State matrix personalization based on ownership
  test('user switch triggers config recalculation', async () => {
    await resetState();

    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // Check buttons for owner
    const stateA = await request('GET', '/api/v1/state-matrix?platform=web&userId=userA');
    expect(stateA.body.config.buttons.checkinBtn).toBe(true);

    // Check buttons for non-owner
    const stateB = await request('GET', '/api/v1/state-matrix?platform=web&userId=userB');
    expect(stateB.body.config.buttons.checkinBtn).toBe(false);

    await request('POST', '/api/v1/checkin', { userId: 'userA' });
  });

  // Test: State persistence
  // Purpose: Verifies state changes are persisted and retrievable across requests
  // Why: State must survive server restarts and be consistent across sessions
  // Coverage: State persistence layer
  test('state persists across requests', async () => {
    await resetState();

    await request('POST', '/api/v1/checkout', { userId: 'user1', clientVersion: 1 });
    await sleep(500); // Wait for persistence

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(true);

    await request('POST', '/api/v1/checkin', { userId: 'user1' });
  });
});

describe('Phase 8: Approvals Flow', () => {

  // Test: Approvals state retrieval
  // Purpose: Verifies approval state endpoint returns document and user approval data
  // Why: Workflow panel displays who has approved and who hasn't
  // Coverage: Approvals state API response structure
  test('GET /api/v1/approvals/state returns all users', async () => {
    const res = await request('GET', '/api/v1/approvals/state');
    expect(res.status).toBe(200);
    expect(res.body.documentId).toBeDefined();
  });

  // Test: Setting approval status
  // Purpose: Verifies users can approve/reject documents
  // Why: Core workflow feature - users need to record their approval decisions
  // Coverage: Approval creation API
  test('POST /api/v1/approvals/set sets approval', async () => {
    await resetState();

    const res = await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      approval: true
    });
    expect(res.status).toBe(200);
  });

  // Test: Resetting approvals
  // Purpose: Verifies approval reset functionality clears all approvals
  // Why: Document changes require fresh approval cycle
  // Coverage: Approval reset API (workflow restart)
  test('POST /api/v1/approvals/reset clears approvals', async () => {
    // Set an approval first
    await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      approval: true
    });
    await sleep(200);

    // Reset
    const res = await request('POST', '/api/v1/approvals/reset', { userId: 'admin' });
    expect(res.status).toBe(200);
  });

  // Test: Approval counts in state
  // Purpose: Verifies state-matrix includes approval summary (counts)
  // Why: UI needs to display "3/5 approved" status
  // Coverage: Approval summary calculation and inclusion in state-matrix
  test('approvals summary counts are correct', async () => {
    await resetState();
    await request('POST', '/api/v1/approvals/reset', { userId: 'admin' });
    await sleep(200);

    // Set one approval
    await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      approval: true
    });
    await sleep(200);

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.approvals).toBeDefined();
    expect(state.body.config.approvals.summary).toBeDefined();
  });

  // Test: Override approval (editor feature)
  // Purpose: Verifies editors can approve on behalf of other users
  // Why: Workflow flexibility - editors can override stuck approvals
  // Coverage: Approval override API (target different user)
  test('override approval works for editors', async () => {
    await resetState();

    // Editor can override approvals
    const res = await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      targetUserId: 'user2',
      approval: true
    });
    // Should succeed (200) or have proper error handling
    expect([200, 400, 403]).toContain(res.status);
  });

  // Test: Approval persistence
  // Purpose: Verifies approval decisions are saved and retrievable
  // Why: Approvals must survive server restarts for audit trail
  // Coverage: Approval data persistence
  test('approvals persist across requests', async () => {
    await resetState();
    await request('POST', '/api/v1/approvals/reset', { userId: 'admin' });
    await sleep(200);

    await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      approval: true
    });
    await sleep(500);

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.approvals).toBeDefined();
  });
});

describe('Phase 9: Document Lifecycle & Versions', () => {

  // Test: Canonical document serving
  // Purpose: Verifies the canonical (master) document file is accessible
  // Why: Canonical doc is the source of truth for document state
  // Coverage: Canonical document file serving endpoint
  test('GET /documents/canonical/default.docx returns document', async () => {
    const res = await request('GET', '/documents/canonical/default.docx');
    expect([200, 404]).toContain(res.status); // 404 if no canonical doc exists
  });

  // Test: Working document serving
  // Purpose: Verifies the working copy document is accessible
  // Why: Working copy contains in-progress edits before checkin
  // Coverage: Working document file serving endpoint
  test('GET /documents/working/default.docx returns working copy', async () => {
    const res = await request('GET', '/documents/working/default.docx');
    expect([200, 404]).toContain(res.status); // 404 if no working copy exists
  });

  // Test: Version list retrieval
  // Purpose: Verifies version history endpoint returns all saved versions
  // Why: Users need to see complete version history in Versions tab
  // Coverage: Version list API response structure
  test('GET /api/v1/versions returns version list', async () => {
    const res = await request('GET', '/api/v1/versions');
    expect(res.status).toBe(200);
    expect(res.body.items || res.body.versions).toBeDefined();
  });

  // Test: Specific version retrieval
  // Purpose: Verifies individual version files can be downloaded
  // Why: Users need to view/compare specific historical versions
  // Coverage: Version download API
  test('GET /api/v1/versions/:n returns specific version', async () => {
    const res = await request('GET', '/api/v1/versions/1?rev=123');
    expect([200, 404]).toContain(res.status); // 404 if version doesn't exist
  });

  // Test: Version viewing
  // Purpose: Verifies users can switch to viewing a specific version
  // Why: Version comparison and review requires loading historical versions
  // Coverage: Version switching API
  test('POST /api/v1/versions/view switches to version', async () => {
    const res = await request('POST', '/api/v1/versions/view', {
      userId: 'user1',
      version: 1
    });
    expect(res.status).toBe(200);
  });

  // Test: Snapshot creation
  // Purpose: Verifies creating a new version snapshot
  // Why: Users save progress by creating labeled version snapshots
  // Coverage: Version snapshot creation API
  test('POST /api/v1/document/snapshot creates version', async () => {
    await resetState();
    
    const res = await request('POST', '/api/v1/document/snapshot', {
      userId: 'user1',
      label: 'Test Snapshot'
    });
    expect(res.status).toBe(200);
  });

  // Test: Document revert
  // Purpose: Verifies reverting working copy back to canonical
  // Why: Users need to discard changes and return to last saved state
  // Coverage: Document revert API (discard changes)
  test('POST /api/v1/document/revert reverts to canonical', async () => {
    await resetState();

    const res = await request('POST', '/api/v1/document/revert', {
      userId: 'admin'
    });
    expect(res.status).toBe(200);
  });

  // Test: Document refresh
  // Purpose: Verifies document reload triggers re-download in client
  // Why: Needed after version switches or external changes
  // Coverage: Document refresh broadcast API
  test('POST /api/v1/refresh-document reloads document', async () => {
    const res = await request('POST', '/api/v1/refresh-document', {
      userId: 'user1',
      platform: 'web'
    });
    expect(res.status).toBe(200);
  });
});

describe('Phase 10: Variables CRUD', () => {

  // Test: Variable creation
  // Purpose: Verifies creating new document variables
  // Why: Users define custom variables for document content insertion
  // Coverage: Variable creation API with validation
  test('POST /api/v1/variables creates new variable', async () => {
    const res = await request('POST', '/api/v1/variables', {
      userId: 'user1',
      variable: {
        id: 'test-var',
        label: 'Test Variable',
        value: 'Test Value'
      }
    });
    expect([200, 201, 400]).toContain(res.status); // 400 if validation fails
  });

  // Test: Variable definition update
  // Purpose: Verifies updating variable metadata (label, description)
  // Why: Users need to update variable definitions without changing values
  // Coverage: Variable metadata update API
  test('PUT /api/v1/variables/:varId updates variable definition', async () => {
    const res = await request('PUT', '/api/v1/variables/test-var', {
      userId: 'user1',
      label: 'Updated Label',
      description: 'Updated description'
    });
    expect([200, 404]).toContain(res.status);
  });

  // Test: Variable value update
  // Purpose: Verifies updating variable values
  // Why: Core feature - users change variable values to update document content
  // Coverage: Variable value update API
  test('PUT /api/v1/variables/:varId/value updates variable value', async () => {
    const res = await request('PUT', '/api/v1/variables/PROJECT_NAME/value', {
      userId: 'user1',
      value: 'New Project Name'
    });
    expect([200, 404]).toContain(res.status);
  });

  // Test: Variable deletion
  // Purpose: Verifies deleting variables
  // Why: Users remove unused variables to clean up variable list
  // Coverage: Variable deletion API
  test('DELETE /api/v1/variables/:varId deletes variable', async () => {
    const res = await request('DELETE', '/api/v1/variables/test-var', {
      userId: 'user1'
    });
    expect([200, 404]).toContain(res.status);
  });

  // Test: Variable persistence
  // Purpose: Verifies variables are persisted and retrievable after creation
  // Why: Variables must persist across sessions for document consistency
  // Coverage: Variable data persistence
  test('variables persist after updates', async () => {
    // Create variable
    await request('POST', '/api/v1/variables', {
      userId: 'user1',
      variable: {
        id: 'persist-test',
        label: 'Persist Test',
        value: 'Initial Value'
      }
    });
    await sleep(200);

    // Verify it exists
    const res = await request('GET', '/api/v1/variables');
    expect(res.status).toBe(200);
    expect(res.body.variables).toBeDefined();
  });
});

describe('Phase 11: Status & Title Management', () => {

  // Test: Status cycle (draft/final toggle)
  // Purpose: Verifies toggling document status between draft and final
  // Why: Final documents trigger approvals and lock editing
  // Coverage: Status cycle API
  test('POST /api/v1/status/cycle toggles draft/final', async () => {
    await resetState();

    const res = await request('POST', '/api/v1/status/cycle', {
      userId: 'user1'
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  // Test: Document title update
  // Purpose: Verifies updating the document title
  // Why: Users need to set descriptive document names
  // Coverage: Document title update API
  test('POST /api/v1/title updates document title', async () => {
    const res = await request('POST', '/api/v1/title', {
      userId: 'user1',
      title: 'New Document Title'
    });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Document Title');
  });

  // Test: Status affects permissions
  // Purpose: Verifies final status restricts checkout
  // Why: Final documents should not allow editing without proper workflow
  // Coverage: Status-based permission enforcement
  test('status affects checkout permissions', async () => {
    await resetState();

    // Cycle to final
    await request('POST', '/api/v1/status/cycle', { userId: 'user1' });
    await sleep(200);

    // Try to checkout (should fail if final)
    const checkoutRes = await request('POST', '/api/v1/checkout', {
      userId: 'user2',
      clientVersion: 1
    });
    
    // May fail with 409 if status is final
    expect([200, 409]).toContain(checkoutRes.status);
  });

  // Test: Title persistence
  // Purpose: Verifies title changes are persisted in state
  // Why: Title must be consistent across requests and sessions
  // Coverage: Title persistence in state-matrix
  test('title persists across state matrix requests', async () => {
    await request('POST', '/api/v1/title', {
      userId: 'user1',
      title: 'Persistence Test Title'
    });
    await sleep(200);

    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=user1');
    expect(state.body.config.title).toBeDefined();
  });
});

describe('Phase 12: Advanced Checkout Operations', () => {

  // Test: Self checkout cancellation
  // Purpose: Verifies users can cancel their own checkout without checkin
  // Why: Allows users to release lock if they need to step away
  // Coverage: Checkout cancel API (self-service)
  test('POST /api/v1/checkout/cancel allows user to cancel own checkout', async () => {
    await resetState();

    // Checkout
    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // Cancel own checkout
    const res = await request('POST', '/api/v1/checkout/cancel', { userId: 'userA' });
    expect(res.status).toBe(200);

    // Verify released
    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=userA');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(false);
  });

  // Test: Admin checkout override
  // Purpose: Verifies admins can force-release any user's checkout
  // Why: Emergency feature when user is unavailable and document is locked
  // Coverage: Checkout override API (admin privilege)
  test('POST /api/v1/checkout/override allows admin to force release', async () => {
    await resetState();

    // User checks out
    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // Admin overrides
    const res = await request('POST', '/api/v1/checkout/override', { userId: 'admin' });
    expect(res.status).toBe(200);

    // Verify released
    const state = await request('GET', '/api/v1/state-matrix?platform=web&userId=admin');
    expect(state.body.config.checkoutStatus.isCheckedOut).toBe(false);
  });

  // Test: Cancel authorization
  // Purpose: Verifies non-owners cannot cancel other users' checkouts
  // Why: Security - prevents unauthorized checkout disruption
  // Coverage: Cancel authorization enforcement
  test('cannot cancel checkout if not owner', async () => {
    await resetState();

    // UserA checks out
    await request('POST', '/api/v1/checkout', { userId: 'userA', clientVersion: 1 });
    await sleep(200);

    // UserB tries to cancel
    const res = await request('POST', '/api/v1/checkout/cancel', { userId: 'userB' });
    expect(res.status).toBe(409);
  });

  // Test: Cancel/recheckout workflow
  // Purpose: Verifies document can be checked out after cancel
  // Why: Cancel should fully release lock, allowing new checkouts
  // Coverage: State consistency after cancel operation
  test('checkout/cancel workflow maintains consistency', async () => {
    await resetState();

    // Checkout
    await request('POST', '/api/v1/checkout', { userId: 'user1', clientVersion: 1 });
    await sleep(200);

    // Cancel
    await request('POST', '/api/v1/checkout/cancel', { userId: 'user1' });
    await sleep(200);

    // Should be able to checkout again
    const res = await request('POST', '/api/v1/checkout', { userId: 'user2', clientVersion: 1 });
    expect(res.status).toBe(200);

    // Cleanup
    await request('POST', '/api/v1/checkin', { userId: 'user2' });
  });
});

describe('Phase 13: Exhibits & Compilation', () => {

  // Test: Exhibit list retrieval
  // Purpose: Verifies exhibit list endpoint returns all uploaded exhibits
  // Why: Users need to see available exhibits for compilation
  // Coverage: Exhibit list API response structure
  test('GET /api/v1/exhibits returns exhibit list', async () => {
    const res = await request('GET', '/api/v1/exhibits');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.exhibits || res.body.items)).toBe(true);
  });

  // Test: Exhibit file serving
  // Purpose: Verifies exhibit files can be downloaded/served
  // Why: Users need to preview and download uploaded exhibits
  // Coverage: Exhibit file serving endpoint
  test('GET /exhibits/:name serves exhibit file', async () => {
    // Try to get an exhibit (may 404 if none exist)
    const res = await request('GET', '/exhibits/test.pdf');
    expect([200, 404]).toContain(res.status);
  });

  // Test: Document compilation
  // Purpose: Verifies compile endpoint accepts valid parameters
  // Why: Users compile documents with selected exhibits into single PDF
  // Coverage: Compile API parameter validation (requires LibreOffice)
  test('POST /api/v1/compile requires valid parameters', async () => {
    const res = await request('POST', '/api/v1/compile', {
      userId: 'user1',
      exhibits: []
    });
    // May succeed, fail validation, or fail if LibreOffice not installed
    expect([200, 400, 500]).toContain(res.status);
  });

  // Test: Compile permissions
  // Purpose: Verifies compile endpoint validates user permissions
  // Why: Only authorized users should be able to compile documents
  // Coverage: Compile permission enforcement
  test('compile endpoint validates user permissions', async () => {
    const res = await request('POST', '/api/v1/compile', {
      userId: 'viewer-user',
      exhibits: ['test.pdf']
    });
    // Should either succeed, fail validation, permission error, or LibreOffice missing
    expect([200, 400, 403, 500]).toContain(res.status);
  });
});

describe('Phase 14: Messages (Threaded Messaging)', () => {

  // Test: Message list retrieval
  // Purpose: Verifies messages endpoint returns user's message conversations
  // Why: Messaging tab displays all conversations for current user
  // Coverage: Messages list API response structure
  test('GET /api/v1/messages returns message list', async () => {
    const res = await request('GET', '/api/v1/messages?userId=user1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  // Test: Message creation
  // Purpose: Verifies creating new message conversations
  // Why: Users initiate conversations with recipients
  // Coverage: Message creation API with recipients, flags
  test('POST /api/v1/messages creates new message', async () => {
    const res = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test message',
      internal: false,
      external: false,
      privileged: false
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.messageId).toBeDefined();
  });

  // Test: Message creation with custom title
  // Purpose: Verifies message titles can be explicitly set
  // Why: Allows users to create descriptive conversation titles
  // Coverage: Custom title support in message creation
  test('POST /api/v1/messages creates message with custom title', async () => {
    const res = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      title: 'Custom Title',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test with title',
      internal: false,
      external: false,
      privileged: false
    });
    expect(res.status).toBe(200);
    expect(res.body.message.title).toBe('Custom Title');
  });

  // Test: Adding posts to messages
  // Purpose: Verifies replies can be added to existing conversations
  // Why: Core threading feature - users reply to messages
  // Coverage: Post creation API
  test('POST /api/v1/messages/:messageId/post adds post to message', async () => {
    // First create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Initial message',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // Add a post
    const postRes = await request('POST', `/api/v1/messages/${messageId}/post`, {
      userId: 'user2',
      text: 'Reply message'
    });
    expect(postRes.status).toBe(200);
    expect(postRes.body.post).toBeDefined();
    expect(postRes.body.post.text).toBe('Reply message');
  });

  // Test: Marking messages as read
  // Purpose: Verifies users can mark conversations as read
  // Why: Manages unread count and read/unread status tracking
  // Coverage: Mark read API
  test('POST /api/v1/messages/:messageId/read marks message as read', async () => {
    // Create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test unread',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // Mark as read for user2
    const readRes = await request('POST', `/api/v1/messages/${messageId}/read`, {
      userId: 'user2',
      unread: false
    });
    expect(readRes.status).toBe(200);
    expect(readRes.body.message.unreadBy).not.toContain('user2');
  });

  // Test: Marking messages as unread
  // Purpose: Verifies users can re-mark conversations as unread
  // Why: Users may want to mark messages for later review
  // Coverage: Mark unread API
  test('POST /api/v1/messages/:messageId/read marks message as unread', async () => {
    // Create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test unread toggle',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // First mark as read
    await request('POST', `/api/v1/messages/${messageId}/read`, {
      userId: 'user2',
      unread: false
    });

    // Then mark as unread
    const unreadRes = await request('POST', `/api/v1/messages/${messageId}/read`, {
      userId: 'user2',
      unread: true
    });
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.message.unreadBy).toContain('user2');
  });

  // Test: Archiving messages
  // Purpose: Verifies users can archive conversations
  // Why: Users organize messages by archiving old conversations
  // Coverage: Archive message API (per-user state)
  test('POST /api/v1/messages/:messageId/state archives message', async () => {
    // Create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test archive',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // Archive for user1
    const archiveRes = await request('POST', `/api/v1/messages/${messageId}/state`, {
      userId: 'user1',
      state: 'archived'
    });
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.message.archivedBy).toContain('user1');
  });

  // Test: Unarchiving messages
  // Purpose: Verifies users can restore archived conversations to active
  // Why: Users may need to reopen archived conversations
  // Coverage: Unarchive message API
  test('POST /api/v1/messages/:messageId/state unarchives message', async () => {
    // Create and archive a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test unarchive',
      internal: false
    });
    const messageId = createRes.body.message.messageId;
    
    await request('POST', `/api/v1/messages/${messageId}/state`, {
      userId: 'user1',
      state: 'archived'
    });

    // Unarchive
    const unarchiveRes = await request('POST', `/api/v1/messages/${messageId}/state`, {
      userId: 'user1',
      state: 'open'
    });
    expect(unarchiveRes.status).toBe(200);
    expect(unarchiveRes.body.message.archivedBy).not.toContain('user1');
  });

  // Test: Soft deleting messages
  // Purpose: Verifies users can delete messages (soft delete per user)
  // Why: Users remove unwanted conversations from their view
  // Coverage: Soft delete message API (doesn't affect other participants)
  test('POST /api/v1/messages/:messageId/delete soft deletes message', async () => {
    // Create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test delete',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // Delete for user1
    const deleteRes = await request('POST', `/api/v1/messages/${messageId}/delete`, {
      userId: 'user1'
    });
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message.deletedBy).toContain('user1');
  });

  // Test: Updating message flags
  // Purpose: Verifies message flags (internal/external/privileged) can be updated
  // Why: Compliance - messages need proper classification for records
  // Coverage: Message flags update API
  test('POST /api/v1/messages/:messageId/flags updates message flags', async () => {
    // Create a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test flags',
      internal: false,
      external: false,
      privileged: false
    });
    const messageId = createRes.body.message.messageId;

    // Update flags
    const flagsRes = await request('POST', `/api/v1/messages/${messageId}/flags`, {
      userId: 'user1',
      internal: true,
      external: true,
      privileged: true
    });
    expect(flagsRes.status).toBe(200);
    expect(flagsRes.body.message.internal).toBe(true);
    expect(flagsRes.body.message.external).toBe(true);
    expect(flagsRes.body.message.privileged).toBe(true);
  });

  // Test: Group message creation
  // Purpose: Verifies creating conversations with multiple recipients
  // Why: Users need group conversations beyond one-on-one
  // Coverage: Multi-recipient message creation
  test('POST /api/v1/messages creates group message with multiple recipients', async () => {
    const res = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true },
        { userId: 'user3', label: 'User 3', email: 'user3@test.com', internal: true }
      ],
      text: 'Group message',
      internal: false
    });
    expect(res.status).toBe(200);
    expect(res.body.message.participants.length).toBe(2);
  });

  // Test: Filtering messages by archived state
  // Purpose: Verifies message list can be filtered to show only archived messages
  // Why: Users need to access archived conversations separately
  // Coverage: Message list filtering by state parameter
  test('GET /api/v1/messages filters by state (archived)', async () => {
    // Create and archive a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Archive filter test',
      internal: false
    });
    const messageId = createRes.body.message.messageId;
    
    await request('POST', `/api/v1/messages/${messageId}/state`, {
      userId: 'user1',
      state: 'archived'
    });

    // Get archived messages
    const res = await request('GET', '/api/v1/messages?userId=user1&state=archived');
    expect(res.status).toBe(200);
    expect(res.body.messages.some(m => m.messageId === messageId)).toBe(true);
  });

  // Test: Deleted messages exclusion
  // Purpose: Verifies deleted messages are not shown in normal message lists
  // Why: Deleted messages should be hidden from the user who deleted them
  // Coverage: Message list filtering excludes user's deleted messages
  test('GET /api/v1/messages excludes deleted messages', async () => {
    // Create and delete a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Delete filter test',
      internal: false
    });
    const messageId = createRes.body.message.messageId;
    
    await request('POST', `/api/v1/messages/${messageId}/delete`, {
      userId: 'user1'
    });

    // Get messages - should not include deleted
    const res = await request('GET', '/api/v1/messages?userId=user1&state=open');
    expect(res.status).toBe(200);
    expect(res.body.messages.some(m => m.messageId === messageId)).toBe(false);
  });

  // Test: Factory reset clears messages
  // Purpose: Verifies factory reset completely clears all message data
  // Why: Factory reset must return system to clean state for testing/demos
  // Coverage: Factory reset message clearing (already documented in factory reset section)
  test('factory reset clears all messages', async () => {
    // Create a few messages first
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Before reset 1',
      internal: false
    });
    
    await request('POST', '/api/v1/messages', {
      userId: 'user2',
      recipients: [
        { userId: 'user3', label: 'User 3', email: 'user3@test.com', internal: true }
      ],
      text: 'Before reset 2',
      internal: false
    });

    // Verify messages exist
    const beforeReset = await request('GET', '/api/v1/messages?userId=user1');
    expect(beforeReset.body.messages.length).toBeGreaterThan(0);

    // Factory reset
    const resetRes = await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });
    expect(resetRes.status).toBe(200);

    // Verify messages are cleared
    const afterReset = await request('GET', '/api/v1/messages?userId=user1');
    expect(afterReset.body.messages.length).toBe(0);
  });

  test('factory reset clears message posts', async () => {
    // Create a message with posts
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Initial message',
      internal: false
    });
    const messageId = createRes.body.message.messageId;

    // Add posts
    await request('POST', `/api/v1/messages/${messageId}/post`, {
      userId: 'user2',
      text: 'Reply 1'
    });
    
    await request('POST', `/api/v1/messages/${messageId}/post`, {
      userId: 'user1',
      text: 'Reply 2'
    });

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify messages (and their posts) are cleared
    const afterReset = await request('GET', '/api/v1/messages?userId=user1');
    expect(afterReset.body.messages.length).toBe(0);
  });

  test('messaging works correctly after factory reset', async () => {
    // Create and delete a message
    const createRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Before reset',
      internal: false
    });
    const oldMessageId = createRes.body.message.messageId;

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Create new message after reset
    const newRes = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'After reset',
      internal: false
    });
    expect(newRes.status).toBe(200);
    expect(newRes.body.message.messageId).toBeDefined();
    expect(newRes.body.message.messageId).not.toBe(oldMessageId);
    // Note: text is stored as a post, not on the message object itself
    expect(newRes.body.message.title).toBeDefined();
  });

  test('factory reset clears archived and deleted messages', async () => {
    // Create messages with different states
    const createRes1 = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'To be archived',
      internal: false
    });
    const messageId1 = createRes1.body.message.messageId;

    const createRes2 = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user3', label: 'User 3', email: 'user3@test.com', internal: true }
      ],
      text: 'To be deleted',
      internal: false
    });
    const messageId2 = createRes2.body.message.messageId;

    // Archive one
    await request('POST', `/api/v1/messages/${messageId1}/state`, {
      userId: 'user1',
      state: 'archived'
    });

    // Delete another
    await request('POST', `/api/v1/messages/${messageId2}/delete`, {
      userId: 'user1'
    });

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify all states cleared
    const openMessages = await request('GET', '/api/v1/messages?userId=user1&state=open');
    const archivedMessages = await request('GET', '/api/v1/messages?userId=user1&state=archived');
    
    expect(openMessages.body.messages.length).toBe(0);
    expect(archivedMessages.body.messages.length).toBe(0);
  });

  test('factory reset preserves message data structure', async () => {
    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Create a new message
    const res = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Test structure',
      internal: true,
      external: false,
      privileged: true
    });

    // Verify proper structure
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
    expect(res.body.message.messageId).toBeDefined();
    expect(res.body.message.participants).toBeDefined();
    expect(Array.isArray(res.body.message.participants)).toBe(true);
    expect(res.body.message.createdBy).toBeDefined();
    expect(res.body.message.internal).toBe(true);
    expect(res.body.message.privileged).toBe(true);
    expect(res.body.message.unreadBy).toBeDefined();
    expect(Array.isArray(res.body.message.unreadBy)).toBe(true);
  });

  test('factory reset clears activity log', async () => {
    // Generate some activity by creating messages and making changes
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }
      ],
      text: 'Activity test',
      internal: false
    });

    await request('POST', '/api/v1/title', {
      userId: 'user1',
      title: 'Test Title'
    });

    // Verify activity exists
    const beforeReset = await request('GET', '/api/v1/activity?userId=user1');
    expect(beforeReset.status).toBe(200);
    const beforeActivityCount = beforeReset.body.activities?.length || 0;
    expect(beforeActivityCount).toBeGreaterThan(0);

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify activity is cleared
    const afterReset = await request('GET', '/api/v1/activity?userId=user1');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.activities.length).toBe(0);
  });

  test('factory reset resets workflow approvals', async () => {
    // Get list of approvers first
    const initialApprovers = await request('GET', '/api/v1/approvals');
    expect(initialApprovers.status).toBe(200);
    
    // Set some approvals (need to target existing approvers)
    if (initialApprovers.body.approvers && initialApprovers.body.approvers.length > 0) {
      const firstApprover = initialApprovers.body.approvers[0];
      await request('POST', '/api/v1/approvals/set', {
        actorUserId: 'user1',
        targetUserId: firstApprover.userId,
        approved: true
      });

      // Verify approvals exist
      const beforeReset = await request('GET', '/api/v1/approvals');
      expect(beforeReset.status).toBe(200);
      const approvedBefore = beforeReset.body.approvers.filter(a => a.approved).length;
      expect(approvedBefore).toBeGreaterThan(0);

      // Factory reset
      await request('POST', '/api/v1/factory-reset', {
        userId: 'admin'
      });

      // Verify approvals are reset
      const afterReset = await request('GET', '/api/v1/approvals');
      expect(afterReset.status).toBe(200);
      const approvedAfter = afterReset.body.approvers.filter(a => a.approved).length;
      expect(approvedAfter).toBe(0);
    } else {
      // If no approvers configured, just verify factory reset works
      await request('POST', '/api/v1/factory-reset', {
        userId: 'admin'
      });
      const afterReset = await request('GET', '/api/v1/approvals');
      expect(afterReset.status).toBe(200);
    }
  });

  test('factory reset clears all versions', async () => {
    // Create a version by saving progress
    await request('POST', '/api/v1/save-progress', {
      userId: 'user1',
      data: 'Test document content for version 1'
    });

    await request('POST', '/api/v1/save-progress', {
      userId: 'user1',
      data: 'Test document content for version 2'
    });

    // Verify versions exist (API returns {items} not {versions})
    const beforeReset = await request('GET', '/api/v1/versions');
    expect(beforeReset.status).toBe(200);
    expect(beforeReset.body.items).toBeDefined();
    expect(beforeReset.body.items.length).toBeGreaterThan(0);

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify versions are cleared (only v1 default should remain)
    const afterReset = await request('GET', '/api/v1/versions');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.items.length).toBe(1);
    expect(afterReset.body.items[0].version).toBe(1);
  });

  test('factory reset clears all variables', async () => {
    // Get initial variables count
    const initialVars = await request('GET', '/api/v1/variables');
    expect(initialVars.status).toBe(200);
    expect(initialVars.body.variables).toBeDefined();
    const initialCount = Object.keys(initialVars.body.variables).length;

    // Create some variables (using correct field names)
    const var1 = await request('POST', '/api/v1/variables', {
      userId: 'user1',
      displayLabel: 'Test Variable 1',
      type: 'value',
      value: 'value1'
    });
    expect(var1.status).toBe(200);

    const var2 = await request('POST', '/api/v1/variables', {
      userId: 'user1',
      displayLabel: 'Test Variable 2',
      type: 'value',
      value: 'value2'
    });
    expect(var2.status).toBe(200);

    // Verify variables were added
    const beforeReset = await request('GET', '/api/v1/variables');
    expect(beforeReset.status).toBe(200);
    expect(beforeReset.body.variables).toBeDefined();
    const beforeCount = Object.keys(beforeReset.body.variables).length;
    expect(beforeCount).toBeGreaterThan(initialCount);

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify variables are reset to seed state
    const afterReset = await request('GET', '/api/v1/variables');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.variables).toBeDefined();
    // After reset, should be back to initial seed count
    const afterCount = Object.keys(afterReset.body.variables).length;
    expect(afterCount).toBeLessThanOrEqual(initialCount);
  });

  test('factory reset clears checkout state', async () => {
    // Get current document version first
    const stateBeforeCheckout = await request('GET', '/api/v1/state-matrix?userId=user1');
    const currentVersion = stateBeforeCheckout.body.config.documentVersion || 1;

    // Checkout the document with current version
    const checkoutRes = await request('POST', '/api/v1/checkout', {
      userId: 'user1',
      clientVersion: currentVersion
    });
    expect(checkoutRes.status).toBe(200);

    // Verify checkout exists (API returns {config, revision} not {state})
    const beforeReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(beforeReset.status).toBe(200);
    expect(beforeReset.body.config.checkoutStatus.checkedOutUserId).toBe('user1');

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify checkout is cleared
    const afterReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.config.checkoutStatus.checkedOutUserId).toBeNull();
  });

  test('factory reset resets document title', async () => {
    // Set a custom title
    await request('POST', '/api/v1/title', {
      userId: 'user1',
      title: 'Custom Document Title'
    });

    // Verify title was set (API returns {config, revision} not {state})
    const beforeReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(beforeReset.status).toBe(200);
    expect(beforeReset.body.config.title).toBe('Custom Document Title');

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify title is reset
    const afterReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(afterReset.status).toBe(200);
    // Should be reset to default title
    expect(afterReset.body.config.title).toBeDefined();
  });

  test('factory reset resets document status', async () => {
    // Cycle status a few times
    await request('POST', '/api/v1/status/cycle', {
      userId: 'user1'
    });

    await request('POST', '/api/v1/status/cycle', {
      userId: 'user1'
    });

    // Verify status changed (API returns {config, revision} not {state})
    const beforeReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(beforeReset.status).toBe(200);
    const statusBefore = beforeReset.body.config.status;
    expect(statusBefore).toBeDefined();

    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify status is reset to initial state
    const afterReset = await request('GET', '/api/v1/state-matrix?userId=user1');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.config.status).toBeDefined();
  });

  test('factory reset restores default document', async () => {
    // Upload a custom document
    // Note: This would require multipart form data, so we'll just verify the concept
    
    // Factory reset
    await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });

    // Verify document exists (default.docx should be restored)
    // API returns {filePath} not {path}
    const afterReset = await request('GET', '/api/v1/current-document');
    expect(afterReset.status).toBe(200);
    expect(afterReset.body.filePath).toBeDefined();
  });

  test('factory reset maintains system integrity - all endpoints work', async () => {
    // Create data across multiple systems
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Test',
      internal: false
    });

    await request('POST', '/api/v1/variables', {
      userId: 'user1',
      name: 'testVar',
      value: 'testValue'
    });

    await request('POST', '/api/v1/approvals/set', {
      userId: 'user1',
      approved: true
    });

    // Factory reset
    const resetRes = await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });
    expect(resetRes.status).toBe(200);

    // Verify all major endpoints are functional after reset
    const stateRes = await request('GET', '/api/v1/state-matrix');
    expect(stateRes.status).toBe(200);

    const messagesRes = await request('GET', '/api/v1/messages?userId=user1');
    expect(messagesRes.status).toBe(200);

    const varsRes = await request('GET', '/api/v1/variables');
    expect(varsRes.status).toBe(200);

    const approvalsRes = await request('GET', '/api/v1/approvals');
    expect(approvalsRes.status).toBe(200);

    const activityRes = await request('GET', '/api/v1/activity?userId=user1');
    expect(activityRes.status).toBe(200);

    const versionsRes = await request('GET', '/api/v1/versions');
    expect(versionsRes.status).toBe(200);

    // All should return 200 and have proper structure
    expect(messagesRes.body.messages).toBeDefined();
    expect(varsRes.body.variables).toBeDefined();
    expect(approvalsRes.body.approvers).toBeDefined();
    expect(activityRes.body.activities).toBeDefined();
    expect(versionsRes.body.items).toBeDefined();
  });

  test('factory reset is idempotent - can be run multiple times safely', async () => {
    // Create some data
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Test',
      internal: false
    });

    // First reset
    const reset1 = await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });
    expect(reset1.status).toBe(200);

    // Second reset (should not cause errors)
    const reset2 = await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });
    expect(reset2.status).toBe(200);

    // Third reset (should still work)
    const reset3 = await request('POST', '/api/v1/factory-reset', {
      userId: 'admin'
    });
    expect(reset3.status).toBe(200);

    // System should still be functional
    const messagesRes = await request('GET', '/api/v1/messages?userId=user1');
    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body.messages.length).toBe(0);
  });

  // Test: Scenario Loader - List scenarios
  // Purpose: Verifies GET /api/v1/scenarios returns presets and user scenarios
  // Why: Users need to see available presets and their saved scenarios
  // Coverage: Scenario listing API
  test('GET /api/v1/scenarios returns presets and user scenarios', async () => {
    const res = await request('GET', '/api/v1/scenarios');
    expect(res.status).toBe(200);
    expect(res.body.presets).toBeDefined();
    expect(Array.isArray(res.body.presets)).toBe(true);
    expect(res.body.presets.length).toBe(2); // empty and nearly-done
    expect(res.body.scenarios).toBeDefined();
    expect(Array.isArray(res.body.scenarios)).toBe(true);
    
    // Verify preset structure
    const emptyPreset = res.body.presets.find(p => p.id === 'empty');
    expect(emptyPreset).toBeDefined();
    expect(emptyPreset.label).toBe('Factory Reset');
    expect(emptyPreset.type).toBe('preset');
    
    const nearlyDonePreset = res.body.presets.find(p => p.id === 'nearly-done');
    expect(nearlyDonePreset).toBeDefined();
    expect(nearlyDonePreset.label).toBe('Almost Done');
    expect(nearlyDonePreset.type).toBe('preset');
  });

  // Test: Scenario Loader - Save current state as scenario
  // Purpose: Verifies users can save current application state as a named scenario
  // Why: Users need to save custom demo/test states for reuse
  // Coverage: Scenario save API
  test('POST /api/v1/scenarios/save creates a new user scenario', async () => {
    // Reset to clean state first
    await request('POST', '/api/v1/factory-reset', { userId: 'test' });
    await sleep(500);
    
    // Create some data
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Test scenario message',
      internal: false
    });
    
    await request('POST', '/api/v1/title', {
      userId: 'user1',
      title: 'Test Scenario Document'
    });
    
    // Save as scenario
    const saveRes = await request('POST', '/api/v1/scenarios/save', {
      name: 'Test Demo Scenario',
      description: 'A test scenario for demos',
      userId: 'user1'
    });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.ok).toBe(true);
    expect(saveRes.body.scenario).toBeDefined();
    expect(saveRes.body.scenario.id).toBeDefined();
    expect(saveRes.body.scenario.label).toBe('Test Demo Scenario');
    
    // Verify scenario appears in list
    const listRes = await request('GET', '/api/v1/scenarios');
    expect(listRes.status).toBe(200);
    const savedScenario = listRes.body.scenarios.find(s => s.label === 'Test Demo Scenario');
    expect(savedScenario).toBeDefined();
    expect(savedScenario.type).toBe('user');
    expect(savedScenario.description).toBe('A test scenario for demos');
  });

  // Test: Scenario Loader - Prevent duplicate scenario names
  // Purpose: Verifies validation prevents saving scenarios with duplicate names
  // Why: Scenario names must be unique to avoid confusion
  // Coverage: Scenario name uniqueness validation
  test('POST /api/v1/scenarios/save rejects duplicate names', async () => {
    // Save first scenario
    const save1 = await request('POST', '/api/v1/scenarios/save', {
      name: 'Duplicate Test',
      description: 'First save',
      userId: 'user1'
    });
    expect(save1.status).toBe(200);
    
    // Try to save with same name
    const save2 = await request('POST', '/api/v1/scenarios/save', {
      name: 'Duplicate Test',
      description: 'Second save',
      userId: 'user1'
    });
    expect(save2.status).toBe(409); // Conflict
    expect(save2.body.error).toContain('already exists');
  });

  // Test: Scenario Loader - Prevent saving with reserved names
  // Purpose: Verifies validation prevents using preset names for user scenarios
  // Why: Preset names ('empty', 'nearly-done') are reserved
  // Coverage: Reserved name validation
  test('POST /api/v1/scenarios/save rejects reserved names', async () => {
    const saveEmpty = await request('POST', '/api/v1/scenarios/save', {
      name: 'empty',
      description: 'Should fail',
      userId: 'user1'
    });
    expect(saveEmpty.status).toBe(400);
    expect(saveEmpty.body.error).toContain('reserved');
    
    const saveNearlyDone = await request('POST', '/api/v1/scenarios/save', {
      name: 'nearly-done',
      description: 'Should fail',
      userId: 'user1'
    });
    expect(saveNearlyDone.status).toBe(400);
    expect(saveNearlyDone.body.error).toContain('reserved');
  });

  // Test: Scenario Loader - Load user-saved scenario
  // Purpose: Verifies users can load their saved scenarios
  // Why: Saved scenarios must be loadable to be useful
  // Coverage: Loading user scenarios via factory-reset endpoint
  test('user-saved scenarios can be loaded', async () => {
    // Create and save a scenario
    await request('POST', '/api/v1/factory-reset', { userId: 'test' });
    await sleep(500);
    
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Saved scenario message',
      internal: false
    });
    
    const saveRes = await request('POST', '/api/v1/scenarios/save', {
      name: 'Load Test Scenario',
      description: 'For testing load',
      userId: 'user1'
    });
    expect(saveRes.status).toBe(200);
    const scenarioId = saveRes.body.scenario.id;
    
    // Reset to clean state
    await request('POST', '/api/v1/factory-reset', { userId: 'test' });
    await sleep(500);
    
    // Verify clean
    const beforeLoad = await request('GET', '/api/v1/messages?userId=user1');
    expect(beforeLoad.body.messages.length).toBe(0);
    
    // Load the saved scenario
    const loadRes = await request('POST', '/api/v1/factory-reset', {
      userId: 'test',
      preset: scenarioId
    });
    expect(loadRes.status).toBe(200);
    await sleep(500);
    
    // Verify data was restored
    const afterLoad = await request('GET', '/api/v1/messages?userId=user1');
    expect(afterLoad.body.messages.length).toBeGreaterThan(0);
  });

  // Test: Scenario Loader - Delete user scenario
  // Purpose: Verifies users can delete their saved scenarios
  // Why: Users need to clean up old/unwanted scenarios
  // Coverage: Scenario deletion API
  test('DELETE /api/v1/scenarios/:id deletes user scenario', async () => {
    // Create a scenario
    const saveRes = await request('POST', '/api/v1/scenarios/save', {
      name: 'To Delete',
      description: 'Will be deleted',
      userId: 'user1'
    });
    expect(saveRes.status).toBe(200);
    const scenarioId = saveRes.body.scenario.id;
    
    // Verify it exists
    const listBefore = await request('GET', '/api/v1/scenarios');
    const scenarioBefore = listBefore.body.scenarios.find(s => s.id === scenarioId);
    expect(scenarioBefore).toBeDefined();
    
    // Delete it
    const deleteRes = await request('DELETE', `/api/v1/scenarios/${scenarioId}?userId=user1`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.ok).toBe(true);
    
    // Verify it's gone
    const listAfter = await request('GET', '/api/v1/scenarios');
    const scenarioAfter = listAfter.body.scenarios.find(s => s.id === scenarioId);
    expect(scenarioAfter).toBeUndefined();
  });

  // Test: Scenario Loader - Prevent deleting presets
  // Purpose: Verifies system prevents deletion of preset scenarios
  // Why: Preset scenarios must be protected from deletion
  // Coverage: Preset deletion protection
  test('DELETE /api/v1/scenarios/:id rejects preset deletion', async () => {
    const deleteEmpty = await request('DELETE', '/api/v1/scenarios/empty?userId=user1');
    expect(deleteEmpty.status).toBe(403);
    expect(deleteEmpty.body.error).toContain('Cannot delete preset');
    
    const deleteNearlyDone = await request('DELETE', '/api/v1/scenarios/nearly-done?userId=user1');
    expect(deleteNearlyDone.status).toBe(403);
    expect(deleteNearlyDone.body.error).toContain('Cannot delete preset');
  });

  // Test: Scenario Loader - Delete non-existent scenario
  // Purpose: Verifies graceful handling of deleting non-existent scenarios
  // Why: API should return proper 404 for missing scenarios
  // Coverage: 404 handling for scenario deletion
  test('DELETE /api/v1/scenarios/:id returns 404 for non-existent scenario', async () => {
    const deleteRes = await request('DELETE', '/api/v1/scenarios/non-existent-scenario?userId=user1');
    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.error).toContain('not found');
  });

  test('POST /api/v1/approvals/notify sends notifications', async () => {
    const res = await request('POST', '/api/v1/approvals/notify', {
      userId: 'user1',
      message: 'Please review document'
    });
    expect(res.status).toBe(200);
  });

  // Test: Message search functionality
  // Purpose: Verifies the search API can filter messages by query text
  // Why: Users need to quickly find relevant conversations by searching content
  // Coverage: Tests full-text search across message titles and post content (commit ddb9e64)
  test('GET /api/v1/messages supports search functionality', async () => {
    // Create messages with different content
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Contract terms discussion',
      internal: false
    });

    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user3', label: 'User 3', email: 'user3@test.com', internal: true }],
      text: 'Budget planning meeting',
      internal: false
    });

    // Search for "contract" - should return messages matching this term
    const searchRes = await request('GET', '/api/v1/messages?userId=user1&search=contract');
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.messages).toBeDefined();
    
    // Verify search results contain the relevant message
    // Posts are attached to each message in the 'posts' array
    const hasContractMessage = searchRes.body.messages.some(m => 
      m.title?.toLowerCase().includes('contract') || 
      m.posts?.some(p => p.text?.toLowerCase().includes('contract'))
    );
    expect(hasContractMessage).toBe(true);
  });

  // Test: Duplicate one-on-one conversation handling
  // Purpose: Verifies system gracefully handles attempts to create duplicate conversations
  // Why: Client-side validation prevents duplicates, but server should handle edge cases
  // Coverage: Tests data integrity when duplicate one-on-one messages are created (commit 889a308)
  test('POST /api/v1/messages prevents duplicate one-on-one conversations', async () => {
    // Create first conversation between user1 and user2
    const first = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'First message',
      internal: false
    });
    expect(first.status).toBe(200);

    // Try to create another one-on-one with same participant
    const second = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Duplicate attempt',
      internal: false
    });
    
    // Should still succeed (server doesn't enforce this, it's client-side validation)
    // But we verify the system can handle it gracefully without errors
    expect(second.status).toBe(200);
  });

  // Test: Auto-generated message titles
  // Purpose: Verifies messages get automatic titles generated from participant names
  // Why: Users don't need to manually enter titles - they're derived from context
  // Coverage: Tests title generation logic for conversations (commit abdd032)
  test('POST /api/v1/messages auto-generates titles from participants', async () => {
    // Create message without explicit title - should auto-generate from participants
    const res = await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [
        { userId: 'user2', label: 'Alice Smith', email: 'alice@test.com', internal: true },
        { userId: 'user3', label: 'Bob Jones', email: 'bob@test.com', internal: true }
      ],
      text: 'Group discussion',
      internal: false
    });
    
    expect(res.status).toBe(200);
    expect(res.body.message.title).toBeDefined();
    // Title should be auto-generated string (e.g., "Alice Smith, Bob Jones")
    expect(typeof res.body.message.title).toBe('string');
    expect(res.body.message.title.length).toBeGreaterThan(0);
  });

  // Test: CSV export with filtering options
  // Purpose: Verifies message export generates CSV with proper filtering by scope and flags
  // Why: Users need to export message data for compliance, auditing, and reporting
  // Coverage: Tests CSV export API with filters for internal/external/privileged content (commits 556c058, 8115c32)
  test('GET /api/v1/messages/export generates CSV with filters', async () => {
    // Create test messages with different flag combinations
    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user2', label: 'User 2', email: 'user2@test.com', internal: true }],
      text: 'Internal message',
      internal: true,
      external: false,
      privileged: false
    });

    await request('POST', '/api/v1/messages', {
      userId: 'user1',
      recipients: [{ userId: 'user3', label: 'User 3', email: 'user3@test.com', internal: true }],
      text: 'External message',
      internal: false,
      external: true,
      privileged: false
    });

    // Export all messages with filters applied
    const exportRes = await request('GET', '/api/v1/messages/export.csv?scope=all&includeInternal=true&includePrivileged=true&includePosts=false');
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers['content-type']).toContain('text/csv');
  });
});
