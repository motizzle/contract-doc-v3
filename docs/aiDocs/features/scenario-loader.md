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
- **Description:** "Reset to blank slate with 20 pre-populated signature/value variables."
- **ID:** `empty`
- **Action:** Loads `data/app/presets/empty/`

**Behavior:**
- Clears all messages, activity log, approvals
- Restores 20 seed variables from variables.seed.json:
  - 10 signature variables (CEO, CFO, General Counsel, Director of Procurement, etc.)
  - 10 value variables (Contract Number, Date, Amount, Vendor Name, etc.)
- Resets chat history to default greeting ("Shall we...contract?")
- Restores canonical default.docx (REDLINED & SIGNED MOU)
- Sets status to "draft", version to 1

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
- Restores chat history with contextual conversations about the MOU for all 5 users
- Restores 20 variables (10 signatures + 10 values)
- Loads 6 version snapshots (v2-v7)
- Sets document to version 7
- Restores 4/5 approvals (Kent Uckey not approved)
- Sets document status to "final"
- Sets updatedBy to "Kent Ucky" (user2)

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
├── chat.json              # AI chat history for all users
├── fields.json
├── variables.json
├── approvals.json
├── metadata.json          # Scenario metadata (see schema below)
├── default.docx
└── versions/
    ├── v2.docx
    ├── v2.json
    └── ...
```

**metadata.json Schema:**
```json
{
  "id": "demo-2025",
  "name": "Demo 2025",
  "description": "Q1 demo with full workflow",
  "slug": "demo-2025",
  "created": "2025-10-21T12:34:56.789Z",
  "createdBy": {
    "userId": "user1",
    "label": "Warren Peace"
  },
  "lastUsed": null,
  "stats": {
    "activities": 28,
    "messages": 4,
    "variables": 20,
    "versions": 6,
    "approvals": 4
  }
}
```

**Fields:**
- `id` (string, required): Unique identifier (same as slug)
- `name` (string, required): User-provided display name
- `description` (string, optional): User-provided description (max 200 chars)
- `slug` (string, required): URL-safe identifier derived from name
- `created` (ISO 8601 string, required): Creation timestamp
- `createdBy` (object, required): User who created the scenario
- `lastUsed` (ISO 8601 string, nullable): Last time scenario was loaded
- `stats` (object, optional): Counts of major data types for preview

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
2. Generate slug from name using these rules:
   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove all non-alphanumeric characters except hyphens
   - Collapse multiple hyphens to single hyphen
   - Trim leading/trailing hyphens
   - Truncate to 50 characters
   - Examples: "Demo 2025" → "demo-2025", "Q1 Demo: Vendor!" → "q1-demo-vendor"
   - Validation: Must match regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`
   - Reserved slugs: `empty`, `nearly-done`
3. Create `data/app/scenarios/{slug}/` directory
4. Copy all current state files (same as capture script)
5. Create `metadata.json` with name, description, created date, stats
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

## Backward Compatibility

### API Endpoint Strategy

**Current Endpoint:**
- `/api/v1/factory-reset` - Accepts `{ preset: "empty" | "nearly-done" }`

**Proposed Approach:**
- Keep `/api/v1/factory-reset` as primary endpoint (no breaking changes)
- Activity log type changes from `system:factory-reset` to `system:scenario-loaded`
- UI renames "Factory Reset" to "Scenario Loader" (cosmetic change only)

**Rationale:**
- Minimizes risk - no backend API changes required
- Frontend changes are purely presentational
- Maintains full backward compatibility with existing code
- Can add `/api/v1/scenarios/load` in future if needed for consistency

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
- [ ] Load preset (`empty`) → resets correctly with 20 seed variables
- [ ] Load preset (`nearly-done`) → loads 28 activities, 4 messages, chat history, 6 versions, etc.
- [ ] Load user scenario → restores exact state
- [ ] Load non-existent scenario → 404 error

### Delete Scenario
- [ ] Delete user scenario → files removed
- [ ] Delete preset → 403 error
- [ ] Delete non-existent scenario → 404 error

### Chat History
- [ ] Empty preset loads default greeting for all users
- [ ] Nearly-done preset loads contextual conversations about MOU
- [ ] Chat history persists after scenario load
- [ ] Chat reset works correctly (clears to greeting)
- [ ] User scenarios save and restore chat.json correctly

### UI
- [ ] Modal shows 3 options (Factory Reset, Almost Done, Save)
- [ ] Save dialog opens correctly
- [ ] User scenarios list updates after save
- [ ] User scenarios list updates after delete
- [ ] All scenarios clickable and load correctly
- [ ] Confirmation modals work (save, delete, load)

---

## Migration from Factory Reset

### Data Migration

**Existing presets:** Keep as-is
- `data/app/presets/empty/` → "Factory Reset" option
- `data/app/presets/nearly-done/` → "Almost Done" option

**No data migration needed** - presets continue to work, just accessed through renamed UI

**New functionality:**
- User-created scenarios will be stored in `data/app/scenarios/` (new directory)
- Presets remain in `data/app/presets/` (system-managed, read-only)

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
- `tools/scripts/capture-preset.ps1` - Script to capture current state as a preset
  - **Usage:** `.\capture-preset.ps1 -Preset "preset-name"`
  - Copies all state files from `data/app/` to `data/app/presets/{preset-name}/`
  - Copies working document from `data/working/documents/`
  - Copies all version snapshots from `data/working/versions/`
  - Files captured: state.json, activity-log.json, messages.json, chat.json, fields.json, variables.json, approvals.json, default.docx, versions/*
  - Used for creating/updating presets manually or building user scenarios
  
- `tools/scripts/test-reset-simple.ps1` - Script to test preset loading
  - **Usage:** `.\test-reset-simple.ps1 -Preset "preset-name"`
  - Calls `/api/v1/factory-reset` API with specified preset
  - Verifies all data files are loaded correctly
  - Reports file sizes and counts for validation

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
- [ ] All data restored correctly (messages, chat, variables, versions, approvals, activity, fields)
- [ ] Activity log tracks scenario saves/loads/deletes
- [ ] Chat history persists correctly across scenario loads

---

**Last Updated:** October 21, 2025  
**Status:** 🚧 Specification Complete - Ready for Implementation

