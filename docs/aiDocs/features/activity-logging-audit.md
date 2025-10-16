# Activity Logging Audit & Implementation Plan

## Current Activity Log Types (Supported in buildActivityMessage)

### ✅ Workflow Operations
- `workflow:approve` - User approves (for self or on behalf)
- `workflow:remove-approval` - User removes approval
- `workflow:reject` - User rejects
- `workflow:reset` - User resets all approvals
- `workflow:request-review` - User requests review from approvers
- `workflow:complete` - All approvals completed (automatic)

### ✅ Document Operations
- `document:save` - User saves progress
- `document:checkin` - User checks in document
- `document:checkout` - User checks out document
- `document:checkout:cancel` - User cancels checkout
- `document:checkout:override` - User overrides another's checkout
- `document:status-change` - Document status changed

### ✅ Version Operations
- `version:view` - User views a specific version
- `version:restore` - User restores a version

### ✅ Variable Operations
- `variable:created` - User creates a variable
- `variable:updated` - User updates variable metadata
- `variable:valueChanged` - User changes variable value
- `variable:deleted` - User deletes a variable

### ✅ Messaging Operations
- `message:send` - User sends a message

### ✅ System Operations
- `system:error` - System encounters an error
- `system:prompt-update` - System prompt updated (currently missing from buildActivityMessage!)
- `system:prompt-reset` - System prompt reset (currently missing from buildActivityMessage!)

---

## Endpoint Audit: Activity Logging Status

### ✅ Fully Logged Endpoints

| Endpoint | Method | Activity Type | Notes |
|----------|--------|---------------|-------|
| `/api/v1/variables` | POST | `variable:created` | ✅ Complete |
| `/api/v1/variables/:varId` | PUT | `variable:updated` | ✅ Complete |
| `/api/v1/variables/:varId` | DELETE | `variable:deleted` | ✅ Complete |
| `/api/v1/variables/:varId/value` | PUT | `variable:valueChanged` | ✅ Complete |
| `/api/v1/save-progress` | POST | `document:save` | ✅ Complete |
| `/api/v1/checkout` | POST | `document:checkout` | ✅ Complete |
| `/api/v1/checkin` | POST | `document:checkin` | ✅ Complete |
| `/api/v1/checkout/cancel` | POST | `document:checkout:cancel` | ✅ Complete |
| `/api/v1/checkout/override` | POST | `document:checkout:override` | ✅ Complete |
| `/api/v1/status/cycle` | POST | `document:status-change` | ✅ Complete |
| `/api/v1/versions/view` | POST | `version:view` | ✅ Complete |
| `/api/v1/document/revert` | POST | `version:restore` | ✅ Complete |
| `/api/v1/approvals/set` | POST | `workflow:approve` or `workflow:remove-approval` | ✅ Complete |
| `/api/v1/approvals/reset` | POST | `workflow:reset` | ✅ Complete |
| `/api/v1/approvals/notify` | POST | `workflow:request-review` | ✅ Complete |
| `/api/v1/events/client` | POST | `message:send` (for approvals:message type) | ✅ Complete |
| `/api/v1/chat/system-prompt` | POST | `system:prompt-update` | ✅ Has logging call |
| `/api/v1/chat/system-prompt/reset` | POST | `system:prompt-reset` | ✅ Has logging call |

### ❌ Missing Activity Logging

| Endpoint | Method | Suggested Activity Type | Impact | Priority |
|----------|--------|-------------------------|---------|----------|
| `/api/v1/document/upload` | POST | `document:upload` | High - file changes | **HIGH** |
| `/api/v1/document/snapshot` | POST | `document:snapshot` | Medium - metadata | MEDIUM |
| `/api/v1/compile` | POST | `document:compile` | Medium - generates output | MEDIUM |
| `/api/v1/send-vendor` | POST | `document:send-vendor` | High - external action | **HIGH** |
| `/api/v1/exhibits/upload` | POST | `exhibit:upload` | Medium - file changes | MEDIUM |
| `/api/v1/title` | POST | `document:title-change` | Low - metadata | LOW |
| `/api/v1/messages/mark-read` | POST | `message:mark-read` | Low - UI state | LOW |
| `/api/v1/chat/reset` | POST | `chat:reset` | Low - clears UI | LOW |
| `/api/v1/chatbot/reset` | POST | `chatbot:reset` | Low - clears AI chat | LOW |
| `/api/v1/factory-reset` | POST | `system:factory-reset` | **Critical - wipes data** | **CRITICAL** |

### 📝 No Logging Needed (Read Operations)

| Endpoint | Method | Reason |
|----------|--------|--------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/users` | GET | Read operation |
| `/api/v1/activity` | GET | Read operation |
| `/api/v1/messages` | GET | Read operation |
| `/api/v1/chat` | GET | Read operation |
| `/api/v1/variables` | GET | Read operation |
| `/api/v1/current-document` | GET | Read operation |
| `/api/v1/state-matrix` | GET | Read operation |
| `/api/v1/theme` | GET | Read operation |
| `/api/v1/approvals/state` | GET | Read operation |
| `/api/v1/versions` | GET | Read operation |
| `/api/v1/versions/:n` | GET | Read operation |
| `/api/v1/approvals` | GET | Read operation |
| `/api/v1/refresh-document` | POST | Internal operation |
| `/api/v1/document/navigate` | POST | UI navigation |
| `/api/v1/versions/compare` | POST | Read/compute operation |
| `/api/v1/events` | GET | SSE stream |
| `/api/v1/exhibits` | GET | Read operation |
| `/api/v1/ui/modal/send-vendor` | GET | UI template |
| `/api/v1/chat/system-prompt` | GET | Read operation |

---

## Missing buildActivityMessage Cases

These activity types are logged but don't have cases in `buildActivityMessage`:

1. `system:prompt-update` - Falls through to default case
2. `system:prompt-reset` - Falls through to default case

---

## Implementation Plan

### Phase 1: Add Missing buildActivityMessage Cases (5 min)
```javascript
case 'system:prompt-update':
  return {
    action: 'updated system prompt',
    target: 'system',
    details: { promptLength: details.promptLength },
    message: `${userLabel} updated the AI system prompt`
  };

case 'system:prompt-reset':
  return {
    action: 'reset system prompt',
    target: 'system',
    details: {},
    message: `${userLabel} reset the AI system prompt to default`
  };

case 'document:upload':
  return {
    action: 'uploaded document',
    target: 'document',
    details: { filename: details.filename, size: details.size },
    message: `${userLabel} uploaded document "${details.filename}"`
  };

case 'document:snapshot':
  return {
    action: 'created snapshot',
    target: 'document',
    details: { version: details.version },
    message: `${userLabel} created document snapshot${details.version ? ` (v${details.version})` : ''}`
  };

case 'document:compile':
  return {
    action: 'compiled document',
    target: 'document',
    details: { format: details.format, includeExhibits: details.includeExhibits },
    message: `${userLabel} compiled document${details.format ? ` (${details.format})` : ''}${details.includeExhibits ? ' with exhibits' : ''}`
  };

case 'document:send-vendor':
  return {
    action: 'sent to vendor',
    target: 'document',
    details: { vendor: details.vendor, email: details.email },
    message: `${userLabel} sent document to ${details.vendor || details.email || 'vendor'}`
  };

case 'exhibit:upload':
  return {
    action: 'uploaded exhibit',
    target: 'exhibit',
    details: { filename: details.filename, size: details.size },
    message: `${userLabel} uploaded exhibit "${details.filename}"`
  };

case 'document:title-change':
  return {
    action: 'changed document title',
    target: 'document',
    details: { oldTitle: details.oldTitle, newTitle: details.newTitle },
    message: `${userLabel} changed document title to "${details.newTitle}"`
  };

case 'chat:reset':
  return {
    action: 'reset chat',
    target: 'chat',
    details: {},
    message: `${userLabel} reset AI chat history`
  };

case 'system:factory-reset':
  return {
    action: 'performed factory reset',
    target: 'system',
    details: {},
    message: `${userLabel} performed factory reset - all data cleared`
  };
```

### Phase 2: Add logActivity Calls to Endpoints (10 min)

#### HIGH Priority - Add Now

```javascript
// /api/v1/document/upload
logActivity('document:upload', userId, {
  filename: req.file?.originalname,
  size: req.file?.size,
  platform: originPlatform
});

// /api/v1/send-vendor
logActivity('document:send-vendor', userId, {
  vendor: vendorName,
  email: vendorEmail,
  platform: originPlatform
});

// /api/v1/factory-reset
logActivity('system:factory-reset', userId, {
  platform: originPlatform
});
```

#### MEDIUM Priority - Add Next

```javascript
// /api/v1/compile
logActivity('document:compile', userId, {
  format: format,
  includeExhibits: includeExhibits,
  platform: originPlatform
});

// /api/v1/exhibits/upload
logActivity('exhibit:upload', userId, {
  filename: req.file?.originalname,
  size: req.file?.size,
  platform: originPlatform
});

// /api/v1/document/snapshot
logActivity('document:snapshot', userId, {
  version: versionNumber,
  platform: originPlatform
});
```

#### LOW Priority - Optional

```javascript
// /api/v1/title
logActivity('document:title-change', userId, {
  oldTitle: oldTitle,
  newTitle: newTitle,
  platform: originPlatform
});

// /api/v1/chat/reset
logActivity('chat:reset', userId, {
  platform: originPlatform
});
```

### Phase 3: Test All Activity Logs (5 min)

Test each endpoint and verify:
1. Activity is logged to `activity-log.json`
2. Activity is broadcast via SSE
3. Message is properly formatted
4. User attribution is correct

---

## Total Estimated Time: 20 minutes

**Priority Order:**
1. Add missing buildActivityMessage cases (5 min)
2. Add HIGH priority logActivity calls (5 min)
3. Test HIGH priority changes (3 min)
4. Add MEDIUM priority logActivity calls (4 min)
5. Final testing (3 min)

