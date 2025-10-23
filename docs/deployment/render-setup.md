# Render.com Deployment Guide

Complete guide for deploying wordFTW to Render.com (free tier with persistent storage).

---

## Why Render.com?

- ✅ **Free tier with persistent storage** (1GB disk included)
- ✅ **750 hours/month** runtime (enough for always-on service)
- ✅ Supports long-running processes & Server-Sent Events
- ✅ Automatic HTTPS with custom domains
- ✅ Simple Git-based deployment
- ✅ 100GB bandwidth/month
- ✅ Auto-deploys from GitHub on push

---

## Prerequisites

1. **Render.com Account**: Sign up at https://render.com
2. **GitHub Repository**: Your code pushed to GitHub
3. **Git Access**: Render connects directly to your GitHub repo

---

## Step 1: Create Render Account

### Sign Up
1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with GitHub (recommended) or email
4. Verify your email address

### Connect GitHub
1. In Render dashboard, authorize GitHub access
2. Grant access to your wordFTW repository

---

## Step 2: Prepare Your Repository

### Ensure Configuration Files Exist

Your repository should have:
- ✅ `render.yaml` (in root) - Deployment configuration
- ✅ `env.example` (in root) - Environment variables template
- ✅ `server/package.json` - Node.js dependencies
- ✅ `addin/manifest.production.xml` - Word add-in manifest template

### Push to GitHub
```bash
cd /path/to/wordFTW
git checkout deployment
git add render.yaml env.example
git commit -m "Add Render deployment configuration"
git push origin deployment
```

---

## Step 3: Create New Web Service

### From Render Dashboard

1. **Click "New +"** in top right
2. **Select "Blueprint"** (to use render.yaml)
   - Or select "Web Service" for manual setup

### Option A: Blueprint Deployment (Recommended)

1. **Connect Repository**:
   - Select your GitHub repository
   - Branch: `deployment`
   - Render will detect `render.yaml`

2. **Review Configuration**:
   - Service name: `wordftw` (or customize)
   - Plan: Free
   - All settings loaded from `render.yaml`

3. **Click "Apply"** to create service

### Option B: Manual Web Service Setup

If not using Blueprint:

1. **Connect Repository**:
   - Select your GitHub repository
   - Branch: `deployment`

2. **Configure Service**:
   - **Name**: `wordftw` (or your preference)
   - **Runtime**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `npm run start:production`
   - **Plan**: Free

3. **Add Disk** (Important!):
   - Name: `wordftw-data`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1GB

4. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   ALLOW_HTTP=true
   LLM_PROVIDER=ollama
   LLM_USE_OPENAI=false
   OLLAMA_MODEL=llama3.2:3b
   ```

5. **Health Check Path**: `/api/v1/health`

6. **Click "Create Web Service"**

---

## Step 4: Configure Environment Variables

### Required Environment Variables

In Render dashboard > Your Service > Environment:

```bash
NODE_ENV=production
PORT=10000
ALLOW_HTTP=true
```

### Optional: OpenAI Configuration

If using OpenAI instead of Ollama:

```bash
LLM_PROVIDER=openai
LLM_USE_OPENAI=true
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Important**: Mark `OPENAI_API_KEY` as **Secret** in Render dashboard.

---

## Step 5: Add Persistent Disk

Your app needs persistent storage for the `data/` directory.

### From Service Dashboard

1. **Go to "Disks"** tab
2. **Click "Add Disk"**:
   - Name: `wordftw-data`
   - Mount Path: `/opt/render/project/src/data`
   - Size: 1GB (free tier includes 1GB)
3. **Save Changes**

This triggers a redeploy with the persistent volume mounted.

---

## Step 6: Deploy Your Application

### Automatic Deployment

1. Render automatically deploys when you push to the connected branch
2. Monitor deployment in the "Events" tab
3. View logs in the "Logs" tab

### Manual Deployment

From the service dashboard:
1. Click **"Manual Deploy"** dropdown
2. Select **"Deploy latest commit"**
3. Or select **"Clear build cache & deploy"** if needed

### What Happens During Deploy:

1. Render clones your repository
2. Runs `cd server && npm install`
3. Starts server with `npm run start:production`
4. Mounts persistent disk to `/opt/render/project/src/data`
5. Assigns public URL: `https://wordftw.onrender.com` (or your custom name)

---

## Step 7: Verify Deployment

### Check Service Status

In Render dashboard:
- **Status**: Should show "Live" (green)
- **Logs**: Check for "Server running on port 10000"

### Test Health Endpoint

```bash
curl https://your-app-name.onrender.com/api/v1/health
```

Should return:
```json
{
  "status": "ok",
  "llm": { "enabled": true, ... },
  ...
}
```

### Test Web Interface

Open in browser:
```
https://your-app-name.onrender.com/view.html
```

You should see the Contract Management interface.

---

## Step 8: Update BASE_URL (Important!)

After getting your Render URL, update the environment variable:

### In Render Dashboard

1. Go to **Environment** tab
2. Add/update:
   ```
   BASE_URL=https://your-actual-app-name.onrender.com
   ```
3. **Save Changes** (triggers automatic redeploy)

---

## Render Configuration Explained

The `render.yaml` file in your repo root:

```yaml
services:
  - type: web
    name: wordftw
    runtime: node
    plan: free
    buildCommand: cd server && npm install
    startCommand: npm run start:production
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000            # Render uses port 10000
      - key: ALLOW_HTTP
        value: true
    healthCheckPath: /api/v1/health
    disk:
      name: wordftw-data
      mountPath: /opt/render/project/src/data
      sizeGB: 1                 # Free tier includes 1GB
```

---

## Common Render Commands & Tasks

### View Logs
- Dashboard > Your Service > **Logs** tab
- Real-time streaming
- Filter by severity

### Manual Deploy
- Dashboard > Your Service > **Manual Deploy**
- Options:
  - Deploy latest commit
  - Clear build cache & deploy

### Shell Access
- Dashboard > Your Service > **Shell** tab
- Interactive terminal to your running service
- Useful for debugging

### Suspend Service
- Dashboard > Your Service > **Settings**
- Scroll to bottom > **Suspend Service**
- Useful to pause without deleting (saves disk data)

### Custom Domain
- Dashboard > Your Service > **Settings**
- Add custom domain (free with Render)
- Follow DNS instructions

---

## Free Tier Limits

✅ **Included in Free Tier:**
- 750 hours/month runtime per service
- 1GB persistent disk per service
- 100GB bandwidth/month
- Automatic SSL certificates
- Unlimited services (total 750 hours shared)

⚠️ **Auto-Sleep Behavior:**
- Free tier services **spin down after 15 minutes of inactivity**
- Wake up automatically on first request (~30-60 second delay)
- Subsequent requests are fast
- No data loss (persistent disk preserved)

💡 **Staying Active:**
- Use external uptime monitor (e.g., UptimeRobot) to ping every 10 minutes
- Ping URL: `https://your-app.onrender.com/api/v1/health`
- This keeps service active within 750 hour limit (~31 days)

---

## Troubleshooting

### Build Fails

**Check build logs:**
- Dashboard > Events > Click failed deploy > View logs

**Common issues:**
- Missing `server/package.json` dependencies
- Node version mismatch
- Wrong build command

**Solution:**
```bash
# Ensure dependencies are correct
cd server
npm install
npm audit fix
cd ..
git add server/package-lock.json
git commit -m "Update dependencies"
git push origin deployment
```

### Service Crashes After Deploy

**View crash logs:**
- Dashboard > Logs > Filter by "Error"

**Common issues:**
- Environment variables not set
- Disk not mounted
- Port mismatch (must use PORT environment variable)

**Solution:**
1. Verify all environment variables are set
2. Check disk is attached in "Disks" tab
3. Ensure server listens on `process.env.PORT || 10000`

### Disk Not Persisting Data

**Verify disk attachment:**
- Dashboard > Disks tab > Should show "wordftw-data"

**Check mount path:**
- Must be `/opt/render/project/src/data`
- This maps to your `/data` directory in code

**Debug via Shell:**
```bash
# In Render Shell tab:
ls -la /opt/render/project/src/data
```

### Slow Wake-Up Time

Free tier services sleep after 15 minutes of inactivity.

**Options:**
1. **Accept the delay** (30-60 seconds on first request) - Free
2. **Use uptime monitor** to keep awake - Free with limits
3. **Upgrade to paid plan** ($7/month) for always-on

### Can't Access Application

**Check service status:**
- Dashboard > Your Service > Should show "Live"

**Common issues:**
- Service sleeping (first request takes time)
- Build failed (check Events tab)
- Wrong URL (check Settings > Domains)

**Solution:**
1. Wait 60 seconds and refresh
2. Check deploy status in Events tab
3. View logs for errors

---

## Auto-Deploy from GitHub

### Enable Auto-Deploy (Default)

Render automatically deploys when you push to the connected branch.

1. Make changes locally
2. Commit and push:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin deployment
   ```
3. Render detects push and auto-deploys
4. Monitor in Events tab

### Disable Auto-Deploy

If you want manual control:
1. Dashboard > Settings
2. Scroll to "Build & Deploy"
3. Uncheck "Auto-Deploy"
4. Save Changes

Now deploy manually via "Manual Deploy" button.

---

## Updating Your Application

### Push Updates
```bash
# Make your changes
git add .
git commit -m "Feature: add new functionality"
git push origin deployment

# Render auto-deploys
# Monitor: Dashboard > Events
```

### Rollback to Previous Deploy

1. Dashboard > Events
2. Find successful previous deploy
3. Click **"Rollback to this deploy"**
4. Confirm

---

## Custom Domain Setup

### Add Your Domain

1. **Dashboard > Settings** (scroll down)
2. **Click "Add Custom Domain"**
3. **Enter your domain**: `contracts.yourdomain.com`
4. **Render provides DNS instructions**:
   ```
   Type: CNAME
   Name: contracts
   Value: your-app.onrender.com
   ```

5. **Add CNAME record to your DNS provider**
6. **Wait for propagation** (5-60 minutes)
7. **Render automatically provisions SSL certificate**

### Update Environment

```bash
BASE_URL=https://contracts.yourdomain.com
```

---

## Monitoring & Alerts

### Built-in Monitoring

- **Events**: Deployment history
- **Logs**: Real-time and historical
- **Metrics**: CPU, memory, requests (paid plans)

### External Monitoring

For uptime monitoring:
- **UptimeRobot** (free tier: 50 monitors)
- **Pingdom** (free tier: 1 monitor)
- **StatusCake** (free tier: unlimited monitors)

**Setup:**
1. Add monitor for: `https://your-app.onrender.com/api/v1/health`
2. Check interval: Every 10 minutes
3. Alert on: HTTP status != 200

---

## Cost Considerations

### Free Tier

- ✅ Free forever for this use case
- ✅ 750 hours/month = ~31 days continuous uptime
- ✅ Perfect for prototypes and demos
- ⚠️ Spins down after 15 min inactivity

### Paid Plans (Optional)

**Starter Plan: $7/month per service**
- Always-on (no sleep)
- Faster builds
- Priority support

**When to upgrade:**
- Need always-on service with no wake delay
- High traffic (>100GB bandwidth/month)
- Production use with SLA requirements

---

## Security Best Practices

### Environment Variables

- ✅ Store sensitive data (API keys) as **Secrets** in Render
- ✅ Never commit secrets to Git
- ✅ Use `env.example` as template (no actual values)

### HTTPS Only

- ✅ Render provides automatic SSL certificates
- ✅ All traffic is HTTPS by default
- ✅ HTTP redirects to HTTPS automatically

### Access Control & Session Isolation

- Render services are public by default
- **JWT authentication enabled** for per-user session isolation
- Each user automatically gets an isolated session with their own data
- **Required:** Set `JWT_SECRET` environment variable (see Environment Variables section)
  ```bash
  # Generate a secure secret:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Sessions expire after 7 days (automatic token refresh)

---

## What You Need to Do (Summary)

1. **Create Render Account**
   - Sign up at https://render.com
   - Connect GitHub

2. **Deploy via Blueprint**
   - New + > Blueprint
   - Select repository (branch: `deployment`)
   - Render auto-configures from `render.yaml`
   - Click "Apply"

3. **Set Environment Variables**
   - Dashboard > Environment
   - **Required:** `JWT_SECRET` - Generate secure secret (see command below)
   - Verify: `PORT=10000` and `NODE_ENV=production`
   ```bash
   # Generate JWT_SECRET:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Check Disk is Attached**
   - Dashboard > Disks
   - Should see `wordftw-data` mounted

5. **Test Deployment**
   - Visit: `https://your-app-name.onrender.com/view.html`
   - Test: `curl https://your-app-name.onrender.com/api/v1/health`

6. **Update Word Add-in Manifest**
   - Edit `addin/manifest.production.xml`
   - Replace `YOUR-APP-NAME` with actual Render app name
   - Follow `addin-distribution.md` for distribution

---

## Support

- **Render Docs**: https://render.com/docs
- **Render Community**: https://community.render.com
- **Status Page**: https://status.render.com
- **Support**: Email support@render.com (paid plans get priority)

---

## Next Steps

After successful deployment:
1. ✅ Test web application thoroughly
2. ✅ Update Word add-in manifest with Render URL
3. ✅ Follow `addin-distribution.md` to distribute to users
4. ✅ (Optional) Set up uptime monitoring to prevent sleep

**Your app will be live at**: `https://your-app-name.onrender.com` 🚀

