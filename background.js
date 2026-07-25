/**
 * Background Service Worker for LinkedIn Formatter Extension
 * Handles messages from content scripts
 */

// Constants
const MAX_LOGS = 10;
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
    // Open the options page in a new tab
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
  } else if (request.action === "updateNotificationAlarm") {
    // Update notification check alarm
    setupNotificationAlarm(request.settings).then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async
  } else if (request.action === "sendTestNotification") {
    // Send test notification
    sendTestNotification().then((success) => {
      sendResponse({ success });
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
  } else if (request.action === "extractJobCount") {
    // Extract job count from LinkedIn page (called from background via tab)
    // This will be handled by content script
    return false;
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
 */
async function setupNotificationAlarm(settings) {
  try {
    // Clear existing alarm
    await chrome.alarms.clear("checkJobNotifications");

    if (settings && settings.enabled) {
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

      // Create alarm with specified interval
      await chrome.alarms.create("checkJobNotifications", {
        delayInMinutes: settings.checkInterval,
        periodInMinutes: settings.checkInterval,
      });

      await addNotificationLog(
        "success",
        `Notification alarm activated: checking every ${settings.checkInterval} minutes`,
        { checkInterval: settings.checkInterval }
      );

      console.log(
        `Notification alarm set: every ${settings.checkInterval} minutes`
      );
    } else {
      await addNotificationLog("info", "Notification alarm disabled by user", {
        enabled: false,
      });
      console.log("Notification alarm disabled");
    }
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
        // Fetch job count from LinkedIn using content script
        const jobCount = await fetchJobCountViaContentScript(search.url);
        const storedCount = storedCounts[search.id] || 0;

        if (jobCount === 0) {
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
        if (storedCount === 0) {
          storedCounts[search.id] = jobCount;
          console.log(
            `[Job Check] Baseline set for "${search.name}": ${jobCount} jobs`
          );
          await addNotificationLog(
            "info",
            `Baseline established for "${search.name}": ${jobCount} jobs`,
            { searchName: search.name, baseline: jobCount }
          );
        }
        // Only notify if we have baseline and count increased
        else if (jobCount > storedCount) {
          const newJobsCount = jobCount - storedCount;
          newJobNotifications.push({
            searchId: search.id,
            searchName: search.name,
            newJobsCount,
            totalJobs: jobCount,
            url: search.url,
          });
          console.log(
            `[Job Check] Found ${newJobsCount} new jobs for "${search.name}" (${storedCount} → ${jobCount})`
          );
          storedCounts[search.id] = jobCount;
        }
        // Count decreased - update baseline
        else if (jobCount < storedCount) {
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
        }
        // No change
        else {
          console.log(
            `[Job Check] No change for "${search.name}": ${jobCount} jobs`
          );
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
 */
async function fetchJobCountViaContentScript(searchUrl) {
  let tabId = null;

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

    // Close the tab
    if (tabId) {
      await chrome.tabs.remove(tabId);
      console.log("[Job Fetch] Hidden tab closed");
    }

    return jobCount;
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

    return 0;
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
 * Send job notification
 */
async function sendJobNotification(jobInfo) {
  try {
    console.log(
      `[Notification] Attempting to send notification for: ${jobInfo.searchName}`
    );

    // Check notification permission before sending
    const permission = await chrome.notifications.getPermissionLevel();
    console.log(`[Notification] Permission level: ${permission}`);

    if (permission !== "granted") {
      const errorMsg = `Notification permission denied: ${permission}`;
      console.error(`[Notification] ❌ ${errorMsg}`);
      await addNotificationLog("error", errorMsg, {
        searchName: jobInfo.searchName,
        permission: permission,
        action: "Check browser notification settings",
      });
      return false;
    }

    // Format the notification with clear search identification
    const title = `🔔 ${jobInfo.newJobsCount} New Job${
      jobInfo.newJobsCount > 1 ? "s" : ""
    } Found`;
    const message = `Search: "${jobInfo.searchName}"\n${jobInfo.totalJobs} total jobs available now`;

    console.log(`[Notification] Creating notification with title: ${title}`);

    const notificationId = await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: title,
      message: message,
      contextMessage: "", // Empty to avoid cluttering the notification
      priority: 2,
      requireInteraction: true, // Keep notification visible until user dismisses
      buttons: [{ title: "View Jobs" }],
      isClickable: true, // Make entire notification clickable
    });

    console.log(
      `[Notification] ✅ Notification created with ID: ${notificationId}`
    );

    // Store notification ID with URL for click handling
    const urlsResult = await chrome.storage.local.get(["notification_urls"]);
    const urls = urlsResult.notification_urls || {};
    urls[notificationId] = jobInfo.url;
    await chrome.storage.local.set({ notification_urls: urls });

    // Log successful notification send
    await addNotificationLog(
      "success",
      `📬 Notification displayed for "${jobInfo.searchName}"`,
      {
        notificationId: notificationId,
        searchName: jobInfo.searchName,
        newJobsCount: jobInfo.newJobsCount,
      }
    );

    console.log(
      `[Notification] ✅ Success: ${jobInfo.searchName} (ID: ${notificationId})`
    );
    return true;
  } catch (error) {
    console.error(`[Notification] ❌ Error:`, error);
    await addNotificationLog(
      "error",
      `❌ Failed to send notification for "${jobInfo.searchName}": ${error.message}`,
      {
        error: error.toString(),
        errorStack: error.stack,
        searchName: jobInfo.searchName,
        action: "Check if notifications are blocked by browser or OS settings",
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
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "🔔 Test Notification",
      message:
        "Job notifications are working! You'll be notified when new jobs match your saved searches.",
      contextMessage: "LinkedIn Job Search Alert",
      priority: 1,
      requireInteraction: false,
    });
    return true;
  } catch (error) {
    console.error("Error sending test notification:", error);
    return false;
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
    checkJobsAndNotify();
  }
});
