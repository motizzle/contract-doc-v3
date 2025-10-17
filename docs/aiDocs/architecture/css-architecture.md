# CSS Architecture
**Status:** ✅ Implemented  
**Last Updated:** October 17, 2025

---

## Principle: Server-Driven Styling

**All CSS should be server-driven** through `web/branding.css`, with **minimal platform-specific overrides** in HTML files.

---

## Architecture Rules

### ✅ Server-Driven CSS (`web/branding.css`)

**OWNS:**
- All layout rules
- All component styling
- All responsive behavior
- All colors, spacing, typography
- All animations and transitions
- All utility classes

**Why server-driven:**
- Single source of truth
- Easy to update without deployment
- Consistent across platforms
- Cacheable and performant
- Version controlled with server

### ✅ Platform-Specific CSS (Inline in HTML)

**MINIMAL USE - Only for:**
- Asset paths relative to HTML file (e.g., background-image URLs)
- Platform detection classes (e.g., `.platform-web`, `.platform-word`)
- Critical above-the-fold styles (performance optimization)

**Example (acceptable):**
```html
<!-- view.html -->
<style>
  /* Asset path can't be in branding.css - relative to HTML */
  #og-navbar .nav-image { background-image: url('/web/assets/procurement-navbar.png'); }
</style>
```

**Example (NOT acceptable):**
```html
<!-- DON'T DO THIS -->
<style>
  #layout { display: flex; }  /* ❌ Layout should be in branding.css */
  #pane { width: 530px; }     /* ❌ Sizing should be in branding.css */
</style>
```

---

## File Organization

### `web/branding.css` Structure

```css
/* 1. CSS Variables (Design Tokens) */
:root {
  --color-primary: #2563eb;
  --space-4: 16px;
  --btn-height: 32px;
  ...
}

/* 2. Global Reset & Base */
body { margin: 0; font-family: var(--font-family-system); }
*, *::before, *::after { box-sizing: border-box; }

/* 3. Platform-Specific Layout (Web) */
#og-navbar { ... }
#layout { ... }
#editor-col { ... }
#superdoc-toolbar { ... }

/* 4. Component Styles */
.btn { ... }
.modal { ... }
.dropdown { ... }

/* 5. Utility Classes */
.d-flex { display: flex; }
.text-center { text-align: center; }

/* 6. SuperDoc Overrides (if needed) */
#superdoc-toolbar .superdoc-toolbar select { ... }
```

---

## Web Platform Layout

**File:** `web/branding.css` (lines 755-874)

### Layout Structure

```
┌─────────────────────────────────────────┐
│ #og-navbar (fixed, top)                 │ ← 48px height
├─────────────────────────────────────────┤
│ #layout (grid: 1fr auto)                │
│ ┌──────────────────┬──────────────────┐ │
│ │ #editor-col      │ #pane (530px)    │ │
│ │ ┌──────────────┐ │ ┌──────────────┐ │ │
│ │ │#superdoc-    │ │ │ #app-root    │ │ │
│ │ │  toolbar     │ │ │              │ │ │
│ │ ├──────────────┤ │ ├──────────────┤ │ │
│ │ │              │ │ │              │ │ │
│ │ │  #superdoc   │ │ │  #comments-  │ │ │
│ │ │  (editor)    │ │ │  container   │ │ │
│ │ │              │ │ │              │ │ │
│ │ └──────────────┘ │ └──────────────┘ │ │
│ └──────────────────┴──────────────────┘ │
└─────────────────────────────────────────┘
```

### Key CSS Rules

```css
/* Grid layout: editor takes remaining space, sidepane is fixed */
#layout {
  display: grid;
  grid-template-columns: 1fr auto;  /* ← Editor responsive, pane fixed */
  overflow-x: hidden;
  height: calc(100vh - 48px);
  margin-top: 48px;
}

/* Editor column: flexible width, accounts for sidepane */
#editor-col {
  display: flex;
  flex-direction: column;
  min-width: 0;  /* ← Allow shrinking */
  padding: 0 16px;
}

/* Sidepane: fixed 530px, never shrinks */
#pane {
  width: 530px;
  max-width: 530px;
  flex-shrink: 0;  /* ← Never shrink */
}
```

---

## Responsive Toolbar Integration

**How SuperDoc measures toolbar width:**

```javascript
// superdoc-init.js
modules: {
  toolbar: {
    selector: '#superdoc-toolbar',
    hideButtons: true,              // Enable responsive consolidation
    responsiveToContainer: true     // Measure toolbar container (not window)
  }
}
```

**CSS provides the constraints:**
```css
/* Toolbar inherits width from #editor-col (grid-constrained) */
#superdoc-toolbar {
  width: 100%;           /* Fill editor column */
  flex-shrink: 0;        /* Don't shrink */
  box-sizing: border-box;
}

/* Editor column width = window width - sidepane - padding */
/* SuperDoc measures this and hides buttons that don't fit */
```

---

## Anti-Patterns to Avoid

### ❌ Don't: Duplicate CSS in HTML

```html
<!-- BAD: CSS in both places -->
<style>
  #layout { display: flex; }        /* ← Conflicts with branding.css */
  #pane { width: 530px; }           /* ← Duplicates branding.css */
</style>
```

### ❌ Don't: Override with !important

```css
/* BAD: Fighting the library */
#superdoc-toolbar .superdoc-toolbar {
  flex-wrap: wrap !important;  /* ← Breaks SuperDoc's responsive behavior */
}
```

### ❌ Don't: Hard-code widths that should be responsive

```css
/* BAD: Prevents responsive sizing */
#superdoc-toolbar { min-width: 1100px; }  /* ← Causes overflow */
```

### ❌ Don't: Mix flex and grid without understanding cascade

```css
/* BAD: Conflicting layout modes */
#layout { display: grid; }      /* in branding.css */
#layout { display: flex; }      /* in view.html - overrides grid! */
```

---

## Best Practices

### ✅ Do: Use CSS Variables

```css
/* branding.css */
:root {
  --pane-width: 530px;
  --navbar-height: 48px;
  --toolbar-padding: 6px 10px;
}

#pane { width: var(--pane-width); }
#layout { height: calc(100vh - var(--navbar-height)); }
```

### ✅ Do: Comment layout decisions

```css
/* Grid layout: editor takes remaining space after 530px sidepane */
#layout {
  display: grid;
  grid-template-columns: 1fr auto;  /* ← Explain why */
}
```

### ✅ Do: Group related rules

```css
/* ------------------------------------------------
   WEB PLATFORM LAYOUT
   All layout rules for web viewer
------------------------------------------------ */
#og-navbar { ... }
#layout { ... }
#editor-col { ... }
```

### ✅ Do: Let libraries handle their own layout

```css
/* Let SuperDoc handle toolbar responsiveness */
#superdoc-toolbar {
  /* Don't set: display, flex-wrap, min-width */
  /* DO set: width, padding, borders, z-index */
}
```

---

## Word Add-in Considerations

**Word add-in has different layout constraints:**
- No navbar (Office provides UI)
- Different viewport size (taskpane)
- Different responsive breakpoints

**Solution:** Platform detection in CSS

```css
/* Web-specific */
.platform-web #og-navbar { display: block; }

/* Word-specific */
.platform-word #og-navbar { display: none; }
.platform-word #layout { margin-top: 0; }  /* No navbar offset */
```

**Implementation:** Add platform class to `<body>` in HTML:
```html
<body class="platform-web">
```

---

## Testing

### Visual Regression Testing

1. **Resize window** from 1920px → 768px
   - Toolbar should hide buttons into overflow menu
   - No wrapping
   - No cutoff buttons

2. **Compare platforms**
   - Web: navbar visible, 530px sidepane
   - Word: no navbar, narrower viewport

3. **Check cascade**
   - Inspect computed styles in DevTools
   - Verify no conflicts
   - Check which file "wins" for each property

### Automated Tests

```javascript
// Future: Visual regression tests
test('toolbar consolidates at 768px', async () => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const overflowButton = await page.$('.superdoc-toolbar-overflow');
  expect(overflowButton).toBeVisible();
});
```

---

## Migration Checklist

When moving CSS from HTML to branding.css:

- [ ] Copy CSS from `<style>` block in HTML
- [ ] Paste into appropriate section in `branding.css`
- [ ] Add comments explaining layout decisions
- [ ] Remove from HTML `<style>` block
- [ ] Test in browser (both web and Word if applicable)
- [ ] Verify no conflicts with DevTools computed styles
- [ ] Check responsive behavior at different widths

---

## Related Documentation

- `docs/audits/TOOLBAR-RESPONSIVE-FIX.md` - Toolbar responsive fix history
- `web/branding.css` - Server-driven CSS (lines 755-874 for web layout)
- `web/view.html` - Minimal inline styles (line 17 for asset path)
- `web/superdoc-init.js` - SuperDoc toolbar configuration (line 72)

---

## Summary

**Architecture:**
- 🎯 Server-driven CSS (`branding.css`) is authoritative
- 🎯 Minimal inline styles (only asset paths)
- 🎯 Single source of truth for all layout
- 🎯 Let libraries handle their own responsiveness

**Result:**
- ✅ No CSS conflicts
- ✅ Easier maintenance
- ✅ Predictable cascade
- ✅ Server controls all styling
- ✅ Responsive toolbar works correctly

