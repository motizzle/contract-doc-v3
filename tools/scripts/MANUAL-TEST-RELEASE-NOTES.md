# Manual Test: Release Notes in Update Banner

## Quick Test (5 minutes)

### Step 1: Start at version 1.0.0
```powershell
cd server
# Set version
$json = Get-Content package.json -Raw | ConvertFrom-Json
$json.version = '1.0.0'
$json | ConvertTo-Json -Depth 10 | Set-Content package.json

# Clear release notes
if (Test-Path RELEASE_NOTES.txt) { Remove-Item RELEASE_NOTES.txt }

# Start servers
cd ..\addin
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"npm run dev-server`""
cd ..\server
npm start
```

### Step 2: Open browser
- Go to: `https://localhost:4001`
- Accept cert warning
- Wait for sidebar to load
- **No banner should appear** (versions match)

### Step 3: Simulate a deploy (new tab/window)
Open a **NEW PowerShell window**:
```powershell
cd server

# Add release notes
@"
Fixed critical bug where vendors couldn't access version 1.

Improvements:
- Version sharing now handles permissions correctly
- Auto-switch to accessible version when unshared
- Updated app branding
"@ | Set-Content RELEASE_NOTES.txt

# Bump version
$json = Get-Content package.json -Raw | ConvertFrom-Json
$json.version = '1.0.1'
$json | ConvertTo-Json -Depth 10 | Set-Content package.json

# Restart server (kill and restart)
Stop-Process -Name node -Force
Start-Sleep -Seconds 2
npm start
```

### Step 4: Check the browser
- **DON'T REFRESH** the browser
- Wait 5-10 seconds for SSE to reconnect
- You should see a **PURPLE BANNER** with:
  - "App Update Available"
  - "Version 1.0.0 → 1.0.1"
  - The full release notes text below

### Step 5: Test banner behavior
1. **Click "Refresh Now"** → page reloads, banner disappears
2. **OR Click "×"** → banner dismisses (will reappear after 5 min)

## Troubleshooting

**Banner doesn't appear?**
- Check browser console for errors
- Verify SSE connection: should see "🔄 [Version] Update detected via SSE" in console
- Check if `window.APP_VERSION` is set (type in console: `window.APP_VERSION`)

**Banner appears but no release notes?**
- Check if `RELEASE_NOTES.txt` exists in `server/` folder
- Verify server console doesn't show errors reading the file
- Check network tab: `/api/v1/health` should return `releaseNotes` field

**Banner appears even though versions match?**
- This is the issue we're seeing - `window.APP_VERSION` is being set dynamically
- Need to fix the HTML to use a static version

