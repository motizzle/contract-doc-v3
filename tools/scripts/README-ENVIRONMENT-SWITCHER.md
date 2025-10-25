# Environment Switcher Scripts

Quick scripts to switch between local development and deployed production environments.

## 🚀 Quick Start

### **Local Development**

```bash
# Just double-click:
tools\scripts\run-local.bat
```

**What it does:**
1. ✅ Closes Word (for clean sideload)
2. ✅ Removes deployed add-in (if installed)
3. ✅ Stops any existing local sideloads
4. ✅ Sets up environment variables
5. ✅ Starts server in background (https://localhost:4001)
6. ✅ Opens browser and auto-clears session (for sync)
7. ✅ Sideloads local add-in (localhost:4000)
8. ✅ Launches Word → Add-in ready!

**Uses:**
- `addin/manifest.xml` (localhost URLs)
- Local server on `https://localhost:4001`
- Local add-in dev server on `https://localhost:4000`

---

### **Deployed Production**

```bash
# Just double-click:
tools\scripts\run-deployed.bat
```

**What it does:**
1. ✅ Closes Word
2. ✅ Stops local add-in sideload
3. ✅ Clears Word cache
4. ✅ Stops local servers
5. ✅ Shows instructions to install deployed version

**Uses:**
- `addin/public/manifest.xml` (wordftw.onrender.com URLs)
- Deployed server on `https://wordftw.onrender.com`
- Production add-in served from Render

---

## 📋 Workflows

### **Typical Development Day**

```bash
Morning:
  run-local.bat              # Start local dev
  
  [... code, test, repeat ...]
  
  git commit -m "feature X"
  git push origin deployment
  
Afternoon (test deployment):
  run-deployed.bat           # Switch to production
  [... test on wordftw.onrender.com ...]
  
Evening (back to dev):
  run-local.bat              # Back to local
```

---

## 🛑 Stopping

### **Stop Local Development**

```bash
# Option 1: Switch to deployed (stops everything)
run-deployed.bat

# Option 2: Manual stop
npx office-addin-debugging stop addin/manifest.xml
# Then close the server window
```

### **Stop Deployed**

Just run `run-local.bat` to switch back, or use the uninstaller:

```bash
tools\scripts\uninstall-addin.bat
```

---

## 🔍 What's Happening Behind the Scenes

### **run-local.bat**

```
Check Registry → Remove Deployed Add-in
     ↓
Stop Old Sideloads → Clean Slate
     ↓
Set ENV Vars → LLM Config
     ↓
Start Server → Background (minimized)
     ↓
Sideload Local Manifest → Word Registers It
     ↓
✅ Ready to Develop!
```

### **run-deployed.bat**

```
Close Word → Stop Any Add-in
     ↓
Stop Sideload → Unregister Local
     ↓
Clear Cache → Fresh Start
     ↓
Stop Servers → Clean Environment
     ↓
Show Instructions → Install from Web
     ↓
✅ Ready for Production Testing!
```

---

## 🧪 Testing After Changes

### **Test Local Changes**

1. Make code changes
2. Server auto-reloads (if using nodemon)
3. Add-in: Refresh taskpane or restart Word
4. Verify changes work

### **Test Before Deploying**

1. `run-deployed.bat` → Switch to production
2. Go to `https://wordftw.onrender.com`
3. Install and test deployed version
4. Verify no regressions
5. `run-local.bat` → Back to development

---

## 🐛 Troubleshooting

### **"Add-in not showing up"**

```bash
# Full reset:
1. run-deployed.bat       # Clean everything
2. Close Word completely
3. run-local.bat          # Fresh start
```

### **"Server already running on port 4001"**

```bash
# Kill the process:
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 4001).OwningProcess -Force"

# Then try again:
run-local.bat
```

### **"Sideload failed"**

Install the debugging tools:
```bash
npm install -g office-addin-debugging
```

Then run `run-local.bat` again.

---

## 📂 Related Scripts

| Script | Purpose |
|--------|---------|
| `run-local.bat` | **Switch to local dev** (this file) |
| `run-deployed.bat` | **Switch to deployed prod** (this file) |
| `start-servers.bat` | Start servers only (no add-in) |
| `uninstall-addin.bat` | Remove deployed add-in |
| `refresh-addin-deployed.bat` | Update deployed add-in |

---

## 💡 Tips

- **Use `run-local.bat` daily** - It handles everything automatically
- **Use `run-deployed.bat` before pushing** - Test production build
- **Keep Word closed** when switching - Scripts close it, but manual close is safer
- **Check console output** - Scripts show what they're doing at each step

---

**Made with ❤️ for easy environment switching!**

