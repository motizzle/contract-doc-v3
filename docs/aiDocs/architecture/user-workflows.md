# User Workflows & Integration Scenarios
**Last Updated:** October 17, 2025  
**Status:** ✅ Production Reference

---

## Purpose

This document describes **cross-feature user workflows** and **integration scenarios** from the user's perspective. 

**For detailed implementation:**
- State rules → `STATE-MACHINE.md`
- Feature APIs → `features/*.md`
- System architecture → `system-overview.md`

---

## System Initialization

### Server Startup
```
1. Load configuration from data/app/
   - state.json, users.json, roles.json, variables.json
2. Initialize SuperDoc collaboration (port 4002)
3. Start HTTPS server (port 4001)
   - Serve static assets
   - Mount API routes
   - Enable SSE endpoint
4. Preload document context for AI
```

**Health check:** `GET /api/v1/health` → `{ ok: true }`

---

### Web Viewer Initialization

```
1. Load dependencies (React, SuperDoc SDK)
2. Set globals (window.__IS_DEBUG__, window.userStateBridge)
3. Load SuperDoc
   - Mount editor to #superdoc
   - Configure modules (comments, fieldAnnotation, toolbar)
4. Load document (/documents/working or /canonical)
5. Mount React sidepane (#app-root)
6. Connect SSE (/api/v1/events)
7. Fetch state matrix
```

**User sees:** Editor + sidepane with user dropdown, buttons, activity panel

---

### Word Add-in Initialization

```
1. Office.onReady() - wait for Office.js
2. Load dependencies (React, SuperDoc SDK)
3. Initialize hidden SuperDoc (for Content Control detection)
4. Mount React sidepane
5. Connect SSE
6. Fetch state matrix
7. Sync with Word document (detect Content Controls)
```

**User sees:** Taskpane with same UI as web viewer

---

## Core Workflows

### 1. Document Editing Flow

**Checkout → Edit → Save → Check-in**

```
User clicks [Checkout]
  → POST /api/v1/checkout { userId, clientVersion }
  → Server: checkedOutBy = userId
  → SSE broadcast: checkout event
  → All clients: Button changes to [Save], [Check-in]
  → Banner: "Checked out by you" (blue)

User edits document
  → Changes tracked locally
  → No server communication yet

User clicks [Save] or auto-save triggers
  → SuperDoc exports as base64
  → POST /api/v1/save-progress { userId, base64 }
  → Server validates ownership
  → Server saves to data/working/documents/
  → Server increments documentVersion
  → SSE broadcast: save-progress event
  → Other users see: "Update available" banner

User clicks [Check-in]
  → POST /api/v1/checkin { userId }
  → Server: checkedOutBy = null
  → Server increments documentVersion
  → SSE broadcast: checkin event
  → All clients: Button changes to [Checkout]
  → Banner: "Available for editing" (green)
```

**For details:** `features/checkin-checkout.md` + `STATE-MACHINE.md`

---

### 2. Variables Workflow

**Create → Insert → Update**

**Create (Server-side):**
```
User: Variables panel → [+ Create]
  → Modal: Type, Label, Value
  → POST /api/v1/variables { type, displayLabel, value }
  → Server generates varId, saves to variables.json
  → SSE broadcast: variable:created
  → All clients update variables panel
```

**Insert (Cross-platform):**

**Web:** Field Annotation with teal border  
**Word:** Content Control with teal border

```
User clicks [Insert]
  → Web: SuperDoc Field Annotation at cursor
  → Word: ContentControl via Office.js API
  → Visual: Teal border (#0E6F7F)
  → On save: Persists in DOCX
```

**Update Value:**
```
User edits value → "ACME Inc"
  → PUT /api/v1/variables/:varId/value { value }
  → Server updates variables.json
  → SSE broadcast: variable:valueChanged
  → All clients find instances and update text
  → Visual: All "ACME Corporation" → "ACME Inc"
```

**For details:** `features/variables.md`

---

### 3. Approvals Workflow

**View → Self-Approve → Override → Request Review**

```
User clicks [Approvals: 2/5]
  → Modal opens with table (Name, Approved, Notes, Actions)
  → GET /api/v1/approvals

User checks own checkbox
  → POST /api/v1/approvals/set { userId, approval: true }
  → Server updates, recomputes summary
  → SSE broadcast: approvals:update
  → All clients update pill: [Approvals: 3/5]

Editor overrides another user
  → Confirmation: "Override approval for Bob?"
  → POST /api/v1/approvals/set { userId, targetUserId, approval }
  → Activity log: "Jane approved on behalf of Bob"
  → SSE broadcast

User clicks [Request Review]
  → POST /api/v1/approvals/notify
  → Activity log: "Warren requested review from 3 approvers"
  → All clients show toast
```

**For details:** `features/approvals.md`

---

### 4. Comments & Track Changes

**Add Comment → View in Word → Track Changes (Suggester)**

```
Web: Select text → Add Comment
  → SuperDoc comment UI
  → Comment saved to SuperDoc state
  → On save: Persists in DOCX XML
  
Word: Open document
  → Native Word comments visible
  → Comments use standard comments.xml format
  → Full threading supported

Suggester edits document
  → Role determines mode: getModeForRole('suggester') → 'suggesting'
  → SuperDoc tracks changes automatically
  → Changes saved as special comments in DOCX
  
Editor reviews changes
  → Accept/reject UI in SuperDoc
  → Changes applied or removed
```

**For details:** `features/comments-sync.md`

---

### 5. Version Management

**Snapshot → View Version → Revert**

```
Create Snapshot:
  User: Document Actions → Create Snapshot
    → Modal: "Label: [Quarterly Review]"
    → POST /api/v1/document/snapshot { userId, label }
    → Server copies: working/ → versions/v5_timestamp.docx
    → Activity log entry

View Version:
  User: Document Actions → View Version → Select v3
    → POST /api/v1/versions/view { userId, version: 3 }
    → Server reads versions/v3_*.docx
    → SuperDoc opens version (read-only)
    → Banner: "Viewing Version 3 (read-only)"

Revert:
  User: [Revert to This Version]
    → Confirmation dialog
    → POST /api/v1/document/revert { userId, version: 3 }
    → Server copies versions/v3_*.docx → working/default.docx
    → SSE broadcast: documentRevert
    → All clients reload document
```

**For details:** `features/versions.md`

---

### 6. Status Lifecycle

**Draft → Review → Final → Draft**

```
Current: draft (green banner)
User: Document Actions → Cycle Status
  → POST /api/v1/status/cycle
  → Server: status = 'review'
  → SSE broadcast: status event
  → Banner color: green → orange

Next cycle: review → final
  → Banner color: orange → gray
  → Checkout disabled (must unfinalize first)

Next cycle: final → draft
  → Banner color: gray → green
  → Checkout re-enabled
```

**Validation:** Checkout endpoint rejects if `status === 'final'`

**For details:** `STATE-MACHINE.md` (status rules)

---

## Integration Scenarios

### Scenario 1: Multi-User Document Collaboration

```
Timeline:
09:00 - User A (web, editor) checks out document
09:15 - User A makes edits, saves (version 5)
09:30 - User B (Word, editor) sees "Update available" banner
09:31 - User B clicks [Reload] → sees User A's changes
09:45 - User A checks in document
09:46 - User B immediately sees [Checkout] button available
09:47 - User B checks out, makes edits
10:00 - User A sees "User B updated this document"
```

**Key behavior:**
- ✅ Real-time sync via SSE
- ✅ Update notifications when version advances
- ✅ No conflicts (single-writer enforced)

---

### Scenario 2: Variable Management Across Platforms

```
Timeline:
1. Editor creates variable "Company Name" = "ACME Corp" (web)
   → SSE broadcast → Word sidepane updates
   
2. Editor inserts variable into document (Word)
   → Office.js creates Content Control
   → On save: Persists in DOCX
   
3. Editor opens document in web viewer
   → SuperDoc reads Content Control as structuredContent node
   → Variable appears with teal border
   
4. Editor updates value to "ACME Inc" (web)
   → SSE broadcast
   → Word taskpane receives event
   → Word finds Content Control by tag, updates text
   → Visual: Both platforms show "ACME Inc"
```

**Key behavior:**
- ✅ Same underlying technology (Content Controls)
- ✅ Cross-platform detection via SuperDoc
- ✅ Real-time value updates via SSE

---

### Scenario 3: Approval Workflow with Override

```
Timeline:
1. Document ready for review (draft status)
2. Bob (suggester) approves [1/5]
3. Alice (editor) approves [2/5]
4. Charlie (viewer) approves [3/5]
5. Dave goes on vacation (no approval)
6. Alice (editor) overrides Dave's approval
   → Confirmation dialog
   → Activity log: "Alice approved on behalf of Dave"
   → [4/5]
7. Final user approves → [5/5]
8. All users see completion notification
```

**Key behavior:**
- ✅ All roles can self-approve
- ✅ Editors can override with confirmation
- ✅ Activity log tracks all actions

---

### Scenario 4: Cross-Platform Comment Sync

```
Timeline:
1. Web user adds comment on paragraph 3
   → Comment saved in SuperDoc state
   → On save: Written to DOCX comments.xml
   
2. Word user opens document
   → Native Word reads comments.xml
   → Comment appears in Word's comment pane
   → Can reply using Word's native UI
   
3. Word user adds reply
   → Word writes to comments.xml
   → Saves document
   
4. Web user refreshes document
   → SuperDoc reads comments.xml
   → Reply appears in web comments container
```

**Key behavior:**
- ✅ No real-time comment sync (file-based only)
- ✅ Uses standard DOCX format
- ✅ Comments persist across platforms

---

## Data Flow Patterns

### SSE Broadcast Pattern

```javascript
// Server broadcasts after state change
broadcast({ 
  type: 'checkout', 
  userId: 'user1',
  timestamp: Date.now()
});

// All connected clients receive
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  window.dispatchEvent(new CustomEvent(data.type, { detail: data }));
  refreshStateMatrix();
};
```

---

### Cross-Platform Sync Example

```
1. Web user saves (version 5)
   → POST /api/v1/save-progress
   → documentVersion = 5
   → SSE: { type: 'save-progress', documentVersion: 5 }

2. Word user receives SSE
   → clientVersion = 4, serverVersion = 5
   → Show banner: "Update available"
   → [Reload] button offered

3. User clicks [Reload]
   → GET /documents/working/default.docx
   → Office.js replaces document content
   → clientVersion = 5
   → Banner dismissed
```

---

### Version Conflict Detection

```
Client A: Has version 4
Client B: Saves → version becomes 5
Client A: Tries to save
  → POST /api/v1/save-progress { clientVersion: 4 }
  → Server checks: 4 < 5 → Outdated!
  → Returns 409: "Document updated by someone else"
  → Client A must reload before saving
```

**For details:** `STATE-MACHINE.md` (version management)

---

## Factory Reset Behavior

**Complete state reset for testing/demo**

```
User: Document Actions → Factory Reset
  → Confirmation required
  → POST /api/v1/factory-reset { userId }

Server actions:
1. Clear checkout (checkedOutBy = null)
2. Reset version (documentVersion = 1)
3. Restore seed variables
4. Clear all approvals
5. Clear activity log
6. Clear messages
7. Revert document to canonical
8. SSE broadcast: factoryReset

All clients:
- Reload document
- Reset UI state
- Refresh all panels
```

**Use case:** Start demos from clean state

---

## Quick Reference

### Common User Actions

| Action | Primary Endpoint | Triggers |
|--------|-----------------|----------|
| Checkout | POST /api/v1/checkout | State matrix refresh |
| Save | POST /api/v1/save-progress | Version++, SSE |
| Check-in | POST /api/v1/checkin | State matrix refresh |
| Create variable | POST /api/v1/variables | SSE broadcast |
| Update variable | PUT /api/v1/variables/:id/value | SSE broadcast |
| Self-approve | POST /api/v1/approvals/set | SSE broadcast |
| Cycle status | POST /api/v1/status/cycle | State matrix refresh |
| Create snapshot | POST /api/v1/document/snapshot | Version saved |

---

### State Transitions

See `STATE-MACHINE.md` for complete state transition rules.

**Quick examples:**
- `available → checked_out_self` (user checks out)
- `checked_out_self → available` (user checks in)
- `draft → review → final → draft` (status cycle)

---

## Related Documentation

**For detailed information:**
- **State rules & permissions** → `STATE-MACHINE.md`
- **Checkout implementation** → `features/checkin-checkout.md`
- **Variables implementation** → `features/variables.md`
- **Approvals implementation** → `features/approvals.md`
- **Comments implementation** → `features/comments-sync.md`
- **Testing** → `features/automated-testing-suite.md`
- **System architecture** → `system-overview.md`

---

**Last Updated:** October 17, 2025  
**Lines:** ~340 (reduced from 699)  
**Focus:** User workflows, not implementation details
