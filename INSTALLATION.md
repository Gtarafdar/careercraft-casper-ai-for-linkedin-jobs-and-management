# Installation Guide - LinkedIn Text Formatter & Image Upload

## Quick Start (5 Minutes)

Follow these simple steps to install the extension in Chrome:

### Step 1: Download the Extension

1. Locate the extension folder on your computer:
   ```
   /Users/gtarafdar/Downloads/Linkedin Text Formater and Image Uploder
   ```

### Step 2: Open Chrome Extensions

1. Open **Google Chrome** browser
2. Type or paste this in the address bar and press Enter:

   ```
   chrome://extensions/
   ```

   **OR**

   - Click the three dots menu (⋮) in the top-right corner
   - Go to: **More Tools** → **Extensions**

### Step 3: Enable Developer Mode

1. Look for the **"Developer mode"** toggle in the top-right corner
2. Click it to turn it **ON** (it should be blue/enabled)

### Step 4: Load the Extension

1. Click the **"Load unpacked"** button (appears after enabling Developer mode)
2. In the file browser that opens, navigate to:
   ```
   /Users/gtarafdar/Downloads/Linkedin Text Formater and Image Uploder
   ```
3. Click **"Select Folder"** or **"Open"**

### Step 5: Verify Installation

✅ You should now see the extension in your list with:

- Name: "LinkedIn Text Formatter & Image Upload"
- Version: 1.0.0
- Status: Enabled (toggle switch is blue)

### Step 6: Test on LinkedIn

1. Open a new tab and go to: [https://www.linkedin.com](https://www.linkedin.com)
2. Click **"Start a post"** from your feed
3. You should see the formatting toolbar appear above the text editor! 🎉

## Troubleshooting Installation

### ❌ Error: "Manifest file is missing or unreadable"

**Solution**: Make sure you selected the correct folder that contains `manifest.json`

### ❌ Error: "Failed to load extension"

**Solutions**:

1. Check that all files are present:

   - `manifest.json`
   - `content/content.js`
   - `styles/toolbar.css`
   - `popup/popup.html`

2. Verify file permissions - Chrome must be able to read the files

### ❌ Toolbar not appearing on LinkedIn

**Solutions**:

1. Refresh the LinkedIn page (F5 or Ctrl+R)
2. Close and reopen the post modal
3. Check that the extension is enabled in `chrome://extensions/`
4. Open Developer Tools (F12) and check Console for errors

### ❌ Icons not showing

**Note**: The extension will work without custom icons. The current version uses emoji and Unicode characters. To add custom icons:

1. Create three PNG files:

   - `icons/icon16.png` (16x16 pixels)
   - `icons/icon48.png` (48x48 pixels)
   - `icons/icon128.png` (128x128 pixels)

2. Place them in an `icons` folder in the extension directory

## Updating the Extension

After making any changes to the extension:

1. Go to `chrome://extensions/`
2. Find "LinkedIn Text Formatter & Image Upload"
3. Click the **refresh icon (⟳)** button
4. Reload any open LinkedIn tabs

## Uninstalling

To remove the extension:

1. Go to `chrome://extensions/`
2. Find "LinkedIn Text Formatter & Image Upload"
3. Click **"Remove"**
4. Confirm removal

## Next Steps

Once installed, check out the [README.md](README.md) for:

- Complete feature list
- Usage instructions
- Keyboard shortcuts
- Tips and tricks

---

**Need Help?**

- Check the console (F12) for error messages
- Make sure you're on linkedin.com
- Ensure the extension is enabled
