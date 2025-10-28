# Activity Log Audit

## Current State

The activity log system is **well-implemented** with expandable cards and rich detail capture. However, there are gaps in event coverage and some events could capture more useful information.

## ✅ Events Currently Logged (32 types)

### Workflow Events (6 types)
- ✅ `workflow:approve` - With actor/target distinction and progress
- ✅ `workflow:remove-approval` - With actor/target distinction  
- ✅ `workflow:reject` - With notes
- ✅ `workflow:complete` - When all approvals are done
- ✅ `workflow:reset` - Clear all approvals
- ✅ `workflow:request-review` - Send review request

### Document Events (11 types)
- ✅ `document:save` - Save progress with version
- ✅ `document:checkout` - Lock for editing
- ✅ `document:checkin` - Unlock after editing with version
- ✅ `document:checkout:cancel` - Cancel checkout
- ✅ `document:checkout:override` - Override someone's checkout
- ✅ `document:status-change` - Draft/Review/Final transitions
- ✅ `document:upload` - New document uploaded
- ✅ `document:snapshot` - Manual snapshot created
- ✅ `document:compile` - Compiled to PDF/DOCX
- ✅ `document:send-vendor` - Sent to vendor
- ✅ `document:title-change` - Title updated

### Version Events (2 types)
- ✅ `version:view` - Viewed a specific version
- ✅ `version:restore` - Restored to previous version

### Variable Events (4 types)
- ✅ `variable:created` - New variable added
- ✅ `variable:updated` - Variable properties changed
- ✅ `variable:valueChanged` - Variable value updated
- ✅ `variable:deleted` - Variable removed

### Message/Conversation Events (5 types)
- ✅ `message:created` - New conversation started
- ✅ `message:archived` - Conversation archived
- ✅ `message:unarchived` - Conversation restored
- ✅ `message:flags-updated` - Internal/External/Privilege flags changed
- ✅ `message:deleted` - Conversation deleted

### System Events (5 types)
- ✅ `system:factory-reset` - All data cleared
- ✅ `system:error` - System/LLM errors
- ✅ `system:prompt-update` - AI system prompt changed
- ✅ `system:prompt-reset` - AI prompt reset to default
- ✅ `chat:reset` - Chat history cleared

### Exhibit Events (1 type)
- ✅ `exhibit:upload` - Exhibit uploaded

### Other Events (1 type)
- ✅ `message:send` - **DEFINED BUT NOT USED** (legacy?)

---

## ❌ Missing Critical Events

### User/Authentication Events
- ❌ **User login/logout** - No tracking of who's accessing the system
- ❌ **User role changes** - Editor → Viewer, etc.
- ❌ **User added to document** - When someone is granted access
- ❌ **User removed from document** - When access is revoked

### Message/Post Events
- ❌ **Message post created** - Individual messages within conversations aren't logged!
- ❌ **Message read/unread** - When users mark conversations as read
- ❌ **Message exported** - When CSV exports are generated

### Comparison Events
- ❌ **Version comparison viewed** - Which versions were compared
- ❌ **Comparison mode changed** - Side-by-side vs inline

### AI/Chat Events
- ❌ **AI query sent** - What questions users ask
- ❌ **AI response received** - What AI suggested (would need to be truncated/sanitized)
- ❌ **AI suggestion accepted/rejected** - When users act on AI advice
- ❌ **System prompt viewed** - Who looks at the prompt

### Exhibit Events
- ❌ **Exhibit deleted** - When exhibits are removed
- ❌ **Exhibit renamed** - When exhibit files are renamed
- ❌ **Exhibit viewed/downloaded** - Track exhibit access

### Document Events
- ❌ **Document viewed** - First view or periodic tracking
- ❌ **Document exported** - When downloaded as DOCX/PDF
- ❌ **Track changes accepted** - When changes are approved
- ❌ **Track changes rejected** - When changes are declined
- ❌ **Comment added** - Document comments (if implemented)
- ❌ **Comment resolved** - Comment threads closed

### Search/Filter Events
- ❌ **Search performed** - What users search for (messages, variables, etc.)
- ❌ **Filter applied** - What filters users apply

### Configuration Events
- ❌ **Settings changed** - Any system configuration updates
- ❌ **Theme changed** - If theme/branding changes are implemented

---

## 🔧 Events Needing More Detail

### `document:save`
**Current**: `{ autoSave, version }`  
**Missing**: 
- File size/word count (to show document growth)
- Number of changes since last save
- Whether it was a major or minor edit

### `document:upload`
**Current**: `{ filename, size }`  
**Missing**:
- Previous filename (if replacing)
- File format details
- Whether it replaced existing content

### `document:checkin`
**Current**: `{ version, size }`  
**Missing**:
- How long document was checked out
- How many changes made during checkout

### `document:compile`
**Current**: `{ format, includeExhibits }`  
**Missing**:
- Output file size
- Number of exhibits included
- Success/failure status

### `version:view`
**Current**: `{ version, platform }`  
**Missing**:
- How long version was viewed
- Whether user compared with current

### `variable:valueChanged`
**Current**: Good detail already!  
**Suggestion**: Could add "who else was notified" if variables trigger notifications

### `workflow:approve`
**Current**: Good detail already!  
**Suggestion**: Could add approval duration (time since review requested)

---

## 📊 Recommended Priority

### High Priority (Security & Compliance)
1. **Message post created** - Core messaging audit trail
2. **User login/logout** - Security requirement
3. **Exhibit deleted** - Compliance requirement
4. **Track changes accepted/rejected** - Legal audit trail
5. **AI query sent** (sanitized) - Understand AI usage patterns

### Medium Priority (User Insights)
6. **Document viewed** - Usage analytics
7. **Version comparison viewed** - Understand review workflow
8. **Message exported** - Data access tracking
9. **Variable search performed** - Usage patterns
10. **Document exported** - Distribution tracking

### Low Priority (Nice to Have)
11. **System prompt viewed** - Admin oversight
12. **Theme changed** - Configuration tracking
13. **Exhibit viewed/downloaded** - Access patterns
14. **AI response metrics** - Quality tracking

---

## 💡 Enhancement Recommendations

### 1. Enrich Existing Events
For events that already exist, add more contextual information:
- Time ranges (how long actions took)
- Before/after comparisons (file sizes, word counts)
- Related entities (which other users/documents affected)
- Outcome status (success/failure/partial)

### 2. Add Missing Core Events
Focus on the high-priority gaps first:
- Message posts within conversations
- User authentication/authorization
- Track changes workflow
- AI interaction tracking

### 3. Improve Activity Card Display
The cards already support expansion. Ensure all events show:
- **Primary message**: Clear, scannable summary
- **Expanded details**: All relevant metadata
- **Visual indicators**: Icons for event types, colors for severity
- **Quick actions**: Links to related entities (e.g., "View version", "Open conversation")

### 4. Add Filtering & Search
- Filter by event type (workflow, document, message, etc.)
- Filter by user
- Filter by date range
- Search within activity descriptions
- Export filtered activity log

---

## 🎯 Implementation Plan

### Phase 1: Fill Critical Gaps (This Branch)
1. ✅ Add expandable detail support to all event types
2. ✅ Ensure all 32 current events show properly
3. ⚠️ Add message post logging
4. ⚠️ Add exhibit deletion logging
5. ⚠️ Add user authentication logging
6. ⚠️ Test all event types generate proper activities

### Phase 2: Enrich Existing Events (Next Branch)
1. Add file size tracking to saves
2. Add duration tracking to checkouts
3. Add comparison tracking to versions
4. Add search/filter events

### Phase 3: Analytics & Insights (Future)
1. Activity dashboard
2. User activity reports
3. System health metrics
4. Compliance reports


