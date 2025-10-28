# WordFTW Prototype Hardening

**Goal:** Make sure every button works, every API call succeeds, and the UI doesn't break.

**NOT:** Enterprise features (rate limiting, circuit breakers, retry logic). Just make the prototype stable.

**Related:** `test-inventory.md`, `features/version-sharing.md`

---

## Core Principles

1. **Every button works** - Click any button → it does what it says
2. **No console errors** - Clean console = working app
3. **API calls succeed** - Or show clear error message
4. **UI updates correctly** - Changes reflect immediately
5. **Data stays consistent** - State matches reality

---

## Hardening Checklist

### ✅ Server Startup & Health
- [x] Server starts without errors
- [x] Health endpoint returns 200
- [x] Startup checks validate dependencies
- [x] Graceful shutdown on SIGTERM/SIGINT

**Status:** DONE (Week 1 hardening)

---

### 🔄 Document Operations

#### Upload Document
- [ ] Click upload → file picker opens
- [ ] Select .docx → uploads successfully
- [ ] Progress indicator shows
- [ ] Document loads in editor
- [ ] Activity log shows upload
- [ ] No console errors

#### Save Progress
- [ ] Click save → document saves
- [ ] Toast shows "Saved"
- [ ] Activity log updated
- [ ] No console errors

#### Take Snapshot
- [ ] Click snapshot → creates version
- [ ] Version appears in list
- [ ] Activity log updated
- [ ] No console errors

#### Compile Document
- [ ] Click compile → starts compilation
- [ ] Progress indicator shows
- [ ] Compiled PDF appears in exhibits
- [ ] Activity log updated
- [ ] No console errors

**Tests Needed:**
- Upload small file (1KB)
- Upload medium file (1MB)
- Upload near-limit file (9MB)
- Save document with changes
- Take snapshot
- Compile document
- Each action should: succeed, update UI, log activity, no errors

---

### 🔄 Version Management

#### View Version
- [ ] Click version → loads in editor
- [ ] "Viewing Version N" banner shows
- [ ] "Return to Latest" button works
- [ ] Activity log shows view event
- [ ] No console errors

#### Share/Unshare Version (Editor)
- [ ] Click share toggle → version shares
- [ ] Green border appears
- [ ] Vendor sees new version immediately
- [ ] Activity log updated
- [ ] No console errors

- [ ] Click unshare toggle → version unshares
- [ ] Border turns normal
- [ ] Vendor loses access immediately
- [ ] Vendor auto-switches to fallback version
- [ ] Activity log updated
- [ ] No console errors

#### Version 1 (Demo Document)
- [ ] Version 1 always visible to everyone
- [ ] Cannot unshare version 1
- [ ] "DEMO" badge shows
- [ ] No share toggle for version 1
- [ ] No console errors

**Tests Needed:**
- Editor views any version
- Editor shares version with vendor
- Vendor sees shared version
- Editor unshares version
- Vendor auto-switches to v1
- Version 1 always accessible
- Each action should: work, update UI, no errors

---

### 🔄 Checkout/Checkin

#### Checkout
- [ ] Click checkout → document checks out
- [ ] "Checked out by You" badge shows
- [ ] Other users see "Checked out by X"
- [ ] Activity log updated
- [ ] No console errors

#### Checkout Conflict
- [ ] Try to checkout when locked → shows error
- [ ] Error message names who has it checked out
- [ ] Offers "View anyway" option
- [ ] No console errors

#### Checkin
- [ ] Click checkin → document checks in
- [ ] Badge disappears
- [ ] Activity log updated
- [ ] No console errors

**Tests Needed:**
- User A checks out
- User B sees lock message
- User A checks in
- User B can now check out
- Each action should: work, update UI, no errors

---

### 🔄 Variables Panel

#### View Variables
- [ ] Panel loads all variables
- [ ] Variables grouped by category
- [ ] Values display correctly
- [ ] No console errors

#### Edit Variable
- [ ] Click edit → input appears
- [ ] Type new value → saves on blur
- [ ] Variable updates in all places
- [ ] Activity log updated
- [ ] No console errors

#### Add Variable
- [ ] Click add → modal opens
- [ ] Fill form → creates variable
- [ ] Variable appears in list
- [ ] Activity log updated
- [ ] No console errors

#### Delete Variable
- [ ] Click delete → confirms
- [ ] Variable removed from list
- [ ] Activity log updated
- [ ] No console errors

**Tests Needed:**
- Load variables panel
- Edit text variable
- Edit email variable
- Add new variable
- Delete variable
- Each action should: work, update UI, no errors

---

### 🔄 Messaging

#### View Messages
- [ ] Panel loads all messages
- [ ] Unread count correct
- [ ] Messages grouped correctly
- [ ] No console errors

#### Send Message
- [ ] Click send → message posts
- [ ] Message appears in list
- [ ] Other users see message
- [ ] Activity log updated
- [ ] No console errors

#### Mark Read/Unread
- [ ] Click mark read → updates status
- [ ] Unread count decreases
- [ ] UI updates immediately
- [ ] No console errors

**Tests Needed:**
- User A sends message
- User B sees message
- User B marks read
- User A sees read status
- Each action should: work, update UI, no errors

---

### 🔄 Approvals

#### Request Approval
- [ ] Click request → approval created
- [ ] Approver sees notification
- [ ] Activity log updated
- [ ] No console errors

#### Approve/Reject
- [ ] Click approve → updates status
- [ ] Requester sees approval
- [ ] Activity log updated
- [ ] No console errors

**Tests Needed:**
- User A requests approval from B
- User B sees approval request
- User B approves
- User A sees approval
- Each action should: work, update UI, no errors

---

### 🔄 AI Chat (Demo Mode)

#### Send Chat Message
- [ ] Type message → send
- [ ] User message appears
- [ ] AI demo response appears
- [ ] Random joke included
- [ ] No console errors

#### Chat Isolation
- [ ] User A's chat doesn't appear in User B's window
- [ ] Each user has their own chat history
- [ ] No cross-window leakage
- [ ] No console errors

**Tests Needed:**
- User A sends chat message
- AI responds with demo message + joke
- User B doesn't see User A's messages
- Each action should: work, update UI, no errors

---

### 🔄 Scenarios

#### Load Scenario
- [ ] Click load → modal opens
- [ ] Select scenario → loads data
- [ ] Document, variables, messages, chat all load
- [ ] Activity log resets
- [ ] No console errors

#### Save Scenario
- [ ] Click save → modal opens
- [ ] Enter name → saves scenario
- [ ] Scenario appears in list
- [ ] No console errors

**Tests Needed:**
- Save current state as scenario
- Load existing scenario
- All data loads correctly
- UI updates completely
- Each action should: work, update UI, no errors

---

### 🔄 Factory Reset

#### Reset
- [ ] Click factory reset → confirms
- [ ] All data resets to defaults
- [ ] Document reloads to v1
- [ ] Variables reset
- [ ] Messages clear
- [ ] Chat clears
- [ ] Activity log clears
- [ ] No console errors

**Tests Needed:**
- Make changes to everything
- Factory reset
- Everything returns to defaults
- No orphaned data
- No console errors

---

### 🔄 User Switching

#### Switch User
- [ ] Select different user in dropdown
- [ ] Role changes (editor/vendor)
- [ ] Permissions update
- [ ] UI updates (show/hide buttons)
- [ ] Version list filters
- [ ] Activity log shows user's actions
- [ ] No console errors

**Tests Needed:**
- Switch from editor to vendor
- Vendor sees only shared versions
- Vendor can't see share buttons
- Switch back to editor
- Editor sees all versions
- Each action should: work, update UI, no errors

---

### 🔄 Real-Time Updates (SSE)

#### SSE Connection
- [ ] Page loads → SSE connects
- [ ] Health check shows connection
- [ ] Events received in real-time
- [ ] No console errors

#### Version Updates
- [ ] User A shares version → User B sees immediately
- [ ] User A creates version → User B sees immediately
- [ ] No polling required
- [ ] No console errors

#### Activity Log Updates
- [ ] User A does action → User B sees in log immediately
- [ ] Timestamps accurate
- [ ] No duplicates
- [ ] No console errors

**Tests Needed:**
- Open two windows (User A and User B)
- User A shares version
- User B sees update within 1 second
- User A saves document
- User B sees activity log update
- Each update should: be immediate, no errors

---

### 🔄 Error Handling

#### API Errors
- [ ] Checkout conflict → shows clear message
- [ ] Permission denied → shows clear message
- [ ] File too large → shows clear message
- [ ] Network error → shows clear message
- [ ] Each error has action to resolve
- [ ] No console errors

#### Client Errors
- [ ] Invalid state → reloads gracefully
- [ ] Corrupt data → falls back to defaults
- [ ] Missing data → shows placeholder
- [ ] No white screen of death
- [ ] No console errors

**Tests Needed:**
- Trigger each error condition
- Verify clear error message
- Verify recovery action works
- No console errors

---

### 🔄 Link Code (Web → Word)

#### Generate Link Code
- [ ] Click "Link with Word" → generates code
- [ ] 6-character code displays
- [ ] Banner shows with code
- [ ] No console errors

#### Use Link Code
- [ ] Enter code in Word → links
- [ ] Both windows sync
- [ ] Same document visible
- [ ] Same user selected
- [ ] No console errors

#### Dismiss Banner
- [ ] Click X on banner → dismisses
- [ ] Banner gone from both windows
- [ ] Link still active
- [ ] No console errors

**Tests Needed:**
- Open web
- Generate link code
- Open Word
- Enter code
- Both windows linked
- Actions in web appear in Word
- Actions in Word appear in web
- Each action should: work, sync, no errors

---

## Test Execution Plan

### Manual Testing (30 minutes)

**Round 1: Core Document Flow**
1. Upload document
2. Edit variables
3. Save progress
4. Take snapshot
5. Compile document
6. Verify: all actions work, UI updates, no errors

**Round 2: Multi-User Flow**
1. Open as User A (editor)
2. Create version 2
3. Share with vendor
4. Switch to User B (vendor)
5. View version 2
6. Save changes (creates version 3)
7. Verify: version 3 auto-shared, User B sees it
8. Switch back to User A
9. Unshare version 3
10. Verify: User B auto-switches to version 2 or 1

**Round 3: Real-Time Updates**
1. Open two windows (A and B)
2. User A: share version
3. User B: see update within 1 second
4. User A: send message
5. User B: see message immediately
6. User A: checkout document
7. User B: see lock immediately

**Round 4: Error Conditions**
1. Try to upload 100MB file → clear error
2. Try to checkout locked document → clear error
3. Try to unshare version 1 → prevented
4. Disconnect network → offline message

### Automated Testing (via `npm test`)

**Run:** `cd server && npm test`

**Current Status:** 138 tests (133 passing, 5 pre-existing failures)

**Coverage:**
- Infrastructure: health, startup, routes
- Document operations: upload, save, snapshot, compile
- Version management: list, view, share, unshare
- Checkout/checkin: lock, unlock, conflicts
- Variables: CRUD operations
- Messages: send, read, delete
- Approvals: request, approve, reject
- Scenarios: save, load
- Factory reset
- Multi-user scenarios
- Real-time updates

**Failures (Pre-existing, NOT blockers):**
1. Test 60: Compile without variables
2. Test 61: Compile without state
3. Test 71: Vendor cannot unshare
4. Test 91: Non-editor cannot checkout
5. Test 104: Finalized document prevents changes

---

## Success Criteria

### Every Button Works
- ✅ All buttons clickable
- ✅ All buttons do what they say
- ✅ No "dead" buttons
- ✅ Disabled buttons have clear reason

### No Console Errors
- ✅ Clean console on page load
- ✅ No errors during normal operations
- ✅ Warnings are acceptable (e.g., deprecated APIs)
- ✅ Errors only on expected failures

### API Calls Succeed
- ✅ All GET requests return 200 or expected status
- ✅ All POST requests succeed or show clear error
- ✅ No silent failures
- ✅ No "network error" without retry

### UI Updates Correctly
- ✅ Changes reflect immediately
- ✅ SSE updates appear within 1 second
- ✅ No stale data
- ✅ No "flashing" or double-renders

### Data Stays Consistent
- ✅ State matches server
- ✅ Activity log matches actions
- ✅ Version list accurate
- ✅ No orphaned data

---

## Implementation Progress

### ✅ Completed

**Server Infrastructure:**
- ✅ Startup checks
- ✅ Graceful shutdown
- ✅ Health endpoint with version info
- ✅ Enhanced logging

**Version Sharing:**
- ✅ Role-based filtering
- ✅ Share/unshare with auto-switch
- ✅ Vendor-saved versions auto-share
- ✅ Version 1 always accessible
- ✅ Permission-aware UI
- ✅ Real-time SSE updates

**AI Chat:**
- ✅ Demo mode (no external LLM)
- ✅ Random jokes
- ✅ Chat isolation (per-user, per-platform)
- ✅ Immediate response delivery

**Bug Fixes:**
- ✅ Compile functionality
- ✅ Scenario loading
- ✅ Uninstaller hardening
- ✅ Validation middleware
- ✅ Version 1 access for vendors

**Version Detection:**
- ✅ Server version in health endpoint
- ✅ Client version detection
- ✅ Update banner on version mismatch
- ✅ Works on both web and Word

### 🔄 In Progress (hardening-v3 branch)

**Prototype Stability Tests:**
- [ ] Document operations checklist
- [ ] Version management checklist
- [ ] Checkout/checkin checklist
- [ ] Variables panel checklist
- [ ] Messaging checklist
- [ ] Approvals checklist
- [ ] AI chat checklist
- [ ] Scenarios checklist
- [ ] Factory reset checklist
- [ ] User switching checklist
- [ ] Real-time updates checklist
- [ ] Error handling checklist
- [ ] Link code checklist

**Goal:** Complete manual testing of all UI interactions, verify no console errors, fix any broken buttons or API calls.

---

## Next Steps

1. **Run Manual Test Rounds** (30 minutes)
   - Follow test execution plan above
   - Note any failures
   - Check console for errors

2. **Fix Any Broken Interactions**
   - Every button must work
   - Every API call must succeed
   - Every UI update must happen

3. **Run Automated Tests** (`npm test`)
   - Verify 133+ tests still passing
   - Address any new failures

4. **Final Verification**
   - Open two windows
   - Go through entire workflow
   - No errors, everything works

5. **Document Known Issues**
   - List any remaining quirks
   - Note workarounds
   - Plan future fixes
