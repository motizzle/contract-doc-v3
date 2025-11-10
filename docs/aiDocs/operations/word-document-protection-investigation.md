# Word Document Protection Investigation - Office 365 Beta API Limitations

**Status:** ❌ Not Feasible (API Unavailable)  
**Branch:** `add-in-permission`  
**Investigation Date:** November 10, 2025  
**Word Version Tested:** 16.0.19328.20178 (Office 365, Monthly Enterprise Channel)

---

## Executive Summary

**Goal:** Implement role-based document protection in Word add-in to match web viewer behavior (viewer → read-only, suggester → track changes only, editor → full access).

**Finding:** The required Word JavaScript APIs are **in beta preview only** and are **not available** in standard Office 365 installations. This feature cannot be implemented without Office Insider builds.

**Impact:** Word add-in will continue to rely on "user trust" rather than technical enforcement of permissions, while the web viewer (SuperDoc) can enforce permissions properly.

---

## Background

### The Problem We Tried to Solve

From [`comments-sync-lessons-learned.md`](comments-sync-lessons-learned.md):

> **Critical Discovery:**
> - ❌ **Word add-in has NO permission enforcement** - User role changes update React state but don't restrict Word editing capabilities
> - ❌ Office.js API lacks document-level permission controls

When a user switches from "editor" to "suggester" role in the Word add-in:
- ✅ React UI updates correctly
- ✅ Buttons disable/enable based on permissions  
- ❌ **Word document remains fully editable**
- ❌ No automatic track changes enforcement

### SuperDoc's Approach

The SuperDoc team (Harbour Enterprises) discovered beta Word APIs that enable programmatic document protection:

**Repository:** https://github.com/Harbour-Enterprises/SuperDoc-Customer-UseCases/tree/main/superdoc-ms-word-addin-roles

**Key API (Beta):**
```javascript
await Word.run(async (context) => {
  const doc = context.document;
  doc.setEditingMode(Word.EditingMode.readOnly);              // Viewer
  doc.setEditingMode(Word.EditingMode.readOnlyWithReview);    // Suggester  
  doc.setEditingMode(Word.EditingMode.standard);              // Editor
  await context.sync();
});
```

**Alternative API (Also Beta):**
```javascript
await Word.run(async (context) => {
  const doc = context.document;
  doc.protection.protect(Word.ProtectionType.allowOnlyReading);  // Viewer
  doc.protection.protect(Word.ProtectionType.allowOnlyRevisions); // Suggester
  await context.sync();
});
```

---

## Technical Investigation

### What We Tried

#### Attempt 1: Manifest Requirements (Failed)
Added beta API requirement to `addin/manifest.xml`:

```xml
<Requirements>
  <Sets DefaultMinVersion="1.3">
    <Set Name="WordApi" MinVersion="1.3"/>
    <Set Name="WordApiPreview" MinVersion="1.0"/>
  </Sets>
</Requirements>
```

**Result:** Add-in failed to load entirely. Word rejected the manifest because beta APIs weren't available.

**Lesson:** Adding beta API requirements blocks the add-in on systems without beta support.

#### Attempt 2: Runtime Detection (Failed)
Removed manifest requirements, added runtime checks:

```javascript
await Word.run(async (context) => {
  const doc = context.document;
  const modes = { 'viewer': 'readOnly', 'suggester': 'readOnlyWithReview', 'editor': 'standard' };
  doc.setEditingMode(Word.EditingMode[modes[role]]);
  await context.sync();
});
```

**Error:**
```
❌ Document protection FAILED: 
TypeError: Cannot read properties of undefined (reading 'readOnly')
```

**Cause:** `Word.EditingMode` is `undefined` - the API doesn't exist.

#### Attempt 3: Alternative Protection API (Failed)
Tried using `document.protection.protect()` instead:

```javascript
await Word.run(async (context) => {
  const doc = context.document;
  context.load(doc, 'protection');
  await context.sync();
  
  if (doc.protection) {
    doc.protection.protect(Word.ProtectionType.allowOnlyReading);
    await context.sync();
  }
});
```

**Result:** `doc.protection` is `undefined` - this API also doesn't exist.

---

## Diagnostic Results

### Environment Information
```javascript
Office version: 16.0.19328.20178
Platform: PC
Host: Word
```

**Channel:** Monthly Enterprise Channel (not Office Insider)

### API Availability Check

```javascript
// Test 1: Check EditingMode
console.log('Word.EditingMode:', Word.EditingMode);
// Result: undefined

// Test 2: Check ProtectionType enum
console.log('Word.ProtectionType:', Word.ProtectionType);
// Result: {noProtection: 'NoProtection', allowOnlyRevisions: 'AllowOnlyRevisions', ...}

// Test 3: Check document.protection API
await Word.run(async (context) => {
  const doc = context.document;
  console.log('Has protection?', typeof doc.protection);
  // Result: undefined
});
```

### Key Finding

**Paradox:** The `Word.ProtectionType` **enum** exists (constants are defined), but the `document.protection` **API** doesn't exist (cannot be used).

This indicates:
- The Office.js library includes type definitions for beta APIs
- But the actual implementation is **not loaded** in non-Insider builds
- The enum is "forward-declared" but the functionality is missing

---

## Why This Doesn't Work

### Beta API Availability Matrix

| API Component | Standard Office 365 | Office Insider | Status |
|---------------|---------------------|----------------|--------|
| `Word.EditingMode` enum | ❌ `undefined` | ✅ Available | Beta Preview |
| `Word.ProtectionType` enum | ✅ Exists (stub) | ✅ Available | Beta Preview |
| `Document.setEditingMode()` | ❌ Does not exist | ✅ Available | Beta Preview |
| `Document.protection` object | ❌ `undefined` | ✅ Available | Beta Preview |
| `Document.protection.protect()` | ❌ Does not exist | ✅ Available | Beta Preview |

### Microsoft's API Versioning

From Microsoft's documentation:

> **Beta API Notice:**
> This project uses the beta version of the Word API (`WordApiPreview`). These APIs are provided as a preview for developers and may change based on feedback that we receive. **Do not use this API in a production environment.**

**Beta APIs are only available in:**
1. **Office Insider Program** (beta/preview channel)
2. **Current Channel** with Office Insider enabled
3. **Internal Microsoft testing builds**

**NOT available in:**
- Standard Office 365 subscriptions
- Monthly Enterprise Channel
- Semi-Annual Enterprise Channel
- Office 2016/2019/2021 perpetual licenses

### Why SuperDoc's Demo Works

SuperDoc's demonstration works because:
1. They're using **Office Insider builds** for testing
2. Their README explicitly states this is a **beta API demonstration**
3. They document it as "Document Protection Demo" not "Production Feature"
4. The repo is in a "Customer Use Cases" folder (examples, not production code)

---

## Implementation Attempts Summary

### Code Changes Made (Branch: `add-in-permission`)

**Commits:**
1. `f1f0b73` - Add Word document protection based on user roles
2. `1d74a23` - Add verbose logging and auto-clear production add-in
3. `4f2445d` - Fix PowerShell syntax - remove emoji characters
4. `d36cfb8` - Remove aggressive cache clearing - not needed
5. `9d01f0b` - Remove beta API requirement from manifest - causing add-in to not load
6. `94a165f` - Auto-close Word before sideloading to ensure clean dev environment

**What Worked:**
- ✅ Auto-close Word feature (useful improvement to `servers.ps1`)
- ✅ Verbose logging for debugging (shows API availability clearly)
- ✅ Manifest without beta requirements (allows add-in to load)

**What Failed:**
- ❌ Document protection enforcement (API doesn't exist)
- ❌ Role-based editing mode control (API doesn't exist)
- ❌ Runtime detection/graceful fallback (nothing to fall back to)

### Files Modified

**`addin/manifest.xml`:**
- Attempted to add `<Set Name="WordApiPreview"/>` (removed after testing)
- Final state: No beta requirements (back to original)

**`shared-ui/components.react.js`:**
- Added protection logic in 3 places:
  1. Initial document load (line ~1212)
  2. User role switching (line ~1452)  
  3. Version loading (line ~1104)
- All attempts fail with "Cannot read properties of undefined"

**`tools/scripts/servers.ps1`:**
- ✅ Added auto-close Word before sideloading (useful, keep this)

---

## Current State vs Desired State

### Current Behavior (Reality)

| User Role | Web Viewer | Word Add-in |
|-----------|------------|-------------|
| **Viewer** | ✅ Read-only (enforced) | ❌ Editable (trust-based) |
| **Suggester** | ✅ Track changes only (enforced) | ❌ Full editing (trust-based) |
| **Vendor** | ✅ Track changes only (enforced) | ❌ Full editing (trust-based) |
| **Editor** | ✅ Full access (enforced) | ✅ Full access |

### Desired Behavior (Not Achievable)

| User Role | Web Viewer | Word Add-in |
|-----------|------------|-------------|
| **Viewer** | ✅ Read-only (enforced) | ❌ Would need beta API |
| **Suggester** | ✅ Track changes only (enforced) | ❌ Would need beta API |
| **Vendor** | ✅ Track changes only (enforced) | ❌ Would need beta API |
| **Editor** | ✅ Full access (enforced) | ✅ Full access |

---

## Options & Recommendations

### Option 1: Join Office Insider Program ⚠️ Not Recommended for Production

**Steps:**
1. File → Account → Office Insider → Join Office Insider
2. Select **Beta Channel** (most features) or **Current Channel (Preview)**
3. Wait for updates to install
4. Beta APIs will become available

**Pros:**
- Gets access to beta APIs immediately
- Can test the feature as designed

**Cons:**
- ❌ Unstable updates (bugs, breaking changes)
- ❌ Not suitable for production environments
- ❌ Microsoft explicitly warns against production use
- ❌ Other users without Insider builds won't have the feature
- ❌ Feature may change or be removed in future updates

### Option 2: Wait for General Availability ✅ Recommended

**Timeline:** Unknown (6-18 months estimate based on typical beta → GA cycle)

**Pros:**
- ✅ Stable, production-ready API
- ✅ Available to all Office 365 users
- ✅ Microsoft support and guarantees
- ✅ No risk of breaking changes

**Cons:**
- ⏱️ May take months or years
- 📋 No confirmed release date

**Action Items:**
- Monitor Microsoft's [Office Add-ins roadmap](https://learn.microsoft.com/en-us/office/dev/add-ins/)
- Watch for announcements about document protection APIs moving to GA
- Revisit this feature when APIs are generally available

### Option 3: Accept Current Limitation ✅ Recommended (Short-term)

**Accept that:**
- Web viewer CAN enforce permissions (via SuperDoc)
- Word add-in CANNOT enforce permissions (yet)
- This is a platform limitation, not a bug

**Document clearly:**
- Add user guidance about role expectations
- Explain that Word relies on user discipline
- Provide clear visual indicators of current role
- Trust users to follow role guidelines

**Example User Messaging:**
```
💡 You are viewing as a Suggester
Please use track changes for all edits (Review tab → Track Changes)
```

---

## What We Learned

### 1. Beta APIs Are Not Available in Standard Office 365

Despite having Office 365 subscription with latest updates:
- Beta APIs require **Office Insider** enrollment
- Monthly/Semi-Annual Enterprise Channels do not get beta features
- The presence of enum constants doesn't mean API implementation exists

### 2. Manifest Requirements Block Add-in Loading

Adding beta API requirements to manifest:
```xml
<Set Name="WordApiPreview" MinVersion="1.0"/>
```

**Results in:** Add-in completely fails to load on systems without beta support.

**Lesson:** Never add beta API requirements to production manifests.

### 3. Runtime Detection Is Possible But Useless

Can detect API availability at runtime:
```javascript
if (typeof Word.EditingMode !== 'undefined') {
  // Use beta API
} else {
  // Fall back to... nothing
}
```

**Problem:** There is **no fallback** - no alternative API exists for document protection.

### 4. SuperDoc's Approach Requires Insider Builds

The SuperDoc demo that inspired this investigation:
- Uses beta APIs knowingly (documented in README)
- Works in their testing environment (Office Insider)
- Would NOT work in our production environment
- Is a **demonstration**, not production code

---

## Related Documentation

### Internal Docs
- **[`comments-sync-lessons-learned.md`](comments-sync-lessons-learned.md)** - Originally documented this permission gap
- **[`addin-loading-lessons-learned.md`](addin-loading-lessons-learned.md)** - Manifest and loading issues
- **[`user-permissions.md`](../features/user-permissions.md)** - Current role-based permission system
- **[`state-machine.md`](../architecture/state-machine.md)** - How permissions currently work

### External References
- **SuperDoc Demo:** https://github.com/Harbour-Enterprises/SuperDoc-Customer-UseCases/tree/main/superdoc-ms-word-addin-roles
- **Word Preview APIs:** https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-preview-apis
- **Document Protection Options:** https://learn.microsoft.com/en-us/javascript/api/word/word.documentprotectoptions?view=word-js-preview
- **Office Insider Program:** https://insider.microsoft365.com/

---

## Recommendations for Branch Cleanup

### Keep These Changes (Useful Improvements)

**File:** `tools/scripts/servers.ps1`
```powershell
# Auto-close Word before sideloading
function Start-AddinSideload() {
  $word = Get-Process -Name WINWORD -ErrorAction SilentlyContinue
  if ($word) {
    Stop-Process -Name WINWORD -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  # ... launch npm start
}
```

**Benefit:** Ensures clean development environment, prevents "Word already running" issues.

### Remove These Changes (Don't Work)

**File:** `shared-ui/components.react.js`
- Remove all document protection code (lines ~1104, ~1212, ~1452)
- Remove verbose logging related to protection attempts
- Keep general debugging improvements if useful

**File:** `addin/manifest.xml`
- Already clean (beta requirements removed)
- No changes needed

### Merge Strategy

**Option A: Merge Auto-Close Feature Only**
1. Cherry-pick commit `94a165f` (auto-close Word)
2. Discard other commits
3. Merge to main

**Option B: Close Branch, Document Findings**
1. Don't merge any code
2. Merge this documentation only
3. Reference branch in docs for future investigation

**Recommended:** Option B - document the investigation, revisit when APIs are available.

---

## Future Work

### When Beta APIs Become Generally Available

**Monitor for these changes:**
1. Microsoft announces Word JavaScript API 1.5+ moves to GA
2. Document protection APIs no longer marked as "BETA (PREVIEW ONLY)"
3. APIs work in Monthly Enterprise Channel (not just Insider)

**Re-implementation checklist:**
1. Verify API availability in standard Office 365
2. Update manifest if requirements are needed
3. Implement protection logic (already written in this branch)
4. Test with all user roles
5. Deploy to production

### Alternative Approaches to Consider

**1. Information Rights Management (IRM)**
- Office 365 feature for document protection
- Requires Azure Information Protection setup
- More complex than desired for this use case

**2. Content Controls with Editing Restrictions**
- Lock specific sections of document
- Available in current Office.js API (not beta)
- More granular than we need (section-level vs document-level)

**3. Accept UI-Only Restrictions**
- Current approach: Disable UI buttons based on role
- Add prominent visual indicators of role
- Trust users to follow role guidelines
- Works adequately for collaborative environments

---

## Conclusion

**The feature we attempted to implement cannot work with current Office 365 installations.**

- ✅ Investigation was thorough and conclusive
- ✅ We identified the exact technical limitation
- ✅ We have clear options for moving forward
- ✅ Documentation will help future developers avoid this rabbit hole
- ❌ Role-based document protection in Word add-in is not feasible today

**Next Steps:**
1. Merge this documentation to main branch
2. Keep auto-close Word improvement from `servers.ps1`
3. Discard protection code from `shared-ui/components.react.js`
4. Monitor Microsoft's Office Add-ins roadmap
5. Revisit when document protection APIs reach general availability

---

**Document Version:** 1.0  
**Investigation Lead:** AI Assistant + User Testing  
**Date:** November 10, 2025  
**Branch Status:** Pending cleanup and closure

