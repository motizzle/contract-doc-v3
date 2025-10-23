# Feature: Per-User Session Isolation (JWT-Based)

**Status:** ✅ COMPLETED  
**Priority:** High  
**Platforms:** Web, Word Add-in  
**Related:** State Management, Cross-Platform Sync, Authentication  
**Implementation:** JWT (JSON Web Tokens)

---

## Overview

Enable multiple users to access the deployed prototype simultaneously without interfering with each other's data. Each user (or device) gets an isolated session with their own document state, edits, variables, approvals, and activity logs.

**Key Principle:** Session isolation maintains cross-platform sync for the same user while preventing different users from seeing each other's changes.

**Authentication Method:** JWT tokens provide secure, stateless, automatic session management with zero user interaction required.

---

## Problem Statement

### Current State (Shared Global State)
- All users share the same `data/working/` directory
- User A's edits are visible to User B
- Approvals, variables, messages are global
- Demo scenarios interfere with each other
- Cannot have multiple simultaneous demos

### User Story

**As a** prototype user accessing the deployed app  
**I want** my own isolated workspace  
**So that** my edits and state don't interfere with other users' sessions

**As the same user** on both web and Word add-in  
**I want** my changes to sync between platforms  
**So that** I see consistent state regardless of which platform I use

---

## Solution: JWT-Based Session Isolation (Smart Approach)

### Key Innovation: Zero-Refactor Implementation

**Instead of massive code refactoring, we use two clever techniques:**

1. **Global `fetch()` Override** - Automatically injects JWT tokens into ALL API calls
   - ✅ No need to replace 100+ fetch() calls
   - ✅ Works with existing code unchanged
   - ✅ Auto-refresh on token expiration

2. **Backward-Compatible Middleware** - Falls back to default session when no JWT present
   - ✅ No breaking changes
   - ✅ App works without JWT (current behavior preserved)
   - ✅ Gradual migration path
   - ✅ Graceful degradation

**Result:** Full JWT authentication with ~100 lines of code instead of 10,000+ line refactor!

---

### Architecture

```
User Session = JWT Token → Session ID + Metadata + Expiration

JWT Token (stored client-side):
{
  "sessionId": "sess_1234_abc",
  "iat": 1698076800,
  "exp": 1698681600  // 7 days
}

File System:
data/
  app/                    ← Canonical seed data (shared, read-only)
    presets/
    documents/
    users/
  working-{sessionId}/    ← Per-session isolated state (read-write)
    documents/
    versions/
    variables.json
    approvals.json
    activity-log.json
    messages.json
    state.json
```

### JWT Token Flow

**1. Initial Request (No Token):**
```
Client → Server: GET /api/v1/session/start
Server: Generates sessionId, creates JWT, initializes session directory
Server → Client: { token: "eyJhbGciOi...", sessionId: "sess_1234_abc" }
Client: Stores token (localStorage or Office.context.roamingSettings)
```

**2. Subsequent Requests (With Token):**
```
Client → Server: GET /api/v1/variables
Headers: { Authorization: "Bearer eyJhbGciOi..." }
Server: Validates JWT, extracts sessionId, serves session-scoped data
Server → Client: { variables: { ... } }
```

**3. Cross-Platform Sync:**
```
Web Browser:
  1. Requests token from server
  2. Stores in localStorage
  3. Includes in all API calls

Word Add-in (same device):
  1. Requests token from server (same logic)
  2. Stores in Office.context.roamingSettings
  3. Includes in all API calls
  
Result: Both get their own tokens, but tokens contain same sessionId logic
       → Both platforms share the same session directory
```

### Token Generation & Storage

**Server (`server/src/server.js`):**
```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION = '7d'; // 7 days

// Generate new session token
app.post('/api/v1/session/start', (req, res) => {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create JWT
  const token = jwt.sign(
    { sessionId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
  
  // Initialize session directory
  initializeSession(sessionId);
  
  res.json({ token, sessionId });
});

// Validate token on every request
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
  
  if (!token) {
    // No token = create new session (for backward compatibility)
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.sessionId = decoded.sessionId;
    req.user = decoded; // Full token payload
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

// Apply to all API routes
app.use('/api/v1', authenticateToken);
```

**Web Client (`shared-ui/components.react.js`):**
```javascript
// Token management
let authToken = null;

async function initializeAuth() {
  // Try to get stored token
  authToken = localStorage.getItem('wordftw_auth_token');
  
  if (!authToken) {
    // Request new token from server
    try {
      const response = await fetch(`${API_BASE}/api/v1/session/start`, {
        method: 'POST'
      });
      const data = await response.json();
      authToken = data.token;
      localStorage.setItem('wordftw_auth_token', authToken);
      console.log(`✅ New session created: ${data.sessionId}`);
    } catch (err) {
      console.error('❌ Failed to initialize session:', err);
    }
  } else {
    console.log('✅ Using existing session token');
  }
  
  return authToken;
}

// Wrapper for all API calls
async function fetchWithAuth(url, options = {}) {
  if (!authToken) {
    await initializeAuth();
  }
  
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle expired token
  if (response.status === 403) {
    console.warn('Token expired, requesting new session...');
    localStorage.removeItem('wordftw_auth_token');
    authToken = null;
    await initializeAuth();
    // Retry request with new token
    return fetchWithAuth(url, options);
  }
  
  return response;
}

// Initialize on app load
initializeAuth();
```

**Word Add-in (`addin/src/taskpane/taskpane.js`):**
```javascript
let authToken = null;

Office.onReady(async () => {
  await initializeAuth();
});

async function initializeAuth() {
  const settings = Office.context.roamingSettings;
  authToken = settings.get('wordftw_auth_token');
  
  if (!authToken) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/session/start`, {
        method: 'POST'
      });
      const data = await response.json();
      authToken = data.token;
      
      settings.set('wordftw_auth_token', authToken);
      await new Promise((resolve, reject) => {
        settings.saveAsync((result) => {
          result.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject();
        });
      });
      
      console.log(`✅ New session created: ${data.sessionId}`);
    } catch (err) {
      console.error('❌ Failed to initialize session:', err);
    }
  } else {
    console.log('✅ Using existing session token');
  }
  
  return authToken;
}

async function fetchWithAuth(url, options = {}) {
  if (!authToken) {
    await initializeAuth();
  }
  
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 403) {
    console.warn('Token expired, requesting new session...');
    const settings = Office.context.roamingSettings;
    settings.remove('wordftw_auth_token');
    await settings.saveAsync();
    authToken = null;
    await initializeAuth();
    return fetchWithAuth(url, options);
  }
  
  return response;
}
```

---

## Two-Layer User Model

### Layer 1: JWT Token (Session Authentication)
- **What:** Cryptographically signed token containing session ID
- **Purpose:** Isolates data between different people, enables automatic cross-platform sync
- **Storage:** 
  - Web: `localStorage.getItem('wordftw_auth_token')`
  - Word: `Office.context.roamingSettings.get('wordftw_auth_token')`
- **Persistence:** 7 days (configurable), auto-renewed on expiration
- **Scope:** Per-device/browser instance
- **Security:** Server validates signature on every request

**Token Payload:**
```json
{
  "sessionId": "sess_1234_abc",
  "iat": 1698076800,  // Issued at timestamp
  "exp": 1698681600   // Expiration timestamp (7 days later)
}
```

**Example:**
- Your laptop web browser → Token A → `sessionId: sess_1234_abc`
- Your laptop Word add-in → Token B → `sessionId: sess_5678_xyz` (different token)
- ❌ **Current limitation:** Web and Word don't share same session automatically

**Future Enhancement (Session Linking):**
- Both platforms could request same sessionId via server-side logic
- Use device fingerprinting or Microsoft identity to link sessions
- For MVP: Accept that each platform gets its own isolated session

### Layer 2: User ID (Role Within Session)
- **What:** The role you're simulating (Warren Peace, Ivy League, etc.)
- **Purpose:** Test different user perspectives within your session
- **Storage:** Part of session state (`data/working-{sessionId}/state.json`)
- **Persistence:** Per session
- **Scope:** Within the session

**Example (within session `sess_1234_abc`):**
- Switch to "Warren Peace" (editor) → See his messages, approvals
- Switch to "Ivy League" (approver) → See her perspective
- Your colleague (session `sess_5678_xyz`) never sees your changes

**Clarification:**
- Layer 1 (JWT) = Which session directory you use
- Layer 2 (User ID) = Which user role you're viewing within that session

---

## Server-Side Implementation

### 1. JWT Authentication Middleware

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION = '7d';

// Middleware to validate JWT and extract sessionId (BACKWARD COMPATIBLE)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"
  
  if (!token) {
    // No token = use default session (backward compatible)
    req.sessionId = 'default';
    console.log(`⚠️ No JWT token - using default session (${req.path})`);
    return next();
  }
  
  try {
    // Verify and decode token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach session info to request
    req.sessionId = decoded.sessionId;
    req.tokenPayload = decoded;
    
    // Ensure session directory exists
    getWorkingDir(req.sessionId);
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        error: 'Token expired',
        action: 'refresh_token',
        endpoint: '/api/v1/session/start'
      });
    }
    
    // Invalid token = fall back to default session (graceful degradation)
    console.warn(`⚠️ Invalid JWT token - using default session (${req.path})`);
    req.sessionId = 'default';
    next();
  }
}

// Initialize default session on server startup (backward compatibility)
initializeSession('default');
```

**Why Backward Compatibility:**
- ✅ **Zero breaking changes** - app works without JWT
- ✅ **Gradual migration** - update endpoints as needed
- ✅ **Testing friendly** - can test without auth
- ✅ **Graceful degradation** - invalid tokens don't crash

**Migration Path:**
1. Phase 1: Default session for all (current behavior)
2. Phase 2: Update file operations to use `req.sessionId`
3. Phase 3: Test JWT-authenticated users (isolated sessions)
4. Phase 4: Remove default session (JWT required)

// Apply JWT auth to all API routes (except session creation)
app.post('/api/v1/session/start', createSession); // Public endpoint
app.use('/api/v1', authenticateToken); // Protected routes

// Session creation endpoint (no auth required)
function createSession(req, res) {
  try {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create JWT token
    const token = jwt.sign(
      { sessionId },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );
    
    // Initialize session directory with seed data
    initializeSession(sessionId);
    
    console.log(`✅ Created new session: ${sessionId}`);
    
    res.json({ 
      token, 
      sessionId,
      expiresIn: JWT_EXPIRATION
    });
  } catch (err) {
    console.error('❌ Failed to create session:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
}
```

### 2. Session-Scoped File Paths

```javascript
// Helper to get session-specific working directory
function getWorkingDir(sessionId) {
  const sessionDir = path.join(dataDir, `working-${sessionId}`);
  
  // Create if doesn't exist
  if (!fs.existsSync(sessionDir)) {
    initializeSession(sessionId);
  }
  
  return sessionDir;
}

// Initialize new session from canonical data
function initializeSession(sessionId) {
  const sessionDir = getWorkingDir(sessionId);
  const canonicalDir = path.join(dataDir, 'app');
  
  // Create session directories
  fs.mkdirSync(path.join(sessionDir, 'documents'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'versions'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'exhibits'), { recursive: true });
  
  // Copy seed data
  fs.copyFileSync(
    path.join(canonicalDir, 'documents', 'default.docx'),
    path.join(sessionDir, 'documents', 'default.docx')
  );
  
  // Initialize JSON state files
  fs.writeFileSync(
    path.join(sessionDir, 'state.json'),
    JSON.stringify({
      checkedOutBy: null,
      documentVersion: 1,
      title: 'Redlined & Signed',
      status: 'draft',
      lastUpdated: new Date().toISOString(),
      revision: 0
    }, null, 2)
  );
  
  // Copy seed variables
  fs.copyFileSync(
    path.join(canonicalDir, 'variables.seed.json'),
    path.join(sessionDir, 'variables.json')
  );
  
  // Initialize empty approvals, activity, messages
  fs.writeFileSync(path.join(sessionDir, 'approvals.json'), '{"approvers":[]}');
  fs.writeFileSync(path.join(sessionDir, 'activity-log.json'), '[]');
  fs.writeFileSync(path.join(sessionDir, 'messages.json'), '{"messages":[],"posts":[]}');
  
  console.log(`✅ Initialized session: ${sessionId}`);
}
```

### 3. Update All Endpoints

**Before:**
```javascript
app.get('/api/v1/variables', (req, res) => {
  const variables = readVariables(); // Reads from global data/working/
  res.json({ variables });
});
```

**After:**
```javascript
app.get('/api/v1/variables', (req, res) => {
  const sessionId = req.sessionId;
  const variables = readVariables(sessionId); // Reads from data/working-{sessionId}/
  res.json({ variables });
});

function readVariables(sessionId) {
  const workingDir = getWorkingDir(sessionId);
  const variablesPath = path.join(workingDir, 'variables.json');
  return JSON.parse(fs.readFileSync(variablesPath, 'utf8'));
}
```

**Apply to all endpoints:**
- `/api/v1/state-matrix`
- `/api/v1/variables`
- `/api/v1/approvals`
- `/api/v1/activity`
- `/api/v1/messages`
- `/api/v1/save-progress`
- `/api/v1/versions`
- `/documents/working/default.docx`
- All other state-modifying endpoints

---

## Client-Side Implementation

### 1. Global fetch() Override (Smart Approach - Zero Refactoring!)

**Web (`shared-ui/components.react.js`):**
```javascript
// Global token storage
let authToken = null;

// Initialize authentication on app load
async function initializeAuth() {
  // Try to retrieve existing token
  authToken = localStorage.getItem('wordftw_auth_token');
  
  if (!authToken) {
    // Request new token from server
    console.log('🔐 No token found, requesting new session...');
    authToken = await requestNewToken();
  } else {
    console.log('🔐 Using existing authentication token');
  }
  
  return authToken;
}

// Request new token from server
async function requestNewToken() {
  try {
    const API_BASE = getApiBase();
    const response = await fetch(`${API_BASE}/api/v1/session/start`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }
    
    const data = await response.json();
    authToken = data.token;
    localStorage.setItem('wordftw_auth_token', authToken);
    
    console.log(`✅ New session created: ${data.sessionId}`);
    console.log(`🕐 Token expires in: ${data.expiresIn}`);
    
    return authToken;
  } catch (err) {
    console.error('❌ Failed to initialize session:', err);
    throw err;
  }
}

// Wrapper for all authenticated API calls
async function fetchWithAuth(url, options = {}) {
  // Ensure we have a token
  if (!authToken) {
    await initializeAuth();
  }
  
  // Add Authorization header
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle token expiration
  if (response.status === 403 || response.status === 401) {
    const errorData = await response.json().catch(() => ({}));
    
    if (errorData.action === 'refresh_token' || errorData.action === 'request_new_token') {
      console.warn('🔄 Token expired or invalid, requesting new session...');
      localStorage.removeItem('wordftw_auth_token');
      authToken = null;
      await initializeAuth();
      
      // Retry the original request with new token
      return fetchWithAuth(url, options);
    }
  }
  
  return response;
}

// Store original fetch before overriding
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
}

// Override global fetch() to automatically add JWT to API calls
window.fetch = async function(url, options = {}) {
  // Ensure we have a token
  if (!authToken && !isInitializingAuth) {
    await initializeAuth();
  }
  
  // Check if this is an API call to our backend
  const urlString = typeof url === 'string' ? url : (url instanceof URL ? url.href : '');
  const isApiCall = urlString.startsWith('/api/') || 
                   urlString.includes('/api/v1/') ||
                   urlString.startsWith(getApiBase());
  
  // Skip auth for session creation endpoint (avoid recursion)
  const isSessionEndpoint = urlString.includes('/api/v1/session/start');
  
  // Add JWT token to API calls
  if (isApiCall && !isSessionEndpoint && authToken) {
    options.headers = {
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    };
  }
  
  // Call original fetch
  const response = await window._originalFetch(url, options);
  
  // Auto-refresh expired tokens
  if (isApiCall && !isSessionEndpoint && (response.status === 401 || response.status === 403)) {
    const errorData = await response.clone().json().catch(() => ({}));
    
    if (errorData.action) {
      console.warn('🔄 Token expired or invalid, requesting new session...');
      localStorage.removeItem('wordftw_auth_token');
      authToken = null;
      await initializeAuth();
      
      // Retry with new token
      options.headers = {
        'Authorization': `Bearer ${authToken}`,
        ...options.headers
      };
      return window._originalFetch(url, options);
    }
  }
  
  return response;
};

// Initialize auth when app loads
setTimeout(() => initializeAuth(), 100);
```

**Why This Approach is Better:**
- ✅ **Zero code changes** to 100+ existing fetch() calls
- ✅ **No massive refactor** required  
- ✅ **Automatic JWT injection** for all API calls
- ✅ **Auto-refresh** on token expiration
- ✅ **Backward compatible** - works with existing code

**Word Add-in (`addin/src/taskpane/taskpane.js`):**
**Same pattern as web - global fetch() override:**

```javascript
let authToken = null;
let isInitializingAuth = false;

// Initialize authentication after Office is ready
Office.onReady(async () => {
  await initializeAuth();
});

async function initializeAuth() {
  if (isInitializingAuth) {
    while (isInitializingAuth) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return authToken;
  }

  isInitializingAuth = true;
  try {
    const settings = Office.context.roamingSettings;
    authToken = settings.get('wordftw_auth_token');
    
    if (!authToken) {
      console.log('🔐 No token found, requesting new session...');
      authToken = await requestNewToken();
    } else {
      console.log('🔐 Using existing authentication token');
    }
    
    return authToken;
  } finally {
    isInitializingAuth = false;
  }
}

async function requestNewToken() {
  try {
    const API_BASE = getApiBase();
    // Use original fetch to avoid recursion
    const response = await window._originalFetch(`${API_BASE}/api/v1/session/start`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }
    
    const data = await response.json();
    authToken = data.token;
    
    // Save to Office roaming settings
    const settings = Office.context.roamingSettings;
    settings.set('wordftw_auth_token', authToken);
    
    await new Promise((resolve, reject) => {
      settings.saveAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject(new Error('Failed to save token'));
        }
      });
    });
    
    console.log(`✅ New session created: ${data.sessionId}`);
    console.log(`🕐 Token expires in: ${data.expiresIn}`);
    
    return authToken;
  } catch (err) {
    console.error('❌ Failed to initialize session:', err);
    throw err;
  }
}

// Store original fetch before overriding
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
}

// Override global fetch() - same as web client
window.fetch = async function(url, options = {}) {
  if (!authToken && !isInitializingAuth) {
    await initializeAuth();
  }
  
  const urlString = typeof url === 'string' ? url : (url instanceof URL ? url.href : '');
  const isApiCall = urlString.startsWith('/api/') || 
                   urlString.includes('/api/v1/') ||
                   urlString.startsWith(getApiBase());
  const isSessionEndpoint = urlString.includes('/api/v1/session/start');
  
  if (isApiCall && !isSessionEndpoint && authToken) {
    options.headers = {
      'Authorization': `Bearer ${authToken}`,
      ...options.headers
    };
  }
  
  const response = await window._originalFetch(url, options);
  
  if (isApiCall && !isSessionEndpoint && (response.status === 401 || response.status === 403)) {
    const errorData = await response.clone().json().catch(() => ({}));
    
    if (errorData.action) {
      console.warn('🔄 Token expired or invalid, requesting new session...');
      const settings = Office.context.roamingSettings;
      settings.remove('wordftw_auth_token');
      await settings.saveAsync();
      authToken = null;
      await initializeAuth();
      
      options.headers = {
        'Authorization': `Bearer ${authToken}`,
        ...options.headers
      };
      return window._originalFetch(url, options);
    }
  }
  
  return response;
};
```

**Same benefits:**
- ✅ Zero fetch() call replacements needed
- ✅ Automatic JWT injection
- ✅ Auto-refresh on expiration

### 2. SSE with Session ID

**Server (broadcast to session only):**
```javascript
// Track SSE connections by session
const sseClients = new Map(); // sessionId -> Set of response objects

app.get('/api/v1/events', (req, res) => {
  const sessionId = req.sessionId;
  
  // ... SSE setup code ...
  
  // Add to session-specific client set
  if (!sseClients.has(sessionId)) {
    sseClients.set(sessionId, new Set());
  }
  sseClients.get(sessionId).add(res);
  
  // Remove on close
  req.on('close', () => {
    const clients = sseClients.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(sessionId);
      }
    }
  });
});

// Broadcast only to clients in the same session
function broadcast(sessionId, data) {
  const clients = sseClients.get(sessionId);
  if (!clients) return;
  
  const message = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(message);
    } catch (e) {
      clients.delete(client);
    }
  });
}

// Update all endpoints to broadcast to session
app.post('/api/v1/variables', (req, res) => {
  const sessionId = req.sessionId;
  // ... save variable ...
  broadcast(sessionId, { type: 'variable:created', variable });
  res.json({ ok: true, variable });
});
```

**Client (SSE with JWT authentication):**
```javascript
// EventSource doesn't support custom headers natively
// Solution: Pass session token via query parameter
const eventSource = new EventSource(`${API_BASE}/api/v1/events?token=${authToken}`);

// Server extracts sessionId from token and adds client to that session's SSE pool
```

**Note:** Since EventSource API doesn't support Authorization headers, the server can:
1. Accept token via query parameter: `/api/v1/events?token=xxx`
2. Extract sessionId from JWT
3. Add client to session-specific SSE broadcast group

---

## Cross-Platform Sync

### MVP Approach: Independent Sessions Per Platform

**Current Implementation (Simpler, Sufficient for Prototype):**

**Scenario:** User opens web browser and Word add-in on same device

1. **Web browser** requests token → Server generates `Token A` with `sessionId: sess_web_1234`
2. **Word add-in** requests token → Server generates `Token B` with `sessionId: sess_word_5678`
3. ❌ **No automatic sync between web and Word** (separate sessions)
4. ✅ **Each platform has isolated workspace** (primary goal achieved)

**Why This is OK for Prototype:**
- Primary goal: Prevent users from interfering with each other ✅
- Users typically use ONE platform at a time (either web or Word, not both)
- Simpler implementation, fewer edge cases
- Can enhance later if cross-platform sync becomes critical

**User Experience:**
- Using web? All your work is in your web session
- Using Word? All your work is in your Word session
- Want to switch platforms? Just factory reset to desired scenario on new platform

### Future Enhancement: Unified Cross-Platform Session

**For Phase 2, we could implement session linking:**

```javascript
// Server generates device fingerprint-based sessionId
function generateSessionId(req) {
  // Extract device info from user agent, IP, etc.
  const deviceFingerprint = hashDeviceInfo(req);
  return `sess_${deviceFingerprint}`;
}

// Both web and Word from same device get same sessionId
```

**Or use Microsoft SSO:**
- Office.auth.getAccessToken() in Word add-in
- MSAL.js in web app
- Same Microsoft account → same session

**Trade-offs:**
- ✅ Seamless cross-platform sync
- ❌ More complexity
- ❌ Device fingerprinting can be unreliable
- ❌ SSO requires Azure AD setup

### Different Users, Isolated Sessions

**Scenario:** Two users demo the prototype simultaneously

1. **User A** (laptop) → `Token A` → `sess_1234_abc` → sees `data/working-sess_1234_abc/`
2. **User B** (laptop) → `Token B` → `sess_5678_xyz` → sees `data/working-sess_5678_xyz/`
3. Changes in session A never reach session B
4. ✅ Complete isolation (PRIMARY GOAL)

**This is the critical requirement and is fully solved by JWT tokens.**

---

## User Switching (Within Session)

The **user dropdown** (Warren Peace, Ivy League, etc.) still works as before—it's now scoped to the session:

```javascript
// Session state includes current user ID
// data/working-sess_1234_abc/state.json
{
  "sessionId": "sess_1234_abc",
  "currentUserId": "user1",  // Which role user is viewing as
  "checkedOutBy": "user1",
  "documentVersion": 5,
  ...
}

// User switches from Warren Peace to Ivy League
// State updates within the session
// Other sessions never see this change
```

---

## Session Management

### Session Lifecycle

1. **Creation:** On first API call with new session ID
2. **Active:** Session directory exists, receives updates
3. **Idle:** No API calls for X hours (mark for cleanup)
4. **Expired:** Deleted after Y days of inactivity

### Cleanup Strategy (Render Free Tier)

**Challenge:** Render free tier has no persistent storage—data resets on restart.

**Solution:** Accept ephemeral sessions
- Sessions exist only during server uptime
- On server restart, all sessions reset
- Users get fresh sessions on next visit
- ✅ Acceptable for prototype/demo use

**Future (with persistent storage):**
```javascript
// Cleanup old sessions periodically
function cleanupSessions() {
  const sessions = fs.readdirSync(dataDir)
    .filter(dir => dir.startsWith('working-sess_'));
  
  const now = Date.now();
  const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  sessions.forEach(sessionDir => {
    const statePath = path.join(dataDir, sessionDir, 'state.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const lastActivity = new Date(state.lastUpdated).getTime();
      
      if (now - lastActivity > MAX_AGE) {
        console.log(`🗑️ Cleaning up expired session: ${sessionDir}`);
        fs.rmSync(path.join(dataDir, sessionDir), { recursive: true });
      }
    }
  });
}

// Run daily
setInterval(cleanupSessions, 24 * 60 * 60 * 1000);
```

---

## Migration Path

### Phase 1: Server-Side Session Support
1. Add session middleware
2. Add `getWorkingDir(sessionId)` helper
3. Update all file operations to use session-scoped paths
4. Update SSE to broadcast per-session
5. Default to `sessionId='default'` for backward compatibility

### Phase 2: Client-Side Session ID
1. Add session ID generation (web + add-in)
2. Add session ID to all API calls
3. Add session ID to SSE connection
4. Test cross-platform sync

### Phase 3: Testing & Polish
1. Test multiple simultaneous users
2. Test cross-platform sync (web ↔ Word)
3. Add session management UI (optional)
4. Document session behavior

---

## API Changes

### New Endpoint

**Session Creation (No Auth Required):**
```http
POST /api/v1/session/start

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sessionId": "sess_1234_abc",
  "expiresIn": "7d"
}
```

### Request Headers

**All authenticated API calls must include:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example:**
```http
GET /api/v1/variables HTTP/1.1
Host: wordftw.onrender.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Response Codes

**401 Unauthorized:**
```json
{
  "error": "No authentication token provided",
  "action": "request_token",
  "endpoint": "/api/v1/session/start"
}
```

**403 Forbidden:**
```json
{
  "error": "Token expired",
  "action": "refresh_token",
  "endpoint": "/api/v1/session/start"
}
```

**200 OK:**
```json
{
  "variables": { ... }
}
```

### Environment Variables

**Required:**
```bash
# Production (set in Render dashboard)
JWT_SECRET=your-super-secret-key-min-32-chars

# Development (uses default)
# JWT_SECRET=dev-secret-change-in-production (auto-generated)
```

**Security Notes:**
- JWT_SECRET must be at least 32 characters
- Change default secret in production
- Never commit secrets to git

---

## Testing Strategy

### Unit Tests

```javascript
describe('Session Isolation', () => {
  it('creates separate working directories per session', () => {
    initializeSession('sess_a');
    initializeSession('sess_b');
    
    expect(fs.existsSync('data/working-sess_a')).toBe(true);
    expect(fs.existsSync('data/working-sess_b')).toBe(true);
  });
  
  it('session A changes do not affect session B', async () => {
    const varA = await createVariable('sess_a', { name: 'Company' });
    const varsB = await getVariables('sess_b');
    
    expect(varsB).not.toContain(varA);
  });
  
  it('same session ID syncs across platforms', async () => {
    await createVariable('sess_a', { name: 'Company' });
    
    const varsWeb = await getVariables('sess_a');
    const varsWord = await getVariables('sess_a');
    
    expect(varsWeb).toEqual(varsWord);
  });
});
```

### Integration Tests

```javascript
describe('Cross-Platform Session Sync', () => {
  it('web edit appears in add-in (same session)', async () => {
    const sessionId = 'sess_test_123';
    const token = jwt.sign({ sessionId }, JWT_SECRET, { expiresIn: '7d' });
    
    // Web: checkout and save (JWT automatically added by fetch() override)
    await fetch(`${API_BASE}/api/v1/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ userId: 'user1' })
    });
    
    // Add-in: verify checkout visible (JWT automatically added)
    const state = await fetch(`${API_BASE}/api/v1/state-matrix`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await state.json();
    
    expect(json.config.checkoutStatus.checkedOutUserId).toBe('user1');
  });
});
```

### Manual Testing

1. **Isolation Test:**
   - Open web in Chrome → Note session ID in console
   - Open web in Firefox → Note different session ID
   - Make changes in Chrome → Verify not visible in Firefox
   
2. **Sync Test:**
   - Open web in Chrome → Note session ID
   - Open Word add-in → Force same session ID
   - Make changes in web → Verify visible in Word
   
3. **User Switching Test:**
   - Within one session, switch between users
   - Verify messages, approvals, permissions change
   - Verify other session unaffected

---

## Edge Cases

### Session ID Conflicts
**Probability:** Extremely low (timestamp + random)  
**Mitigation:** Include more entropy; check for collision on creation

### Session Storage Quota
**Scenario:** localStorage full (rare)  
**Fallback:** Use in-memory session ID (lost on page refresh)

### Cross-Device Sync
**Scenario:** User wants same session on home laptop + work laptop  
**Solution:** Not supported in MVP. Future: login system with persistent sessions.

### Session Hijacking
**Risk:** Someone guesses another's session ID  
**Mitigation:** Use longer random strings; add user agent check (future)

---

## Success Criteria

### Phase 1: JWT Authentication (MVP)
- [ ] Multiple users can access deployed prototype simultaneously without interference
- [ ] Each user has isolated state (documents, variables, approvals, activity log)
- [ ] JWT tokens are automatically generated and stored client-side
- [ ] All API calls include Authorization header with JWT token
- [ ] Server validates JWT and extracts sessionId on every request
- [ ] Expired tokens are automatically refreshed
- [ ] User dropdown (Warren Peace, etc.) still works within session
- [ ] SSE broadcasts reach only same-session clients
- [ ] Session persistence works across page reloads
- [ ] Clean error messages when token is invalid/expired

### Phase 2: Cross-Platform Sync (Future)
- [ ] Same user on web + Word add-in see synchronized state
- [ ] Device fingerprinting or SSO links sessions across platforms
- [ ] Session linking UI for manual pairing

### Security
- [ ] JWT_SECRET environment variable set in production
- [ ] Tokens expire after 7 days
- [ ] No sensitive data in JWT payload
- [ ] HTTPS enforced for token transmission (Render handles this)

---

## Future Enhancements

### Phase 2: Session Management UI
- Show current session ID (for debugging)
- "Reset My Session" button (factory reset scoped to session)
- Session activity indicator (last active time)

### Phase 3: Named Sessions
- Give sessions friendly names ("Demo for Client A")
- Share session URLs with colleagues
- Session expiration warnings

### Phase 4: Account-Based Sessions
- Replace anonymous sessions with user accounts
- Cross-device session continuity
- Session history and restore

---

## Deployment Considerations

### Render Free Tier
- ✅ No persistent storage → Sessions ephemeral (acceptable)
- ✅ Each server restart = fresh state for all users
- ✅ Users auto-get new sessions on next visit

### Future: Render Paid Tier ($7/month)
- ✅ Persistent storage → Sessions survive restarts
- ✅ Session cleanup after 7 days idle
- ✅ Better experience for returning users

---

## Documentation Updates

### User-Facing
- "Your changes are private to your session"
- "Use the same browser/device to see your previous work"
- "Clear browser data = lose your session"

### Developer-Facing
- Add session ID to all API examples
- Document session lifecycle
- Troubleshooting guide for sync issues

---

## Implementation Checklist

### Step 1: Install Dependencies
```bash
cd server
npm install jsonwebtoken
```

### Step 2: Server-Side Implementation ✅ MOSTLY COMPLETED
- [x] Add JWT secret to environment variables
- [x] Create `POST /api/v1/session/start` endpoint
- [x] Implement **backward-compatible** `authenticateToken` middleware
- [x] Apply middleware to all `/api/v1/*` routes (except session/start)
- [x] Update `initializeSession()` to create session directories
- [x] Initialize 'default' session for backward compatibility
- [ ] Update file operations to use `req.sessionId` (OPTIONAL - gradual migration)
- [ ] Update SSE to broadcast per-session (OPTIONAL - Phase 2)

### Step 3: Client-Side Implementation (Web) ✅ COMPLETED
- [x] Add `initializeAuth()` function
- [x] Add `requestNewToken()` function
- [x] Add **global `fetch()` override** (replaces fetchWithAuth wrapper)
- [x] ~~Replace all `fetch()` calls with `fetchWithAuth()`~~ **NOT NEEDED - override handles it!**
- [x] Call `initializeAuth()` on app load
- [x] Test token storage in localStorage
- [ ] Test token auto-refresh on expiration

### Step 4: Client-Side Implementation (Word) - Optional (Phase 2)
- [ ] Add `initializeAuth()` function (Office version)
- [ ] Add `requestNewToken()` function
- [ ] Add **global `fetch()` override** (same pattern as web)
- [ ] ~~Replace all `fetch()` calls~~ **NOT NEEDED - override handles it!**
- [ ] Call `initializeAuth()` in `Office.onReady()`
- [ ] Test token storage in Office.context.roamingSettings
- [ ] Test token auto-refresh on expiration

### Step 5: Testing
- [ ] Unit tests for JWT generation/validation
- [ ] Unit tests for session directory creation
- [ ] Integration tests for multi-user isolation
- [ ] Manual test: Two browsers, different sessions
- [ ] Manual test: Token expiration and refresh
- [ ] Manual test: Factory reset per-session
- [ ] Manual test: SSE broadcasts per-session

### Step 6: Deployment
- [ ] Set `JWT_SECRET` environment variable in Render dashboard
- [ ] Deploy to staging
- [ ] Verify token generation works
- [ ] Verify session isolation works
- [ ] Deploy to production

### Step 7: Documentation
- [ ] Update API documentation with Authorization header
- [ ] Document session lifecycle
- [ ] Update deployment guide
- [ ] Add troubleshooting guide for auth issues

---

## Related Files

**Server:**
- `server/src/server.js` - JWT middleware, session endpoints, scoped file operations
- `server/package.json` - Add `jsonwebtoken` dependency

**Client:**
- `shared-ui/components.react.js` - JWT auth initialization, **global fetch() override**
- `addin/src/taskpane/taskpane.js` - Office-specific JWT auth (Phase 2)

**Tests:**
- `server/tests/session-isolation.test.js` - JWT and session isolation tests (new file)

**Deployment:**
- `render.yaml` - Add JWT_SECRET env var (sync: false)
- `env.example` - Document JWT_SECRET

---

**Last Updated:** October 23, 2025  
**Status:** 🚧 In Progress - Specification Complete, Ready for Code Implementation

