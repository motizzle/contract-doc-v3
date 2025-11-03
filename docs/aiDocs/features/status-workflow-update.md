# Feature Update: Enhanced Status Workflow with Celebration

**Status:** 📝 Planned  
**Last Updated:** October 30, 2025  
**Related Files:**
- `server/src/server.js` - Status cycle endpoint (line 3199-3232)
- `shared-ui/components.react.js` - StatusBadge component (line 4450-4468), FinalizeCelebration component (line 2157-2223)
- `server/tests/app.test.js` - Status tests (Phase 11: line 894-958)

---

## Summary

Update the document status workflow from a simple 3-state cycle to a comprehensive 6-state workflow. Users will be able to select any status directly (not just cycle forward). Confetti celebration will only trigger on the "signed" status. Additionally, optimize the celebration confetti animation which currently uses a slow-performing external library.

**Key Changes:**
- **6 Statuses:** draft → internal review → vendor review → internal final review → out for signature → signed
- **Direct Selection:** Click badge to choose any status (dropdown or modal), not cycle through
- **Confetti:** Only triggers on "signed" status
- **Styling:** Descending shades of grey (gray-medium → gray-dark → gray-verydark)
- **Permissions:** Only editors can change status

---

## Current Implementation

### Status Options (Current - 3 states)
```javascript
// server/src/server.js line 3202
const order = ['draft', 'review', 'out for signature'];
```

**Actual Current Code:**
```javascript
const order = ['draft', 'review', 'final'];
```

### Current Behavior
- **Status Cycle:** draft → review → out for signature → draft (loops)
- **Current Code:** Cycles through `['draft', 'review', 'final']`
- **Confetti Trigger:** Shows when status changes to `'final'` (line 2165 in components.react.js)
- **Confetti Library:** Uses canvas-confetti@1.6.0 from CDN (line 293 in components.react.js)
- **Navigation:** Click badge to cycle forward only - no way to go backward or skip

---

## Proposed Changes

### 1. New Status Options (6 states)

```javascript
const order = ['draft', 'internal review', 'vendor review', 'internal final review', 'out for signature', 'signed'];
```

**Status Flow:**
```
draft → internal review → vendor review → internal final review → out for signature → signed
```

### 2. Direct Status Selection

**Key Requirement:** Users can select **any status directly** - not just cycle through them.

**Implementation Approach:**
- Replace the click-to-cycle behavior with click-to-select
- User clicks badge → sees all 6 options → picks one
- No more cycling/stepping through statuses

**UX Options:**
1. **Click badge → opens modal → user selects from list of 6 statuses**
2. **Badge is a dropdown menu showing all 6 statuses** with current status highlighted


### 3. Celebration Animation Update

**Current Issue:**
- Confetti animation is slow and appears glitchy
- Uses canvas-confetti@1.6.0 library from CDN
- Performance issues suggest library may be heavyweight

**Proposed Changes:**
- **Trigger:** Confetti now **only** shows when status changes to `'signed'` (final status)
- **Performance:** Evaluate alternatives to canvas-confetti library or implement custom lightweight confetti
- **Options:**
  - Custom CSS animation-based confetti (lighter weight)
  - React-confetti library (better React integration)
  - Simplified particle system with requestAnimationFrame
  - Keep canvas-confetti but optimize parameters (reduce particle count, shorter duration)

---

## Technical Implementation Details

### Server-Side Changes

#### File: `server/src/server.js`

**Endpoint:** `POST /api/v1/status/cycle`

**Current Implementation (lines 3199-3232):**
```javascript
app.post('/api/v1/status/cycle', (req, res) => {
  try {
    const order = ['draft', 'review', 'final'];
    const cur = String(serverState.status || 'draft').toLowerCase();
    const i = order.indexOf(cur);
    const next = order[(i >= 0 ? (i + 1) % order.length : 0)];
    serverState.status = next;
    serverState.lastUpdated = new Date().toISOString();
    persistState();
    broadcast({ type: 'status', status: next });
    
    // ... activity logging ...
    
    res.json({ ok: true, status: next });
  } catch (e) {
    res.status(500).json({ error: 'status_cycle_failed' });
  }
});
```

**Proposed Updates:**

1. **Update status order array:**
```javascript
const order = ['draft', 'internal review', 'vendor review', 'internal final review', 'out for signature', 'signed'];
```

2. **Replace cycle endpoint with direct status set:**
```javascript
app.post('/api/v1/status/set', (req, res) => {
  try {
    const allowedStatuses = ['draft', 'internal review', 'vendor review', 'internal final review', 'out for signature', 'signed'];
    const newStatus = String(req.body?.status || 'draft').toLowerCase();
    
    if (!allowedStatuses.includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const oldStatus = serverState.status;
    serverState.status = newStatus;
    serverState.lastUpdated = new Date().toISOString();
    persistState();
    broadcast({ type: 'status', status: newStatus, oldStatus });
    
    // Log activity (skip in test mode) - same pattern as existing code
    if (!testMode) {
      try {
        const userId = req.body?.userId || 'user1';
        const docContext = getDocumentContext(req.sessionId);
        logActivity(req.sessionId, 'document:status-change', userId, { 
          from: oldStatus, 
          to: newStatus,
          documentTitle: docContext.title,
          version: docContext.version,
          platform: req.body?.platform || 'web'
        });
      } catch (err) {
        console.error('Error logging status change activity:', err);
      }
    }
    
    res.json({ ok: true, status: newStatus });
  } catch (e) {
    res.status(500).json({ error: 'status_set_failed' });
  }
});
```

3. **Keep existing cycle endpoint for backward compatibility (optional)**

### Client-Side Changes

#### File: `shared-ui/components.react.js`

**Component: StatusBadge (lines 4450-4468)**

**Current Implementation (Actual Code from line 4450):**
```javascript
function StatusBadge() {
  const { config, addLog } = React.useContext(StateContext);
  const API_BASE = getApiBase();
  const [status, setStatus] = React.useState((config?.status || 'draft').toLowerCase());
  React.useEffect(() => {
    console.log('🔄 [StatusBadge] useEffect triggered - New status from config:', config?.status);
    setStatus((config?.status || 'draft').toLowerCase());
  }, [config?.status]);
  const cycle = async () => {
    try { const r = await fetch(`${API_BASE}/api/v1/status/cycle`, { method: 'POST' }); if (r.ok) { const j = await r.json(); setStatus((j.status || 'draft').toLowerCase()); addLog && addLog(`Status: ${j.status}`, 'system'); } } catch {}
  };
  const label = (s => s === 'final' ? 'Final' : s === 'review' ? 'Review' : 'Draft')(status);
  const cls = (function(s){
    if (s === 'final') return 'ui-badge gray-verydark';
    if (s === 'review') return 'ui-badge gray-dark';
    return 'ui-badge gray-medium';
  })(status);
  return React.createElement('div', { className: 'mb-2' }, React.createElement('span', { className: cls, onClick: cycle, style: { cursor: 'pointer' } }, label));
}
```

**Proposed Updates:**

1. **Update label function for 6 statuses:**
```javascript
const label = (s) => {
  switch(s) {
    case 'signed': return 'Signed';
    case 'out for signature': return 'Out for Signature';
    case 'internal final review': return 'Internal Final Review';
    case 'vendor review': return 'Vendor Review';
    case 'internal review': return 'Internal Review';
    case 'draft': 
    default: return 'Draft';
  }
};
```

2. **Update styling classes (descending shades of grey):**
```javascript
const cls = (s) => {
  // Existing classes: gray-medium, gray-dark, gray-verydark
  switch(s) {
    case 'signed': return 'ui-badge gray-verydark';           // Darkest
    case 'out for signature': return 'ui-badge gray-verydark';
    case 'internal final review': return 'ui-badge gray-dark';
    case 'vendor review': return 'ui-badge gray-dark';
    case 'internal review': return 'ui-badge gray-medium';
    case 'draft':
    default: return 'ui-badge gray-medium';                   // Lightest
  }
};
```

3. **Replace cycle with direct status selection (dropdown or modal):**
```javascript
// Option 1: Dropdown (simpler)
const allStatuses = ['draft', 'internal review', 'vendor review', 'internal final review', 'out for signature', 'signed'];
const handleStatusChange = async (e) => {
  const newStatus = e.target.value;
  try {
    const r = await fetch(`${API_BASE}/api/v1/status/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    if (r.ok) {
      const j = await r.json();
      setStatus(j.status);
      addLog && addLog(`Status: ${j.status}`, 'system');
    }
  } catch {}
};

return React.createElement('div', { className: 'mb-2' }, 
  React.createElement('select', { 
    value: status,
    onChange: handleStatusChange,
    className: cls(status) + ' cursor-pointer',
    style: { cursor: 'pointer' }
  }, 
    allStatuses.map(s => React.createElement('option', { key: s, value: s }, label(s)))
  )
);
```

**Component: FinalizeCelebration (lines 2157-2223)**

**Current Trigger (line 2165):**
```javascript
if (data.status === 'final') {
  console.log('🎉 Finalize: Triggering confetti celebration!');
  // ... confetti code
}
```

**Proposed Update:**
```javascript
if (data.status === 'signed') {
  console.log('🎉 Document Signed: Triggering celebration!');
  // ... confetti code
}
```

**Confetti Library Evaluation:**

Current implementation loads:
```javascript
// Line 293-296
const confettiScript = document.createElement('script');
confettiScript.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
confettiScript.onload = () => {};
document.head.appendChild(confettiScript);
```

**Performance Issues:**
- Large bundle size from CDN
- Animation appears slow/glitchy
- Heavy particle rendering

**Alternative Options:**

1. **Reduce particle count in current library:**
```javascript
window.confetti({
  particleCount: 30,  // Reduced from 50-200
  spread: 60,         // Reduced spread
  startVelocity: 20,  // Slower
  ticks: 100          // Shorter duration
});
```

2. **Switch to lighter library (react-confetti-explosion):**
```bash
npm install react-confetti-explosion
```

3. **Custom lightweight CSS animation:**
```javascript
// Create confetti div elements with pure CSS animations
function createConfetti() {
  const confetti = document.createElement('div');
  confetti.className = 'confetti-piece';
  confetti.style.left = Math.random() * 100 + '%';
  confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
  confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  return confetti;
}
```

**Recommended Approach:** 
- **Phase 1:** Reduce particle parameters in existing canvas-confetti
- **Phase 2:** If still slow, implement custom CSS-based confetti for better performance

---

## Test Updates Required

### File: `server/tests/app.test.js`

**Phase 11: Status & Title Management (lines 894-958)**

**Current Test:**
```javascript
test('POST /api/v1/status/cycle toggles draft/final', async () => {
  await resetState();
  const res = await request('POST', '/api/v1/status/cycle', {
    userId: 'user1'
  });
  expect(res.status).toBe(200);
  expect(res.body.status).toBeDefined();
});
```

**Tests to Add/Update:**

1. **Test all 6 status transitions:**
```javascript
test('POST /api/v1/status/set allows setting any of 6 statuses', async () => {
  await resetState();
  
  const allStatuses = ['draft', 'internal review', 'vendor review', 'internal final review', 'out for signature', 'signed'];
  
  for (const testStatus of allStatuses) {
    const res = await request('POST', '/api/v1/status/set', { 
      userId: 'user1',
      status: testStatus
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(testStatus);
  }
});
```

2. **Test direct status jumping (any direction):**
```javascript
test('POST /api/v1/status/set allows jumping to any status', async () => {
  await resetState();
  
  // Start at draft, jump to signing
  let res = await request('POST', '/api/v1/status/set', {
    userId: 'user1',
    status: 'signing'
  });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('signing');
  
  // Jump backward to internal review
  res = await request('POST', '/api/v1/status/set', {
    userId: 'user1',
    status: 'internal review'
  });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('internal review');
});
```

3. **Test confetti triggers only on 'signed':**
```javascript
test('confetti celebration triggers only on signed status', async () => {
  await resetState();
  
  // Set to 'signing' - should NOT trigger confetti
  let res = await request('POST', '/api/v1/status/set', {
    userId: 'user1',
    status: 'signing'
  });
  expect(res.status).toBe(200);
  
  // Set to 'signed' - should trigger confetti
  res = await request('POST', '/api/v1/status/set', {
    userId: 'user1',
    status: 'signed'
  });
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('signed');
  
  // Note: Confetti is client-side only, so server test just verifies status
  // Client-side test would verify confetti animation triggers
});
```

4. **Test invalid status rejected:**
```javascript
test('POST /api/v1/status/set rejects invalid status', async () => {
  await resetState();
  
  const res = await request('POST', '/api/v1/status/set', {
    userId: 'user1',
    status: 'invalid status'
  });
  expect(res.status).toBe(400);
  expect(res.body.error).toBeDefined();
});
```

---

## State Matrix Integration

### Permission Rules 

Editors can change the permissions and no one else can 

---

## UI/UX Considerations

### Status Badge Visual Design

**Color Progression:**
```
Descending shades of dark grey
```

### User Feedback

**On Status Change:**
- Toast notification: "Status changed to [new status]"
- Activity log entry: "User [name] changed status from [old] to [new]"
- SSE broadcast to all connected clients
- Update UI buttons based on new status permissions

**On Reaching 'Signed':**
- Confetti celebration animation (optimized)
- Success toast: "🎉 Document signed!"
- Disable editing permanently
- Show "Export Final PDF" button

### Accessibility

- **Keyboard Navigation:** Arrow keys to cycle statuses
- **Screen Reader:** Announce status changes clearly
- **Color Blindness:** Use icons + text labels, not just color
- **Motion Sensitivity:** Allow disabling confetti animation in settings

---

## Migration Strategy

### Data Migration

**Existing Documents:**
- Documents with `status: 'final'` → Map to `'out for signature'`
- Documents with `status: 'review'` → Map to `'internal review'`
- Documents with `status: 'draft'` → Keep as `'draft'`

**Migration Script:**
```javascript
function migrateStatus(oldStatus) {
  const mapping = {
    'draft': 'draft',
    'review': 'internal review',
    'final': 'out for signature'  // Changed from 'signed' to 'out for signature'
  };
  return mapping[oldStatus] || 'draft';
}
```

### Backward Compatibility

- Keep existing `/api/v1/status/cycle` endpoint (optional)
- New `/api/v1/status/set` endpoint for direct status selection

---

## Success Criteria

1. ✅ Status workflow includes all 6 statuses: draft, internal review, vendor review, internal final review, out for signature, signed
2. ✅ Users can select any status directly (dropdown or modal)
3. ✅ Confetti animation triggers **only** on 'signed' status
4. ✅ Confetti animation performs smoothly without lag/glitches
5. ✅ All status-related tests updated and passing
6. ✅ Activity log records status changes accurately
7. ✅ SSE broadcasts status updates to all clients
8. ✅ UI uses descending shades of grey for status badge styling
9. ✅ Only editors can change status (permission enforcement)

---

## Open Questions

1. **Should moving from 'signed' back to earlier statuses require confirmation?**
   - Moving from signed back to draft seems destructive
   
2. **Confetti animation approach:**
   - Try reducing particle count in existing canvas-confetti first?
   - Or switch to new library/custom CSS immediately?

---

## Implementation Priority

**Phase 1: Core Status Updates**
1. Server: Update status array to 6 statuses: draft, internal review, vendor review, internal final review, out for signature, signed
2. Server: Add `/api/v1/status/set` endpoint for direct status selection
3. Client: Update StatusBadge labels for 6 statuses
4. Client: Update styling to descending shades of grey
5. Update tests for 6 statuses and direct status selection

**Phase 2: UI - Direct Selection**
6. Replace cycle behavior with dropdown or modal selection
7. Hook up `/api/v1/status/set` endpoint call

**Phase 3: Celebration Update**
8. Change confetti trigger from 'final' to 'signed'
9. Optimize confetti performance (reduce particle count)
10. If still slow, switch to custom CSS or new library

**Phase 4: Cleanup**
11. Add migration script for existing documents
12. Test editor-only permission enforcement
13. Update all related documentation

---

## Related Documentation

- `architecture/state-machine.md` - Status-based permissions
- `features/approvals.md` - Approval workflow integration
- `features/automated-testing-suite.md` - Test coverage
- `architecture/user-workflows.md` - Status workflow examples

---

**Note:** This document describes the planned changes but implementation is pending. Once implementation begins, update this document with actual code snippets and mark status as 🔄 In Progress, then ✅ Implemented when complete.

