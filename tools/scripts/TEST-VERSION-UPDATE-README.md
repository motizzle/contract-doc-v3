# How to Test the Version Update Banner

## Quick Start

```bash
tools\scripts\test-version-update.bat
```

**Time Required:** 5 minutes  
**What It Tests:** The purple "App Update Available" banner that shows when you deploy a new version

---

## What The Script Does (Automated)

1. ✅ Sets version to 1.0.0
2. ✅ Clears release notes file
3. ✅ Starts both servers (ports 4000 and 4001)
4. ⏸️ **PAUSE** - You open browser
5. ✅ Bumps version to 1.0.1
6. ✅ Adds sample release notes
7. ✅ Restarts backend server
8. ⏸️ **PAUSE** - You hard refresh browser
9. ⏸️ **PAUSE** - You test banner buttons
10. ⏸️ **PAUSE** - You close/reopen Word
11. ✅ Cleans up (restores v1.0.0, removes test files)

---

## What YOU Need to Do (Manual Steps)

### Step 1: Open Browser
- Go to: `https://localhost:4001`
- Accept certificate warning
- Wait for sidebar to load
- **Verify:** No banner appears (versions match)

### Step 2: Hard Refresh Browser
**⚠️ CRITICAL: You MUST do this or banner won't appear**

- Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Wait 3-5 seconds for page to fully reload
- **Result:** Purple banner appears at top with release notes

### Step 3: Test Banner Buttons
1. Click `[×]` → banner dismisses
2. Hard refresh again → banner reappears (good!)
3. Click `[Refresh Now]` → page reloads, banner gone

### Step 4: Close Word Completely
**⚠️ MUST fully close - Office caches aggressively**

- Close ALL Word windows
- Check Task Manager → verify `WINWORD.EXE` is gone
- Wait 3 seconds

### Step 5: Reopen Word
- Open Word
- Open any document
- Add-in loads automatically
- **Result:** Same purple banner appears in Word too

---

## What Success Looks Like

You should see a **purple gradient banner** at the **top of the sidebar** with:

```
🔄 App Update Available          [Refresh Now] [×]
    Version 1.0.0 → 1.0.1. Refresh to update.
    
    Fixed critical bug where vendors couldn't
    access version 1 after being unshared.
    
    Improvements:
    - Version sharing now correctly handles...
    - Auto-switch to accessible version...
    - Updated app branding...
```

---

## Troubleshooting

### Banner Doesn't Appear in Browser?

**Most Common Cause:** You didn't hard refresh

1. Press `Ctrl+Shift+R` (not just F5)
2. Check browser console for errors
3. Type in console: `window.APP_VERSION` (should be "1.0.0")
4. Look for console log: "Update detected via SSE"

### Banner Doesn't Appear in Word?

**Most Common Cause:** Word still running in background

1. Open Task Manager
2. Look for `WINWORD.EXE` process
3. If found, kill it manually
4. Wait 5 seconds, then reopen Word

### Banner Appears But No Release Notes?

1. Check if `server/RELEASE_NOTES.txt` exists
2. Look at server console for file read errors
3. Open Network tab → check `/api/v1/health` response → should have `releaseNotes` field

### Still Not Working?

- Try restarting the script (it cleans up at the end)
- Check if ports 4000/4001 are blocked
- Look for Node.js errors in the console windows
- Try uninstalling/reinstalling the add-in

---

## How It Works (Technical)

1. **Client Version:** Hardcoded in HTML as `window.APP_VERSION = '1.0.0'`
2. **Server Version:** Read from `server/package.json`
3. **Detection:** Client checks server version via:
   - `/api/v1/health` endpoint (every 5 minutes)
   - SSE `hello` event (on reconnect)
4. **Mismatch:** If client ≠ server → show banner
5. **Release Notes:** Server reads `server/RELEASE_NOTES.txt` and includes in health response

---

## After Testing

The script automatically:
- Restores version to 1.0.0
- Deletes test release notes
- Stops all servers

Your environment is back to normal!

