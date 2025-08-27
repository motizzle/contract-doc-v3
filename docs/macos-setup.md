# macOS Setup

## Prerequisites
- Node 18+ / npm 9+
- Word for Mac
- Docker Desktop (optional)
- LibreOffice (optional)

## Certs / helpers
`ash
npx office-addin-dev-certs install
# LibreOffice:
brew install --cask libreoffice
# or:
export SOFFICE_PATH="/Applications/LibreOffice.app/Contents/MacOS/soffice"
`

## Start services
Terminal 1 (collab):
`ash
cd collab && npm ci && node server.js
# or Docker: cd ops/docker && docker compose up --build -d
`
Terminal 2 (server):
`ash
cd server && npm ci && node src/server.js  # https://localhost:4001
`
Terminal 3 (addin):
`ash
cd addin && npm ci
npm run dev-server  # https://localhost:4000
npm start         # sideload Word add-in
`

Open https://localhost:4001

## Notes
- Trust dev certs in Keychain if prompted
- Ports: 4000/4001/4002
- If compile fails, set SOFFICE_PATH explicitly
