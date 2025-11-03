# Fix: AI Chat Responses Now Appear Immediately

## Problem
AI chat responses only appeared after the user switched to a different user in the dropdown. The user had to trigger a UI update to see the response.

## Root Cause
The server was generating the AI response and saving it to chat history, but **never sending it back to the client** via SSE. The response was sitting on the server with no way for the client to know it existed until the next refresh.

## Solution Overview
Implemented **targeted SSE messaging** so the server can send messages to specific users:

### 1. Track SSE Clients by User
**Changed:** `sseClients` from `Set` to `Map`
- **Before:** `const sseClients = new Set();` - no way to identify which client belongs to which user
- **After:** `const sseClients = new Map();` - stores `{ userId, platform, sessionId }` for each connection

### 2. Added Targeted Messaging Function
Created `sendToUser(userId, platform, event)` to send SSE events to a specific user+platform combination:
```javascript
function sendToUser(userId, platform, event) {
  // ... enriches event and loops through sseClients
  for (const [res, clientInfo] of sseClients.entries()) {
    if (clientInfo.userId === userId && clientInfo.platform === platform) {
      res.write(payload);
    }
  }
}
```

### 3. Server: Track User Info on SSE Connect
**File:** `server/src/server.js` - SSE endpoint (`/api/v1/events`)
- Extracts `userId` and `platform` from query params
- Stores them with the SSE connection: `sseClients.set(res, { userId, platform, sessionId })`

### 4. Client: Send User Info When Connecting
**File:** `shared-ui/components.react.js` - EventSource creation
- **Before:** `${API_BASE}/api/v1/events?token=${token}`
- **After:** `${API_BASE}/api/v1/events?token=${token}&userId=${userId}&platform=${platform}`

### 5. Use Targeted Messaging for AI Responses
**File:** `server/src/server.js` - `/api/v1/events/client` endpoint
After generating the AI response, now calls:
```javascript
sendToUser(userId, originPlatform, {
  type: 'chat',
  payload: { text: demoResponse, sender: 'bot' },
  userId: 'bot',
  role: 'bot'
});
```

## Files Changed
- `server/src/server.js` (lines 1407, 1432-1451, 4606-4612, 5100-5108)
- `shared-ui/components.react.js` (lines 722-729)

## Testing
1. Run `run-local.bat` (now kills old processes automatically)
2. Open web + Word side-by-side
3. Type in AI chat in web - response should appear **immediately** in web only
4. Type in AI chat in Word - response should appear **immediately** in Word only
5. No cross-contamination between windows/users

## Bonus Fix
Updated `run-local.bat` to always kill and restart server processes on ports 4000 and 4001, ensuring code changes take effect without manual process killing.

