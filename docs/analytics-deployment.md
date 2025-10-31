# Analytics Deployment Guide

## Overview

Simple visitor analytics system with MongoDB support for persistent storage across restarts.

**Features:**
- Track total visits and per-page visit counts
- Beautiful dashboard at `/analytics`
- MongoDB support for persistent data (survives restarts)
- Automatic fallback to JSON file if MongoDB not configured
- Auto-migration from JSON to MongoDB on first connection

---

## Local Development

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure MongoDB (Optional)

**Get Free MongoDB Atlas:**
1. Sign up at https://www.mongodb.com/cloud/atlas/register
2. Create a free M0 cluster (512 MB)
3. Create database user with password
4. Whitelist all IPs: `0.0.0.0/0`
5. Get connection string

**Set Environment Variable:**
```powershell
# PowerShell
$env:MONGODB_URI="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?appName=YourApp"
```

```bash
# Bash
export MONGODB_URI="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?appName=YourApp"
```

### 3. Start Server
```bash
npm start
```

### 4. Test It
- Dashboard: https://localhost:4001/analytics
- API: https://localhost:4001/api/analytics/stats

**Without MongoDB:**
- Uses JSON file: `data/app/analytics.json`
- Data resets when server restarts

**With MongoDB:**
- Data persists across restarts
- Survives code deployments

---

## Production Deployment (Render)

### 1. Add MongoDB URI to Render

**In Render Dashboard:**
1. Go to your service: **wordftw**
2. Navigate to **Environment** tab
3. Click **Add Environment Variable**
4. Add:
   - **Key:** `MONGODB_URI`
   - **Value:** `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?appName=Cluster0`
5. Click **Save Changes**

### 2. Deploy Code

```bash
# Make sure you're on feature branch
git branch --show-current  # Should show: feature/simple-analytics

# Merge to main (or your deploy branch)
git checkout main
git merge feature/simple-analytics

# Push to trigger deploy
git push origin main
```

### 3. Verify Deployment

After Render finishes deploying:

1. **Check Logs:**
   - Look for: `✅ MongoDB connected for analytics`
   - OR: `📊 Analytics: Using MongoDB (persistent)`

2. **Test Dashboard:**
   - Visit: `https://wordftw.onrender.com/analytics`
   - Visit your home page a few times
   - Refresh analytics dashboard
   - Count should increase

3. **Test Persistence:**
   - Note the current visit count
   - Redeploy or restart the service
   - Check analytics again
   - Count should be the same (not reset to 0)

---

## How It Works

### Architecture

```
User visits page
      ↓
  trackPageVisit() middleware
      ↓
  analyticsDb.trackVisit(page)
      ↓
  ┌─────────────────┐
  │ MongoDB exists? │
  └────────┬────────┘
           │
     Yes ↙   ↘ No
        ↓       ↓
   MongoDB   JSON File
   (persist) (resets)
```

### Data Structure

**MongoDB Collection: `wordftw_analytics.page_visits`**
```json
{
  "_id": "...",
  "page": "/",
  "count": 42,
  "lastVisit": "2025-10-31T12:34:56.789Z"
}
```

**JSON Fallback: `data/app/analytics.json`**
```json
{
  "totalVisits": 42,
  "pages": {
    "/": 35,
    "/view": 5,
    "/debug": 2
  }
}
```

### Automatic Migration

On first MongoDB connection, if `analytics.json` exists:
1. Reads existing JSON data
2. Upserts each page count to MongoDB
3. Logs migration: `✅ Migrated X pages to MongoDB`
4. Keeps JSON file for fallback

---

## Tracked Pages

Currently tracking:
- `/` - Home page
- `/view` - View page
- `/debug` - Debug page

**To track more pages**, edit `server/src/server.js`:
```javascript
app.get('/your-page', trackPageVisit, (req, res) => {
  res.sendFile(path.join(webDir, 'your-page.html'));
});
```

---

## Dashboard Features

**Manual Refresh:**
- Click "🔄 Refresh" to update numbers

**Auto-Refresh:**
- Click "⏱️ Auto-refresh: OFF" to enable
- Updates every 30 seconds automatically
- Click again to disable

**What It Shows:**
- Total visits (all pages combined)
- Top 5 most visited pages
- Last update timestamp

---

## Troubleshooting

### "Connection closed unexpectedly"
- MongoDB URI might be incorrect
- Check Render environment variable
- Verify MongoDB cluster is running
- Check IP whitelist: should be `0.0.0.0/0`

### "Failed to retrieve analytics"
- MongoDB connection lost
- Check MongoDB Atlas dashboard
- Server will fall back to JSON mode

### Analytics reset to 0
- Happened on Render free tier restart
- MongoDB not configured
- Add MONGODB_URI to Render environment

### Local testing: "Module not found"
```bash
cd server
npm install
```

---

## MongoDB Atlas Free Tier

**Limits:**
- 512 MB storage (plenty for analytics)
- Shared RAM/vCPU
- No credit card required
- Perfect for this use case

**When to upgrade:**
- Need more than 512 MB
- Want dedicated resources
- Need advanced features

---

## Cost Summary

| Component | Cost | Notes |
|-----------|------|-------|
| MongoDB Atlas | **$0** | Free M0 tier |
| Render (existing) | **$0** | Already deployed |
| **Total** | **$0** | Zero additional cost! |

---

## Security Notes

1. **MongoDB URI is secret** - Never commit it to git
2. **Environment variables only** - Use Render dashboard
3. **IP whitelist** - `0.0.0.0/0` for simplicity (read-only data)
4. **No personal data** - Only page paths and counts

---

## API Endpoints

### GET `/api/analytics/stats`

Returns current analytics data.

**Response:**
```json
{
  "totalVisits": 42,
  "pages": {
    "/": 35,
    "/view": 5,
    "/debug": 2
  }
}
```

### GET `/analytics`

Serves the analytics dashboard HTML page.

---

## Files Changed

- `server/src/lib/analytics-db.js` - New MongoDB + JSON analytics module
- `server/src/server.js` - Updated to use analytics-db module
- `server/package.json` - Added mongodb driver
- `web/analytics.html` - Analytics dashboard (from previous commit)
- `render.yaml` - Added MONGODB_URI environment variable
- `env.example` - Added MongoDB configuration example

---

## Next Steps

1. ✅ Merge `feature/simple-analytics` to main
2. ✅ Add MONGODB_URI to Render environment
3. ✅ Deploy to production
4. ✅ Test analytics dashboard
5. ✅ Monitor visitor counts!

**Questions?** Check server logs or test locally first.

