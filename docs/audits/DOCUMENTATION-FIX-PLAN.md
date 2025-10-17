# Documentation Fix Plan
**Based on:** Audit Report 2025-10-17  
**Estimated Time:** 2-3 hours total

---

## Quick Actions (30 minutes)

### 1. Update Index Status Tags
**File:** `docs/aiDocs/00-index.md`

**Changes:**
```diff
  - Features
-   - features/automated-testing-suite.md [Planned]
+   - features/automated-testing-suite.md [✅ Implemented]
    
-   - features/approvals.md [Draft]
+   - features/approvals.md [✅ Implemented]
    
-   - features/variables.md [Draft]
+   - features/variables.md [✅ Implemented]
    
+   - features/versions.md [✅ Implemented]
+   - features/compile.md [✅ Implemented]
+   - features/checkin-checkout.md [✅ Implemented]
+   - features/ai-system-prompt-editor.md [✅ Implemented]
    
+   - features/conditional-sections.md [📋 Planned - Research Complete]
+   - features/activity-enhancements.md [📋 Planned]
```

---

### 2. Archive Empty/Obsolete Files
**Action:** Move to `docs/aiDocs/_archive/` or delete

**Files to Archive:**
```bash
# Empty files
docs/aiDocs/features/add user.md
docs/aiDocs/features/ads-for-word.md
docs/aiDocs/features/OG-styling.md
docs/aiDocs/features/approval-enhancements.md
docs/aiDocs/features/jokes.md

# Personal notes (not docs)
docs/aiDocs/features/backlog.md
docs/aiDocs/features/incrementals.md

# Superseded/obsolete
docs/aiDocs/features/back-to-og.md
docs/aiDocs/features/view-latest-draft.md

# Old implementation notes
docs/aiDocs/features/consolidate-ui-pieces.md

# Incomplete drafts
docs/aiDocs/features/annotation.md
```

**Command:**
```powershell
# Create archive directory
New-Item -ItemType Directory -Force -Path "docs\aiDocs\_archive"

# Move files
Move-Item "docs\aiDocs\features\add user.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\ads-for-word.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\OG-styling.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\approval-enhancements.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\jokes.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\backlog.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\incrementals.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\back-to-og.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\view-latest-draft.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\consolidate-ui-pieces.md" "docs\aiDocs\_archive\"
Move-Item "docs\aiDocs\features\annotation.md" "docs\aiDocs\_archive\"
```

---

## Medium Priority (1 hour)

### 3. Add Implementation Status Headers

**Files to update:**

#### `docs/aiDocs/features/checkin-checkout.md`
Add at top:
```markdown
# Check-in / Check-out

**Status:** ✅ Implemented  
**Test Coverage:** 4 tests (Phase 12)  
**Last Updated:** August 2024

---
```

#### `docs/aiDocs/features/approvals.md`
Add at top:
```markdown
# Feature: Approvals (Simple Model)

**Status:** ✅ Implemented  
**Test Coverage:** 6 tests (Phase 8)  
**Last Updated:** August 2024

---
```

#### `docs/aiDocs/features/variables.md`
Add at top:
```markdown
# Variables

**Status:** ✅ Implemented  
**Test Coverage:** 5 tests (Phase 10)  
**Last Updated:** August 2024

---
```

#### `docs/aiDocs/features/versions.md`
Add at top:
```markdown
# Versions

**Status:** ✅ Implemented  
**Test Coverage:** 8 tests (Phase 9)  
**Last Updated:** August 2024

---
```

#### `docs/aiDocs/features/compile.md`
Add at top:
```markdown
# Compile Packet (PDF)

**Status:** ✅ Implemented  
**Test Coverage:** 4 tests (Phase 13)  
**Last Updated:** August 2024

---
```

#### `docs/aiDocs/features/ai-system-prompt-editor.md`
Add at top:
```markdown
# AI System Prompt Editor

**Status:** ✅ Implemented  
**Test Coverage:** Manual testing  
**Last Updated:** September 2024

---
```

#### `docs/aiDocs/features/conditional-sections.md`
Add after Overview:
```markdown
---

## Implementation Status

**Research:** ✅ Complete (October 2025)
- Confirmed SuperDoc sections persist ✅
- Unified API for web + Word add-in ✅
- Architecture finalized ✅

**Implementation:** ❌ Not started
- [ ] Questions system (Phase 1)
- [ ] Sections management (Phase 2)
- [ ] Auto-insert/delete (Phase 3)
- [ ] UI polish (Phase 4)

---
```

---

## Low Priority (1 hour)

### 4. Update Architecture Docs

**File:** `docs/aiDocs/architecture/system-overview.md`

**Critical fixes:**
```diff
- clients/addin-yo/
+ addin/

- clients/web/
+ web/

- clients/shared/
+ shared-ui/
```

**Add new sections:**
- Automated testing (79 tests)
- Comments/track changes
- Variables system
- AI chat
- Activity logging

---

### 5. Consolidate Duplicate Docs

**Review and merge:**

1. **Variables:**
   - Keep: `variables.md` (main doc)
   - Archive: `variables-v2.md`, `variables-phase1-testing.md`

2. **Compile:**
   - Keep: `compile.md` (final spec)
   - Archive: `compile-draft.md`

3. **Approvals:**
   - Keep: `approvals.md`
   - Archive: `workflow-approvals-update.md` (if duplicate)

---

## Verification Checklist

After completing fixes:

- [ ] Index statuses match reality
- [ ] All implemented features marked ✅
- [ ] Empty files archived
- [ ] Duplicate docs consolidated
- [ ] Test coverage documented
- [ ] Implementation dates added

---

## Notes

- Don't update file content yet (Phase 2)
- Focus on status accuracy first
- Archive rather than delete (can restore if needed)
- Leave detailed content updates for later

---

**Total Time:** 2-3 hours  
**Priority:** High (improves discoverability)

