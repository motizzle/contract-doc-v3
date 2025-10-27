# Feature: Version Sharing (Vendor Access Control)

**Status:** 📋 Planned  
**Priority:** High  
**Last Updated:** October 27, 2025  
**Platforms:** Web, Word Add-in  
**Related:** `features/versions.md`, `architecture/state-machine.md`

---

## Overview

Provide granular control over which document versions are visible to vendor users. Editors can selectively share specific versions with vendors while keeping internal drafts private.

**Key Principle:** Vendors should only see versions explicitly shared with them.

---

## Problem Statement

### Current Behavior
- All users see all document versions in the Versions tab
- No distinction between internal drafts and vendor-ready versions
- Vendors can view all work-in-progress versions
- No way to control vendor visibility

### User Impact
- **Editors:** Cannot keep internal drafts private
- **Vendors (Hugh):** See too much information, potentially confusing
- **Workflow:** No way to distinguish "ready for vendor" vs "internal only"

---

## Requirements

### 1. Vendor View Restrictions
- **Requirement:** Vendors can ONLY view versions marked as "for vendor"
- **Behavior:** 
  - Versions panel filters to show only shared versions
  - API endpoints reject requests for non-shared versions
  - Version dropdown only shows accessible versions
- **Applies to:** `vendor` role (Hugh in prototype)

### 2. Editor Sharing Control
- **Requirement:** Editors can toggle which versions are shared with vendors
- **Behavior:**
  - Each version has a "Share with Vendor" toggle in Versions panel
  - Toggle is visible only to editors
  - Changes apply immediately across all clients
- **Permissions:** Editor role only

### 3. Dynamic Version Updates
- **Requirement:** Versions panel updates automatically when new versions are saved
- **Behavior:**
  - New versions appear immediately in all connected clients
  - New versions default to "not shared"
  - SSE broadcasts version creation events
- **Platforms:** Web and Word add-in

### 4. Default Sharing State
- **Requirement:** All new versions default to "not shared with vendor"
- **Behavior:**
  - New versions created via Save or Check-in are private by default
  - Editors must explicitly share versions
  - Prevents accidental exposure of drafts

### 5. Version 1 (Demo Document)
- **Requirement:** Version 1 is always shared and cannot be unshared
- **Behavior:**
  - Version 1 represents the canonical demo document
  - Always initialized with `sharedWithVendor: true`
  - Share/Unshare button is hidden for Version 1
  - Displays "DEMO" badge and "Always shared with vendors (demo document)" message
  - Attempting to share/unshare Version 1 returns 400 error
- **Rationale:** Ensures vendors always have access to baseline document

---

## User Roles & Permissions

### Editor Permissions
```javascript
{
  viewAllVersions: true,      // See all versions (shared and private)
  shareVersions: true,         // Toggle sharing state
  viewSharedState: true        // See "Shared with Vendor" indicator
}
```

### Vendor Permissions (Hugh)
```javascript
{
  viewAllVersions: false,      // Only see shared versions
  shareVersions: false,        // Cannot change sharing
  viewSharedState: false       // Does not see sharing toggle
}
```

### Other Roles (Viewer, Suggester)
```javascript
{
  viewAllVersions: true,       // Internal users see all versions
  shareVersions: false,        // Only editors can share
  viewSharedState: true        // Can see which are shared (read-only)
}
```

---

## Data Model

### Version Metadata Structure

**Before:**
```json
{
  "version": 5,
  "timestamp": 1640995200000,
  "userId": "user1",
  "label": "Quarterly Review",
  "filename": "v5_1640995200000.docx"
}
```

**After:**
```json
{
  "version": 5,
  "timestamp": 1640995200000,
  "userId": "user1",
  "label": "Quarterly Review",
  "filename": "v5_1640995200000.docx",
  "sharedWithVendor": false,        // NEW: sharing state
  "sharedBy": null,                  // NEW: who shared it (userId)
  "sharedAt": null                   // NEW: when it was shared (timestamp)
}
```

**Version 1 (Demo Document):**
```json
{
  "version": 1,
  "savedBy": { "userId": "system", "label": "System" },
  "savedAt": "2025-10-27T12:00:00.000Z",
  "sharedWithVendor": true,         // Always true for Version 1
  "sharedBy": { "userId": "system", "label": "System" },
  "sharedAt": "2025-10-27T12:00:00.000Z",
  "note": "Demo Document"           // Special marker for Version 1
}
```

### Storage Location
- **File:** `data/app/versions/versions.json` (or per-session: `data/working/sessions/{sessionId}/versions/versions.json`)
- **Format:** Array of version objects with sharing metadata
- **Persistence:** Saved on every version create/update

### Migration Strategy
- Add `sharedWithVendor`, `sharedBy`, `sharedAt` fields to existing versions
- Default all existing versions to `sharedWithVendor: false`
- Run migration on server startup if fields are missing

---

## API Design

### New Endpoint: Update Version Sharing

```javascript
POST /api/v1/versions/:versionNumber/share

Headers:
  Content-Type: application/json
  Authorization: Bearer <jwt-token>

Body:
{
  "userId": "user1",           // Editor making the change
  "shared": true               // true = share, false = unshare
}

Response (200):
{
  "ok": true,
  "version": {
    "version": 5,
    "sharedWithVendor": true,
    "sharedBy": "user1",
    "sharedAt": 1640995300000
  }
}

Response (400 - Attempting to modify Version 1):
{
  "ok": false,
  "error": "cannot_modify_demo",
  "message": "Version 1 is the demo document and is always shared with vendors. It cannot be unshared."
}

Response (403 - Non-editor):
{
  "ok": false,
  "error": "permission_denied",
  "message": "Only editors can share versions"
}

Response (404 - Version not found):
{
  "ok": false,
  "error": "version_not_found",
  "message": "Version 5 does not exist"
}
```

### Modified Endpoint: Get Versions

```javascript
GET /api/v1/versions

Query Parameters:
  userId: string     // Current user ID (required for filtering)
  platform: string   // 'web' or 'word' (optional)

Response (200 - Editor):
{
  "versions": [
    { "version": 7, "sharedWithVendor": false, ... },
    { "version": 6, "sharedWithVendor": true, ... },
    { "version": 5, "sharedWithVendor": false, ... }
  ],
  "canShare": true   // Editor permission
}

Response (200 - Vendor):
{
  "versions": [
    { "version": 6, "sharedWithVendor": true, ... }
    // Only versions where sharedWithVendor === true
  ],
  "canShare": false  // No sharing permission
}

Response (200 - Other roles):
{
  "versions": [
    { "version": 7, "sharedWithVendor": false, ... },
    { "version": 6, "sharedWithVendor": true, ... },
    { "version": 5, "sharedWithVendor": false, ... }
  ],
  "canShare": false  // Can see all, but can't share
}
```

### Modified Endpoint: Get Specific Version

```javascript
GET /api/v1/versions/:versionNumber

Query Parameters:
  userId: string     // Current user ID (required for access check)

Response (200 - Allowed):
{
  "version": 5,
  "timestamp": 1640995200000,
  "sharedWithVendor": false,
  ...
}

Response (403 - Vendor accessing non-shared version):
{
  "ok": false,
  "error": "access_denied",
  "message": "This version is not available to you"
}
```

### Modified Endpoint: View Version (Load in Editor)

```javascript
POST /api/v1/versions/view

Body:
{
  "userId": "user3",       // Vendor user ID
  "version": 5             // Requesting version 5
}

Response (403 - If vendor and version not shared):
{
  "ok": false,
  "error": "access_denied",
  "message": "Version 5 is not shared with vendors"
}
```

---

## Server-Side Logic

### Permission Checking Function

```javascript
function canAccessVersion(userId, versionNumber, versionData) {
  // Get user role
  const user = getUserById(userId);
  const role = user?.role || 'viewer';
  
  // Editors and internal users can access all versions
  if (role === 'editor' || role === 'suggester' || role === 'viewer') {
    return true;
  }
  
  // Vendors can only access shared versions
  if (role === 'vendor') {
    const version = versionData.find(v => v.version === versionNumber);
    return version && version.sharedWithVendor === true;
  }
  
  return false;
}
```

### Version Filtering Function

```javascript
function filterVersionsForUser(userId, allVersions) {
  const user = getUserById(userId);
  const role = user?.role || 'viewer';
  
  // Internal users see all versions
  if (role !== 'vendor') {
    return allVersions;
  }
  
  // Vendors only see shared versions
  return allVersions.filter(v => v.sharedWithVendor === true);
}
```

### Version Creation Hook

```javascript
// When a new version is created (Save or Check-in)
function createNewVersion(userId, documentData) {
  const versionNumber = getNextVersionNumber();
  const timestamp = Date.now();
  
  const newVersion = {
    version: versionNumber,
    timestamp,
    userId,
    filename: `v${versionNumber}_${timestamp}.docx`,
    sharedWithVendor: false,      // DEFAULT: not shared
    sharedBy: null,
    sharedAt: null
  };
  
  // Save version file
  saveVersionFile(newVersion, documentData);
  
  // Update versions metadata
  updateVersionsMetadata(newVersion);
  
  // Broadcast to all clients
  broadcast({
    type: 'version:created',
    version: newVersion,
    sessionId: req.sessionId
  });
  
  return newVersion;
}
```

---

## SSE Events

### New Event: Version Sharing Changed

```javascript
{
  type: 'version:shared',
  sessionId: 'sess_abc123',
  version: 5,
  sharedWithVendor: true,
  sharedBy: 'user1',
  sharedAt: 1640995300000,
  timestamp: Date.now()
}
```

### Modified Event: Version Created

```javascript
{
  type: 'version:created',
  sessionId: 'sess_abc123',
  version: {
    version: 7,
    timestamp: 1640995400000,
    userId: 'user1',
    filename: 'v7_1640995400000.docx',
    sharedWithVendor: false,    // Include sharing state
    sharedBy: null,
    sharedAt: null
  },
  timestamp: Date.now()
}
```

---

## UI/UX Design

### Versions Panel (Editors)

```
┌─────────────────────────────────────────┐
│ Versions                         [Close] │
├─────────────────────────────────────────┤
│                                          │
│  ○ Version 7 (Current)                   │
│     Oct 27, 2025 2:30 PM                 │
│     Not shared    [Share] [View]         │
│     (white background, thin gray border) │
│                                          │
┃  ○ Version 6                             ┃ ← Thicker green border
┃     Oct 27, 2025 1:15 PM                 ┃    Light green background
┃     ✓ Shared      [Unshare] [View]       ┃
┃     Shared by Warren Peace               ┃
│                                          │
│  ○ Version 5                             │
│     Oct 27, 2025 10:45 AM                │
│     Not shared    [Share] [View]         │
│     (white background, thin gray border) │
│                                          │
┃  ○ Version 1 [DEMO]                      ┃ ← Thicker green border
┃     Oct 26, 2025 12:00 PM                ┃    Light green background
┃     ✓ Always shared with vendors         ┃
┃     (demo document)          [View]      ┃
│                                          │
└─────────────────────────────────────────┘
```

**Visual Styling:**
- **Shared versions:** 2px green border (`#059669`), light green background (`#F0FDF4`)
- **Not shared versions:** 1px gray border (`#E5E7EB`), white background
- **Currently viewing:** Blue border, light blue background (overridden if shared)

### Versions Panel (Vendors - Hugh)

```
┌─────────────────────────────────────────┐
│ Versions                         [Close] │
├─────────────────────────────────────────┤
│                                          │
┃  ○ Version 6                             ┃ ← Thicker green border
┃     Oct 27, 2025 1:15 PM                 ┃    Light green background
┃     [View]                               ┃
│                                          │
┃  ○ Version 1 [DEMO]                      ┃ ← Thicker green border
┃     Oct 26, 2025 12:00 PM                ┃    Light green background
┃     [View]                               ┃
│                                          │
│  No other versions available.            │
│                                          │
└─────────────────────────────────────────┘
```

**Note:** Vendors only see shared versions, which all have the distinctive green border and background.

### Versions Panel (Other Roles - Read-only)

```
┌─────────────────────────────────────────┐
│ Versions                         [Close] │
├─────────────────────────────────────────┤
│                                          │
│  ○ Version 7 (Current)                   │
│     Oct 27, 2025 2:30 PM                 │
│     Not shared with vendor  [View]       │
│                                          │
│  ○ Version 6                             │
│     Oct 27, 2025 1:15 PM                 │
│     ✓ Shared with vendor    [View]       │
│                                          │
│  ○ Version 5                             │
│     Oct 27, 2025 10:45 AM                │
│     Not shared with vendor  [View]       │
│                                          │
└─────────────────────────────────────────┘
```

### Share/Unshare Button Behavior

**Share Button:**
- **Label:** "Share with Vendor"
- **Action:** Immediately marks version as shared
- **Confirmation:** Brief toast: "Version 5 shared with vendor"
- **Visual Change:** Button changes to "Unshare" with checkmark indicator

**Unshare Button:**
- **Label:** "Unshare"
- **Action:** Confirmation modal: "Remove vendor access to Version 5?"
- **Confirmation:** "Yes, Unshare" / "Cancel"
- **Success:** Toast: "Version 5 no longer shared"

---

## Client-Side Implementation

### React Component Changes (shared-ui/components.react.js)

```javascript
// VersionsPanel component
function VersionsPanel({ config, onClose }) {
  const [versions, setVersions] = React.useState([]);
  const [canShare, setCanShare] = React.useState(false);
  
  // Load versions
  React.useEffect(() => {
    (async () => {
      const userId = window.__currentUserId;
      const res = await fetch(`${API_BASE}/api/v1/versions?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
        setCanShare(data.canShare);
      }
    })();
  }, []);
  
  // Listen for version sharing updates via SSE
  React.useEffect(() => {
    const handleVersionShared = (e) => {
      const { version: versionNum, sharedWithVendor, sharedBy, sharedAt } = e.detail;
      setVersions(prev => prev.map(v => 
        v.version === versionNum 
          ? { ...v, sharedWithVendor, sharedBy, sharedAt }
          : v
      ));
    };
    
    const handleVersionCreated = (e) => {
      const { version: newVersion } = e.detail;
      setVersions(prev => [newVersion, ...prev]);
    };
    
    window.addEventListener('version:shared', handleVersionShared);
    window.addEventListener('version:created', handleVersionCreated);
    
    return () => {
      window.removeEventListener('version:shared', handleVersionShared);
      window.removeEventListener('version:created', handleVersionCreated);
    };
  }, []);
  
  // Share/Unshare handler
  const handleToggleShare = async (versionNum, currentlyShared) => {
    if (currentlyShared) {
      // Confirm before unsharing
      if (!confirm(`Remove vendor access to Version ${versionNum}?`)) {
        return;
      }
    }
    
    const userId = window.__currentUserId;
    const res = await fetch(`${API_BASE}/api/v1/versions/${versionNum}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        shared: !currentlyShared 
      })
    });
    
    if (res.ok) {
      const action = currentlyShared ? 'no longer shared' : 'shared with vendor';
      showToast(`Version ${versionNum} ${action}`);
    }
  };
  
  // Render version list
  return React.createElement('div', { className: 'versions-panel' },
    versions.map(v => 
      React.createElement(VersionItem, {
        key: v.version,
        version: v,
        canShare,
        onToggleShare: handleToggleShare,
        onView: () => handleViewVersion(v.version)
      })
    )
  );
}
```

---

## User Workflows

### Workflow 1: Editor Shares Version with Vendor

```
1. Editor (Warren Peace) saves document → Version 7 created
2. Version 7 appears in Versions panel with "Not shared" indicator
3. Editor clicks [Share with Vendor] next to Version 7
4. Version 7 updates to show "✓ Shared" with "Shared by Warren Peace"
5. SSE broadcasts version:shared event
6. Vendor (Hugh) in another browser sees Version 7 appear immediately
7. Activity log shows: "Warren Peace shared Version 7 with vendor"
```

### Workflow 2: Vendor Attempts to View Non-Shared Version

```
1. Vendor (Hugh) opens Versions panel
2. Only sees Version 6 and Version 4 (both shared)
3. Versions 5 and 7 are not visible in the list
4. If vendor somehow requests Version 5 via API:
   → 403 response: "This version is not available to you"
   → UI shows error: "You don't have access to this version"
```

### Workflow 3: Editor Unshares Version

```
1. Editor clicks [Unshare] next to Version 6
2. Confirmation modal: "Remove vendor access to Version 6?"
3. Editor clicks "Yes, Unshare"
4. Version 6 updates to "Not shared" state
5. SSE broadcasts version:shared event with shared=false
6. Vendor (Hugh) sees Version 6 disappear from their list immediately
7. If vendor was viewing Version 6, banner appears: "This version is no longer available"
```

### Workflow 4: New Version Auto-Appears

```
1. Editor saves document → Version 8 created
2. Server creates version with sharedWithVendor: false (default)
3. SSE broadcasts version:created event
4. All connected clients (editors, vendors) receive event
5. Editors see Version 8 appear in list (not shared)
6. Vendors do NOT see Version 8 (not shared)
7. No page refresh required - fully real-time
```

---

## Edge Cases

### Case 1: Vendor Viewing Version That Gets Unshared

**Scenario:** Vendor is viewing Version 5 when editor unshares it

**Behavior:**
1. SSE broadcasts `version:shared` event with `shared: false`
2. Vendor's browser receives event
3. Banner appears: "This version is no longer available to you"
4. [View Latest] button offered to return to current version
5. Version 5 removed from vendor's version list

**Implementation:** Check if currently viewing version matches unshared version, show banner if match

### Case 2: Last Shared Version is Unshared

**Scenario:** Vendor has access to only Version 6, editor unshares it

**Behavior:**
1. Vendor's version list becomes empty
2. Message displayed: "No versions available. Check back later."
3. Vendor can still see current document (if not checked out by someone else)

**Implementation:** Handle empty versions array gracefully with helpful message

### Case 3: Version Shared While Vendor is Viewing List

**Scenario:** Vendor has Versions panel open, editor shares Version 7

**Behavior:**
1. SSE broadcasts `version:shared` event
2. Version 7 appears in vendor's list immediately (real-time)
3. Animation highlights new version (subtle fade-in)
4. No page refresh needed

**Implementation:** SSE listener updates React state, causes re-render

### Case 4: Editor Role Removed (User Becomes Vendor)

**Scenario:** User's role changes from editor to vendor mid-session

**Behavior:**
1. User refreshes state matrix (via SSE or manual refresh)
2. Versions panel filters to show only shared versions
3. Share/Unshare buttons disappear
4. All previously visible versions now filtered

**Implementation:** `canShare` flag recalculated based on current role, UI updates accordingly

### Case 5: Concurrent Sharing by Multiple Editors

**Scenario:** Two editors try to share/unshare same version simultaneously

**Behavior:**
1. Last write wins (standard server behavior)
2. Both editors receive SSE update with final state
3. UI reconciles to show correct state
4. Activity log shows both actions

**Implementation:** No locking needed, eventual consistency via SSE

### Case 6: Factory Reset

**Scenario:** Factory reset is performed

**Behavior:**
1. All versions reset to default (typically just Version 1)
2. Version 1 is initialized with `sharedWithVendor: true` (demo document)
3. All custom sharing states cleared
4. SSE broadcasts factory reset event

**Implementation:** Factory reset includes versions metadata reset, Version 1 metadata created with shared state

### Case 7: Attempt to Unshare Version 1

**Scenario:** Editor tries to unshare Version 1 (demo document)

**Behavior:**
1. API returns 400 error with message: "Version 1 is the demo document and is always shared with vendors. It cannot be unshared."
2. UI does not show Share/Unshare button for Version 1
3. Version 1 displays "DEMO" badge and special message
4. Vendors always have access to Version 1

**Implementation:** Server rejects any share/unshare requests for Version 1, UI hides share controls for Version 1

---

## Activity Logging

### Log Entry Format

```javascript
// When version is shared
{
  id: 'act_1640995500000_789',
  timestamp: 1640995500000,
  type: 'version:shared',
  user: { id: 'user1', label: 'Warren Peace', platform: 'web' },
  action: 'shared version with vendor',
  target: 'version',
  details: { 
    version: 5,
    sharedWithVendor: true
  },
  message: 'Warren Peace shared Version 5 with vendor'
}

// When version is unshared
{
  id: 'act_1640995600000_790',
  timestamp: 1640995600000,
  type: 'version:unshared',
  user: { id: 'user1', label: 'Warren Peace', platform: 'web' },
  action: 'removed vendor access',
  target: 'version',
  details: { 
    version: 5,
    sharedWithVendor: false
  },
  message: 'Warren Peace removed vendor access to Version 5'
}
```

---

## Testing Strategy

### Unit Tests (Jest)

```javascript
describe('Version Sharing', () => {
  describe('Permission Checks', () => {
    test('Editor can access all versions');
    test('Vendor can only access shared versions');
    test('Vendor denied access to non-shared version');
    test('Internal users (viewer, suggester) can access all versions');
  });
  
  describe('Sharing API', () => {
    test('POST /api/v1/versions/:n/share - editor can share');
    test('POST /api/v1/versions/:n/share - vendor cannot share (403)');
    test('POST /api/v1/versions/:n/share - updates metadata correctly');
    test('POST /api/v1/versions/:n/share - broadcasts SSE event');
  });
  
  describe('Version Filtering', () => {
    test('GET /api/v1/versions - editor sees all versions');
    test('GET /api/v1/versions - vendor sees only shared versions');
    test('GET /api/v1/versions - includes canShare flag based on role');
  });
  
  describe('Version Creation', () => {
    test('New version defaults to sharedWithVendor: false');
    test('New version broadcasts version:created event');
  });
  
  describe('Migration', () => {
    test('Existing versions without sharedWithVendor field are migrated');
    test('Migration sets sharedWithVendor to false by default');
  });
});
```

### E2E Tests (Playwright)

```javascript
describe('Version Sharing UI', () => {
  test('Editor sees Share button next to each version', async ({ page }) => {
    await page.goto('https://localhost:4001');
    await loginAsEditor(page);
    await page.click('[data-test="versions-tab"]');
    await expect(page.locator('[data-test="share-button"]')).toBeVisible();
  });
  
  test('Vendor sees only shared versions', async ({ page, context }) => {
    // Editor shares Version 5
    const editorPage = await context.newPage();
    await editorPage.goto('https://localhost:4001');
    await loginAsEditor(editorPage);
    await editorPage.click('[data-test="versions-tab"]');
    await editorPage.click('[data-test="share-button-5"]');
    
    // Vendor sees Version 5
    const vendorPage = await context.newPage();
    await vendorPage.goto('https://localhost:4001');
    await loginAsVendor(vendorPage);
    await vendorPage.click('[data-test="versions-tab"]');
    await expect(vendorPage.locator('[data-test="version-5"]')).toBeVisible();
  });
  
  test('Real-time update when version shared', async ({ page, context }) => {
    // Vendor opens versions panel (empty)
    await page.goto('https://localhost:4001');
    await loginAsVendor(page);
    await page.click('[data-test="versions-tab"]');
    await expect(page.locator('[data-test="version-5"]')).not.toBeVisible();
    
    // Editor shares Version 5 in another browser
    const editorPage = await context.newPage();
    await editorPage.goto('https://localhost:4001');
    await loginAsEditor(editorPage);
    await editorPage.click('[data-test="versions-tab"]');
    await editorPage.click('[data-test="share-button-5"]');
    
    // Vendor sees Version 5 appear (real-time)
    await expect(page.locator('[data-test="version-5"]')).toBeVisible({ timeout: 2000 });
  });
  
  test('Vendor denied access to non-shared version', async ({ page }) => {
    await page.goto('https://localhost:4001');
    await loginAsVendor(page);
    
    // Try to view Version 7 (not shared) via URL manipulation
    const response = await page.request.post('/api/v1/versions/view', {
      data: { userId: 'user3', version: 7 }
    });
    
    expect(response.status()).toBe(403);
  });
});
```

### Manual Testing Checklist

- [ ] Editor can share/unshare versions via Versions panel
- [ ] Vendor sees only shared versions in list
- [ ] Vendor cannot access non-shared versions (API returns 403)
- [ ] Real-time updates work (share/unshare reflects immediately)
- [ ] New versions default to "not shared"
- [ ] Share/Unshare buttons show correct state
- [ ] Activity log records sharing actions
- [ ] Factory reset clears sharing states
- [ ] Cross-platform parity (Web and Word add-in behave identically)
- [ ] Edge case: Vendor viewing version that gets unshared shows banner
- [ ] Edge case: Last shared version unshared shows empty state gracefully

---

## Migration & Rollout

### Phase 1: Backend Implementation (1-2 days)
1. Add `sharedWithVendor`, `sharedBy`, `sharedAt` fields to version model
2. Implement `POST /api/v1/versions/:n/share` endpoint
3. Update `GET /api/v1/versions` to filter for vendors
4. Add permission checking to version access endpoints
5. Implement SSE broadcasting for sharing events
6. Write unit tests for permission logic

### Phase 2: Frontend Implementation (1-2 days)
1. Update VersionsPanel component with sharing UI
2. Add Share/Unshare buttons for editors
3. Implement SSE listeners for real-time updates
4. Add filtering logic for vendor view
5. Add confirmation modal for unsharing
6. Add toast notifications for sharing actions
7. Test cross-platform (Web and Word add-in)

### Phase 3: Testing & Polish (1 day)
1. Run E2E tests
2. Manual testing with Hugh (vendor) role
3. Test real-time updates across browsers
4. Verify edge cases
5. Update documentation
6. Add activity logging

### Phase 4: Deployment
1. Run migration on existing data
2. Deploy backend changes
3. Deploy frontend changes
4. Verify in production
5. Monitor for issues

---

## Success Metrics

### Functionality
- ✅ Vendors can only access shared versions (100% enforcement)
- ✅ Editors can share/unshare any version
- ✅ Real-time updates work across all clients
- ✅ New versions default to not shared

### Performance
- ✅ Version list loads in <500ms
- ✅ Share/Unshare action completes in <200ms
- ✅ SSE updates propagate in <1 second

### User Experience
- ✅ Clear visual distinction between shared/not shared
- ✅ Intuitive Share/Unshare buttons
- ✅ No page refresh required for updates
- ✅ Helpful messages for vendors with no accessible versions

---

## Future Enhancements (Out of Scope)

### Advanced Sharing Controls
- Share specific versions with specific users (not just vendors)
- Time-limited sharing (expires after X days)
- Share with external email addresses (guest access)

### Sharing History
- View full history of sharing actions per version
- "Who has viewed this version?" analytics
- Audit trail for compliance

### Bulk Sharing
- Share multiple versions at once
- "Share all versions" shortcut for editors
- Template-based sharing rules

### Notifications
- Notify vendors when new version is shared
- Email notification for version sharing
- In-app notification badges

### Version Comments
- Allow vendors to comment on shared versions
- Discussion threads per version
- Feedback workflow integration

---

## Related Files

### Server
- `server/src/server.js` - Main server logic, API endpoints
- `data/app/versions/versions.json` - Version metadata storage (or session-specific paths)

### Client
- `shared-ui/components.react.js` - VersionsPanel component
- `web/view.html` - Web viewer (React mount point)
- `addin/src/taskpane/taskpane.html` - Word add-in (React mount point)

### Documentation
- `docs/aiDocs/features/versions.md` - Core versions feature
- `docs/aiDocs/architecture/state-machine.md` - Permission rules
- `docs/aiDocs/features/automated-testing-suite.md` - Testing strategy

---

## Acceptance Criteria

- [ ] Vendors (Hugh) can only view versions marked "for vendor"
- [ ] Editors can toggle "Share with Vendor" for any version
- [ ] Share/Unshare actions apply immediately across all clients
- [ ] New versions default to "not shared with vendor"
- [ ] Versions panel updates dynamically when new versions are saved
- [ ] Vendor receives 403 error when attempting to access non-shared version
- [ ] Activity log records all sharing actions
- [ ] Real-time SSE updates work for sharing events
- [ ] Cross-platform parity (Web and Word add-in)
- [ ] All edge cases handled gracefully
- [ ] Unit tests pass (permission checking, API endpoints)
- [ ] E2E tests pass (UI interactions, real-time updates)

---

**Last Updated:** October 27, 2025  
**Status:** 📋 Planned (Ready for Implementation)

