# Workflow tab: approvals view (spec)

Goal
- Add a first-class Workflow tab (web and add‑in) that shows the approvals list inline (not a modal), with the same controls and data as the existing Approvals modal.

Out of scope
- Tabs header stays as-is (keep existing AI | Workflow header). No server-side auth changes. No notifications UI changes beyond what exists.

Data sources (re-use)
- GET /api/v1/approvals → { approvers: Approver[], summary, revision }
- POST /api/v1/approvals/set { documentId, actorUserId, targetUserId, approved, notes? }
- POST /api/v1/approvals/notify { documentId, actorUserId }
- SSE event approvals:update → triggers refresh via approvalsRevision

Approver model (today)
- { userId: string, name: string, approved: boolean, notes?: string }

Config: user names, roles, titles (easy to edit)
- File: `data/app/users/users.json` (existing) → add optional field `title`
  - Example: { "id": "user2", "label": "Fun E Guy", "role": "editor", "title": "Senior Contract Analyst" }
- File: `data/app/users/roles.json` (existing) drives role names and permissions
- Server: `/api/v1/users` (existing) → include `title` in normalized output (if present)

UI requirements
1) Keep the current tab header; change only the Workflow tab body
2) Replace the Approvals pill+modal in the Workflow tab with an inline list (cards or table) showing for each approver:
   - Name (from users.json `label`), Title (from users.json `title` if present), Role (derived from users.json/roles.json)
   - Right-aligned checkbox mirroring modal behavior
   - Optional notes input (defer or show read-only for v1)
3) The header area of the inline list should include the current summary (X/Y approved) and a “Notify reviewers” button (same as modal)
4) Permissions:
   - Current user can toggle their own checkbox always
   - Editors can toggle any user (override flow — show confirm dialog just like modal)
5) State refresh:
   - On toggle/notify success, refresh list (re-use approvalsRevision or explicit refetch)
6) Error handling: surface the same errors as the modal in an inline banner

Interaction parity with modal
- Toggle approval → POST /api/v1/approvals/set
- Notify reviewers → POST /api/v1/approvals/notify
- Confirm dialogs → reuse ConfirmModal

Component plan
1) Extract shared logic from `ApprovalsModal` into a hook `useApprovals()`
   - load(), setSelf(targetUserId, approved, notes?), notify(), busy, error, rows, summary
2) New component `WorkflowApprovalsPanel`
   - Imports `useApprovals()` and renders the inline list/cards
   - Layout: responsive single-column list; each row is a card with: left block (name/title/role), right block (checkbox). Below name, small text line for title and role
   - Adds “Notify reviewers” button and summary at the top
3) Wire into existing tabs
   - In `App`, when activeTab === 'Workflow', render `<WorkflowApprovalsPanel />` instead of the pill

Styling
- Use existing branding in `/web/branding.css`
- Card style: border 1px solid #e5e7eb, border-radius: 8px, padding: 10–12px, gap: 4–6px
- Checkbox aligns right; label clickable; disabled logic matches modal

Server updates (small)
- `/api/v1/users` to include optional `title` from users.json (no breaking change)

Acceptance criteria
- Switching users updates which rows are toggleable
- Toggling updates summary and row check
- “Notify reviewers” works and errors are surfaced
- Names/titles/roles show correctly and update after edits to `data/app/users/users.json`

Follow-ups (optional)
- Sort approvers by order field, then by role priority
- Notes inline editing with optimistic save
- Filter by approved/unapproved

Testing
- Unit: hook `useApprovals()` — load, set, notify success/error paths
- UI: render Workflow tab with mock data; interactions toggle checkboxes; confirm override shown for non-self toggles when role is editor
- API smoke: GET /api/v1/approvals returns 200; POST set/notify return 200 in local env


