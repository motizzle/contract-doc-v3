# Feature: Scenario Loader

---

## Summary

Scenario Loader allows users to quickly switch between predefined application states (factory reset, nearly-done negotiation) or save their current state as a reusable scenario for demos, testing, and training.

---

## Problem Statement

**Current:** Factory reset only resets to empty state. Users manually rebuild demo states after each reset.

**Solution:** Load predefined scenarios OR save current state as a named scenario for future reuse.

---

## User Stories

**As a** demo presenter  
**I want to** save my current application state as a scenario  
**So that** I can instantly restore this exact state for future demos

**As a** tester  
**I want to** switch between different scenarios  
**So that** I can test workflows at different completion stages

---

## UI Specification

### Entry Point

**Location:** Settings tab → "Scenario Loader" button (replaces "Factory Reset" button)

**Button Label:** "Scenario Loader"

---

### Modal: Scenario Loader

**Title:** "Scenario Loader"

**Description:** "Load a preset scenario or save your current state for reuse."

---

### Option 1: Factory Reset

**Card Layout:**
- **Label:** "Factory Reset"
- **Description:** "Reset to blank slate - no messages, variables, or history."
- **ID:** `empty`
- **Action:** Loads `data/app/presets/empty/`

**Behavior:**
- Clears all working data
- Restores canonical document
- Resets to version 1
- Clears all messages, variables, activity

---

### Option 2: Almost Done

**Card Layout:**
- **Label:** "Almost Done"
- **Description:** "90% complete negotiation with messages, variables, versions, and approvals."
- **ID:** `nearly-done`
- **Action:** Loads `data/app/presets/nearly-done/`

**Behavior:**
- Restores 28 activity entries
- Loads 4 messages (4 posts)
- Restores 20 variables
- Loads 6 version snapshots (v2-v7)
- Sets document to version 7
- Saves the 6 versions previously specified
- Restores 4/5 approvals (Kent Uckey not approved)
- Sets the document status to final

---

### Option 3: Save My Current Scenario

**Card Layout:**
- **Label:** "Save Current Scenario"
- **Description:** "Capture current state as a reusable scenario."
- **ID:** `save-new`
- **Action:** Opens save dialog

**Save Dialog:**

**Title:** "Save Current Scenario"

**Fields:**
- **Scenario Name** (required)
  - Text input
  - Validation: 3-50 characters, alphanumeric + spaces/hyphens
  - Placeholder: "e.g., Q1 Demo, Vendor Negotiation"

- **Description** (optional)
  - Textarea (2 rows)
  - Max 200 characters
  - Placeholder: "Brief description of this scenario"

**Actions:**
- **Cancel** (secondary)
- **Save Scenario** (primary)

**Validation:**
- Name required
- Name must be unique (check existing scenarios)
- Cannot overwrite `empty` or `nearly-done` (reserved)
- Show error if scenario name exists: "Scenario 'X' already exists. Choose a different name or delete the existing one first."

---

### Existing Scenarios Section

**Location:** Below preset cards, above modal footer

**Title:** "Your Saved Scenarios"

**Display:**
- List of user-saved scenarios (if any)
- Each row shows:
  - **Name** (clickable card like presets)
  - **Description** (if provided)
  - **Delete** icon (trash can, right side)

**Empty State:**
- "No saved scenarios yet. Save your current state to create one."

**Card Click:** Loads that scenario (same as preset)

**Delete Click:**
- Confirmation modal: "Delete scenario 'X'? This cannot be undone."
- On confirm: Deletes `data/app/scenarios/{slug}/` directory
- Updates scenario list

---

## Technical Specification

### Data Storage

**Preset Scenarios (System-provided):**
- Location: `data/app/presets/{preset}/`
- Read-only (cannot be deleted by users)
- Ships with application

**User Scenarios (User-created):**
- Location: `data/app/scenarios/{slug}/`
- User-created and deletable
- Additive to app data (not destructive)

**Scenario Structure:**
```
data/app/scenarios/{slug}/
├── state.json
├── activity-log.json
├── messages.json
├── fields.json
├── variables.json
├── approvals.json
├── metadata.json          # NEW: name, description, created date
├── default.docx
└── versions/
    ├── v2.docx
    ├── v2.json
    └── ...
```

---

### API Endpoints

#### `GET /api/v1/scenarios`

**Purpose:** List all available scenarios (presets + user-saved)

**Response:**
```json
{
  "presets": [
    { "id": "empty", "label": "Factory Reset", "description": "...", "type": "preset" },
    { "id": "nearly-done", "label": "Almost Done", "description": "...", "type": "preset" }
  ],
  "scenarios": [
    { 
      "id": "demo-2025", 
      "label": "Demo 2025", 
      "description": "Q1 demo with full workflow",
      "created": "2025-10-21T12:00:00Z",
      "type": "user" 
    }
  ]
}
```

---

#### `POST /api/v1/scenarios/save`

**Purpose:** Save current state as a named scenario

**Request:**
```json
{
  "name": "Demo 2025",
  "description": "Q1 demo with full workflow",
  "userId": "user1"
}
```

**Behavior:**
1. Validate name (required, unique, not reserved)
2. Generate slug from name (`demo-2025`)
3. Create `data/app/scenarios/{slug}/` directory
4. Copy all current state files (same as capture script)
5. Create `metadata.json` with name, description, created date
6. Log activity: `system:scenario-saved`

**Response:**
```json
{
  "ok": true,
  "scenario": {
    "id": "demo-2025",
    "label": "Demo 2025",
    "description": "Q1 demo with full workflow",
    "created": "2025-10-21T12:00:00Z"
  }
}
```

**Errors:**
- `400` - Invalid name
- `409` - Scenario already exists
- `500` - Save failed

---

#### `POST /api/v1/scenarios/load`

**Purpose:** Load a scenario (preset or user-saved)

**Request:**
```json
{
  "scenarioId": "demo-2025",
  "userId": "user1"
}
```

**Behavior:**
1. Check if `scenarioId` is in presets (use `presets/{id}/`)
2. Otherwise check scenarios (use `scenarios/{id}/`)
3. Load all files from scenario directory → working directories
4. Broadcast SSE events (same as factory reset)

**Response:**
```json
{
  "ok": true,
  "scenario": {
    "id": "demo-2025",
    "label": "Demo 2025"
  }
}
```

---

#### `DELETE /api/v1/scenarios/:id`

**Purpose:** Delete a user-saved scenario

**Request:** `DELETE /api/v1/scenarios/demo-2025?userId=user1`

**Behavior:**
1. Validate: Cannot delete presets (`empty`, `nearly-done`)
2. Delete `data/app/scenarios/{id}/` directory recursively
3. Log activity: `system:scenario-deleted`

**Response:**
```json
{
  "ok": true
}
```

**Errors:**
- `403` - Cannot delete preset
- `404` - Scenario not found
- `500` - Delete failed

---

## Implementation Plan

### Phase 1: Rename Factory Reset → Scenario Loader (1 hour)

**UI Changes:**
- Rename button in `FactoryResetModal`
- Update modal title
- Update card labels/descriptions
- Keep existing `empty` and `nearly-done` presets

**Backend Changes:**
- Rename activity log type: `system:factory-reset` → `system:scenario-loaded`

---

### Phase 2: Add "Save Current Scenario" (2 hours)

**Backend:**
- `POST /api/v1/scenarios/save` endpoint
- Copy current state to `data/app/scenarios/{slug}/`
- Create `metadata.json`
- Validation (name, uniqueness)

**Frontend:**
- Add "Save Current Scenario" card
- Save dialog modal with name/description inputs
- Form validation
- Success toast

---

### Phase 3: List & Load User Scenarios (1 hour)

**Backend:**
- `GET /api/v1/scenarios` endpoint
- Scan `data/app/scenarios/` directory
- Return presets + user scenarios

**Frontend:**
- "Your Saved Scenarios" section
- Clickable scenario cards
- Load user scenario (same flow as presets)

---

### Phase 4: Delete User Scenarios (30 min)

**Backend:**
- `DELETE /api/v1/scenarios/:id` endpoint
- Prevent deleting presets

**Frontend:**
- Delete icon on scenario cards
- Confirmation modal
- Remove from list on success

---

## Testing Checklist

### Save Scenario
- [ ] Save with valid name → success
- [ ] Save with duplicate name → error
- [ ] Save with reserved name (`empty`) → error
- [ ] Save with invalid name (too short) → error
- [ ] Verify all files copied to `scenarios/{slug}/`
- [ ] Verify metadata.json created

### Load Scenario
- [ ] Load preset (`empty`) → resets correctly
- [ ] Load preset (`nearly-done`) → loads 26 activities, 4 messages, etc.
- [ ] Load user scenario → restores exact state
- [ ] Load non-existent scenario → 404 error

### Delete Scenario
- [ ] Delete user scenario → files removed
- [ ] Delete preset → 403 error
- [ ] Delete non-existent scenario → 404 error

### UI
- [ ] Modal shows 3 options (Factory Reset, Almost Done, Save)
- [ ] Save dialog opens correctly
- [ ] User scenarios list updates after save
- [ ] User scenarios list updates after delete
- [ ] All scenarios clickable and load correctly
- [ ] Confirmation modals work (save, delete, load)

---

## Migration from Factory Reset

### Backward Compatibility

**Existing presets:** Keep as-is
- `data/app/presets/empty/` → "Factory Reset" option
- `data/app/presets/nearly-done/` → "Almost Done" option
- `data/app/presets/initial-vendor/` → Hidden (not shown in UI for now)

**No data migration needed** - presets continue to work, just accessed through new UI

---

## Future Enhancements

### Scenario Management
- Export/import scenarios (share between deployments)
- Scenario tags/categories
- Scenario preview (show stats before loading)
- Scenario versioning

### Advanced Features
- Partial scenario loading (e.g., only messages)
- Scenario diffing (compare two scenarios)
- Auto-save scenarios at milestones
- Scheduled scenario rotation (for training environments)

---

## Files Modified

**Frontend:**
- `shared-ui/components.react.js` - Modal UI updates

**Backend:**
- `server/src/server.js` - New endpoints, scenario management

**Data:**
- `data/app/scenarios/` - New directory for user scenarios

**Tools:**
- `tools/scripts/capture-preset.ps1` - Reusable for scenario capture

---

## Success Metrics

**Phase 1:**
- ✅ Factory Reset renamed to Scenario Loader
- ✅ Existing presets work through new UI

**Phase 2:**
- ✅ Users can save current state as scenario
- ✅ Scenarios persist across server restarts

**Phase 3:**
- ✅ Users can load saved scenarios
- ✅ Scenario list updates dynamically

**Phase 4:**
- ✅ Users can delete saved scenarios
- ✅ Presets cannot be deleted

---

## Acceptance Criteria

- [ ] Modal renamed to "Scenario Loader"
- [ ] 3 options visible: Factory Reset, Almost Done, Save Current
- [ ] Factory Reset works (clears to empty state)
- [ ] Almost Done works (loads 90% complete state)
- [ ] Save dialog opens and validates input
- [ ] Current state saves successfully
- [ ] Saved scenarios appear in list
- [ ] Saved scenarios load correctly
- [ ] Saved scenarios can be deleted
- [ ] Presets cannot be deleted
- [ ] All data restored correctly (messages, variables, versions, approvals, activity)
- [ ] Activity log tracks scenario saves/loads/deletes

---

**Last Updated:** October 21, 2025  
**Status:** 🚧 Specification Complete - Ready for Implementation

