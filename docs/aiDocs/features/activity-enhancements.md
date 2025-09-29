# Feature: Activity System Enhancements

## Summary
Transform the Activity tab into a comprehensive, server-persisted audit trail with rich user attribution, shared visibility across all document users, and enhanced collaboration features.

## Current State
- Activity tab exists with basic client-side logging
- Limited event types (~10) with generic messages
- No persistence - logs disappear on page refresh
- No user attribution or platform context
- No unread indicators or badges
- Factory reset doesn't affect activity logs

## Scope & Boundaries

### Activities vs. Notifications
- **Activities**: Comprehensive audit trail (persisted, shared, detailed)
- **Notifications**: Transient alerts (current system, client-side only)

### In Scope
- Server-persisted activity logs with shared visibility
- Rich user attribution and detailed context
- Activity tab enhancements (badges, better UI)
- Comprehensive action type coverage
- Factory reset integration

### Out of Scope
- Push/browser notifications
- Activity filtering/search (future feature)
- Activity export functionality (future feature)
- Activity pagination (future feature)

## Requirements

### 1. Dynamic Badge in Activity Tab
**Goal**: Show unread activity count on the Activity tab
- Display badge when unseen activities exist
- Badge shows count of activities newer than `lastSeenActivityId`
- Auto-clear badge when Activity tab is viewed
- Match existing notification bell badge styling
- Persist `lastSeenActivityId` in localStorage

### 2. Server-Persisted Activity Logs
**Goal**: Centralized activity storage with shared visibility
- **Storage**: `data/app/activity-log.json` with chronological activity array
- **API**: `GET /api/v1/activity` returns all activities for the document
- **Sync**: SSE broadcasts `activity:new` events with activity objects
- **Visibility**: Same activity log shown to all users viewing the document
- **Retention**: Keep all activities (cleanup via factory reset only)

### 3. Comprehensive User Action Logging
**Goal**: Log all significant user interactions with detailed context

#### Document Actions
- `document:save` - User saved progress (auto-save)
- `document:checkin` - User checked in with save
- `document:checkout` - User checked out document
- `document:checkout:cancel` - User cancelled checkout
- `document:checkout:override` - Admin overrode checkout
- `document:finalize` - Document finalized by user
- `document:unfinalize` - Document unfinalized by user
- `document:revert` - Document reverted to previous version
- `document:upload` - New document uploaded
- `document:export` - Document exported

#### Workflow Actions
- `workflow:approve` - User approved with notes
- `workflow:reject` - User rejected with notes
- `workflow:reset` - Approvals reset by user
- `workflow:request-review` - Review requested by user
- `workflow:complete` - All approvals completed

#### Version Actions
- `version:view` - User viewed specific version
- `version:restore` - User restored document to specific version
- `version:snapshot` - Snapshot created

#### Status Actions
- `status:change` - User changed document status (draft → review → final)
- `status:cycle` - User cycled document status forward

#### System Actions
- `system:compile` - Document compiled to PDF
- `system:factory-reset` - Factory reset performed

### 4. Enhanced Message Format with User Context
**Goal**: Rich, contextual activity messages with user attribution

#### Message Structure
```javascript
{
  id: "unique-id",
  timestamp: 1640995200000,        // Unix timestamp
  type: "document:checkin",        // Action category
  user: {
    id: "user1",
    label: "Warren Peace",
    platform: "web"                // web|word
  },
  action: "checked in",            // Human-readable action
  target: "document",              // What was acted upon
  details: {                       // Action-specific metadata
    version: 5,
    size: 245760
  },
  message: "Warren Peace checked in document (v5, 240KB)"
}

// Example: Status Change Activity
{
  id: "act_1640995300000_456",
  timestamp: 1640995300000,
  type: "status:change",
  user: { id: "user2", label: "Jane Smith", platform: "web" },
  action: "changed status",
  target: "document",
  details: {
    oldStatus: "draft",
    newStatus: "review",
    transition: "manual"
  },
  message: "Jane Smith changed document status from draft to review"
}
```

#### User Attribution
- **Source**: `userId` from request context
- **Resolution**: Map `userId` to display label via `users.json`
- **Platform**: Include originating platform (web/word)
- **Fallback**: Use `userId` if label not found

#### Detailed Messages
- **Document actions**: Include version numbers, file sizes, timestamps
- **Workflow actions**: Include approval status, notes, target users
- **Version actions**: Include version numbers, restore sources
- **Status actions**: Include old status, new status, transition type
- **Messaging**: Include recipient count, message preview

### 5. Factory Reset Integration
**Goal**: Clear all activity logs during factory reset
- **Trigger**: Factory reset API call
- **Action**: Clear `activity-log.json` completely
- **Broadcast**: Notify all clients to clear local logs
- **Recovery**: Fresh start with no activity history

## Technical Implementation

### Implementation Approach
- **Replace**: Current client-side `addLog()` calls with server-side activity logging
- **Migrate**: SSE switch statement logging → server `logActivity()` calls
- **Preserve**: ActivityPanel UI, adapt to consume server activities
- **Remove**: Broken server notification system (no migration needed)

### Server-Side Changes

#### 1. Activity Storage & API
```javascript
// data/app/activity-log.json structure
[
  {
    id: "act_1640995200000_123",
    timestamp: 1640995200000,
    type: "document:checkin",
    user: { id: "user1", label: "Warren Peace", platform: "web" },
    action: "checked in",
    target: "document",
    details: { version: 5, size: 245760 },
    message: "Warren Peace checked in document (v5, 240KB)"
  }
]

// New endpoints
GET  /api/v1/activity      // Returns all activities
POST /api/v1/activity/log  // Internal logging endpoint
```

#### 2. Replace SSE Switch Logging
**Before**: Client handles events with `addLog()`
```javascript
case 'checkin':
  addLog('Document checked in', 'success');
  break;
```

**After**: Server logs activities directly
```javascript
case 'checkin':
  logActivity('document:checkin', userId, {
    version: serverState.documentVersion,
    size: bytes.length
  });
  break;
```

#### 3. Activity Logging Function
```javascript
function logActivity(type, userId, details = {}) {
  const activity = buildActivity(type, userId, details);
  saveActivity(activity);
  broadcast({ type: 'activity:new', activity });
}
```

### Client-Side Changes

#### 1. Replace Logs with Activities
**Before**: `const [logs, setLogs] = React.useState([]);`
**After**:
```javascript
const [activities, setActivities] = React.useState([]);
const [lastSeenActivityId, setLastSeenActivityId] = React.useState(
  localStorage.getItem('lastSeenActivityId') || null
);
```

#### 2. Activity Tab Badge Implementation
```javascript
const unseenCount = activities.filter(a => a.id > lastSeenActivityId).length;
const badge = unseenCount > 0 ? (
  <span className="activity-badge">{unseenCount}</span>
) : null;

// Update lastSeenActivityId when tab viewed
const markActivitiesSeen = () => {
  const latestId = activities.length > 0 ? activities[activities.length - 1].id : null;
  setLastSeenActivityId(latestId);
  localStorage.setItem('lastSeenActivityId', latestId);
};
```

#### 3. ActivityPanel Migration
- Replace `logs` with `activities` from server
- Keep existing `renderNotification` logic (adapt for new format)
- Add badge to Activity tab
- Load activities via `GET /api/v1/activity`

## Data Flow

```
User Action → Server Handler → logActivity() → Save to JSON → SSE Broadcast
                                                        ↓
Client Receives → Update activities[] → Update UI → Show badge if unseen
```

## Migration Strategy

### Single Implementation Phase
- **Server Changes**: Add activity persistence, logging, and API endpoints
- **Client Changes**: Update Activity tab to use server activities, add badges
- **No Backward Compatibility**: Replace existing client-side logging entirely
- **Atomic Deployment**: All changes deployed together, no phased rollout

### Implementation Priority
1. **Server persistence and API** (`/api/v1/activity`, storage)
2. **Activity logging** (add to existing endpoints)
3. **Client activity tab** (replace with server-driven UI)
4. **Badge functionality** (unread count indicator)
5. **Factory reset integration** (clear activities)

## Code Review & De-duplication

### Current System Analysis

#### Client-Side Activity Logging (`shared-ui/components.react.js`)
- **Storage**: `logs` React state array (ephemeral)
- **Events**: 15+ event types handled in SSE switch statement
- **Format**: Mix of plain strings and formatted objects
- **Display**: ActivityPanel with reverse chronological rendering
- **Persistence**: None - lost on refresh

#### Server-Side Notifications (`server/src/server.js`)
- **Broken**: Server sends `notification` events but client has no handler
- **Types**: 8 styled notification types (success/error/warning/info/etc.)
- **Format**: `formatServerNotification()` creates rich objects with icons/colors
- **Usage**: Only used for LLM errors (2 locations)

#### Current Activity Events (Mapped to New Types)
```
Existing Events → New Activity Types
─────────────────────────────────────
documentUpload   → document:upload
documentRevert   → document:revert
snapshot         → version:snapshot
factoryReset     → system:factory-reset
exhibitUpload    → document:upload (consolidate)
compile          → system:compile
finalize         → document:finalize / document:unfinalize
checkout         → document:checkout
checkin          → document:checkin
checkoutCancel   → document:checkout:cancel
overrideCheckout → document:checkout:override
approvals:update → workflow:approve / workflow:reject / workflow:reset / workflow:request-review
```

#### De-duplication Plan
- **Remove**: Broken server notification system (no client handler)
- **Consolidate**: `documentUpload` + `exhibitUpload` → single `document:upload`
- **Migrate**: All SSE switch logging → server-side activity logging
- **Preserve**: ActivityPanel UI (update to use server activities)
- **Eliminate**: Client-side `addLog()` calls (replace with server broadcasts)

## Acceptance Criteria

1. ✅ Activity tab shows unread count badge
2. ✅ All users see same activity log for document
3. ✅ Comprehensive logging of all user actions with no duplicates
4. ✅ Rich messages with user attribution and platform context
5. ✅ Factory reset clears all activity logs
6. ✅ Real-time updates via SSE
7. ✅ All existing activities migrated to new system without gaps

## Files of Record

### Server Files
- `server/src/server.js` - Activity logging functions, API endpoints, SSE broadcasts, factory reset integration

### Client Files
- `shared-ui/components.react.js` - ActivityPanel component, activity state management, badge logic, SSE event handling

### Data Files
- `data/app/activity-log.json` - Persistent activity storage (new file)
- `docs/aiDocs/features/activity-enhancements.md` - This specification

## Future Considerations

- Activity log pagination for large documents
- Activity filtering/search capabilities
- Export activity logs to PDF/CSV
- Activity retention policies (auto-cleanup old entries)
- Activity analytics and insights
