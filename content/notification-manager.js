/**
 * Notification Manager
 * Handles browser notifications for new job postings
 * Manages job count tracking and notification delivery
 */

class NotificationManager {
  constructor() {
    this.STORAGE_KEY = "notification_job_counts";
    this.SETTINGS_KEY = "notification_settings";
    this.MIN_CHECK_INTERVAL = 15; // minutes (prevent rate limiting)
    this.RATE_LIMIT_DELAY = 2000; // 2 seconds between LinkedIn requests
  }

  /**
   * Get notification settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get([this.SETTINGS_KEY]);
      return (
        result[this.SETTINGS_KEY] || {
          enabled: false,
          checkInterval: 30, // minutes
          lastChecked: null,
          notificationsSent: 0,
        }
      );
    } catch (error) {
      console.error("NotificationManager: Error loading settings:", error);
      return null;
    }
  }

  /**
   * Save notification settings
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({ [this.SETTINGS_KEY]: settings });
      return true;
    } catch (error) {
      console.error("NotificationManager: Error saving settings:", error);
      return false;
    }
  }

  /**
   * Get stored job counts
   */
  async getStoredCounts() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      return result[this.STORAGE_KEY] || {};
    } catch (error) {
      console.error("NotificationManager: Error loading counts:", error);
      return {};
    }
  }

  /**
   * Save job counts
   */
  async saveJobCounts(counts) {
    try {
      await chrome.storage.local.set({ [this.STORAGE_KEY]: counts });
      return true;
    } catch (error) {
      console.error("NotificationManager: Error saving counts:", error);
      return false;
    }
  }

  /**
   * Extract job count from LinkedIn HTML
   * @param {string} html - HTML content
   * @returns {number} - Job count or 0
   */
  extractJobCount(html) {
    try {
      // Method 1: "X results" or "About X results"
      const resultsMatch = html.match(
        /<span[^>]*>(?:About\s+)?([\d,]+)\s+results?<\/span>/i
      );
      if (resultsMatch) {
        return parseInt(resultsMatch[1].replace(/,/g, ""));
      }

      // Method 2: JSON embedded in page
      const jsonMatch = html.match(/"totalResultCount":(\d+)/);
      if (jsonMatch) {
        return parseInt(jsonMatch[1]);
      }

      // Method 3: jobs-search-results-list__subtitle
      const subtitleMatch = html.match(
        /jobs-search-results-list__subtitle[^>]*>(?:About\s+)?([\d,]+)\s+results?/i
      );
      if (subtitleMatch) {
        return parseInt(subtitleMatch[1].replace(/,/g, ""));
      }

      return 0;
    } catch (error) {
      console.error("NotificationManager: Error extracting job count:", error);
      return 0;
    }
  }

  /**
   * Fetch job count from LinkedIn URL
   * @param {string} url - LinkedIn search URL
   * @returns {Promise<number>} - Job count
   */
  async fetchJobCount(url) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        console.warn(`NotificationManager: HTTP ${response.status} for ${url}`);
        return 0;
      }

      const html = await response.text();
      const count = this.extractJobCount(html);

      console.log(`NotificationManager: Found ${count} jobs for URL`);
      return count;
    } catch (error) {
      // Network errors are common (CORS, rate limiting, etc.)
      console.warn(
        "NotificationManager: Fetch error (expected with CORS):",
        error.message
      );
      return 0;
    }
  }

  /**
   * Check for new jobs on saved searches
   * @param {Array} savedSearches - Array of saved search objects
   * @returns {Promise<Array>} - Array of new job notifications
   */
  async checkForNewJobs(savedSearches) {
    if (!savedSearches || savedSearches.length === 0) {
      return [];
    }

    const settings = await this.getSettings();
    if (!settings || !settings.enabled) {
      return [];
    }

    const newJobNotifications = [];
    const storedCounts = await this.getStoredCounts();

    // Rate limiting: check one search at a time with delay
    for (let i = 0; i < savedSearches.length; i++) {
      const search = savedSearches[i];

      try {
        // Fetch current job count
        const currentCount = await this.fetchJobCount(search.url);
        const storedCount = storedCounts[search.id] || 0;

        // Only notify if:
        // 1. We have a baseline count (not first check)
        // 2. New count is greater than stored count
        // 3. Current count is not 0 (indicates fetch failure)
        if (storedCount > 0 && currentCount > storedCount && currentCount > 0) {
          const newJobsCount = currentCount - storedCount;
          newJobNotifications.push({
            searchId: search.id,
            searchName: search.name,
            newJobsCount,
            totalJobs: currentCount,
            url: search.url,
          });

          console.log(
            `NotificationManager: ${newJobsCount} new jobs for "${search.name}"`
          );
        }

        // Update stored count (even if 0, to establish baseline)
        storedCounts[search.id] =
          currentCount > 0 ? currentCount : storedCounts[search.id] || 0;

        // Rate limiting delay between requests
        if (i < savedSearches.length - 1) {
          await this.delay(this.RATE_LIMIT_DELAY);
        }
      } catch (error) {
        console.error(
          `NotificationManager: Error checking "${search.name}":`,
          error
        );
      }
    }

    // Save updated counts
    await this.saveJobCounts(storedCounts);

    return newJobNotifications;
  }

  /**
   * Initialize job counts for new searches (silent baseline)
   * @param {string} searchId - Search ID
   * @param {string} url - Search URL
   */
  async initializeJobCount(searchId, url) {
    try {
      const count = await this.fetchJobCount(url);
      if (count > 0) {
        const storedCounts = await this.getStoredCounts();
        storedCounts[searchId] = count;
        await this.saveJobCounts(storedCounts);
        console.log(
          `NotificationManager: Initialized count for search ${searchId}: ${count} jobs`
        );
      }
    } catch (error) {
      console.error("NotificationManager: Error initializing count:", error);
    }
  }

  /**
   * Reset job count for a search (when edited)
   * @param {string} searchId - Search ID
   */
  async resetJobCount(searchId) {
    try {
      const storedCounts = await this.getStoredCounts();
      delete storedCounts[searchId];
      await this.saveJobCounts(storedCounts);
    } catch (error) {
      console.error("NotificationManager: Error resetting count:", error);
    }
  }

  /**
   * Reset all job counts
   */
  async resetAllCounts() {
    try {
      await chrome.storage.local.remove([this.STORAGE_KEY]);
      console.log("NotificationManager: All job counts reset");
    } catch (error) {
      console.error("NotificationManager: Error resetting all counts:", error);
    }
  }

  /**
   * Reset notification stats
   */
  async resetStats() {
    try {
      const settings = await this.getSettings();
      if (settings) {
        settings.notificationsSent = 0;
        settings.lastChecked = null;
        await this.saveSettings(settings);
        console.log("NotificationManager: Stats reset");
      }
    } catch (error) {
      console.error("NotificationManager: Error resetting stats:", error);
    }
  }

  /**
   * Update last checked timestamp
   */
  async updateLastChecked() {
    try {
      const settings = await this.getSettings();
      if (settings) {
        settings.lastChecked = Date.now();
        await this.saveSettings(settings);
      }
    } catch (error) {
      console.error("NotificationManager: Error updating last checked:", error);
    }
  }

  /**
   * Increment notifications sent counter
   * @param {number} count - Number of notifications sent
   */
  async incrementNotificationsSent(count = 1) {
    try {
      const settings = await this.getSettings();
      if (settings) {
        settings.notificationsSent = (settings.notificationsSent || 0) + count;
        await this.saveSettings(settings);
      }
    } catch (error) {
      console.error("NotificationManager: Error incrementing counter:", error);
    }
  }

  /**
   * Delay helper for rate limiting
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Format interval for display
   * @param {number} minutes - Interval in minutes
   * @returns {string} - Formatted string
   */
  formatInterval(minutes) {
    if (minutes < 60) {
      return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    } else {
      const hours = minutes / 60;
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    }
  }

  /**
   * Validate check interval
   * @param {number} interval - Interval in minutes
   * @returns {boolean}
   */
  isValidInterval(interval) {
    return interval >= this.MIN_CHECK_INTERVAL;
  }
}

// Make available globally
if (typeof window !== "undefined") {
  window.NotificationManager = NotificationManager;
}
