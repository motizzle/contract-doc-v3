# Document Variables - Backend-Managed Cross-Platform System

> Backend-managed variable system with platform-specific rendering (SuperDoc for web, Content Controls for Word)

## Overview

Document variables allow users to define reusable placeholders that can be inserted into documents and managed centrally. The backend stores variable definitions and values as the **source of truth**, while each platform renders them using native capabilities.

### Core Principles

1. **Backend is source of truth** - Variables stored server-side, not in document format
2. **Platform-specific rendering** - SuperDoc Field Annotations (web) and Word Content Controls (add-in)
3. **Real-time sync** - SSE broadcasts changes to all connected clients
4. **Always show values** - Variables display their current value (highlighted) in the document
5. **Simple types** - Only two types: `value` (text) and `signature` (DocuSign placeholder)

---

## Use Cases

### Value Variables (Text Data)
```
This Agreement is made between [Party A Name] and [Party B Name] 
on [Contract Date] for the amount of [Contract Amount].
```

**In document:** Shows actual values like "John Doe", "Jane Smith", "2025-10-03", "$50,000" (with highlighting)

### Signature Variables (DocuSign Integration)
```
Client Signature: [Client Signature]
Witness Signature: [Witness Signature]
```

**In document:** Shows placeholder during editing, **hidden when printing/exporting**

---

## Architecture

### Data Model

**Variable Definition + Value** (single object):
```json
{
  "var-1": {
    "varId": "var-1",
    "displayLabel": "Party A Name",
    "type": "value",
    "category": "Parties",
    "value": "John Doe",
    "createdBy": "user1",
    "createdAt": "2025-10-03T10:00:00Z",
    "updatedBy": "user1",
    "updatedAt": "2025-10-03T10:05:00Z"
  },
  "sig-1": {
    "varId": "sig-1",
    "displayLabel": "Client Signature",
    "type": "signature",
    "category": "Signatures",
    "value": null,
    "docusignRole": "Client",
    "createdBy": "user1",
    "createdAt": "2025-10-03T10:00:00Z"
  }
}
```

**Field Properties:**
- `varId` (string, required) - Unique identifier
- `displayLabel` (string, required) - Human-readable name shown in UI
- `type` (enum, required) - `"value"` or `"signature"`
- `category` (string) - Grouping (e.g., "Parties", "Contract Details", "Signatures")
- `value` (string|null) - Current value (for type=value only)
- `docusignRole` (string) - For signature variables, the signer role
- `createdBy`, `createdAt`, `updatedBy`, `updatedAt` - Audit fields

---

## Storage

**Backend:** `data/app/variables.json`
```json
{
  "var-1": { ... },
  "var-2": { ... },
  "sig-1": { ... }
}
```

**Document Representation:**

**Web (SuperDoc):**
- SuperDoc Field Annotations with `fieldId=varId`
- Field annotation's `displayLabel` shows current value
- When value changes, update all field annotations via `editor.commands.updateFieldAnnotations(varId, { displayLabel: newValue })`

**Word (Content Controls):**
- Word Content Controls with `tag=varId`
- Content Control text shows current value
- When value changes, update all controls: `contentControl.insertText(newValue, 'Replace')`

---

## API Endpoints

### Variables CRUD

#### GET `/api/v1/variables`
Get all variables

**Response:**
```json
{
  "variables": {
    "var-1": { "varId": "var-1", "displayLabel": "Party A Name", "type": "value", "value": "John Doe", ... },
    "sig-1": { "varId": "sig-1", "displayLabel": "Client Signature", "type": "signature", ... }
  }
}
```

#### POST `/api/v1/variables`
Create new variable

**Request:**
```json
{
  "displayLabel": "Party A Name",
  "type": "value",
  "category": "Parties",
  "value": "",
  "userId": "user1"
}
```

**Response:**
```json
{
  "ok": true,
  "variable": {
    "varId": "var-1234567890",
    "displayLabel": "Party A Name",
    "type": "value",
    "category": "Parties",
    "value": "",
    "createdBy": "user1",
    "createdAt": "2025-10-03T10:00:00Z"
  }
}
```

**Server Actions:**
- Generate unique `varId`
- Save to `variables.json`
- Log activity: `variable:created`
- Broadcast SSE: `{ type: 'variable:created', variable: {...} }`

#### PUT `/api/v1/variables/:varId/value`
Update variable value

**Request:**
```json
{
  "value": "Jane Smith",
  "userId": "user1"
}
```

**Response:**
```json
{
  "ok": true,
  "variable": { "varId": "var-1", "value": "Jane Smith", "updatedBy": "user1", "updatedAt": "..." }
}
```

**Server Actions:**
- Update value in `variables.json`
- Log activity: `variable:valueChanged`
- Broadcast SSE: `{ type: 'variable:valueChanged', varId: "var-1", value: "Jane Smith" }`

#### PUT `/api/v1/variables/:varId`
Update variable metadata (label, category)

**Request:**
```json
{
  "displayLabel": "Updated Label",
  "category": "New Category",
  "userId": "user1"
}
```

**Response:**
```json
{
  "ok": true,
  "variable": { ... }
}
```

**Server Actions:**
- Update metadata in `variables.json`
- Log activity: `variable:updated`
- Broadcast SSE: `{ type: 'variable:updated', variable: {...} }`

#### DELETE `/api/v1/variables/:varId`
Delete variable

**Request:**
```json
{
  "userId": "user1"
}
```

**Response:**
```json
{
  "ok": true
}
```

**Server Actions:**
- Remove from `variables.json`
- Log activity: `variable:deleted`
- Broadcast SSE: `{ type: 'variable:deleted', varId: "var-1" }`
- **Note:** Does NOT remove from documents automatically (user's choice)

---

## SSE Events

### `variable:created`
**Data:**
```json
{
  "type": "variable:created",
  "variable": { "varId": "var-1", "displayLabel": "Party A Name", ... }
}
```

**Client Action:** Add to variables list in UI

### `variable:valueChanged`
**Data:**
```json
{
  "type": "variable:valueChanged",
  "varId": "var-1",
  "value": "Jane Smith",
  "updatedBy": "user1",
  "updatedAt": "2025-10-03T10:00:00Z"
}
```

**Client Action:**
- Update value in Variables panel
- **Web:** `editor.commands.updateFieldAnnotations(varId, { displayLabel: value })`
- **Word:** Update all Content Controls with matching tag

### `variable:updated`
**Data:**
```json
{
  "type": "variable:updated",
  "variable": { "varId": "var-1", "displayLabel": "Updated Label", ... }
}
```

**Client Action:** Update variable metadata in UI

### `variable:deleted`
**Data:**
```json
{
  "type": "variable:deleted",
  "varId": "var-1"
}
```

**Client Action:** Remove from variables list in UI

### `variables:reset`
**Data:**
```json
{
  "type": "variables:reset"
}
```

**Client Action:** Clear all variables (factory reset)

---

## UI Design

### Variables Panel (Sidepane Tab)

```
┌────────────────────────────────────────┐
│ Variables                         [+]  │
├────────────────────────────────────────┤
│ ▼ Parties                              │
│   Party A Name                    [↻]  │
│   [John Doe                       ]    │
│   Party B Name                    [↻]  │
│   [Jane Smith                     ]    │
│                                        │
│ ▼ Contract Details                     │
│   Contract Date                   [↻]  │
│   [2025-10-03                     ]    │
│   Contract Amount                 [↻]  │
│   [$50,000                        ]    │
│                                        │
│ ▼ Signatures (DocuSign)                │
│   Client Signature                [↻]  │
│   Witness Signature               [↻]  │
└────────────────────────────────────────┘
```

**Features:**
- **[+] button** - Create new variable
- **[↻] button** - Insert variable into document at cursor
- **Value input** - Type to update value (auto-saves with debounce)
- **Collapsible categories** - Group variables by category
- **Signature variables** - No value input, just insert button

### Create/Edit Variable Modal

**Triggered by:** Click [+] or click existing variable name

```
┌────────────────────────────────────────┐
│ Create Variable                        │
├────────────────────────────────────────┤
│ Label*: [Party A Name            ]     │
│                                        │
│ Type:   ⚫ Value  ⚪ Signature          │
│                                        │
│ Category: [Parties ▼]                  │
│           (or create new)              │
│                                        │
│ [Only if type=value]                   │
│ Default Value: [                  ]    │
│                                        │
│         [Cancel] [Save]  [Delete]      │
└────────────────────────────────────────┘
```

**Validation:**
- Label is required
- Type is required
- Category defaults to "Uncategorized"

---

## Platform-Specific Implementation

### Web Viewer (SuperDoc)

**Insert Variable:**
```javascript
function insertVariable(variable) {
  const editor = window.superdocInstance.editor;
  
  editor.commands.addFieldAnnotationAtSelection({
    fieldId: variable.varId,
    displayLabel: variable.value || variable.displayLabel,
    fieldType: variable.type === 'signature' ? 'SIGNATURE' : 'TEXTINPUT',
    fieldColor: variable.type === 'signature' ? '#FFA500' : '#980043',
    type: variable.type === 'signature' ? 'signature' : 'text'
  });
}
```

**Update Variable Value:**
```javascript
eventSource.addEventListener('variable:valueChanged', (event) => {
  const { varId, value } = JSON.parse(event.data);
  
  const editor = window.superdocInstance.editor;
  editor.commands.updateFieldAnnotations(varId, {
    displayLabel: value
  });
});
```

### Word Add-in (Content Controls)

**Insert Variable:**
```javascript
async function insertVariable(variable) {
  await Word.run(async (context) => {
    const range = context.document.getSelection();
    const cc = range.insertContentControl();
    
    cc.title = variable.displayLabel;
    cc.tag = variable.varId;
    cc.appearance = 'Tags';
    cc.color = variable.type === 'signature' ? '#FFA500' : '#980043';
    cc.insertText(variable.value || variable.displayLabel, 'Replace');
    
    // Highlighting
    cc.font.highlightColor = '#FFC0CB';
    cc.font.bold = true;
    
    // Hide signature placeholders in print mode
    if (variable.type === 'signature') {
      cc.cannotEdit = true; // Lock content
    }
    
    await context.sync();
  });
}
```

**Update Variable Value:**
```javascript
eventSource.addEventListener('variable:valueChanged', async (event) => {
  const { varId, value } = JSON.parse(event.data);
  
  await Word.run(async (context) => {
    const controls = context.document.contentControls.getByTag(varId);
    controls.load('items');
    await context.sync();
    
    controls.items.forEach(cc => {
      cc.insertText(value, 'Replace');
    });
    
    await context.sync();
  });
});
```

---

## Print Mode (Signature Visibility)

### Requirement
Signature placeholders should be **visible during editing** but **hidden when printing/exporting**.

### Solution: Print Mode Toggle

**UI:** Add toggle in toolbar or Variables panel
```
┌────────────────────────────────┐
│ ⚫ Edit Mode  ⚪ Print Mode     │
└────────────────────────────────┘
```

**Edit Mode (default):**
- All variables visible (values + signature placeholders)
- Signature placeholders show `[Client Signature]` with styling

**Print Mode:**
- Value variables: Show values (normal)
- Signature variables: **Hidden** or replaced with blank lines

**Implementation:**

**Web (SuperDoc):**
```javascript
function togglePrintMode(isPrintMode) {
  const editor = window.superdocInstance.editor;
  
  if (isPrintMode) {
    // Hide signature field annotations
    editor.commands.setFieldAnnotationsHiddenByCondition(
      node => node.attrs.type === 'signature',
      true
    );
  } else {
    // Show all field annotations
    editor.commands.unsetFieldAnnotationsHidden();
  }
}
```

**Word (Content Controls):**
```javascript
async function togglePrintMode(isPrintMode) {
  await Word.run(async (context) => {
    // Get all signature content controls
    const variables = await getVariables(); // From backend
    const sigVarIds = Object.values(variables)
      .filter(v => v.type === 'signature')
      .map(v => v.varId);
    
    sigVarIds.forEach(async (varId) => {
      const controls = context.document.contentControls.getByTag(varId);
      controls.load('items');
      await context.sync();
      
      controls.items.forEach(cc => {
        if (isPrintMode) {
          cc.font.hidden = true; // Hide for printing
        } else {
          cc.font.hidden = false; // Show for editing
        }
      });
    });
    
    await context.sync();
  });
}
```

---

## Implementation Phases

### Phase 3.1: Backend Variable System ✅
- [x] Create `data/app/variables.json` storage
- [x] API endpoints: GET, POST, PUT (value), PUT (metadata), DELETE
- [x] SSE broadcasting for all variable operations
- [x] Activity logging

### Phase 3.2: Variables Panel UI
- [ ] Add "Variables" tab to sidepane
- [ ] List variables grouped by category
- [ ] Inline value editing with auto-save (debounced)
- [ ] [+] Create variable button → Opens modal
- [ ] [↻] Insert variable button → Inserts at cursor
- [ ] Create/Edit Variable Modal with validation

### Phase 3.3: Platform-Specific Insertion
- [ ] Web: Insert SuperDoc field annotations
- [ ] Word: Insert Content Controls
- [ ] Both: Link to backend variable via varId

### Phase 3.4: Real-Time Value Sync
- [ ] SSE listener for `variable:valueChanged`
- [ ] Web: Update SuperDoc field annotations
- [ ] Word: Update Content Controls
- [ ] Test: Change value in panel → updates in document

### Phase 3.5: Print Mode (Signature Visibility)
- [ ] Add Print Mode toggle to UI
- [ ] Web: Hide/show signature field annotations
- [ ] Word: Hide/show signature Content Controls
- [ ] Test: Toggle mode → signatures disappear/reappear

---

## Testing Checklist

### Backend
- [ ] Create variable → Saved to variables.json
- [ ] Update value → Value changes in storage
- [ ] Update metadata → Label/category changes
- [ ] Delete variable → Removed from storage
- [ ] SSE broadcasts all operations correctly

### UI
- [ ] Variables panel loads all variables from backend
- [ ] Variables grouped by category
- [ ] Can create new variable via modal
- [ ] Can edit value inline (auto-saves)
- [ ] Can insert variable at cursor (both platforms)
- [ ] Real-time sync: User A changes value → User B sees update

### Cross-Platform
- [ ] Insert variable in web → Shows in document
- [ ] Insert variable in Word → Shows in document
- [ ] Change value in web → Updates Word instances
- [ ] Change value in Word → Updates web instances
- [ ] Same variable inserted in both platforms → Both update when value changes

### Print Mode
- [ ] Edit Mode: All variables visible
- [ ] Print Mode: Signature placeholders hidden
- [ ] Toggle mode: Signatures appear/disappear
- [ ] Export to PDF in Print Mode: Signatures not visible

### Edge Cases
- [ ] Delete variable that's in document → Variable still exists in document (orphaned)
- [ ] Factory reset → All variables cleared
- [ ] Multiple instances of same variable → All update together
- [ ] Empty value → Shows label as placeholder

---

## Future Enhancements (Post-Phase 3)

### Phase 4: Enhanced UX
- [ ] Search/filter variables
- [ ] Drag & drop from panel to document
- [ ] Click variable in document → Opens edit modal (web only)
- [ ] Show count of instances per variable
- [ ] Bulk operations (delete multiple, update multiple)

### Phase 5: DocuSign Integration
- [ ] Export variables to DocuSign template
- [ ] Map signature variables to DocuSign roles
- [ ] Import DocuSign field values after signing
- [ ] Anchor text configuration for signature placement

### Phase 6: Advanced Features
- [ ] Variable validation rules (required, format, regex)
- [ ] Conditional variables (show/hide based on other variables)
- [ ] Variable templates (pre-defined sets)
- [ ] Variable history/audit trail
- [ ] Role-based permissions (who can edit values)

---

## Technical Notes

### Why Backend as Source of Truth?

1. **Single source of truth** - One place to update, propagates everywhere
2. **Platform independence** - Variables exist independently of rendering format
3. **Real-time sync** - SSE broadcasts changes to all clients
4. **Version control** - Variable state persists across document versions
5. **Conflict resolution** - Server handles concurrent updates

### Variable Storage vs Document Storage

**Variable data** (backend):
- Variable definitions (label, type, category)
- Current values
- Metadata (created/updated by/at)

**Document data** (frontend):
- Variable instances (where variables appear)
- Rendering format (SuperDoc annotations or Content Controls)
- Visual styling (colors, highlighting)

**Sync mechanism:**
- Backend tracks variable data
- Frontend tracks variable positions in document
- SSE synchronizes value changes across all clients

### Content Control vs Field Annotation Parity

| Feature | SuperDoc Field Annotation | Word Content Control |
|---------|---------------------------|----------------------|
| Insert at cursor | `addFieldAnnotationAtSelection()` | `range.insertContentControl()` |
| Update value | `updateFieldAnnotations(id, {displayLabel})` | `cc.insertText(value, 'Replace')` |
| Find by ID | `findFieldAnnotationsByFieldId(id)` | `contentControls.getByTag(id)` |
| Delete | `deleteFieldAnnotations(id)` | `cc.delete()` |
| Styling | `fieldColor`, `fieldType` | `appearance`, `color`, `font` |
| Hide/Show | `setFieldAnnotationsHidden()` | `font.hidden = true/false` |

---

## Summary

**Key Decisions:**
1. ✅ Backend manages variable data (source of truth)
2. ✅ Platform-specific rendering (SuperDoc + Content Controls)
3. ✅ Real-time sync via SSE
4. ✅ Always show values (highlighted in document)
5. ✅ Print Mode toggle for signature visibility
6. ✅ Two types only: `value` and `signature`
7. ✅ Simple inline editing in sidepane

**What We Built So Far (Phase 2):**
- Fields panel UI ✅
- Field creation modal ✅
- Field insertion (both platforms) ✅
- Backend storage (`fields.json`) ✅
- SSE broadcasting ✅

**What Needs Updating:**
- Rename "fields" → "variables" everywhere
- Add `value` property to storage
- Add inline value editing to panel
- Add `variable:valueChanged` SSE event
- Add platform-specific value update handlers
- Add Print Mode toggle

**Recommendation:** Keep existing Phase 2 work, just refactor to add value editing and rename terminology.

