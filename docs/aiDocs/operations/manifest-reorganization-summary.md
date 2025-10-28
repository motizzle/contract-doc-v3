# Manifest Files Reorganization Summary

**Date**: October 24, 2025  
**Branch**: `deployment`  
**Goal**: Clean, logical organization with `addin/` as single source of truth

---

## ✅ What Changed

### **1. New Directory Structure**

Created `addin/public/` to house all **distribution files**:

```
addin/
├── src/                            # Source code (unchanged)
├── assets/                         # Icons (unchanged)
├── dist/                           # Build output (temporary, gitignored)
├── public/                         # 📦 NEW: Distribution files (tracked by git)
│   ├── manifest.xml                # Production manifest (wordftw.onrender.com)
│   ├── install-addin.bat           # Windows installer
│   └── install-addin.command       # Mac installer
├── manifest.xml                    # Development manifest (localhost)
├── build-manifest.js               # Transform script
└── package.json
```

---

### **2. File Moves**

| **Old Location** | **New Location** | **Status** |
|------------------|------------------|------------|
| `server/public/install-addin.bat` | `addin/public/install-addin.bat` | ✅ Moved |
| `server/public/install-addin.command` | `addin/public/install-addin.command` | ✅ Moved |
| `addin/manifest.production.xml` | `addin/public/manifest.xml` | ✅ Moved |
| `server/public/manifest.production.xml` | N/A | ✅ Deleted |

---

### **3. Git Tracking Changes**

**Now Tracked** (committed to git):
- ✅ `addin/public/manifest.xml`
- ✅ `addin/public/install-addin.bat`
- ✅ `addin/public/install-addin.command`

**Now Ignored** (build artifacts only):
- ❌ `server/public/` (entire directory)
- ❌ `addin/manifest.production.xml` (temporary file)

---

### **4. Updated Configuration Files**

#### **`.gitignore`**
```diff
- server/public/manifest.xml
+ server/public/                    # Ignore entire directory (all build artifacts)
+ addin/manifest.production.xml     # Ignore temporary generated file
```

#### **`render.yaml`**
```diff
- cd ../addin && cp manifest.production.xml ../server/public/manifest.xml
+ cd ../addin && cp -r public/* ../server/public/
```
Now copies **all** distribution files (manifest + installers).

#### **`addin/webpack.config.js`**
```diff
- from: dev ? "manifest.xml" : "manifest.production.xml",
+ from: dev ? "manifest.xml" : "public/manifest.xml",
```
Copies from new `public/` location.

#### **Git Hooks** (`.git/hooks/pre-commit` & `pre-commit.bat`)
- Now generates `manifest.production.xml` temporarily
- Moves it to `addin/public/manifest.xml`
- Copies all distribution files to `server/public/`
- Stages `addin/public/manifest.xml` for commit

---

### **5. Documentation Updated**

**`addin/README-MANIFEST.md`**:
- Updated file structure diagrams
- Updated all references to `manifest.production.xml` → `public/manifest.xml`
- Added clarity about distribution files
- Updated Microsoft Partner Center submission path

---

## 🎯 Benefits

### **Before** ❌
```
❌ Confusing: Distribution files scattered between addin/ and server/public/
❌ Unclear: server/public/manifest.xml was tracked by git
❌ Messy: No clear separation between source and distribution files
```

### **After** ✅
```
✅ Clear: All add-in files in addin/, all served files in server/public/
✅ Logical: addin/public/ = distribution, server/public/ = build artifacts
✅ Organized: One source of truth for each file type
```

---

## 📋 New Workflow

### **Daily Development**

1. Edit `addin/manifest.xml` (source, localhost URLs)
2. Git commit triggers hook:
   - Generates production manifest
   - Moves to `addin/public/manifest.xml`
   - Copies installers to `server/public/`
   - Auto-stages `addin/public/manifest.xml`
3. Push to `deployment` branch

### **Deployment (Render)**

1. Webpack builds: `addin/src/*` → `addin/dist/*`
2. Copy build output: `addin/dist/*` → `server/public/`
3. Copy distribution: `addin/public/*` → `server/public/`
4. Server serves everything from `server/public/`

### **Microsoft Partner Center**

Submit: `addin/public/manifest.xml`

- ✅ Guaranteed clean (no localhost)
- ✅ Same file served to users
- ✅ Always in sync with dev manifest

---

## 🧪 Verification

### **✅ Production Manifest is Clean**
```bash
findstr /C:"localhost" addin\public\manifest.xml
# Exit code: 1 (no matches) ✅
```

### **✅ Dev Manifest Still Has Localhost**
```bash
findstr /C:"localhost" addin\manifest.xml
# Lines: 8 (as expected) ✅
```

### **✅ Server/Public is Ignored**
```bash
git check-ignore server/public/manifest.xml
# .gitignore:40:server/public/ ✅
```

### **✅ Distribution Files Tracked**
```bash
git ls-files addin/public/
# addin/public/manifest.xml
# addin/public/install-addin.bat
# addin/public/install-addin.command ✅
```

---

## 📦 Git Commit Ready

The following changes are staged and ready to commit:

```
Changes to be committed:
  modified:   .gitignore
  new file:   addin/README-MANIFEST.md
  renamed:    server/public/install-addin.bat -> addin/public/install-addin.bat
  renamed:    server/public/install-addin.command -> addin/public/install-addin.command
  renamed:    server/public/manifest.xml -> addin/public/manifest.xml
  modified:   addin/webpack.config.js
  modified:   render.yaml
  deleted:    server/public/manifest.production.xml
```

---

## 🚀 Next Steps

1. **Commit these changes**:
   ```bash
   git commit -m "refactor: reorganize manifest files - addin/public/ as distribution source"
   ```

2. **Push to deploy**:
   ```bash
   git push origin deployment
   ```

3. **Verify deployment**:
   - Check `https://wordftw.onrender.com/manifest.xml` serves correctly
   - Check installers are accessible

4. **Test git hook**:
   - Edit `addin/manifest.xml` (add a comment)
   - Commit and verify `addin/public/manifest.xml` auto-updates

---

## 📚 Related Documentation

- `addin/README-MANIFEST.md` - Complete manifest management guide
- `docs/aiDocs/features/addin-installation-hardening.md` - Installation spec
- `render.yaml` - Deployment configuration

---

**✨ All Done! The manifest structure is now clean, logical, and easy to maintain.**

