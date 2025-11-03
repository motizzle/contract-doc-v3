# Fix: run-local.bat Now Kills Old Processes

## Problem
`run-local.bat` was checking if servers were running and skipping restart if they were already running. This meant code changes in `server.js` weren't taking effect without manually killing processes.

## Root Cause
The script had logic like:
```batch
netstat -ano | findstr :4001 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Server already running on port 4001
) else (
  echo   - Starting main server...
```

This "skip if running" behavior meant old code kept running.

## Solution
Changed `run-local.bat` to **always kill and restart** servers, matching the behavior of `start-servers.bat`:
- Kills any process listening on port 4001 (main server)
- Kills any process listening on port 4000 (add-in dev server)
- Waits 2 seconds for graceful shutdown
- Starts fresh processes with current code

## Changed Files
- `tools/scripts/run-local.bat`
  - Lines 60-71: Main server now kills before restart
  - Lines 73-83: Add-in dev server now kills before restart

## Testing
Run `run-local.bat` twice. Second run should kill the first processes and start fresh.

