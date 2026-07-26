/**
 * Background Service Worker for LinkedIn Formatter Extension
 * Handles messages from content scripts
 */

// Constants
const MAX_LOGS = 40;
const LOG_STORAGE_KEY = "notification_logs";

/**
 * Add notification log entry
 */
async function addNotificationLog(status, message, details = {}) {
  try {
    const result = await chrome.storage.local.get([LOG_STORAGE_KEY]);
    const logs = result[LOG_STORAGE_KEY] || [];

    const logEntry = {
      timestamp: Date.now(),
      status, // 'success', 'error', 'warning', 'info'
      message,
      details,
    };

    // Add to beginning and keep only last MAX_LOGS
    logs.unshift(logEntry);
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
    console.log(
      `[Notification Log] ${status.toUpperCase()}: ${message}`,
      details
    );
  } catch (error) {
    console.error("Error adding notification log:", error);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "openOptions") {
    const hash = request.hash ? String(request.hash).replace(/^#/, "") : "";
    const optionsUrl = chrome.runtime.getURL(
      "options.html" + (hash ? "#" + hash : "")
    );
    chrome.tabs.create({ url: optionsUrl }).catch(function () {
      chrome.runtime.openOptionsPage();
    });
    sendResponse({ success: true });
  } else if (request.action === "updateNotificationAlarm") {
    // Update notification check alarm (user changed settings — force recreate)
    setupNotificationAlarm(request.settings, { force: true }).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async
  } else if (request.action === "getNotificationHealth") {
    (async () => {
      try {
        const result = await chrome.storage.local.get([
          "notification_settings",
          "saved_job_searches",
        ]);
        const settings = result.notification_settings || {};
        const searches = result.saved_job_searches || [];
        const alarm = await chrome.alarms.get("checkJobNotifications");
        const permission = await chrome.notifications.getPermissionLevel();
        sendResponse({
          success: true,
          enabled: !!settings.enabled,
          checkInterval: settings.checkInterval || null,
          lastChecked: settings.lastChecked || null,
          notificationsSent: settings.notificationsSent || 0,
          savedSearchCount: searches.length,
          permission: permission,
          alarmScheduled: !!alarm,
          nextCheckAt: alarm && alarm.scheduledTime ? alarm.scheduledTime : null,
          periodInMinutes: alarm ? alarm.periodInMinutes : null,
        });
      } catch (e) {
        sendResponse({ success: false, error: String(e) });
      }
    })();
    return true;
  } else if (request.action === "sendTestNotification") {
    // Send test notification
    sendTestNotification().then((result) => {
      if (result && typeof result === "object") {
        sendResponse(result);
      } else {
        sendResponse({ success: !!result });
      }
    });
    return true; // Keep channel open for async
  } else if (request.action === "checkJobsNow") {
    // Manual check trigger
    checkJobsAndNotify().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async
  } else if (request.action === "getNotificationLogs") {
    // Get notification logs
    chrome.storage.local.get([LOG_STORAGE_KEY]).then((result) => {
      sendResponse({ logs: result[LOG_STORAGE_KEY] || [] });
    });
    return true;
  } else if (request.action === "clearNotificationLogs") {
    // Clear notification logs
    chrome.storage.local.set({ [LOG_STORAGE_KEY]: [] }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === "softFetchAuthorPosts") {
    softFetchAuthorPosts(request)
      .then(function (result) {
        sendResponse({ success: true, result: result });
      })
      .catch(function (e) {
        console.warn("softFetchAuthorPosts failed", e);
        sendResponse({ success: false, error: String(e) });
      });
    return true;
  } else if (request.action === "updateAuthorPostsAlarm") {
    setupAuthorPostsAlarm()
      .then(function () {
        sendResponse({ success: true });
      })
      .catch(function (e) {
        sendResponse({ success: false, error: String(e) });
      });
    return true;
  } else if (request.action === "extractJobCount") {
    // Extract job count from LinkedIn page (called from background via tab)
    // This will be handled by content script
    return false;
  } else if (request.action === "updateTrackerRefreshAlarms") {
    setupTrackerRefreshAlarms(request.settings)
      .then(() => sendResponse({ success: true }))
      .catch((e) => {
        console.warn("updateTrackerRefreshAlarms failed", e);
        sendResponse({ success: false });
      });
    return true;
  }

  return true; // Keep the message channel open for async response
});

// Log when extension is installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("CareerCraft AI installed successfully!");
    try {
      const existing = await chrome.storage.local.get(["onboarding_completed"]);
      if (!existing.onboarding_completed) {
        await chrome.tabs.create({
          url: chrome.runtime.getURL("welcome.html"),
        });
      }
    } catch (e) {
      console.warn("Could not open welcome page", e);
      chrome.runtime.openOptionsPage();
    }
  } else if (details.reason === "update") {
    console.log(
      "CareerCraft AI updated to version",
      chrome.runtime.getManifest().version
    );
  }

  // Run cache cleanup on install/update
  await runCacheCleanup();

  // Setup notification alarm
  const result = await chrome.storage.local.get(["notification_settings"]);
  if (result.notification_settings) {
    await setupNotificationAlarm(result.notification_settings);
  }
  await setupTrackerRefreshAlarms();
  await setupAuthorPostsAlarm();
});

// Run cache cleanup on extension startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("LinkedIn Formatter: Extension started");
  await runCacheCleanup();

  // Setup notification alarm
  const result = await chrome.storage.local.get(["notification_settings"]);
  if (result.notification_settings) {
    await setupNotificationAlarm(result.notification_settings);
  }
  await setupTrackerRefreshAlarms();
  await setupAuthorPostsAlarm();
});

/**
 * Run automatic cache cleanup
 */
async function runCacheCleanup() {
  try {
    // Get cache settings
    const result = await chrome.storage.local.get(["cache_settings"]);
    const settings = result.cache_settings || {
      maxCacheSize: 50,
      autoCleanupDays: 15,
      enabled: true,
    };

    if (!settings.enabled) {
      console.log("Cache disabled, skipping cleanup");
      return;
    }

    // Get all cache
    const cacheResult = await chrome.storage.local.get(["ats_analysis_cache"]);
    const cache = cacheResult.ats_analysis_cache || {};

    const now = Date.now();
    const cutoffTime = now - settings.autoCleanupDays * 24 * 60 * 60 * 1000;

    let removedCount = 0;
    const newCache = {};

    // Remove expired entries
    for (const [key, entry] of Object.entries(cache)) {
      if (entry.timestamp > cutoffTime) {
        newCache[key] = entry;
      } else {
        removedCount++;
      }
    }

    // Enforce size limit (keep most recent)
    const entries = Object.entries(newCache);
    if (entries.length > settings.maxCacheSize) {
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
      const toKeep = entries.slice(-settings.maxCacheSize);
      const finalCache = Object.fromEntries(toKeep);

      await chrome.storage.local.set({ ats_analysis_cache: finalCache });
      const sizeRemoved = entries.length - settings.maxCacheSize;
      console.log(
        `Cache cleanup: Removed ${removedCount} expired + ${sizeRemoved} size-limit entries`
      );
    } else if (removedCount > 0) {
      await chrome.storage.local.set({ ats_analysis_cache: newCache });
      console.log(`Cache cleanup: Removed ${removedCount} expired entries`);
    } else {
      console.log("Cache cleanup: No cleanup needed");
    }
  } catch (error) {
    console.error("Error during cache cleanup:", error);
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * NOTIFICATION SYSTEM
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Setup notification alarm
 * Avoid clearing/recreating on every extension reload — that resets the timer
 * and floods Activity Logs with "alarm activated" instead of real check cycles.
 */
async function setupNotificationAlarm(settings, options) {
  const opts = options || {};
  try {
    const enabled = !!(settings && settings.enabled);
    const period = Math.max(
      15,
      Math.min(120, Number(settings && settings.checkInterval) || 30)
    );

    if (!enabled) {
      await chrome.alarms.clear("checkJobNotifications");
      if (opts.force || opts.logDisable !== false) {
        await addNotificationLog("info", "Notification alarm disabled by user", {
          enabled: false,
        });
      }
      console.log("Notification alarm disabled");
      return;
    }

    // Check notification permission
    const permission = await chrome.notifications.getPermissionLevel();
    if (permission !== "granted") {
      await addNotificationLog(
        "error",
        "Notification permission not granted",
        { permission }
      );
      return;
    }

    const existing = await chrome.alarms.get("checkJobNotifications");
    const samePeriod =
      existing &&
      Number(existing.periodInMinutes) === period;

    // Keep existing healthy alarm unless forced / interval changed
    if (samePeriod && !opts.force) {
      console.log(
        `Notification alarm already set (every ${period} min) — skipping reset`
      );
      return;
    }

    await chrome.alarms.clear("checkJobNotifications");

    // If last check is stale, run sooner; otherwise wait full period
    let delay = period;
    const lastChecked = Number(settings && settings.lastChecked) || 0;
    const staleMs = period * 60 * 1000;
    if (!lastChecked || Date.now() - lastChecked >= staleMs) {
      delay = 1; // Chrome alarms: minimum practical delay ~1 minute
    }
    if (opts.immediate) delay = 1;

    await chrome.alarms.create("checkJobNotifications", {
      delayInMinutes: delay,
      periodInMinutes: period,
    });

    await addNotificationLog(
      "info",
      `Notification alarm set: every ${period} min (next in ~${delay} min)`,
      { checkInterval: period, delayMinutes: delay, reset: true }
    );

    console.log(
      `Notification alarm set: every ${period} minutes (first in ${delay})`
    );
  } catch (error) {
    await addNotificationLog(
      "error",
      `Failed to setup notification alarm: ${error.message}`,
      { error: error.toString() }
    );
    console.error("Error setting up notification alarm:", error);
  }
}

/**
 * Check for new jobs and send notifications
 */
async function checkJobsAndNotify() {
  try {
    await addNotificationLog("info", "Starting job check cycle...", {});

    // Check notification permission first
    const permission = await chrome.notifications.getPermissionLevel();
    if (permission !== "granted") {
      await addNotificationLog(
        "error",
        "Notification permission denied by browser or OS",
        {
          permission,
          action: "Please enable notifications in browser settings",
        }
      );
      return;
    }

    // Get notification settings
    const settingsResult = await chrome.storage.local.get([
      "notification_settings",
    ]);
    const settings = settingsResult.notification_settings;

    if (!settings || !settings.enabled) {
      await addNotificationLog(
        "warning",
        "Notifications are disabled in settings",
        { enabled: false }
      );
      return;
    }

    // Get saved searches
    const searchesResult = await chrome.storage.local.get([
      "saved_job_searches",
    ]);
    const savedSearches = searchesResult.saved_job_searches || [];

    if (savedSearches.length === 0) {
      await addNotificationLog(
        "warning",
        "No saved job searches found - add searches to receive notifications",
        { searchCount: 0 }
      );
      return;
    }

    console.log(
      `Checking ${savedSearches.length} saved searches for new jobs...`
    );

    await addNotificationLog(
      "info",
      `Checking ${savedSearches.length} saved search${
        savedSearches.length > 1 ? "es" : ""
      } for new jobs`,
      { searchCount: savedSearches.length }
    );

    // Check for new jobs
    const result = await checkNewJobCounts(savedSearches);
    const { newJobs, errors } = result;

    // Log any errors encountered
    if (errors.length > 0) {
      await addNotificationLog(
        "warning",
        `Encountered ${errors.length} error(s) while checking searches`,
        { errors: errors.slice(0, 3) } // Log first 3 errors
      );
    }

    // Send notifications and log each search result
    for (const job of newJobs) {
      await sendJobNotification(job);
      await addNotificationLog(
        "success",
        `New jobs for "${job.searchName}": ${job.newJobsCount} new (${job.totalJobs} total)`,
        {
          searchName: job.searchName,
          newJobsCount: job.newJobsCount,
          totalJobs: job.totalJobs,
        }
      );
    }

    // Update stats
    settings.lastChecked = Date.now();
    if (newJobs.length > 0) {
      settings.notificationsSent =
        (settings.notificationsSent || 0) + newJobs.length;
    }
    await chrome.storage.local.set({ notification_settings: settings });

    // Log summary
    if (newJobs.length > 0) {
      await addNotificationLog(
        "info",
        `Check complete - ${newJobs.length} search${
          newJobs.length > 1 ? "es" : ""
        } with new jobs`,
        {
          totalSearchesChecked: savedSearches.length,
          searchesWithNewJobs: newJobs.length,
        }
      );
    } else {
      await addNotificationLog(
        "info",
        `Check complete - No new jobs (checked ${savedSearches.length} search${
          savedSearches.length > 1 ? "es" : ""
        })`,
        {
          totalSearchesChecked: savedSearches.length,
          newJobCount: 0,
        }
      );
    }

    console.log(`Check complete. ${newJobs.length} notifications sent.`);
  } catch (error) {
    await addNotificationLog("error", `Job check failed: ${error.message}`, {
      error: error.toString(),
      stack: error.stack,
    });
    console.error("Error in checkJobsAndNotify:", error);
  }
}

/**
 * Check job counts for saved searches
 */
async function checkNewJobCounts(savedSearches) {
  const STORAGE_KEY = "notification_job_counts";
  const RATE_LIMIT_DELAY = 3000; // 3 seconds between requests
  const newJobNotifications = [];
  const errors = [];

  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const storedCounts = result[STORAGE_KEY] || {};

    for (let i = 0; i < savedSearches.length; i++) {
      const search = savedSearches[i];
      console.log(
        `[Job Check ${i + 1}/${savedSearches.length}] Checking "${
          search.name
        }"...`
      );

      try {
        // Fetch job count + soft-ingest cards from LinkedIn
        const fetchResult = await fetchJobCountViaContentScript(
          search.url,
          search.name
        );
        const jobCount =
          fetchResult && typeof fetchResult === "object"
            ? Number(fetchResult.count) || 0
            : Number(fetchResult) || 0;
        const newlyAdded =
          fetchResult && typeof fetchResult === "object"
            ? Number(fetchResult.newlyAdded) || 0
            : 0;
        const sampleTitle =
          fetchResult && typeof fetchResult === "object"
            ? fetchResult.sampleTitle
            : null;
        const storedCount = storedCounts[search.id] || 0;
        let notifiedForSearch = false;

        if (jobCount === 0 && newlyAdded === 0) {
          const errorMsg = `Failed to extract job count for "${search.name}"`;
          errors.push({
            search: search.name,
            error:
              "Could not fetch job count - LinkedIn may be blocking requests or page structure changed",
          });
          console.warn(`[Job Check] ${errorMsg}`);
          await addNotificationLog("warning", errorMsg, {
            searchName: search.name,
            reason: "Job count extraction returned 0",
          });
          continue;
        }

        // First time seeing this search - establish baseline
        if (jobCount > 0 && storedCount === 0) {
          storedCounts[search.id] = jobCount;
          console.log(
            `[Job Check] Baseline set for "${search.name}": ${jobCount} jobs`
          );
          await addNotificationLog(
            "info",
            `Baseline established for "${search.name}": ${jobCount} jobs (alerts also fire when new job cards appear)`,
            { searchName: search.name, baseline: jobCount }
          );
        }
        // Notify if LinkedIn total count increased
        else if (jobCount > 0 && jobCount > storedCount) {
          const newJobsCount = jobCount - storedCount;
          newJobNotifications.push({
            searchId: search.id,
            searchName: search.name,
            newJobsCount,
            totalJobs: jobCount,
            url: search.url,
          });
          notifiedForSearch = true;
          console.log(
            `[Job Check] Found ${newJobsCount} new jobs for "${search.name}" (${storedCount} → ${jobCount})`
          );
          storedCounts[search.id] = jobCount;
        }
        // Count decreased - update baseline
        else if (jobCount > 0 && jobCount < storedCount) {
          console.log(
            `[Job Check] Job count decreased for "${search.name}": ${storedCount} → ${jobCount} (baseline updated)`
          );
          await addNotificationLog(
            "info",
            `"${search.name}": Count decreased from ${storedCount} to ${jobCount} (baseline updated)`,
            {
              searchName: search.name,
              oldCount: storedCount,
              newCount: jobCount,
            }
          );
          storedCounts[search.id] = jobCount;
        } else if (jobCount > 0) {
          await addNotificationLog(
            "info",
            `"${search.name}": LinkedIn total unchanged (${jobCount} jobs)`,
            { searchName: search.name, jobCount: jobCount }
          );
        }

        // Past-hour / rotating results: total can stay flat while NEW job IDs appear
        if (newlyAdded > 0) {
          await addNotificationLog(
            "success",
            `Added ${newlyAdded} new job${
              newlyAdded > 1 ? "s" : ""
            } to Job Tracker from "${search.name}"` +
              (sampleTitle ? ` (e.g. ${String(sampleTitle).slice(0, 40)})` : ""),
            {
              searchName: search.name,
              newlyAdded: newlyAdded,
              sampleTitle: sampleTitle,
            }
          );
          if (!notifiedForSearch) {
            newJobNotifications.push({
              searchId: search.id,
              searchName: search.name,
              newJobsCount: newlyAdded,
              totalJobs: jobCount || newlyAdded,
              url: search.url,
            });
          }
        }

        // Rate limiting between requests
        if (i < savedSearches.length - 1) {
          await delay(RATE_LIMIT_DELAY);
        }
      } catch (error) {
        errors.push({
          search: search.name,
          error: error.message,
        });
        console.error(`Error checking search "${search.name}":`, error);
      }
    }

    // Save updated counts
    await chrome.storage.local.set({ [STORAGE_KEY]: storedCounts });
    return { newJobs: newJobNotifications, errors };
  } catch (error) {
    console.error("Error checking new job counts:", error);
    return { newJobs: [], errors: [{ error: error.message }] };
  }
}

/**
 * Fetch job count via content script
 * Opens a hidden tab, extracts job count, then closes it
 * Returns { count, newlyAdded, sampleTitle }
 */
async function fetchJobCountViaContentScript(searchUrl, searchName) {
  let tabId = null;
  const empty = { count: 0, newlyAdded: 0, sampleTitle: null };

  try {
    console.log(`[Job Fetch] Opening hidden tab for: ${searchUrl}`);

    // Create a hidden tab
    const tab = await chrome.tabs.create({
      url: searchUrl,
      active: false,
    });
    tabId = tab.id;

    // Wait for page to load
    console.log("[Job Fetch] Waiting for page to load...");
    await waitForTabLoad(tabId);

    // Give LinkedIn MORE time to render the total count (increased from 3s to 5s)
    console.log("[Job Fetch] Waiting 5 seconds for LinkedIn to render...");
    await delay(5000);

    // Try extracting multiple times with delays (LinkedIn is slow to render)
    let jobCount = 0;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      console.log(
        `[Job Fetch] Extraction attempt ${attempt}/${MAX_RETRIES}...`
      );

      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: "extractJobCount",
        });

        if (response && response.count > 0) {
          jobCount = response.count;
          console.log(
            `[Job Fetch] ✅ Successfully extracted: ${jobCount} jobs`
          );
          break;
        } else {
          console.warn(
            `[Job Fetch] ⚠️ Attempt ${attempt} returned 0 or no response`
          );
          if (attempt < MAX_RETRIES) {
            console.log("[Job Fetch] Waiting 2 more seconds before retry...");
            await delay(2000);
          }
        }
      } catch (msgError) {
        console.error(
          `[Job Fetch] ❌ Message error on attempt ${attempt}:`,
          msgError
        );
        if (attempt < MAX_RETRIES) {
          await delay(2000);
        }
      }
    }

    // Soft: ingest top job cards into Job Tracker
    let ingest = { newlyAdded: 0, sampleTitle: null };
    try {
      ingest = (await softIngestAlertJobCards(tabId, searchName)) || ingest;
    } catch (ingestErr) {
      console.warn("[Job Fetch] Alert card ingest skipped (soft):", ingestErr);
    }

    // Close the tab
    if (tabId) {
      await chrome.tabs.remove(tabId);
      console.log("[Job Fetch] Hidden tab closed");
    }

    return {
      count: jobCount,
      newlyAdded: ingest.newlyAdded || 0,
      sampleTitle: ingest.sampleTitle || null,
    };
  } catch (error) {
    console.error(
      "[Job Fetch] ❌ Error fetching job count via content script:",
      error
    );

    // Clean up tab if it exists
    if (tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch (e) {
        // Tab may already be closed
      }
    }

    return empty;
  }
}

/**
 * Soft-fetch recent posts for favorite authors (hidden tabs, rate-limited).
 * Never throws into callers.
 */
async function softFetchAuthorPosts(request) {
  const authors = (request && request.authors) || [];
  const per = [1, 2, 5].indexOf(request && request.postsPerAuthor) >= 0
    ? request.postsPerAuthor
    : 2;
  // Fetch a small backlog so dismissed posts can be replaced from cache
  const fetchCount = Math.min(5, Math.max(per, 5));
  const force = !!(request && request.force);
  let filter = request && request.filter === "all" ? "all" : "original";
  if (!request || request.filter == null) {
    try {
      const sr = await chrome.storage.local.get(["aside_widget_settings"]);
      const s = sr.aside_widget_settings || {};
      filter = s.authorPostsFilter === "all" ? "all" : "original";
    } catch (e) {
      filter = "original";
    }
  }
  if (!authors.length) return { fetched: 0 };

  const flagsResult = await chrome.storage.local.get(["feature_flags"]);
  const flags = flagsResult.feature_flags || {};
  if (flags.authorWidget !== true) {
    return { fetched: 0, skipped: "flag_off" };
  }

  const RATE_KEY = "aside_author_fetch_meta";
  const metaResult = await chrome.storage.local.get([RATE_KEY]);
  const meta = metaResult[RATE_KEY] || { lastByAuthor: {}, lastRunAt: 0 };
  const now = Date.now();
  if (!force && meta.lastRunAt && now - meta.lastRunAt < 90 * 1000) {
    return { fetched: 0, skipped: "cooldown" };
  }

  const storeResult = await chrome.storage.local.get(["casper_author_posts"]);
  const cache = storeResult.casper_author_posts || {};
  let fetched = 0;
  const details = [];

  for (let i = 0; i < Math.min(authors.length, 5); i++) {
    const author = authors[i];
    if (!author || !author.id) continue;
    const last = (meta.lastByAuthor && meta.lastByAuthor[author.id]) || 0;
    if (!force && last && now - last < 10 * 60 * 1000 && (cache[author.id] || []).length) {
      details.push({ id: author.id, status: "skip_recent" });
      continue;
    }

    let tabId = null;
    try {
      // LinkedIn redirects /recent-activity/posts/ → /articles/ (often empty).
      // /recent-activity/all/ is the reliable source (confirmed in debug logs).
      const activityUrl =
        "https://www.linkedin.com/in/" +
        encodeURIComponent(author.id) +
        "/recent-activity/all/";
      const tab = await chrome.tabs.create({ url: activityUrl, active: false });
      tabId = tab.id;
      await waitForTabLoad(tabId);

      async function askExtract(useFilter) {
        return chrome.tabs.sendMessage(tabId, {
          action: "extractAuthorPostsFromPage",
          maxPosts: fetchCount,
          author: author,
          filter: useFilter,
        });
      }

      async function extractWithRetries(useFilter) {
        let lastErr = null;
        let best = [];
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(function (r) {
            setTimeout(r, attempt === 0 ? 2800 : 1600);
          });
          try {
            const response = await askExtract(useFilter);
            const posts = (response && response.posts) || [];
            if (posts.length > best.length) best = posts;
            if (posts.length > 0) return { posts: posts, err: null };
          } catch (e) {
            lastErr = String(e && e.message ? e.message : e);
            // Content script may not be ready yet — retry
          }
        }
        return { posts: best, err: lastErr };
      }

      let result = await extractWithRetries(filter);
      let posts = result.posts || [];
      let msgErr = result.err;

      // Original-only found DOM but filtered everything → include activity once
      if (!posts.length && filter === "original") {
        const fallback = await extractWithRetries("all");
        posts = fallback.posts || [];
        if (fallback.err) msgErr = fallback.err;
      }

      details.push({
        id: author.id,
        status: posts.length ? "ok" : "empty",
        postCount: posts.length,
        msgErr: msgErr ? String(msgErr).slice(0, 80) : null,
      });

      if (posts.length) {
        cache[author.id] = posts;
        fetched++;
        const av = posts.find(function (p) {
          return p && p.avatarUrl;
        });
        if (av && av.avatarUrl) {
          try {
            const sr = await chrome.storage.local.get(["aside_widget_settings"]);
            const s = sr.aside_widget_settings || {};
            if (Array.isArray(s.authors)) {
              let changed = false;
              s.authors = s.authors.map(function (a) {
                if (a && a.id === author.id && a.avatarUrl !== av.avatarUrl) {
                  changed = true;
                  return Object.assign({}, a, { avatarUrl: av.avatarUrl });
                }
                return a;
              });
              if (changed) {
                await chrome.storage.local.set({ aside_widget_settings: s });
              }
            }
          } catch (e) {}
        }
      }
      if (!meta.lastByAuthor) meta.lastByAuthor = {};
      meta.lastByAuthor[author.id] = now;
    } catch (e) {
      details.push({
        id: author && author.id,
        status: "error",
        err: String(e && e.message ? e.message : e).slice(0, 80),
      });
      console.warn("[Aside] author fetch failed for", author.id, e);
    } finally {
      if (tabId) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (e) {}
      }
    }
  }

  meta.lastRunAt = now;
  await chrome.storage.local.set({
    casper_author_posts: cache,
    [RATE_KEY]: meta,
  });
  return { fetched: fetched, details: details };
}

/**
 * Soft ring buffer for Feed Widgets job card (max 20, newest first, deduped).
 * Never throws into callers.
 */
async function pushRecentJobAlerts(entries) {
  try {
    const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
    if (!list.length) return;
    const result = await chrome.storage.local.get(["recent_job_alerts"]);
    let alerts = Array.isArray(result.recent_job_alerts)
      ? result.recent_job_alerts.slice()
      : [];
    list.forEach(function (entry) {
      if (!entry) return;
      const id = entry.id != null ? String(entry.id) : "";
      const url = entry.url || "";
      const key = id || url;
      if (!key) return;
      alerts = alerts.filter(function (a) {
        return String(a.id || a.url || "") !== key;
      });
      alerts.unshift({
        id: id || null,
        title: entry.title || "Job",
        company: entry.company || "",
        url:
          url ||
          (id
            ? "https://www.linkedin.com/jobs/view/" + encodeURIComponent(id)
            : ""),
        searchName: entry.searchName || "",
        at: entry.at || Date.now(),
        kind: "alert",
      });
    });
    if (alerts.length > 20) alerts = alerts.slice(0, 20);
    await chrome.storage.local.set({ recent_job_alerts: alerts });
  } catch (e) {
    console.warn("[Aside] pushRecentJobAlerts failed (soft)", e);
  }
}

/**
 * Soft-ingest up to 5 job cards from an already-open search tab into Job Tracker.
 * Returns { newlyAdded, sampleTitle, cardsSeen } for alert notifications.
 */
async function softIngestAlertJobCards(tabId, searchName) {
  try {
    const flagsResult = await chrome.storage.local.get(["feature_flags"]);
    const flags = Object.assign(
      { trackerAlertIngest: true },
      flagsResult.feature_flags || {}
    );
    if (flags.trackerAlertIngest === false) {
      return { newlyAdded: 0, sampleTitle: null, cardsSeen: 0 };
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      action: "extractSearchJobCards",
      maxCards: 5,
    });
    const cards = (response && response.cards) || [];
    if (!cards.length) {
      return { newlyAdded: 0, sampleTitle: null, cardsSeen: 0 };
    }

    const storeResult = await chrome.storage.local.get(["casper_job_tracker"]);
    const map =
      storeResult.casper_job_tracker &&
      typeof storeResult.casper_job_tracker === "object"
        ? storeResult.casper_job_tracker
        : {};
    const nowTs = Date.now();
    let newlyAdded = 0;
    let sampleTitle = null;
    const newAlertEntries = [];

    cards.forEach(function (card) {
      if (!card || !card.id) return;
      const id = String(card.id);
      const existing = map[id];

      if (existing) {
        // Existing row: fill gaps only — do not recount as new
        if (!existing.title && card.title) existing.title = card.title;
        if (!existing.company && card.company) existing.company = card.company;
        if (!existing.searchName && searchName) existing.searchName = searchName;
        if (!existing.url && card.url) existing.url = card.url;
        existing.updatedAt = nowTs;
        map[id] = existing;
        return;
      }

      map[id] = {
        id: id,
        title: card.title || "Untitled job",
        company: card.company || "",
        location: "",
        url:
          card.url ||
          "https://www.linkedin.com/jobs/view/" + encodeURIComponent(id),
        viewedAt: nowTs,
        updatedAt: nowTs,
        atsScore: null,
        atsSummary: null,
        atsDetails: null,
        status: "new",
        statusSource: "auto",
        applicantCount: null,
        applicantUpdatedAt: null,
        expiredDetectedAt: null,
        notes: "",
        starred: false,
        starRating: 0,
        source: "alert",
        companyDetails: card.company
          ? { name: card.company, linkedinUrl: null, raw: null }
          : null,
        searchName: searchName || null,
        alumni: [],
        contacts: [],
      };
      newlyAdded++;
      if (!sampleTitle && card.title) sampleTitle = card.title;
      newAlertEntries.push({
        id: id,
        title: card.title || "Untitled job",
        company: card.company || "",
        url:
          card.url ||
          "https://www.linkedin.com/jobs/view/" + encodeURIComponent(id),
        searchName: searchName || "",
        at: nowTs,
      });
    });

    await chrome.storage.local.set({ casper_job_tracker: map });
    if (newAlertEntries.length) {
      await pushRecentJobAlerts(newAlertEntries);
    }
    console.log(
      `[Job Fetch] Soft-ingested ${newlyAdded} NEW alert card(s) (${cards.length} seen) for "${
        searchName || "search"
      }"`
    );
    return {
      newlyAdded: newlyAdded,
      sampleTitle: sampleTitle,
      cardsSeen: cards.length,
    };
  } catch (e) {
    console.warn("[Job Fetch] softIngestAlertJobCards failed:", e);
    return { newlyAdded: 0, sampleTitle: null, cardsSeen: 0 };
  }
}

/**
 * Wait for tab to finish loading
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // Timeout after 15 seconds
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

/**
 * Shared notification creator — macOS Chrome is picky about icons/buttons.
 * Prefers data-URI icon (avoids SW image decode issues), retries without buttons.
 */
async function resolveNotificationIconDataUrl() {
  try {
    const res = await fetch(chrome.runtime.getURL("icons/icon128.png"));
    if (!res.ok) throw new Error("icon fetch " + res.status);
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(i, Math.min(i + chunk, bytes.length))
      );
    }
    return "data:image/png;base64," + btoa(binary);
  } catch (e) {
    console.warn("[Notification] icon data-URL fallback to getURL:", e);
    return chrome.runtime.getURL("icons/icon128.png");
  }
}

async function createVisibleNotification(partialOptions) {
  const permission = await chrome.notifications.getPermissionLevel();
  if (permission !== "granted") {
    const err = new Error("Notification permission is " + permission);
    err.permission = permission;
    throw err;
  }

  const iconUrl = await resolveNotificationIconDataUrl();
  const idBase = "cc-job-" + Date.now();
  const base = Object.assign(
    {
      type: "basic",
      iconUrl: iconUrl,
      title: "CareerCraft AI",
      message: "Notification",
      priority: 2,
      requireInteraction: true,
    },
    partialOptions || {}
  );
  base.iconUrl = iconUrl;

  async function tryCreate(id, opts) {
    const nid = await chrome.notifications.create(id, opts);
    if (chrome.runtime.lastError) {
      throw new Error(
        chrome.runtime.lastError.message || "notifications.create failed"
      );
    }
    return nid || id;
  }

  try {
    return await tryCreate(idBase, base);
  } catch (e1) {
    console.warn("[Notification] create attempt 1 failed:", e1);
  }

  const noButtons = Object.assign({}, base);
  delete noButtons.buttons;
  try {
    return await tryCreate(idBase + "-nb", noButtons);
  } catch (e2) {
    console.warn("[Notification] create attempt 2 (no buttons) failed:", e2);
  }

  noButtons.iconUrl = chrome.runtime.getURL("icons/icon48.png");
  return await tryCreate(idBase + "-fb", noButtons);
}

/**
 * Send job notification
 */
async function sendJobNotification(jobInfo) {
  try {
    console.log(
      `[Notification] Attempting to send notification for: ${jobInfo.searchName}`
    );

    const title = `${jobInfo.newJobsCount} New Job${
      jobInfo.newJobsCount > 1 ? "s" : ""
    } Found`;
    const message = `Search: "${jobInfo.searchName}" — ${jobInfo.totalJobs} total jobs available now`;

    const notificationId = await createVisibleNotification({
      title: title,
      message: message,
      buttons: [{ title: "View Jobs" }],
      requireInteraction: true,
    });

    const urlsResult = await chrome.storage.local.get(["notification_urls"]);
    const urls = urlsResult.notification_urls || {};
    urls[notificationId] = jobInfo.url;
    await chrome.storage.local.set({ notification_urls: urls });

    await addNotificationLog(
      "success",
      `Notification displayed for "${jobInfo.searchName}"`,
      {
        notificationId: notificationId,
        searchName: jobInfo.searchName,
        newJobsCount: jobInfo.newJobsCount,
      }
    );

    console.log(
      `[Notification] Success: ${jobInfo.searchName} (ID: ${notificationId})`
    );
    return true;
  } catch (error) {
    console.error(`[Notification] Error:`, error);
    await addNotificationLog(
      "error",
      `Failed to send notification for "${jobInfo.searchName}": ${error.message}`,
      {
        error: error.toString(),
        searchName: jobInfo.searchName,
        action:
          "Check chrome://settings/content/notifications and macOS Focus/Do Not Disturb",
      }
    );
    return false;
  }
}

/**
 * Send test notification
 */
async function sendTestNotification() {
  try {
    const permission = await chrome.notifications.getPermissionLevel();

    const notificationId = await createVisibleNotification({
      title: "CareerCraft AI — Test Notification",
      message:
        "Browser notices work. Job alerts only appear when a saved search's total job count goes UP (not on every check).",
      requireInteraction: true,
    });

    await addNotificationLog(
      "success",
      "Test notification sent — look for a banner / Notification Centre",
      { notificationId: notificationId }
    );

    return { success: true, notificationId: notificationId };
  } catch (error) {
    console.error("Error sending test notification:", error);
    await addNotificationLog(
      "error",
      "Test notification failed: " + (error.message || String(error)),
      { error: String(error) }
    );
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Handle notification clicks (clicking on notification body)
chrome.notifications.onClicked.addListener(async (notificationId) => {
  try {
    console.log(`[Notification Click] Notification clicked: ${notificationId}`);

    // Get URL for this notification
    const result = await chrome.storage.local.get(["notification_urls"]);
    const urls = result.notification_urls || {};
    const url = urls[notificationId];

    if (url) {
      console.log(`[Notification Click] Opening URL: ${url}`);

      // Open LinkedIn search in new tab
      await chrome.tabs.create({ url });

      // Clear notification and stored URL
      await chrome.notifications.clear(notificationId);
      delete urls[notificationId];
      await chrome.storage.local.set({ notification_urls: urls });

      console.log(`[Notification Click] ✅ Tab opened, notification cleared`);
    } else {
      console.warn(
        `[Notification Click] ⚠️ No URL found for notification: ${notificationId}`
      );
    }
  } catch (error) {
    console.error("[Notification Click] ❌ Error:", error);
  }
});

// Handle notification button clicks (clicking "View Jobs" button)
chrome.notifications.onButtonClicked.addListener(
  async (notificationId, buttonIndex) => {
    try {
      console.log(
        `[Notification Button] Button ${buttonIndex} clicked on: ${notificationId}`
      );

      if (buttonIndex === 0) {
        // "View Jobs" button clicked
        const result = await chrome.storage.local.get(["notification_urls"]);
        const urls = result.notification_urls || {};
        const url = urls[notificationId];

        if (url) {
          console.log(`[Notification Button] Opening URL: ${url}`);

          await chrome.tabs.create({ url });
          await chrome.notifications.clear(notificationId);
          delete urls[notificationId];
          await chrome.storage.local.set({ notification_urls: urls });

          console.log(
            `[Notification Button] ✅ Tab opened, notification cleared`
          );
        } else {
          console.warn(
            `[Notification Button] ⚠️ No URL found for notification: ${notificationId}`
          );
        }
      }
    } catch (error) {
      console.error("[Notification Button] ❌ Error:", error);
    }
  }
);

// Handle alarm for periodic checks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkJobNotifications") {
    console.log("Alarm triggered: Checking for new jobs...");
    addNotificationLog("info", "Scheduled job check started", {
      source: "alarm",
    }).then(function () {
      return checkJobsAndNotify();
    });
  } else if (alarm.name === "trackerApplicantRefresh") {
    runTrackerMetaRefresh("applicant").catch((e) =>
      console.warn("trackerApplicantRefresh failed", e)
    );
  } else if (alarm.name === "trackerExpiryRefresh") {
    runTrackerMetaRefresh("expiry").catch((e) =>
      console.warn("trackerExpiryRefresh failed", e)
    );
  } else if (alarm.name === "asideAuthorPostsRefresh") {
    runAuthorPostsAlarm().catch((e) =>
      console.warn("asideAuthorPostsRefresh failed", e)
    );
  }
});

/**
 * Soft periodic favorite-author post refresh (hidden tabs, rate-limited).
 * Default interval 60 minutes; off when author widget disabled or interval 0.
 */
async function setupAuthorPostsAlarm() {
  try {
    await chrome.alarms.clear("asideAuthorPostsRefresh");
    const result = await chrome.storage.local.get([
      "feature_flags",
      "aside_widget_settings",
    ]);
    const flags = result.feature_flags || {};
    if (flags.authorWidget !== true) return;
    const settings = Object.assign(
      {
        authors: [],
        postsPerAuthor: 2,
        authorRefreshMinutes: 15,
      },
      result.aside_widget_settings || {}
    );
    const minutes = Number(settings.authorRefreshMinutes);
    if (!(minutes > 0)) return;
    if (!Array.isArray(settings.authors) || !settings.authors.length) return;
    const period = Math.max(15, minutes);
    await chrome.alarms.create("asideAuthorPostsRefresh", {
      delayInMinutes: Math.min(period, 30),
      periodInMinutes: period,
    });
  } catch (e) {
    console.warn("setupAuthorPostsAlarm failed", e);
  }
}

async function runAuthorPostsAlarm() {
  try {
    const result = await chrome.storage.local.get([
      "feature_flags",
      "aside_widget_settings",
    ]);
    const flags = result.feature_flags || {};
    if (flags.authorWidget !== true) return;
    const settings = Object.assign(
      { authors: [], postsPerAuthor: 2, authorRefreshMinutes: 15 },
      result.aside_widget_settings || {}
    );
    if (!(Number(settings.authorRefreshMinutes) > 0)) return;
    const authors = Array.isArray(settings.authors) ? settings.authors : [];
    if (!authors.length) return;
    await softFetchAuthorPosts({
      authors: authors,
      postsPerAuthor: settings.postsPerAuthor,
      force: false,
      filter: settings.authorPostsFilter === "all" ? "all" : "original",
    });
  } catch (e) {
    console.warn("runAuthorPostsAlarm failed", e);
  }
}

/**
 * Setup soft-gated Job Tracker refresh alarms (default OFF via settings).
 */
async function setupTrackerRefreshAlarms(settingsOverride) {
  try {
    await chrome.alarms.clear("trackerApplicantRefresh");
    await chrome.alarms.clear("trackerExpiryRefresh");

    let settings = settingsOverride;
    if (!settings) {
      const result = await chrome.storage.local.get(["tracker_refresh_settings"]);
      settings = Object.assign(
        {
          applicantCheckEnabled: false,
          applicantCheckMinutes: 360,
          expiryCheckEnabled: false,
          expiryCheckMinutes: 720,
          maxJobsPerTick: 3,
        },
        result.tracker_refresh_settings || {}
      );
    }

    if (settings.applicantCheckEnabled) {
      await chrome.alarms.create("trackerApplicantRefresh", {
        periodInMinutes: Math.max(
          60,
          Number(settings.applicantCheckMinutes) || 360
        ),
      });
      console.log("Tracker applicant refresh alarm set");
    }

    if (settings.expiryCheckEnabled) {
      await chrome.alarms.create("trackerExpiryRefresh", {
        periodInMinutes: Math.max(
          120,
          Number(settings.expiryCheckMinutes) || 720
        ),
      });
      console.log("Tracker expiry refresh alarm set");
    }
  } catch (e) {
    console.warn("setupTrackerRefreshAlarms failed", e);
  }
}

/**
 * Soft background refresh for applicant counts / expiry on tracked jobs.
 */
async function runTrackerMetaRefresh(mode) {
  try {
    const result = await chrome.storage.local.get([
      "tracker_refresh_settings",
      "casper_job_tracker",
    ]);
    const settings = Object.assign(
      {
        applicantCheckEnabled: false,
        expiryCheckEnabled: false,
        maxJobsPerTick: 3,
      },
      result.tracker_refresh_settings || {}
    );

    if (mode === "applicant" && !settings.applicantCheckEnabled) return;
    if (mode === "expiry" && !settings.expiryCheckEnabled) return;

    const map =
      result.casper_job_tracker && typeof result.casper_job_tracker === "object"
        ? result.casper_job_tracker
        : {};
    const limit = Math.max(
      1,
      Math.min(10, Number(settings.maxJobsPerTick) || 3)
    );
    const candidates = Object.values(map)
      .filter(function (r) {
        return (
          r &&
          r.url &&
          (r.status === "viewed" ||
            r.status === "applied" ||
            r.starred ||
            (r.starRating && r.starRating > 0))
        );
      })
      .sort(function (a, b) {
        return (a.applicantUpdatedAt || 0) - (b.applicantUpdatedAt || 0);
      })
      .slice(0, limit);

    for (let i = 0; i < candidates.length; i++) {
      const job = candidates[i];
      let tabId = null;
      try {
        const tab = await chrome.tabs.create({
          url: job.url,
          active: false,
        });
        tabId = tab.id;
        await waitForTabLoad(tabId);
        await delay(4000);
        await chrome.tabs.sendMessage(tabId, {
          action: "refreshJobTrackerMeta",
          jobId: job.id,
        });
      } catch (e) {
        console.warn("Tracker meta refresh soft fail for", job.id, e);
      } finally {
        if (tabId) {
          try {
            await chrome.tabs.remove(tabId);
          } catch (e) {}
        }
      }
      await delay(1500);
    }
  } catch (e) {
    console.warn("runTrackerMetaRefresh failed", e);
  }
}
