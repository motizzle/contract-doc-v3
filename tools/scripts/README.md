# Scripts Directory

Quick-access scripts for development and testing.

## Server Management

### Start/Stop Servers
- **`start-servers.bat`** - Start all servers (4000, 4001, 4002) with LLM environment configured
- **`stop-servers.bat`** - Stop all running servers
- **`status-servers.bat`** - Check which servers are currently running
- **`servers.ps1`** - PowerShell script for server management
  ```powershell
  .\servers.ps1 -Action start|stop|restart|status|sideload
  ```

## Testing

### Automated Tests

**Before committing or merging:**

- **`run-all-tests.bat`** ⭐ **Recommended**
  - Factory resets before running (clean state)
  - Enables test mode (prevents SSE conflicts)
  - Runs Jest unit tests (65 tests)
  - Runs Playwright E2E tests (15 tests)
  - Clear pass/fail summary
  - **Use this before committing or merging to main**

- **`run-tests-report.bat`** - Same as above + generates markdown report
  - Creates timestamped report in `test-results/`
  - Perfect for sharing test failures with the team
  - Report includes: test output, exit codes, git context

**During development:**

- **`test-quick.bat`** - Run Jest unit tests only (~30 seconds)
  - Faster feedback loop for quick checks
  - Skips E2E tests
  - No factory reset or test mode

### Manual Testing
- **`smoke.ps1`** - Backend smoke test (health check, SSE validation)
  ```powershell
  .\smoke.ps1
  .\smoke.ps1 -Base https://localhost:4000  # Via dev proxy
  ```

- **`collab-smoke.ps1`** - Collaboration server smoke test
- **`sync-stress.ps1`** - Stress test for state sync
- **`run-stress-local.ps1`** - Load testing with multiple users

## Development

- **`setup-env.ps1`** - Environment setup and validation
- **`dev-cert-backend.ps1`** - Generate HTTPS certificates
- **`install-git-hooks.ps1`** - Install Git hooks
- **`superdoc.ps1`** - SuperDoc-specific utilities
- **`validate-readmes.ps1`** - Check README consistency

## Quick Start

1. **Start servers:**
   ```
   Double-click: start-servers.bat
   ```

2. **Run tests before committing/merging:**
   ```
   Double-click: run-all-tests.bat
   ```

3. **Check server status:**
   ```
   Double-click: status-servers.bat
   ```

## Workflow

**Daily development:**
1. Make changes
2. Save files
3. Test locally (manual)

**Before committing:**
1. Double-click: `run-all-tests.bat`
2. Wait for results (~3-5 min)
3. If all pass → Commit ✅
4. If any fail → Fix and re-run

**Before merging to main:**
1. Same as before committing
2. Must have: ALL TESTS PASSED
3. Share test report if unsure

## Port Reference

- **4000** - Dev server (Webpack, HTTPS)
- **4001** - Backend API (Express, HTTPS)
- **4002** - Collab server (Hocuspocus)

## Notes

- All `.bat` files can be double-clicked from Windows Explorer
- PowerShell scripts require: `powershell -NoProfile -ExecutionPolicy Bypass -File <script>.ps1`
- Most scripts handle HTTPS certificate warnings automatically

