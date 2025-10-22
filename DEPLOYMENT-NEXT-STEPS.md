# 🚀 Ready to Deploy to Render.com

All code is ready! Here's what happens next.

---

## ✅ What's Been Set Up

1. **Manifest Build Script**: Auto-generates production manifest from your dev manifest
2. **Render Configuration**: `render.yaml` ready for deployment
3. **Documentation**: Complete guides in `docs/deployment/`
4. **One Source of Truth**: You only edit `addin/manifest.xml` (localhost), never need to touch production version

---

## 📋 Next Steps (Do This When Ready to Deploy)

### Step 1: Create Render Account (5 minutes)

1. Go to https://render.com
2. Click **"Get Started for Free"**
3. Sign up with **GitHub** (easiest)
4. Authorize Render to access your GitHub repositories

---

### Step 2: Push This Code to GitHub (If Not Already)

```bash
# Push deployment branch to GitHub
# (Render will deploy FROM this branch - no need to merge to main yet)
git push origin deployment
```

**Note**: Don't merge to `main` until deployment succeeds! Test first, then merge.

---

### Step 3: Deploy to Render (10 minutes)

#### In Render Dashboard:

1. **Click "New +"** (top right)
2. **Select "Blueprint"** (this uses your `render.yaml` automatically)
3. **Connect Repository**:
   - Select: `wordFTW` repository
   - Branch: **`deployment`** (deploy from here first, don't use main yet!)
4. **Review & Apply**:
   - Render reads your `render.yaml`
   - Shows: Web service with 1GB disk
   - Click **"Apply"**
5. **Wait for deploy** (3-5 minutes)
   - Watch logs in real-time
   - Look for: "Server running on port 10000"
6. **Get your URL**: 
   - Example: `https://wordftw-x7y8z9.onrender.com`
   - Copy this URL!

---

### Step 4: Generate Production Manifest (2 minutes)

Now that you have your Render URL, generate the manifest:

```bash
# Replace with YOUR actual Render URL
cd addin
BASE_URL=https://wordftw-x7y8z9.onrender.com npm run build:manifest
```

**What this does:**
- Reads `addin/manifest.xml` (localhost version)
- Replaces all `https://localhost:3000` with your Render URL
- Writes `addin/manifest.production.xml` (auto-generated, not in git)

**Verify it worked:**
```bash
cat addin/manifest.production.xml | grep "onrender.com"
# Should show multiple lines with your Render URL
```

---

### Step 5: Host the Manifest (1 minute)

Copy the generated manifest to your server's public folder:

```bash
# From project root
cp addin/manifest.production.xml server/public/manifest.xml

# Commit and push
git add server/public/manifest.xml
git commit -m "Add production manifest for Render deployment"
git push origin deployment
```

Render will **auto-deploy** this change (takes ~1 minute).

---

### Step 6: Test Everything (5 minutes)

#### Test the Web App:
```bash
# Open in browser
https://YOUR-APP.onrender.com/view.html
```

**Should see**: The contract management interface

#### Test the API:
```bash
curl https://YOUR-APP.onrender.com/api/v1/health
```

**Should return**: JSON with `"status": "ok"`

#### Test Manifest Download:
```bash
# Open in browser
https://YOUR-APP.onrender.com/manifest.xml
```

**Should see**: XML file that downloads

---

### Step 7: Install Add-in (User Side) (5 minutes)

**Now you can test the actual Word add-in:**

1. **Download manifest**:
   - Go to: `https://YOUR-APP.onrender.com/manifest.xml`
   - Save to: `Downloads/og-clm.xml`

2. **Sideload in Word** (Windows):
   - Open Word
   - File → Options → Trust Center → Trust Center Settings
   - Trusted Add-in Catalogs → Add folder where you saved the manifest
   - Click "Show in catalog"
   - Restart Word

3. **Open the add-in**:
   - Word → Insert → My Add-ins
   - Click "OG CLM"
   - Task pane opens on the right!

4. **Test features**:
   - Load a scenario
   - Check messaging
   - Try variables
   - Everything should work!

---

### Step 8: Merge to Main (After Success!) ✅

**Only do this AFTER everything works:**

```bash
git checkout main
git merge deployment
git push origin main
```

Now your production code is in `main` and you can continue developing on feature branches.

---

## 🎯 Summary

**Before deployment:**
```
┌─────────────────────┐
│   Local Dev         │
│   localhost:3000    │  ← You work here
│   manifest.xml      │
└─────────────────────┘
```

**After deployment:**
```
┌─────────────────────┐         ┌──────────────────────┐
│   Local Dev         │         │   Production         │
│   localhost:3000    │         │   Render.com         │
│   manifest.xml      │         │   manifest.xml       │
└─────────────────────┘         └──────────────────────┘
         ↓                                ↑
         └──── npm run build:manifest ────┘
              (auto-generates production version)
```

**Key principle:** You NEVER manually edit production files. Build script does it.

---

## 📝 Quick Reference

### Development (Daily)
```bash
# Just work as normal
npm start  # Uses manifest.xml (localhost)
```

### Deployment (When Pushing to Production)
```bash
# 1. Generate manifest with your Render URL
cd addin
BASE_URL=https://YOUR-APP.onrender.com npm run build:manifest

# 2. Copy to server
cp manifest.production.xml ../server/public/manifest.xml

# 3. Deploy
git add server/public/manifest.xml
git commit -m "Update production manifest"
git push origin deployment  # Render auto-deploys
```

### Updating Features (After Initial Deploy)
```bash
# 1. Make your changes to code
# 2. Commit and push
git add .
git commit -m "Add awesome feature"
git push origin deployment

# Render auto-deploys!
# Users see changes next time they open Word (no reinstall needed!)
```

---

## 💰 Cost: $0/month

**Render Free Tier:**
- ✅ 750 hours/month (enough for always-on)
- ✅ 1GB persistent storage
- ✅ 100GB bandwidth
- ⚠️ Sleeps after 15 min inactivity (wakes in ~30 sec on request)

**To keep it awake** (optional):
- Use free uptime monitor (UptimeRobot)
- Ping every 10 minutes: `https://YOUR-APP.onrender.com/api/v1/health`

---

## 📚 Full Documentation

See `docs/deployment/` for detailed guides:
- **render-setup.md** - Complete Render deployment guide
- **addin-distribution.md** - How to distribute to end users
- **README.md** - Overview and quick reference

---

## 🆘 Need Help?

**If deploy fails:**
1. Check Render logs (Dashboard → Your Service → Logs)
2. Verify `render.yaml` is in repo root
3. Ensure `server/package.json` has all dependencies

**If add-in won't load:**
1. Verify manifest URLs point to your Render domain
2. Check Render service is "Live" (not sleeping)
3. Test web app first: `https://YOUR-APP.onrender.com/view.html`

---

**You're all set!** 🎉

When ready, just create your Render account and follow the steps above.

