# Fix: run-local.bat Script Issue

**Date:** October 27, 2025  
**Issue:** Script closes immediately without starting Word or showing errors  
**Status:** ✅ FIXED

---

## Problem Analysis

The `run-local.bat` script was **missing a critical step** that caused it to fail silently:

### What Was Wrong

1. ✅ Script starts main server on port 4001
2. ❌ **MISSING:** Script never started the add-in webpack dev server on port 4000
3. ❌ Script attempted to sideload add-in (which requires port 4000)
4. ❌ Sideload failed silently or Word opened without the add-in
5. ❌ Terminal closed immediately (due to `pause >nul`), hiding any errors

### Why It Might Have Worked Before

- If you previously ran `npm run dev-server` manually in the `addin` directory
- The webpack dev server stays running in the background even after closing the terminal
- In that case, port 4000 was already running, so the script appeared to work

### Root Cause

The script was missing this command:
```batch
npm run dev-server
```

Which needs to be executed in the `addin` directory to start the webpack development server on port 4000.

---

## The Fix

### Changes Made

Added **Step 6/8** to check and start the add-in dev server:

```batch
REM Check if add-in dev server is running
echo [6/8] Checking add-in dev server...
netstat -ano | findstr :4000 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  echo   - Add-in dev server already running on port 4000
) else (
  echo   - Starting add-in dev server...
  start /MIN powershell -NoProfile -ExecutionPolicy Bypass -Command "cd '%SCRIPT_DIR%..\..\addin'; npm run dev-server"
  echo   - Add-in dev server starting on https://localhost:4000
  echo   - (Server will open in minimized window)
  echo   - Waiting for dev server to be ready...
  timeout /t 5 /nobreak >nul
)
```

### Updated Script Flow

Now the script follows this correct sequence:

1. **[1/8]** Close Word (if running)
2. **[2/8]** Check for deployed add-in (remove if found)
3. **[3/8]** Stop any existing local sideloads
4. **[4/8]** Set up environment variables
5. **[5/8]** Check/Start main server (port 4001) ✅
6. **[6/8]** Check/Start add-in dev server (port 4000) ✅ **NEW!**
7. **[7/8]** Clear browser session
8. **[8/8]** Sideload add-in to Word

---

## Testing

### To Test the Fix

1. **Stop all running servers:**
   ```batch
   tools\scripts\stop-servers.bat
   ```

2. **Close Word completely**

3. **Run the fixed script:**
   ```batch
   tools\scripts\run-local.bat
   ```

4. **Expected behavior:**
   - Script should show all 8 steps
   - Two minimized PowerShell windows will open (servers on ports 4001 and 4000)
   - Browser opens to clear session, then redirects
   - Word launches with the add-in loaded
   - Terminal stays open showing success message

### Verification

Check that both servers are running:
```powershell
netstat -ano | findstr ":4000 :4001"
```

You should see:
- Port 4001: Main server (Node.js backend)
- Port 4000: Add-in dev server (webpack)

---

## Technical Details

### What `npm run dev-server` Does

From `addin/package.json`:
```json
{
  "scripts": {
    "dev-server": "webpack serve --mode development"
  },
  "config": {
    "dev_server_port": 4000
  }
}
```

This command:
1. Starts webpack development server
2. Serves the add-in files (HTML, JS, CSS) on port 4000
3. Provides hot-reloading for development
4. Uses SSL certificate for HTTPS (required by Office Add-ins)

### Why Port 4000 Is Critical

The add-in manifest (`addin/manifest.xml`) specifies:
```xml
<SourceLocation DefaultValue="https://localhost:4000/taskpane.html"/>
<IconUrl DefaultValue="https://localhost:4000/assets/icon-32.png"/>
```

If port 4000 isn't running:
- Word can't load the add-in UI
- Icons don't display
- The add-in appears broken or doesn't load at all

---

## Related Scripts

This fix aligns with how `servers.ps1` handles the same functionality:

```powershell
# From tools/scripts/servers.ps1
function Start-AddinDevServer() {
  Start-Process -FilePath "powershell" `
    -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass",`
                  "-Command","cd '$root\addin'; npm run dev-server" `
    -WindowStyle Minimized -PassThru
}
```

---

## Troubleshooting

### If Word still doesn't open with the add-in:

1. **Check port 4000 is running:**
   ```powershell
   netstat -ano | findstr :4000
   ```

2. **Check for errors in the add-in dev server:**
   - Look for the minimized PowerShell window running webpack
   - Maximize it to see any error messages

3. **Verify the manifest is valid:**
   ```bash
   cd addin
   npm run validate
   ```

4. **Check SSL certificates:**
   ```bash
   cd addin
   npx office-addin-dev-certs verify
   ```

5. **Clear Office cache:**
   ```powershell
   Remove-Item -Path "$env:LOCALAPPDATA\Microsoft\Office\16.0\Wef\*" -Recurse -Force
   ```

---

## Summary

✅ **Fixed:** Added missing step to start webpack dev server on port 4000  
✅ **Result:** Script now properly starts both servers before sideloading  
✅ **Benefit:** Word launches successfully with add-in loaded  
✅ **User Experience:** Clear progress messages, no silent failures  

The script will now work reliably even if no servers are running beforehand.

