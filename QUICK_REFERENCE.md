# 🎯 Quick Reference: Saved Searches + Notifications

## 🚀 Quick Start

### Save a Job Search (3 steps)

1. Go to LinkedIn job search page
2. Click extension icon → "💾 Save Current Search"
3. Enter name → Done!

### Enable Notifications (3 steps)

1. Right-click extension → Options
2. Scroll to "Notifications" → Check "Enable"
3. Click "Allow" in browser prompt → Done!

---

## 📍 Where to Find Things

### **Popup (Click Extension Icon)**

- View saved searches
- Save current search
- Run searches quickly
- Delete searches

### **Options Page (Right-click → Options)**

- Manage searches (add/edit/delete)
- Configure notifications (on/off/interval)
- Test notifications
- View stats

---

## 🔧 Quick Fixes

### "Can't save search"

→ Are you on LinkedIn job search page?  
→ Have you reached 2-search limit?

### "No notification"

→ Did you enable notifications?  
→ Did you allow browser permission?  
→ Try "Send Test Notification"

### "Extension broke"

→ Reload extension: `chrome://extensions/` → Reload  
→ Check console for errors (F12)

---

## 📊 Limits

- **Max saved searches:** 2
- **Min notification interval:** 15 minutes
- **Max notification interval:** 120 minutes
- **Storage per search:** ~1KB

---

## 🎨 Icons Reference

- 🔖 = Saved Searches
- 🔔 = Notifications
- ▶ = Run Search
- ✕ = Delete
- 💾 = Save
- ⚙️ = Settings
- 📊 = Statistics

---

## ⌨️ Console Commands

```javascript
// View all data
chrome.storage.local.get(null, console.log);

// View searches
chrome.storage.local.get(["saved_job_searches"], console.log);

// Reset everything
chrome.storage.local.remove(["saved_job_searches", "notification_settings"]);
chrome.alarms.clearAll();
```

---

## ✅ Checklist for Users

- [ ] Saved at least 1 search
- [ ] Tested running a search
- [ ] Enabled notifications
- [ ] Allowed browser permission
- [ ] Tested test notification
- [ ] Configured check interval
- [ ] Verified existing features still work

---

## 🆘 Need Help?

1. Read `TESTING_SAVED_SEARCHES.md` for detailed guide
2. Read `IMPLEMENTATION_COMPLETE_SAVED_SEARCHES.md` for full docs
3. Check extension console (F12) for errors
4. Inspect service worker: `chrome://extensions/` → "Inspect service worker"

---

**Quick Tip:** Notifications are OFF by default. You must enable them manually in Options page!
