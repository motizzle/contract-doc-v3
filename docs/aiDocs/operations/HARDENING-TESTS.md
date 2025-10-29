# WordFTW Prototype Hardening Tests

**Purpose:** Automated tests that click every button, check every API call, and verify no console errors.

**Time:** ~5 minutes (automated)

---

## Test Coverage Summary

### ✅ Already Automated (17 tests)

**Document Operations:**
- Factory reset
- Save progress
- Take snapshot (create versions)

**Version Management:**
- View previous versions
- Share version with vendor
- Vendor sees shared versions
- Vendor saves (auto-shares)
- Unshare removes access
- Vendor auto-switches to fallback

**Checkout/Checkin:**
- Checkout document
- Other users see lock
- Checkin releases lock
- Checkout conflicts handled

**Variables:**
- Variables panel loads
- Edit variable values

**Real-Time Updates:**
- SSE connection established

**Error Handling:**
- Checkout conflicts show errors
- No console errors during normal usage

**Complete Workflows:**
- Full editor workflow (checkout → save → snapshot → share → checkin)
- Full vendor workflow (view → snapshot)

---

### 🔨 TO ADD (New Tests Needed)

**Document Operations:**
- [ ] Upload document (.docx file)
- [ ] Compile document (generate PDF)
- [ ] Title updates correctly

**Version Management:**
- [ ] Version 1 always accessible (even to vendors)
- [ ] Version 1 cannot be shared (no toggle visible)
- [ ] Checkout prompt shows correct latest accessible version (vendor-aware)

**Messaging:**
- [ ] Send message
- [ ] Receive message
- [ ] Message appears in activity log
- [ ] Messages are user-isolated (not cross-contamination)

**Approvals:**
- [ ] Request approval
- [ ] Approve request
- [ ] Approval shows in activity log

**AI Chat:**
- [ ] Send AI chat message
- [ ] Receive AI demo response (with joke)
- [ ] AI chat is user-isolated (not cross-contamination)
- [ ] AI chat appears in activity log

**Scenarios:**
- [ ] Save scenario
- [ ] Load scenario
- [ ] Scenario restores document version correctly
- [ ] Scenario appears in dropdown

**Real-Time Updates:**
- [ ] Version creation propagates to other windows
- [ ] Version sharing propagates to other windows
- [ ] Activity log updates propagate
- [ ] Checkout/checkin propagates
- [ ] Variable changes propagate

**Error Handling:**
- [ ] Permission denied (vendor tries to access unshared version)
- [ ] Upload invalid file type
- [ ] API failures show user-friendly errors

**Exhibits:**
- [ ] Exhibits panel loads
- [ ] Compiled PDFs appear
- [ ] View/download exhibits

---

### 📊 Test Plan

**Phase 1 (Current):** 17 tests covering core flows
**Phase 2 (This Update):** Add 27 missing tests
**Total:** 44 comprehensive automated tests

All tests will:
- Click buttons and verify API responses
- Check UI updates correctly
- Monitor console for errors
- Verify activity log entries
- Test cross-user interactions

---

## Quick Start

**Run ALL tests (API + UI) automatically:**
```bash
tools\scripts\run-all-tests.bat
```
This script:
- Kills old processes
- Starts the server
- Waits for server ready
- Runs API tests (Jest) - ~138 tests
- Runs UI tests (Playwright) - ~44 tests
- Shows summary
- Cleans up

**Run only UI hardening tests:**
```bash
cd server
npm start  # Terminal 1
npm run test:ui  # Terminal 2
```

**Watch tests run in browser (helpful for debugging):**
```bash
npm run test:ui:headed
```

**Debug a single failing test:**
```bash
npm run test:ui:debug
```

**Expected:** All tests pass (green ✓), no console errors

---

## Test Implementation Details

All tests in `server/e2e/hardening-full-flow.spec.ts` follow this pattern:

1. **Setup:** Load page, select user, reset state if needed
2. **Action:** Click button, fill form, etc.
3. **Verify API:** Check API response status and payload
4. **Verify UI:** Check DOM updates, banners, activity log
5. **Verify Console:** No unexpected errors

Each test is isolated and can run independently.

---

## Detailed Test Spec (For Manual Reference)

The following sections document what each automated test should do. These were originally manual test steps, now automated in `server/e2e/hardening-full-flow.spec.ts`.

### Round 1: Core Document Flow

**1.1 Factory Reset**
- Click "Factory Reset" button
- Verify document reloads to Version 1
- Check activity log for "Factory reset"
- No console errors

**1.2 Upload Document** *(TO ADD)*
- Click "Upload" button
- Select .docx file
- Verify document loads
- Check activity log

**1.3 Edit Variables**
- Click "Variables" tab
- Edit variable value
- Verify API call succeeds
- Check activity log

**1.4 Save Progress**
- Click "Save Progress"
- Verify API response 200
- Check activity log

**1.5 Take Snapshot**
- Click "Take Snapshot"
- Verify new version appears
- Check activity log

**1.6 Compile Document** *(TO ADD)*
- Click "Compile"
- Verify PDF appears in exhibits
- Check activity log

---

### Round 2: Version Management

**2.1 View Previous Version**
- Click "View" on old version
- Verify banner shows "Viewing Version X"
- Click "Return to Latest"

**2.2 Share Version with Vendor**
- Toggle share on
- Verify green border
- Check activity log

**2.3 Vendor Sees Shared Version**
- Switch to vendor
- Verify version visible
- Share toggle hidden

**2.4 Vendor Saves (Auto-Share)**
- Vendor takes snapshot
- Verify version auto-shared (green border)

**2.5 Unshare Version**
- Editor unshares
- Vendor loses access
- Vendor auto-switches to fallback

**2.6 Version 1 Always Accessible** *(TO ADD)*
- Vendor can always view v1
- v1 has "DEMO" badge
- No share toggle on v1

**2.7 Checkout Prompt (Vendor-Aware)** *(TO ADD)*
- Vendor tries to checkout
- Prompt shows latest ACCESSIBLE version (not all versions)

---

### Round 3: Checkout/Checkin

**3.1 Checkout**
- Click "Checkout"
- Button changes to "Checkin"
- Badge shows "Checked out by You"

**3.2 Other User Sees Lock**
- Other user sees "Checked out by [Name]"
- Checkout button disabled

**3.3 Checkin**
- Click "Checkin"
- Button changes back to "Checkout"
- Badge disappears

---

### Round 4: Messaging & Approvals *(TO ADD)*

**4.1 Send Message**
- Click "Messages" tab
- Create new message
- Select recipient
- Verify message appears

**4.2 Receive Message**
- Switch user
- Verify message visible
- Check unread indicator

**4.3 Message Isolation**
- Verify messages don't cross-contaminate users

**4.4 Request Approval**
- Click "Request Approval"
- Select approver
- Verify request created

**4.5 Approve Request**
- Switch to approver
- Click "Approve"
- Verify status changes

---

### Round 5: AI Chat & Scenarios *(TO ADD)*

**5.1 AI Chat**
- Send AI message
- Verify demo response (with joke)
- Check activity log

**5.2 AI Chat Isolation**
- Verify AI chats don't cross-contaminate users

**5.3 Save Scenario**
- Click "Save Current Scenario"
- Enter name
- Verify appears in dropdown

**5.4 Load Scenario**
- Select scenario from dropdown
- Verify all data restores
- Check document version updates correctly

---

### Round 6: Real-Time Updates (SSE) *(TO ADD)*

**6.1 SSE Connection**
- Verify EventSource connection established

**6.2 Version Update Propagation**
- Create version in Window A
- Verify appears in Window B within 1 second

**6.3 Activity Log Propagation**
- Action in Window A
- Verify activity log updates in Window B

---

### Round 7: Error Handling

**7.1 Checkout Conflict**
- User A checks out
- User B tries to checkout
- Verify clear error message

**7.2 Permission Denied** *(TO ADD)*
- Vendor tries to access unshared version
- Verify filtered from list or 403 error

**7.3 Upload Invalid File** *(TO ADD)*
- Try to upload non-.docx file
- Verify clear error message

---

### Round 8: Exhibits *(TO ADD)*

**8.1 Exhibits Panel**
- Click "Exhibits" tab
- Verify exhibits load

**8.2 View Compiled PDF**
- After compile, check exhibit appears
- Click to view/download

---

## Summary

This document serves as the specification for automated hardening tests. All tests are implemented in `server/e2e/hardening-full-flow.spec.ts` and can be run with `tools\scripts\run-all-tests.bat`.

**Current Status:** 17/44 tests implemented
**Next:** Add 27 missing tests covering messaging, approvals, AI chat, scenarios, SSE propagation, and error handling.
