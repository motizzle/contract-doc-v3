# Manual Test: Version Update Detection

Quick manual test for the version update feature.

---

## Quick Test (5 minutes)

### Step 1: Start Server
```bash
cd server
npm start
```

Wait for: `HTTPS server running on https://localhost:4001`

---

### Step 2: Load App in Browser

1. Open: https://localhost:4001
2. Accept certificate warning
3. Wait for app to load
4. Check console for: `"Connected to server"`

**Expected:** ✅ No version banner (versions match)

---

### Step 3: Change Version (Simulate Deploy)

**Open a new terminal** and run:

```powershell
cd server
(Get-Content package.json) -replace '"version": "1.0.0"', '"version": "1.0.1"' | Set-Content package.json
```

Or **manually edit** `server/package.json`:
```json
{
  "version": "1.0.1"  // Change from 1.0.0 to 1.0.1
}
```

---

### Step 4: Restart Server

**In the server terminal:**
- Press `Ctrl+C` to stop
- Run: `npm start` again

**Keep browser tab open!** Don't refresh manually.

---

### Step 5: Watch the Banner Appear! 🎉

**Within 1-2 seconds**, you should see:

```
┌─────────────────────────────────────────────────────┐
│ 🔄 App Update Available                              │
│ Version 1.0.0 → 1.0.1. Refresh to update.           │
│                          [Refresh Now]  [×]          │
└─────────────────────────────────────────────────────┘
```

**Console shows:**
```
🔄 [Version] Update detected via SSE: 1.0.0 → 1.0.1
```

---

### Step 6: Test Actions

**Try each:**

1. **Click "Refresh Now"**
   - ✅ Page reloads
   - ✅ Banner disappears (versions match now)

2. **Or click "×" (dismiss)**
   - ✅ Banner hides
   - ✅ Wait 5 minutes → banner reappears

3. **Or ignore it**
   - ✅ Banner stays visible
   - ✅ User can continue working

---

## Cleanup

Restore original version:

```powershell
cd server
(Get-Content package.json) -replace '"version": "1.0.1"', '"version": "1.0.0"' | Set-Content package.json
```

Restart server:
```bash
npm start
```

---

## What You're Testing

| Feature | Expected Behavior |
|---------|-------------------|
| **SSE reconnect detection** | Banner appears within 1-2 seconds of server restart |
| **Version display** | Shows "1.0.0 → 1.0.1" |
| **Refresh button** | Reloads page immediately |
| **Dismiss button** | Hides banner for session |
| **Visual design** | Purple gradient, highly visible |
| **Console logging** | Shows update detection message |

---

## Testing Periodic Check (5 minutes)

If you want to test the 5-minute periodic check:

1. **Don't restart the server**
2. Just change the version in package.json
3. Wait 5 minutes (or change the interval in code to 10 seconds for testing)
4. Banner should appear after the interval

**Note:** SSE reconnect is the primary detection method, periodic check is backup.

---

## Common Issues

### Banner doesn't appear?

**Check:**
1. Server actually restarted? (check terminal)
2. Browser console for errors?
3. SSE connected? (should see "Connected to server")
4. Versions actually different? (check package.json)

**Debug in console:**
```javascript
// Check current state
const context = React.useContext(StateContext);
console.log('Client version:', '1.0.0');
console.log('Server version:', context.serverVersion);
console.log('Update available:', context.updateAvailable);
```

### Banner appears but looks wrong?

**Check:**
- Should be purple gradient background
- Should have 🔄 icon
- Should show version numbers
- Should have two buttons

### Browser cached old code?

**Solution:**
- Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Or clear cache and reload

---

## Success Criteria

✅ Banner appears within 2 seconds of server restart  
✅ Shows correct version change (1.0.0 → 1.0.1)  
✅ "Refresh Now" button works  
✅ "×" button dismisses  
✅ Console shows detection message  
✅ Banner is visually distinct (purple)  

---

## Next Steps

Once you've verified it works locally:

1. Test on staging/Render deployment
2. Monitor user behavior (dismiss rate, refresh rate)
3. Consider auto-refresh countdown (future enhancement)

**Happy testing! 🎉**

