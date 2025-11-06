# macOS Installer Package

This directory contains the **`.pkg` installer** for the WordFTW add-in on macOS.

## Files

- **`pkg-install-script.sh`** - Non-interactive installation script (runs automatically)
- **`build-mac-pkg.sh`** - Build script to create the .pkg installer
- **`install-addin.applescript`** - Alternative AppleScript installer (optional)
- **`build-mac-installer.sh`** - Builds the AppleScript .app (optional)
- **`install-addin.command`** - Legacy bash installer (deprecated)

## Why .pkg?

The `.pkg` format is the **standard macOS installer**:
- ✅ **Download and double-click** - Just works, no building required
- ✅ **Familiar UI** - Uses macOS Installer.app that users trust
- ✅ **No terminal** - Runs in background, shows progress
- ✅ **Professional** - Same format as Apple and major software vendors
- ✅ **Code-signable** - Can be signed and notarized for Gatekeeper
- ✅ **Automatic** - Installs everything without user intervention

## Building the Installer

On macOS, run the build script:

```bash
cd addin/public
chmod +x build-mac-pkg.sh
./build-mac-pkg.sh
```

This will create: **`WordFTW-Add-in-Installer.pkg`**

## Testing Locally

After building, you can test it by:

**Option 1: Double-click** (most realistic test)
- Just double-click `WordFTW-Add-in-Installer.pkg` in Finder
- macOS Installer.app will open and run the installation

**Option 2: Command line**
```bash
sudo installer -pkg WordFTW-Add-in-Installer.pkg -target /
```

## Distribution

### Option 1: Direct Download (Simplest)

Just upload `WordFTW-Add-in-Installer.pkg` to your server or GitHub releases:

```bash
# Upload to your server
scp WordFTW-Add-in-Installer.pkg user@server:/path/to/downloads/

# Or create GitHub release and attach it
```

**Users:** Download the .pkg file and double-click it. Done!

### Option 2: DMG File (More Professional)

Wrap the .pkg in a DMG for a more polished distribution:

```bash
# Create a DMG containing the .pkg
hdiutil create -volname "WordFTW Installer" \
  -srcfolder WordFTW-Add-in-Installer.pkg \
  -ov -format UDZO WordFTW-Installer-Mac.dmg
```

Users download the DMG, open it, and double-click the .pkg inside.

### Option 3: Code Signing (Recommended for Production)

If you have an Apple Developer account:

```bash
# Sign the .pkg installer
productsign --sign "Developer ID Installer: Your Name (TEAM_ID)" \
  WordFTW-Add-in-Installer.pkg \
  WordFTW-Add-in-Installer-signed.pkg

# Verify signature
pkgutil --check-signature WordFTW-Add-in-Installer-signed.pkg

# Submit for notarization
xcrun notarytool submit WordFTW-Add-in-Installer-signed.pkg \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password" \
  --wait

# Staple the notarization ticket
xcrun stapler staple WordFTW-Add-in-Installer-signed.pkg

# Verify notarization
spctl --assess --verbose --type install \
  WordFTW-Add-in-Installer-signed.pkg
```

**Note:** For .pkg files, you need a "Developer ID Installer" certificate (not "Developer ID Application").

## First Launch Security

### For Unsigned .pkg

When users try to run an unsigned .pkg, macOS will show:

> "WordFTW-Add-in-Installer.pkg can't be opened because it is from an unidentified developer."

**Solution:**
1. Right-click (or Control-click) the .pkg file
2. Select "Open" from the menu
3. Click "Open" in the security dialog
4. The Installer app will launch normally

### For Signed .pkg

If the .pkg is signed with a Developer ID Installer certificate, users will see:

> "This package will run a program to determine if the software can be installed."

They just click "Continue" and it installs without warnings.

### For Signed + Notarized .pkg

This is the gold standard - **no warnings at all**. Users just double-click and it installs immediately.

## What the Installer Does

When users double-click the .pkg file:

1. **macOS Installer.app opens** - Shows standard installation UI
2. **User clicks "Install"** - Standard macOS installation flow
3. **Background installation runs**:
   - Closes Word if running
   - Downloads latest manifest.xml from production server
   - Registers add-in in Word preferences
   - Downloads sample document
   - Opens Word automatically with the document
4. **Notification appears** - "Installation Complete" notification
5. **Installation log created** at `~/.wordftw-addin/install.log`

**User experience:** Click "Install" button, wait 10-15 seconds, Word opens with add-in ready to activate.

## Customization

### Change Server URL

Edit `pkg-install-script.sh` and update:

```bash
MANIFEST_URL="https://your-server.com/manifest.xml"
DOC_URL="https://your-server.com/documents/working/default.docx"
```

### Change Package Name

In `build-mac-pkg.sh`:

```bash
PKG_NAME="YourCompany-Add-in-Installer.pkg"
```

### Change Package Identifier

In `build-mac-pkg.sh`, update the `--identifier` parameter:

```bash
pkgbuild --nopayload \
  --scripts "$SCRIPTS_DIR" \
  --identifier "com.yourcompany.addin.installer" \
  ...
```

## Troubleshooting

### Build fails with "command not found: pkgbuild"

You need Xcode command-line tools:

```bash
xcode-select --install
```

### .pkg won't install - "damaged or can't be verified"

This happens if the .pkg was downloaded and quarantined by macOS:

```bash
# Remove quarantine attribute
xattr -cr WordFTW-Add-in-Installer.pkg
```

Then right-click the .pkg and choose "Open".

### Installation says "Failed to download manifest"

This means:
- No internet connection during installation
- Server is down (https://wordftw.onrender.com)
- Firewall blocking the connection

The user can retry the installation when connectivity is restored.

### "Registration verification failed" in the log

This is usually **normal** if:
- Word hasn't been launched yet (no preferences file)
- Word is not licensed

The add-in will still work once Word is properly licensed and launched.

### Permissions error during build

```bash
chmod +x build-mac-pkg.sh pkg-install-script.sh
```

### Testing on different Macs

Transfer the `.pkg` file to other Macs for testing. Remember the first-launch security bypass for unsigned packages (right-click > Open).

## Migration from .command File

The `.pkg` installer provides the **same functionality** as the old `.command` file, but with a professional, native macOS installation experience. Users just download and double-click - no terminal needed.

## Support

Installation logs are saved to: `~/.wordftw-addin/install.log`

If users encounter issues, ask them to send this log file.

