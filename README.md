# WordFTW: Redline Like You Mean It

A new type of brief. Consider this a brief. A prototype. An idea. A vision statement and meeting combined with a video and a bunch of words. Hopefully something useful in accelerating our progress down this path.

I wrote this with my 5 buddies. Well no, my buddy #5 wrote this. I helped. This is vibe coding at its finest, and it's the best product brief I've written.

---

## TL;DR

- Windows: ./tools/scripts/servers.ps1 -Action start
- Web viewer: https://localhost:4001
- Word addin dev server: https://localhost:4000 (sideloads automatically)
- Collab backend: http://localhost:4002 (Docker optional)
- macOS users: see docs/macos-setup.md

---

## What is this?

An end-to-end demo that runs in both Word and the Web using one servercomputed state matrix to drive identical UI and behavior.

Read next:
- docs/state-matrix-plain-english.md
- docs/Project-Summary.md

---

## Technical stack

- Server (server/): Express over HTTPS (4001), State Matrix API, SSE, file endpoints, approvals, PDF compile (LibreOffice + pdf-lib), WS proxy /collab
- Shared UI (shared-ui/components.react.js): React 18 UMD consumed by both Web + Addin
- Web (web/): view.html + brand CSS + SuperDoc UMD via /web/superdoc-init.js
- Addin (addin/): Office.js taskpane via webpack dev server (4000); uses Office APIs for DOCX export/insert
- Collab (collab/): Hocuspocus server (Yjs) on 4100, typically mapped to 4002
- Data (data/): Canonical under data/app, working overlays under data/working

---

## Repo layout

- server/, shared-ui/, web/, addin/, collab/, data/, tools/

---

## Installation

1) Get the code
`powershell
# Clone
git clone <repo-url>
cd wordFTW
` 

2) Prereqs
- Node 18+
- Word (desktop) for addin
- Optional: LibreOffice for compile (see Compile)

3) Firsttime setup (Windows)
`powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
npx office-addin-dev-certs install
` 

macOS users: see docs/macos-setup.md

---

## Quickstart (Windows)

`powershell
./tools/scripts/servers.ps1 -Action start
` 

Helpful:
`powershell
./tools/scripts/servers.ps1 -Action status
./tools/scripts/servers.ps1 -Action stop
./tools/scripts/servers.ps1 -Action sideload
` 

---

## Manual start

Terminal 1 (collab):
`powershell
node collab/server.js   # or: cd ops/docker && docker compose up -d
` 
Terminal 2 (server):
`powershell
cd server && npm ci && node src/server.js
` 
Terminal 3 (addin):
`powershell
cd addin && npm ci
npm run dev-server
npm start
` 

---

## Collab via Docker (optional)

`ash
cd ops/docker
docker compose up --build -d   # maps host 4002 -> container 4100
` 
Stop: docker compose down. Logs: docker compose logs -f superdoc.

---

## Compile (PDF)

- Install LibreOffice (soffice in PATH) or set SOFFICE_PATH.
- Server converts DOCXPDF and merges selected exhibits via pdf-lib.

---

## Troubleshooting

- Ports 4000/4001/4002 must be free
- Trust dev certs when prompted (HTTPS)
- If addin doesnt load, close Word and run -Action sideload

---

## Contributing

- PRs welcome. I'll bring the beach.
- Keep code readable and boring. Button labels can be exciting.
