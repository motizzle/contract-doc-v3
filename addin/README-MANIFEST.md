# Word Add-in Manifest Management

This document explains how the Word add-in manifest files are organized and automatically synced.

## File Structure

```
addin/
├── src/                            # Source code (edit these)
├── assets/                         # Icons (source files)
├── dist/                           # Build output (gitignored, temporary)
├── public/                         # 📦 DISTRIBUTION FILES (committed to git)
│   ├── manifest.xml                # Production manifest (wordftw.onrender.com)
│   ├── install-addin.bat           # Windows installer
│   └── install-addin.command       # Mac installer
├── manifest.xml                    # Development manifest (localhost URLs)
├── build-manifest.js               # Script to generate production from dev
└── package.json                    # Contains "build:manifest" script

server/public/
└── [all build artifacts]           # Everything copied during build (gitignored)
    ├── manifest.xml                # From addin/public/manifest.xml
    ├── install-addin.bat           # From addin/public/install-addin.bat
    ├── install-addin.command       # From addin/public/install-addin.command
    └── [webpack outputs]           # From addin/dist/*
```

## Key Principles

1. **Single Source of Truth**: `addin/manifest.xml` is the only file you edit manually
2. **Auto-Generated Distribution**: `addin/public/manifest.xml` is generated via git hook
3. **Clean Organization**: All add-in distribution files live in `addin/public/`
4. **Build Artifacts**: `server/public/` contains only build artifacts (ignored by git)

## Workflow

### Local Development

1. Edit `addin/manifest.xml` with localhost URLs
2. Use for local testing: `npm start` (in addin directory)

### Committing Changes

When you commit changes to `addin/manifest.xml`, a git hook automatically:

1. ✅ Detects the change
2. ✅ Runs `npm run build:manifest` to transform localhost → production URLs
3. ✅ Generates temporary `manifest.production.xml`
4. ✅ Moves it to `addin/public/manifest.xml`
5. ✅ Copies all distribution files to `server/public/` for serving
6. ✅ Stages `addin/public/manifest.xml` for commit

**You don't need to do anything manually!**

### Deployment (Render)

The `render.yaml` build process:

1. Builds the add-in: `npx webpack --mode production`
2. Copies webpack output: `addin/dist/*` → `server/public/`
3. Copies distribution files: `addin/public/*` → `server/public/`
   - `manifest.xml` (production URLs)
   - `install-addin.bat` (Windows installer)
   - `install-addin.command` (Mac installer)

Users download from:
- `https://wordftw.onrender.com/manifest.xml`
- `https://wordftw.onrender.com/install-addin.bat`
- `https://wordftw.onrender.com/install-addin.command`

## Manual Commands (If Needed)

### Generate Production Manifest

```bash
cd addin
BASE_URL=wordftw.onrender.com npm run build:manifest
mv manifest.production.xml public/manifest.xml
```

This creates `addin/public/manifest.xml` from `addin/manifest.xml`.

### Validate No Localhost URLs

```bash
# Windows
findstr /C:"localhost" addin\public\manifest.xml

# Unix/Mac
grep "localhost" addin/public/manifest.xml
```

Should return no results if clean.

## Files Tracked by Git

- ✅ `addin/manifest.xml` (development source)
- ✅ `addin/public/manifest.xml` (production distribution)
- ✅ `addin/public/install-addin.bat` (Windows installer)
- ✅ `addin/public/install-addin.command` (Mac installer)
- ❌ `addin/dist/` (webpack build output, temporary)
- ❌ `server/public/` (all build artifacts, auto-generated)

## Changing Production URL

If you deploy to a new domain:

1. Edit `.git/hooks/pre-commit` and `.git/hooks/pre-commit.bat`
2. Change `BASE_URL="wordftw.onrender.com"` to your new URL
3. Run `npm run build:manifest` to regenerate
4. Commit the changes

## Microsoft Partner Center Submission

Submit the file at: `addin/public/manifest.xml`

This file is guaranteed to:
- ✅ Have no localhost URLs
- ✅ Have correct production URLs (wordftw.onrender.com)
- ✅ Be in sync with your development manifest structure
- ✅ Be the same file served to users

## Troubleshooting

### Git hook not running?

**Windows:**
```powershell
icacls .git\hooks\pre-commit /grant Everyone:RX
```

**Unix/Mac:**
```bash
chmod +x .git/hooks/pre-commit
```

### Production manifest has localhost URLs?

Run the git hook manually:
```bash
.git/hooks/pre-commit
```

Check the output for errors.

### Want to disable auto-sync?

Remove or disable the git hooks:
```bash
# Windows
del .git\hooks\pre-commit
del .git\hooks\pre-commit.bat

# Unix/Mac
rm .git/hooks/pre-commit
```

Then manually run `npm run build:manifest` before committing.

