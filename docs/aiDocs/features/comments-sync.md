# Comments Sync — Specification

## Summary

Enable Word-style commenting and track changes across web viewer and Word add-in with role-based permissions. Comments and tracked changes sync across platforms through the DOCX file format, with proper visibility controls based on user role (editor/suggester/viewer).

## Problem Statement

Currently, comments and tracked changes are **not visible** in the web viewer because:
1. SuperDoc `comments` module is not configured in initialization
2. Missing `window.__IS_DEBUG__ = false` global (required by SuperDoc 0.14.19 for track changes)
3. No UI container for comments sidebar

This was previously implemented (per `docs/fromV2/superdoc-role-and-autoload.md`) but has been removed from the current codebase.

**Note:** Comments sync naturally across platforms through the DOCX file format - no special sync infrastructure needed.

## Role-Based Document Modes

SuperDoc document mode is determined by user role at initialization. Editors can switch modes mid-session, other roles are locked.

| User Role | Default Mode | Can Switch Modes? | Permissions |
|-----------|--------------|-------------------|-------------|
| **Editor** | `editing` | ✅ Yes (editing/suggesting/viewing) | Full editing, all comment operations, accept/reject changes |
| **Suggester** | `suggesting` | ❌ No (locked) | Track changes only, can comment, cannot make direct edits |
| **Viewer** | `viewing` | ❌ No (locked) | Read-only, can view comments but cannot create/edit |

### Role → Mode Mapping

```javascript
function getModeForRole(role) {
  const roleMap = {
    'viewer': 'viewing',
    'suggester': 'suggesting', 
    'vendor': 'suggesting',
    'editor': 'editing'  // Default, but editor can change
  };
  return roleMap[role] || 'editing';
}
```

### Editor Mode Switching

**Built-in SuperDoc feature:** When `role: 'editor'`, SuperDoc's toolbar automatically includes a mode switcher.

**Implementation:** Just set the role correctly
```javascript
const userRole = getCurrentRole(); // 'editor' | 'suggester' | 'viewer'

new SuperDoc({
  selector: '#editor',
  document: '/documents/working/default.docx',
  role: userRole,  // SuperDoc shows mode toggle when role='editor'
  documentMode: getModeForRole(userRole),  // Initial state
  toolbar: '#superdoc-toolbar',
  modules: {
    comments: { enabled: true }
  }
})
```

**How it works:**
- **Editor** → Sees mode switcher in toolbar (editing/suggesting/viewing)
- **Suggester** → No mode switcher (locked to suggesting)
- **Viewer** → No mode switcher (locked to viewing)

**Mode vs Role:**
- `role` = what user CAN do (permanent, based on account)
- `documentMode` = current editing state (changeable via toolbar for editors)
- Role always wins: `role: 'viewer'` + `documentMode: 'editing'` = still view-only

**No custom code needed** — SuperDoc's toolbar handles mode switching automatically.

### User Switching

When user switches in the dropdown (e.g., Warren Peace → Jane Smith):
1. SuperDoc reinitializes with the new user's role-based mode
2. UI permissions update via state matrix
3. Comments remain in DOCX, visible according to new user's permissions

## Comments Module Configuration

### Web Viewer (`web/superdoc-init.js`)

**Before SuperDoc loads:**
```html
<script>
  window.__IS_DEBUG__ = false;
</script>
```

**SuperDoc initialization:**
```javascript
// Get current user's role from state
const userRole = getCurrentRole(); // 'editor' | 'suggester' | 'viewer'
const documentMode = getModeForRole(userRole); // 'editing' | 'suggesting' | 'viewing'

const superdoc = new SuperDoc({
  selector: '#superdoc',
  document: '/documents/working/default.docx',
  toolbar: '#superdoc-toolbar',
  role: userRole,         // Determines toolbar features (mode switcher for editors)
  documentMode: documentMode,  // Initial state
  user: {
    name: getUserDisplayName(),
    email: getUserEmail()
  },
  modules: {
    fieldAnnotation: {
      enabled: true,
      allowCreate: true,
      allowEdit: true,
      allowDelete: true
    },
    comments: {
      enabled: true,
      readOnly: userRole === 'viewer',
      allowResolve: userRole !== 'viewer',
      element: '#comments-container'
    }
  },
  onCommentsUpdate: handleCommentEvent
});
```

### HTML Layout Changes (`web/view.html`)

Add comments container to the right pane:

```html
<div id="layout">
  <div id="editor-col">
    <div id="superdoc-toolbar"></div>
    <div id="superdoc"></div>
  </div>
  <aside id="pane">
    <div id="app-root"></div>
    <div id="comments-container"></div> <!-- NEW -->
  </aside>
</div>
```

**Styling:**
```css
#comments-container {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #eee;
  background: #fafafa;
}
```

### Word Add-in

Word add-in accesses comments via Office.js API, which reads/writes the **same Word XML comment format** that SuperDoc uses in the web viewer. Both platforms work with standard DOCX `comments.xml` structure.

**Comments sync naturally through the DOCX file:**
- Web user adds comment → Comments saved to DOCX on save/checkin
- Word user opens document → Office.js reads comments from DOCX
- Word user adds comment → Comments saved to DOCX on save/checkin  
- Web user opens document → SuperDoc reads comments from DOCX

**No real-time sync infrastructure needed** — Comments appear after save/refresh cycle, matching existing document sync behavior.

## Comment Event Handling

### Event Types

SuperDoc fires `onCommentsUpdate` for local UI updates only (not for cross-client sync):
- `pending` — User selected text, about to add comment
- `add` — New comment created
- `update` — Comment text edited
- `delete` — Comment removed
- `resolved` — Comment marked resolved
- `selected` — Comment clicked/selected

**Note:** These events handle UI state within the current session. Comments persist to DOCX on save/checkin and sync across platforms via file refresh.

### Event Handler (`web/superdoc-init.js`)

```javascript
function handleCommentEvent({ type, comment, meta }) {
  // Log for diagnostics
  console.log('Comment event:', type, comment);
  
  // Update local UI state
  if (type === 'resolved') {
    showNotification(`Comment resolved`);
  }
  
  // Comments automatically persist in SuperDoc's internal state
  // They save to DOCX when user clicks Save or Check-in
}
```

## Track Changes Integration

Track changes automatically generate special comments:

```javascript
// Track change comment structure
{
  commentId: 'tc-uuid',
  trackedChange: true,
  trackedChangeType: 'insertion' | 'deletion',
  deletedText: 'text that was removed', // only for deletions
  readOnly: true, // cannot edit track change comments
  creatorName: 'John Smith',
  creatorEmail: 'john@example.com',
  createdTime: 1234567890
}
```

**Accept/Reject handlers** (optional Phase 2):
```javascript
onCommentsUpdate: ({ type, comment }) => {
  if (comment.trackedChange) {
    // Show accept/reject UI for tracked changes
    comment.onAccept = () => applyTrackedChange(comment.commentId);
    comment.onReject = () => rejectTrackedChange(comment.commentId);
  }
}
```

## Role-Based Permissions Matrix

| Action | Editor (editing) | Editor (suggesting) | Suggester | Viewer |
|--------|------------------|---------------------|-----------|--------|
| View comments | ✅ | ✅ | ✅ | ✅ |
| Add comment | ✅ | ✅ | ✅ | ❌ |
| Edit own comment | ✅ | ✅ | ✅ | ❌ |
| Edit others' comment | ✅ | ❌ | ❌ | ❌ |
| Delete own comment | ✅ | ✅ | ✅ | ❌ |
| Delete others' comment | ✅ | ❌ | ❌ | ❌ |
| Resolve comment | ✅ | ✅ | ✅ | ❌ |
| Direct edits | ✅ | ❌ | ❌ | ❌ |
| Track changes | ✅ | ✅ (forced) | ✅ (forced) | ❌ |
| View track changes | ✅ | ✅ | ✅ | ✅ |
| Accept/reject changes | ✅ | ❌ | ❌ | ❌ |

## Server-Side

**No special comment endpoints needed.** Comments are embedded in the DOCX file and sync through existing document save/load infrastructure:

- **Save:** SuperDoc exports comments to DOCX → Server saves to `documents/working/default.docx`
- **Load:** Server serves DOCX → SuperDoc imports comments from DOCX
- **Existing endpoints handle everything:**
  - `GET /documents/working/default.docx` (load with comments)
  - `POST /api/v1/save-progress` (save with comments)
  - `POST /api/v1/checkin` (save with comments)

## Import/Export Behavior

### Importing Comments (from DOCX)

Word comments are automatically imported by SuperDoc with `importedId` field:

```javascript
{
  commentId: 'uuid-generated',
  importedId: 'w15:123', // Original Word comment ID
  importedAuthor: {
    name: 'John Smith (imported)',
    email: 'john@company.com'
  },
  parentCommentId: 'parent-uuid' // Threaded replies preserved
}
```

### Exporting Comments (to DOCX)

Use `commentsType` parameter in export:

```javascript
// Include comments in export
const blob = await superdoc.exportDocx({
  commentsType: 'external', // or 'all'
  isFinalDoc: false
});

// Clean export (no comments)
const cleanBlob = await superdoc.exportDocx({
  commentsType: 'clean',
  isFinalDoc: true
});
```

## Implementation Phases

### Phase 1: Enable Comments Module — 1-2 days

**Goal:** Make comments and track changes visible in web viewer

**Changes:**
- [ ] Add `window.__IS_DEBUG__ = false` to `web/view.html` (before SuperDoc script)
- [ ] Add `#comments-container` to HTML layout
- [ ] Configure `modules.comments` in `web/superdoc-init.js`
- [ ] Add `onCommentsUpdate` handler (logging only)
- [ ] Set `role` param based on current user (enables SuperDoc's mode switcher for editors)
- [ ] Set `documentMode` param to initial mode for user's role
- [ ] Verify SuperDoc toolbar shows mode switcher for editors
- [ ] Verify SuperDoc exports include comments in DOCX

**Testing:**
- [ ] Create comment in web viewer → appears in sidebar
- [ ] Make edit in "suggesting" mode → tracked change appears as comment
- [ ] **Editor mode switching:**
  - [ ] Start in editing mode → make direct edit → text changes immediately
  - [ ] Switch to suggesting mode → make edit → appears as tracked change
  - [ ] Switch to viewing mode → cannot edit (read-only)
  - [ ] Switch back to editing mode → can edit again
  - [ ] Comments persist through mode switches
- [ ] Save document → comments persist in DOCX file
- [ ] Reload page → comments still visible
- [ ] Open same DOCX in Word → comments visible
- [ ] Add comment in Word → save → refresh web → comment visible

**Acceptance:**
- ✅ Comments and track changes visible in web viewer
- ✅ Role-based permissions enforced (viewers read-only, suggesters locked to suggesting)
- ✅ Editors can switch between editing/suggesting/viewing modes
- ✅ Mode switching preserves document state and comments
- ✅ Comments sync across web ↔ Word via file save/load
- ✅ No crashes or console errors

### Phase 2: Advanced Features — 2-3 days (Optional)

**Features:**
- Accept/reject track changes UI
- Comment threads and replies
- Internal vs external comments (dual system)
- Comment filtering (by user, resolved/unresolved)
- Comment search
- Export with/without comments toggle

## Testing Strategy

### Unit Tests

**Test: Role permissions**
```javascript
test('viewer cannot create comments', () => {
  const config = getCommentsConfig('viewer', 'viewing');
  expect(config.readOnly).toBe(true);
});

test('editor in suggesting mode creates tracked changes', () => {
  const config = getCommentsConfig('editor', 'suggesting');
  expect(config.readOnly).toBe(false);
  // Track changes should be enabled at SuperDoc level
});
```

### Integration Tests

**Test: Comment creation flow**
1. Initialize SuperDoc with comments module
2. Select text in editor
3. Trigger comment creation
4. Verify `onCommentsUpdate` fires with type='add'
5. Verify comment appears in sidebar

**Test: Track changes in suggesting mode**
1. Initialize SuperDoc with documentMode='suggesting'
2. Make text edit
3. Verify tracked change comment created
4. Verify `trackedChange: true` flag set

### E2E Tests (Manual for MVP)

**Scenario: Editor workflow**
1. Editor logs in → sees editing mode
2. Makes direct edit → text changes immediately (no track change)
3. Switches to "suggesting" mode
4. Makes edit → tracked change appears as comment
5. Resolves comment → comment marked resolved
6. Exports DOCX → comments included

**Scenario: Suggester workflow**
1. Suggester logs in → locked to suggesting mode
2. Makes edit → tracked change appears automatically
3. Adds comment → comment appears in sidebar
4. Cannot switch to editing mode (dropdown disabled)
5. Cannot make direct edits

**Scenario: Viewer workflow**
1. Viewer logs in → locked to viewing mode
2. Can see all comments and track changes
3. Cannot create new comments (UI disabled)
4. Cannot make any edits
5. Cannot resolve comments

## State Matrix Integration

Update state matrix to include comment/mode configuration:

```javascript
// In /api/state response
{
  user: {
    userId: 'user1',
    role: 'editor',
    documentMode: 'editing' // current mode choice
  },
  config: {
    comments: {
      enabled: true,
      canCreate: role !== 'viewer',
      canResolve: role !== 'viewer',
      canEdit: role === 'editor'
    },
    trackChanges: {
      enabled: documentMode === 'suggesting',
      forced: role === 'suggester' // always on for suggesters
    },
    modeToggle: {
      visible: role === 'editor',
      options: ['editing', 'suggesting', 'viewing'],
      current: documentMode
    }
  }
}
```

## Open Questions

1. **Accept/reject UI:** How to present tracked changes for review?
   - **Recommendation:** Phase 2 feature. MVP shows tracked changes as read-only comments in sidebar.

2. **Comment filtering:** Should users be able to filter by type (regular comments vs track changes)?
   - **Recommendation:** Phase 2. MVP shows all comments and track changes together.

3. **Export options:** Should "Export to PDF" include or exclude comments by default?
   - **Recommendation:** Follow finalize behavior - exclude comments when finalized, include otherwise.

4. **Resolved comments visibility:** Should resolved comments be hidden or grayed out?
   - **Recommendation:** Gray out but keep visible. Users can manually delete if needed.

## Success Metrics

**Phase 1 (MVP):**
- ✅ Comments visible in web viewer
- ✅ Track changes visible in web viewer  
- ✅ Role permissions enforced (viewers read-only, suggesters can comment, editors full control)
- ✅ Comments sync across platforms via file save/load
- ✅ No console errors or SuperDoc initialization failures
- ✅ Import DOCX with comments works (comments appear in sidebar)
- ✅ Export DOCX with comments works (comments preserved in file)

**Phase 2 (Advanced Features):**
- ✅ Accept/reject workflow functional
- ✅ Comment filtering by type/user/status
- ✅ Internal/external comment separation
- ✅ Export with comment filtering options

## References

- SuperDoc Comments Module: https://docs.superdoc.dev/guide/modules#comments
- Our lessons learned: `docs/fromV2/superdoc-role-and-autoload.md`
- Comment documentation page: `docs/aiDocs/features/conditional-sections.md` (user provided)

