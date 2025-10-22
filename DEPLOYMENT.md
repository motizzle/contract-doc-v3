# Railway Deployment Guide

This guide walks you through deploying the wordFTW application to Railway.

## Prerequisites

1. **Railway Account**: Sign up at https://railway.app (free tier available)
2. **GitHub Repository**: Your code must be pushed to GitHub
3. **Railway CLI** (optional): `npm install -g @railway/cli`

---

## Step 1: Create Railway Project

### Option A: Via Railway Dashboard (Recommended)

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authenticate with GitHub and select your repository
5. Railway will auto-detect the Node.js project

### Option B: Via Railway CLI

```bash
# Login to Railway
railway login

# Initialize project in this directory
railway init

# Link to your Railway project
railway link
```

---

## Step 2: Configure Environment Variables

In the Railway dashboard, go to your project → **Variables** tab and add:

### Required Variables

```
NODE_ENV=production
PORT=4001
BASE_URL=https://your-app-name.up.railway.app
```

**Important**: Replace `your-app-name.up.railway.app` with your actual Railway domain (you'll get this after first deployment).

### Optional LLM Variables

If using OpenAI instead of Ollama:
```
LLM_PROVIDER=openai
LLM_USE_OPENAI=true
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

---

## Step 3: Add Persistent Volume for Data

Your app needs persistent storage for `data/` directory:

1. In Railway dashboard → **Settings** tab
2. Scroll to **Volumes**
3. Click **"Add Volume"**
4. Set:
   - **Name**: `wordftw-data`
   - **Mount Path**: `/app/data`
   - **Size**: 1 GB (free tier)

---

## Step 4: Deploy

Railway will automatically deploy when you push to your connected branch.

### Manual Deploy (if needed)
```bash
# Push to GitHub
git push origin deployment

# Or use Railway CLI
railway up
```

### Monitor Deployment
1. Go to **Deployments** tab in Railway dashboard
2. Click on the active deployment to see logs
3. Wait for "HTTPS server running" or "HTTP server running" message

---

## Step 5: Verify Deployment

Once deployed, Railway will provide a URL like `https://your-app.up.railway.app`

### Test the deployment:
```bash
# Health check
curl https://your-app.up.railway.app/api/v1/health

# Should return:
{
  "status": "ok",
  "llm": { "enabled": true, ... },
  ...
}
```

### Test the web interface:
Open `https://your-app.up.railway.app/view.html` in your browser.

---

## Step 6: Update BASE_URL

After getting your Railway domain:

1. Go to Railway → **Variables** tab
2. Update `BASE_URL` to your actual domain:
   ```
   BASE_URL=https://your-actual-domain.up.railway.app
   ```
3. Railway will automatically redeploy

---

## Step 7: Deploy Word Add-in

### Update Manifest

The Word add-in manifest needs to point to your Railway URL:

1. Edit `addin/manifest.xml`
2. Replace all `https://localhost:4000` with your Railway URL
3. Build the add-in:
   ```bash
   cd addin
   npm install
   npm run build
   ```

### Host Add-in Files

The built add-in files are served from your Railway deployment automatically.

### Create Distribution Package

1. Copy the updated `manifest.xml` to a distribution folder
2. Create installation instructions for users
3. Host the manifest at: `https://your-app.up.railway.app/addin/manifest.xml`

---

## Step 8: Configure Custom Domain (Optional)

For production, use a custom domain:

1. Railway → **Settings** → **Domains**
2. Click **"Add Custom Domain"**
3. Enter your domain (e.g., `wordftw.yourdomain.com`)
4. Add the CNAME record to your DNS provider
5. Update `BASE_URL` environment variable

---

## Troubleshooting

### Deployment Fails

**Check build logs**:
- Railway dashboard → Deployments → Click deployment → View logs
- Common issues: Missing dependencies, Node version mismatch

**Solution**:
```bash
# Ensure all dependencies are in package.json
cd server
npm install
git add package-lock.json
git commit -m "Update dependencies"
git push
```

### App Crashes After Deploy

**Check runtime logs**:
- Railway dashboard → Deployments → Active deployment → Logs

**Common issues**:
- Missing environment variables
- Volume not mounted (data directory)
- Port binding (should use `process.env.PORT`)

### Can't Access the App

**Verify domain**:
- Railway → Settings → Domains
- Make sure domain is generated and active

**Check health endpoint**:
```bash
curl https://your-app.up.railway.app/api/v1/health
```

### Data Not Persisting

**Verify volume**:
- Railway → Settings → Volumes
- Check mount path is `/app/data`
- Check volume is attached to service

---

## What You Need to Do (Summary)

1. **Create Railway account** at https://railway.app
2. **Connect GitHub repo** to Railway
3. **Add environment variables**:
   - `NODE_ENV=production`
   - `PORT=4001`
   - `BASE_URL=https://your-app.up.railway.app` (update after first deploy)
4. **Add persistent volume**:
   - Mount path: `/app/data`
   - Size: 1 GB
5. **Deploy and verify**
6. **Update manifest.xml** with Railway URL for Word add-in

---

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Create an issue in your repository

