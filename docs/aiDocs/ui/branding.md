# Branding Guide (Prototype)

## Purpose
- Define a lightweight, centralized brand system for the prototype so Web and Word taskpane look cohesive.
- Align UI with `data/app/theme.json` tokens; avoid hardcoded colors in clients.

## Brand tokens (from theme.json)
- Banner states: `final`, `checked_out_self`, `checked_out_other`, `available`, `update_available`
- Modal: `background`, `headerBg`, `headerFg`, `border`, `primary`, `muted`
- Buttons: `primary`, `secondary`

Example (current):
```json
{
  "banner": {
    "final": { "bg": "linear-gradient(180deg,#b91c1c,#ef4444)", "fg": "#ffffff", "pillBg": "#7f1d1d", "pillFg": "#ffffff" },
    "checked_out_self": { "bg": "linear-gradient(180deg,#2563eb,#60a5fa)", "fg": "#ffffff", "pillBg": "#1e3a8a", "pillFg": "#ffffff" },
    "checked_out_other": { "bg": "linear-gradient(180deg,#b45309,#f59e0b)", "fg": "#111827", "pillBg": "#92400e", "pillFg": "#ffffff" },
    "available": { "bg": "linear-gradient(180deg,#16a34a,#4ade80)", "fg": "#ffffff", "pillBg": "#166534", "pillFg": "#ffffff" },
    "update_available": { "bg": "linear-gradient(180deg,#0ea5e9,#38bdf8)", "fg": "#0f172a", "pillBg": "#0ea5e9", "pillFg": "#0f172a" }
  },
  "modal": {
    "background": "#ffffff",
    "headerBg": "#ffffff",
    "headerFg": "#111827",
    "border": "#e5e7eb",
    "primary": "#111827",
    "muted": "#6b7280"
  },
  "buttons": {
    "primary": { "bg": "#111827", "fg": "#ffffff", "border": "#111827" },
    "secondary": { "bg": "#ffffff", "fg": "#111827", "border": "#e5e7eb" }
  }
}
```

## Style inventory (extracted from current UI)
... (content duplicated)

## Token mapping (what to use instead of hardcoded values)
... (content duplicated)

## Proposed theme.json extensions (non-breaking)
- Add `banner.update_available` (distinct from `banner.available`).
  - Rationale: “Update available” is informational and should not look like the “available to check out” success banner.
  - Recommended default: cool blue gradient background with dark slate foreground for contrast.
- Consider `buttons.tertiary` for pill-like links.
... (content duplicated)

## Hardcoded color inventory → token mapping
... (content duplicated)

## Feature adoption matrix
... (content duplicated)

## Phase 1 (focused): remove inline styles via CSS variables
... (content duplicated)

## Adoption checklist (apps should do this)
- Ensure `update_available` is styled separately from `available` and used by the update banner.
... (content duplicated)

## Notes for Word add-in
... (content duplicated)

## Future
... (content duplicated)
