# Infrastructure and Stack Plan

## Local server management and smoke

### Server Architecture

The application uses **4 servers** working together:

**Required Servers:**

1. **Port 4000 - Webpack Dev Server** (Add-in Frontend)
   - Technology: Webpack dev server with hot-reload
   - Purpose: Serves Word add-in HTML/JS/CSS during development
   - Location: `addin/` folder
   - Start: `npm run dev-server` in `addin/`

2. **Port 4001 - Main Backend API** (Express)
   - Technology: Express.js (Node.js) with HTTPS
   - Purpose: 
     - Serves web viewer (`web/view.html`)
     - All REST API endpoints (`/api/v1/*`)
     - Server-Sent Events (SSE) for **application state sync** (`/api/v1/events`)
     - Static file serving
     - WebSocket proxy to port 4002 (collaboration)
   - Location: `server/src/server.js`
   - Start: `node server/src/server.js`

**Optional Servers:**

3. **Port 4002 - Collaboration Server** (Hocuspocus)
   - Technology: Hocuspocus (Y.js CRDT server for SuperDoc)
   - Purpose: Real-time document collaboration (Google Docs-style simultaneous editing)
   - Location: `collab/server.js`
   - Start: `node collab/server.js`
   - **Note:** Currently optional - app works in single-user mode without it
   - **Status:** May require `npm install` in `collab/` folder before first use

4. **Port 11434 - AI Server** (Ollama - External)
   - Technology: Ollama (LLaMA/Gemma models)
   - Purpose: Powers AI chat features in the sidepane
   - Location: External service (not part of this codebase)
   - Start: Must be started separately via Ollama
   - **Note:** Optional - app works without AI features if not running

### Two Types of Real-Time Sync

**SSE (Server-Sent Events) - Port 4001:**
- Syncs: Application state (checkout, variables, approvals, messages)
- Flow: Server → Clients (one-way push)
- Always active when server is running

**Hocuspocus/Y.js - Port 4002:**
- Syncs: Document content in real-time (character-by-character)
- Flow: Bidirectional WebSocket with CRDT
- Only needed for multi-user simultaneous editing

### Management Scripts

**Helpers (double-click from Windows Explorer):**
- `tools/scripts/start-servers.bat` – start 4000/4001/4002
- `tools/scripts/status-servers.bat` – display listeners
- `tools/scripts/stop-servers.bat` – stop 4000/4001/4002

**PowerShell helper (alternative):**
- `tools/scripts/servers.ps1` with `-Action start|stop|restart|status`
  - Example:
    - `.\tools\scripts\servers.ps1 -Action restart`
    - `.\tools\scripts\servers.ps1 -Action status`

**Smoke test:**
- `tools/scripts/smoke.ps1`
  - Backend direct: `pwsh tools/scripts/smoke.ps1`
  - Via dev proxy: `pwsh tools/scripts/smoke.ps1 -Base https://localhost:4000`
  - Verifies health, initial SSE hello, and a client event

## Goals
- Maximize the server: move logic, permissions, and state computation to the backend.
- Identical client data pipelines: both Word addin and Web consume the same endpoints and JSON contracts.
- Identical rendering: shared client modules produce the same UI; diverge only where platform constraints force it.
- Reuse aggressively: one modal system, one banner system, one statematrix client.
- SuperDoc provides the documentediting backbone (frontend + collaboration backend); our server orchestrates product workflows.

Reference: https://docs.superdoc.dev/

## Components

### Backend Services

**Main Server (`server/src/server.js` - Port 4001)**
- Responsibilities: 
  - State matrix generation and distribution
  - Approvals, finalize/unfinalize workflows
  - Document version management
  - File orchestration (uploads, versions, snapshots)
  - SSE events for application state sync
  - WebSocket proxy to collaboration server
- HTTPS dev server at `https://localhost:4001`
- Exposes uniform REST + SSE APIs consumed by both clients
- Serves web viewer static files

**Collaboration Server (`collab/server.js` - Port 4002)**
- Technology: Hocuspocus (Y.js CRDT server)
- Responsibilities:
  - Real-time document collaboration (multi-user editing)
  - Conflict-free replicated data type (CRDT) sync
  - WebSocket connections for live editing sessions
- Status: Optional - app functions without it in single-user mode
- Accessed via: Main server proxy at `/collab` endpoint

### Frontend Clients

**Word Add-in (`addin/` - Port 4000)**
- Technology: Webpack dev server (HTTPS)
- Purpose: Taskpane UI for Microsoft Word
- Dev server serves HTML/JS/CSS with hot-reload
- Runtime: Connects to main API server (port 4001) for all data
- Location: `addin/src/taskpane/`

**Web Viewer (`web/` - Served by Port 4001)**
- Technology: Static HTML + React + SuperDoc SDK
- Purpose: Browser-based document editor
- Served by: Main server (port 4001)
- Location: `web/view.html`

**Shared UI (`shared-ui/`)**
- Location: `shared-ui/components.react.js`
- Components: State matrix client, modals, banners, tabs, panels
- Consumed by: Both Word add-in and web viewer (identical UI)

### SuperDoc Integration

**SuperDoc Frontend SDK**
- Embedded in both clients for rich DOCX editing
- Features: Comments, track changes, field annotations, toolbar
- Location: `/vendor/superdoc/superdoc.umd.min.js`
- Configuration: `web/superdoc-init.js`

**SuperDoc Collaboration**
- Backend: Hocuspocus server (port 4002)
- Connection: SuperDoc SDK → Port 4001 `/collab` proxy → Port 4002
- Purpose: Real-time multi-user editing (optional)

### Data Storage

**App Data (`data/app/`)**
- Canonical users, roles, permissions
- Seed documents and variables
- Configuration files
- Safe to commit (demo data)

**Working Data (`data/working/`)**
- User uploads and edited documents
- Document versions and snapshots
- Activity logs
- Temporary files
- Ignored by VCS

## Data Flow

### Application State Sync (via SSE)

```
User Action (checkout, save, approve)
   ↓
Main Server (4001) - Update state, compute new state matrix
   ↓
Broadcast SSE Event (/api/v1/events)
   ↓
All Connected Clients (web + Word) - Refresh UI
```

**Flow:**
1. User performs action (checkout, create variable, approve, etc.)
2. Client sends REST API request to main server (port 4001)
3. Server updates internal state (JSON files in `data/app/`)
4. Server broadcasts SSE event to all connected clients
5. All clients receive event, refresh state matrix, update UI

**SSE Event Types:**
- `checkout`, `checkin`, `save-progress`
- `variable:created`, `variable:updated`, `variable:deleted`
- `approvals:update`
- `message:thread-created`, `message:post-added`
- `documentUpload`, `documentRevert`

### Document Collaboration (via Hocuspocus - Optional)

```
User types in SuperDoc editor
   ↓
SuperDoc SDK - Create Y.js operation
   ↓
WebSocket to wss://localhost:4001/collab
   ↓
Main Server (4001) - Proxy WebSocket
   ↓
Hocuspocus Server (4002) - Apply CRDT merge
   ↓
Broadcast to other users' SuperDoc instances
   ↓
Other users see changes in real-time
```

**Flow:**
1. User edits document in SuperDoc editor
2. SuperDoc SDK generates Y.js CRDT operations
3. WebSocket connection to main server `/collab` endpoint
4. Main server proxies WebSocket to Hocuspocus (port 4002)
5. Hocuspocus merges changes using CRDT algorithm
6. Hocuspocus broadcasts to all connected SuperDoc instances
7. Other users see character-by-character updates

**Note:** This flow only active when port 4002 is running. Without it, app works in single-user mode.

## Prototype Mode (simplifications)
- No authentication and no database.
- Use in-memory state with optional JSON file persistence under `data/app` (seed) and `data/working` (temp).
- Ship with four canonical demo users and a simple user switcher (no Okta).
- Single-process server; SSE for realtime; no email automation, vendor portal, or MSI packaging.
- Minimal error handling/logging suitable for demos; add robustness later.

## API Contracts (uniform for both clients)
- GET `/api/current-document`  metadata
- GET `/api/state-matrix?platform&userId`  JSON config to drive UI (server derives role)
- GET `/api/approvals/state?documentId`
- GET `/api/approval-matrix?actorPlatform&actorId&documentId`
- POST `/api/approvals/*` (approve|reject|add-user|reorder|update-notes)
- POST `/api/finalize`, `/api/unfinalize`
- SSE `/api/events`

## Rendering & Reuse
- Single React-based UI layer loaded via CDN and served from one module:
  - React/ReactDOM included via CDN in both clients.
  - One ES module under `server/public/ui/` exports shared components (Modal, Banner, Dropdown, Finalize, Approvals) and mount helpers.
  - Both clients import the same module; state/props come from the server state matrix.
  - No bundlers; HTML-first for fast Office WebView startup.

## Auth
- No authentication. Clients include a local user switcher; server trusts user selection for demos.

## Build & Dev

### Prerequisites
- Node 18+
- npm (comes with Node)
- Ollama (optional - for AI features)

### First-Time Setup

```powershell
# Install dependencies for all components
npm install --prefix server
npm install --prefix addin
npm install --prefix collab  # Optional - for collaboration features

# Generate dev certs (for HTTPS)
powershell -NoProfile -ExecutionPolicy Bypass -File server/scripts/dev-cert.ps1
```

### Starting the Application

**Quick start (all servers):**
```cmd
tools\scripts\start-servers.bat
```

**Or via PowerShell:**
```powershell
.\tools\scripts\servers.ps1 -Action start
```

This starts:
- Port 4000: Add-in dev server (Webpack)
- Port 4001: Main API server (Express)
- Port 4002: Collaboration server (Hocuspocus) - may show warning if deps not installed

**Manual start (individual servers):**
```powershell
# Terminal 1: Main server
cd server
node src/server.js

# Terminal 2: Add-in dev server  
cd addin
npm run dev-server

# Terminal 3: Collaboration (optional)
cd collab
node server.js
```

### Development Workflow

1. **Web viewer:** Navigate to `https://localhost:4001`
2. **Word add-in:** Run sideload after servers are running:
   ```powershell
   .\tools\scripts\servers.ps1 -Action sideload
   ```

### Port Reference
- **4000** - Add-in frontend (Webpack dev server)
- **4001** - Main backend API + web viewer + SSE
- **4002** - Collaboration (Hocuspocus) - optional
- **11434** - AI server (Ollama) - external, optional

### Troubleshooting

**Port 4002 not starting:**
- Check if dependencies installed: `cd collab && npm install`
- Collab is optional - app works without it

**HTTPS certificate errors:**
- Run: `powershell -File server/scripts/dev-cert.ps1`
- Trust the generated certificate in Windows

**Health checks:**
```powershell
# Check which ports are listening
.\tools\scripts\servers.ps1 -Action status

# Smoke test backend
pwsh tools/scripts/smoke.ps1
```

## Testing
- Unit tests: server business rules; shared client state application.
- Integration tests: API + SSE; crossclient parity checks (same state  same visible UI).
- Snapshot tests for menu/modal configs derived from the state matrix.

## Environments & Config
- `.env` for server (ports, SuperDoc endpoints, storage roots). Okta variables reserved for later phases.
- Config profiles (dev/stage/prod) under `server/config/`.
- Self-hosted SuperDoc backend URL(s) configured per environment.

## Storage and Files
- Document storage handled by SuperDoc backend.
- Our server stores lightweight metadata and workflow state; large binaries flow through SuperDoc.
- File management orchestrator exposes "View Latest", finalize/draft toggles, and safe replace.

## Branching Strategy (featurealigned)
- `main`: stable.
- Feature branches named after Project Summary features, e.g.: `feat/okta-auth`, `feat/approvals`, `feat/finalize`, `feat/templates`, `feat/variables`, `feat/signatures`, `feat/vendor-experience`, `feat/lock-sections`, `feat/ai-basics`, `feat/file-management`.
- Parity rule: a feature is complete when both clients function with the same server contracts.

## What we need from SuperDoc
... (content duplicated)
