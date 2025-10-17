# Compile Packet (PDF) – Feature Spec

**Status:** ✅ Implemented  
**Test Coverage:** 4 tests (Phase 13: Exhibits & Compilation)  
**Last Updated:** August 2024

## Related Documentation
- `features/automated-testing-suite.md` - Test specifications

---

## Summary
Add a Compile action that lets a user select one or more exhibits and generate a single PDF packet: the current document (converted from DOCX) followed by the selected exhibits. The UX matches our existing React modals. Output is served under `/compiled/*` for download.

## Goals
- Provide a consistent, React‑driven Compile modal under a “Compile” button.
- List available exhibits; allow selecting/deselecting; support none selected.
- On “Compile”, convert current DOCX to PDF via LibreOffice and merge with selected exhibit PDFs.
- Return a link to the compiled PDF and open/download it reliably.

## Non‑goals
- Arbitrary file type conversion (exhibits must already be PDFs for v1).
- Page re‑ordering or per‑exhibit page selection.
- Long‑running job queue; synchronous compile is acceptable for prototype‑sized docs.

## UX
- Button location: React right‑pane `ActionButtons`, label “Compile”.
- Opens modal titled “Compile”.
- Body:
  - Section header “Exhibits”.
  - Scrollable list of available exhibits (PDFs) with checkboxes.
  - Optional helper text (e.g., limits) below list.
- Footer buttons: Cancel (secondary) and Compile (primary).
- Result: When server returns `{ ok, url }`, show “Open compiled PDF” link; do not auto‑download in the add‑in.
- Styling: Use existing modal shell (same spacing, border, typography) from shared UI.

## API
- GET `/api/v1/exhibits`
  - Response: `{ items: [{ name, url }] }`
  - Only items with `.pdf` extension are selectable in v1.
- POST `/api/v1/compile`
  - Body: `{ exhibits: string[] }` where each string is a file name from exhibits.
  - Response: `{ ok: true, url: "/compiled/<file>.pdf" }` on success.
  - Errors: `400|404 no_default_doc`, `500 convert_failed|merge_failed|compile_failed`.

## Server Implementation
- Conversion: LibreOffice (`soffice --headless --convert-to pdf --outdir <dir> <docx>`).
- Merge: Use a Node PDF merger (`pdf-lib`) to append the DOCX‑PDF followed by each exhibit PDF.
- Storage: Write outputs to `data/working/compiled/`, served at `/compiled/*` (no caching headers required).
- Config: Support `SOFFICE_PATH` env var override; default command `soffice`.
- Security: Only allow exhibit names originating from our exhibits listing; block path traversal; ignore non‑PDF.
- SSE: Broadcast `{ type: 'compile', name }` on success (optional for future UI hooks).

## Client Implementation (React)
- Add “Compile” button in `ActionButtons`.
- Modal(`CompileModal`):
  - Fetch exhibits on open; checkbox list bound to internal Set.
  - POST selected exhibit names; show error banner on failure.
  - On success, show anchor to the returned URL (target=_blank).
- Keep parity across web and add‑in; no native dialogs.

## Testing
- Unit/integration (Jest):
  - `/api/v1/compile` with no exhibits returns PDF URL.
  - Invalid/no default.docx returns 404.
  - With 1–2 exhibits (PDF fixtures) returns merged PDF; verify byte size increases and PDF magic `%PDF`.
  - If LibreOffice not installed, mock `execFile` and assert behavior; mark real‑convert tests as skipped when unavailable.
- E2E (Playwright):
  - Open modal, select exhibits, click Compile, assert link appears and returns 200.
  - Verify compiled link downloads/openable.

## Edge Cases
- No exhibits present: still compile document‑only PDF.
- Empty/very small DOCX or conversion failure: return 500 with error; modal shows error.
- Large exhibits: synchronous merge may be slow; acceptable for prototype.
- Concurrent compiles: filenames include timestamp to avoid collisions.

## Rollout
- Ship behind no flag (prototype).
- Ensure LibreOffice is documented in installation notes; fallback to error with clear message when missing.

## Additional notes
- Limit exhibit total to 5

