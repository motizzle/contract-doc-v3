# Broadcast Announcement System

Send messages to all users currently using the app via a purple modal banner.

## Setup (One-Time)

### 1. Set the Broadcast Secret

In your Render dashboard (or local `.env`), add:

```bash
BROADCAST_SECRET=your-secret-here-min-32-chars
```

**Generate a secure secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create the Secret File

Create `tools/scripts/broadcast-secret.txt` with your secret on the first line:

```
abc123def456your-64-char-secret-here
```

**Important:**
- No quotes, no spaces, just the raw secret
- This file is in `.gitignore` so it won't be committed
- Keep it secure on your local machine only

### 3. Update the URL (if needed)

If not using `wordftw.onrender.com`, update the URL in the script:
```batch
-Uri 'https://your-app-name.onrender.com/api/v1/broadcast-announcement'
```

---

## How to Use

1. **Double-click** `broadcast-announcement.bat`
2. Read the formatting tips
3. Type your message (press Enter for new lines)
4. Type `DONE` when finished
5. Preview your message
6. Type `y` to confirm and send

**That's it!** Everyone with the app open will see your message instantly.

---

## Message Formatting

The message displays as **plain text with preserved line breaks**. Here's what works:

### ✅ What Works
- **Line breaks**: Press Enter
- **Blank lines**: Press Enter twice
- **Bullets**: Use `•`, `-`, or `*`
- **Emojis**: 🚀 🎉 ⚠️ ✅ 🔥 💡 ℹ️ 📢 ⚡
- **Separators**: `---` or `═══`
- **Emphasis**: CAPS or **asterisks** (show as-is)

### ❌ What Doesn't Work
- HTML tags (will show as text)
- Markdown formatting (bold/italic won't render)
- Links (will show as text)

---

## Example Messages

### Simple Update
```
New features are live! 🎉
Refresh your browser to see them.
```

### Detailed Announcement
```
📢 Update Available

We just deployed some improvements:

✅ Faster approval workflows
✅ Version comparison fixed
✅ Better error handling

Please refresh to get the latest version!
```

### Maintenance Warning
```
⚠️ SCHEDULED MAINTENANCE ⚠️

The system will be down for 30 minutes
tonight at 10 PM EST.

Please save your work before then.
Thanks for your patience!
```

### Feature Launch
```
🚀 NEW FEATURE ALERT

Contract variables are now live!

What you can do:
• Add dynamic placeholders to contracts
• Auto-fill vendor information
• Reuse common text snippets

Check the Variables tab to get started!
```

---

## How It Works

### Architecture

1. **Script** → Sends POST request to `/api/v1/broadcast-announcement`
2. **Server** → Validates secret, broadcasts SSE event to all connected clients
3. **Client** → Receives event, shows purple modal with your message
4. **User** → Dismisses modal (marked as "seen" in localStorage)

### Who Sees It?

- ✅ Anyone with the app **currently open** in a browser
- ✅ Anyone in the Word add-in with a connection
- ❌ Users who load the app **after** the broadcast (they won't see it)

**This is different from version-based release notes**, which only appear when versions mismatch.

### Persistence

Once a user dismisses the announcement:
- It's saved in their browser's localStorage
- They won't see it again (even if they refresh)
- New announcements will still appear (different ID)

---

## Security

**Protected by `BROADCAST_SECRET`:**
- Only people with the secret can send broadcasts
- Keep the secret secure (don't commit it to git)
- Set it in Render environment variables
- Rotate periodically if concerned

**No user authentication:**
- Endpoint doesn't check user roles
- Secret is the only protection
- Simple but effective

---

## Troubleshooting

### "Failed to send broadcast - Invalid secret"
- Check that `BROADCAST_SECRET` in Render matches the script
- Make sure there are no extra spaces or quotes
- Verify the environment variable is set

### "Failed to send broadcast - Network error"
- Check the URL in the script
- Verify Render deployment is live
- Test the endpoint: `curl https://your-app.onrender.com/api/v1/health`

### "Recipients: 0"
- This is normal if no one is currently using the app
- Users must have an active browser tab open to receive it
- Try opening the app yourself and testing

### Users don't see the message
- Check browser console for errors
- Verify SSE connection is active (look for "Connected to server")
- Make sure popup blockers aren't interfering

---

## Testing Locally

To test on localhost before production:

1. Update URL in script to `https://localhost:4001`
2. Set `BROADCAST_SECRET=test-secret` in your local environment
3. Update the script secret to `test-secret`
4. Run the script and check your local browser

---

## Alternative: Manual API Call

If the script doesn't work, you can use `curl` or PowerShell directly:

### PowerShell
```powershell
$body = @{ 
    message = "Test announcement!" 
    secret = "your-secret-here" 
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "https://wordftw.onrender.com/api/v1/broadcast-announcement" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

### curl
```bash
curl -X POST https://wordftw.onrender.com/api/v1/broadcast-announcement \
  -H "Content-Type: application/json" \
  -d '{"message":"Test announcement!","secret":"your-secret-here"}'
```

---

## Best Practices

### When to Use
- ✅ Major feature launches
- ✅ Important announcements
- ✅ Maintenance warnings
- ✅ Critical bug fixes requiring refresh

### When NOT to Use
- ❌ Minor updates (use version-based release notes instead)
- ❌ Testing (use a test environment)
- ❌ Spam (respect user attention)

### Writing Good Announcements
1. **Be concise** - Users will read the first line first
2. **Use emojis** - Visual cues help
3. **Clear action** - Tell them what to do (e.g., "Refresh")
4. **Friendly tone** - You're interrupting their work, be nice!

---

## Future Enhancements

Possible improvements:
- [ ] Web UI for sending broadcasts (no script needed)
- [ ] Schedule broadcasts for future time
- [ ] Target specific user roles (admin, vendor, etc.)
- [ ] Analytics (who saw it, who dismissed it)
- [ ] Rich formatting (markdown support)
- [ ] Announcement history/archive

---

## Related Features

- **Version Update Detection**: Shows banner when app version changes (see `docs/aiDocs/features/version-update-detection.md`)
- **Document Update Notifications**: Banner when document changes (different system)
- **Release Notes**: Tied to version bumps in `package.json` + `RELEASE_NOTES.txt`


