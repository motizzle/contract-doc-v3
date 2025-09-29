## Versions — Feature Spec (Draft)

### Scope
- Add a Versions tab in the right panel (placed to the left of Activity).
- Track sequential integer versions starting at 1 (the default canonical document).
- Persist a new version on every Save.
- Allow viewing any prior version without changing the current/default unless explicitly checked out and checked in after viewing.

### Data Model
- Storage (working): `data/working/versions/`
- Per saved version N (N ≥ 2 initially; Version 1 is inferred from canonical):
  - `v{N}.docx` — full snapshot of the DOCX at save time
  - `v{N}.json` — metadata:
    - `version` (int)
    - `savedBy` { `userId`, `label` }
    - `savedAt` (ISO string)
- Version 1 represents the canonical default document and will appear in the list even if no working versions exist.
- Factory reset clears `data/working/versions/*` entirely.

### Server Endpoints
- POST `/api/v1/save-progress`
  - Inputs (JSON): `{ note?: string }`
  - Behavior:
    - Increment `serverState.documentVersion` by 1.
    - Capture current document as `data/working/versions/v{documentVersion}.docx`.
    - Write `data/working/versions/v{documentVersion}.json` metadata.
    - Broadcast `saveProgress` and `versions:update`.
  - Notes:
    - Existing save flows (`Word` vs `Web`) remain; this adds persistence and metadata.

- GET `/api/v1/versions`
  - Returns newest-first list of versions with `{ version, savedBy, savedAt, note }`.
  - Returns newest-first list of versions with `{ version, savedBy, savedAt }`.
  - Includes inferred Version 1:
    - `version: 1`
    - `savedBy: { userId: 'system', label: 'System' }`
    - `savedAt: serverState.lastUpdated || null`
    - `note: 'Default document'`

- GET `/api/v1/versions/:n`
  - Streams/downloads `v{n}.docx` if present.
  - For `n = 1`, returns the canonical default document.

- POST `/api/v1/versions/view`
  - Inputs (JSON): `{ version: number }`
  - Behavior:
    - Does NOT change `serverState.documentVersion` or default document.
    - Broadcast `version:view` with selected version so clients transiently load that version.

- Factory Reset
  - Also delete `data/working/versions/*`.
  - Clients revert to showing Version 1 only.

### Client UI — Versions Tab
- Position: left of Activity tab.
- List view: newest-first cards; each card shows:
  1) "Version N"
  2) "Last saved by <user> at <date time TZ>"
  3) `<note>` (optional)
  4) `current` badge when `N === config.documentVersion`
  5) `viewing` badge when `N === viewingVersion` (client state)

- Empty state:
  - If no working versions exist, list shows only Version 1.

- Interactions:
  - Clicking a card opens a confirmation modal: "Are you sure you want to view this version?"
    - Confirm loads that version into the editor (without changing current/default).
  - Save flow: when the user clicks Save, persist the snapshot automatically; upon success, refresh versions list.

### Client State
- Add `viewingVersion` to UI state (defaults to `config.documentVersion` on load).
- Update it when viewing a specific version; reset to latest when loading "View Latest" or after check-in.

### Versioning Rules
- Version numbers are integers starting at 1.
- Version 1 = original/default document (canonical).
- Each successful Save creates a new version (N → N+1) and persists snapshot+metadata.
- Viewing a version is read-only; default/current only changes via explicit checkout/check-in flows.
- Clearing working data deletes all saved versions.

### Telemetry & SSE (nice-to-have)
- Broadcast `versions:update` after saves so clients can refresh the list.
- Broadcast `version:view` on view requests so multiple clients can reflect viewing state if desired.

### Out of Scope (for now)
- Diff/compare UI between versions.
- Branch or tag support.
- Server-side search of notes.


