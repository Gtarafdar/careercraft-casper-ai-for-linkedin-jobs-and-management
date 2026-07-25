/**
 * ATS Cache Manager
 * Handles caching of ATS analysis results to reduce API costs
 */

class CacheManager {
  constructor() {
    this.CACHE_KEY = "ats_analysis_cache";
    this.SETTINGS_KEY = "cache_settings";
    this.defaultSettings = {
      maxCacheSize: 50,
      autoCleanupDays: 15,
      enabled: true,
    };
  }

  /**
   * Generate MD5-like hash from profile data
   * Used to detect when user updates their CV
   */
  async generateProfileHash(userProfile) {
    const profileString = JSON.stringify({
      skills: userProfile.skills || "",
      experienceSummary: userProfile.experienceSummary || "",
      education: userProfile.education || "",
      about: userProfile.about || "",
      headline: userProfile.headline || "",
    });

    // Use native crypto API for consistent hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(profileString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hashHex.substring(0, 16); // Use first 16 chars for efficiency
  }

  /**
   * Get cache settings
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get([this.SETTINGS_KEY]);
      return result[this.SETTINGS_KEY] || this.defaultSettings;
    } catch (error) {
      console.error("Error loading cache settings:", error);
      return this.defaultSettings;
    }
  }

  /**
   * Save cache settings
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({
        [this.SETTINGS_KEY]: { ...this.defaultSettings, ...settings },
      });
      return true;
    } catch (error) {
      console.error("Error saving cache settings:", error);
      return false;
    }
  }

  /**
   * Get all cached results
   */
  async getAllCache() {
    try {
      const result = await chrome.storage.local.get([this.CACHE_KEY]);
      return result[this.CACHE_KEY] || {};
    } catch (error) {
      console.error("Error loading cache:", error);
      return {};
    }
  }

  /**
   * Save ATS analysis result to cache
   */
  async saveAtsCache(jobId, atsResult, userProfile, jobData) {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        console.log("Cache is disabled, skipping save");
        return false;
      }

      const profileHash = await this.generateProfileHash(userProfile);
      const cacheKey = `${jobId}_${profileHash}`;

      const cache = await this.getAllCache();

      // Create cache entry
      const cacheEntry = {
        jobId: jobId,
        jobTitle: jobData.title || "Unknown",
        company: jobData.company || "Unknown",
        atsResult: atsResult,
        userProfileHash: profileHash,
        timestamp: Date.now(),
        accessCount: 1,
      };

      // Add to cache
      cache[cacheKey] = cacheEntry;

      // Enforce cache size limit (keep most recent)
      await this.enforceLimit(cache, settings.maxCacheSize);

      // Save updated cache
      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });

      console.log(
        `ATS result cached for job ${jobId} (profile hash: ${profileHash})`
      );
      return true;
    } catch (error) {
      console.error("Error saving to cache:", error);
      return false;
    }
  }

  /**
   * Get cached ATS result if available and profile hasn't changed
   */
  async getAtsCache(jobId, userProfile) {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        console.log("Cache is disabled, skipping lookup");
        return null;
      }

      const profileHash = await this.generateProfileHash(userProfile);
      const cacheKey = `${jobId}_${profileHash}`;

      const cache = await this.getAllCache();
      const cachedEntry = cache[cacheKey];

      if (!cachedEntry) {
        console.log(`No cache found for job ${jobId} with current profile`);
        return null;
      }

      // Check if entry has expired
      const ageInDays =
        (Date.now() - cachedEntry.timestamp) / (1000 * 60 * 60 * 24);
      if (ageInDays > settings.autoCleanupDays) {
        console.log(`Cache expired for job ${jobId} (${ageInDays} days old)`);
        // Remove expired entry
        delete cache[cacheKey];
        await chrome.storage.local.set({ [this.CACHE_KEY]: cache });
        return null;
      }

      // Update access count
      cachedEntry.accessCount = (cachedEntry.accessCount || 1) + 1;
      cache[cacheKey] = cachedEntry;
      await chrome.storage.local.set({ [this.CACHE_KEY]: cache });

      console.log(
        `Cache HIT for job ${jobId} (accessed ${cachedEntry.accessCount} times)`
      );
      return cachedEntry.atsResult;
    } catch (error) {
      console.error("Error reading cache:", error);
      return null;
    }
  }

  /**
   * Enforce cache size limit (FIFO - remove oldest entries)
   */
  async enforceLimit(cache, maxSize) {
    const entries = Object.entries(cache);

    if (entries.length <= maxSize) {
      return; // Within limit
    }

    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

    // Keep only the most recent maxSize entries
    const toKeep = entries.slice(-maxSize);
    const newCache = Object.fromEntries(toKeep);

    // Update cache
    await chrome.storage.local.set({ [this.CACHE_KEY]: newCache });

    console.log(
      `Cache limit enforced: removed ${entries.length - maxSize} old entries`
    );
  }

  /**
   * Clear expired cache entries
   */
  async clearExpiredCache(days) {
    try {
      const cache = await this.getAllCache();
      const now = Date.now();
      const cutoffTime = now - days * 24 * 60 * 60 * 1000;

      let removedCount = 0;
      const newCache = {};

      for (const [key, entry] of Object.entries(cache)) {
        if (entry.timestamp > cutoffTime) {
          newCache[key] = entry;
        } else {
          removedCount++;
        }
      }

      if (removedCount > 0) {
        await chrome.storage.local.set({ [this.CACHE_KEY]: newCache });
        console.log(`Removed ${removedCount} expired cache entries`);
      }

      return removedCount;
    } catch (error) {
      console.error("Error clearing expired cache:", error);
      return 0;
    }
  }

  /**
   * Clear all cached results
   */
  async clearAllCache() {
    try {
      await chrome.storage.local.remove(this.CACHE_KEY);
      console.log("All cache cleared");
      return true;
    } catch (error) {
      console.error("Error clearing cache:", error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const cache = await this.getAllCache();
      const entries = Object.values(cache);

      const totalEntries = entries.length;
      const totalAccesses = entries.reduce(
        (sum, entry) => sum + (entry.accessCount || 1),
        0
      );

      // Estimate cost savings (assuming $0.001 per API call)
      const savedCalls = totalAccesses - totalEntries; // Subtract initial calls
      const estimatedSavings = (savedCalls * 0.001).toFixed(2);

      const oldestEntry = entries.reduce((oldest, entry) => {
        return !oldest || entry.timestamp < oldest.timestamp ? entry : oldest;
      }, null);

      const newestEntry = entries.reduce((newest, entry) => {
        return !newest || entry.timestamp > newest.timestamp ? entry : newest;
      }, null);

      return {
        totalEntries,
        totalAccesses,
        savedApiCalls: savedCalls,
        estimatedSavings: `$${estimatedSavings}`,
        oldestTimestamp: oldestEntry ? oldestEntry.timestamp : null,
        newestTimestamp: newestEntry ? newestEntry.timestamp : null,
      };
    } catch (error) {
      console.error("Error getting cache stats:", error);
      return {
        totalEntries: 0,
        totalAccesses: 0,
        savedApiCalls: 0,
        estimatedSavings: "$0.00",
        oldestTimestamp: null,
        newestTimestamp: null,
      };
    }
  }

  /**
   * Run automatic cleanup on startup
   */
  async runAutoCleanup() {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        return;
      }

      console.log("Running automatic cache cleanup...");

      // Remove expired entries
      const removed = await this.clearExpiredCache(settings.autoCleanupDays);

      // Enforce size limit
      const cache = await this.getAllCache();
      await this.enforceLimit(cache, settings.maxCacheSize);

      if (removed > 0) {
        console.log(
          `Auto-cleanup completed: removed ${removed} expired entries`
        );
      }
    } catch (error) {
      console.error("Error during auto-cleanup:", error);
    }
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = CacheManager;
}
