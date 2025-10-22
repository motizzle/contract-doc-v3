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

# Register the HTTPS catalog with Word
echo "Registering add-in catalog..."
CATALOG_URL="https://wordftw.onrender.com"

# Create preferences directory if it doesn't exist
PREF_DIR="$HOME/Library/Preferences"
PLIST_FILE="$PREF_DIR/com.microsoft.office.plist"

# Use defaults command to add the catalog
defaults write com.microsoft.office OfficeWebAddinCatalogUrl -string "$CATALOG_URL"

echo ""
echo "========================================"
echo " Installation Complete!"
echo "========================================"
echo ""
echo "The catalog has been registered:"
echo "$CATALOG_URL"
echo ""
echo "Word will now open. To use the add-in:"
echo ""
echo "1. Click the 'Insert' tab"
echo "2. Click 'My Add-ins'"
echo "3. Click 'SHARED FOLDER' at the top"
echo "4. Click 'Redlined & Signed'"
echo ""
echo "Press any key to open Word now..."
read -n 1 -s

# Open Word
open -a "Microsoft Word"

exit 0

