# Variables/Fields - Phase 1 Testing Guide

> Backend infrastructure testing without UI

## Prerequisites

- Server running: `npm start` (from `server/` directory)
- Web viewer open: `https://localhost:4001/view`
- Browser DevTools open (F12)

## Test 1: Verify SuperDoc is Loaded

**In browser console:**
```javascript
// Check if SuperDoc is available
console.log('SuperDoc loaded:', typeof window.superdocInstance !== 'undefined');
console.log('SuperDoc instance:', window.superdocInstance);
```

**Expected:** SuperDoc instance object logged

⚠️ **Note:** Field Annotation Plugin is NOT currently loaded. This is expected - we'll add it in Phase 2 when we need it.

---

## Test 2: Fields API - CREATE Field

**Using curl (PowerShell):**
```powershell
$body = @{
  fieldId = "field-test-1"
  displayLabel = "Party A Name"
  fieldType = "TEXTINPUT"
  fieldColor = "#980043"
  type = "text"
  category = "Parties"
  defaultValue = ""
  userId = "user1"
} | ConvertTo-Json

Invoke-RestMethod -Method POST -Uri "https://localhost:4001/api/v1/fields" `
  -ContentType "application/json" `
  -Body $body `
  -SkipCertificateCheck
```

**Using fetch (browser console):**
```javascript
await fetch('https://localhost:4001/api/v1/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fieldId: 'field-test-1',
    displayLabel: 'Party A Name',
    fieldType: 'TEXTINPUT',
    fieldColor: '#980043',
    type: 'text',
    category: 'Parties',
    defaultValue: '',
    userId: 'user1'
  })
})
.then(r => r.json())
.then(d => console.log('Created:', d));
```

**Expected Response:**
```json
{
  "ok": true,
  "field": {
    "fieldId": "field-test-1",
    "displayLabel": "Party A Name",
    "fieldType": "TEXTINPUT",
    "fieldColor": "#980043",
    "type": "text",
    "category": "Parties",
    "defaultValue": "",
    "createdBy": "user1",
    "createdAt": "2025-10-02T...",
    "updatedBy": "user1",
    "updatedAt": "2025-10-02T..."
  }
}
```

**Verify:**
- ✅ File created: `data/app/fields.json`
- ✅ Activity log entry created
- ✅ SSE event broadcast (check Network tab → EventSource)

---

## Test 3: Fields API - READ All Fields

**Using fetch:**
```javascript
await fetch('https://localhost:4001/api/v1/fields')
  .then(r => r.json())
  .then(d => console.log('All fields:', d));
```

**Expected Response:**
```json
{
  "fields": {
    "field-test-1": {
      "fieldId": "field-test-1",
      "displayLabel": "Party A Name",
      ...
    }
  }
}
```

---

## Test 4: Fields API - UPDATE Field

**Using fetch:**
```javascript
await fetch('https://localhost:4001/api/v1/fields/field-test-1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    displayLabel: 'Party A Name (Updated)',
    category: 'Contract Parties',
    userId: 'user1'
  })
})
.then(r => r.json())
.then(d => console.log('Updated:', d));
```

**Expected:**
- ✅ Field updated in `fields.json`
- ✅ Activity log entry
- ✅ SSE `field:updated` broadcast

---

## Test 5: Fields API - DELETE Field

**Using fetch:**
```javascript
await fetch('https://localhost:4001/api/v1/fields/field-test-1?userId=user1', {
  method: 'DELETE'
})
.then(r => r.json())
.then(d => console.log('Deleted:', d));
```

**Expected:**
- ✅ Field removed from `fields.json`
- ✅ Activity log entry
- ✅ SSE `field:deleted` broadcast

---

## Test 6: SSE Broadcasting

**In browser console (leave open):**
```javascript
// Listen for field events
window.addEventListener('field:created', (e) => {
  console.log('🟢 Field created:', e.detail);
});

window.addEventListener('field:updated', (e) => {
  console.log('🟡 Field updated:', e.detail);
});

window.addEventListener('field:deleted', (e) => {
  console.log('🔴 Field deleted:', e.detail);
});
```

**Then create/update/delete fields using the API calls above**

**Expected:** Console logs show events in real-time

---

## Test 7: Activity Logging

**View activity log:**
```javascript
await fetch('https://localhost:4001/api/v1/activity')
  .then(r => r.json())
  .then(d => {
    const fieldActivities = d.activities.filter(a => a.target === 'field');
    console.log('Field activities:', fieldActivities);
  });
```

**Expected:** Activities for field:created, field:updated, field:deleted

---

## Test 8: SuperDoc Field Annotation Commands (Manual)

⚠️ **Important:** Field Annotation plugin needs to be loaded first. Currently NOT implemented.

**When plugin is loaded, test these commands:**

```javascript
const editor = window.superdocInstance.editor;

// Insert field at cursor
editor.commands.addFieldAnnotationAtSelection({
  fieldId: 'field-test-manual',
  displayLabel: 'Test Field',
  fieldType: 'TEXTINPUT',
  fieldColor: '#980043',
  type: 'text'
});

// Get all fields in document
const allFields = editor.helpers.fieldAnnotation.getAllFieldAnnotations(editor.state);
console.log('Fields in document:', allFields);

// Update field
editor.commands.updateFieldAnnotations('field-test-manual', {
  displayLabel: 'Updated Test Field',
  fieldColor: '#FF0000'
});

// Delete field
editor.commands.deleteFieldAnnotations('field-test-manual');
```

**Expected (when plugin loaded):**
- Field appears in document
- Field can be clicked and edited
- Field styling updates
- Field can be deleted

---

## Test 9: Factory Reset

**Test that fields are cleared:**
```javascript
// Create a test field first
await fetch('https://localhost:4001/api/v1/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fieldId: 'field-temp',
    displayLabel: 'Temp Field',
    userId: 'user1'
  })
});

// Verify it exists
await fetch('https://localhost:4001/api/v1/fields')
  .then(r => r.json())
  .then(d => console.log('Before reset:', d));

// Factory reset
await fetch('https://localhost:4001/api/v1/factory-reset', {
  method: 'POST'
});

// Verify fields cleared
await fetch('https://localhost:4001/api/v1/fields')
  .then(r => r.json())
  .then(d => console.log('After reset:', d)); // Should be empty {}
```

**Expected:** Fields cleared after factory reset

---

## Test 10: Error Handling

**Test duplicate fieldId:**
```javascript
// Create field
await fetch('https://localhost:4001/api/v1/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fieldId: 'dupe-test', displayLabel: 'Test', userId: 'user1' })
});

// Try to create again with same ID
await fetch('https://localhost:4001/api/v1/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fieldId: 'dupe-test', displayLabel: 'Test 2', userId: 'user1' })
})
.then(r => r.json())
.then(d => console.log('Expected error:', d)); 
// Should return 409 Conflict
```

**Test missing required fields:**
```javascript
await fetch('https://localhost:4001/api/v1/fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fieldId: 'test' }) // Missing displayLabel
})
.then(r => r.json())
.then(d => console.log('Expected error:', d)); 
// Should return 400 Bad Request
```

**Test non-existent field:**
```javascript
await fetch('https://localhost:4001/api/v1/fields/does-not-exist', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ displayLabel: 'New Name', userId: 'user1' })
})
.then(r => r.json())
.then(d => console.log('Expected error:', d)); 
// Should return 404 Not Found
```

---

## Success Criteria

- ✅ All API endpoints work (GET, POST, PUT, DELETE)
- ✅ Fields persist in `data/app/fields.json`
- ✅ SSE events broadcast correctly
- ✅ Activity log captures field operations
- ✅ Factory reset clears fields
- ✅ Error handling works correctly
- ⚠️ SuperDoc Field Annotation plugin NOT loaded (expected - add in Phase 2)

---

## Next Steps

**Phase 2:** Add UI tab with "Enter Variable" button that calls SuperDoc commands


