#!/bin/bash

echo "========================================"
echo " Redlined & Signed - Word Add-in Installer"
echo "========================================"
echo ""
echo "This will install the Word add-in..."
echo ""

# Close Word if it's running
echo "Closing Word if running..."
osascript -e 'quit app "Microsoft Word"' 2>/dev/null
sleep 2

# Download manifest to temp location
echo "Downloading manifest..."
TEMP_DIR="$HOME/.wordftw-addin"
mkdir -p "$TEMP_DIR"
curl -s -o "$TEMP_DIR/manifest.xml" "https://wordftw.onrender.com/manifest.xml"

# Register manifest in Office preferences
echo "Registering add-in..."
MANIFEST_ID="wordftw-addin-prod"
defaults write com.microsoft.Word "wef.developer.manifests" -dict-add "$MANIFEST_ID" "$TEMP_DIR/manifest.xml"

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "The add-in has been registered and will appear in:"
echo "Insert > My Add-ins > Developer Add-ins"
echo ""
echo "Press any key to open Word now..."
read -n 1 -s

# Open Word
open -a "Microsoft Word"

exit 0
