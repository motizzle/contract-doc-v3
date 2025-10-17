# UI & System Docs (aiDocs) — Index

**Last Updated:** October 17, 2025

Status legend: [✅ Implemented] [📋 Planned] [🔄 Needs Update] [📝 Draft] [🗄️ Archived]

---

## Documentation Layers

### 🏗️ Layer 1: Architecture (System Rules & Behavior)
> **Authoritative references for how the system works**

- **architecture/state-machine.md** [✅ **AUTHORITATIVE** - Single Source of Truth]
  - **THE** state machine specification (supersedes all old "state-matrix" docs)
  - State variables, permission rules, button logic
  - State transitions, SSE events, version management
  - **Start here** for debugging permissions or state issues

- **architecture/css-architecture.md** [✅ Production Reference]
  - Server-driven CSS architecture principles
  - Web platform layout rules
  - SuperDoc responsive toolbar integration
  - **Start here** for styling and layout changes

- **architecture/user-workflows.md** [✅ Production Reference]
  - Cross-feature user workflows and integration scenarios
  - Cross-platform synchronization examples
  - **Start here** for understanding user experience

- **architecture/system-overview.md** [🔄 Needs Update]
  - High-level architecture, tech stack, file structure
  - **Start here** for onboarding new developers

---

### 🎯 Layer 2: Feature Specifications (Design & Implementation)
> **Feature-specific design, APIs, and implementation details**

#### ✅ Implemented Features
- **features/automated-testing-suite.md** [✅ Implemented - 79 tests]
- **features/comments-sync.md** [✅ Implemented]
- **features/variables.md** [✅ Implemented]
- **features/ai-system-prompt-editor.md** [✅ Implemented]
- **features/checkin-checkout.md** [✅ Implemented]
- **features/approvals.md** [✅ Implemented]
- **features/versions.md** [✅ Implemented]
- **features/compile.md** [✅ Implemented]

#### 📋 Planned Features
- **features/conditional-sections.md** [📋 Planned - Research Complete]
- **features/activity-enhancements.md** [📋 Planned]
- **features/approval-celebration-easter-egg.md** [📋 Planned]

#### 📝 Draft Features
- features/document-initialization.md [📝 Draft]
- features/back-to-open-gov.md [📝 Draft]
- features/send-to-vendor.md [📝 Draft]
- features/view-latest.md [📝 Draft]
- features/user-permissions.md [📝 Draft]

---

### 🔧 Layer 3: Platform & Operations
> **Technical setup, deployment, and lessons learned**

#### Platform
- platform/react-configuration.md [📝 Draft]
- platform/word-addin.md [📝 Draft]

#### Operations
- **operations/installation.md** [✅ Implemented]
- **operations/test-mode-fix.md** [✅ Implemented - Browser freeze fix]
- **operations/comments-sync-lessons-learned.md** [✅ Implemented]
- **operations/addin-loading-lessons-learned.md** [✅ Implemented]
- operations/docker-notes.md [📝 Draft]

#### UI
- ui/branding.md [📝 Draft]
- ui/css-spec.md [📝 Draft]

---

### 📚 Meta & Planning
- roadmap/implementation-plan.md [📝 Draft]
- meta/conventions.md [📝 Draft]

---

## Quick Navigation

### I want to...
- **Understand permissions** → `architecture/STATE-MACHINE.md`
- **Understand user workflows** → `architecture/USER-WORKFLOWS.md`
- **Implement a feature** → `features/{feature-name}.md`
- **Debug state issues** → `architecture/STATE-MACHINE.md`
- **Set up the project** → `operations/installation.md`
- **Learn the architecture** → `architecture/system-overview.md`
- **See what's tested** → `features/automated-testing-suite.md`

### I'm working on...
- **Checkout/Check-in** → `features/checkin-checkout.md` + `STATE-MACHINE.md`
- **Variables** → `features/variables.md` + `USER-WORKFLOWS.md`
- **Approvals** → `features/approvals.md` + `USER-WORKFLOWS.md`
- **Comments** → `features/comments-sync.md` + `operations/comments-sync-lessons-learned.md`
- **Testing** → `features/automated-testing-suite.md`

---

## Documentation Principles

### 1. Single Source of Truth
- **State rules** → Only in `STATE-MACHINE.md`
- **Permission logic** → Only in `STATE-MACHINE.md`
- **Feature design** → Only in `features/*.md`
- **User workflows** → Only in `USER-WORKFLOWS.md`

### 2. Cross-References, Don't Duplicate
Feature specs should **reference** `STATE-MACHINE.md` for permission rules, not duplicate them.

### 3. Clear Scope
Every doc should state:
- What it covers
- What it doesn't cover
- Links to related docs

---

## Test Coverage Summary

**Total: 79 tests (64 Jest + 15 Playwright)**

- Phase 1: Infrastructure (3 tests)
- Phase 2: State Management (6 tests)
- Phase 3: API Integrity (10 tests)
- Phase 4: Data Validation (5 tests)
- Phase 5: Cross-Platform Sync (5 tests)
- Phase 6: UI Critical Paths (8 tests)
- Phase 7: Comments Feature (7 tests)
- Phase 8: Approvals Flow (6 tests)
- Phase 9: Document Lifecycle (8 tests)
- Phase 10: Variables CRUD (5 tests)
- Phase 11: Status Management (4 tests)
- Phase 12: Checkout Operations (4 tests)
- Phase 13: Exhibits & Compilation (4 tests)
- Phase 14: Messages & Notifications (4 tests)

---

## Archived Documentation

Moved to `docs/aiDocs/_archive/`:
- state-matrix.md [🗄️ Superseded by STATE-MACHINE.md]
- (11 empty/obsolete files)

---

**Note:** This documentation is actively maintained. Last audit: October 17, 2025.
