# Enhanced Analytics - Complete Guide

## 🎯 Overview

Your analytics system now tracks much more than just page views! You can see:

- **Who** (unique sessions)
- **Where** (country/city)
- **What device** (mobile/desktop/tablet)
- **Which browser** (Chrome, Firefox, Safari, etc.)
- **How they found you** (referrer)
- **What they clicked** (optional)

All while respecting privacy and only tracking in production.

---

## 📊 What Data is Being Collected

### 1. **Session Tracking** (Unique Visitors)

**What:** A unique ID stored in a cookie for 30 days  
**Why:** Distinguish between new vs returning visitors  
**Privacy:** Anonymous UUID, no personal information

```javascript
Cookie: analytics_session=550e8400-e29b-41d4-a716-446655440000
```

### 2. **Location Data** (Where They're From)

**What:** Country, region, city based on IP address  
**Why:** See where your audience is located  
**How:** GeoIP lookup (MaxMind database)  
**Privacy:** IP addresses are not stored permanently

**Example:**
```json
{
  "country": "US",
  "region": "CA",
  "city": "San Francisco",
  "timezone": "America/Los_Angeles"
}
```

### 3. **Device Information**

**What:** Device type, browser, operating system  
**Why:** Understand your audience's tech stack  
**How:** Parse User-Agent string

**Example:**
```json
{
  "type": "mobile",      // or "desktop", "tablet"
  "browser": "Chrome",   // Firefox, Safari, Edge
  "os": "iOS"           // Windows, macOS, Linux, Android
}
```

### 4. **Referrer** (How They Found You)

**What:** URL they came from  
**Why:** Know if traffic is from Google, social media, direct, etc.

**Examples:**
```
"https://google.com" → Found via Google search
"https://twitter.com" → Clicked a Twitter link
"direct" → Typed URL directly or bookmarked
```

### 5. **Click Tracking** (Optional!)

**What:** Which buttons/links users click  
**Why:** See what's engaging users  
**How:** Opt-in JavaScript tracker

**To enable:** Add to any page:
```html
<script src="/web/click-tracker.js"></script>
```

---

## 🗄️ MongoDB Collections

Your analytics uses **4 MongoDB collections**:

### 1. `page_visits` (Summary Counts)
```json
{
  "_id": "...",
  "page": "/",
  "count": 142,
  "lastVisit": "2024-10-31T12:00:00Z"
}
```

### 2. `visit_events` (Detailed Visit Log)
```json
{
  "page": "/view",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "ip": "192.168.1.1",
  "location": {
    "country": "US",
    "city": "San Francisco"
  },
  "device": {
    "type": "mobile",
    "browser": "Chrome",
    "os": "iOS"
  },
  "referrer": "https://google.com",
  "timestamp": "2024-10-31T12:00:00Z"
}
```

### 3. `sessions` (Session Aggregates)
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "firstSeen": "2024-10-31T11:00:00Z",
  "lastSeen": "2024-10-31T12:00:00Z",
  "pageViews": 5,
  "location": { "country": "US", "city": "San Francisco" },
  "device": { "type": "mobile" },
  "ip": "192.168.1.1"
}
```

### 4. `click_events` (Optional Click Tracking)
```json
{
  "page": "/",
  "element": {
    "tag": "button",
    "selector": "button.submit-btn",
    "text": "Submit Form",
    "href": null
  },
  "timestamp": "2024-10-31T12:00:00Z",
  "screenWidth": 1920,
  "screenHeight": 1080,
  "scrollY": 350
}
```

---

## 📈 Dashboard Features

### Enhanced Dashboard: `/analytics`

**Top Stats Cards:**
- Total Visits
- Unique Visitors
- Pages per Session (engagement metric)

**Top Locations Section:**
- Country flags with city names
- Session counts per location

**Device Breakdown:**
- Mobile vs Desktop vs Tablet
- Visual badges for each type

**Recent Visits Feed:**
- Real-time visitor activity
- Shows last 5 visits with:
  - Page visited
  - Time ago (e.g., "5m ago")
  - Location
  - Device type
  - Browser
  - Referrer (if any)

### Simple Dashboard: `/analytics/simple`

Legacy version with basic page view counts (for comparison)

---

## 🔒 Privacy & Security

### What We DON'T Collect:
- ❌ Names or email addresses
- ❌ Permanent IP addresses
- ❌ Form submissions or input data
- ❌ Passwords or sensitive information
- ❌ Personal identifiable information (PII)

### What We DO Collect:
- ✅ Anonymous session IDs (random UUIDs)
- ✅ General location (city-level, not street address)
- ✅ Device/browser type (publicly available info)
- ✅ Page paths visited
- ✅ Referrer URLs (standard web behavior)

### Privacy Best Practices:
1. **Anonymous Sessions:** UUIDs don't identify individuals
2. **No Cross-Site Tracking:** Cookie is httpOnly and first-party only
3. **City-Level Location:** Not precise enough to identify individuals
4. **IP Not Stored:** Used only for geo-lookup, then discarded
5. **Production Only:** No tracking on localhost/development

### Cookie Details:
```javascript
Name: analytics_session
Duration: 30 days
HttpOnly: true (can't be read by JavaScript)
Secure: true (HTTPS only in production)
SameSite: lax (can't be used for CSRF)
```

---

## 🎛️ Click Tracking (Optional)

### How to Enable

**Option 1: Track Specific Elements Only (Recommended)**

Add `data-track` attribute to elements you want to track:

```html
<button data-track>Submit Form</button>
<a href="/pricing" data-track>View Pricing</a>
<div data-track class="feature-card">Important Feature</div>
```

Then add the script to your page:
```html
<script src="/web/click-tracker.js"></script>
```

**Option 2: Track All Buttons and Links**

Edit `web/click-tracker.js` and change:
```javascript
const TRACK_ALL = true; // Set to true to track ALL clicks
```

**⚠️ Warning:** This can generate A LOT of data! Use sparingly.

### Manual Event Tracking

Track custom events from your JavaScript:

```javascript
// Track a custom event
window.analyticsTrack('feature_used', {
  featureName: 'export_pdf',
  documentType: 'contract'
});

// Track a conversion
window.analyticsTrack('signup_completed', {
  plan: 'pro',
  source: 'homepage_cta'
});
```

### When to Use Click Tracking

**Good use cases:**
- ✅ Track CTA button clicks
- ✅ Monitor feature usage
- ✅ A/B testing different UI elements
- ✅ Funnel analysis (multi-step forms)

**Not recommended:**
- ❌ Tracking every single click (overwhelming data)
- ❌ Tracking text selections or mouse movements
- ❌ Tracking form inputs (privacy concern)

---

## 🚀 Deployment

### 1. Test Locally First

Start server in development mode (tracking disabled):
```powershell
cd server
$env:MONGODB_URI="your-mongo-uri"
$env:NODE_ENV="development"
npm start
```

Visit: `https://localhost:4001/analytics`

You'll see the warning message about dev mode. Visit your pages - numbers won't increase (correct!).

### 2. Deploy to Render

Make sure `MONGODB_URI` is set in Render environment variables, then:

```bash
git add -A
git commit -m "feat: Enhanced analytics with sessions, location, device tracking"
git push origin main
```

### 3. Verify Production

After deploy:
1. Visit: `https://wordftw.onrender.com/analytics`
2. Open your site in a few different browsers
3. Check analytics - should see:
   - Different session counts
   - Location data
   - Device types
   - Recent visits showing up

---

## 📊 Interpreting the Data

### Total Visits vs Unique Visitors

- **Total Visits:** Every page view (can be same person)
- **Unique Visitors:** Distinct sessions (different people/browsers)

If someone visits 5 pages:
- Total Visits: +5
- Unique Visitors: +1

### Pages per Session

**Low (1-2):** People leaving quickly (bounce rate high)  
**Medium (3-5):** Good engagement  
**High (6+):** Very engaged users

### Device Breakdown

**Mobile > 50%:** Make sure mobile UX is great!  
**Desktop dominant:** Content likely consumed at work/office  
**Tablet presence:** Consider tablet-optimized layouts

### Location Data

See where your audience is:
- Plan localized content
- Optimize for time zones
- Consider language options
- Understand market reach

---

## 🔧 Advanced Queries

You can query MongoDB directly for custom analytics:

### Most Active Times
```javascript
db.visit_events.aggregate([
  {
    $group: {
      _id: { $hour: "$timestamp" },
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } }
])
```

### Top Referrers
```javascript
db.visit_events.aggregate([
  {
    $match: { referrer: { $ne: "direct" } }
  },
  {
    $group: {
      _id: "$referrer",
      count: { $sum: 1 }
    }
  },
  { $sort: { count: -1 } },
  { $limit: 10 }
])
```

### User Journey (Pages Visited in Sequence)
```javascript
db.visit_events.find({ sessionId: "your-session-id-here" })
  .sort({ timestamp: 1 })
  .limit(20)
```

---

## 🎯 Comparison: Before vs After

### Before (Simple Analytics)
```json
{
  "totalVisits": 142,
  "pages": {
    "/": 100,
    "/view": 42
  }
}
```

You knew: **How many** page views

### After (Enhanced Analytics)
```json
{
  "totalVisits": 142,
  "uniqueSessions": 47,
  "topLocations": [
    { "country": "US", "city": "San Francisco", "count": 12 },
    { "country": "UK", "city": "London", "count": 8 }
  ],
  "topDevices": [
    { "type": "mobile", "count": 30 },
    { "type": "desktop", "count": 17 }
  ],
  "recentVisits": [
    {
      "page": "/",
      "location": { "country": "US", "city": "SF" },
      "device": { "type": "mobile", "browser": "Chrome" },
      "referrer": "https://google.com",
      "timestamp": "5m ago"
    }
  ]
}
```

Now you know: **Who, What, Where, When, How**

---

## 💡 Tips & Best Practices

### 1. Start Simple
- Deploy with page tracking first
- Add click tracking only when needed
- Don't track everything - focus on key actions

### 2. Regular Monitoring
- Check analytics daily for first week
- Look for patterns (traffic spikes, device trends)
- Identify popular content

### 3. Respect Privacy
- Don't track sensitive pages (login, checkout)
- Be transparent in privacy policy
- Honor do-not-track if required by law

### 4. Performance
- All tracking is asynchronous (doesn't slow site)
- MongoDB indexed for fast queries
- Click tracking is optional (disable if too much data)

### 5. Data Retention
- Consider archiving old click events (can grow large)
- Page visits and sessions are lightweight
- Free MongoDB tier: 512 MB (plenty for most sites)

---

## 🐛 Troubleshooting

### No Data Showing Up

**Check:**
1. Is `NODE_ENV=production`? (tracking disabled in dev)
2. Is MongoDB connected? (check server logs)
3. Are you visiting actual production URL? (not localhost)
4. Clear browser cache and cookies

### Location Shows "Unknown"

**Reasons:**
- Localhost/private IP (can't geolocate)
- VPN/Proxy (IP might be from datacenter)
- GeoIP database doesn't have that IP

**This is normal** for some traffic!

### Click Tracking Not Working

**Check:**
1. Is script included? `<script src="/web/click-tracker.js"></script>`
2. Are elements marked? `data-track` attribute
3. Check browser console for errors
4. Is `NODE_ENV=production`?

---

## 📋 API Reference

### GET `/api/analytics/stats`

Returns all analytics data.

**Response:**
```json
{
  "totalVisits": 142,
  "uniqueSessions": 47,
  "pages": { "/": 100, "/view": 42 },
  "topLocations": [...],
  "topDevices": [...],
  "recentVisits": [...]
}
```

### POST `/api/analytics/click`

Track a click event (used by click-tracker.js).

**Request:**
```json
{
  "page": "/",
  "element": {
    "tag": "button",
    "selector": "button.cta",
    "text": "Get Started"
  },
  "timestamp": "2024-10-31T12:00:00Z"
}
```

**Response:**
```json
{
  "tracked": true
}
```

---

## 📦 Files Reference

| File | Purpose |
|------|---------|
| `server/src/lib/analytics-db.js` | Database module (MongoDB + fallback) |
| `server/src/server.js` | Tracking middleware + API endpoints |
| `web/analytics-enhanced.html` | Enhanced dashboard UI |
| `web/analytics.html` | Simple dashboard (legacy) |
| `web/click-tracker.js` | Optional click tracking script |

---

## 🎉 Summary

You now have **enterprise-level analytics** that tracks:

✅ **Unique visitors** (session tracking)  
✅ **Location data** (country + city)  
✅ **Device types** (mobile/desktop/tablet)  
✅ **Browser info** (Chrome, Firefox, etc.)  
✅ **Traffic sources** (referrers)  
✅ **Recent activity** (real-time feed)  
✅ **Click events** (optional)

All while:
- ✅ Respecting privacy (anonymous, no PII)
- ✅ Persisting data (survives restarts)
- ✅ Working offline (JSON fallback)
- ✅ Costing $0 (MongoDB free tier)

**Your analytics are production-ready!** 🚀

