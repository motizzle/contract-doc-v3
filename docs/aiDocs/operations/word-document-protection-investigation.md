# Word Document Protection Investigation - API Availability Issue

## TL;DR

**✅ SOLVED: Role-based document protection is now working using the beta Office.js library.**

**Original Problem:** The `document.protect()` API was not accessible using the standard Office.js library on our Monthly Enterprise Channel installation.

**Solution:** Switched to the beta Office.js library (`/lib/beta/hosted/office.js`) which exposes preview APIs without requiring Office Insider or specific Office versions.

**Status:** ✅ Working in production on Office 365 Monthly Enterprise Channel (Build 19328.20178)

---

## Problem Statement

**Goal:** Implement role-based document protection in Word add-in to match web viewer behavior:
- **Viewer** → Read-only (enforced)
- **Suggester/Vendor** → Track changes only (enforced)
- **Editor** → Full access

---

## What We Tried

### Implementation Approach

Based on [SuperDoc's demo repository](https://github.com/Harbour-Enterprises/SuperDoc-Customer-UseCases/tree/main/superdoc-ms-word-addin-roles), we implemented document protection using the Word JavaScript API:

```javascript
await Word.run(async (context) => {
  context.document.protect("AllowOnlyReading");    // For viewer
  context.document.protect("AllowOnlyRevisions");  // For suggester/vendor  
  context.document.protect("NoProtection");        // For editor
  await context.sync();
});
```

### Error Received

```
⚠️ [INITIAL LOAD] Document protection failed: 
TypeError: context.document.protect is not a function
```

**Translation:** The `document.protect()` method does not exist in our Word installation.

---

## Troubleshooting Process

### 1. Verified Office Version

```javascript
Office.context.diagnostics.version  // 16.0.19328.20178
Office.context.diagnostics.platform // PC
Office.context.diagnostics.host     // Word
```

**Confirmed:** Standard Office 365 subscription, Monthly Enterprise Channel

### 2. Checked API Availability

```javascript
await Word.run(async (context) => {
  const doc = context.document;
  console.log('Has protect method?', typeof doc.protect);
  // Result: undefined
});
```

**Confirmed:** The `document.protect()` method is not loaded in Office.js library.

### 3. Checked Manifest Requirements

**Attempted:** Adding `WordApiDesktop 1.4` requirement to manifest:

```xml
<Requirements>
  <Sets DefaultMinVersion="1.3">
    <Set Name="WordApi" MinVersion="1.3"/>
    <Set Name="WordApiDesktop" MinVersion="1.4"/>
  </Sets>
</Requirements>
```

**Result:** Add-in was silently rejected by Word - it registered in the registry but didn't appear in Word's add-ins panel.

**Conclusion:** Our Word version does not support `WordApiDesktop 1.4`.

---

## Microsoft's API Requirements

### Official Documentation

**Source:** [Word JavaScript API requirement sets](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-api-requirement-sets?view=word-js-preview)

### WordApiDesktop 1.4 Availability

![Microsoft API Requirement Sets Table](./word-api-requirements-table.png)

| Office Version | Required Build | Status |
|---------------|----------------|---------|
| **Office on Windows (Microsoft 365 subscription)** | Version 2508 (Build 19127.20264) | ❌ Not available in Monthly Enterprise Channel yet |
| **Office on Windows (volume-licensed)** | Not available | ❌ Will never be available |
| **Preview APIs** | "Please use the latest Office version to try preview APIs (you may need to join the Microsoft 365 Insider program)" | ⚠️ Requires Office Insider |

### Our Version vs. Required Version

| What We Have | What's Required |
|--------------|-----------------|
| Version: 16.0.19328.20178 | Version: 2508 (Build 19127.20264) |
| Channel: **Monthly Enterprise** | Channel: **Current** or **Office Insider** |
| Build: 19328 | Build: 19127 |
| API Sets: `WordApi 1.3` | API Sets: `WordApiDesktop 1.4` |

**Note:** Even though our build number (19328) is higher than the required build (19127), we're on a different **update channel** that doesn't include preview APIs like `WordApiDesktop 1.4`.

---

## Microsoft Update Channels Explained

Microsoft Office has multiple update channels with different release schedules:

| Channel | Purpose | Gets WordApiDesktop 1.4 |
|---------|---------|------------------------|
| **Office Insider (Beta)** | Preview/testing new features | ✅ Has it now |
| **Current Channel** | Faster updates, newer features | ✅ Has it (Version 2508+) |
| **Monthly Enterprise Channel** | Balanced stability and updates | ❌ Not yet (our channel) |
| **Semi-Annual Enterprise Channel** | Maximum stability, slower updates | ❌ Not yet |

**We're on Monthly Enterprise Channel** - it receives features 2-6 months after Current Channel.

---

## Why SuperDoc's Demo Works

SuperDoc's repository explicitly states:
> "This project uses the **beta version** of the Word API"

They're testing with:
- Office Insider builds, OR
- Current Channel (Version 2508+)

Both have `WordApiDesktop 1.4` available.

---

## Diagnostic Results Summary

### ✅ What Works
- Add-in loads successfully (without WordApiDesktop requirement)
- Standard Word APIs (`WordApi 1.3`) work fine
- Role-based UI updates work correctly
- Document loading/saving works

### ❌ What Doesn't Work
- `document.protect()` method does not exist
- `WordApiDesktop 1.4` requirement blocks add-in loading
- Cannot programmatically enforce document protection
- No runtime detection possible (API simply doesn't exist)

---

## Options & Recommendations

### Option 1: Wait for General Availability ✅ Recommended

**Timeline:** Unknown (estimated 2-6 months based on typical channel lag)

**Pros:**
- ✅ Stable, production-ready API when it arrives
- ✅ Available to all users on Monthly Enterprise Channel
- ✅ No risks or instability

**Cons:**
- ⏱️ No control over timeline
- 📋 No confirmed release date from Microsoft

**Action:**
- Monitor Microsoft's Office update notes
- Check `WordApiDesktop 1.4` availability every few months
- Revisit when API reaches Monthly Enterprise Channel

### Option 2: Join Office Insider Program ⚠️ Not Recommended

**What it is:** [Microsoft 365 Insider Program](https://insider.microsoft365.com/) - beta testing program for Office

**Important:** Office Insider is per-user/organization with Microsoft 365 subscription, NOT per-add-in. Joining only affects YOUR Office installation - customers without Insider won't have access to the API and the add-in won't work for them.

**Pros:**
- ✅ Gets `WordApiDesktop 1.4` immediately
- ✅ Can test the feature now

**Cons:**
- ❌ Unstable/preview builds - potential bugs
- ❌ Not suitable for production work environments
- ❌ Other users without Insider won't have the feature
- ❌ APIs may change before final release

### Option 3: Accept Current Limitation ✅ Recommended (Short-term)

**Accept that:**
- Web viewer CAN enforce permissions (via SuperDoc)
- Word add-in CANNOT enforce permissions (yet)
- This is a platform limitation, not our bug

**Mitigations:**
- Add clear UI indicators of current user role
- Disable edit buttons for viewer/suggester roles
- Provide user guidance about expected behavior
- Trust users to follow role guidelines

**Example User Messaging:**
```
💡 You are viewing as a Suggester
Please use Track Changes for all edits (Review tab → Track Changes)
```

---

## Technical Details

### API Hierarchy

```
Office.js
└── WordApi 1.3 (Standard, GA) ✅ Available
    ├── Document
    ├── Range
    ├── Paragraph
    └── ...

WordApiDesktop 1.4 (Preview, Desktop-only) ❌ Not Available
└── Document.protect() ← The API we need
```

### Why API Doesn't Exist

**Microsoft's API versioning:**
- **`WordApi`** = Standard cross-platform APIs (web, Windows, Mac, iPad)
- **`WordApiDesktop`** = Windows desktop-only APIs (more powerful, OS-specific)
- **Preview/Beta** = Not released to all channels yet

`WordApiDesktop` is a separate requirement set from `WordApi` - they have independent version numbers and release schedules.

---

### External References
- **SuperDoc Demo:** https://github.com/Harbour-Enterprises/SuperDoc-Customer-UseCases/tree/main/superdoc-ms-word-addin-roles
- **Word API Requirement Sets:** https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-api-requirement-sets?view=word-js-preview
- **Document Protection API:** https://learn.microsoft.com/en-us/javascript/api/word/word.document?view=word-js-preview#word-word-document-protect-member(1)
- **Office Insider Program:** https://insider.microsoft365.com/

---

## ✅ UPDATE: Beta Library Solution (WORKING)

### The Breakthrough

After consultation with external developers familiar with Office.js, we discovered that **using the beta Office.js library enables access to preview APIs without requiring Office Insider**.

### What Changed

**Modified File:** `addin/src/taskpane/taskpane.html`

**Before (standard library):**
```html
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
```

**After (beta library):**
```html
<script src="https://appsforoffice.microsoft.com/lib/beta/hosted/office.js"></script>
```

### Why This Works

The beta library provides JavaScript wrappers for preview APIs that can access underlying native Office implementations even when the Office version hasn't officially received the feature through its update channel.

**Key insight:**
- **Manifest requirements** are checked at add-in load time (hard gate)
- **Beta library calls** happen at runtime (soft check - tries to execute)
- If the underlying native implementation exists (even unofficially), it works

We kept the manifest at `WordApi 1.3` (no WordApiDesktop 1.4 requirement) so the add-in loads successfully, then the beta library provides access to `document.protect()` at runtime.

### Implementation

**1. Protection Logic with Unprotect-First Pattern:**

```javascript
await Word.run(async (context) => {
  // Remove any existing protection first
  try {
    context.document.unprotect();
    await context.sync();
  } catch (unprotectErr) {
    // No existing protection - continue
  }
  
  // Apply new protection based on role
  if (role === 'viewer') {
    context.document.protect("AllowOnlyReading");
  } else if (role === 'suggester' || role === 'vendor') {
    context.document.protect("AllowOnlyRevisions");
  } else {
    context.document.protect("NoProtection");
  }
  
  await context.sync();
});
```

**2. Applied in Two Locations:**
- Initial document load (after document is inserted)
- User role switch (after document reload)

### Test Results

✅ **Working on Office 365 Monthly Enterprise Channel (Build 19328.20178)**
- Viewer role → Document locked in read-only mode
- Suggester/Vendor role → Track changes enforced
- Editor role → Full editing access
- Role transitions work smoothly without errors

### Production Considerations

**Stability:**
- Beta library is Microsoft's official preview channel
- Designed for developers to test upcoming features
- APIs may change before final release

**Compatibility:**
- Works on tested Office 365 builds (Monthly Enterprise Channel)
- Should work on most modern Office 365 desktop installations
- May not work on very old Office versions or perpetual licenses

**Recommendation:** ✅ **Approved for production use with monitoring**
- Feature provides significant value
- Beta library is stable enough for production
- Graceful error handling implemented (try/catch with warnings)
- Monitor for any Microsoft API changes

---

## Conclusion (Updated)

**✅ The feature IS implemented and working using the beta Office.js library.**

### Final Key Findings

1. ✅ **Root cause identified:** Preview APIs not exposed in standard Office.js library
2. ✅ **Solution found:** Beta Office.js library provides access to preview APIs
3. ✅ **Implementation complete:** Document protection working on standard Office 365
4. ✅ **No Office Insider required:** Works on Monthly Enterprise Channel
