# State Matrix Documentation Comparison & Audit
**Date:** October 17, 2025  
**Purpose:** Identify discrepancies between old docs and actual implementation

---

## Current Situation

### ❌ OLD/OUTDATED Documents (3 files)
1. `docs/state-matrix-plain-english.md` - Outdated
2. `docs/fromV2/state-matrix-plain-english.md` - Outdated copy
3. `docs/aiDocs/_archive/state-matrix.md` - Already archived

### ✅ NEW/AUTHORITATIVE Document (1 file)
- `docs/aiDocs/architecture/state-machine.md` - **Current implementation**

---

## Key Discrepancies

### Old Docs Claim These Buttons Exist (They Don't!)

| Button | In Old Docs | In Actual Implementation | Status |
|--------|-------------|--------------------------|--------|
| `viewOnlyBtn` | ✅ | ❌ | **Removed** |
| `shareToWebBtn` | ✅ | ❌ | **Removed** |
| `templatesBtn` | ✅ | ❌ | **Removed** |
| `compileBtn` | ✅ | ❌ | **Removed** |
| `approvalsBtn` | ✅ | ❌ | **Removed** |
| `requestReviewBtn` | ✅ | ❌ | **Removed** |
| `finalizeBtn` | ✅ | ❌ | **Removed** |
| `unfinalizeBtn` | ✅ | ❌ | **Removed** |
| `checkedInBtns` | ✅ | ❌ | **Removed** |
| `dropdown.order` | ✅ | ❌ | **Removed** |

### Actual Implementation (Current Buttons)

**From `server/src/server.js` lines 1347-1360:**
```javascript
buttons: {
  replaceDefaultBtn: true,              // ✅ Exists
  checkoutBtn: !!rolePerm.checkout && !isCheckedOut,
  checkinBtn: !!rolePerm.checkin && isOwner,
  cancelBtn: !!rolePerm.checkin && isOwner,
  saveProgressBtn: !!rolePerm.checkin && isOwner,
  overrideBtn: !!rolePerm.override && isCheckedOut && !isOwner,
  sendVendorBtn: !!rolePerm.sendVendor,
  openGovBtn: true,                     // ✅ Exists
  primaryLayout: {                      // ⭐ NEW - not in old docs!
    mode: (!isCheckedOut ? 'not_checked_out' 
          : (isOwner ? 'self' : 'other'))
  }
}
```

---

## Critical Missing Concept in Old Docs

### `primaryLayout.mode` - The Most Important Field!

**Old docs:** ❌ No mention  
**Actual implementation:** ✅ Core feature

```javascript
primaryLayout: {
  mode: 'not_checked_out' | 'self' | 'other'
}
```

**What it controls:**
- `not_checked_out` → Show [Checkout], green banner
- `self` → Show [Save], [Check-in], blue banner  
- `other` → Show read-only UI, gray banner

**This is how the UI knows what to render!**

---

## Structural Differences

### Old Docs Structure
```json
{
  "buttons": { /* 15+ buttons */ },
  "dropdown": { "order": [...] },     // ❌ Doesn't exist
  "finalize": { "isFinal": false },   // ❌ Doesn't exist
  "banner": { ... },
  "approvals": { "enabled": true },
  "checkoutStatus": { ... }
}
```

### Actual Implementation Structure
```json
{
  "config": {
    "documentId": "default",
    "documentVersion": 1,
    "title": "Document Title",         // ⭐ NEW
    "status": "draft",                 // ⭐ NEW
    "lastUpdated": "2025-10-17...",
    "updatedBy": { userId, label },    // ⭐ NEW
    "lastSaved": { ... },              // ⭐ NEW
    "buttons": {
      "replaceDefaultBtn": true,
      "checkoutBtn": false,
      "checkinBtn": false,
      "cancelBtn": false,
      "saveProgressBtn": false,
      "overrideBtn": false,
      "sendVendorBtn": false,
      "openGovBtn": true,
      "primaryLayout": {               // ⭐ NEW - CRITICAL
        "mode": "not_checked_out"
      }
    },
    "banner": { ... },
    "banners": [ ... ],                // ⭐ NEW - array of banners
    "checkoutStatus": { ... },
    "viewerMessage": { ... },
    "approvals": {
      "enabled": true,
      "summary": { approved, total }   // ⭐ NEW
    }
  },
  "revision": 123                      // ⭐ NEW - state version
}
```

---

## Permission Model Changes

### Old Docs
```
"Editors can check out, check in, finalize/unfinalize, manage approvals."
```

### Actual Implementation
**Source:** `data/app/users/roles.json`

```json
{
  "editor": {
    "checkout": true,
    "checkin": true,
    "override": true,
    "sendVendor": true
  },
  "suggester": {
    "checkout": true,
    "checkin": true,
    "override": false,
    "sendVendor": false
  },
  "viewer": {
    "checkout": false,
    "checkin": false,
    "override": false,
    "sendVendor": false
  }
}
```

**No mention of `finalize`/`unfinalize` permissions** - they're handled differently now.

---

## Referenced Files That No Longer Exist

Old docs reference:
- ❌ `api-server.js` (doesn't exist)
- ❌ `state_matrix_api.js` (doesn't exist)
- ❌ `state-matrix-client.js` (doesn't exist)

Actual files:
- ✅ `server/src/server.js` (lines 1321-1399)
- ✅ `shared-ui/components.react.js` (client rendering)

---

## Recommendation

### ✅ Keep as Single Source of Truth
**`docs/aiDocs/architecture/state-machine.md`**
- Accurate to current implementation
- Includes all actual fields
- Matches `server/src/server.js` exactly
- Includes `primaryLayout` mode
- Includes version management
- Includes role permissions

### ❌ Delete These Outdated Files
1. `docs/state-matrix-plain-english.md`
2. `docs/fromV2/state-matrix-plain-english.md`

### ✅ Already Archived (Good!)
- `docs/aiDocs/_archive/state-matrix.md`

---

## What Old Docs Got Wrong

1. **Missing `primaryLayout.mode`** - The core UI rendering logic
2. **Wrong button list** - References 9 buttons that don't exist
3. **Missing fields:** `title`, `status`, `documentVersion`, `updatedBy`, `revision`
4. **Wrong structure:** Claims `finalize.isFinal` exists (it doesn't)
5. **Wrong approvals format:** Missing `summary` field
6. **References dead files:** `api-server.js`, etc.
7. **No mention of SSE/revision tracking**
8. **No mention of update detection banners**

---

## What New Doc Gets Right

**`state-machine.md` accurately documents:**

✅ All actual buttons (8 buttons, not 15)  
✅ `primaryLayout.mode` (critical!)  
✅ Complete `serverState` structure  
✅ Actual permission model from `roles.json`  
✅ State transition rules  
✅ SSE event types  
✅ Version management  
✅ Update detection logic  
✅ Correct file references  
✅ Real-world scenarios  
✅ Test coverage details  

---

## Verification

**State Matrix Endpoint:** `server/src/server.js:1321-1399`

**Current response structure:**
```javascript
res.json({ 
  config: {
    documentId,
    documentVersion,
    title,                    // ✅
    status,                   // ✅
    lastUpdated,
    updatedBy,
    lastSaved,
    buttons: {
      replaceDefaultBtn,
      checkoutBtn,
      checkinBtn,
      cancelBtn,
      saveProgressBtn,
      overrideBtn,
      sendVendorBtn,
      openGovBtn,
      primaryLayout: { mode }  // ✅ CRITICAL
    },
    banner,
    banners,                   // ✅
    checkoutStatus,
    viewerMessage,
    approvals: {
      enabled,
      summary                  // ✅
    }
  },
  revision                     // ✅
});
```

**Matches `state-machine.md`:** ✅ YES  
**Matches old plain-english docs:** ❌ NO

---

## Conclusion

**Single authoritative document:**
- ✅ `docs/aiDocs/architecture/state-machine.md`

**Delete these outdated docs:**
- ❌ `docs/state-matrix-plain-english.md`
- ❌ `docs/fromV2/state-matrix-plain-english.md`

**Action:** Remove old docs to prevent confusion.

