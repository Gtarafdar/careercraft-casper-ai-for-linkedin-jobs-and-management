# Quick Test Guide - Version 1.1.0

## Reload Extension First!

1. Go to `chrome://extensions/`
2. Find "LinkedIn Text Formatter & Image Upload"
3. Click the refresh/reload icon (⟳)
4. Go to LinkedIn and refresh the page (F5)

---

## Test Each Fix

### Test 1: Tooltips Not Cropped ✅

**Steps**:

1. Open LinkedIn post editor
2. Hover over each toolbar button
3. **Expected**: Full tooltip appears above button, not cut off

**Pass**: ☐ All tooltips fully visible

---

### Test 2: Image Paste Works ✅

**Test 2a - Screenshot Paste**:

1. Take a screenshot (Win+Shift+S or Cmd+Shift+4)
2. Click in LinkedIn post editor
3. Paste (Ctrl+V or Cmd+V)
4. **Expected**: Image uploads automatically

**Pass**: ☐ Screenshot paste works

**Test 2b - Paste Without Image Button**:

1. Copy any image from web (right-click → Copy image)
2. Paste in editor WITHOUT clicking image button first
3. **Expected**: Extension clicks button automatically, then uploads
4. May see brief notification

**Pass**: ☐ Auto-click fallback works

---

### Test 3: Bold No Extra Spaces ✅

**Steps**:

1. Type: "This is a test"
2. Select "test"
3. Click Bold button (𝐁)
4. **Expected**: "This is a 𝐭𝐞𝐬𝐭" (no extra line breaks or spaces)
5. Continue typing after the bold text
6. **Expected**: No weird spacing

**Pass**: ☐ Bold formatting clean, no extra spaces

---

### Test 4: Underline Works ✅

**Steps**:

1. Type: "underline test"
2. Select "underline test"
3. Click Underline button (U̲)
4. **Expected**: u̲n̲d̲e̲r̲l̲i̲n̲e̲ ̲t̲e̲s̲t̲

**Pass**: ☐ Underline displays correctly

---

### Test 5: Strikethrough Works ✅

**Steps**:

1. Type: "strikethrough test"
2. Select "strikethrough test"
3. Click Strikethrough button (S̶)
4. **Expected**: s̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ ̶t̶e̶s̶t̶

**Pass**: ☐ Strikethrough displays correctly

---

### Test 6: Emoji Doesn't Replace Text ✅

**Steps**:

1. Type: "Hello World"
2. Click cursor between "Hello" and "World"
3. Click Emoji button (😊)
4. Enter an emoji (e.g., 🎉)
5. **Expected**: "Hello 🎉 World" (emoji inserted, not replaced)

**Pass**: ☐ Emoji inserts without replacing

---

### Test 7: Undo Works ✅

**Steps**:

1. Type some text
2. Format it (bold, italic, etc.)
3. Click Undo button (↶)
4. **Expected**: Formatting removed
5. Click Undo again
6. **Expected**: Previous state restored

**Pass**: ☐ Undo works correctly

---

### Test 8: Redo Works ✅

**Steps**:

1. After undoing (Test 7)
2. Click Redo button (↷)
3. **Expected**: Undone action restored
4. Click Redo again
5. **Expected**: Next redo applied

**Pass**: ☐ Redo works correctly

---

### Test 9: Clear Formatting Works ✅

**Steps**:

1. Type: "Bold Text"
2. Select "Bold Text"
3. Click Bold button
4. Result: "𝐁𝐨𝐥𝐝 𝐓𝐞𝐱𝐭"
5. Select the bold text
6. Click Clear Formatting button (✕)
7. **Expected**: "Bold Text" (back to normal)

**Pass**: ☐ Clear formatting works

---

### Test 10: Multiple Operations ✅

**Steps**:

1. Type a paragraph
2. Format different parts (bold, italic, underline)
3. Undo 3 times
4. Redo 2 times
5. Add emoji
6. Clear formatting on one section
7. **Expected**: All operations work smoothly, no errors

**Pass**: ☐ Complex operations work

---

### Test 11: Console Check ✅

**Steps**:

1. Press F12 to open console
2. Perform all above tests
3. **Expected**: No red errors related to the extension
4. May see blue "LinkedIn Formatter:" messages (these are OK)

**Pass**: ☐ No console errors

---

## Quick Checklist

- [ ] Tooltips fully visible
- [ ] Image paste works (screenshot)
- [ ] Image paste works (web image)
- [ ] Bold formats cleanly
- [ ] Underline works
- [ ] Strikethrough works
- [ ] Emoji inserts (doesn't replace)
- [ ] Undo button works
- [ ] Redo button works
- [ ] Clear formatting works
- [ ] No console errors

---

## If Something Fails

1. **Check Console** (F12) for error messages
2. **Reload Extension**: `chrome://extensions/` → Reload
3. **Refresh LinkedIn**: Press F5
4. **Clear Cache**: Ctrl+Shift+Delete
5. **Try Incognito**: Test in incognito mode
6. **Check BUGFIXES.md**: Review known limitations

---

## Report Issues

If you find a bug:

1. Note which test failed
2. Screenshot the issue
3. Copy console errors (F12)
4. Note Chrome version (`chrome://version/`)
5. Describe exact steps to reproduce

---

**Testing Time**: ~5 minutes for full suite
**Critical Tests**: Tests 3, 4, 5, 7, 8 (the fixes)

Happy testing! 🎉
