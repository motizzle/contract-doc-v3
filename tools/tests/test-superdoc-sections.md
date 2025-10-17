# Test: SuperDoc Sections vs Content Controls

## Goal
Determine if SuperDoc's `createDocumentSection()` creates the same `structuredContent` nodes as Word Content Controls.

---

## Test 1: Create a SuperDoc Section

### Run in Web Viewer Console:
```javascript
// Check if section commands exist
const editor = window.superdocInstance.editor;
console.log('Section commands available:', {
  createDocumentSection: typeof editor.commands.createDocumentSection,
  removeSectionById: typeof editor.commands.removeSectionById,
  updateSectionById: typeof editor.commands.updateSectionById
});

// If available, create a test section
if (editor.commands.createDocumentSection) {
  editor.commands.createDocumentSection({
    id: 'test-superdoc-section',
    title: 'Test SuperDoc Section',
    description: 'Testing if this creates structuredContent',
    html: '<p>This is a section created by SuperDoc\'s native API.</p>'
  });
  
  console.log('✅ Section created!');
} else {
  console.error('❌ createDocumentSection not available');
}
```

---

## Test 2: Detect What Was Created

### Run Immediately After:
```javascript
const editor = window.superdocInstance.editor;
let foundSuperdocSection = false;
let foundAsStructuredContent = false;

// Scan document for the section we just created
editor.view.state.doc.descendants((node, pos) => {
  // Check if it's a structuredContent node (Content Control)
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const aliasElem = elements.find(e => e.name === 'w:alias');
    
    const tag = tagElem?.attributes['w:val'];
    const alias = aliasElem?.attributes['w:val'];
    
    if (tag === 'test-superdoc-section' || alias === 'Test SuperDoc Section') {
      foundAsStructuredContent = true;
      console.log('✅ Found SuperDoc section as structuredContent!');
      console.log('   Tag:', tag);
      console.log('   Alias:', alias);
      console.log('   Full attrs:', node.attrs);
    }
  }
  
  // Check if it's a different node type (documentSection?)
  if (node.type.name === 'documentSection' || 
      node.type.name === 'section' ||
      node.attrs?.id === 'test-superdoc-section') {
    foundSuperdocSection = true;
    console.log('📦 Found as node type:', node.type.name);
    console.log('   Node attrs:', node.attrs);
  }
});

console.log('\n📊 Results:');
console.log('   Found as structuredContent:', foundAsStructuredContent);
console.log('   Found as documentSection:', foundSuperdocSection);

if (!foundAsStructuredContent && !foundSuperdocSection) {
  console.warn('⚠️ Section not found - check if command succeeded');
}
```

---

## Test 3: Compare with Manual Content Control

### Create a Content Control in Word:
1. Open the document in Word
2. Insert → Content Control → Rich Text
3. Set properties:
   - **Title:** "Test Word Section"
   - **Tag:** "test-word-section"
4. Add some text inside it
5. Save and reload web viewer

### Run in Web Viewer:
```javascript
const editor = window.superdocInstance.editor;

editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    const tag = tagElem?.attributes['w:val'];
    
    if (tag === 'test-word-section') {
      console.log('📝 Word Content Control structure:');
      console.log(JSON.stringify(node.attrs, null, 2));
    }
    
    if (tag === 'test-superdoc-section') {
      console.log('🔵 SuperDoc Section structure:');
      console.log(JSON.stringify(node.attrs, null, 2));
    }
  }
});
```

**Compare the two outputs - are they identical?**

---

## Test 4: Save & Reload Test

### If SuperDoc section was created:
1. Click "Save" in web viewer
2. Hard refresh the page (Ctrl+Shift+R)
3. Run detection again:

```javascript
const editor = window.superdocInstance.editor;
let foundAfterReload = false;

editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    
    if (tagElem?.attributes['w:val'] === 'test-superdoc-section') {
      foundAfterReload = true;
      console.log('✅ SuperDoc section PERSISTED after save/reload');
    }
  }
});

if (!foundAfterReload) {
  console.warn('⚠️ SuperDoc section DISAPPEARED after save/reload');
}
```

---

## Test 5: Cross-Platform Test

### Open in Word Add-in:
1. Reload Word add-in
2. Run in add-in console:

```javascript
// Check if SuperDoc section appears in Word
window.superdocInstance.editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs?.sdtPr?.elements || [];
    const tagElem = elements.find(e => e.name === 'w:tag');
    
    if (tagElem?.attributes['w:val'] === 'test-superdoc-section') {
      console.log('✅ SuperDoc section visible in Word add-in');
    }
  }
});
```

### Also check Word's native Content Controls:
```javascript
if (typeof Word !== 'undefined') {
  Word.run(async (context) => {
    const controls = context.document.contentControls;
    controls.load('items');
    await context.sync();
    
    const superdocSection = controls.items.find(cc => {
      cc.load('tag,title');
      return true;
    });
    
    await context.sync();
    
    const found = controls.items.find(cc => cc.tag === 'test-superdoc-section');
    
    if (found) {
      console.log('✅ SuperDoc section exists as Word Content Control');
      console.log('   Title:', found.title);
      console.log('   Tag:', found.tag);
    } else {
      console.warn('⚠️ SuperDoc section NOT in Word Content Controls');
    }
  });
}
```

---

## Expected Outcomes

### ✅ **Best Case (SuperDoc Sections = Content Controls):**
- SuperDoc section creates `structuredContent` node
- Persists after save/reload
- Visible in Word as Content Control
- Can use SuperDoc's native section API
- **Result: Use SuperDoc sections for better semantics**

### ⚠️ **Partial Case (SuperDoc Sections = Different Format):**
- SuperDoc section creates different node type
- Doesn't appear as Content Control in Word
- Might not persist or sync correctly
- **Result: Stick with Content Controls for compatibility**

### ❌ **Worst Case (Command Not Available):**
- `createDocumentSection` doesn't exist in our version
- **Result: Definitely stick with Content Controls**

---

## Decision Matrix

| Test Result | Recommendation |
|-------------|----------------|
| ✅ Creates structuredContent | Use SuperDoc sections |
| ✅ Persists after save | Use SuperDoc sections |
| ✅ Shows in Word | Use SuperDoc sections |
| ❌ Any of the above fail | Use Content Controls |

---

## Next Steps

After running these tests, we'll know:
1. Whether to use `createDocumentSection()` or stick with Content Controls
2. If we can leverage SuperDoc's native section features
3. Whether to extend variables or build separate sections system

