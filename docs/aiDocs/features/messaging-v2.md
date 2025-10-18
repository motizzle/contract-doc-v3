# Feature: Messaging v2 (Simplified, chat‑style)

## Status
- Proposal
- Platforms: Web + Word add‑in (shared UI)

## Summary
Upgrade the Messages channel to a first‑class collaboration system separate from document‑embedded comments. Key additions:
- Add recipients not already in the system (ad‑hoc name/email)
- Attorney‑client privilege flag per thread (and per post if needed)
- Export threads or selections to CSV (policy‑aware)
- Read/unread tracking with badges
- Resolve/close a thread; Archive; Soft‑delete (with undo window)
- Filters, search, bulk actions, and server summaries for badges

## User Stories (deliver all)
- As an editor, I can start a new thread and add recipients not in the directory by entering name and email; they appear as ad‑hoc participants.
- As an editor, I can mark a thread as Attorney‑Client Privileged; individual posts can also be flagged privileged. External users never see privileged content.
- As a user, I can export a single thread, selected threads, or all threads matching my filters to CSV; privileged/internal content is excluded by default with explicit include toggles; I can optionally include posts.
- As a user, I can mark a thread read/unread; opening a thread marks it read for me; unread badges update in real time.
- As a user, I can resolve (close) a thread, archive it for later reference, or delete it with a short undo window; admins can restore deleted threads.
- As a user, I can search by text and filter by Open/Resolved/Archived, Internal/External, Privileged, and participants; list and badges reflect the filters.

## UX: standard chat patterns
- One Messages v2 tab with two panes stacked vertically:
  - Thread list (top): recent threads, unread badge, small chips (Internal, ACP, Resolved/Archived)
  - Thread view (bottom): messages timeline + composer fixed at bottom
- Composer: multiline, Send on Enter, Shift+Enter for newline
- New thread: compact modal with title, recipients (type‑ahead + "Add new person"), toggles Internal/ACP, optional first message
- Thread header actions: Resolve/Reopen, Archive, Export CSV, Toggle ACP/Internal
- Minimal filters above the list: [Open | Archived] · Internal toggle · ACP toggle · Search box

Why this design
- Matches user expectations from Slack/Teams/Helpdesk
- Works well in the sidepane height; no side‑by‑side complexities
- Keeps actions discoverable without extra drawers

## Data model (lean)

Thread
```json
{
  "threadId": "msg-uuid",
  "title": "Vendor SOW questions",
  "createdBy": { "userId": "user1", "label": "Warren Peace" },
  "createdAt": 1700000000000,
  "participants": [
    { "userId": "user1", "label": "Warren Peace", "email": "warren@opengov.com", "internal": true },
    { "userId": null, "label": "Jane Vendor", "email": "jane@vendor.com", "internal": false }
  ],
  "internal": false,
  "privileged": false,
  "state": "open",          
  "lastPostAt": 1700000123456,
  "unreadBy": ["user2"],
  "deletedAt": null
}
```

Post
```json
{
  "postId": "p-uuid",
  "threadId": "msg-uuid",
  "author": { "userId": "user1", "label": "Warren Peace" },
  "createdAt": 1700000010000,
  "text": "Please confirm dates.",
  "privileged": false
}
```

Summary (for badges)
```json
{ "messages": { "open": 11, "unreadForMe": 7, "privileged": 3, "archived": 9 } }
```

## API (minimal)
- GET `/api/v1/messages` with filters: `state=open|archived|resolved`, `internal=true|false|both`, `privileged=true|false|both`, `search`, `limit`, `cursor`
- POST `/api/v1/messages` → create thread `{ title, recipients:[{label,email,userId?,internal?}], internal, privileged, text? }`
- POST `/api/v1/messages/:id/post` → `{ text, privileged? }`
- POST `/api/v1/messages/:id/participants` → add recipients
- POST `/api/v1/messages/:id/state` → `{ state: 'open'|'resolved'|'archived' }`
- POST `/api/v1/messages/:id/flags` → `{ internal?, privileged? }`
- POST `/api/v1/messages/:id/read` → mark read (per user); `unread` counterpart
- POST `/api/v1/messages/:id/delete` → soft delete (undo available for 10 min)
- GET `/api/v1/messages/export.csv` → CSV; scope=`single|selected|filtered`; defaults exclude internal/ACP unless `includeInternal=true&includePrivileged=true`; `includePosts=true|false`
- GET `/api/v1/discussion/summary` → badge counts

SSE events
- `message:thread-created` · `message:post-added` · `message:state-changed` · `message:flags-updated` · `message:read`
- `discussion:update` with refreshed badge summary

## Export CSV (simple)
- Scope: single thread OR current filter result
- Columns (thread export): `threadId,title,state,internal,privileged,createdAt,createdBy,participants,lastPostAt,postCount`
- With posts: add rows for `postId,threadId,author,createdAt,privileged,text`
- Policy: exclude internal/ACP by default; explicit checkboxes to include

## Read/Unread
- Unread if user's `lastSeenAt < lastPostAt`
- Opening thread marks read; bulk "Mark as read" in list

## Permissions (unchanged, summarized)
- Viewer/Suggester/Vendor: create threads, reply, mark read/unread, archive own threads; cannot delete permanently
- Editor: can resolve/archive any thread, toggle flags, soft‑delete
- Server enforces Internal/ACP visibility (externals never see ACP)

## Acceptance Criteria (trimmed)
- Create thread with ad‑hoc recipient; send first message
- Toggle Internal/ACP; external users never see ACP
- Export CSV for single/selected/filtered scope with default policy (internal/ACP off) and explicit include options; optional includePosts
- Read/unread works per user; badges update via SSE
- Resolve/Archive/Soft‑delete with undo (10 min)
- Search text and filter by Open/Resolved/Archived, Internal/ACP, and participants; results and badges reflect filters

## Out of scope
- Attachments, mentions, email/webhooks, legal hold/retention

## Implementation notes
- Store ad‑hoc participants inline `{ userId:null, label, email, internal:false }`
- Stream CSV; paginate lists; debounce SSE ≤1s

## Story→Spec traceability
- Ad‑hoc recipients: New Thread modal (UX) · POST /messages (API) · Acceptance 1
- Attorney‑Client Privilege: Thread header toggle + per‑post flag (UX) · POST /messages/:id/flags and /:id/post (API) · Acceptance 2
- Export CSV (single/selected/filtered): Export action (UX) · GET /messages/export.csv with scope/includePosts (API) · Acceptance 3
- Read/Unread: Auto on open + bulk (UX) · POST /messages/:id/read (API) · Acceptance 4
- Resolve/Archive/Delete with undo: Header actions (UX) · POST /messages/:id/state, /:id/delete (API) · Acceptance 5
- Search/Filters/Participants: List filters + search (UX) · GET /messages with query params (API) · Acceptance 6

