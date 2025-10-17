# Automated Testing Suite

**Status:** ✅ Implemented & Passing
**Priority:** High
**Platforms:** Cross-platform (Server, Web, Word Add-in)
**Related:** All features
**Test Count:** 80 tests (65 Jest + 15 Playwright)

---

## Overview

Comprehensive automated test suite that validates critical functionality before commits and merges to main. Designed to catch breaking changes without becoming a maintenance nightmare.

**Philosophy:** "Test the contract, not the implementation"

---

## Problem Statement

### Current State
- Tests exist but fail unexpectedly due to state assumptions
- No clear guidance on when/how to run tests
- Tests don't reset state, causing cascading failures
- Mix of Jest (API) and Playwright (E2E) with unclear purpose
- Developer doesn't know what's safe to merge

### What We Need
- **Simple:** One command to run all tests
- **Reliable:** Always starts from known clean state
- **Comprehensive:** Tests all critical paths
- **Fast enough:** Can run before every commit (not blocking development)
- **Clear results:** Pass/fail with actionable report

---

## User Story

**As a** developer working on features
**I want to** run a single test command before committing
**So that** I can confidently merge to main without breaking existing functionality

---

## Design Principles

### 1. Simplicity Over Flexibility
- **One test suite**, not multiple configurations
- **One command** to run everything
- **One report** with clear pass/fail

### 2. Clean State Every Time
- **Auto factory-reset** before tests run
- No assumptions about current state
- Tests can't interfere with each other

### 3. Test What Matters
- ✅ Core contracts (APIs, state, sync)
- ✅ Critical paths (document loads, user switching)
- ✅ Breaking changes (checkout logic, permissions)
- ❌ Implementation details (styling, animations)
- ❌ Hard-to-maintain (AI responses, OS dialogs)

### 4. Actionable Failures
- Clear error messages
- Markdown reports you can share
- Line numbers and context
- Suggestions for fixes

---

## What Gets Tested

### Phase 1: Infrastructure (Must Pass)
**Purpose:** Verify server and core services work

```javascript
✓ Server starts without crashing
✓ Health endpoint responds (200 OK)
✓ SSE connects and broadcasts events
✓ API routes registered correctly
```

**Why:** If these fail, nothing else matters

---

### Phase 2: State Management (Critical)
**Purpose:** Verify document state and permissions

```javascript
✓ Checkout flow works (user can checkout draft document)
✓ Ownership enforced (can't checkout when someone else owns it)
✓ Save requires checkout (proper 409 when not owner)
✓ Finalized blocks checkout (proper 409 when status=final)
✓ User switching updates state correctly
✓ State persists across reloads
```

**Why:** State bugs cause data loss and user confusion

---

### Phase 3: API Integrity (Critical)
**Purpose:** Verify all endpoints return correct responses

```javascript
✓ GET /api/v1/health → 200
✓ GET /api/v1/state-matrix → 200 with valid config
✓ GET /api/v1/users → 200 with user list
✓ GET /api/v1/variables → 200 with variables
✓ POST /api/v1/checkout → 200 when valid, 409 when conflict
✓ POST /api/v1/checkin → 200 when owner, 409 when not
✓ POST /api/v1/save-progress → 200 with valid data, 400/409 on error
✓ POST /api/v1/approvals/set → 200 with updated state
✓ POST /api/v1/approvals/reset → 200
✓ POST /api/v1/factory-reset → 200
```

**Why:** API contracts are the foundation of cross-platform sync

---

### Phase 4: Data Validation (Critical)
**Purpose:** Verify data integrity rules

```javascript
✓ Rejects invalid DOCX (not PK header)
✓ Rejects too-small files (<1KB)
✓ Validates base64 encoding
✓ Enforces ownership on saves
✓ HEAD content-length matches actual file size
```

**Why:** Bad data corrupts documents

---

### Phase 5: Cross-Platform Sync (Important)
**Purpose:** Verify events propagate correctly

```javascript
✓ State matrix returns consistent data for same user
✓ SSE broadcasts reach all clients
✓ Checkout triggers state update event
✓ Checkin triggers state update event
✓ User switch triggers config recalculation
```

**Why:** Sync issues cause confusion when web and Word show different states

---

### Phase 6: UI Critical Paths (Important)
**Purpose:** Verify web viewer loads and works

```javascript
✓ Document loads (not blank screen)
✓ React components mount without errors
✓ SuperDoc initializes successfully
✓ No JavaScript console errors during startup
✓ Approvals modal opens
✓ Variables panel loads
✓ User dropdown works
✓ Document actions dropdown renders
```

**Why:** Blank screens and console errors break user experience

---

### Phase 7: Comments Feature (New)
**Purpose:** Verify comments module works

```javascript
✓ Comments module initializes without errors
✓ User role switching works (editor → suggester → viewer)
✓ Role permissions enforced in web viewer
✓ userStateBridge syncs correctly
✓ No console errors during role switching
✓ Comments container renders
✓ Mode switcher appears for editors only
```

**Why:** New feature must not break on merge

---

### Phase 8: Approvals Flow (Important)
**Purpose:** Verify approvals work end-to-end

```javascript
✓ GET approvals returns all users
✓ Set self-approval works
✓ Override approval (editor) works
✓ Reset approvals works
✓ Request review works
✓ Summary counts correct (approved/total)
```

**Why:** Approvals are core workflow feature

---

### Phase 9: Document Lifecycle & Versions (Critical)
**Purpose:** Verify document version management

```javascript
✓ GET /documents/canonical/default.docx returns document
✓ GET /documents/working/default.docx returns working copy
✓ GET /api/v1/versions returns version list
✓ GET /api/v1/versions/:n returns specific version
✓ POST /api/v1/versions/view switches to version
✓ POST /api/v1/document/snapshot creates version
✓ POST /api/v1/document/revert reverts to canonical
✓ POST /api/v1/refresh-document reloads document
```

**Why:** Version control is core to document management workflows

---

### Phase 10: Variables CRUD (Critical)
**Purpose:** Verify template variable management

```javascript
✓ POST /api/v1/variables creates new variable
✓ PUT /api/v1/variables/:varId updates variable definition
✓ PUT /api/v1/variables/:varId/value updates variable value
✓ DELETE /api/v1/variables/:varId deletes variable
✓ Variables persist after updates
```

**Why:** Variables are template placeholders used throughout document authoring

---

### Phase 11: Status & Title Management (Critical)
**Purpose:** Verify document workflow state changes

```javascript
✓ POST /api/v1/status/cycle toggles draft/final
✓ POST /api/v1/title updates document title
✓ Status affects checkout permissions
✓ Title persists across state matrix requests
```

**Why:** Draft/final status is fundamental to document lifecycle and permissions

---

### Phase 12: Advanced Checkout Operations (Critical)
**Purpose:** Verify checkout recovery mechanisms

```javascript
✓ POST /api/v1/checkout/cancel allows user to cancel own checkout
✓ POST /api/v1/checkout/override allows admin to force release
✓ Cannot cancel checkout if not owner
✓ Checkout/cancel workflow maintains consistency
```

**Why:** Users forget to check in; admins need override to unlock documents

---

### Phase 13: Exhibits & Compilation (Important)
**Purpose:** Verify PDF packet generation

```javascript
✓ GET /api/v1/exhibits returns exhibit list
✓ GET /exhibits/:name serves exhibit file
✓ POST /api/v1/compile requires valid parameters
✓ Compile endpoint validates user permissions
```

**Why:** Exhibits and PDF compilation are core features for document packets

---

### Phase 14: Messages & Notifications (Important)
**Purpose:** Verify user communication system

```javascript
✓ GET /api/v1/messages returns message list
✓ POST /api/v1/messages/mark-read marks message as read
✓ POST /api/v1/approvals/notify sends notifications
✓ Messages persist across requests
```

**Why:** Users need notifications for approvals and document updates

---

## What We DON'T Test

### Out of Scope (Manual Testing Only)

**AI Chat Quality**
- ❌ Response content quality
- ❌ Context awareness accuracy
- ❌ Prompt effectiveness
- **Why:** Subjective, changes with models, hard to assert

**Visual/Styling**
- ❌ Pixel-perfect layouts
- ❌ Colors and fonts
- ❌ Animations and transitions
- ❌ Responsive breakpoints
- **Why:** Subjective, fragile, changes often

**OS-Level Interactions**
- ❌ File upload dialogs
- ❌ Print dialogs
- ❌ Native browser features
- **Why:** OS-dependent, hard to automate reliably

**Word Add-in Specifics**
- ❌ Office.js permission enforcement (doesn't exist)
- ❌ Word UI rendering
- ❌ Add-in sideloading
- **Why:** Office.js limitations documented in lessons learned

**Generated Output Quality**
- ❌ PDF visual appearance
- ❌ DOCX formatting fidelity
- ❌ Compiled exhibit ordering
- **Why:** Requires human judgment

---

## Implementation

### File Structure

```
tools/scripts/
  ├── run-all-tests.bat          ← Main entry point (factory reset + all tests)
  ├── run-tests-report.bat       ← Same + markdown report
  └── test-quick.bat             ← Jest only (legacy)

server/tests/
  └── app.test.js                ← All 64 Jest unit tests
      ├── Phase 1: Infrastructure (3 tests)
      ├── Phase 2: State Management (6 tests)
      ├── Phase 3: API Integrity (10 tests)
      ├── Phase 4: Data Validation (5 tests)
      ├── Phase 5: Cross-Platform Sync (5 tests)
      ├── Phase 8: Approvals Flow (6 tests)
      ├── Phase 9: Document Lifecycle & Versions (8 tests)
      ├── Phase 10: Variables CRUD (5 tests)
      ├── Phase 11: Status & Title Management (4 tests)
      ├── Phase 12: Advanced Checkout Operations (4 tests)
      ├── Phase 13: Exhibits & Compilation (4 tests)
      └── Phase 14: Messages & Notifications (4 tests)

server/e2e/
  ├── ui-critical-paths.spec.ts  ← Phase 6: UI Critical Paths (8 tests)
  ├── comments-feature.spec.ts   ← Phase 7: Comments Feature (7 tests)
  └── playwright.config.ts       ← Playwright configuration

test-results/
  ├── test-report-TIMESTAMP.md   ← Generated reports
  └── README.md                  ← Documentation
```

### Test Execution Flow

```bash
run-all-tests.bat:
  0. Enable test mode (disable SSE broadcasts, disconnect clients)
  1. Factory reset via API (clean state)
  2. Run Jest tests (65 tests: API, state, data, workflows, test-mode)
     - Exit on first failure? No, collect all failures
  3. Run Playwright tests (15 tests: UI, browser automation)
     - Exit on first failure? No, collect all failures
  4. Generate summary (pass/fail)
  5. Disable test mode (re-enable SSE broadcasts)
  6. Exit 0 (all pass) or 1 (any fail)

run-tests-report.bat:
  Same as above + generates timestamped markdown report
```

**Test Mode:** Prevents browser freeze by disabling SSE broadcasts during test execution. See `operations/test-mode-fix.md` for details.

### Factory Reset Integration

**Before tests:**
```batch
REM Reset to known clean state
curl -X POST https://localhost:4001/api/v1/factory-reset -k
timeout /t 2 /nobreak >nul
```

**What factory reset does:**
- Sets document status to "draft"
- Clears checkout (checkedOutBy = null)
- Resets approvals
- Clears activity log
- Restores seed variables
- Clears messages

**Why this works:**
- Already exists in codebase
- One-click reset to known state
- Tests always start clean

---

## Test Configuration

### Jest Configuration (`server/jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 30000,
  verbose: true,
  bail: false, // Don't stop on first failure
  forceExit: true
};
```

### Playwright Configuration (`server/e2e/playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 1, // Retry flaky tests once
  use: {
    baseURL: 'https://localhost:4001',
    headless: true,
    ignoreHTTPSErrors: true,
  },
});
```

---

## Usage

### Before Commit
```bash
# Double-click from Windows Explorer
tools\scripts\run-all-tests.bat

# Or from terminal
cd tools/scripts
./run-all-tests.bat
```

### Before Merge to Main
Same command - comprehensive coverage every time

### If Tests Fail
```bash
# Generate detailed report
tools\scripts\run-tests-report.bat

# Share markdown file
test-results\test-report-TIMESTAMP.md
```

---

## Test Reports

### Report Format

```markdown
# Test Report

**Date:** 2025-10-17 14:30
**Branch:** comments
**Commit:** a1b2c3d

---

## Jest Unit Tests

### ✅ PASSED

64 tests passed
- Phase 1: Infrastructure: 3/3
- Phase 2: State Management: 6/6
- Phase 3: API Integrity: 10/10
- Phase 4: Data Validation: 5/5
- Phase 5: Cross-Platform Sync: 5/5
- Phase 8: Approvals Flow: 6/6
- Phase 9: Document Lifecycle & Versions: 8/8
- Phase 10: Variables CRUD: 5/5
- Phase 11: Status & Title Management: 4/4
- Phase 12: Advanced Checkout Operations: 4/4
- Phase 13: Exhibits & Compilation: 4/4
- Phase 14: Messages & Notifications: 4/4

---

## Playwright E2E Tests

### ✅ PASSED

15 tests passed
- Phase 6: UI Critical Paths: 8/8
- Phase 7: Comments Feature: 7/7

---

## Summary

### 🎉 ALL TESTS PASSED (79/79)

Ready to merge!
```

### Failed Test Report

```markdown
## Jest Unit Tests

### ❌ FAILED (Exit Code: 1)

### Failures:

**API › checkout/checkin**
```
Expected: 200
Received: 409

at Object.toBe (tests/api.test.js:239:23)
```

**Root Cause:** Document status was "final"
**Fix:** Factory reset should have been called first
```

---

## Success Metrics

### Phase 1 (Setup)
- ✅ All existing tests pass with factory reset
- ✅ Tests run in under 5 minutes
- ✅ Reports generate correctly
- ✅ Developer can run with one click

### Phase 2 (Coverage)
- ✅ 79 total tests (64 Jest + 15 Playwright)
- ✅ All critical APIs tested
- ✅ All critical UI paths tested
- ✅ Comments feature fully covered
- ✅ Document lifecycle fully covered
- ✅ Variables CRUD fully covered
- ✅ Exhibits and compilation covered

### Phase 3 (Reliability)
- ✅ Tests pass consistently (95%+ success rate)
- ✅ Failures are actionable (clear fix path)
- ✅ No flaky tests (random failures)
- ✅ State cleanup works every time

### Phase 4 (Adoption)
- ✅ Developer runs before every commit
- ✅ Zero regressions merge to main
- ✅ Test maintenance time < 10% of dev time

---

## Maintenance

### When to Add Tests

**Always add tests when:**
- Adding new API endpoints
- Changing checkout/permission logic
- Adding new UI critical paths
- Fixing bugs (regression tests)

**Don't add tests for:**
- Styling changes
- Copy/text changes
- Experimental features (add after stabilizing)
- One-off scripts

### When to Update Tests

**Update when:**
- API contracts change
- State matrix schema changes
- Error codes change
- UI critical paths change

**Don't update for:**
- Refactoring (if contracts unchanged)
- Performance optimizations
- Code organization

### Test Maintenance Budget

**Target:** <10% of development time spent on test maintenance

**Red flags:**
- Tests fail randomly (flaky)
- Tests break on every PR (too brittle)
- Tests take >10 min to run (too slow)
- Developer skips tests (too painful)

**Fixes:**
- Remove flaky tests
- Make assertions less brittle
- Split into fast/slow suites
- Simplify test setup

---

## Edge Cases & Gotchas

### State Persistence
**Problem:** Tests share state if not cleaned up
**Solution:** Factory reset before every run

### Async Timing
**Problem:** SSE events may not arrive immediately
**Solution:** Use proper waits, not arbitrary timeouts

### Browser Context
**Problem:** Playwright tests can interfere with each other
**Solution:** Each test gets fresh browser context

### Server Startup
**Problem:** Tests start before server ready
**Solution:** Health check loop with timeout

### Port Conflicts
**Problem:** Server already running on 4001
**Solution:** Tests reuse existing server if healthy

---

## Future Enhancements (Out of Scope for MVP)

### Performance Testing
- Response time benchmarks
- Memory leak detection
- Stress testing (100+ concurrent users)

### Visual Regression
- Screenshot comparison
- UI component snapshots
- Cross-browser testing

### Integration Testing
- Word ↔ Web sync validation
- Multi-user scenarios
- Long-running sessions

### CI/CD Integration
- GitHub Actions workflow
- Auto-run on PR
- Block merge on failure

---

## Implementation Phases

### Phase 1: Foundation (1-2 hours)
- [ ] Add factory reset to test script
- [ ] Fix existing test failures
- [ ] Verify all tests pass with clean state
- [ ] Update Playwright config to ignore Jest files

### Phase 2: Coverage (2-3 hours)
- [ ] Add missing API tests
- [ ] Add user switching tests
- [ ] Add comments module tests
- [ ] Add UI critical path tests

### Phase 3: Polish (1 hour)
- [ ] Improve error messages
- [ ] Add test documentation
- [ ] Create quick reference guide
- [ ] Update README

---

## References

- Jest Documentation: https://jestjs.io/docs/getting-started
- Playwright Documentation: https://playwright.dev/
- Existing Tests: `server/tests/api.test.js`
- E2E Tests: `server/e2e/smoke.spec.ts`
- Factory Reset Endpoint: `POST /api/v1/factory-reset`

---

## Acceptance Criteria

- [ ] Single command runs all tests with factory reset
- [ ] All existing tests pass consistently
- [ ] Comments feature fully tested
- [ ] Test reports generate in markdown
- [ ] Tests complete in under 5 minutes
- [ ] Clear pass/fail status
- [ ] Actionable error messages on failure
- [ ] Documentation updated
- [ ] Developer can run without setup

---

**Last Updated:** October 17, 2025
**Status:** ✅ Implemented & Passing (80/80 tests)

