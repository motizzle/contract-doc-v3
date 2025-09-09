# UI Refactor: Server-driven config + Shared Components (Web + Word)

## Problems Identified (current state)

- Duplicated inline UI and logic per platform
  - `addin/src/taskpane/taskpane.html`: inline modal and pill behaviors; Office Fabric button styling; duplicated mounting/wiring.
  - `web/view.html`: same modal and pill markup/logic duplicated; platform-specific wiring.
  - Both pages manually manage the “Coming 2026” pill animation and modal open/close.

- Button formatting and layout divergence
  - Fabric Core (`.ms-Button`) overrides in taskpane; bespoke styles elsewhere.
  - Buttons configured/laid out in page HTML instead of a single shared React layer; inconsistent variants/spacing.

- Boot/mount duplication
  - Each page probes for React and calls `window.mountReactApp`; inline error rendering and loaders differ.

- Mixed sources of truth for messaging
  - Server composes `config.banners`, but other banner-like messages exist in separate fields (e.g., `viewerMessage`).
  - Names shown as raw ids (e.g., `user1`) instead of display labels; fixed for checkout banner, but needs consistency.

## Target State

- Server is the single source of truth for UI state, labels, and gating
  - All user-facing names resolved on the server (id → label).
  - All banners/messages delivered via `config.banners` only; clients render, not compose.
  - Button visibility and gating come exclusively from `/api/v1/state-matrix`.

- Shared React components handle all UI
  - No inline UI logic in `taskpane.html` or `view.html` beyond mounting a root.
  - Common components in `shared-ui/components.react.js` for: BannerStack, ActionButtons, Notifications, Modals, Pill, BrandHeader.

- Consistent styling and layout
  - One button system (existing `UIButton`) with uniform grid layouts.
  - Branding and theming via `/api/v1/theme` and `web/branding.css`; remove Fabric dependency from taskpane if not needed.

## Phased Plan

### Phase 1 — Server SOT + Remove Inline UI (minimal change)

- Goals
  - Server is authoritative for labels/messages (no raw ids; banners via `config.banners`).
  - Remove inline pill/modal code and markup from platform pages; keep minimal shells (required includes + `#app-root`).
  - Leave boot/mount as-is per platform (no unification yet).

- Work Items (status)
  - [x] Ensure server resolves user labels for banners/messages
    - Checkout owner banner uses display label
    - 409 responses now say “Checked out by {label}”
  - [x] Remove inline pill/modal wiring and markup from platform pages
    - `addin/src/taskpane/taskpane.html` cleaned; minimal shell retained
    - `web/view.html` cleaned; minimal shell retained
  - [x] Verify mount behavior remains per-platform
    - Web: `ensureSuperDocLoaded` then single-shot `mountReactApp`
    - Add-in: retry-based mount after `Office.onReady`

- Phase 1 Exit Criteria (status)
  - [x] No inline pill/modal code or markup remains in platform pages
  - [x] Banners/messages show human-friendly names; no raw ids
  - [x] Existing mount behavior unchanged and stable on Web and Word

### Phase 2 — UI Consolidation + Boot Unification (components, styling, cleanup)

- Work Items (status)
  - [ ] Move pill + modal into shared UI and match prior UX
    - [ ] Correct placement (top-right on web banner; matching spot in add-in header)
    - [ ] Pulse animation per theme (palette, timings, glow)
    - [ ] Modal features table (contracts landing, evaluations V2, authoring) restored
  - [ ] Unify boot/mount in shared entry (Office.onReady for Word; after SuperDoc bridge for web)
  - [ ] Add `BrandHeader`; keep `BannerStack`
  - [ ] Buttons/actions via `ActionButtons`/`UIButton`; remove Fabric overrides
  - [ ] Theming: keep `web/branding.css`; remove conflicting taskpane overrides
  - [ ] Cleanup/consistency: no `.ms-Button` reliance; parity verified on Web and Word

- Phase 2 Exit Criteria
  - No platform-specific inline UI; shared components render all UI.
  - Consistent styling/spacing; theme-driven elements behave the same on both platforms.

## File/Area Touch List

- Server
  - `server/src/server.js`: keep composing `config.banners`; ensure all labels/user-facing strings are human-readable.

- Shared UI
  - `shared-ui/components.react.js`: add `BrandHeader`, `PulsePill`, `ComingModal`; keep `BannerStack`, `ActionButtons`, notifications, modals.

- Platform shells
  - `addin/src/taskpane/taskpane.html`: strip inline UI/logic; minimal mount shell.
  - `web/view.html`: strip inline UI/logic; minimal mount shell.
  - `web/branding.css`: keep brand tokens; remove dead selectors linked to deleted inline markup.

## Acceptance Criteria

- No platform-specific inline JS for UI logic; both pages mount the same shared React UI.
- All banners and labels render correctly with display names; no raw ids in UI.
- Buttons look/behave consistently across platforms; no Fabric overrides required.
- Theme-driven pill and modal work on both platforms with identical behavior.


