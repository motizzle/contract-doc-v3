# WordFTW Hardening

Complete hardening strategy for the entire application stack.

**Related:** `test-inventory.md` (225 tests), `features/version-sharing.md`

---

## Core Principles

1. **Pre-flight checks** - Validate before executing
2. **Clear error messages** - Every error has actionable resolution
3. **Graceful degradation** - Partial functionality > total failure
4. **Rollback capability** - Undo failed operations
5. **Self-healing** - Detect and fix common issues automatically
6. **Comprehensive testing** - Automated coverage of all failure modes
7. **Observability** - Clear logging and diagnostics

---

## 1. Installation Hardening

### Windows & macOS Installers

**Pre-flight checks:**
- Node.js version (18+)
- npx availability
- Office 2016+ installed
- PowerShell available (Windows)
- Server reachable
- Existing installation detection

**Installation process:**
- Download manifest with validation
- Backup before modification (registry/defaults)
- Atomic registry/defaults update
- Close Word if running (with user consent)
- Clear Office cache
- Verify installation success

**Error handling:**
- Every error has resolution steps
- Rollback on failure
- Self-diagnostic mode (`--diagnose` flag)

**Platform-specific:**
- Windows: Registry (`HKCU\...\WEF\Developer`), PowerShell cache clearing
- macOS: `defaults` command (plist), bash cache clearing, `xmllint` validation

### Uninstallers

**Complete removal:**
- Remove registry/defaults entry with correct GUID
- Kill Edge processes before cache clearing
- Clear Office cache (gracefully handle locked files)
- Delete manifest files
- Verify clean uninstall

**✅ Implemented:** Registry key fixes, locked file handling, error messages

### Developer Environment Switchers

**One-click scripts:**
- `use-local.bat` / `.command` - Switch to localhost:4000
- `use-deployed.bat` / `.command` - Switch to production
- `run-local.bat` - Start local dev environment
  - Closes Word cleanly
  - Removes deployed add-in if present
  - **Kills and restarts server processes** (ports 4000/4001)
  - Starts add-in dev server
  - Sideloads local manifest
- Automatic stop/start of manifests
- Clear feedback on active environment

**✅ Implemented:** run-local.bat now properly restarts servers to pick up code changes

**Tests:** 37 installation tests (see `test-inventory.md`)

---

## 2. Server Infrastructure Hardening

### Startup Checks

**Validate before starting:**
- Node.js version (18+)
- Required modules installed
- Data directories exist
- Disk space available (>1GB)
- Environment variables set

**Startup flow:**
```
Check dependencies → Validate state → Create dirs → Health check → Accept requests
```

**Exit on failure** with clear resolution steps.

### Graceful Shutdown

**On SIGTERM/SIGINT:**
- Stop accepting new requests (return 503)
- Wait for active requests (30 second timeout)
- Log pending requests
- Exit cleanly

**Force shutdown on double signal.**

### Health Check Endpoint

**GET /api/v1/health:**
- Memory usage (warn if >90%)
- Filesystem access
- AI status (always reports demo mode)
- Return 200 (ok) or 503 (degraded)

**✅ Implemented:** Simplified AI to always use demo mode (no external LLM dependencies)

**Tests:** 25 server infrastructure tests

---

## 3. API Endpoint Hardening

### Input Validation

**Framework:** Joi schemas for all endpoints

**Validate:**
- Required fields present
- Correct data types
- String length limits
- Enum values
- Sanitize input

**Return 400 with:**
- Field name
- Validation error
- Resolution steps

### Standardized Error Handling

**Every error includes:**
- Error code (e.g., `CHECKOUT_CONFLICT`)
- Human-readable message
- Resolution steps
- Context (in dev mode)

**HTTP status codes:**
- 400: Validation failed
- 401: Invalid session
- 403: Permission denied
- 404: Not found
- 408: Timeout
- 409: Conflict (checkout)
- 413: File too large
- 429: Rate limit exceeded
- 440: Session expired
- 500: Internal error
- 503: Service unavailable
- 507: Disk full

### Rate Limiting

**General API:** 100 requests / 15 minutes
**Write operations:** 10 requests / minute

**Return 429** with retry-after time.

### Timeout Handling

**Default:** 30 seconds
**Long operations:** 120 seconds (document compilation)

**Return 408** on timeout.

**Tests:** 45 API endpoint tests

---

## 4. State Management Hardening

### Consistency Validation

**Validate before persist:**
- Required fields present (revision, documentVersion, lastUpdated)
- Correct types (numbers, strings)
- Valid checkout state (null or string)
- Valid status (draft/review/approved/signed)

### Corruption Detection

**On load:**
- Parse and validate state.json
- If corrupt: backup to `.corrupted.{timestamp}`, use defaults
- Log recovery

### Atomic Updates

**Transaction pattern:**
```
Snapshot state → Apply updates → Validate → Commit or rollback
```

**No partial state updates.**

**Tests:** 15 state management tests

---

## 5. File Operations Hardening

### File Size Limits

**Max upload:** 10MB
**Allowed types:** .docx, .doc, .pdf

**Return 413** for oversized files.

### Disk Space Checking

**Before writes:**
- Check available space (need 2x file size)
- Return 507 if insufficient

### Atomic Operations

**Write pattern:**
```
Write to .tmp → Verify content → Atomic rename → Delete temp on failure
```

**No partial file writes.**

### Orphaned File Cleanup

**Scheduled cleanup (every hour):**
- Find .tmp files older than 24 hours
- Delete abandoned temp files
- Log cleanup count

**Tests:** 20 file operation tests

---

## 6. Session Management Hardening

### Timeout Handling

**4-hour inactivity timeout:**
- Track last activity per session
- Return 440 on expired session
- Clear message: "Refresh to start new session"

### Abandoned Session Cleanup

**Every 30 minutes:**
- Find sessions with no activity >8 hours
- Delete old session directories
- Preserve active sessions

**Tests:** 12 session management tests

---

## 7. Version Sharing & Permission Hardening

### Version Access Control

**Role-based filtering:**
- Editors: See all versions
- Vendors: Only see shared versions
- Version 1 always shared (demo document, cannot be unshared)

**Server-side enforcement:**
- `GET /api/v1/versions` filters by userId and role
- `GET /api/v1/versions/:n` validates access before returning document
- `POST /api/v1/versions/:n/share` validates editor permission

### Vendor-Saved Versions

**Auto-share behavior:**
- When vendor saves document → version auto-shared with vendor
- `sharedWithVendor: true` set automatically
- Broadcast `version:shared` event
- Vendor sees their own version immediately

**✅ Implemented:** Vendors can now see and access their own saved versions

### Share/Unshare Operations

**Sharing workflow:**
- Editor clicks share → API validates permissions
- Server updates version metadata atomically
- Broadcasts `version:shared` event
- Vendors' UI refreshes with newly shared version

**Unsharing workflow:**
- Editor clicks unshare → API validates permissions
- Server calculates fallback version (most recent shared version or v1)
- Broadcasts `version:shared` with `fallbackVersion`
- Vendors viewing unshared version auto-switch to fallback
- Unshared version removed from vendors' list

**Error handling:**
- 403: Non-editors cannot share/unshare
- 400: Version 1 cannot be unshared
- 404: Version doesn't exist

**✅ Implemented:** Share/unshare with auto-switch and permission validation

### UI Permission Awareness

**Version banner:**
- Respects vendor permissions
- Only shows "New Version Available" for accessible versions
- Fetches latest accessible version per user
- Falls back gracefully if fetch fails

**Version list:**
- Real-time updates via SSE events
- Share/unshare buttons only visible to editors
- Green styling for shared versions
- DEMO badge for Version 1

**✅ Implemented:** Banner, list, and share buttons all respect permissions

### SSE Event Isolation

**Chat messages:**
- Per-user, per-platform isolation
- AI chat responses sent only to requesting user
- Broadcast explicitly skips `chat` and `chat:stop` events
- Prevents cross-window message leakage

**Version events:**
- `version:shared` broadcasts to all clients
- Vendors filter by their permissions
- Editors see all updates

**✅ Implemented:** Chat isolation and version event broadcasting

**Tests:** 18 version sharing tests (see `features/version-sharing.md`)

---

## 8. Network Operations Hardening

### Retry Logic

**Exponential backoff:**
- Retry on 5xx errors and network failures
- Delays: 1s, 2s, 4s (max 10s)
- Max 3 retries
- No retry on 4xx errors

### Circuit Breaker Pattern

**Per external service:**
- Open circuit after 5 failures
- Reject requests for 60 seconds
- Half-open: try one request
- Close after 2 successes

**Prevents cascade failures.**

**Tests:** 12 network operation tests

---

## 9. Client-Side Hardening

### React Error Boundaries

**Wrap components:**
- Catch render errors
- Show fallback UI
- Offer reload/continue
- Log to server

**One component error ≠ total failure.**

### Standardized API Calls

**All API calls:**
- 30-second timeout
- Retry 3 times on failure
- Exponential backoff
- Parse error responses
- Show user-friendly messages

### Offline Detection

**Monitor connection:**
- Check health endpoint every 30 seconds
- Listen to browser online/offline events
- Show toast on status change
- Disable write operations when offline

**Tests:** 18 client-side tests

---

## Testing Strategy

**See `test-inventory.md` for complete catalog (225 tests)**

### Test Categories

1. **Installation (37)** - Install/uninstall flows, Windows & macOS
2. **Server Infrastructure (25)** - Startup, shutdown, health checks
3. **API Endpoints (45)** - Validation, errors, rate limiting
4. **State Management (15)** - Validation, corruption, atomic updates
5. **File Operations (20)** - Size limits, atomic writes, cleanup
6. **Session Management (12)** - Timeouts, cleanup
7. **Version Sharing (18)** - Permission validation, auto-share, auto-switch
8. **Network Operations (12)** - Retries, circuit breakers
9. **Client-Side (18)** - Error boundaries, API calls, offline
10. **Integration (30)** - End-to-end flows, error recovery
11. **Chaos (10)** - Failure injection, stress testing

**Current Status:** 138 tests implemented (133 passing, 5 pre-existing failures)

### Automated Test Execution

**CI/CD pipeline:**
```
Commit → Linting → Unit tests → Integration tests → Deploy
```

**Nightly:**
```
Chaos tests → Performance tests → Report
```

---

## Implementation Roadmap

### ✅ Completed (bugs-and-bye-ollama branch → main)

**Developer Tools:**
- ✅ Uninstaller hardening (registry fixes, locked file handling)
- ✅ run-local.bat improvements (proper process restart)

**Version Sharing & Permissions:**
- ✅ Role-based version filtering (editors vs vendors)
- ✅ Vendor-saved versions auto-share
- ✅ Share/unshare with auto-switch for vendors
- ✅ Permission-aware UI (banner, list, buttons)
- ✅ Version 1 always shared (demo document)

**SSE & Real-time:**
- ✅ Chat message isolation (per-user, per-platform)
- ✅ AI chat immediate response delivery
- ✅ Version event broadcasting with permission filtering

**AI Simplification:**
- ✅ Removed Ollama dependency
- ✅ Simplified to always use demo mode

**Tests:**
- ✅ 138 tests implemented (133 passing)
- ✅ Version sharing test coverage

### ✅ Week 1: Server Infrastructure (COMPLETED)
- ✅ Server startup checks
- ✅ Graceful shutdown
- ✅ Enhanced health check
- ⚠️  Windows/macOS installers hardening (partial: uninstaller done)
- ⚠️  Dev environment switchers (partial: run-local.bat done)

### ✅ Week 2: API Layer (COMPLETED)
- ✅ Input validation framework (Joi schemas for 13 endpoints)
- ✅ Standardized error handling (26 error codes with resolutions)
- ✅ Rate limiting (3 limiters: general, write, strict)
- ✅ Timeout handling (standard, extended, short)
- ✅ Applied to all critical write endpoints (13 total)
- 📊 Test Results: 133/138 passing (96%)

### Week 3: State & Files (3 days) + Sessions & Network (2 days)
- State validation
- Atomic state updates
- File size limits
- Atomic file operations
- Cleanup schedulers
- Session timeout
- Retry logic
- Circuit breakers

### Week 4: Client & Integration (5 days)
- Error boundaries
- Standardized API calls
- Offline detection
- Integration tests
- Error recovery tests

### Week 5: Testing & Polish (5 days)
- Complete test suite
- Chaos testing
- Performance testing
- Load testing
- Documentation updates

---

## Success Metrics

### Reliability
- **99.9% uptime** - Server stays running
- **0% data corruption** - All operations atomic
- **95%+ operation success** - Operations complete or rollback
- **<1s error recovery** - Quick recovery from transient errors

### Error Handling
- **100% errors have resolutions** - Every error actionable
- **<5s user feedback** - Fast error display
- **90%+ self-service** - Users resolve issues without support
- **0 silent failures** - All failures logged

### Testing
- **90%+ error path coverage** - All failure modes tested
- **225 automated tests** - Complete test inventory
- **CI/CD integration** - Tests run on every commit
- **Nightly chaos testing** - Failure injection testing

### Performance
- **<100ms p95 response** - Most requests fast
- **<1% memory growth/hour** - No memory leaks
- **<10GB disk growth/day** - Cleanup working
- **<5% idle CPU** - Efficient background tasks

---

## Key Files

### Production (End Users)
- `server/public/install-addin.bat` - Windows installer
- `server/public/install-addin.command` - macOS installer

### Developer Tools
- `tools/scripts/uninstall-addin.bat|.command` - Uninstallers
- `tools/scripts/use-local.bat|.command` - Switch to local env
- `tools/scripts/use-deployed.bat|.command` - Switch to production
- `tools/scripts/run-local.bat` - Start local dev environment

### Server
- `server/src/server.js` - Main server
- `server/src/startup-checks.js` - Pre-flight validation
- `server/src/middleware/validation.js` - Input validation
- `server/src/middleware/error-handler.js` - Error handling
- `server/src/middleware/rate-limit.js` - Rate limiting

### Client
- `shared-ui/components.react.js` - React components with error boundaries
- `shared-ui/utils/api.js` - Standardized API calls
- `shared-ui/utils/offline-detector.js` - Connection monitoring

### Tests
- `server/tests/addin-installation.test.js` - 37 tests
- `server/tests/api-endpoints.test.js` - 45 tests
- `server/tests/integration.test.js` - 30 tests
- `server/tests/chaos.test.js` - 10 tests