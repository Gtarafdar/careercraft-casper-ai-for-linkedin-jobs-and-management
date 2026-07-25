# 🧪 Testing Guide: Saved Job Searches + Notifications

## ✅ Pre-Flight Checklist

### 1. Load Extension

- Open Chrome: `chrome://extensions/`
- Enable "Developer mode" (top right)
- Click "Load unpacked"
- Select extension folder
- Verify no errors in console

### 2. Verify Permissions

- Extension should request: notifications, alarms
- Click "Allow" if prompted

---

## 📋 Test Plan

### **TEST 1: Saved Searches - Save from LinkedIn**

**Steps:**

1. Go to `linkedin.com/jobs/search`
2. Add search criteria (keywords: "Software Engineer", location: "San Francisco")
3. Click extension icon (top right)
4. Verify "Save Current Search" button visible
5. Click "Save Current Search"
6. Enter name: "SF Software Jobs"
7. Click OK
8. Verify success message

**Expected:**

- ✅ Search saved successfully
- ✅ Shows "1/2 slots used"
- ✅ Search visible in list with Run and Delete buttons

---

### **TEST 2: Saved Searches - Run from Popup**

**Steps:**

1. Open extension popup
2. Click "▶ Run" on saved search
3. Verify LinkedIn opens in new tab with correct search

**Expected:**

- ✅ Opens exact LinkedIn search URL
- ✅ Run count increments
- ✅ Last run timestamp updates

---

### **TEST 3: Saved Searches - Delete from Popup**

**Steps:**

1. Open extension popup
2. Click "✕" delete button
3. Confirm deletion
4. Verify search removed

**Expected:**

- ✅ Confirmation dialog appears
- ✅ Search removed from list
- ✅ Slots update: "0/2 slots used"

---

### **TEST 4: Saved Searches - Options Page Management**

**Steps:**

1. Right-click extension → Options
2. Scroll to "Saved Job Searches" section
3. Click "➕ Add New Search"
4. Fill form:
   - Name: "Remote Python Jobs"
   - Keywords: "Python Developer"
   - Location: "Remote"
   - URL: (paste LinkedIn job search URL)
5. Click "Save Search"

**Expected:**

- ✅ Form appears/hides correctly
- ✅ Search saves successfully
- ✅ Table displays with Run and Delete buttons
- ✅ Shows "2/2 slots used"
- ✅ Add button disabled when full

---

### **TEST 5: Saved Searches - 2-Search Limit**

**Steps:**

1. Save 2 searches
2. Try to save 3rd search from popup
3. Verify error message

**Expected:**

- ✅ "Maximum 2 saved searches" error
- ✅ Add button disabled
- ✅ No data corruption

---

### **TEST 6: Notifications - Enable & Configure**

**Steps:**

1. Open Options page
2. Scroll to "Job Search Notifications"
3. Check "Enable Job Notifications"
4. Browser requests permission → Click "Allow"
5. Adjust slider to "15 minutes"
6. Verify settings save

**Expected:**

- ✅ Permission prompt appears
- ✅ "Notification settings saved!" message
- ✅ Stats section enabled (opacity 1)
- ✅ Last checked: Never, Sent: 0

---

### **TEST 7: Notifications - Test Notification**

**Steps:**

1. Options page → Notifications section
2. Click "🔔 Send Test Notification"
3. Check system notifications (top right on macOS, bottom right on Windows)

**Expected:**

- ✅ Browser notification appears
- ✅ Title: "🔔 Test Notification"
- ✅ Message: "Job notifications are working..."
- ✅ No errors in console

---

### **TEST 8: Notifications - Job Check Alarm**

**Steps:**

1. Enable notifications with 15-minute interval
2. Wait 15 minutes
3. Check console in background.js:
   - Right-click extension → "Inspect service worker"
4. Look for "Alarm triggered: Checking for new jobs..."

**Expected:**

- ✅ Alarm fires every 15 minutes
- ✅ Console shows check activity
- ✅ No errors during check

---

### **TEST 9: Notifications - Disable**

**Steps:**

1. Options page
2. Uncheck "Enable Job Notifications"
3. Verify alarm stops

**Expected:**

- ✅ Settings section grayed out (opacity 0.5)
- ✅ Console shows "Notification alarm disabled"
- ✅ No more periodic checks

---

### **TEST 10: Existing Features - No Breaking**

**Steps:**

1. Go to LinkedIn
2. Click "Start a post"
3. Test text formatting (bold, italic)
4. Paste an image
5. View a LinkedIn job page
6. Verify ATS analysis appears

**Expected:**

- ✅ Toolbar appears normally
- ✅ Formatting works
- ✅ Image paste works
- ✅ ATS analysis works
- ✅ Cache system works
- ✅ No console errors

---

### **TEST 11: Options Page - All Features**

**Steps:**

1. Open Options page
2. Verify all sections load:
   - ✅ AI Provider Selection
   - ✅ API Key Management
   - ✅ Cache Management
   - ✅ **Saved Job Searches** (NEW)
   - ✅ **Job Search Notifications** (NEW)
   - ✅ Profile Data

**Expected:**

- ✅ No layout breaking
- ✅ Sections properly spaced
- ✅ All buttons functional
- ✅ No CSS conflicts

---

### **TEST 12: Popup Layout**

**Steps:**

1. Click extension icon
2. Verify sections:
   - ✅ Extension Status
   - ✅ Text Formatting Features
   - ✅ Image Upload
   - ✅ AI-Powered ATS
   - ✅ **Saved Job Searches** (NEW)
   - ✅ Saved Items Filter

**Expected:**

- ✅ No layout overlap
- ✅ Saved Searches section visible
- ✅ Proper spacing
- ✅ Scrollable if needed

---

### **TEST 13: Data Persistence**

**Steps:**

1. Save 2 searches
2. Enable notifications
3. Close Chrome completely
4. Reopen Chrome
5. Open extension popup

**Expected:**

- ✅ Saved searches still there
- ✅ Notification settings preserved
- ✅ Alarm still active
- ✅ Run counts preserved

---

### **TEST 14: Error Handling**

**Steps:**

1. Try saving search with no URL → Error
2. Try saving search with invalid URL → Error
3. Try saving 3rd search → Error
4. Disable notifications then enable without permission → Error

**Expected:**

- ✅ Clear error messages
- ✅ No crashes
- ✅ UI remains functional

---

### **TEST 15: Chrome DevTools - No Warnings**

**Steps:**

1. Open extension
2. Press F12 → Console tab
3. Perform all actions
4. Check for:
   - ❌ No red errors
   - ❌ No yellow warnings (except expected CORS)
   - ❌ No syntax errors

**Expected:**

- ✅ Clean console
- ✅ Only info logs
- ✅ Expected CORS warnings for LinkedIn fetch (normal)

---

## 🔍 Console Commands for Manual Testing

Open Chrome DevTools Console (`F12`) and run:

```javascript
// View saved searches
chrome.storage.local.get(["saved_job_searches"], console.log);

// View notification settings
chrome.storage.local.get(["notification_settings"], console.log);

// View notification job counts
chrome.storage.local.get(["notification_job_counts"], console.log);

// Clear saved searches (reset)
chrome.storage.local.remove("saved_job_searches");

// Clear notification data
chrome.storage.local.remove([
  "notification_settings",
  "notification_job_counts",
  "notification_urls",
]);

// Check alarm status
chrome.alarms.getAll(console.log);
```

---

## 🐛 Known Expected Behaviors

### ✅ CORS Warnings

When notifications check LinkedIn job counts, you'll see:

```
Fetch error (CORS expected): Failed to fetch
```

**This is normal!** LinkedIn blocks fetch requests from extensions. The background worker uses alternative methods.

### ✅ First Check No Notification

The first time the alarm runs, it establishes a baseline job count but doesn't notify. Notifications only appear when the count increases.

### ✅ Zero Job Count

If LinkedIn blocks the fetch request, job count returns 0. The system handles this gracefully by keeping the previous count.

---

## ✅ Success Criteria

### All tests must pass:

- [x] Saved searches: save, run, delete
- [x] 2-search limit enforced
- [x] Options page management works
- [x] Notifications enable/disable
- [x] Test notification works
- [x] Alarm system functional
- [x] Existing features unaffected
- [x] No console errors
- [x] No layout breaking
- [x] Data persistence works

---

## 🚨 If Tests Fail

### Common Issues:

**1. "Cannot read property of undefined"**

- Check console for exact line
- Verify IDs match HTML elements
- Check spelling of element IDs

**2. "Extension context invalidated"**

- Reload extension: `chrome://extensions/` → Reload
- Close all LinkedIn tabs
- Reopen extension

**3. Notifications not appearing**

- Check browser settings: chrome://settings/content/notifications
- Verify extension has notification permission
- Try test notification first

**4. Alarm not firing**

- Check: `chrome.alarms.getAll(console.log)`
- Verify notifications enabled
- Check "Inspect service worker" console logs

**5. Layout breaking**

- Clear browser cache
- Hard reload: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Check CSS conflicts in DevTools

---

## 📊 Performance Checks

### Memory Usage

- Extension should use < 50MB RAM
- No memory leaks after 1 hour use

### CPU Usage

- Idle: < 1% CPU
- During alarm check: Brief spike < 5%
- No sustained high CPU usage

### Storage

- Saved searches: ~1-2KB
- Notification data: ~1-2KB
- Total storage: < 5MB

---

## ✅ Final Verification

After all tests pass, verify:

1. ✅ Extension loads without errors
2. ✅ All 2 new features work
3. ✅ All 6 existing features work
4. ✅ Console is clean
5. ✅ No layout issues
6. ✅ Data persists across sessions
7. ✅ Performance is acceptable

**If all checks pass → IMPLEMENTATION SUCCESSFUL! 🎉**
