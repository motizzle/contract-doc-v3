# Installation and Dev Setup (WordFTW)

This is the canonical install guide for this repo. For a quick overview, see the root `README.md`.

## Prerequisites
- Windows 10/11
- Microsoft Word (desktop)
- Node.js 18+ and npm 9+
- PowerShell 5.1+ or PowerShell 7+
- Optional: LibreOffice for PDF compile

Ports in use:
- App server (API + web + shared UI): `https://localhost:4001`
- Word add‑in dev server: `https://localhost:4000`
- Collab backend (proxied): `http://localhost:4002`

## One-command start (recommended)

From repo root:

```powershell
./tools/scripts/servers.ps1 -Action start
```

What it does:
- Starts the main server on 4001 over HTTPS
- Starts the Word add‑in dev server on 4000 and sideloads Word
- Optionally starts/uses the collab backend on 4002

Helpful:
```powershell
./tools/scripts/servers.ps1 -Action status
./tools/scripts/servers.ps1 -Action stop
./tools/scripts/servers.ps1 -Action sideload
```

## First-time setup

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
node -v
npm -v

# Install HTTPS dev certs for Office tooling (recommended)
npx office-addin-dev-certs install
```

If you see HTTPS errors starting the server, either install a PFX at `server/config/dev-cert.pfx` (password `password`) or temporarily set `ALLOW_HTTP=true` for dev only.

## Manual start (advanced)

Open three terminals from repo root:

1) Collab backend (optional)
```powershell
node collab/server.js
```

2) Main server (4001)
```powershell
cd server
npm ci
node src/server.js
```

3) Word add‑in (4000)
```powershell
cd addin
npm ci
npm run dev-server
npm start
```

Open the web viewer at `https://localhost:4001`.

## Troubleshooting

- Ports busy: run `./tools/scripts/servers.ps1 -Action stop`
- HTTPS/certs: install Office dev certs or place `server/config/dev-cert.pfx`; or set `ALLOW_HTTP=true` for dev only
- Word didn’t open: rerun `./tools/scripts/servers.ps1 -Action sideload`
- Compile fails: install LibreOffice or set `SOFFICE_PATH`

## macOS

See `docs/macos-setup.md` for a macOS‑specific guide.
