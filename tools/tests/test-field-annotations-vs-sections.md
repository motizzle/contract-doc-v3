# Field Annotations vs Document Sections: Persistence Test

## Goal
Determine if Field Annotations and Document Sections both persist in .docx format, or if they're ephemeral (disappear on save/reload).

---

## Setup

**Requirements:**
- Web viewer running at `https://localhost:4000/web/view.html`
- Fresh document (or factory reset)
- Browser console open (F12)

---

## Test 1: Field Annotations Persistence

### Step 1.1: Insert Field Annotation

**Run in web viewer console:**
```javascript
const editor = window.superdocInstance.editor;

// Check if Field Annotation commands exist
console.log('Field Annotation API:', {
  add: typeof editor.commands.addFieldAnnotationAtSelection,
  update: typeof editor.commands.updateFieldAnnotations,
  delete: typeof editor.commands.deleteFieldAnnotations,
  find: typeof editor.helpers?.fieldAnnotation?.findFieldAnnotationsByFieldId
});

// Insert a test Field Annotation
const result = editor.commands.addFieldAnnotationAtSelection({
  fieldId: 'test-field-annotation',
  displayLabel: 'TEST FIELD ANNOTATION',
  fieldType: 'TEXTINPUT',
  fieldColor: '#980043',
  type: 'text'
});

console.log('Field Annotation inserted:', result);
```

**Expected:** 
- Commands should exist ✅
- Result should be `true` ✅
- You should SEE the field in the document ✅

---

### Step 1.2: Verify It's There

**Run immediately after:**
```javascript
const editor = window.superdocInstance.editor;

// Check for fieldAnnotation nodes
let foundAsFieldAnnotation = false;
let foundAsStructuredContent = false;

editor.view.state.doc.descendants((node, pos) => {
  // Check if it's a fieldAnnotation node
  if (node.type.name === 'fieldAnnotation') {
    console.log('🟢 Found as fieldAnnotation:', {
      fieldId: node.attrs.fieldId,
      displayLabel: node.attrs.displayLabel,
      type: node.type.name,
      position: pos
    });
    if (node.attrs.fieldId === 'test-field-annotation') {
      foundAsFieldAnnotation = true;
    }
  }
  
  // Check if it's a structuredContent node (Content Control)
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const tag = tagElem?.attributes['w:val'];
    
    if (tag === 'test-field-annotation') {
      console.log('🔵 Found as structuredContent:', {
        tag: tag,
        type: node.type.name,
        position: pos
      });
      foundAsStructuredContent = true;
    }
  }
});

console.log('\n📊 Before Save:');
console.log('  As fieldAnnotation:', foundAsFieldAnnotation ? '✅' : '❌');
console.log('  As structuredContent:', foundAsStructuredContent ? '✅' : '❌');
```

**Expected Result:**
- `foundAsFieldAnnotation: true` ✅
- `foundAsStructuredContent: false` (not converted yet)

---

### Step 1.3: Save Document

**Action:** Click the "Save" button in the web viewer

**Wait:** 2-3 seconds for save to complete

---

### Step 1.4: Reload Page

**Action:** Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)

**Wait:** For SuperDoc to fully load (watch for console logs)

---

### Step 1.5: Check After Reload

**Run in console after page loads:**
```javascript
const editor = window.superdocInstance.editor;

// Search for our test Field Annotation
let foundAsFieldAnnotation = false;
let foundAsStructuredContent = false;
let allFieldAnnotations = [];
let allStructuredContent = [];

editor.view.state.doc.descendants((node, pos) => {
  // Track ALL fieldAnnotation nodes
  if (node.type.name === 'fieldAnnotation') {
    allFieldAnnotations.push({
      fieldId: node.attrs.fieldId,
      displayLabel: node.attrs.displayLabel,
      position: pos
    });
    
    if (node.attrs.fieldId === 'test-field-annotation') {
      foundAsFieldAnnotation = true;
      console.log('🟢 FOUND as fieldAnnotation after reload!');
    }
  }
  
  // Track ALL structuredContent nodes
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const aliasElem = elements.find(e => e.name === 'w:alias');
    const tag = tagElem?.attributes['w:val'];
    const alias = aliasElem?.attributes['w:val'];
    
    allStructuredContent.push({
      tag: tag,
      alias: alias,
      position: pos
    });
    
    if (tag === 'test-field-annotation' || alias === 'TEST FIELD ANNOTATION') {
      foundAsStructuredContent = true;
      console.log('🔵 FOUND as structuredContent after reload!');
      console.log('   Tag:', tag);
      console.log('   Alias:', alias);
    }
  }
});

console.log('\n📊 After Reload:');
console.log('  As fieldAnnotation:', foundAsFieldAnnotation ? '✅ PERSISTED' : '❌ DISAPPEARED');
console.log('  As structuredContent:', foundAsStructuredContent ? '✅ CONVERTED' : '❌ NOT FOUND');

console.log('\n📋 All fieldAnnotation nodes:', allFieldAnnotations);
console.log('📋 All structuredContent nodes:', allStructuredContent);
```

**Possible Outcomes:**

**Outcome A: Field Annotation Persists as fieldAnnotation**
- `foundAsFieldAnnotation: true` ✅
- `foundAsStructuredContent: false`
- **Conclusion:** Field Annotations stay as Field Annotations (best case!)

**Outcome B: Field Annotation Converts to Content Control**
- `foundAsFieldAnnotation: false`
- `foundAsStructuredContent: true` ✅
- **Conclusion:** Field Annotations export as Content Controls (still good!)

**Outcome C: Field Annotation Disappears**
- `foundAsFieldAnnotation: false` ❌
- `foundAsStructuredContent: false` ❌
- **Conclusion:** Field Annotations don't persist (our original observation)

---

## Test 2: Document Sections Persistence

### Step 2.1: Insert Document Section

**Run in web viewer console (fresh document or after factory reset):**
```javascript
const editor = window.superdocInstance.editor;

// Check if Document Section commands exist
console.log('Document Section API:', {
  create: typeof editor.commands.createDocumentSection,
  removeById: typeof editor.commands.removeSectionById,
  updateById: typeof editor.commands.updateSectionById
});

// Check schema
const schema = editor.view.state.schema;
console.log('Schema has documentSection:', !!schema.nodes.documentSection);

// Find a valid insertion point
let insertPos = null;
editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'paragraph' && !insertPos && pos > 0) {
    insertPos = pos + node.nodeSize;
  }
});

console.log('Insert position:', insertPos);

if (insertPos) {
  // Create section node manually (command doesn't work reliably)
  const tr = editor.view.state.tr;
  const sectionNode = schema.nodes.documentSection.create(
    { 
      id: 'test-document-section',
      title: 'TEST DOCUMENT SECTION',
      description: 'Testing if sections persist'
    },
    schema.nodes.paragraph.create({}, schema.text('This is section content that should persist.'))
  );
  
  tr.insert(insertPos, sectionNode);
  editor.view.dispatch(tr);
  
  console.log('✅ Document Section inserted manually');
}
```

**Expected:**
- Commands should exist ✅
- Schema should have documentSection ✅
- Section should appear in document ✅

---

### Step 2.2: Verify It's There

**Run immediately after:**
```javascript
const editor = window.superdocInstance.editor;

// Check for documentSection nodes
let foundAsDocumentSection = false;
let foundAsStructuredContent = false;

editor.view.state.doc.descendants((node, pos) => {
  // Check if it's a documentSection node
  if (node.type.name === 'documentSection') {
    console.log('🟢 Found as documentSection:', {
      id: node.attrs.id,
      title: node.attrs.title,
      type: node.type.name,
      position: pos,
      content: node.textContent
    });
    if (node.attrs.id === 'test-document-section') {
      foundAsDocumentSection = true;
    }
  }
  
  // Check if it's a structuredContent node
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const aliasElem = elements.find(e => e.name === 'w:alias');
    const tag = tagElem?.attributes['w:val'];
    const alias = aliasElem?.attributes['w:val'];
    
    if (tag === 'test-document-section' || alias === 'TEST DOCUMENT SECTION') {
      console.log('🔵 Found as structuredContent:', {
        tag: tag,
        alias: alias,
        type: node.type.name,
        position: pos
      });
      foundAsStructuredContent = true;
    }
  }
});

console.log('\n📊 Before Save:');
console.log('  As documentSection:', foundAsDocumentSection ? '✅' : '❌');
console.log('  As structuredContent:', foundAsStructuredContent ? '✅' : '❌');
```

**Expected Result:**
- `foundAsDocumentSection: true` ✅
- `foundAsStructuredContent: false` (not converted yet)

---

### Step 2.3: Save Document

**Action:** Click the "Save" button

**Wait:** 2-3 seconds

---

### Step 2.4: Reload Page

**Action:** Hard refresh (Ctrl+Shift+R)

**Wait:** For SuperDoc to load

---

### Step 2.5: Check After Reload

**Run in console:**
```javascript
const editor = window.superdocInstance.editor;

// Search for our test Document Section
let foundAsDocumentSection = false;
let foundAsStructuredContent = false;
let allDocumentSections = [];
let allStructuredContent = [];

editor.view.state.doc.descendants((node, pos) => {
  // Track ALL documentSection nodes
  if (node.type.name === 'documentSection') {
    allDocumentSections.push({
      id: node.attrs.id,
      title: node.attrs.title,
      position: pos,
      content: node.textContent
    });
    
    if (node.attrs.id === 'test-document-section') {
      foundAsDocumentSection = true;
      console.log('🟢 FOUND as documentSection after reload!');
    }
  }
  
  // Track ALL structuredContent nodes
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const aliasElem = elements.find(e => e.name === 'w:alias');
    const tag = tagElem?.attributes['w:val'];
    const alias = aliasElem?.attributes['w:val'];
    
    allStructuredContent.push({
      tag: tag,
      alias: alias,
      position: pos
    });
    
    if (tag === 'test-document-section' || alias === 'TEST DOCUMENT SECTION') {
      foundAsStructuredContent = true;
      console.log('🔵 FOUND as structuredContent after reload!');
      console.log('   Tag:', tag);
      console.log('   Alias:', alias);
    }
  }
});

console.log('\n📊 After Reload:');
console.log('  As documentSection:', foundAsDocumentSection ? '✅ PERSISTED' : '❌ DISAPPEARED');
console.log('  As structuredContent:', foundAsStructuredContent ? '✅ CONVERTED' : '❌ NOT FOUND');

console.log('\n📋 All documentSection nodes:', allDocumentSections);
console.log('📋 All structuredContent nodes:', allStructuredContent);
```

**Possible Outcomes:**

**Outcome A: Section Persists as documentSection**
- `foundAsDocumentSection: true` ✅
- **Conclusion:** Document Sections stay as sections (best case!)

**Outcome B: Section Converts to Content Control**
- `foundAsDocumentSection: false`
- `foundAsStructuredContent: true` ✅
- **Conclusion:** Sections export as Content Controls (still good!)

**Outcome C: Section Disappears**
- `foundAsDocumentSection: false` ❌
- `foundAsStructuredContent: false` ❌
- **Conclusion:** Sections don't persist (our original observation)

---

## Test 3: Cross-Platform Verification (Optional)

### Step 3.1: Open in Word

After completing either Test 1 or Test 2:

1. Click "Save" in web viewer
2. Download the `.docx` file
3. Open in Microsoft Word
4. Check:
   - Is the field/section visible? ✅ or ❌
   - Does it look like a form field? ✅ or ❌
   - Is it editable in Word? ✅ or ❌

### Step 3.2: Check in Word Add-in

1. Open the document in Word
2. Open the Word add-in (task pane)
3. Run in add-in console:

```javascript
const editor = window.superdocInstance.editor;

// Check what SuperDoc sees in Word add-in
let foundAsFieldAnnotation = false;
let foundAsDocumentSection = false;
let foundAsStructuredContent = false;

editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'fieldAnnotation') {
    if (node.attrs.fieldId === 'test-field-annotation') {
      foundAsFieldAnnotation = true;
      console.log('🟢 Field Annotation visible in Word add-in');
    }
  }
  
  if (node.type.name === 'documentSection') {
    if (node.attrs.id === 'test-document-section') {
      foundAsDocumentSection = true;
      console.log('🟢 Document Section visible in Word add-in');
    }
  }
  
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const tag = tagElem?.attributes['w:val'];
    
    if (tag === 'test-field-annotation' || tag === 'test-document-section') {
      foundAsStructuredContent = true;
      console.log('🔵 Found as Content Control in Word add-in:', tag);
    }
  }
});

console.log('\n📊 In Word Add-in:');
console.log('  As fieldAnnotation:', foundAsFieldAnnotation ? '✅' : '❌');
console.log('  As documentSection:', foundAsDocumentSection ? '✅' : '❌');
console.log('  As structuredContent:', foundAsStructuredContent ? '✅' : '❌');
```

---

## Test 4: Round-Trip Test (Complete Cycle)

### Scenario: Web → Word → Web

1. **Insert in Web:** Field Annotation or Section
2. **Save & Download:** Get .docx file
3. **Open in Word:** Verify it's visible
4. **Edit in Word:** Change the content
5. **Save in Word:** Save changes
6. **Reopen in Web:** Load the document
7. **Check Changes:** Are Word edits preserved?

---

## Results Summary Template

After running all tests, fill this out:

### Field Annotations
- **Insert works?** ⬜ Yes / ⬜ No
- **After save/reload:** ⬜ Persists as fieldAnnotation / ⬜ Converts to structuredContent / ⬜ Disappears
- **Visible in Word?** ⬜ Yes / ⬜ No
- **Round-trip works?** ⬜ Yes / ⬜ No / ⬜ Not tested

### Document Sections
- **Insert works?** ⬜ Yes / ⬜ No
- **After save/reload:** ⬜ Persists as documentSection / ⬜ Converts to structuredContent / ⬜ Disappears
- **Visible in Word?** ⬜ Yes / ⬜ No
- **Round-trip works?** ⬜ Yes / ⬜ No / ⬜ Not tested

---

## Decision Matrix

Based on test results:

| Field Annotations | Document Sections | Recommended Architecture |
|------------------|-------------------|--------------------------|
| ✅ Persist | ✅ Persist | Use both (ideal!) |
| ✅ Persist | ❌ Disappear | Field Annotations for all |
| ❌ Disappear | ✅ Persist | Sections for all |
| ❌ Disappear | ❌ Disappear | Content Controls for all |
| ✅ Convert to CC | ✅ Convert to CC | Use both (they still work!) |

**Key:** CC = Content Control (structuredContent)

---

## Next Steps

After completing tests:

1. **Report results** - Fill out the summary template
2. **Update architecture docs** - Based on what actually works
3. **Implement chosen approach** - Use the proven method
4. **Add tests to CI/CD** - Ensure persistence doesn't break

---

## Notes

- Run these tests on a **fresh document** or after factory reset
- Clear browser cache if results seem inconsistent
- Check SuperDoc version (`console.log(window.superdocInstance.version)`)
- Save console logs for debugging

**Expected completion time:** 15-20 minutes for all tests

