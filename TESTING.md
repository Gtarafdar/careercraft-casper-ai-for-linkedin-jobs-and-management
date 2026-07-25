# Testing Guide - LinkedIn Text Formatter & Image Upload

## Pre-Testing Checklist

Before you begin testing, ensure:

- [ ] Extension is loaded in Chrome (`chrome://extensions/`)
- [ ] Developer mode is enabled
- [ ] Extension shows as "Enabled"
- [ ] You're logged into LinkedIn
- [ ] Console is open (F12) to see debug messages

## Test Suite

### 1. Extension Loading Tests

#### Test 1.1: Extension Loads

1. Navigate to `chrome://extensions/`
2. **Expected**: Extension appears in list with no errors
3. **Status**: ☐ Pass ☐ Fail

#### Test 1.2: Permissions Granted

1. Check extension details
2. **Expected**: All permissions are active (activeTab, clipboardRead, storage)
3. **Status**: ☐ Pass ☐ Fail

### 2. Toolbar Injection Tests

#### Test 2.1: Toolbar Appears on Post Creation

1. Go to LinkedIn feed
2. Click "Start a post"
3. **Expected**: Toolbar appears above the text editor within 1 second
4. **Console**: Should see "LinkedIn Formatter: Editor detected"
5. **Status**: ☐ Pass ☐ Fail

#### Test 2.2: Toolbar Appears on Comment

1. Find any post
2. Click "Comment"
3. **Expected**: Toolbar may or may not appear (depends on LinkedIn's DOM structure)
4. **Note**: Extension primarily targets main post editor
5. **Status**: ☐ Pass ☐ Fail ☐ N/A

#### Test 2.3: Toolbar Positioning

1. Open post editor
2. **Expected**: Toolbar appears directly above the text input area
3. **Expected**: Toolbar doesn't overlap with existing LinkedIn UI
4. **Status**: ☐ Pass ☐ Fail

#### Test 2.4: Toolbar Cleanup

1. Open post editor
2. Click the X to close the modal
3. **Expected**: Toolbar is removed
4. **Console**: Should see "LinkedIn Formatter: Cleaned up"
5. **Status**: ☐ Pass ☐ Fail

### 3. Text Formatting Tests

#### Test 3.1: Bold Formatting

1. Open post editor
2. Type: "This is a test"
3. Select "test"
4. Click Bold (𝐁) button
5. **Expected**: "test" changes to "𝐭𝐞𝐬𝐭"
6. **Status**: ☐ Pass ☐ Fail

#### Test 3.2: Italic Formatting

1. Type and select text
2. Click Italic (𝐼) button
3. **Expected**: Text converts to italic Unicode
4. **Status**: ☐ Pass ☐ Fail

#### Test 3.3: Underline Formatting

1. Type and select text
2. Click Underline (U̲) button
3. **Expected**: Text gets underline combining characters
4. **Status**: ☐ Pass ☐ Fail

#### Test 3.4: Strikethrough Formatting

1. Type and select text
2. Click Strikethrough (S̶) button
3. **Expected**: Text gets strikethrough combining characters
4. **Status**: ☐ Pass ☐ Fail

#### Test 3.5: Format Without Selection

1. Click any format button without selecting text
2. **Expected**: Notification appears: "Please select text to format"
3. **Status**: ☐ Pass ☐ Fail

#### Test 3.6: Format Empty Selection

1. Click in editor (no text)
2. Click format button
3. **Expected**: Notification appears
4. **Status**: ☐ Pass ☐ Fail

### 4. Typography Tests

#### Test 4.1: Typography Dropdown Opens

1. Click "Aa" button
2. **Expected**: Dropdown menu appears with 11 styles
3. **Status**: ☐ Pass ☐ Fail

#### Test 4.2: Typography Dropdown Closes

1. Open typography dropdown
2. Click outside the dropdown
3. **Expected**: Dropdown closes
4. **Status**: ☐ Pass ☐ Fail

#### Test 4.3: Bold Sans Style

1. Select text
2. Click "Aa" → "𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀"
3. **Expected**: Text converts to bold sans-serif Unicode
4. **Status**: ☐ Pass ☐ Fail

#### Test 4.4: Script Style

1. Select text
2. Click "Aa" → "𝒮𝒸𝓇𝒾𝓅𝓉"
3. **Expected**: Text converts to script Unicode
4. **Status**: ☐ Pass ☐ Fail

#### Test 4.5: All Typography Styles

Test each style individually:

- [ ] Bold Serif (𝐁𝐨𝐥𝐝 𝐒𝐞𝐫𝐢𝐟)
- [ ] Bold Sans (𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀)
- [ ] Italic Serif (𝐼𝑡𝑎𝑙𝑖𝑐 𝑆𝑒𝑟𝑖𝑓)
- [ ] Italic Sans (𝘐𝘵𝘢𝘭𝘪𝘤 𝘚𝘢𝘯𝘀)
- [ ] Bold Italic (𝑵𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄)
- [ ] Script (𝒮𝒸𝓇𝒾𝓅𝓉)
- [ ] Fraktur (𝔉𝔯𝔞𝔨𝔱𝔲𝔯)
- [ ] Monospace (𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎)
- [ ] Double Struck (𝔻𝕠𝕦𝕓𝕝𝕖 𝕊𝕥𝕣𝕦𝕔𝕜)
- [ ] Circled (Ⓒⓘⓡⓒⓛⓔⓓ)
- [ ] Squared (🅂🅀🅄🄰🅁🄴🄳)

### 5. List Formatting Tests

#### Test 5.1: Bullet List - Single Line

1. Type: "Item one"
2. Select the text
3. Click bullet (•) button
4. **Expected**: "• Item one"
5. **Status**: ☐ Pass ☐ Fail

#### Test 5.2: Bullet List - Multiple Lines

1. Type:
   ```
   First item
   Second item
   Third item
   ```
2. Select all lines
3. Click bullet button
4. **Expected**:
   ```
   • First item
   • Second item
   • Third item
   ```
5. **Status**: ☐ Pass ☐ Fail

#### Test 5.3: Numbered List

1. Type multiple lines
2. Select all
3. Click number (1.) button
4. **Expected**: Lines numbered 1., 2., 3., etc.
5. **Status**: ☐ Pass ☐ Fail

### 6. Link and Emoji Tests

#### Test 6.1: Insert Link with Selected Text

1. Type and select "Click here"
2. Click link (🔗) button
3. Enter URL in prompt: "https://example.com"
4. **Expected**: "Click here (https://example.com)"
5. **Status**: ☐ Pass ☐ Fail

#### Test 6.2: Insert Link without Selection

1. Click link button without selecting text
2. Enter URL and link text in prompts
3. **Expected**: Link inserted at cursor
4. **Status**: ☐ Pass ☐ Fail

#### Test 6.3: Emoji Insertion

1. Click emoji (😊) button
2. Enter an emoji in the prompt
3. **Expected**: Emoji inserted at cursor position
4. **Status**: ☐ Pass ☐ Fail

### 7. Clipboard Image Tests

#### Test 7.1: Paste Image from Screenshot

**Windows**:

1. Press `Win + Shift + S` to take screenshot
2. Select an area
3. Click in LinkedIn editor
4. Press `Ctrl + V`

**Mac**:

1. Press `Cmd + Shift + 4` to take screenshot
2. Select an area
3. Click in LinkedIn editor
4. Press `Cmd + V`

**Expected**:

- Console shows "LinkedIn Formatter: Image detected in clipboard"
- Console shows "LinkedIn Formatter: Processing image upload"
- Image appears in the post editor
- Notification: "Image uploaded successfully!"

**Status**: ☐ Pass ☐ Fail

#### Test 7.2: Paste Image from Web

1. Right-click any image online
2. Select "Copy image"
3. Click in LinkedIn editor
4. Paste (`Ctrl+V` / `Cmd+V`)
5. **Expected**: Image uploads
6. **Status**: ☐ Pass ☐ Fail

#### Test 7.3: Paste Image from File Explorer

1. Open File Explorer/Finder
2. Find an image file
3. Right-click → Copy
4. Paste in LinkedIn editor
5. **Expected**: May or may not work (depends on how the OS copies files)
6. **Status**: ☐ Pass ☐ Fail ☐ N/A

#### Test 7.4: Paste Text (Should Not Interfere)

1. Copy regular text from anywhere
2. Paste in LinkedIn editor
3. **Expected**: Text pastes normally, no interference from extension
4. **Status**: ☐ Pass ☐ Fail

### 8. UI/UX Tests

#### Test 8.1: Toolbar Responsiveness

1. Resize browser window to narrow width
2. **Expected**: Toolbar buttons remain accessible
3. **Status**: ☐ Pass ☐ Fail

#### Test 8.2: Button Hover Effects

1. Hover over each button
2. **Expected**: Button changes color (blue highlight)
3. **Status**: ☐ Pass ☐ Fail

#### Test 8.3: Button Tooltips

1. Hover over buttons
2. **Expected**: Tooltip appears showing button function
3. **Status**: ☐ Pass ☐ Fail

#### Test 8.4: Dropdown Overflow

1. Open typography dropdown
2. **Expected**: If list is long, scrollbar appears
3. **Status**: ☐ Pass ☐ Fail

#### Test 8.5: Notification Visibility

1. Trigger any notification
2. **Expected**: Notification appears bottom-right, fades in/out
3. **Status**: ☐ Pass ☐ Fail

### 9. Popup Tests

#### Test 9.1: Popup Opens

1. Click extension icon in Chrome toolbar
2. **Expected**: Popup window opens showing extension info
3. **Status**: ☐ Pass ☐ Fail

#### Test 9.2: Popup Content

1. Open popup
2. **Expected**: Shows version, features, instructions, and status
3. **Status**: ☐ Pass ☐ Fail

### 10. Edge Cases

#### Test 10.1: Multiple Post Editors

1. Open two LinkedIn tabs
2. Open post editor in both
3. **Expected**: Toolbar appears in both independently
4. **Status**: ☐ Pass ☐ Fail

#### Test 10.2: Rapid Open/Close

1. Rapidly open and close post editor 5 times
2. **Expected**: No errors, toolbar always appears/disappears correctly
3. **Status**: ☐ Pass ☐ Fail

#### Test 10.3: Long Text Formatting

1. Type a very long paragraph (500+ characters)
2. Select all and format
3. **Expected**: All text formats correctly without lag
4. **Status**: ☐ Pass ☐ Fail

#### Test 10.4: Special Characters

1. Type text with emojis and special characters: "Hello 👋 世界 @user #hashtag"
2. Select and format
3. **Expected**: Text formats, special characters preserved where possible
4. **Status**: ☐ Pass ☐ Fail

#### Test 10.5: Format Already Formatted Text

1. Format text as bold
2. Select the bold text again
3. Format as italic
4. **Expected**: Text applies new formatting (may lose previous depending on Unicode)
5. **Status**: ☐ Pass ☐ Fail

### 11. Performance Tests

#### Test 11.1: Page Load Impact

1. Open LinkedIn with extension disabled
2. Note page load time
3. Enable extension
4. Reload LinkedIn
5. **Expected**: No noticeable difference in load time
6. **Status**: ☐ Pass ☐ Fail

#### Test 11.2: Memory Usage

1. Open Chrome Task Manager (Shift+Esc)
2. Check extension memory usage
3. **Expected**: Should be minimal (< 10 MB)
4. **Status**: ☐ Pass ☐ Fail

### 12. Console Tests

#### Test 12.1: No Console Errors

1. Open Console (F12)
2. Use all extension features
3. **Expected**: No red error messages related to the extension
4. **Status**: ☐ Pass ☐ Fail

#### Test 12.2: Debug Messages

1. Open Console
2. Open post editor
3. **Expected**: See initialization and debug messages:
   - "LinkedIn Formatter: Initializing..."
   - "LinkedIn Formatter: Editor detected"
   - "LinkedIn Formatter: Injecting toolbar"
4. **Status**: ☐ Pass ☐ Fail

## Browser Compatibility

Test in different Chrome-based browsers:

- [ ] Google Chrome (latest)
- [ ] Google Chrome (one version older)
- [ ] Microsoft Edge (Chromium)
- [ ] Brave Browser
- [ ] Opera

## Testing Checklist Summary

### Critical Features (Must Pass)

- [ ] Toolbar appears on post creation
- [ ] At least one text format works (bold)
- [ ] Clipboard image paste works
- [ ] No console errors

### Important Features (Should Pass)

- [ ] All text formats work
- [ ] Typography styles work
- [ ] Lists format correctly
- [ ] Toolbar cleans up properly

### Nice to Have (Can Fail)

- [ ] Emoji picker
- [ ] Link formatting
- [ ] All edge cases pass

## Reporting Issues

When you find a bug, record:

1. **Test number**: e.g., "Test 3.1: Bold Formatting"
2. **Steps taken**: What you did
3. **Expected result**: What should have happened
4. **Actual result**: What actually happened
5. **Console errors**: Any error messages
6. **Screenshot**: If applicable

## Post-Testing

After testing:

1. Document all failing tests
2. Fix critical issues first
3. Verify fixes with retesting
4. Update documentation if needed

---

**Testing completed on**: ********\_********
**Tester name**: ********\_********
**Chrome version**: ********\_********
**Pass rate**: **\_** / **\_** tests
