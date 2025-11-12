# Mac Word Add-in Sideloading Guide

## How to sideload a Word add-in on Mac

### 1. Prepare your add-in manifest

Create an XML manifest file (e.g., `manifest.xml`) that describes your add-in. This includes:
- `<Id>` (GUID for your add-in)
- `<Version>`
- `<ProviderName>`
- `<DefaultLocale>`
- `<SourceLocation>` (URL to your add-in's HTML/JS app)

Note: On Mac, only **add-in only manifests** are supported for sideloading. Unified manifests won't work.

### 2. Locate the sideload folder

On macOS, Office looks for sideloaded manifests in a specific folder:

**For sandboxed Word (modern installations):**
```
~/Library/Containers/com.microsoft.Word/Data/Documents/wef
```

**For non-sandboxed Word (legacy installations):**
```
~/Library/Application Support/Microsoft/Office/16.0/wef
```

If the `wef` folder doesn't exist, create it manually.

### 3. Place your manifest

Copy your `manifest.xml` file into the `wef` folder.

### 4. Launch Word and load the add-in

- Open Word
- Go to **Insert → My Add-ins → Shared Folder**
- Your sideloaded add-in should appear here
- Select it to load

### 5. Debugging notes

- On Mac, sideloading lets you test the UI and behavior
- You cannot attach a debugger directly (no breakpoints)
- Use `console.log` and browser dev tools (via Safari Web Inspector) to debug

## Packaging your add-in (Mac)

If you want to create a distributable package:

### 1. Bundle your web app
- Use a bundler (Webpack, Parcel, or just static files)
- Host it locally or on a web server

### 2. Manifest + assets
- Keep your `manifest.xml` alongside your app files
- Update `<SourceLocation>` to point to your hosted app

### 3. Zip package
Create a `.zip` containing:
- `manifest.xml`
- Your app files (HTML, JS, CSS, images)

### 4. Distribute
- **For internal testing:** Share the `.zip` and instruct users to place the manifest in the `wef` folder
- **For production:** Submit to [Microsoft AppSource](https://appsource.microsoft.com)

## Example folder structure

```
my-word-addin/
├── manifest.xml
├── index.html
├── script.js
├── style.css
└── assets/
```

Zip this folder when packaging.

## Key differences from Windows

- **Mac:** Copy manifest to `wef` folder
- **Windows:** Register via registry key `HKCU\Software\Microsoft\Office\16.0\WEF\Developer`
- **Mac sandboxing:** Modern Mac Word is sandboxed and can only read from specific directories
- **No preferences method:** The `defaults write` method does not work for sandboxed Word

## Detecting sandboxed vs. non-sandboxed Word

Check if this directory exists:
```bash
~/Library/Containers/com.microsoft.Word/
```

If it exists → use sandboxed location (`Containers/.../wef`)  
If it doesn't → use non-sandboxed location (`Application Support/.../wef`)

## References

- [Microsoft Official Documentation](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)

