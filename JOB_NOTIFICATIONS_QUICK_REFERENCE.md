# Job Notifications - Quick Reference Card

## 🎯 How It Works (Simple Version)

### First Check

1. Extension visits your saved search on LinkedIn
2. Records total job count (e.g., **1,000 jobs**)
3. This is your **baseline** ✅
4. **No notification sent yet** (just setting up)

### Second Check Onwards

1. Extension checks again after your chosen interval
2. Compares new count to baseline
3. If increased (e.g., **1,005 jobs**):
   - 📬 Notification: **"5 New Jobs Found - Search: Your Search Name"**
   - ✅ Baseline updated to 1,005
4. If same or decreased:
   - ℹ️ No notification (logged in Activity Logs)
   - ✅ Baseline updated if decreased

---

## ⚙️ Quick Setup

1. **Save your job searches** (up to 2)

   - Go to LinkedIn, create/filter your search
   - Copy the URL
   - Paste in Settings → Job Search URLs

2. **Enable notifications**

   - Settings → Job Search Notifications
   - Toggle ON ✅
   - Choose check frequency (30 min recommended)

3. **Test it**
   - Click "Send Test Notification" to verify browser permissions
   - Click "Check for Jobs Now" to establish baseline
   - Wait for second check to start receiving real alerts

---

## 🔔 Notification Format

```
🔔 5 New Jobs Found
Search: "Senior Python Developer Remote"
1,005 total jobs available now

[View Jobs] ← Click to open search on LinkedIn
```

---

## 📊 What Gets Logged

Every check is recorded in Activity Logs:

- ✅ **"Baseline established for 'Search Name': 1,000 jobs"**  
  First check - no notification yet

- ✅ **"New jobs for 'Search Name': 5 new (1,005 total)"**  
  Found 5 new jobs, notification sent

- ℹ️ **"Check complete - No new jobs (checked 2 searches)"**  
  No changes detected in any search

- ⚠️ **"Failed to extract job count for 'Search Name'"**  
  Extraction error - check if URL is valid

---

## ⏱️ Check Frequency Guide

| Frequency  | Best For                     | LinkedIn Requests     |
| ---------- | ---------------------------- | --------------------- |
| 15 min     | Highly competitive roles     | High (96/day)         |
| **30 min** | **Most users (recommended)** | **Moderate (48/day)** |
| 1 hour     | Niche/specific searches      | Low (24/day)          |
| 2 hours    | Very specific criteria       | Minimal (12/day)      |

---

## 🚨 Common Issues & Quick Fixes

### "No new jobs" but jobs exist on LinkedIn

**Why:** Baseline not set yet (first check) OR jobs posted before last check  
**Fix:** Wait for second check OR click "Check for Jobs Now"

### No notifications appearing

**Why:** Browser notifications blocked OR no new jobs  
**Fix:** Click "Send Test Notification" → Check browser/OS settings

### Baseline shows only ~25 jobs

**Why:** Old bug (fixed in latest version)  
**Fix:** Click "Check for Jobs Now" to re-establish baseline

### Don't know which search triggered notification

**Look at notification message:** It says **"Search: Your Search Name"**  
**Check Activity Logs:** Shows per-search results

---

## 🎓 Key Concepts

### Baseline

The **reference count** used to detect new jobs. Set on first check, updated after each check.

### Total Job Count

LinkedIn's **total results** for your search (e.g., "1,000 jobs"), not just visible cards.

### New Jobs Count

**Difference** between current total and baseline (e.g., 1,005 - 1,000 = 5 new).

### Hidden Tab Method

Extension opens search in **invisible background tab**, extracts count, closes tab. You won't see it.

---

## ⚡ Pro Tips

1. **Descriptive search names** make notifications clearer:

   - ❌ "Search 1"
   - ✅ "Senior Python Developer Remote NYC"

2. **Avoid overlapping searches** to prevent duplicate alerts:

   - ❌ "Python NYC" + "Python New York"
   - ✅ "Python NYC" + "Java San Francisco"

3. **Check Activity Logs regularly** to catch extraction errors early

4. **Use LinkedIn filters** before saving URL:

   - Experience level, job type, date posted, location, salary

5. **Test with "Check for Jobs Now"** after changing settings

---

## 📱 Multiple Searches (Up to 2)

- Each search monitored independently
- Each has its own baseline
- 3-second delay between checks (rate limiting)
- Notifications show which search has new jobs
- All use same check frequency (can't customize per-search yet)

**Activity Log Example:**

```
✅ New jobs for "Python Remote": 3 new (523 total)
ℹ️ No change for "Java NYC": 1,042 jobs
ℹ️ Check complete - 1 search with new jobs
```

---

## 🔐 Privacy

**What the extension accesses:**

- ✅ Public LinkedIn search results (total count only)
- ✅ Your saved search URLs (stored locally)
- ✅ Notification baselines (stored locally)

**What the extension NEVER accesses:**

- ❌ Your LinkedIn password or credentials
- ❌ Your messages, connections, or profile
- ❌ Individual job details (only total count)
- ❌ Your browsing history outside LinkedIn

---

## 📖 Need More Details?

See **JOB_NOTIFICATIONS_GUIDE.md** for:

- Complete technical explanation
- Troubleshooting guide
- FAQ
- Advanced configuration
- Privacy & permissions details
- Changelog

---

## 🆘 Quick Troubleshooting

| Problem                                   | Solution                                    |
| ----------------------------------------- | ------------------------------------------- |
| No notification on first check            | **Normal** - baseline being set             |
| Test notification doesn't appear          | Check Chrome → Settings → Notifications     |
| Extraction failed warning in logs         | Verify search URL works on LinkedIn         |
| Multiple notifications for same jobs      | Delete and re-save search to reset baseline |
| Notifications stop after extension reload | Re-enable in Settings (toggle OFF then ON)  |

---

**Check Activity Logs:** Settings → Job Search Notifications → Activity Logs  
**Manual Check:** Settings → Job Search Notifications → "Check for Jobs Now"  
**Test Notifications:** Settings → Job Search Notifications → "Send Test Notification"

---

**Status:** ✅ Fully Operational  
**Version:** Latest (2024)  
**Max Searches:** 2  
**Check Frequency:** 15 min - 2 hours  
**Reliability:** High (5 fallback methods, 3 retries)
