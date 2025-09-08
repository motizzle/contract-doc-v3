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

### Phase 1 — Boot/Mount Unification + Server SOT (minimal UI change)

- Goals
  - One boot path in `shared-ui/components.react.js` for both platforms.
  - Server is authoritative for labels/messages (no raw ids; banners via `config.banners`).
  - Keep platform shells minimal (only host-specific includes + `#app-root`).

- Work Items
  1) Centralize mount logic (already largely in place): Office detection, retries, error fallback, SSE init.
  2) Ensure server resolves user labels for all messages/banners (checkout owner DONE; audit others).
  3) Strip page-level boot scripts from `taskpane.html` and `view.html`; leave only includes + root div.
  4) Verify SuperDoc host mounts only on Web (guarded by `typeof Office`).

- Phase 1 Exit Criteria
  - Both pages have no inline boot logic; mount is shared.
  - Banners show human-friendly names; messaging comes only from `config.banners`.
  - No behavioral drift between platforms due to boot differences.

### Phase 2 — UI Consolidation (components, styling, cleanup)

- Work Items
  1) Remove remaining inline UI logic from platform pages (modals, pill, badges/table).
  2) Shared components in `shared-ui/components.react.js`:
     - `BrandHeader`, `PulsePill`, `ComingModal` (and reuse existing modals).
     - Keep `BannerStack` as sole banner renderer using server tokens.
  3) Buttons and actions: render via `ActionButtons`/`UIButton`; remove Fabric overrides and page-level markup.
  4) Theming: keep `web/branding.css` as the brand surface; delete conflicting taskpane overrides.
  5) Cleanup/consistency: no `.ms-Button` reliance; names resolved everywhere; parity verified on Web and Word.

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


