# Section Visibility Test

## Goal
Test how to hide/show Word Content Controls (sections) using SuperDoc on both platforms.

---

## Setup
1. Create a Content Control in Word with:
   - **Title (Alias):** "Test Section"
   - **Tag:** "section-test-1"
2. Ensure you have the section in your document (already done!)
3. Open browser console (web) or add-in console (Word)

---

## Test 1: Find the Section Node

### Web Viewer:
```javascript
// Run in browser console on web viewer
let sectionNode = null;
let sectionPos = null;

window.superdocInstance.editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs.sdtPr.elements;
    const tagElem = elements.find(e => e.name === 'w:tag');
    
    if (tagElem?.attributes['w:val'] === 'section-test-1') {
      sectionNode = node;
      sectionPos = pos;
      console.log('✅ Found section at position:', pos);
      console.log('Node:', node);
    }
  }
});

console.log('Section node:', sectionNode);
console.log('Section position:', sectionPos);
```

### Word Add-in:
```javascript
// Run in add-in console (exact same code!)
let sectionNode = null;
let sectionPos = null;

window.superdocInstance.editor.view.state.doc.descendants((node, pos) => {
  if (node.type.name === 'structuredContent') {
    const elements = node.attrs.sdtPr.elements;
    const tagElem = elements.find(e => e.name === 'w:tag');
    
    if (tagElem?.attributes['w:val'] === 'section-test-1') {
      sectionNode = node;
      sectionPos = pos;
      console.log('✅ Found section at position:', pos);
      console.log('Node:', node);
    }
  }
});

console.log('Section node:', sectionNode);
console.log('Section position:', sectionPos);
```

---

## Test 2: Explore Available Methods

### Check for Section Helpers:
```javascript
// Check what helpers are available
const editor = window.superdocInstance.editor;
console.log('Available commands:', Object.keys(editor.commands || {}));
console.log('Available helpers:', Object.keys(editor.helpers || {}));

// Check if there's a structuredContent helper
console.log('Structured content helper:', editor.helpers?.structuredContent);
```

### Check ProseMirror Node Type:
```javascript
// Check what methods are available on the node type
if (sectionNode) {
  console.log('Node type:', sectionNode.type.name);
  console.log('Node spec:', sectionNode.type.spec);
  console.log('Node attrs:', sectionNode.attrs);
}
```

---

## Test 3: Try Hiding Methods

### Option A: Try SuperDoc Command (if available):
```javascript
// Check for hide/show commands
const editor = window.superdocInstance.editor;

// Try to find section-related commands
const sectionCommands = Object.keys(editor.commands || {}).filter(cmd => 
  cmd.toLowerCase().includes('section') || 
  cmd.toLowerCase().includes('structured') ||
  cmd.toLowerCase().includes('control')
);

console.log('Section-related commands:', sectionCommands);

// Try each command to see what it does
sectionCommands.forEach(cmd => {
  console.log(`Command: ${cmd}`, typeof editor.commands[cmd]);
});
```

### Option B: Try ProseMirror Transaction:
```javascript
// Try to update node attributes
if (sectionNode && sectionPos !== null) {
  const editor = window.superdocInstance.editor;
  const state = editor.view.state;
  const tr = state.tr;
  
  // Try to set a "hidden" attribute
  const newAttrs = { ...sectionNode.attrs, hidden: true };
  tr.setNodeMarkup(sectionPos, null, newAttrs);
  
  console.log('Transaction created:', tr);
  
  // Don't dispatch yet - just log it
  console.log('Would dispatch:', tr.docChanged);
}
```

### Option C: Try CSS Approach (Web Only):
```javascript
// Find the DOM element for the section
if (sectionPos !== null) {
  const editor = window.superdocInstance.editor;
  const domAtPos = editor.view.domAtPos(sectionPos);
  
  console.log('DOM node:', domAtPos);
  
  if (domAtPos && domAtPos.node) {
    let element = domAtPos.node;
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentElement;
    }
    
    console.log('Element:', element);
    console.log('Current display:', window.getComputedStyle(element).display);
    
    // Try to hide it
    // element.style.display = 'none'; // Uncomment to test
  }
}
```

### Option D: Try Word JS API (Add-in Only):
```javascript
// In Word add-in, try using Word.js API
if (typeof Word !== 'undefined') {
  Word.run(async (context) => {
    const contentControls = context.document.contentControls;
    contentControls.load('items');
    
    await context.sync();
    
    // Find our section
    const section = contentControls.items.find(cc => {
      cc.load('tag,title');
      return true; // Load all for now
    });
    
    await context.sync();
    
    contentControls.items.forEach(cc => {
      if (cc.tag === 'section-test-1') {
        console.log('✅ Found Content Control:', cc.title);
        console.log('Appearance:', cc.appearance);
        
        // Try hiding methods:
        // 1. Change appearance to 'Hidden'?
        // 2. Set font.hidden = true?
        // 3. Set font.color to match background?
        // 4. Use range.font.hidden?
        
        const range = cc.getRange(Word.RangeLocation.whole);
        range.load('text,font');
        context.sync().then(() => {
          console.log('Range text:', range.text);
          console.log('Font:', range.font);
          console.log('Font hidden property:', range.font.hidden);
          
          // Try: range.font.hidden = true;
        });
      }
    });
  }).catch(err => console.error('Word error:', err));
}
```

---

## Expected Outcomes

After running these tests, we should know:
1. ✅ Can we find sections using SuperDoc? (Already YES)
2. ❓ What SuperDoc commands/helpers exist for sections?
3. ❓ Can we hide sections via ProseMirror transactions?
4. ❓ Can we hide sections via CSS (web)?
5. ❓ Can we hide sections via Word.js API (add-in)?
6. ❓ Which method works on BOTH platforms?

---

## Next Steps

Based on results, we'll either:
- **A)** Use SuperDoc commands (if available)
- **B)** Use platform-specific APIs (Word.js for add-in, CSS for web)
- **C)** Store visibility state server-side and filter on render

