#!/bin/bash

echo "========================================"
echo " WordFTW - Local Development Launcher"
echo "========================================"
echo ""

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$SCRIPT_DIR/../.."

# Close Word if running (Mac)
echo "[1/8] Closing Word (if running)..."
if pgrep -x "Microsoft Word" > /dev/null; then
  echo "  - Word is running. Closing for clean sideload..."
  killall "Microsoft Word" 2>/dev/null
  sleep 2
  echo "  - Word closed"
else
  echo "  - Word is not running"
fi
echo ""

# Check for deployed add-in (Mac uses ~/Library/Containers)
echo "[2/8] Checking for deployed add-in..."
ADDIN_PATH=~/Library/Containers/com.microsoft.Word/Data/Documents/wef
if [ -d "$ADDIN_PATH" ]; then
  echo "  - Clearing Office cache..."
  rm -rf "$ADDIN_PATH"/* 2>/dev/null
  echo "  - Cache cleared"
else
  echo "  - No cache found"
fi
echo ""

# Stop existing sideloads
echo "[3/8] Stopping any existing local sideloads..."
echo "  - Skipped (Word already closed in step 1)"
echo ""

# Set up environment
echo "[4/8] Setting up environment..."
echo "  - Environment configured (AI uses demo mode with jokes)"
echo ""

# Kill node processes and start main server
echo "[5/8] Main server..."

# Kill node processes on ports 4000 and 4001
echo "  - Killing Node.js processes on ports 4000, 4001..."
lsof -ti:4000 | xargs kill -9 2>/dev/null
lsof -ti:4001 | xargs kill -9 2>/dev/null
sleep 2

# Start server in new Terminal window
echo "  - Starting server on port 4001..."
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT_DIR/server' && echo 'Starting server on https://localhost:4001...' && echo '' && npm start\""

# Wait for server to start
echo "  - Waiting for server to start..."
sleep 5

# Verify server is running
echo "  - Verifying server is running..."
for i in {1..30}; do
  if lsof -Pi :4001 -sTCP:LISTEN -t >/dev/null; then
    echo "    ✅ Server is listening on port 4001"
    break
  else
    echo "    Waiting for server... ($i/30)"
    sleep 1
  fi
  
  if [ $i -eq 30 ]; then
    echo ""
    echo "========================================"
    echo " Server Failed to Start"
    echo "========================================"
    echo ""
    echo "The main server on port 4001 is not responding."
    echo "Check the Terminal window for error messages."
    echo ""
    echo "Common issues:"
    echo "  1. Port 4001 already in use by another process"
    echo "  2. Missing node_modules (run: cd server && npm install)"
    echo "  3. Environment issues (check server/.env)"
    echo ""
    exit 1
  fi
done
echo "  - Server check passed!"
echo ""

# Start add-in dev server
echo "[6/8] Add-in dev server..."
echo "  - Starting server on port 4000..."
osascript -e "tell application \"Terminal\" to do script \"cd '$ROOT_DIR/addin' && echo 'Starting add-in dev server on https://localhost:4000...' && echo '' && npm run dev-server\""

# Wait for dev server
echo "  - Waiting for dev server to start..."
sleep 5

# Verify dev server is running
echo "  - Verifying dev server is running..."
for i in {1..30}; do
  if lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null; then
    echo "    ✅ Dev server is listening on port 4000"
    break
  else
    echo "    Waiting for dev server... ($i/30)"
    sleep 1
  fi
  
  if [ $i -eq 30 ]; then
    echo ""
    echo "========================================"
    echo " Dev Server Failed to Start"
    echo "========================================"
    echo ""
    echo "The add-in dev server on port 4000 is not responding."
    echo "Check the Terminal window for error messages."
    echo ""
    echo "Common issues:"
    echo "  1. Port 4000 already in use by another process"
    echo "  2. Missing node_modules (run: cd addin && npm install)"
    echo "  3. Webpack configuration issues"
    echo ""
    exit 1
  fi
done
echo "  - Dev server check passed!"
echo ""

# Clear browser session
echo "[7/8] Preparing browser session..."
echo "  - Opening browser to clear old session data..."
open "https://localhost:4001/clear-session.html"
sleep 2
echo "  - Session cleared (browser will auto-redirect)"
echo ""

# Sideload add-in
echo "[8/8] Sideloading local add-in..."
cd "$ROOT_DIR/addin"
echo "  - Working directory: $(pwd)"
echo "  - Running: npx office-addin-debugging start manifest.xml"
npx --yes office-addin-debugging start manifest.xml

if [ $? -eq 0 ]; then
  echo ""
  echo "========================================"
  echo " ✅ Local Development Ready!"
  echo "========================================"
  echo ""
  echo "🌐 Browser: https://localhost:4001 (auto-opened)"
  echo "📦 Add-in: Sideloaded (localhost:4000)"
  echo "📝 Manifest: addin/manifest.xml"
  echo ""
  echo "✅ Both browser and Word use 'default' session"
  echo "✅ Changes sync automatically!"
  echo ""
  echo "Word should open automatically with add-in loaded."
  echo ""
  echo "To stop:"
  echo "  1. Close the Terminal windows running the servers"
  echo "  2. Or manually: npx office-addin-debugging stop addin/manifest.xml"
  echo ""
else
  echo ""
  echo "========================================"
  echo " ⚠ Sideload Failed"
  echo "========================================"
  echo ""
  echo "Possible issues:"
  echo "  1. office-addin-debugging not installed"
  echo "     Fix: npm install -g office-addin-debugging"
  echo ""
  echo "  2. Word already has an add-in sideloaded"
  echo "     Fix: Close Word and try again"
  echo ""
  echo "  3. manifest.xml has errors"
  echo "     Fix: cd addin && npm run validate"
  echo ""
  echo "Try manual sideload:"
  echo "  cd addin"
  echo "  npx office-addin-debugging start manifest.xml"
  echo ""
fi

echo ""
echo "Press Enter to close..."
read

