# Deployment Documentation

This folder contains guides for deploying the wordFTW application to production.

## Quick Start

1. **Deploy Web Application**: Follow [`render-setup.md`](./render-setup.md)
2. **Distribute Word Add-in**: Follow [`addin-distribution.md`](./addin-distribution.md)

## Files

### Documentation
- **`render-setup.md`** - Complete guide for deploying to Render.com (FREE with persistent storage)
- **`addin-distribution.md`** - Guide for distributing the Word add-in to users

### Configuration (in root directory)
- **`/render.yaml`** - Render.com deployment configuration (must be in root)
- **`/env.example`** - Environment variables template

### Templates
- **`/addin/manifest.production.xml`** - Production Word add-in manifest template

## Deployment Overview

```
┌─────────────────────┐
│  1. Deploy to       │
│     Render.com      │  → Follow render-setup.md
│                     │    Connect GitHub repo
│                     │    Deploy via Blueprint
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Test Web App    │  → Visit https://your-app.onrender.com/view.html
│                     │    Verify all features work
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Update Manifest │  → Update addin/manifest.production.xml
│                     │    Replace YOUR-APP-NAME with actual Render app name
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Distribute      │  → Follow addin-distribution.md
│     Word Add-in     │    Create installation package
│                     │    Share with users
└─────────────────────┘
```

## Platform: Render.com

**Why Render.com?**
- ✅ **Free tier with persistent storage** (1GB disk included)
- ✅ **750 hours/month** runtime (enough for always-on)
- ✅ Supports stateful Node.js applications
- ✅ Long-running processes (SSE support)
- ✅ Automatic HTTPS
- ✅ Simple Git-based deployment from GitHub
- ✅ 100GB bandwidth/month
- ✅ Auto-deploys on push

**Not compatible with**: Vercel (serverless, read-only filesystem)

## Support

- Render Documentation: https://render.com/docs
- Render Community: https://community.render.com

