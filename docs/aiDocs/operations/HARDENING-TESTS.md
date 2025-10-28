# WordFTW Prototype Hardening Tests

**Purpose:** Automated tests that click every button, check every API call, and verify no console errors.

**Time:** ~5 minutes (automated)

---

## What Gets Tested (Automated)

The automated test suite (`server/e2e/hardening-full-flow.spec.ts`) covers:

**✅ Document Operations:**
- Factory reset
- Save progress
- Take snapshot (create versions)

**✅ Version Management:**
- View previous versions
- Share version with vendor
- Vendor sees shared versions
- Vendor saves (auto-shares)
- Unshare removes access
- Vendor auto-switches to fallback

**✅ Checkout/Checkin:**
- Checkout document
- Other users see lock
- Checkin releases lock
- Checkout conflicts handled

**✅ Variables:**
- Variables panel loads
- Edit variable values
- API calls succeed

**✅ Real-Time Updates (SSE):**
- SSE connection established
- Events propagate

**✅ Error Handling:**
- Checkout conflicts show errors
- No console errors during normal usage

**✅ Complete Workflows:**
- Full editor workflow (checkout → save → snapshot → share → checkin)
- Full vendor workflow (view → snapshot)

---

## Quick Start

**Run all hardening tests:**
```bash
cd server
npm start  # In one terminal (wait for "Server running")
npm run test:ui  # In another terminal
```

**Watch tests run in browser (see what's happening):**
```bash
npm run test:ui:headed
```

**Debug a failing test (step through with Playwright Inspector):**
```bash
npm run test:ui:debug
```

**Expected:** All tests pass (green ✓), no console errors reported

---

## Pre-Test Setup (If Running Manually)

**Why Local?** Test YOUR changes before deploying. Fast iteration, safe to break things.

**Steps:**
1. Start local server:
   ```bash
   cd server
   npm start
   ```
2. Wait for "Server running on https://localhost:4001"
3. Open https://localhost:4001 in browser
4. Accept certificate warning (self-signed cert is expected)
5. Open browser console (F12)
6. Clear console
7. Note starting time

**Expected:** 
- ✅ Server starts without errors
- ✅ Page loads at https://localhost:4001
- ✅ Clean console, no errors on page load
- ✅ Sidebar loads with all panels

**If server won't start:**
- Check port 4001 isn't already in use: `netstat -ano | findstr :4001`
- Kill any old node processes: `taskkill /F /IM node.exe`
- Try again

---

## Test Round 1: Core Document Flow (8 minutes)

### 1.1 Factory Reset

**Actions:**
1. Click "Factory Reset" button (bottom of sidebar)
2. Confirm reset
3. Wait for completion

**Expected:**
- ✅ Document reloads to Version 1
- ✅ Activity log shows "Factory reset"
- ✅ Variables reset to defaults
- ✅ Messages panel clear
- ✅ Chat panel clear
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 1.2 Upload Document

**Actions:**
1. Click "Upload" button (top of sidebar)
2. Select a .docx file (test with default.docx from `data/app/documents/`)
3. Wait for upload

**Expected:**
- ✅ File picker opens
- ✅ Upload progress shows
- ✅ Document loads in editor
- ✅ Activity log shows "Document uploaded"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 1.3 Edit Variables

**Actions:**
1. Click "Variables" tab
2. Click edit on "Buyer Name"
3. Change value to "Test Buyer Inc"
4. Click outside to blur
5. Check activity log

**Expected:**
- ✅ Variable value updates
- ✅ Activity log shows "Variable updated"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 1.4 Save Progress

**Actions:**
1. Click "Save Progress" button
2. Wait for save

**Expected:**
- ✅ Toast shows "Saved"
- ✅ Activity log shows "Document saved"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 1.5 Take Snapshot

**Actions:**
1. Click "Take Snapshot" button
2. Wait for snapshot

**Expected:**
- ✅ New version appears in versions panel (v2)
- ✅ Activity log shows "Version 2 created"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 1.6 Compile Document

**Actions:**
1. Click "Compile" button
2. Wait for compilation

**Expected:**
- ✅ Progress indicator shows
- ✅ "Compiled PDF" appears in exhibits panel
- ✅ Activity log shows "Document compiled"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 2: Version Management (8 minutes)

### 2.1 View Previous Version

**Actions:**
1. In versions panel, click "View" on Version 1
2. Check banner at top
3. Click "Return to Latest"

**Expected:**
- ✅ Document loads Version 1
- ✅ Banner shows "Viewing Version 1 of 2"
- ✅ "Return to Latest" button visible
- ✅ Click returns to Version 2
- ✅ Activity log shows view events
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 2.2 Share Version with Vendor

**Pre-req:** Switch to editor user (Warren Peace)

**Actions:**
1. In versions panel, find Version 2
2. Click share toggle (turns it on)
3. Check version card styling

**Expected:**
- ✅ Toggle switches on
- ✅ Version card gets green border
- ✅ Activity log shows "Version 2 shared with vendors"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 2.3 Vendor Sees Shared Version

**Actions:**
1. Switch user to vendor (Hugh R Ewe)
2. Check versions panel

**Expected:**
- ✅ Version 1 visible (DEMO badge)
- ✅ Version 2 visible (green border)
- ✅ Share toggles hidden (vendor can't share)
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 2.4 Vendor Saves Document (Creates v3)

**Actions:**
1. Still as vendor
2. Edit variable (change any value)
3. Click "Take Snapshot"
4. Check versions panel

**Expected:**
- ✅ Version 3 created
- ✅ Version 3 has green border (auto-shared)
- ✅ Activity log shows "Version 3 created by Hugh R Ewe"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 2.5 Unshare Version from Vendor

**Actions:**
1. Switch back to editor (Warren Peace)
2. Find Version 3 in versions panel
3. Click share toggle (turns it off)
4. Switch back to vendor (Hugh R Ewe)
5. Check what version is loaded

**Expected:**
- ✅ Toggle switches off
- ✅ Version 3 border turns normal (editor)
- ✅ Vendor loses Version 3 from list
- ✅ Vendor auto-switches to Version 2 or 1
- ✅ Activity log shows "Version 3 unshared"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 2.6 Version 1 Always Accessible

**Actions:**
1. As vendor, click View on Version 1
2. Try to find share toggle on Version 1

**Expected:**
- ✅ Version 1 loads successfully
- ✅ Version 1 has "DEMO" badge
- ✅ No share toggle visible (even for editor)
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 3: Checkout/Checkin (5 minutes)

### 3.1 Checkout Document

**Pre-req:** Switch to editor (Warren Peace)

**Actions:**
1. Click "Checkout" button
2. Check badge
3. Check activity log

**Expected:**
- ✅ Button changes to "Checkin"
- ✅ Badge shows "Checked out by You"
- ✅ Activity log shows "Document checked out"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 3.2 Other User Sees Lock

**Actions:**
1. Switch to vendor (Hugh R Ewe)
2. Try to click checkout button

**Expected:**
- ✅ Badge shows "Checked out by Warren Peace"
- ✅ Checkout button disabled or shows error
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 3.3 Checkin Document

**Actions:**
1. Switch back to editor (Warren Peace)
2. Click "Checkin" button
3. Check badge

**Expected:**
- ✅ Button changes to "Checkout"
- ✅ Badge disappears
- ✅ Activity log shows "Document checked in"
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 4: Messaging & Approvals (5 minutes)

### 4.1 Send Message

**Pre-req:** Switch to editor (Warren Peace)

**Actions:**
1. Click "Messages" tab
2. Click "+" to create new message
3. Enter text: "Test message"
4. Select recipient: Hugh R Ewe
5. Click "Send"

**Expected:**
- ✅ Message appears in list
- ✅ Activity log shows message sent
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 4.2 Receive Message

**Actions:**
1. Switch to vendor (Hugh R Ewe)
2. Click "Messages" tab
3. Check for message

**Expected:**
- ✅ Message from Warren Peace visible
- ✅ Unread indicator shows
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 4.3 Request Approval

**Actions:**
1. As vendor, click "Approvals" section
2. Click "Request Approval"
3. Select approver: Warren Peace
4. Click "Request"

**Expected:**
- ✅ Approval request created
- ✅ Activity log shows request
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 4.4 Approve Request

**Actions:**
1. Switch to editor (Warren Peace)
2. Check approvals section
3. Click "Approve" on pending request

**Expected:**
- ✅ Approval status changes to approved
- ✅ Activity log shows approval
- ✅ Vendor sees approval status
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 5: AI Chat & Scenarios (4 minutes)

### 5.1 AI Chat

**Actions:**
1. Click "AI" tab
2. Type message: "Hello"
3. Send
4. Wait for response

**Expected:**
- ✅ User message appears
- ✅ AI demo response appears
- ✅ Response includes random joke
- ✅ Activity log shows chat interaction
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 5.2 Chat Isolation

**Actions:**
1. Open second window (same URL, incognito or different browser)
2. Switch to different user (Kent Uckey)
3. Send chat message in second window
4. Check first window (Warren Peace)

**Expected:**
- ✅ Kent's message does NOT appear in Warren's chat
- ✅ Each user has isolated chat
- ✅ Console: no errors in either window

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 5.3 Save Scenario

**Actions:**
1. Click "Scenarios" dropdown (top of sidebar)
2. Click "Save Current Scenario"
3. Enter name: "Test Scenario"
4. Click "Save"

**Expected:**
- ✅ Scenario saves successfully
- ✅ "Test Scenario" appears in dropdown
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 5.4 Load Scenario

**Actions:**
1. Make some changes (edit variable, etc)
2. Click "Scenarios" dropdown
3. Select "Test Scenario"
4. Confirm load

**Expected:**
- ✅ All data reverts to saved scenario
- ✅ Document, variables, messages all load
- ✅ Activity log shows scenario loaded
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 6: Real-Time Updates (SSE) (5 minutes)

### 6.1 SSE Connection

**Actions:**
1. Open browser console
2. Look for SSE connection logs
3. Check Network tab for `/api/v1/events/client`

**Expected:**
- ✅ SSE connection established
- ✅ "hello" event received
- ✅ Connection shows as "EventStream" in Network tab
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 6.2 Version Update Propagation

**Pre-req:** Open two windows (Window A = Warren Peace, Window B = Hugh R Ewe)

**Actions:**
1. In Window A, create new snapshot (v4)
2. In Window A, share v4 with vendors
3. Observe Window B

**Expected:**
- ✅ Window B sees v4 appear within 1 second
- ✅ No page refresh required
- ✅ Activity log updates in both windows
- ✅ Console: no errors in either window

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 6.3 Activity Log Real-Time

**Pre-req:** Two windows still open

**Actions:**
1. In Window A, edit a variable
2. Observe Window B's activity log

**Expected:**
- ✅ Activity appears in Window B within 1 second
- ✅ Timestamp accurate
- ✅ No duplicates
- ✅ Console: no errors

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Round 7: Error Handling (5 minutes)

### 7.1 Checkout Conflict

**Actions:**
1. Window A: Checkout document (Warren Peace)
2. Window B: Try to checkout (Hugh R Ewe)

**Expected:**
- ✅ Window B shows clear error message
- ✅ Message says "Checked out by Warren Peace"
- ✅ Offers to view anyway
- ✅ Console: no errors (expected 409 status is fine)

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 7.2 Permission Denied

**Actions:**
1. As vendor (Hugh R Ewe)
2. Try to view unshared version (should auto-prevent)
3. Check console

**Expected:**
- ✅ Unshared versions not in list (auto-filtered)
- ✅ Cannot manually navigate to unshared version
- ✅ Console: no errors (403 is expected if attempting)

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### 7.3 Network Error Simulation

**Actions:**
1. Open DevTools → Network tab
2. Throttle to "Offline"
3. Try to save document
4. Observe error message

**Expected:**
- ✅ Clear error message shows
- ✅ Says "Network error" or similar
- ✅ Offers retry or refresh
- ✅ Console: network error expected

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Final Verification

### Console Check

**Actions:**
1. Review entire console log
2. Filter for errors (red)
3. Note any unexpected errors

**Expected:**
- ✅ No unexpected errors
- ✅ Only expected errors (checkout conflicts, permission denials)
- ✅ No silent failures

**Result:** ⬜ PASS ⬜ FAIL

**Error Count:** ______

**Notes:**

---

### UI Completeness

**Actions:**
1. Check all tabs loaded
2. Check all buttons enabled (or disabled with reason)
3. Check no "loading forever" states

**Expected:**
- ✅ All panels load
- ✅ All data displays
- ✅ No infinite spinners
- ✅ No blank sections

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

### Data Consistency

**Actions:**
1. Compare activity log with actual actions performed
2. Check version count matches reality
3. Check variable values are current

**Expected:**
- ✅ Activity log complete and accurate
- ✅ Version count correct
- ✅ Variable values match last edit
- ✅ No stale data

**Result:** ⬜ PASS ⬜ FAIL

**Notes:**

---

## Test Summary

**Total Time:** ________ minutes

**Tests Run:** ________ / 35

**Tests Passed:** ________ / 35

**Tests Failed:** ________ / 35

**Console Errors:** ________ (unexpected)

**Overall Result:** ⬜ PASS ⬜ FAIL

---

## Issues Found

### Critical (Blocks usage)

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Major (Broken functionality)

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Minor (UI glitch, not blocking)

1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

---

## Next Steps

**If ALL tests pass locally:**
- ✅ Prototype is stable locally
- ✅ Run automated tests: `cd server && npm test`
- ✅ Commit and push fixes
- ✅ Merge to main (when ready)
- ✅ Deploy to Render
- ✅ Run quick smoke test on deployed (see below)

**If ANY tests fail:**
- 🔧 Fix critical issues first
- 🔧 Fix major issues next
- 🔧 Document minor issues for later
- 🔧 Re-run failed tests after fixes
- 🔧 DO NOT deploy until local tests pass

---

## Deployed Smoke Test (5 minutes)

**When:** AFTER merging to main and deploy completes

**Why:** Verify deploy succeeded and no environment-specific issues

**How:**
1. Open https://wordftw.onrender.com
2. Check console for errors
3. Click a few buttons:
   - Upload document
   - Create snapshot
   - Share version
   - Switch users
4. Verify basic functionality works

**Expected:**
- ✅ App loads
- ✅ No console errors
- ✅ Basic buttons work

**If smoke test fails:**
- 🚨 Rollback deploy or hotfix immediately
- 🚨 Investigate environment-specific issue
- 🚨 Fix locally, test, redeploy

**Note:** Deployed testing is NOT for development. It's a final safety check after deployment.

---

## Test History

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| | | ⬜ PASS ⬜ FAIL | |
| | | ⬜ PASS ⬜ FAIL | |
| | | ⬜ PASS ⬜ FAIL | |

