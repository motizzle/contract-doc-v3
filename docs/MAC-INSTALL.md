# macOS Installation Guide

**Last Updated:** October 25, 2025  
**For:** Redlined & Signed Word Add-in  
**Platform:** macOS 10.14 (Mojave) or later

---

## Quick Start (Recommended Method)

### Step 1: Download the Installer

Go to: `https://wordftw.onrender.com`
- Click the **3-dot menu** (⋮) in the top right
- Select **"Install Word Add-in"**
- Click **"Download Installer"**
- Save `install-addin.command` to your Downloads folder

### Step 2: Run the Installer

⚠️ **Important:** macOS security will block the installer by default. Follow these steps:

1. **Open Finder** and navigate to your Downloads folder
2. **Right-click** (or Control-click) on `install-addin.command`
3. Select **"Open"** from the menu (DON'T double-click!)
4. Click **"Open"** again when macOS asks for confirmation
5. Follow the on-screen instructions

**Why?** macOS Gatekeeper blocks downloaded scripts for security. Right-click → Open bypasses this safely.

---

## Alternative: Terminal Installation

If the above doesn't work, use Terminal:

```bash
# Navigate to Downloads
cd ~/Downloads

# Make the file executable
chmod +x install-addin.command

# Remove quarantine attribute
xattr -d com.apple.quarantine install-addin.command

# Run the installer
./install-addin.command
```

---

## What the Installer Does

1. ✅ Checks for macOS compatibility
2. ✅ Verifies Microsoft Word is installed
3. ✅ Closes Word if running
4. ✅ Downloads the manifest from the server
5. ✅ Registers the add-in in Word preferences
6. ✅ Creates a log file for troubleshooting
7. ✅ Opens Word with the add-in ready

---

## After Installation

1. **Open Microsoft Word**
2. Go to **Insert** → **Get Add-ins** (or **My Add-ins**)
3. Look under **"Developer Add-ins"** tab
4. You should see **"Redlined & Signed"**
5. Click on it to activate

---

## Troubleshooting

### "Permission denied" Error

**Solution:**
```bash
chmod +x install-addin.command
```

### "Unidentified developer" Warning

**Solution:** Don't double-click! Instead:
- Right-click → Open → Open (confirm)

### "'install-addin.command' can't be opened"

**Solution:** Remove quarantine:
```bash
xattr -d com.apple.quarantine install-addin.command
```

### "Word not found"

**Solution:** The installer checks these locations:
- `/Applications/Microsoft Word.app`
- `~/Applications/Microsoft Word.app`
- `/Applications/Microsoft Office 365/Microsoft Word.app`

If Word is elsewhere, move it to `/Applications/` first.

### "Failed to register add-in"

**Possible causes:**
1. **Word is running:** Close Word completely and try again
2. **Preferences locked:** Check Word preferences aren't read-only
3. **Permission issue:** Try running with `sudo`:
   ```bash
   sudo ./install-addin.command
   ```

### Add-in doesn't appear in Word

**Solutions:**
1. **Clear Word cache:**
   ```bash
   rm -rf ~/Library/Containers/com.microsoft.Word/Data/Library/Caches/*
   ```
2. **Restart Word completely** (Quit, not just close windows)
3. **Check registration:**
   ```bash
   defaults read com.microsoft.Word wef.developer.manifests
   ```

---

## Getting Help

If installation fails, the installer creates a detailed log file:

**Log Location:** `~/.wordftw-addin/install.log`

**To view the log:**
```bash
cat ~/.wordftw-addin/install.log
```

**To send the log to support:**
```bash
# Open in default text editor
open ~/.wordftw-addin/install.log

# Or copy to Desktop for easy attachment
cp ~/.wordftw-addin/install.log ~/Desktop/install-log.txt
```

Please send this log file along with:
- macOS version (`sw_vers -productVersion`)
- Microsoft Word version (Word → About Word)
- Screenshot of the error message

---

## Manual Installation (Advanced)

If the installer fails completely, you can register manually:

```bash
# 1. Download manifest
mkdir -p ~/.wordftw-addin
curl -o ~/.wordftw-addin/manifest.xml https://wordftw.onrender.com/manifest.xml

# 2. Register in Word
defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "wordftw-addin-prod" "$HOME/.wordftw-addin/manifest.xml"

# 3. Kill preferences daemon
killall cfprefsd

# 4. Open Word
open -a "Microsoft Word"
```

---

## Uninstallation

To remove the add-in:

```bash
# 1. Download uninstaller
curl -o ~/Downloads/uninstall-addin.command https://wordftw.onrender.com/uninstall-addin.command

# 2. Make executable and run
cd ~/Downloads
chmod +x uninstall-addin.command
xattr -d com.apple.quarantine uninstall-addin.command
./uninstall-addin.command
```

Or manually:
```bash
# Remove registration
defaults delete com.microsoft.Word "wef.developer.manifests.wordftw-addin-prod"

# Clear cache
rm -rf ~/Library/Containers/com.microsoft.Word/Data/Library/Caches/*
rm -rf ~/.wordftw-addin

# Restart preferences daemon
killall cfprefsd
```

---

## Security Notes

### Why These Security Steps?

**macOS Gatekeeper** protects you from malicious software by:
- Blocking unsigned/untrusted downloaded files
- Requiring explicit user approval to run scripts

Our installer is safe, but macOS doesn't know that. The steps above bypass Gatekeeper **for this specific file only** without disabling system security.

### What We Do for Security

1. ✅ **Auto-fix permissions** - Script fixes itself on first run
2. ✅ **Remove quarantine** - Attempts to clear security flags
3. ✅ **Verify downloads** - Checks file size and basic XML structure
4. ✅ **Log everything** - Full audit trail for troubleshooting

### Corporate/Managed Macs

If your Mac is managed by IT:
- Installation may require administrator approval
- Some security policies may block third-party add-ins
- Contact your IT department if you can't run the installer

---

## System Requirements

- **macOS:** 10.14 (Mojave) or later
- **Microsoft Word:** 16.x or later (Office 365, Office 2019, or Office 2021)
- **Internet:** Required for initial download
- **Disk Space:** <1 MB

---

## FAQ

**Q: Is this safe to install?**  
A: Yes. The installer only modifies Word preferences and doesn't require system-level access.

**Q: Will this affect other Word documents?**  
A: No. The add-in only activates when you explicitly open it from Insert → My Add-ins.

**Q: Can I use this on multiple Macs?**  
A: Yes. Install separately on each Mac using the same steps.

**Q: Does this work with Office 365?**  
A: Yes, it works with all modern versions of Word for Mac.

**Q: What if I have an M1/M2/M3 Mac?**  
A: The installer works on both Intel and Apple Silicon Macs.

---

## Additional Resources

- **GitHub Issues:** [Report a bug](https://github.com/your-repo/issues)
- **Documentation:** [Full docs](https://github.com/your-repo/docs)
- **Windows Installation:** See `README.md`

---

**Need Help?** Open an issue with your install log attached!

