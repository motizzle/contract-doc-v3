# WordFTW: Redline Like You Mean It

Consider this a new type of brief. A prototype. An idea. A vision statement and meeting combined with a video and a bunch of words. Hopefully something useful in accelerating our progress.

I wrote this with my 5 buddies: Claude 3.5 and 4, GPT o3, 4, and 5, but most  came from GPT 5. 

Yes, it's vibe coding. No, that's not a bad word. If you want to see more of my thoughts about working with AI, see `docs/workingwithAI.md`

This is not production code. If you look at it that way, it will disappoint you. Now, let's begin.

---

## TL;DR

- Open PowerShell and run:

```powershell
# From repo root
./tools/scripts/servers.ps1 -Action start
```

- What this does:
  - Starts collaboration backend on 4002
  - Starts HTTPS server on 4001 (serves API, shared UI, and web viewer)
  - Starts the Word add‑in dev server on 4000 and sideloads Word
- Then visit the web viewer at: https://localhost:4001

- On macOS: see `docs/macos-setup.md` for setup and commands

If you prefer artisanal hand-crafted terminals, see Manual start below.

---

## What is this?

An end-to-end demo of a contract authoring system that:
- Runs inside Word (Office add‑in) and in the browser
- Uses a single server‑computed “state matrix” to decide what the UI shows (buttons, banners, finalize, approvals, etc.) across both clients
- Pushes live updates via Server‑Sent Events
- Keeps a canonical document plus a working overlay and can compile a PDF packet from exhibits (when LibreOffice is installed)

Read the plain‑English explainer and product brief:
- `docs/state-matrix-plain-english.md`
- `docs/Project-Summary.md`

---

## Technical stack

- Server (`server/`)
  - Node + Express over HTTPS on 4001; unified origin for API, web, and add‑in assets
  - State Matrix API (`/api/v1/state-matrix`), SSE (`/api/v1/events`), file endpoints, approvals API
  - PDF compile: LibreOffice (DOCX→PDF) + `pdf-lib` merge
  - Collab WS reverse proxy at `/collab` to the SuperDoc backend
- Shared UI (`shared-ui/components.react.js`)
  - Single React 18 UMD module rendered by both Web and Word add‑in
  - Drives buttons, banners, modals; calls server actions
- Web client (`web/`)
  - HTML shell (`view.html`) + brand CSS + SuperDoc UMD loaded via `/web/superdoc-init.js`
  - Right pane mounts the same Shared UI
- Word add‑in (`addin/`)
  - Office.js taskpane; webpack dev server on 4000; loads Shared UI module
  - Uses Office APIs to export/insert DOCX for Save Progress / View Latest
- Collab backend (`collab/`)
  - Hocuspocus server (Yjs) on port 4100; typically accessed as `http://localhost:4002` via Docker or direct
- Data model (`data/`)
  - Canonical under `data/app`, working overlays under `data/working`

See also: macOS setup guide (`docs/macos-setup.md`).

---

## Repo layout

- `server/` — Node HTTPS server, API, SSE, static assets, shared UI publish
- `shared-ui/` — One React module used by both Word add‑in and Web
- `web/` — HTML shell for the web editor (loads shared UI + SuperDoc)
- `addin/` — Word add‑in (task pane) using Office.js + webpack dev server
- `collab/` — Local collaboration stub (proxied through the main server)
- `data/app/` — Canonical data (default.docx, exhibits, approvals config)
- `data/working/` — Working overlays, compiled packets, logs, uploads
- `tools/scripts/` — Dev helpers; use `servers.ps1` to start/stop

---

## Installation

1) Get the code

```powershell
# Option A: Clone
git clone <repo-url>
cd wordFTW  # or the folder name you cloned into

# Option B: Download ZIP and extract, then:
cd path\to\wordFTW
```

2) Prerequisites

- Windows 10/11
- Node.js 18+ and npm 9+ (verify with `node -v` and `npm -v`)
- Microsoft Word (desktop) for the add‑in experience (web viewer works without Word)
- PowerShell 5+ or PowerShell 7+
- Optional: LibreOffice (for DOCX→PDF compile)

3) First‑time setup

```powershell
# Allow local scripts for current user (safe for dev boxes)
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force

# Verify Node is available
node -v
npm -v

# (Optional) Trust Office dev HTTPS certs (enables https://localhost:4001)
npx office-addin-dev-certs install
```

Notes:
- The orchestration script will auto‑install dependencies on first run (`npm ci` in `server`, `addin`, and `collab`). If you’re behind a corporate proxy, run `npm ci` manually in those folders first.
- When Windows prompts for firewall access for Node/Word, click Allow.
- Ensure ports 4000, 4001, and 4002 are free. Use `./tools/scripts/servers.ps1 -Action stop` if needed.
- Using macOS? See `docs/macos-setup.md` for a copy‑paste setup.

---

## Quickstart (Windows + PowerShell)

Prereqs:
- Node 18+
- Microsoft Word (desktop)
- PowerShell with script execution allowed for local scripts
- Optional: LibreOffice for PDF compile (see Compile below)

Steps:
1) From repo root, run the orchestrator:
```powershell
./tools/scripts/servers.ps1 -Action start
```
2) Web viewer: open https://localhost:4001
3) Word: the add‑in should sideload automatically. If Word is already open, the script will skip launching it; just refresh the add‑in.

Helpful variants:
```powershell
./tools/scripts/servers.ps1 -Action status   # who’s listening on 4000/4001/4002
./tools/scripts/servers.ps1 -Action stop     # stop all the things
./tools/scripts/servers.ps1 -Action sideload # only (re)launch the add‑in
```

### macOS quickstart

- Follow `docs/macos-setup.md` for Terminal commands, dev certs, and port notes.

---

## Manual start (for the brave)

In three terminals from repo root:

1) Collaboration backend (port 4002)
```powershell
node collab/server.js
```

2) Main server (port 4001)
```powershell
# Prefer HTTPS (Office dev certs). If you must: $env:ALLOW_HTTP='true'
cd server
npm ci
node src/server.js
```

3) Word add‑in dev server (port 4000) + sideload Word
```powershell
cd addin
npm ci
npm run dev-server  # webpack at https://localhost:4000
npm start           # sideloads Word with the add‑in
```

Web viewer lives at https://localhost:4001

---

## Collab via Docker (optional)

Use `ops/docker/docker-compose.yml` to run the SuperDoc collab backend in a container.

```bash
cd ops/docker
docker compose up --build -d   # maps host 4002 -> container 4100
```

- The server already defaults to `SUPERDOC_BASE_URL=http://localhost:4002`.
- Stop with `docker compose down`. Logs: `docker compose logs -f superdoc`.
- If using Docker for collab, start server/add‑in manually (see Manual start).

---

## How it works (short version)

- Server computes a state matrix at `/api/v1/state-matrix` using:
  - user role, platform (web/word), checkout/finalize state, feature toggles
- Clients (Word + Web) render the exact same React UI from `shared-ui/components.react.js`
  - Word loads it in the taskpane (`addin/src/taskpane/taskpane.html`)
  - Web loads it into the right pane of `web/view.html`
- Live updates via `/api/v1/events` (SSE)
- One doc to rule them all:
  - Canonical: `data/app/documents/default.docx`
  - Working overlay: `data/working/documents/default.docx`
  - Endpoints: `/documents/canonical/default.docx`, `/documents/working/default.docx`

Buttons you’ll see (depending on state/role): Checkout, Check‑in and Save, Cancel Checkout, Save Progress, Override Checkout, Finalize, Unfinalize, Send to Vendor, Back to OpenGov, Request review, Compile, Factory Reset, Open New Document, View Latest.

---

## Useful endpoints (sampling)

- Health: `GET /api/v1/health`
- State matrix: `GET /api/v1/state-matrix?platform=web|word&userId=user1`
- Users + roles: `GET /api/v1/users`
- Checkout: `POST /api/v1/checkout` → `{ userId }`
- Check‑in: `POST /api/v1/checkin` → `{ userId }`
- Cancel checkout: `POST /api/v1/checkout/cancel` → `{ userId }`
- Override checkout: `POST /api/v1/checkout/override` → `{ userId }`
- Finalize / Unfinalize: `POST /api/v1/finalize|unfinalize` → `{ userId }`
- Save progress (Word/Web): `POST /api/v1/save-progress` → `{ userId, base64, platform }`
- Approvals: `GET /api/v1/approvals`, `POST /api/v1/approvals/set`, `/notify`, `/reset`
- Exhibits: `GET /api/v1/exhibits`, `POST /api/v1/exhibits/upload`
- Compile packet: `POST /api/v1/compile` → `{ exhibits: ["ExhibitA.pdf"] }` returns `/compiled/packet-<ts>.pdf`

SSE: `GET /api/v1/events` (server broadcasts `checkout`, `checkin`, `saveProgress`, `approvals:update`, etc.)

---

## Compile (PDF packet)

- Requires LibreOffice (for DOCX→PDF): either in PATH as `soffice`/`soffice.com` or set `SOFFICE_PATH` env var
- Server merges converted document plus any selected exhibit PDFs into `data/working/compiled/packet-*.pdf`

If you see a brief “compile failure” flash, that’s just dramatic tension while the button asks LibreOffice how its day is going.

---

## Data model (files you can poke)

- Canonical doc: `data/app/documents/default.docx` (do not edit while running)
- Working doc: `data/working/documents/default.docx` (created by Save Progress)
- Exhibits (canonical): `data/app/exhibits/`
- Exhibits (working): `data/working/exhibits/`
- Approvals store: `data/app/approvals.json` (auto‑managed)
- Theme tokens: `data/app/theme.json` (optional; colors and pulses!)

Factory reset clears working overlays, approvals data, and snapshots.

---

## Troubleshooting

- Ports already in use (4000/4001/4002):
  - Use `./tools/scripts/servers.ps1 -Action stop` to clear listeners
- HTTPS complaints / certs:
  - Server auto‑tries Office dev certs; you can also place `server/config/dev-cert.pfx` (password `password`) or set `ALLOW_HTTP=true` for dev only
- Word didn’t open:
  - If Word is already running, the script won’t spawn another. Close Word or run `./tools/scripts/servers.ps1 -Action sideload`
- Save Progress fails on Web:
  - Ensure the SuperDoc editor loaded (right pane). The app will log helpful breadcrumbs under Notifications.
- Compile fails:
  - Install LibreOffice and/or set `SOFFICE_PATH` to your `soffice(.exe)`

If all else fails, it’s probably because it’s Monday. Try again Tuesday.

---

## Design notes (why this exists)

- Server is the single source of truth via the state matrix → deterministic UI
- Shared React UI keeps Word/Web in lock‑step (no “web does X, Word does Y” surprises)
- SSE keeps everyone in the loop without heroic polling
- Data lives as simple files in `data/` to keep the prototype database‑free

More: `docs/state-matrix-plain-english.md` and `docs/Project-Summary.md`.

---

## Contributing

- PRs welcome. I'll bring the beach.
- Keep code readable and boring. Button labels can be exciting.

---

## License

MIT for the add‑in template pieces; otherwise prototype‑grade. See headers in individual files as needed.
