# Document Variables (SuperDoc Field Annotations)

**Status:** ✅ Implemented  
**Test Coverage:** 5 tests (Phase 10: Variables CRUD)  
**Last Updated:** August 2024

## Related Documentation
- `architecture/USER-WORKFLOWS.md` - Variable workflow examples
- `features/conditional-sections-research.md` - Content Control research
- `features/automated-testing-suite.md` - Test specifications

---

## Overview

This feature integrates SuperDoc's existing **Field Annotation Plugin** into our application, providing:
- Server-side storage of field definitions and values
- Real-time synchronization across Word add-in and web platforms
- UI panel for managing fields/variables
- Cross-platform compatibility for both platforms

SuperDoc already provides the document editor integration (inserting, updating, deleting fields). Our implementation adds:
1. **Server persistence** - Store field definitions in `data/app/fields.json`
2. **Cross-platform UI** - Manage fields from sidepane (both add-in and web)
3. **Real-time sync** - Broadcast field changes via SSE to all clients
4. **Activity logging** - Track who created/updated fields and when

### Use Cases

**Contract Templates:**
```
Party A: [Party A Name]
Address: [Party A Address]
Effective Date: [Date]
```

**Form Fields:**
```
Signature: [Click to sign]
Initial here: [Initials]
Date signed: [Auto-fill date]
```

**Dynamic Content:**
```
Jurisdiction: [Select state]
Contract Value: [Enter amount]
```

## Architecture

### SuperDoc Field Annotation System

SuperDoc's Field Annotation plugin provides:
- **Field types**: text, signature, image, checkbox, link, HTML
- **Commands**: `addFieldAnnotation`, `updateFieldAnnotations`, `deleteFieldAnnotations`
- **Helpers**: `findFieldAnnotationsByFieldId`, `getAllFieldAnnotations`
- **Events**: `fieldAnnotationClicked`, `fieldAnnotationDropped`

**See full SuperDoc API:** Field Annotation documentation (provided)

### Our Integration Layer

```
┌─────────────────────────────────────────┐
│  Word Add-in / Web Viewer UI            │
│  - Fields Panel (sidepane tab)          │
│  - Field editor modal                   │
│  - Activity log integration             │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  SuperDoc Editor (already integrated)   │
│  - Field Annotation Plugin (built-in)   │
│  - Document editing, display, events    │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Server (Node.js/Express)               │
│  - Store fields.json                    │
│  - API endpoints (CRUD)                 │
│  - SSE broadcasting                     │
│  - Activity logging                     │
└─────────────────────────────────────────┘
```

### Server-Side Storage

Fields stored in `data/app/fields.json`:

```json
{
  "field-123": {
    "fieldId": "field-123",
    "displayLabel": "Party A Name",
    "fieldType": "TEXTINPUT",
    "fieldColor": "#980043",
    "type": "text",
    "category": "Parties",
    "defaultValue": "",
    "createdBy": "user1",
    "createdAt": "2025-10-02T12:00:00.000Z",
    "updatedBy": "user1",
    "updatedAt": "2025-10-02T12:00:00.000Z"
  },
  "field-456": {
    "fieldId": "field-456",
    "displayLabel": "Signature",
    "fieldType": "SIGNATURE",
    "fieldColor": "#980043",
    "type": "signature",
    "category": "Signatures",
    "defaultValue": null,
    "createdBy": "user2",
    "createdAt": "2025-10-02T12:05:00.000Z"
  }
}
```

### Field Types (SuperDoc Native)

- **text** - Text input field (`TEXTINPUT`)
- **signature** - Signature field (`SIGNATURE`)
- **image** - Image upload field
- **checkbox** - Boolean checkbox
- **link** - Hyperlink field
- **html** - Rich HTML content

### Document Representation (SuperDoc)

Fields are native SuperDoc nodes with attrs:
```javascript
{
  fieldId: 'field-123',
  displayLabel: 'Party A Name',
  fieldType: 'TEXTINPUT',
  fieldColor: '#980043',
  type: 'text',
  hidden: false
}
```

## UI/UX Design

### Fields Panel (Sidepane Tab)

**Location:** New tab "Fields" in the bottom panel alongside "Messages", "Activity", "Versions"

**Layout:**
```
┌─────────────────────────────────────┐
│ Fields                         [+]  │ <- Create new field
├─────────────────────────────────────┤
│ Search fields...                    │
├─────────────────────────────────────┤
│ ▼ Parties                          │ <- Category (collapsible)
│   Party A Name                [↻]  │ <- Insert button
│   Party B Name                [↻]  │
│                                     │
│ ▼ Signatures                       │
│   Client Signature            [↻]  │
│   Witness Signature           [↻]  │
│                                     │
│ ▼ Dates                            │
│   Effective Date              [↻]  │
│   Expiration Date             [↻]  │
└─────────────────────────────────────┘
```

**Features:**
- Click field name → Highlight all instances in document (SuperDoc API)
- Click [↻] button → Insert field at cursor (SuperDoc `addFieldAnnotationAtSelection`)
- Click field in document → Opens field editor (SuperDoc `fieldAnnotationClicked` event)
- Search/filter fields by name or category
- Reuse existing card styling from other tabs

### Field Editor Modal

**Triggered by:** 
- Click "+" in Fields panel
- Click field in document (SuperDoc `fieldAnnotationClicked` event)

**Modal Content:**
```
Field Label*:       [Party A Name                    ]
Field Type:         [Text ▼] (Text/Signature/Image/Checkbox)
Category:           [Parties ▼] (create new or select)
Color:              [#980043] (color picker)
Default Value:      [                                ]

[Cancel] [Save]
```

### Insert Field Flow

**Method 1: From Panel (Our UI)**
1. User places cursor in document
2. User clicks [↻] button next to field in panel
3. Calls: `editor.commands.addFieldAnnotationAtSelection({ fieldId, displayLabel, ... })`

**Method 2: Drag & Drop (SuperDoc Native)**
1. SuperDoc supports drag & drop natively
2. Listen to `fieldAnnotationDropped` event
3. Save field to server when dropped

**Method 3: Right-click Context Menu (Future)**
1. User right-clicks in document → "Insert Field"
2. Opens field selector modal
3. Inserts selected field

## API Endpoints

### GET `/api/v1/fields`
Get all field definitions

**Response:**
```json
{
  "fields": {
    "field-123": {
      "fieldId": "field-123",
      "displayLabel": "Party A Name",
      "fieldType": "TEXTINPUT",
      "type": "text",
      "category": "Parties",
      "createdBy": "user1",
      "createdAt": "2025-10-02T12:00:00.000Z"
    }
  }
}
```

### POST `/api/v1/fields`
Create new field definition

**Request:**
```json
{
  "fieldId": "field-123",
  "displayLabel": "Party A Name",
  "fieldType": "TEXTINPUT",
  "fieldColor": "#980043",
  "type": "text",
  "category": "Parties",
  "userId": "user1"
}
```

**Response:**
```json
{
  "ok": true,
  "field": { ... }
}
```

### PUT `/api/v1/fields/:fieldId`
Update field definition

**Request:**
```json
{
  "displayLabel": "Updated Label",
  "category": "New Category",
  "userId": "user1"
}
```

### DELETE `/api/v1/fields/:fieldId`
Delete field definition

**Query params:**
- `removeFromDocument=true` - Also remove all instances from document (calls SuperDoc API)
- `removeFromDocument=false` - Only delete definition, leave instances in document

**Response:**
```json
{
  "ok": true,
  "fieldId": "field-123"
}
```

## Real-Time Updates

### SSE Broadcasting

When fields are created/updated/deleted, broadcast to all connected clients:

```javascript
// Field created
{
  type: 'field:created',
  field: {
    fieldId: 'field-123',
    displayLabel: 'Party A Name',
    ...
  },
  userId: 'user1',
  timestamp: '2025-10-02T12:00:00.000Z'
}

// Field updated
{
  type: 'field:updated',
  fieldId: 'field-123',
  changes: { displayLabel: 'Updated Label' },
  userId: 'user1'
}

// Field deleted
{
  type: 'field:deleted',
  fieldId: 'field-123',
  userId: 'user1'
}
```

### Client Handling

```javascript
// Listen for field updates
window.addEventListener('message', (e) => {
  try {
    const data = JSON.parse(e.data);
    
    if (data.type === 'field:created') {
      // Add to fields panel UI
      refreshFieldsPanel();
    }
    
    if (data.type === 'field:updated') {
      // Update field definition in panel
      // Use SuperDoc API to update instances in document
      editor.commands.updateFieldAnnotations(data.fieldId, data.changes);
      refreshFieldsPanel();
    }
    
    if (data.type === 'field:deleted') {
      // Remove from panel
      // Optionally remove from document
      refreshFieldsPanel();
    }
  } catch {}
});
```

## SuperDoc Integration

### Using SuperDoc Commands

**Insert Field:**
```javascript
// At cursor position
editor.commands.addFieldAnnotationAtSelection({
  fieldId: 'field-123',
  displayLabel: 'Party A Name',
  fieldType: 'TEXTINPUT',
  fieldColor: '#980043',
  type: 'text'
});

// At specific position
editor.commands.addFieldAnnotation(100, {
  fieldId: 'field-123',
  displayLabel: 'Party A Name',
  ...
});
```

**Update Field Instances:**
```javascript
// Update all instances of a field by fieldId
editor.commands.updateFieldAnnotations('field-123', {
  displayLabel: 'Updated Label',
  fieldColor: '#FF0000'
});

// Update single instance
const annotation = editor.helpers.fieldAnnotation.findFirstFieldAnnotationByFieldId('field-123', state);
editor.commands.updateFieldAnnotation(annotation, { displayLabel: 'New Label' });
```

**Delete Field Instances:**
```javascript
// Delete all instances of a field
editor.commands.deleteFieldAnnotations('field-123');

// Delete multiple fields
editor.commands.deleteFieldAnnotations(['field-1', 'field-2']);
```

**Find Fields:**
```javascript
// Get all fields in document
const allFields = editor.helpers.fieldAnnotation.getAllFieldAnnotations(state);

// Find specific field instances
const instances = editor.helpers.fieldAnnotation.findFieldAnnotationsByFieldId('field-123', state);

// Find first instance
const first = editor.helpers.fieldAnnotation.findFirstFieldAnnotationByFieldId('field-123', state);
```

### SuperDoc Events

**Field Clicked:**
```javascript
editor.on('fieldAnnotationClicked', ({ node, nodePos }) => {
  const fieldId = node.attrs.fieldId;
  // Open field editor modal
  openFieldEditorModal(fieldId);
});
```

**Field Dropped:**
```javascript
editor.on('fieldAnnotationDropped', ({ sourceField }) => {
  // Save new field to server if it doesn't exist
  if (!fieldExists(sourceField.fieldId)) {
    createField(sourceField);
  }
});
```

## Implementation Phases

### Phase 1 - Infrastructure & Data Flow (Backend Only)
**Goal:** Build and test the complete backend infrastructure without UI

**Deliverables:**
- [ ] Server-side storage (`data/app/fields.json`)
- [ ] API endpoints (GET, POST, PUT, DELETE `/api/v1/fields`)
- [ ] SSE broadcasting (field:created, field:updated, field:deleted)
- [ ] Activity logging (field operations)
- [ ] Verify SuperDoc Field Annotation plugin is loaded
- [ ] Test SuperDoc commands work: `addFieldAnnotationAtSelection`, `updateFieldAnnotations`, `deleteFieldAnnotations`

**Testing:**
- [ ] Use Postman/curl to test all API endpoints
- [ ] Verify fields.json is created and updated correctly
- [ ] Test SSE events are broadcast properly
- [ ] Console test: Insert field via SuperDoc command in browser devtools
- [ ] Verify activity log captures field operations

**Success Criteria:**
- Can CRUD fields via API
- Fields persist in `data/app/fields.json`
- SSE broadcasts field changes
- Can manually insert field into document via console

**Estimated:** 1-2 days

### Phase 2 - Basic UI Wireframe (Minimal Insert)
**Goal:** New tab with simple "Enter Variable" button that inserts into document

**Deliverables:**
- [ ] New "Fields" tab in bottom panel (alongside Messages, Activity, Versions)
- [ ] Simple wireframe UI:
  - Header: "Fields" with [+ Enter Variable] button
  - Body: Empty placeholder text (e.g., "No fields yet")
- [ ] Click [+ Enter Variable] → Opens simple prompt modal
- [ ] Modal: "Enter field name: [____] [Cancel] [Insert]"
- [ ] Insert button → Calls SuperDoc `addFieldAnnotationAtSelection` at cursor
- [ ] Field is inserted into document with basic defaults (text type, default color)
- [ ] Works on both Word add-in and web viewer

**Testing:**
- [ ] Open Fields tab, click "Enter Variable"
- [ ] Type a field name, click Insert
- [ ] Field appears in document at cursor position
- [ ] Field is functional (can see the field annotation in document)
- [ ] Repeat on both web and Word add-in

**Success Criteria:**
- Fields tab is visible and accessible
- Can insert a basic field into document from UI
- Field shows up in document with SuperDoc styling

**Estimated:** 1 day

### Phase 3 - Configure View & Storage (Full Feature)
**Goal:** Full field management UI with list, edit, categories, and persistence

**Deliverables:**
- [ ] Update Fields tab to show list of all fields (grouped by category)
- [ ] Each field shows: name, type, category, color
- [ ] Click field name → Highlight all instances in document
- [ ] Click [↻] button next to field → Insert at cursor
- [ ] Click [+ Enter Variable] → Opens full field editor modal:
  - Field Label* (required)
  - Field Type dropdown (Text, Signature, Image, Checkbox)
  - Category dropdown (with "Create new..." option)
  - Color picker
  - Default Value (optional)
- [ ] Click field in document → Opens edit modal (listen to `fieldAnnotationClicked`)
- [ ] Edit modal has [Delete] button → Removes field definition and optionally from document
- [ ] Search/filter fields by name or category
- [ ] Real-time sync: When user creates/edits field, all clients update via SSE
- [ ] Category management (create new, rename)

**Testing:**
- [ ] Create multiple fields with different types and categories
- [ ] Verify fields appear in list grouped by category
- [ ] Insert field from list into document
- [ ] Click field in document, edit properties, verify changes reflected
- [ ] Delete field, verify removed from list and (optionally) document
- [ ] Test with two users: User A creates field, verify User B sees it immediately

**Success Criteria:**
- Full CRUD operations on fields from UI
- Fields grouped by category in panel
- Can insert, edit, delete fields seamlessly
- Real-time sync works across clients
- Works on both platforms

**Estimated:** 3-4 days

### Phase 4 - Enhanced UX (Polish)
**Goal:** Power user features and refinements

- [ ] Drag & drop from panel to document (SuperDoc native support)
- [ ] Quick stats (# of instances per field in document)
- [ ] Field validation rules (required, format, etc.)
- [ ] Bulk operations (delete multiple, update multiple)
- [ ] Export/import field definitions (JSON)
- [ ] Field templates (predefined sets for contract types)

**Estimated:** 2-3 days

### Phase 5 - Advanced Features (Future)
- [ ] Conditional fields (show/hide based on other field values)
- [ ] Field history/audit trail
- [ ] Field permissions (role-based access)
- [ ] Integration with approvals (require approval to change fields)
- [ ] Field autocomplete/suggestions

## Technical Considerations

### 1. **SuperDoc Plugin Setup**
**Question:** Is Field Annotation plugin already loaded in our SuperDoc instances?

**Action:** Check if `FieldAnnotationPlugin` is imported and configured in both:
- Web: `web/superdoc-init.js` or similar
- Add-in: SuperDoc initialization code

**Code to verify:**
```javascript
import { FieldAnnotationPlugin } from '@superdoc/field-annotation';
const plugin = FieldAnnotationPlugin({ editor: myEditor, ... });
```

### 2. **Cross-Platform Compatibility**
**Challenge:** Ensure SuperDoc API calls work identically in Word add-in and web

**Testing needed:**
- `addFieldAnnotationAtSelection` - Insert at cursor
- `updateFieldAnnotations` - Update all instances
- `deleteFieldAnnotations` - Delete all instances
- Event listeners (`fieldAnnotationClicked`, `fieldAnnotationDropped`)

### 3. **Document State Sync**
**Question:** When user loads document from server, how do we restore fields?

**Options:**
- A) Fields are baked into document .docx (SuperDoc handles)
- B) We need to re-inject fields on load (API call + SuperDoc commands)

**Likely:** Option A - SuperDoc stores field annotations in document itself

### 4. **Field ID Generation**
**Question:** Who generates field IDs?

**Recommendation:**
- Client generates: `field-${Date.now()}-${Math.random()}`
- Server validates uniqueness
- Store in `fields.json` with metadata

### 5. **Factory Reset**
**Question:** Should fields survive factory reset?

**Recommendation:** 
- Clear `fields.json` on factory reset (like other data)
- Fields in document get removed when document reverts to canonical

### 6. **Permissions**
**Question:** Who can create/edit/delete fields?

**Phase 1:** Anyone can (match current permission model)
**Future:** Role-based (editors can create, approvers can only view)

## Open Questions for Discussion

### Priority Questions:

1. **Scope:** Are fields document-specific or shared across all documents in the app?
   - **Recommendation:** Document-specific (stored in `data/app/fields.json` per app instance)

2. **SuperDoc Plugin:** Is `FieldAnnotationPlugin` already loaded?
   - **Action:** Check initialization code

3. **Field Types:** Which SuperDoc field types do we support in Phase 1?
   - **Recommendation:** Start with `text` only, add others in Phase 2

4. **Default Styling:** What color/appearance for fields?
   - **Recommendation:** Use SuperDoc default (`#980043`), allow customization in Phase 2

### Nice-to-Have:

5. **Bulk Import:** Should we support CSV/JSON import of fields?
   - **Later:** Phase 3

6. **Field Validation:** Should fields have validation rules?
   - **Later:** Phase 3

7. **Templates:** Pre-built field sets for common contracts?
   - **Later:** Phase 4

## Next Steps

1. **Review this spec** - Confirm approach and priorities
2. **Check SuperDoc setup** - Verify Field Annotation plugin is loaded
3. **Test SuperDoc API** - Verify all commands work on both platforms
4. **Design review** - Confirm UI mockups for Fields panel and modal
5. **Start Phase 1** - Server storage + basic panel UI

