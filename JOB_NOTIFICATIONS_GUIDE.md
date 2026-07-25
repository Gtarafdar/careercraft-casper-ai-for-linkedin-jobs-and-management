# Job Notifications System - Complete Guide

## Overview

The LinkedIn extension's job notification system monitors your saved job searches and alerts you when new jobs are posted. This guide explains how it works and how to use it effectively.

---

## How It Works

### 1. **Baseline Establishment (First Check)**

When you first enable notifications, the extension:

- Opens each saved search in a hidden background tab
- Extracts the **total job count** from LinkedIn (e.g., "1,000 jobs")
- Stores this as the **baseline** for that search
- Closes the hidden tab

**Important:** No notifications are sent during the first check. The system needs to establish a baseline first.

### 2. **Subsequent Checks**

At your chosen interval (15-120 minutes), the extension:

- Repeats the process for each saved search
- Compares the new total count to the stored baseline
- Calculates the difference

### 3. **Notification Trigger**

If the job count **increased**:

- ✅ You receive a notification: **"5 New Jobs Found - Search: 'Senior Developer Remote'"**
- ✅ The baseline is updated to the new count
- ✅ Click "View Jobs" to open that search on LinkedIn

If the count **stayed the same** or **decreased**:

- ❌ No notification is sent
- ✅ The baseline is updated if count decreased
- ℹ️ Activity log shows "No new jobs found"

---

## Features

### Multiple Saved Searches (Up to 2)

- Each search is monitored independently
- Each has its own baseline and check history
- Notifications clearly show which search triggered the alert
- 3-second delay between checking multiple searches (rate limiting)

### Notification Format

```
Title: 🔔 5 New Jobs Found
Message: Search: "Senior Developer Remote"
         1,005 total jobs available now
Context: Click 'View Jobs' to open this search on LinkedIn
```

### Activity Logs

Every check is logged with:

- ✅ **Success:** "New jobs for 'Search Name': 5 new (1,005 total)"
- ℹ️ **Info:** "Baseline established for 'Search Name': 1,000 jobs"
- ℹ️ **Info:** "Check complete - No new jobs (checked 2 searches)"
- ⚠️ **Warning:** "Failed to extract job count for 'Search Name'"
- ❌ **Error:** "Job check failed: [error details]"

---

## Configuration Options

### 1. Enable/Disable Notifications

Toggle in Settings → Job Search Notifications

### 2. Check Frequency

Choose how often to check for new jobs:

- **15 minutes** (most frequent, higher LinkedIn requests)
- **30 minutes** (recommended balance)
- **1 hour** (moderate frequency)
- **2 hours** (least frequent, minimal LinkedIn requests)

### 3. Manual Checks

- **"Send Test Notification"** - Verify browser notifications work
- **"Check for Jobs Now"** - Force immediate check without waiting

---

## How Job Count is Extracted

The extension uses a **hidden tab method** with multiple fallback strategies:

### Method 1: Results Header (Most Reliable)

Extracts from LinkedIn's results header:

```html
<span class="jobs-search-results-list__subtitle"> 1,234 jobs </span>
```

### Method 2: Aria-Label

Reads accessibility attributes on the results list

### Method 3: JSON-LD Structured Data

Parses LinkedIn's embedded metadata

### Method 4: Pagination Text

Extracts from "Showing 1-25 of 1,234 jobs"

### Method 5: Fallback Prevention

If no total count is found, returns **0** instead of counting visible job cards (which would create a false baseline of ~25 jobs)

### Reliability Features

- **5-second wait** after page load for LinkedIn to render
- **3 retry attempts** with 2-second delays if extraction fails
- **Comprehensive logging** with `[Job Count]` prefix for debugging
- **Multiple selector strategies** for different LinkedIn page variations

---

## Understanding Baselines

### What is a Baseline?

The baseline is the **reference point** for detecting new jobs. It's the total job count when:

- You first enable notifications, OR
- A search is first saved, OR
- You manually reset via "Check for Jobs Now"

### Why Baselines Matter

Without a baseline, the system can't distinguish between:

- Existing jobs (already on LinkedIn)
- Newly posted jobs (added since last check)

### Example Flow

```
Check 1 (First):
  - LinkedIn shows: "1,000 jobs"
  - Action: Set baseline to 1,000
  - Notification: None (establishing baseline)

Check 2 (30 min later):
  - LinkedIn shows: "1,005 jobs"
  - Baseline: 1,000
  - Calculation: 1,005 - 1,000 = 5 new jobs
  - Notification: "5 New Jobs Found"
  - Action: Update baseline to 1,005

Check 3 (30 min later):
  - LinkedIn shows: "1,003 jobs"
  - Baseline: 1,005
  - Calculation: 1,003 < 1,005 (count decreased)
  - Notification: None
  - Action: Update baseline to 1,003
  - Log: "Count decreased from 1,005 to 1,003"

Check 4 (30 min later):
  - LinkedIn shows: "1,010 jobs"
  - Baseline: 1,003
  - Calculation: 1,010 - 1,003 = 7 new jobs
  - Notification: "7 New Jobs Found"
  - Action: Update baseline to 1,010
```

---

## Troubleshooting

### "No new jobs found" but I see new jobs on LinkedIn

**Possible Causes:**

1. **Baseline not yet established** - First check only sets baseline
2. **Jobs were posted before last check** - Only detects jobs posted _since_ last check
3. **Job count extraction failed** - Check activity logs for warnings
4. **LinkedIn page not fully loaded** - Extension retries up to 3 times

**Solutions:**

- Wait for the second check cycle (baseline needs to be set first)
- Check activity logs for extraction errors
- Try "Check for Jobs Now" to force a fresh check
- Verify your saved search URL is still valid on LinkedIn

### Notifications not appearing

**Possible Causes:**

1. **Browser notifications blocked** - Check OS/browser settings
2. **Notifications disabled in extension** - Verify toggle is ON
3. **No new jobs since last check** - Check activity logs

**Solutions:**

- Click "Send Test Notification" to verify browser permissions
- Enable notifications in Chrome Settings → Privacy → Notifications
- Check macOS System Preferences → Notifications → Google Chrome
- Review activity logs to see check results

### Only seeing ~25 jobs as baseline

**This issue has been fixed in the latest version:**

- Old behavior: Counted visible job cards (~25) if total couldn't be extracted
- New behavior: Returns 0 if total extraction fails, preventing false baseline
- Logs show: "Job count extraction returned 0"

**If this happens:**

1. Check activity logs for extraction warnings
2. Try "Check for Jobs Now" to re-establish baseline
3. Verify LinkedIn hasn't changed page structure
4. Check if logged into LinkedIn in the browser

### Multiple searches - which one triggered notification?

**The notification message clearly shows:**

```
Title: 🔔 3 New Jobs Found
Message: Search: "Senior Python Developer Remote"  ← Search name here
         523 total jobs available now
```

**Activity logs also show per-search results:**

- "New jobs for 'Search 1 Name': 3 new (523 total)"
- "New jobs for 'Search 2 Name': 0 new (1,042 total)"

---

## Best Practices

### 1. Choosing Check Frequency

- **15 min:** For highly competitive roles (junior positions, popular cities)
- **30 min:** Recommended for most users (good balance)
- **1 hour:** For niche roles with fewer postings
- **2 hours:** For very specific searches or when minimizing LinkedIn requests

### 2. Crafting Saved Searches

- Use LinkedIn's native filters (location, experience level, job type)
- Keep search URLs under 2000 characters
- Test the search on LinkedIn before saving
- Give each search a descriptive name (shown in notifications)

### 3. Managing Multiple Searches

- Use different search names to easily identify which triggered notification
- Avoid overlapping criteria (e.g., same role, different locations) - you'll get duplicate alerts
- Consider different check frequencies per search (currently all use same frequency)

### 4. Monitoring System Health

- Check "Activity Logs" periodically for errors
- Verify "Last checked" timestamp updates regularly
- Review "Notifications sent" count to track activity
- Look for warning messages about extraction failures

---

## Technical Details

### Storage Keys

- `notification_settings`: Enable/disable, frequency, stats
- `notification_job_counts`: Baselines for each search (by search ID)
- `notification_urls`: Maps notification IDs to LinkedIn URLs
- `notification_logs`: Last 10 activity logs

### Rate Limiting

- 3-second delay between checking multiple searches
- 5-second wait for LinkedIn page to render
- Up to 3 retry attempts with 2-second delays (total: 11 seconds max per search)

### Background Service Worker

- Uses Chrome Alarms API for periodic checks
- Alarm name: `checkJobNotifications`
- Persists across browser restarts
- Runs even when extension popup is closed

### Content Script Integration

- Opens each search in hidden tab (`active: false`)
- Injects content script to extract job count from DOM
- Closes tab after extraction completes
- No visible impact on user's browsing

---

## Privacy & Permissions

### What the Extension Does

- ✅ Opens LinkedIn searches in hidden tabs
- ✅ Reads job count from public LinkedIn pages
- ✅ Stores baselines locally in Chrome storage
- ✅ Sends browser notifications (handled by OS)

### What the Extension Does NOT Do

- ❌ Access your LinkedIn credentials
- ❌ Read your messages or profile data
- ❌ Store job details (only total counts)
- ❌ Share data with third parties
- ❌ Track your browsing outside LinkedIn

### Required Permissions

- `notifications`: Display job alerts
- `storage`: Save baselines and settings
- `alarms`: Schedule periodic checks
- `tabs`: Open hidden tabs for extraction
- `scripting`: Inject content script to read job count
- Host permission for `linkedin.com`

---

## FAQ

**Q: Why don't I get notifications immediately after enabling?**  
A: The first check establishes the baseline. Notifications start with the second check when new jobs appear.

**Q: Can I add more than 2 saved searches?**  
A: Currently limited to 2 to avoid excessive LinkedIn requests and rate limiting.

**Q: What happens if I change a saved search URL?**  
A: The system treats it as a new search and re-establishes the baseline.

**Q: Do notifications work when browser is closed?**  
A: No, Chrome extensions require the browser to be running. The alarm will trigger when you reopen Chrome.

**Q: Can I customize notification sounds?**  
A: Notification sounds are controlled by your OS settings, not the extension.

**Q: What if LinkedIn changes their page structure?**  
A: The extension uses 5 fallback methods. If extraction fails, check activity logs and report the issue.

**Q: How accurate is the "new jobs" count?**  
A: Very accurate - it's the difference between LinkedIn's total job count across checks. However, if jobs are removed, the next check will show fewer "new" jobs.

**Q: Can I export notification logs?**  
A: Not currently, but logs are stored in Chrome's local storage under `notification_logs`.

---

## Changelog

### Latest Version

**Improvements:**

- ✅ Increased page wait time from 3s to 5s for more reliable extraction
- ✅ Added 3 retry attempts with 2s delays (up to 11s total)
- ✅ Method 5 now returns 0 instead of visible card count (prevents false baseline)
- ✅ Added 4 more selectors for total count extraction
- ✅ Added pagination text extraction method
- ✅ Enhanced logging with `[Job Count]` and `[Job Fetch]` prefixes
- ✅ Per-search result logging in activity logs
- ✅ Improved notification message format showing search name prominently
- ✅ Better error messages explaining what went wrong

**Bug Fixes:**

- 🐛 Fixed false baseline issue (was counting ~25 visible cards instead of total)
- 🐛 Fixed "no new jobs" false negatives when jobs existed
- 🐛 Fixed insufficient wait time for LinkedIn page rendering

---

## Support

**Issues or Questions?**

1. Check activity logs for error messages
2. Try "Check for Jobs Now" to force a fresh check
3. Verify saved search URLs work on LinkedIn
4. Review this guide's Troubleshooting section
5. Check Chrome's extension error logs (chrome://extensions → Details → Errors)

**Reporting Bugs:**
Include:

- Activity logs (last 10 entries)
- Console logs (F12 → Console)
- Steps to reproduce the issue
- Expected vs actual behavior
- Saved search URLs (if not sensitive)

---

**Last Updated:** 2024 (Latest Version)  
**System Status:** ✅ Production Ready  
**Known Issues:** None
