# Word Add-in Distribution Guide

This guide explains how to distribute the OG CLM Word add-in to users after deploying to Render.com.

---

## Prerequisites

1. ✅ Render.com deployment is complete and accessible
2. ✅ You have your Render URL (e.g., `https://your-app.onrender.com`)

---

## Step 1: Generate Production Manifest

The production manifest is **auto-generated** from your development manifest. You only maintain one file!

1. **Generate the production manifest**:
   ```bash
   cd addin
   BASE_URL=https://your-actual-app.onrender.com npm run build:manifest
   ```

   This creates `manifest.production.xml` with all localhost URLs replaced by your Render URL.

2. **Verify the generated manifest**:
   ```bash
   # Check that URLs were replaced correctly
   cat addin/manifest.production.xml | grep "onrender.com"
   ```

3. **Host the manifest on your server**:
   
   Copy the generated manifest to your server's public directory:
   ```bash
   cp addin/manifest.production.xml server/public/manifest.xml
   ```

4. **Commit and push**:
   ```bash
   git add server/public/manifest.xml
   git commit -m "Add production Word add-in manifest"
   git push origin deployment
   ```
   
   **Note**: `manifest.production.xml` is auto-generated and ignored by git. Only commit the copy in `server/public/`.

---

## Step 2: Create Distribution Package

### For End Users (Sideloading)

Create a distribution folder with:

```
word-addin-distribution/
├── manifest.xml              (your updated manifest-deploy.xml)
├── INSTALL-WINDOWS.md       (Windows installation instructions)
├── INSTALL-MAC.md           (Mac installation instructions)
└── assets/
    └── screenshots/         (optional: app screenshots)
```

### Windows Installation Instructions (`INSTALL-WINDOWS.md`)

````markdown
# Installing OG CLM Word Add-in (Windows)

## Prerequisites
- Microsoft Word 2016 or later
- Windows 10 or later

## Installation Steps

1. **Download the manifest file**
   - Save `manifest.xml` to your computer
   - Remember the location (e.g., `C:\Users\YourName\Documents\WordAddins\`)

2. **Open Word**
   - Launch Microsoft Word
   - Create a new blank document

3. **Access the Add-ins Dialog**
   - Click **File** → **Options**
   - Select **Trust Center** from the left sidebar
   - Click **Trust Center Settings** button
   - Select **Trusted Add-in Catalogs**

4. **Add Network Share**
   - In the **Catalog Url** field, enter the folder path where you saved the manifest:
     ```
     C:\Users\YourName\Documents\WordAddins\
     ```
   - Click **Add catalog**
   - Check the box **Show in Menu**
   - Click **OK** to close all dialogs
   - **Restart Word**

5. **Load the Add-in**
   - In Word, go to **Insert** tab
   - Click **My Add-ins** (far right)
   - Select **SHARED FOLDER** tab
   - Click **OG CLM**
   - The add-in panel should appear on the right side

## Troubleshooting

**Add-in doesn't appear:**
- Verify the manifest.xml is in the correct folder
- Ensure the folder is added to Trusted Add-in Catalogs
- Restart Word completely
- Check Windows Firewall isn't blocking the connection

**"Unable to load add-in":**
- Verify you have internet connection
- The server URL in manifest.xml must be accessible
- Try accessing https://your-app.onrender.com/view.html in a browser first
````

### Mac Installation Instructions (`INSTALL-MAC.md`)

````markdown
# Installing OG CLM Word Add-in (Mac)

## Prerequisites
- Microsoft Word 2016 or later for Mac
- macOS 10.12 or later

## Installation Steps

1. **Download the manifest file**
   - Save `manifest.xml` to your computer
   - Recommended location: `~/Library/Containers/com.microsoft.Word/Data/Documents/wef/`

2. **Create the Add-in Folder** (if it doesn't exist)
   ```bash
   mkdir -p ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/
   ```

3. **Copy the Manifest**
   ```bash
   cp manifest.xml ~/Library/Containers/com.microsoft.Word/Data/Documents/wef/
   ```

4. **Open Word**
   - Launch Microsoft Word
   - Create a new blank document

5. **Load the Add-in**
   - Go to **Insert** tab
   - Click **My Add-ins** dropdown
   - The OG CLM add-in should appear in the list
   - Click it to load
   - The add-in panel should appear on the right side

## Alternative: Manual Sideload

If the add-in doesn't appear automatically:

1. **Open Add-ins Dialog**
   - Insert → My Add-ins
   - Click on **User Add-ins** section

2. **Upload Manifest**
   - Some Mac versions allow direct manifest upload
   - Click **Upload My Add-in**
   - Select your `manifest.xml` file

## Troubleshooting

**Add-in doesn't appear:**
- Verify manifest.xml is in correct location
- Restart Word completely
- Clear Office cache:
  ```bash
  rm -rf ~/Library/Containers/com.microsoft.Word/Data/Library/Caches/*
  ```

**"Unable to load add-in":**
- Verify internet connection
- Try accessing https://your-app.onrender.com/view.html in Safari first
- Check Console.app for any error messages from Word
````

---

## Step 3: Host Distribution Files

### Option A: Direct Download from Render

1. **Create a landing page** (`server/public/download.html`):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Download OG CLM Word Add-in</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .download-btn { background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        .download-btn:hover { background: #0052a3; }
        .instructions { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>OG CLM Word Add-in</h1>
    <p>Install the Contract Lifecycle Management add-in for Microsoft Word.</p>
    
    <h2>Download</h2>
    <a href="/manifest.xml" class="download-btn" download>Download manifest.xml</a>
    
    <div class="instructions">
        <h3>Installation Instructions</h3>
        <p><strong>Windows:</strong> Save the manifest.xml file and follow <a href="/docs/install-windows.html">these instructions</a>.</p>
        <p><strong>Mac:</strong> Save the manifest.xml file and follow <a href="/docs/install-mac.html">these instructions</a>.</p>
    </div>
    
    <h2>System Requirements</h2>
    <ul>
        <li>Microsoft Word 2016 or later</li>
        <li>Windows 10+ or macOS 10.12+</li>
        <li>Internet connection</li>
    </ul>
    
    <h2>Support</h2>
    <p>For issues, contact your administrator or visit the <a href="/">web application</a>.</p>
</body>
</html>
```

2. **Share the URL** with users:
   ```
   https://your-app.onrender.com/download.html
   ```

### Option B: Email Distribution

Create a distribution email with:
- Attached `manifest.xml` (renamed to `og-clm-manifest.xml` for clarity)
- PDF installation guide
- Link to web version for testing: `https://your-app.onrender.com/view.html`

---

## Step 4: Test the Distribution

Before distributing to users:

1. **Test on a clean machine**:
   - Use a VM or ask a colleague
   - Follow installation instructions exactly
   - Verify add-in loads and connects

2. **Test key features**:
   - Open a document
   - Check checkout/checkin
   - Verify messaging works
   - Test variable insertion

3. **Check network requirements**:
   - Ensure Render URL is accessible from corporate network
   - Verify no firewall blocks
   - Test on corporate VPN if applicable

---

## Security & Compliance

### For IT Administrators

**Add to AppSource (Enterprise):**
- For broader distribution, consider publishing to Microsoft AppSource
- Requires Microsoft Partner account
- Full documentation: https://docs.microsoft.com/en-us/office/dev/add-ins/publish/publish

**Network Requirements:**
- Allow HTTPS traffic to: `your-app.onrender.com`
- Ports: 443 (HTTPS)
- No special firewall rules needed

**Data Privacy:**
- All document processing happens server-side at your Render deployment
- No third-party services except Render hosting
- LLM processing can use local Ollama (no external API calls)

---

## Updating the Add-in

When you update the add-in:

1. **Increment version** in `manifest.xml`:
   ```xml
   <Version>1.0.2.0</Version>
   ```

2. **Push to Render**:
   ```bash
   git commit -am "Update add-in to v1.0.2"
   git push origin deployment
   # Render auto-deploys on push
   ```

3. **Users will automatically get updates** (as long as manifest URL stays the same)

---

## What You Need to Do (Summary)

1. ✅ **Update `manifest.production.xml`** with your Render URL
2. ✅ **Copy to `server/public/manifest.xml`**
3. ✅ **Create installation guides** (INSTALL-WINDOWS.md, INSTALL-MAC.md)
4. ✅ **Create download landing page** (optional)
5. ✅ **Test on clean machine**
6. ✅ **Distribute manifest.xml** + instructions to users

---

## Quick Distribution Checklist

- [ ] Render deployment is live and accessible
- [ ] Manifest URLs updated with Render domain
- [ ] Manifest hosted at `your-app.onrender.com/manifest.xml`
- [ ] Installation instructions written
- [ ] Tested on Windows
- [ ] Tested on Mac
- [ ] Download page created (optional)
- [ ] Ready to distribute to users

