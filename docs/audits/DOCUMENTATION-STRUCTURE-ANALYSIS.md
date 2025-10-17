# Documentation Structure Analysis
**Date:** October 17, 2025  
**Focus:** Identifying overlap and proposing clear organization

---

## Current Overlap Problems

### 1. Checkout/Check-in Documentation

**Three places with overlapping content:**

**`features/checkin-checkout.md` (145 lines)**
- Purpose: Feature design & implementation guide
- Contains: Goals, roles, API endpoints, state matrix mapping, client behavior, testing
- Audience: Developers implementing the feature

**`architecture/STATE-MACHINE.md`**
- Purpose: System-wide state rules
- Contains: Checkout ownership rules, permission matrix, state transitions
- Audience: Anyone understanding the system

**`architecture/APPLICATION-BEHAVIOR.md`**
- Purpose: End-to-end user workflows
- Contains: Step-by-step checkout workflow with examples
- Audience: Understanding user experience

**Overlap:**
```
checkin-checkout.md lines 11-14:
"If no checkout exists, eligible users can check out..."

STATE-MACHINE.md lines 15-23:
"Rule 1: Checkout Ownership
const isCheckedOut = !!serverState.checkedOutBy..."

APPLICATION-BEHAVIOR.md lines 120-145:
"Step 1: Checkout
User Action: Click [Checkout]..."
```

**All three describe the same checkout rules!**

---

### 2. Variables Documentation

**Two places with overlapping content:**

**`features/variables.md` (618 lines)**
- Purpose: Feature specification
- Contains: Architecture, SuperDoc integration, API, data model, cross-platform sync
- Audience: Implementing variables feature

**`architecture/APPLICATION-BEHAVIOR.md`**
- Purpose: User workflows
- Contains: "Create variable → Insert → Update" workflow (60 lines)
- Audience: Understanding how users interact with variables

**Overlap:**
- Both describe how to create variables
- Both describe insertion process
- Both describe cross-platform sync

---

### 3. Approvals Documentation

**Two places with overlapping content:**

**`features/approvals.md` (123 lines)**
- Purpose: Feature specification
- Contains: Data model, API, permissions, UX flows
- Audience: Implementing approvals

**`architecture/APPLICATION-BEHAVIOR.md`**
- Purpose: User workflows
- Contains: "View → Approve → Override → Request review" workflow (50 lines)
- Audience: Understanding approval process

**Overlap:**
- Both describe approval permissions
- Both describe override behavior
- Both describe request review flow

---

### 4. State Matrix Documentation

**Two docs covering similar ground:**

**`architecture/state-matrix.md` (OLD - marked superseded)**
- Purpose: Plain English explanation of state matrix
- Status: Outdated, partial information

**`architecture/STATE-MACHINE.md` (NEW)**
- Purpose: Complete state machine documentation
- Status: Production reference
- Contains: Everything from old doc + actual implementation

**Decision:** Archive `state-matrix.md` (already marked as superseded)

---

## The Core Question

**Where should developers look for information?**

### Scenario 1: "How does checkout work?"
**Current problem:** Three places to look!
- Feature spec for implementation details
- State machine for rules
- Application behavior for workflows

### Scenario 2: "I need to implement a new feature that checks permissions"
**Current problem:** Unclear where to start
- State machine doc has permission rules
- Feature docs have implementation patterns
- Which is authoritative?

### Scenario 3: "I'm debugging why a button isn't showing"
**Current problem:** Which doc has the button logic?
- State machine has `buttons: { checkoutBtn: ... }`
- Feature docs have UI descriptions
- Application behavior has "what user sees"

---

## Proposed Structure

### Three-Layer Documentation Architecture

```
Layer 1: SYSTEM ARCHITECTURE (How the system works)
└── Architecture rules, contracts, state machine
    - Single source of truth for system behavior
    - No feature-specific implementation details

Layer 2: FEATURE SPECIFICATIONS (How to build features)
└── Feature design, implementation, decisions
    - References architecture for rules
    - Contains implementation patterns
    - Design decisions and trade-offs

Layer 3: USER WORKFLOWS (How users experience it)
└── End-to-end scenarios, examples
    - References features and architecture
    - User-facing perspective
    - Cross-feature workflows
```

---

## Recommended Document Purposes

### Architecture Layer

**`architecture/STATE-MACHINE.md`** ✅ **KEEP AS-IS**
**Purpose:** Authoritative reference for state rules
**Contains:**
- State variables and data structures
- Permission rules (what roles can do what)
- Button visibility logic
- State transitions
- SSE events catalog
- Version management

**What it should NOT contain:**
- ❌ Feature implementation details
- ❌ Step-by-step user workflows
- ❌ UI mockups or designs

**Who uses it:**
- Developers implementing any feature that touches state
- Debugging permission issues
- Understanding cross-platform sync

---

**`architecture/SYSTEM-OVERVIEW.md`** 🔄 **UPDATE**
**Purpose:** High-level architecture overview
**Contains:**
- Three-layer architecture diagram
- Technology stack
- File structure
- API overview
- Data flow patterns

**What it should NOT contain:**
- ❌ Detailed state rules (reference STATE-MACHINE.md)
- ❌ Feature workflows (reference APPLICATION-BEHAVIOR.md)
- ❌ Implementation steps

**Who uses it:**
- New developers onboarding
- Understanding overall system design
- Architecture decisions

---

**`architecture/APPLICATION-BEHAVIOR.md`** 🔄 **REFACTOR**
**Current problem:** Too detailed, overlaps with feature specs

**Option A: Rename to `USER-WORKFLOWS.md` and slim down**
**Purpose:** Cross-feature user workflows only
**Contains:**
- Multi-step scenarios (checkout → edit → save → check-in)
- Cross-platform examples (Web user edits, Word user sees update)
- Integration workflows (variables + approvals)
- **NO feature-specific implementation details**

**Option B: Move to `docs/user-guide/` as end-user documentation**
**Purpose:** User-facing documentation
**Contains:**
- "How to" guides for users
- Screenshots and examples
- FAQ

**Recommendation: Option A** - Keep it as developer reference for understanding user experience

---

### Feature Specifications Layer

**`features/*.md`** ✅ **KEEP BUT CLARIFY PURPOSE**
**Purpose:** Feature design and implementation guide
**Contains:**
- Why this feature exists (goals, user stories)
- Design decisions and trade-offs
- Data models specific to this feature
- API endpoints for this feature
- Implementation notes
- Testing strategy
- **References** to STATE-MACHINE.md for permission rules

**What they should NOT contain:**
- ❌ System-wide state rules (reference STATE-MACHINE.md)
- ❌ Complete user workflows (reference USER-WORKFLOWS.md)
- ❌ Duplicate permission matrices

**Example structure for `features/checkin-checkout.md`:**
```markdown
# Check-in / Check-out Feature

**Status:** ✅ Implemented
**Test Coverage:** 4 tests (Phase 12)

## Purpose
Prevent write conflicts with single-writer locking.

## Design Decisions
- Server-side ownership (not client-side)
- SSE for real-time sync
- Override capability for editors

## Implementation
**Permissions:** See STATE-MACHINE.md for complete rules
**API Endpoints:**
- POST /api/v1/checkout
- POST /api/v1/checkin
- POST /api/v1/checkout/cancel
- POST /api/v1/checkout/override

**State Changes:** See STATE-MACHINE.md for transition rules

## Testing
See automated-testing-suite.md Phase 12

## Related Docs
- architecture/STATE-MACHINE.md - Permission rules
- architecture/USER-WORKFLOWS.md - User experience
```

---

### Operations Layer

**`operations/*.md`** ✅ **KEEP AS-IS**
**Purpose:** Operational guides and lessons learned
**Contains:**
- Installation instructions
- Deployment guides
- Troubleshooting
- Lessons learned from implementation

**No overlap with architecture or features**

---

## Clear Boundaries

### What Goes Where?

| Information Type | Goes In | Links To |
|------------------|---------|----------|
| **Permission rules** | STATE-MACHINE.md | Referenced by feature specs |
| **Button visibility logic** | STATE-MACHINE.md | Referenced by feature specs |
| **State transitions** | STATE-MACHINE.md | Referenced by feature specs |
| **SSE event definitions** | STATE-MACHINE.md | Referenced by feature specs |
| **Feature design rationale** | features/*.md | References STATE-MACHINE.md |
| **API endpoint implementation** | features/*.md | References STATE-MACHINE.md |
| **Data models** | features/*.md | References STATE-MACHINE.md |
| **User workflows** | USER-WORKFLOWS.md | References features & state machine |
| **Cross-platform examples** | USER-WORKFLOWS.md | References features |
| **Installation steps** | operations/installation.md | Standalone |
| **Troubleshooting** | operations/*.md | References architecture |

---

## Specific Recommendations

### 1. Refactor `APPLICATION-BEHAVIOR.md`

**Current:** 699 lines, 5,200 words - Too detailed!

**Proposed: Rename to `USER-WORKFLOWS.md` and trim to ~300 lines**

**Keep:**
- ✅ Startup sequences (concise, no details)
- ✅ Multi-step workflows (checkout → save → check-in)
- ✅ Cross-platform examples (web ↔ Word sync)
- ✅ Integration scenarios (variables + approvals)

**Remove (reference feature docs instead):**
- ❌ Detailed variables workflow (link to features/variables.md)
- ❌ Detailed approvals workflow (link to features/approvals.md)
- ❌ Detailed comments workflow (link to features/comments-sync.md)
- ❌ API signatures (link to STATE-MACHINE.md or feature docs)

**New structure:**
```markdown
# User Workflows

## Document Editing Flow
[High-level: checkout → edit → save → check-in]
See features/checkin-checkout.md for details

## Cross-Platform Sync
[Example: Web user saves, Word user sees update]
See STATE-MACHINE.md for sync rules

## Integration Workflows
### Variables + Approvals
[Scenario: Create variable, insert, then request approval]
```

---

### 2. Slim Down Feature Specs

**Current:** Feature specs duplicate state machine rules

**Proposed: Reference instead of duplicate**

**Example - `features/checkin-checkout.md` change:**
```diff
- ## Roles and permissions (prototype)
- - Editor: can check out, check in, cancel checkout, finalize/unfinalize.
- - Suggestor/Vendor: can check out and check in; document mode remains suggesting by default.
- - Viewer: view‑only.
+ ## Permissions
+ See architecture/STATE-MACHINE.md for complete permission matrix.
+ This feature respects role-based checkout/checkin permissions.

- ## State Matrix mapping (what the clients consume)
- [60 lines of state matrix details]
+ ## State Integration
+ See architecture/STATE-MACHINE.md for:
+ - Button visibility rules
+ - Primary layout modes
+ - State transitions
```

**Result:** Feature spec shrinks from 145 lines to ~80 lines

---

### 3. Add Cross-References

**Every doc should clearly state its scope and link to related docs**

**Example header format:**
```markdown
# Feature Name

**Status:** ✅ Implemented
**Test Coverage:** X tests
**Purpose:** One-sentence description

## Related Documentation
- architecture/STATE-MACHINE.md - Permission rules and state transitions
- architecture/USER-WORKFLOWS.md - How users interact with this feature
- operations/installation.md - Setup requirements

## Scope
This document covers feature design and implementation.
For system-wide rules, see STATE-MACHINE.md.
For user workflows, see USER-WORKFLOWS.md.
```

---

### 4. Archive Obsolete Docs

**Move to `docs/aiDocs/_archive/`:**
- ✅ `architecture/state-matrix.md` (superseded by STATE-MACHINE.md)
- ✅ 11 empty/obsolete files from audit

---

## Proposed Final Structure

```
docs/aiDocs/
├── 00-index.md [UPDATED with clear layer descriptions]
│
├── architecture/ [LAYER 1: System Rules]
│   ├── STATE-MACHINE.md ✅ Authoritative state rules
│   ├── SYSTEM-OVERVIEW.md 🔄 High-level architecture
│   └── USER-WORKFLOWS.md 🔄 Renamed from APPLICATION-BEHAVIOR.md, slimmed down
│
├── features/ [LAYER 2: Feature Specs]
│   ├── checkin-checkout.md 🔄 Slimmed, references architecture
│   ├── variables.md 🔄 Slimmed, references architecture
│   ├── approvals.md 🔄 Slimmed, references architecture
│   ├── comments-sync.md ✅ Already good
│   ├── automated-testing-suite.md ✅ Already excellent
│   └── [35 more feature specs, updated with references]
│
├── operations/ [LAYER 3: Ops Guides]
│   ├── installation.md ✅ Keep as-is
│   ├── comments-sync-lessons-learned.md ✅ Keep as-is
│   └── addin-loading-lessons-learned.md ✅ Keep as-is
│
├── platform/ [Technical Platform Details]
│   ├── react-configuration.md [TODO: Create]
│   └── word-addin.md [TODO: Create]
│
└── _archive/ [Obsolete Docs]
    ├── state-matrix.md [Superseded]
    └── [11 empty/obsolete files]
```

---

## Implementation Plan

### Phase 1: Quick Fixes (30 min)
1. ✅ Rename `APPLICATION-BEHAVIOR.md` → `USER-WORKFLOWS.md`
2. ✅ Archive `state-matrix.md`
3. ✅ Update index with layer descriptions

### Phase 2: Refactoring (2-3 hours)
1. Slim down `USER-WORKFLOWS.md` (699 → ~300 lines)
   - Keep high-level workflows
   - Remove detailed feature implementations
   - Add references to feature docs

2. Update feature specs (8 key docs)
   - Add status headers
   - Remove duplicate state rules
   - Add cross-references
   - Keep implementation details

3. Update index with clear "What goes where"

### Phase 3: Validation (1 hour)
1. Review all cross-references work
2. Check for broken links
3. Verify no critical information lost
4. Test navigation flow

---

## Success Criteria

✅ **No Duplicate Information**
- State rules only in STATE-MACHINE.md
- Feature details only in feature specs
- User workflows only in USER-WORKFLOWS.md

✅ **Clear Navigation**
- Developer knows where to look for any question
- Every doc clearly states its scope
- Cross-references guide between docs

✅ **Easy Maintenance**
- Update state rules in one place
- Feature changes update one doc
- No sync issues between docs

✅ **Serves All Audiences**
- New developers: Start with SYSTEM-OVERVIEW.md
- Feature implementers: Go to features/*.md
- Debugging: Check STATE-MACHINE.md
- Understanding UX: Read USER-WORKFLOWS.md

---

## Key Insight

**The problem isn't having multiple docs - it's having unclear boundaries.**

**Solution:** Each doc should have ONE clear purpose and reference others for related information.

---

## Questions to Resolve

1. **Should USER-WORKFLOWS.md be developer-facing or user-facing?**
   - Developer-facing: Understanding user experience to build features
   - User-facing: End-user guide with screenshots
   - **Recommendation:** Developer-facing (understanding UX, not teaching users)

2. **Should STATE-MACHINE.md include any examples?**
   - Current: Has 3 scenario walkthroughs
   - Alternative: Move all examples to USER-WORKFLOWS.md
   - **Recommendation:** Keep minimal examples in STATE-MACHINE.md for clarity

3. **Should feature specs include API signatures?**
   - Current: Each feature spec repeats API endpoint details
   - Alternative: Central API reference doc
   - **Recommendation:** Keep in feature specs (easier to maintain with feature)

---

**Next Step:** Get your feedback on this structure, then execute Phase 1 refactoring.

