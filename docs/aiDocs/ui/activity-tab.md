# Activity Tab (Specs)

## Goal
Unify system/user notifications under a first‑class Activity tab next to Messaging. Provide a simple, scrollable feed with unread counts and clear/reset behavior, replacing the standalone Notifications panel.

## Scope
- In scope:
  - New tab label: Activity (to the right of Messaging)
  - Feed rendering of existing notifications (what today shows in NotificationsPanel/Modal)
  - Unread badge rules and reset when viewing Activity
  - Copy/export action for the feed
  - SSE-driven updates, identical to current notifications stream
- Out of scope:
  - New event types or server changes (reuse existing log/notification plumbing)
  - Per-item actions beyond copy/export
  - Push/browser notifications

## UX
- Tabs: AI | Workflow | Messaging | Activity
- Activity body:
  - Header row with title and actions: Copy, Mark all as read
  - Vertical list of entries (most recent first), each mapped with existing format: icon, color, timestamp, message
  - Empty state: “No activity yet.”
- Unread logic:
  - Maintain `lastSeenLogCount` (existing) in state; when Activity mounts, call `markNotificationsSeen()`.
  - Show a badge on the Activity tab with count `total - lastSeenLogCount` if > 0.

## Data & Events
- Source: `StateContext.logs`, `renderNotification(log)`, `markNotificationsSeen`, `lastSeenLogCount` (existing API)
- SSE: No changes; same `addLog()` pathways add to feed.

## Accessibility
- Tab is keyboard focusable
- Items are accessible text; Copy button is a standard `button` with Enter/Space handlers

## Performance
- Reuse existing memoized render logic used by NotificationsPanel; list is simple divs, not virtualized (volume is low)

## Error Handling
- Copy errors are silently ignored (same as today)

## Reset Behavior
- Factory reset and View Latest already clear notifications state via app reload; no special handling required

## Acceptance Criteria
1) Activity tab appears next to Messaging
2) Activity shows existing notification entries in reverse chronological order
3) Copy button copies the feed text to clipboard
4) Unread badge shows when Activity is not focused and new logs arrive; clears upon viewing
5) No regressions to AI, Workflow, Messaging tabs
