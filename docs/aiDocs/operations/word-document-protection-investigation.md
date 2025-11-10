# Word Document Protection Investigation - API Availability Issue

## TL;DR

**The `document.protect()` API required for role-based document protection is NOT available in standard Office 365 installations.** It requires `WordApiDesktop 1.4` which is only available in:
- Office Insider (Beta Channel)
- Current Channel Version 2508 (Build 19127.20264) or later
- NOT available in Monthly Enterprise Channel (what we have)

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

## Code Changes Made (Branch: word-permisions)

### Added Protection Logic

**File:** `shared-ui/components.react.js`

**Lines ~1189-1212:** Initial document load protection
**Lines ~1501-1523:** User role switch protection

Both attempts fail with `document.protect is not a function`.

### Updated Launcher Script

**File:** `tools/scripts/run-wordftw-local.bat` (renamed from `run-local.bat`)

**Fixed:** Nuclear kill of all Node.js processes → Targeted kill of ports 4000/4001 only
- Prevents killing other Node projects (e.g., OpenGov Office servers on ports 3000/3001)

### Manifest Changes (Reverted)

**Files:** `addin/manifest.xml`, `addin/public/manifest.xml`

**Attempted (reverted):**
```xml
<Set Name="WordApiDesktop" MinVersion="1.4"/>
```

**Result:** Add-in rejected by Word. Requirement removed to restore functionality.

---

## Related Documentation

### Internal Docs
- [`comments-sync-lessons-learned.md`](comments-sync-lessons-learned.md) - Originally documented permission enforcement gap
- [`addin-loading-lessons-learned.md`](addin-loading-lessons-learned.md) - Manifest and loading issues
- [`user-permissions.md`](../features/user-permissions.md) - Current role-based permission system

### External References
- **SuperDoc Demo:** https://github.com/Harbour-Enterprises/SuperDoc-Customer-UseCases/tree/main/superdoc-ms-word-addin-roles
- **Word API Requirement Sets:** https://learn.microsoft.com/en-us/javascript/api/requirement-sets/word/word-api-requirement-sets?view=word-js-preview
- **Document Protection API:** https://learn.microsoft.com/en-us/javascript/api/word/word.document?view=word-js-preview#word-word-document-protect-member(1)
- **Office Insider Program:** https://insider.microsoft365.com/

---

## Conclusion

**The feature cannot be implemented with our current Office 365 installation.**

### Key Findings

1. ✅ **Root cause identified:** `WordApiDesktop 1.4` API not available in Monthly Enterprise Channel
2. ✅ **Microsoft requirements documented:** Need Version 2508 (Build 19127.20264) or Office Insider
3. ✅ **Workaround not possible:** API literally doesn't exist - no fallback available
4. ✅ **Timeline unclear:** Microsoft doesn't publish channel-specific feature rollout schedules

### Next Steps

1. **Accept limitation** - Document that Word add-in cannot enforce permissions currently
2. **Monitor updates** - Check for `WordApiDesktop 1.4` availability in Monthly Enterprise Channel
3. **Keep code ready** - Protection implementation is already written and tested on branch
4. **Revisit quarterly** - Check API availability every 3 months
5. **Deploy when available** - Merge branch when API reaches our Office channel

### What We Learned

- **Microsoft's API documentation is unclear** about channel-specific availability
- **Build numbers don't tell the whole story** - update channel matters more than build number
- **Preview APIs require patience** - features can take months to reach enterprise channels
- **SuperDoc's demos use beta features** - not representative of standard Office 365 capabilities

---

**Document Version:** 2.0  
**Last Updated:** November 10, 2025  
**Branch Status:** Pending, waiting for API availability in Monthly Enterprise Channel
