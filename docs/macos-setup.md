# macOS Setup

This project runs on macOS. Follow these steps to run the web app, API server, collab backend, and Word add‑in.

## Prerequisites

- macOS 12+
- Node.js 18+ and npm 9+ (`node -v`, `npm -v`)
- Word for Mac (for the add‑in)
- Docker Desktop (optional, for collab backend)
- LibreOffice (optional, for Compile)

Install helpers:
```bash
# Dev HTTPS certs for Office tooling
npx office-addin-dev-certs install

# LibreOffice (either):
brew install --cask libreoffice
# or: export SOFFICE_PATH="/Applications/LibreOffice.app/Contents/MacOS/soffice"
```

## Start services (manual)

Terminal 1 – Collab backend (pick one):
```bash
# Direct
cd collab && npm ci && node server.js    # listens on 4002 by default

# Or Docker
cd ops/docker && docker compose up --build -d  # maps 4002 -> 4100
```

Terminal 2 – Main server (HTTPS):
```bash
cd server && npm ci && node src/server.js  # https://localhost:4001
```

Terminal 3 – Web add‑in dev server (+ optional sideload):
```bash
cd addin && npm ci
npm run dev-server                         # https://localhost:4000
npm start                                  # sideload Word add‑in
```

Open the web viewer:
```
https://localhost:4001
```

## Notes

- Certificates: trust prompts from dev certs; check Keychain if needed.
- Ports: 4000 (addin), 4001 (server), 4002 (collab).
- Compile: if `soffice` is not in PATH, set `SOFFICE_PATH` to the full path.
- The add‑in can be reloaded via Word’s Office Add-ins menu if it doesn’t sideload automatically.
