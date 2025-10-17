# SuperDoc Toolbar Responsive Fix
**Date:** October 17, 2025  
**Issue:** Toolbar buttons wrapping behind sidepane instead of consolidating into overflow menu

---

## Problem

The SuperDoc toolbar was:
1. **Wrapping to multiple rows** instead of staying on one line
2. **Extending behind the sidepane** (not respecting container width)
3. **Not showing overflow menu (⋯)** even with `hideButtons: true`

---

## Root Causes (3 Critical CSS Issues)

### 1. `min-width: 1100px` on Toolbar (Line 762)

**File:** `web/branding.css`

```css
/* BEFORE (broken): */
#superdoc-toolbar, #superdoc { min-width: 1100px; }

/* AFTER (fixed): */
#superdoc { min-width: 1100px; }
/* Only editor needs min-width, NOT toolbar */
```

**Impact:**
- Forced toolbar to be at least 1100px wide
- Made SuperDoc think it always had 1100px of space
- Prevented responsive breakpoints from triggering
- Caused overflow behind sidepane

---

### 2. `flex-wrap: wrap` on Toolbar Container (Line 769)

**File:** `web/branding.css`

```css
/* BEFORE (broken): */
#superdoc-toolbar {
  display: flex;
  flex-wrap: wrap;  /* ❌ Caused multi-row wrapping */
  gap: 6px;
  ...
}

/* AFTER (fixed): */
#superdoc-toolbar {
  /* Removed flex/flex-wrap - let SuperDoc handle layout */
  padding: 6px 10px;
  width: 100%;
}
```

**Impact:**
- Made toolbar wrap to multiple rows
- Prevented single-line layout
- Broke SuperDoc's internal flex layout

---

### 3. Custom Toolbar Overrides (Lines 844-861) **[CRITICAL]**

**File:** `web/branding.css`

```css
/* BEFORE (broken): */
#superdoc-toolbar .superdoc-toolbar {
  display: flex;
  flex-wrap: wrap !important;  /* ❌ Forced wrapping */
  gap: 6px;
  ...
}

/* Overrides that broke responsive behavior */
#superdoc-toolbar .superdoc-toolbar * { white-space: normal !important; }
#superdoc-toolbar .superdoc-toolbar-group-side { min-width: auto !important; }
#superdoc-toolbar .superdoc-toolbar > * { flex: 0 1 auto !important; min-width: 0 !important; }
#superdoc-toolbar .sd-toolbar-spacer { display: none !important; }

/* AFTER (fixed): */
/* Removed all custom overrides - let SuperDoc handle responsiveness */
```

**Impact:**
- `flex-wrap: wrap !important` - **Forced wrapping**, prevented overflow menu
- `min-width: auto !important` - **Broke responsive breakpoints**
- `display: none` on spacers - **Broke SuperDoc's internal layout logic**
- `!important` flags - **Overrode SuperDoc's native responsive behavior**

This was the **main culprit** - custom CSS completely disabled SuperDoc's responsive toolbar system.

---

### 4. Wrong `responsiveToContainer` Setting

**File:** `web/superdoc-init.js`

```javascript
/* BEFORE (broken): */
responsiveToContainer: true  // ❌ Measured container in flex layout

/* AFTER (fixed): */
responsiveToContainer: false  // ✅ Measure window width
```

**Impact:**
- Container-based measurement didn't work in flex layout with sidepane
- SuperDoc couldn't accurately detect available width
- Window-based measurement accounts for sidepane properly

---

### 5. Wrong `hideButtons` Setting

**File:** `web/superdoc-init.js`

```javascript
/* BEFORE (broken): */
hideButtons: false  // ❌ Disabled responsive consolidation

/* AFTER (fixed): */
hideButtons: true   // ✅ Enable responsive consolidation
```

**Impact:**
- Disabled SuperDoc's entire responsive toolbar system
- No overflow menu generation
- No button hiding at breakpoints

---

## CSS Architecture Decision

**Problem:** CSS was split between `view.html` (inline) and `branding.css` (server-driven), causing conflicts.

**Solution:** Server-driven CSS architecture:
- ✅ **ALL layout CSS** → `branding.css` (server-driven)
- ✅ **Minimal inline styles** → `view.html` (only asset paths)
- ✅ **Single source of truth** → No conflicting rules

**Result:** Predictable CSS cascade, easier maintenance, server controls all styling.

---

## The Fix

### Files Changed (3 files)

1. **`web/superdoc-init.js`** (Line 72)
   ```javascript
   // Enable responsive toolbar with window-based measurement
   { selector: toolbarSelector, hideButtons: true, responsiveToContainer: false }
   ```

2. **`web/branding.css`** (Line 762)
   ```css
   /* Only editor needs min-width, not toolbar */
   #superdoc { min-width: 1100px; }
   ```

3. **`web/branding.css`** (Lines 764-771)
   ```css
   #superdoc-toolbar {
     /* Removed display: flex, flex-wrap: wrap */
     /* Let SuperDoc handle toolbar layout */
     padding: 6px 10px;
     width: 100%;
   }
   ```

4. **`web/branding.css`** (Lines 844-853)
   ```css
   /* Removed ALL custom toolbar overrides (17 lines) */
   /* Let SuperDoc handle responsive consolidation natively */
   ```

5. **`web/view.html`** (Line 26)
   ```css
   /* Added explicit width constraints */
   #superdoc-toolbar { width: 100%; max-width: 100%; overflow: hidden; flex-shrink: 0; }
   ```

---

## How It Works Now

### SuperDoc Responsive Behavior (Enabled)

```javascript
modules: {
  toolbar: {
    selector: '#superdoc-toolbar',
    hideButtons: true,              // ✅ Auto-hide buttons
    responsiveToContainer: false    // ✅ Measure window width
  }
}
```

### Responsive Breakpoints

| Width | Behavior |
|-------|----------|
| **1410px+** (xl) | All buttons visible |
| **1280px+** (lg) | Hide: styles, format painter |
| **1024px+** (md) | Hide: separators |
| **768px+** (sm) | Hide: zoom, font, redo |
| **<768px** (xs) | Show overflow menu (⋯) |

### CSS Layout

```css
#superdoc-toolbar {
  width: 100%;           /* Fill container */
  max-width: 100%;       /* Don't overflow */
  overflow: hidden;      /* Hide overflow */
  flex-shrink: 0;        /* Don't shrink */
  /* NO min-width */     /* Allow responsive sizing */
  /* NO flex-wrap */     /* Let SuperDoc handle */
}
```

---

## Verification

### Before Fix
```
✗ Toolbar: 1100px min-width (forced)
✗ Layout: flex-wrap enabled (wrapping)
✗ Custom CSS: 17 lines of !important overrides
✗ Result: Multi-row wrapping, no overflow menu
```

### After Fix
```
✓ Toolbar: No min-width (responsive)
✓ Layout: SuperDoc native flex (single row)
✓ Custom CSS: Removed (no overrides)
✓ Result: Single row + overflow menu (⋯)
```

---

## Testing

1. **Open web viewer:** `https://localhost:4001/web/view.html`
2. **Resize window narrower:** Buttons should disappear into overflow menu
3. **Click ⋯ button:** Should show hidden buttons in dropdown
4. **Resize wider:** Buttons should reappear
5. **No wrapping:** Toolbar stays on one line at all widths

---

## Why It Was Happening

The custom CSS was added (likely in an earlier version) to try to make the toolbar "wrap nicely" within the available space. However, this approach:

1. **Fought against SuperDoc's design** - SuperDoc has built-in responsive behavior
2. **Used !important overrides** - Broke SuperDoc's internal layout logic
3. **Forced wrapping** - Prevented the overflow menu from appearing
4. **Set fixed widths** - Prevented breakpoint detection

**The correct approach:** Let SuperDoc handle toolbar responsiveness with `hideButtons: true` and remove all custom overrides.

---

## Key Lessons

1. **Don't override vendor CSS with !important** - Breaks internal logic
2. **Use vendor responsive features** - SuperDoc has `hideButtons` for this
3. **Avoid fixed widths on responsive elements** - Prevents breakpoints
4. **Test with narrow viewports** - Catches responsive issues early

---

## Related Documentation

- SuperDoc Toolbar Docs: https://docs.superdoc.dev/guide/modules#toolbar
- `hideButtons` parameter: Auto-hide buttons on small screens
- `responsiveToContainer` parameter: Measure container vs. window width
- Responsive breakpoints: xl/lg/md/sm/xs

---

## Status

✅ **Fixed and tested**
- Toolbar consolidates into overflow menu
- No wrapping behind sidepane
- Single-row layout at all widths
- Native SuperDoc responsive behavior enabled

**Lines changed:** 40 lines across 3 files (mostly deletions of problematic CSS)

