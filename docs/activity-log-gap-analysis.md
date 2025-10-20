# Activity Log Gap Analysis

**Date**: Current State After Document Context Enhancements  
**Branch**: `activity-log`

---

## ✅ FULLY ENHANCED (12 events - Document Context Added)

These events now include document title, version, status, and other rich context:

| Event Type | Status | Context Added |
|------------|--------|---------------|
| `document:save` | ✅ Enhanced | Title, version, file size, word count (placeholder), autoSave flag |
| `document:checkout` | ✅ Enhanced | Title, version, status |
| `document:checkin` | ✅ Enhanced | Title, version, **checkout duration** (auto-calculated) |
| `document:checkout:cancel` | ✅ Enhanced | Title, version |
| `document:checkout:override` | ✅ Enhanced | Title, version, previous user |
| `document:status-change` | ✅ Enhanced | Title, version, from/to status |
| `document:upload` | ✅ Enhanced | Filename, size, document title, version, previousFilename (placeholder) |
| `document:snapshot` | ✅ Enhanced | Title, version, status |
| `document:compile` | ✅ Enhanced | Title, version, exhibit count, output size, format |
| `document:send-vendor` | ✅ Enhanced | Title, version, vendor name, email |
| `version:view` | ✅ Enhanced | Title, version viewed, **current version** (for comparison) |
| `version:restore` | ✅ Enhanced | Title, restored version, **previous version** |

---

## ⚠️ IMPLEMENTED BUT BASIC (13 events - Need Enhancement)

These events exist and log, but could capture more contextual information:

### Workflow Events (6 events)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `workflow:approve` | targetUserId, notes, progress | ✅ **Good** - approval duration could be added |
| `workflow:remove-approval` | targetUserId, notes, progress | ✅ **Good** - approval duration could be added |
| `workflow:reject` | targetUserId, notes | Document title, version |
| `workflow:complete` | total, approved | Document title, version |
| `workflow:reset` | (none) | Document title, version, reason |
| `workflow:request-review` | (none) | Document title, version, specific approvers |

### Variable Events (4 events)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `variable:created` | varId, displayLabel | ✅ **Good** - type, category, initial value |
| `variable:updated` | varId, displayLabel, changes | ✅ **Good** - specific field changes |
| `variable:valueChanged` | ✅ **EXCELLENT** - All details | Document title if inserted into doc |
| `variable:deleted` | varId, displayLabel | Document title if was used in doc |

### Message Events (5 events)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `message:created` | ✅ **EXCELLENT** - Full details | None - very comprehensive |
| `message:archived` | messageId, title, participants, postCount | ✅ **Good** - archive reason |
| `message:unarchived` | messageId, title, participants, postCount | ✅ **Good** - unarchive reason |
| `message:flags-updated` | messageId, title, flags, participants | ✅ **Good** - who requested flags |
| `message:deleted` | ✅ **EXCELLENT** - Full details | Delete reason |

### System Events (4 events)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `system:error` | error message, source | ✅ **Good** - stack trace (truncated) |
| `system:prompt-update` | promptLength | Old vs new prompt diff |
| `system:prompt-reset` | (none) | ✅ **Good** - sufficient |
| `system:factory-reset` | (none) | Reason, confirmation user |
| `chat:reset` | (none) | Chat message count before reset |

### Exhibit Events (1 event)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `exhibit:upload` | filename, size | Document title if referenced, file type |

### Document Events (1 event)
| Event Type | Current Details | Missing Context |
|------------|----------------|-----------------|
| `document:title-change` | oldTitle, newTitle | Version, status |

### Legacy/Unused (1 event)
| Event Type | Current Details | Status |
|------------|----------------|--------|
| `message:send` | to, channel | ⚠️ **DEFINED BUT NEVER CALLED** - Legacy |

---

## ❌ CRITICAL MISSING EVENTS (High Priority)

### Message Posts (HIGHEST PRIORITY)
- ❌ `message:post-created` - **Individual messages within conversations**
  - **Why Critical**: Legal/compliance audit trail for all communications
  - **Should Include**: messageId, postId, author, text (truncated), privileged flag, timestamp
  - **Impact**: Currently no record of individual replies, only conversation creation

- ❌ `message:post-deleted` - Post removal within conversation
  - **Should Include**: messageId, postId, author, deletion reason

- ❌ `message:read` / `message:unread` - Read receipt tracking
  - **Should Include**: messageId, userId, read/unread action

- ❌ `message:exported` - CSV export tracking
  - **Should Include**: userId, scope, filters used, record count

### Exhibit Management (HIGH PRIORITY)
- ❌ `exhibit:deleted` - **Exhibit removal**
  - **Why Critical**: Compliance - need to track document removals
  - **Should Include**: filename, size, who deleted, used in which documents

- ❌ `exhibit:viewed` - Exhibit access tracking
  - **Should Include**: filename, userId, access method (view/download)

- ❌ `exhibit:renamed` - File name changes
  - **Should Include**: oldName, newName, userId

### User Management (HIGH PRIORITY)
- ❌ `user:login` - User authentication
  - **Why Critical**: Security audit trail
  - **Should Include**: userId, IP address, platform, success/failure

- ❌ `user:logout` - User session end
  - **Should Include**: userId, session duration

- ❌ `user:role-changed` - Permission changes
  - **Why Critical**: Security - track privilege escalation
  - **Should Include**: targetUserId, oldRole, newRole, changedBy

- ❌ `user:added-to-document` - Access granted
  - **Should Include**: userId, grantedBy, role, document title

- ❌ `user:removed-from-document` - Access revoked
  - **Should Include**: userId, revokedBy, previous role, document title

### Version Comparison (MEDIUM PRIORITY)
- ❌ `version:compared` - Version comparison viewed
  - **Should Include**: documentTitle, version1, version2, mode (side-by-side/inline)

- ❌ `version:comparison-mode-changed` - UI preference change
  - **Should Include**: oldMode, newMode

### AI/Chat Events (MEDIUM PRIORITY)
- ❌ `ai:query` - AI question asked
  - **Should Include**: userId, query (truncated to 200 chars), document title, context
  - **Why**: Understand AI usage patterns, popular queries

- ❌ `ai:response` - AI answer provided
  - **Should Include**: queryId, response (truncated), tokens used, model
  - **Why**: Track AI performance, costs

- ❌ `ai:suggestion-accepted` - User acted on AI advice
  - **Should Include**: suggestionType, context

- ❌ `ai:suggestion-rejected` - User ignored AI advice
  - **Should Include**: suggestionType, context

- ❌ `ai:prompt-viewed` - System prompt accessed
  - **Should Include**: userId, promptLength

### Track Changes (MEDIUM PRIORITY)
- ❌ `track-changes:accepted` - Change approved
  - **Should Include**: changeId, changeType, author, location in document

- ❌ `track-changes:rejected` - Change rejected
  - **Should Include**: changeId, changeType, author, rejectedBy, reason

- ❌ `comment:added` - Document comment created
  - **Should Include**: commentId, text (truncated), location, thread

- ❌ `comment:resolved` - Comment thread closed
  - **Should Include**: commentId, resolvedBy, resolution

### Search & Discovery (LOW PRIORITY)
- ❌ `search:performed` - Search executed
  - **Should Include**: query, scope (messages/variables/versions), results count

- ❌ `filter:applied` - Filter used
  - **Should Include**: filterType, filterValue, scope

### Document Access (LOW PRIORITY)
- ❌ `document:viewed` - Document opened
  - **Should Include**: documentTitle, userId, platform, viewing mode

- ❌ `document:exported` - Document downloaded
  - **Should Include**: documentTitle, format, version, userId

### Configuration (LOW PRIORITY)
- ❌ `settings:changed` - System configuration updated
  - **Should Include**: setting, oldValue, newValue, changedBy

- ❌ `theme:changed` - UI theme updated
  - **Should Include**: oldTheme, newTheme, userId

---

## 📊 Priority Summary

### 🔴 CRITICAL (Must Add)
**Impact**: Legal compliance, security, audit requirements

1. **Message posts** - Individual message tracking (4 events)
2. **Exhibit deleted** - Document removal tracking (1 event)
3. **User auth/access** - Security audit trail (5 events)

**Total: 10 critical events missing**

### 🟡 HIGH PRIORITY (Should Add)
**Impact**: Operational insights, user behavior, debugging

4. **Version comparison** - Understanding workflow (2 events)
5. **AI interactions** - Usage patterns, costs (4 events)
6. **Track changes** - Collaboration audit (4 events)

**Total: 10 high-priority events missing**

### 🟢 MEDIUM/LOW PRIORITY (Nice to Have)
**Impact**: Analytics, user experience improvements

7. **Search/filter** - Usage analytics (2 events)
8. **Document access** - View patterns (2 events)
9. **Configuration** - System changes (2 events)

**Total: 6 low-priority events missing**

---

## 🎯 Recommendations

### Phase 1: Document Context (COMPLETE ✅)
- ✅ Enhanced 12 document/version events with title, version, status
- ✅ Added checkout duration tracking
- ✅ Added getDocumentContext() helper

### Phase 2: Critical Events (NEXT - THIS BRANCH)
Add the 10 critical missing events:
1. `message:post-created` (most important!)
2. `message:post-deleted`
3. `message:read` / `message:unread`
4. `message:exported`
5. `exhibit:deleted`
6. `user:login`
7. `user:logout`
8. `user:role-changed`
9. `user:added-to-document`
10. `user:removed-from-document`

### Phase 3: Enhanced Workflow Context (FUTURE)
Add document title/version to workflow events:
- `workflow:reject` 
- `workflow:complete`
- `workflow:reset`
- `workflow:request-review`

### Phase 4: High Priority Events (FUTURE)
Add version comparison, AI tracking, track changes events (10 events)

### Phase 5: Analytics & UX (FUTURE)
Add search, access, configuration tracking (6 events)

---

## 📈 Current Coverage

**Events Defined**: 32  
**Events Fully Enhanced**: 12 (37.5%)  
**Events Need Enhancement**: 13 (40.6%)  
**Events Unused**: 1 (3.1%)  
**Critical Events Missing**: 10  
**Total Needed for Comprehensive Coverage**: ~58 events

**Current Implementation**: 55% complete (32/58)  
**With Critical Events Added**: 72% complete (42/58)


