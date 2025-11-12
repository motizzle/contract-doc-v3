# Mac Word Add-in Installation

## For Users

### How to install

1. On the WordFTW website, click **"Open in Word"**
2. In the dialog, click **"Install & Generate Link Code"**
3. The installer will download automatically
4. Double-click the downloaded file
5. Click "Install"
6. Wait 10-15 seconds - Word opens automatically

The add-in will connect to your browser session using the link code.

### If you see a security warning

macOS might block the installer saying "can't be opened from an unidentified developer."

**Fix:**
1. Right-click (or Control-click) the downloaded installer file
2. Select "Open" from the menu
3. Click "Open" in the dialog
4. The installer will run normally

This is normal for downloaded files on Mac.

### Using the add-in

Once Word opens:
1. The add-in panel will appear on the right side
2. Click the **3 dots menu (⋮)** at the top of the panel
3. Select **"Enter Link Code"**
4. The add-in will connect to your browser session

Now you can start working!

---

## If installation fails

The installer creates a detailed log file at:
```
~/.wordftw-addin/install.log
```

**To send this to support:**
```bash
open ~/.wordftw-addin/install.log
```

Then copy and paste the contents, or attach the file.

The log shows exactly what happened and where it failed.

---

## For Developers

### Installation flow

1. User clicks "Open in Word" button on website
2. Browser shows dialog with two options:
   - **"Install & Generate Link Code"** - Downloads installer + generates session link
   - **"Generate Link Code Only"** - Just generates link (if already installed)
3. User downloads and runs the installer
4. Installer installs manifest and opens Word
5. Word connects to browser session via link code

### What gets installed

The installer:
1. Closes Word if running
2. Downloads manifest.xml from server
3. Copies it to: `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`
4. Downloads a sample document
5. Opens Word

### Log file details

Location: `~/.wordftw-addin/install.log`

Contains:
- Timestamp for each step
- HTTP codes and file sizes for downloads
- Exact file paths used
- System info (macOS version, Word location, etc.)
- Any error messages

### Viewing the log

```bash
cat ~/.wordftw-addin/install.log
```

### Manual installation (if automatic fails)

```bash
# 1. Download manifest
curl -o ~/Downloads/manifest.xml https://wordftw.onrender.com/manifest.xml

# 2. Create Word's add-in folder
mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef

# 3. Copy manifest to Word's add-in folder
cp ~/Downloads/manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/

# 4. Open Word
open -a "Microsoft Word"
```

### Uninstalling

```bash
# Remove manifest from Word's add-in folder
rm ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/manifest.xml

# Clear cache
rm -rf ~/Library/Containers/com.microsoft.Word/Data/Library/Caches/*
```

### Common issues

**"Failed to download manifest"**
- Check internet connection
- Verify server is up: https://wordftw.onrender.com
- Check firewall settings

**Add-in doesn't appear**
- Verify manifest file exists:
  ```bash
  ls -la ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/manifest.xml
  ```
- Ensure Word is licensed (not viewer/read-only mode)
- Completely quit and reopen Word (Cmd+Q, not just close window)

**"Damaged or can't be verified"**
```bash
xattr -d com.apple.quarantine ~/Downloads/WordFTW-Add-in-Installer.pkg
```
Then right-click and choose "Open".
