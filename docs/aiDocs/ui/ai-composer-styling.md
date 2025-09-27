# AI Composer — Minimal Styling Spec (Align with Reference UI)

## Decisions (updated)
- No inner filled wrapper. Use the existing textarea as the white fill inside the gradient perimeter.
- Keep the gradient perimeter (outer composer frame) as-is.
- Remove the three-dots button entirely.
- Replace the rectangular Send with a compact circular primary action (blue up-arrow icon).
- Keep Attach (paperclip) and optionally Mic (voice) as small circular gray icon buttons.
- Do not change the textarea size; only the conversation area height is adjusted elsewhere (+25% web, +150% add‑in).

## Visuals
- Layout within gradient frame: [Attach] [textarea (flex:1)] [Mic] [Send(circle)].
- Textarea:
  - background #fff
  - border none
  - border-radius 12–14px
  - padding 12–14px
  - full-width (flex: 1)
  - remove default focus rings; optionally use subtle `:focus-visible` shadow
- Primary circular button:
  - 44×44, radius 9999
  - background brand blue (#4f46e5 or token); white up-arrow icon
  - hover darken ~6–8%; active ~10%
- Icon ghost buttons:
  - 36×36, radius 9999
  - background #f3f4f6; icon color #111827 @ ~70%
  - hover darken ~4%

## Behavior
- Enter submits; Shift+Enter inserts newline.
- Buttons are keyboard accessible (Tab/Shift+Tab). Space/Enter activate.
- aria-labels:
  - Attach: "Attach file"
  - Mic: "Start voice input"
  - Send: "Send message"
- Disable Send when trimmed textarea is empty.

## Implementation Notes (server-side CSS only; no inline)
- CSS
  - `.chat-composer` (gradient frame) remains.
  - `.chat-composer .chat-input` provides the white fill (bg: #fff; border: 0; radius 12–14px; padding 12–14px; `appearance: none`).
  - New button classes:
    - `.btn-circle-primary` (44×44, brand-blue background, white icon)
    - `.btn-icon-ghost` (36×36, gray background, dark icon)
  - Remove dotted focus rectangles and any default textarea borders; preserve accessibility with `:focus-visible` where appropriate.
- Markup (high level)
  - Keep existing composer container; render: Attach button (optional), textarea, Mic button (optional), circle Send button.
  - Do NOT include the three-dots button.

## Add-in Parity (Word)
- Reuse the same classes; ensure `.ms-welcome` overrides remove any container borders/backgrounds.
- Conversation area height increased per brief; composer sizes unchanged.

## Risks & Mitigations
- Focus visibility: use `:focus-visible` shadow for keyboard users.
- Icon assets: prefer inline SVGs (paperclip, mic, arrow) to avoid font coupling.
- Taskpane quirks: clip inner focus rings via `overflow: hidden` on composer; keep z-index sane.
- Cross-browser: validate Chrome/Edge/Firefox/Word.

## Acceptance Criteria
1) Composer shows textarea with white fill inside gradient frame; no inner wrapper.
2) Three-dots button is absent.
3) Send is a circular blue button with up-arrow; Enter submits and Shift+Enter inserts newline.
4) Attach/Mic appear as small gray circular buttons (Mic optional).
5) All styling lives in CSS (`web/branding.css`); no inline styling added for this feature.
