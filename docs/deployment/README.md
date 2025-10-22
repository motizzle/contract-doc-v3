# Deployment Documentation

This folder contains guides for deploying the wordFTW application to production.

## Quick Start

1. **Deploy Web Application**: Follow [`railway-setup.md`](./railway-setup.md)
2. **Distribute Word Add-in**: Follow [`addin-distribution.md`](./addin-distribution.md)

## Files

### Documentation
- **`railway-setup.md`** - Complete guide for deploying to Railway.app
- **`addin-distribution.md`** - Guide for distributing the Word add-in to users

### Configuration (in root directory)
- **`/railway.json`** - Railway deployment configuration (must be in root)
- **`/env.example`** - Environment variables template

### Templates
- **`/addin/manifest.production.xml`** - Production Word add-in manifest template

## Deployment Overview

```
┌─────────────────────┐
│  1. Deploy to       │
│     Railway         │  → Follow railway-setup.md
│                     │    Set environment variables
│                     │    Add persistent volume
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Test Web App    │  → Visit https://your-app.railway.app/view.html
│                     │    Verify all features work
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Update Manifest │  → Update addin/manifest.production.xml
│                     │    Replace YOUR-RAILWAY-URL with actual domain
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Distribute      │  → Follow addin-distribution.md
│     Word Add-in     │    Create installation package
│                     │    Share with users
└─────────────────────┘
```

## Platform: Railway

**Why Railway?**
- ✅ Supports stateful Node.js applications
- ✅ Persistent file storage (volumes)
- ✅ Long-running processes (SSE support)
- ✅ Automatic HTTPS
- ✅ Free tier available
- ✅ Simple Git-based deployment

**Not compatible with**: Vercel (serverless, read-only filesystem)

## Support

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

