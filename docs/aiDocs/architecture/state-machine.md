# State Machine & Document Workflow
**Last Updated:** October 17, 2025  
**Status:** ✅ Production - Fully Implemented

---

## Overview

The state machine controls all document access, editing permissions, and UI behavior across **web viewer** and **Word add-in**. It's computed server-side and broadcast to all clients via SSE for instant cross-platform synchronization.

**Key Principle:** Server is source of truth. Clients render based on server state.

---

## Core State Variables

### `serverState` Object
```javascript
{
  checkedOutBy: string | null,       // User ID who owns document
  documentVersion: number,            // Increments on each save
  title: string,                      // Document title
  status: 'draft' | 'review' | 'final', // Workflow status
  lastUpdated: string,                // ISO timestamp
  updatedBy: { userId, label },       // Who made last change
  updatedPlatform: 'web' | 'word',    // Where change came from
  revision: number                    // State matrix version
}
```

**Storage:** `data/app/state.json` (persisted on disk)

---

## State Machine Rules

### Rule 1: Checkout Ownership
```javascript
const isCheckedOut = !!serverState.checkedOutBy;
const isOwner = serverState.checkedOutBy === userId;
const canWrite = !isCheckedOut || isOwner;
```

**Behavior:**
- **No checkout** → Anyone with `checkout` permission can check out
- **Checked out by you** → You can edit, save, check in, cancel
- **Checked out by someone else** → Read-only (or suggesting mode if available)

---

### Rule 2: Role-Based Permissions

**Roles** (from `data/app/users/users.json`):
```javascript
{
  "viewer": {
    checkout: false,
    checkin: false,
    override: false,
    sendVendor: false
  },
  "suggester": {
    checkout: true,
    checkin: true,
    override: false,
    sendVendor: false
  },
  "vendor": {
    checkout: true,
    checkin: true,
    override: false,
    sendVendor: false
  },
  "editor": {
    checkout: true,
    checkin: true,
    override: true,
    sendVendor: true
  }
}
```

**Permission Mapping:**
```javascript
// From server/src/server.js:1349-1356
buttons: {
  checkoutBtn: rolePerm.checkout && !isCheckedOut,
  checkinBtn: rolePerm.checkin && isOwner,
  cancelBtn: rolePerm.checkin && isOwner,
  saveProgressBtn: rolePerm.checkin && isOwner,
  overrideBtn: rolePerm.override && isCheckedOut && !isOwner,
  sendVendorBtn: rolePerm.sendVendor
}
```

---

### Rule 3: Primary Layout Modes

```javascript
primaryLayout: {
  mode: !isCheckedOut ? 'not_checked_out' 
      : isOwner ? 'self' 
      : 'other'
}
```

**UI Rendering:**

**Mode: `not_checked_out`**
- Show: **[Checkout]** button, three-dots menu
- Banner: "Available for editing" (green)

**Mode: `self`**
- Show: **[Save]**, **[Check-in]** (with dropdown: Check-in & Save, Cancel), three-dots
- Banner: "Checked out by you" (blue)

**Mode: `other`**
- Show: Only three-dots menu
- Banner: "Checked out by [Name]" (gray)
- Optional: **[Override]** button (editor only)

---

### Rule 4: Document Status Lifecycle

```javascript
Status Flow: draft → review → final
```

**Behavior:**
```javascript
// Cycling (POST /api/v1/status/cycle)
if (status === 'draft') → 'review'
if (status === 'review') → 'final'
if (status === 'final') → 'draft'
```

**Impact on Checkout:**
```javascript
// From checkout endpoint
if (serverState.status === 'final') {
  return res.status(409).json({ 
    error: 'Document is finalized. Unfinalize first.' 
  });
}
```

**Banner Colors:**
```javascript
'draft': { bg: '#16a34a', fg: '#ffffff' },    // Green
'review': { bg: '#FFB636', fg: '#111827' },    // Orange
'final': { bg: '#7f8ca0', fg: '#ffffff' }      // Gray
```

---

## State Matrix API

### Endpoint: `GET /api/v1/state-matrix`

**Query Parameters:**
```javascript
{
  platform: 'web' | 'word',  // Default: 'web'
  userId: string,             // Default: 'user1'
  clientVersion: number       // For update detection (optional)
}
```

**Response:**
```javascript
{
  config: {
    // Document metadata
    documentId: string,
    documentVersion: number,
    title: string,
    status: 'draft' | 'review' | 'final',
    lastUpdated: string,
    updatedBy: { userId, label },
    
    // Permission-based buttons
    buttons: {
      replaceDefaultBtn: boolean,
      checkoutBtn: boolean,
      checkinBtn: boolean,
      cancelBtn: boolean,
      saveProgressBtn: boolean,
      overrideBtn: boolean,
      sendVendorBtn: boolean,
      openGovBtn: boolean,
      primaryLayout: { mode: 'not_checked_out' | 'self' | 'other' }
    },
    
    // UI state
    banner: {
      state: 'available' | 'checked_out_self' | 'checked_out_other' | 'final',
      title: string,
      message: string
    },
    
    banners: [{
      state: string,
      title: string,
      message: string
    }],
    
    checkoutStatus: {
      isCheckedOut: boolean,
      checkedOutUserId: string | null
    },
    
    viewerMessage: {
      type: 'success' | 'info' | 'warning',
      text: string
    },
    
    approvals: {
      enabled: boolean,
      summary: { approved: number, total: number }
    }
  },
  revision: number  // State version for change detection
}
```

---

## Update Detection (Smart Banners)

The state matrix includes logic to show "Update Available" banner when:

```javascript
// From server/src/server.js:1370-1387
const clientKnown = clientVersion > 0;
const serverAdvanced = documentVersion > clientVersion;
const updatedByAnother = lastUpdatedUserId !== requestingUserId;
const differentPlatform = updatedPlatform !== requestingPlatform;

if (clientKnown && serverAdvanced && (updatedByAnother || differentPlatform)) {
  banners.unshift({
    state: 'update_available',
    title: 'Update available',
    message: `${updatedBy} updated this document.`
  });
}
```

**Example Scenario:**
1. User A (web) has document at version 3
2. User B (Word) saves → version becomes 4
3. User A requests state matrix with `clientVersion=3`
4. Server returns banner: "User B updated this document."

---

## State Transitions

### Checkout Flow
```
State: available
User clicks: [Checkout]
→ POST /api/v1/checkout { userId }
→ serverState.checkedOutBy = userId
→ SSE broadcast: { type: 'checkout', userId }
→ All clients refresh state matrix
→ Buttons update to [Save], [Check-in]
```

### Check-in Flow
```
State: checked_out_self
User clicks: [Check-in]
→ POST /api/v1/checkin { userId }
→ serverState.checkedOutBy = null
→ serverState.documentVersion++
→ SSE broadcast: { type: 'checkin', userId }
→ All clients refresh state matrix
→ Buttons update to [Checkout]
```

### Save Progress Flow
```
State: checked_out_self
User edits document
→ POST /api/v1/save-progress { userId, base64 }
→ Validate ownership (must be checked out by you)
→ Save DOCX to data/working/documents/default.docx
→ serverState.documentVersion++
→ serverState.updatedBy = { userId, label }
→ serverState.updatedPlatform = platform
→ SSE broadcast: { type: 'save-progress', documentVersion }
→ Other clients see "Update Available" banner
```

### Override Flow (Editor Only)
```
State: checked_out_other
Editor clicks: [Override]
→ POST /api/v1/checkout/override { userId }
→ serverState.checkedOutBy = null  // Release lock
→ SSE broadcast: { type: 'checkout:override', by: editorId }
→ Original owner loses checkout
→ Document returns to "available" state
```

---

## SSE Event Types

All state changes trigger SSE broadcasts:

```javascript
// Checkout events
{ type: 'checkout', userId }
{ type: 'checkin', userId }
{ type: 'checkout:cancel', userId }
{ type: 'checkout:override', by: userId }

// Document events
{ type: 'save-progress', documentVersion, userId }
{ type: 'title', title, userId }
{ type: 'status', status, userId }
{ type: 'documentUpload', filename, userId }
{ type: 'documentRevert', userId }

// Approval events
{ type: 'approvals:update', summary }
{ type: 'approvals:reset', userId }
{ type: 'approvals:notify', userId }

// Variable events
{ type: 'variable:created', variable }
{ type: 'variable:updated', variable }
{ type: 'variable:valueChanged', variable }
{ type: 'variable:deleted', varId }

// System events
{ type: 'factoryReset', userId }
{ type: 'revision', revision }
```

**Client Handling:**
```javascript
// All events trigger state matrix refresh
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  // Update local state
  // Refresh state matrix
  // Update UI
};
```

---

## Document Version Management

### Version Tracking
```javascript
serverState.documentVersion  // Server's current version
clientVersion                // Client's last known version
```

**Version Increments When:**
- ✅ Save progress (`/api/v1/save-progress`)
- ✅ Check-in (`/api/v1/checkin`)
- ✅ Document upload (`/api/v1/document/upload`)
- ✅ Revert to version (`/api/v1/versions/view`)
- ✅ Snapshot restore (`/api/v1/document/snapshot`)

**Version Used For:**
1. **Conflict Detection:** Reject saves if `clientVersion < serverState.documentVersion`
2. **Update Notifications:** Show banner when `serverAdvanced`
3. **Change Tracking:** Activity log references version numbers

---

## Permission Matrix

| Action | Viewer | Suggester | Vendor | Editor |
|--------|--------|-----------|--------|--------|
| **View document** | ✅ | ✅ | ✅ | ✅ |
| **Checkout** | ❌ | ✅ | ✅ | ✅ |
| **Save/Check-in** | ❌ | ✅ (if owner) | ✅ (if owner) | ✅ (if owner) |
| **Override checkout** | ❌ | ❌ | ❌ | ✅ |
| **Send to vendor** | ❌ | ❌ | ❌ | ✅ |
| **Status cycle** | ❌ | ❌ | ❌ | ✅ |
| **Factory reset** | ❌ | ❌ | ❌ | ✅ |
| **Create variables** | ❌ | ❌ | ❌ | ✅ |
| **Edit approvals (override)** | ❌ | ❌ | ❌ | ✅ |

**Special Cases:**
- **Suggesters** can checkout/save, but Word shows "suggesting" mode (track changes)
- **Vendors** same as suggesters (external collaborators)
- **Viewers** can still approve for themselves (self-approval only)

---

## Example State Flows

### Scenario 1: Normal Edit Flow
```
1. User A (editor, web): GET /api/v1/state-matrix
   → buttons: { checkoutBtn: true }
   
2. User A: POST /api/v1/checkout { userId: 'userA' }
   → serverState.checkedOutBy = 'userA'
   → SSE broadcast → All clients update
   
3. User B (editor, Word): GET /api/v1/state-matrix
   → buttons: { overrideBtn: true }  // Can override
   → banner: "Checked out by User A"
   
4. User A: Makes edits, clicks Save
   → POST /api/v1/save-progress { userId: 'userA', base64 }
   → serverState.documentVersion++
   → SSE broadcast
   
5. User B sees: Banner "User A updated this document"
   
6. User A: POST /api/v1/checkin { userId: 'userA' }
   → serverState.checkedOutBy = null
   → SSE broadcast
   
7. Both users: buttons: { checkoutBtn: true }
```

### Scenario 2: Conflict Resolution
```
1. User A: Checks out document
2. User A: Goes to lunch (forgets to check in)
3. User B (editor): Sees "Checked out by User A"
4. User B: Clicks [Override]
   → POST /api/v1/checkout/override
   → serverState.checkedOutBy = null
   → Activity log: "User B overrode checkout from User A"
5. User A returns: Checkout lost, sees "Available"
```

### Scenario 3: Status Workflow
```
1. Document starts as: status = 'draft'
2. Editor clicks: "Cycle Status"
   → POST /api/v1/status/cycle
   → serverState.status = 'review'
   → Banner changes to orange
3. Another cycle:
   → serverState.status = 'final'
   → Banner becomes gray
   → Checkout disabled (409 error)
4. To edit: Must cycle back to 'draft'
```

---

## Testing

**Test Coverage:** 39 tests across phases

**Phase 2: State Management (6 tests)**
- Checkout flow works for draft document
- Ownership enforced (can't checkout when someone else owns)
- Save requires checkout
- User switching updates state
- State persists across factory reset
- Factory reset clears checkout

**Phase 5: Cross-Platform Sync (5 tests)**
- State matrix returns consistent data
- Checkout/checkin updates state immediately
- User switch triggers config recalculation
- State persists across requests

**Phase 11: Status Management (4 tests)**
- Status cycle toggles draft/final
- Title updates persist
- Status affects checkout permissions
- Title persists across state matrix requests

**Phase 12: Checkout Operations (4 tests)**
- Cancel own checkout
- Override checkout (admin)
- Cannot cancel if not owner
- Checkout/cancel maintains consistency

---

## Key Files

**Server:**
- `server/src/server.js` - State matrix computation (line 1321-1399)
- `data/app/state.json` - Persisted state
- `data/app/users/roles.json` - Role permission definitions

**Client:**
- `shared-ui/components.react.js` - State consumption & UI rendering
- `web/view.html` - SSE listener & state refresh
- `addin/src/taskpane/taskpane.html` - Word add-in state sync

---

## Future Enhancements

- **Session timeouts:** Auto-release checkout after inactivity
- **Offline mode:** Queue changes when disconnected
- **Conflict resolution UI:** Merge changes from multiple users
- **Advanced permissions:** Section-level locking
- **Audit history:** Full change log with rollback

---

**Related Documentation:**
- `features/checkin-checkout.md` - Detailed checkout flow
- `features/approvals.md` - Approval workflow
- `features/automated-testing-suite.md` - Test specifications

