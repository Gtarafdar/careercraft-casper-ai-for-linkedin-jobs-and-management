/**
 * Saved Searches Manager
 * Manages saved LinkedIn job searches with CRUD operations
 * Enforces a 5-search limit for performance and simplicity
 */

class SavedSearchesManager {
  constructor() {
    this.STORAGE_KEY = "saved_job_searches";
    this.MAX_SEARCHES =
      (typeof SavedSearchUtils !== "undefined" &&
        SavedSearchUtils.MAX_SAVED_SEARCHES) ||
      5;
  }

  /**
   * Get all saved searches
   */
  async getAllSearches() {
    try {
      const result = await chrome.storage.local.get([this.STORAGE_KEY]);
      return result[this.STORAGE_KEY] || [];
    } catch (error) {
      console.error("SavedSearchesManager: Error loading searches:", error);
      return [];
    }
  }

  /**
   * Save a new search
   * @param {Object} searchData - { name, keywords, location, geoId, filters, url }
   * @returns {Object} - { success: boolean, error?: string, search?: Object }
   */
  async saveSearch(searchData) {
    try {
      const searches = await this.getAllSearches();

      // Enforce search slot limit
      if (searches.length >= this.MAX_SEARCHES) {
        return {
          success: false,
          error: `Maximum ${this.MAX_SEARCHES} saved searches allowed. Please delete one first.`,
        };
      }

      // Validate required fields
      if (!searchData.name || !searchData.url) {
        return {
          success: false,
          error: "Search name and URL are required",
        };
      }

      // Create search object
      const normalized =
        typeof SavedSearchUtils !== "undefined"
          ? SavedSearchUtils.normalizeSearchFields(searchData)
          : searchData;

      const search = {
        id: this.generateId(),
        name: (normalized.name || searchData.name || "").trim(),
        keywords: normalized.keywords || "",
        location: normalized.location || "",
        geoId: normalized.geoId || "",
        filters: normalized.filters || {},
        url: normalized.url || searchData.url,
        dateCreated: Date.now(),
        lastRun: null,
        runCount: 0,
      };

      // Add to array
      searches.push(search);

      // Save to storage
      await chrome.storage.local.set({ [this.STORAGE_KEY]: searches });

      console.log("SavedSearchesManager: Search saved:", search.name);
      return { success: true, search };
    } catch (error) {
      console.error("SavedSearchesManager: Error saving search:", error);
      return {
        success: false,
        error: "Failed to save search: " + error.message,
      };
    }
  }

  /**
   * Update an existing search
   * @param {string} searchId - Search ID to update
   * @param {Object} updates - Fields to update
   * @returns {Object} - { success: boolean, error?: string }
   */
  async updateSearch(searchId, updates) {
    try {
      const searches = await this.getAllSearches();
      const index = searches.findIndex((s) => s.id === searchId);

      if (index === -1) {
        return {
          success: false,
          error: "Search not found",
        };
      }

      // Update fields
      searches[index] = {
        ...searches[index],
        ...updates,
        id: searchId, // Preserve ID
        dateCreated: searches[index].dateCreated, // Preserve creation date
      };

      // Save to storage
      await chrome.storage.local.set({ [this.STORAGE_KEY]: searches });

      console.log("SavedSearchesManager: Search updated:", searchId);
      return { success: true };
    } catch (error) {
      console.error("SavedSearchesManager: Error updating search:", error);
      return {
        success: false,
        error: "Failed to update search: " + error.message,
      };
    }
  }

  /**
   * Delete a search
   * @param {string} searchId - Search ID to delete
   * @returns {Object} - { success: boolean, error?: string }
   */
  async deleteSearch(searchId) {
    try {
      const searches = await this.getAllSearches();
      const filtered = searches.filter((s) => s.id !== searchId);

      if (filtered.length === searches.length) {
        return {
          success: false,
          error: "Search not found",
        };
      }

      // Save to storage
      await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered });

      // Clean up notification job counts for this search
      try {
        const countResult = await chrome.storage.local.get([
          "notification_job_counts",
        ]);
        const counts = countResult.notification_job_counts || {};
        if (counts[searchId]) {
          delete counts[searchId];
          await chrome.storage.local.set({ notification_job_counts: counts });
        }
      } catch (e) {
        // Non-critical, continue
        console.warn("Failed to clean up notification counts:", e);
      }

      console.log("SavedSearchesManager: Search deleted:", searchId);
      return { success: true };
    } catch (error) {
      console.error("SavedSearchesManager: Error deleting search:", error);
      return {
        success: false,
        error: "Failed to delete search: " + error.message,
      };
    }
  }

  /**
   * Get a single search by ID
   * @param {string} searchId - Search ID
   * @returns {Object|null} - Search object or null
   */
  async getSearch(searchId) {
    try {
      const searches = await this.getAllSearches();
      return searches.find((s) => s.id === searchId) || null;
    } catch (error) {
      console.error("SavedSearchesManager: Error getting search:", error);
      return null;
    }
  }

  /**
   * Update search run stats
   * @param {string} searchId - Search ID
   */
  async updateRunStats(searchId) {
    try {
      const searches = await this.getAllSearches();
      const index = searches.findIndex((s) => s.id === searchId);

      if (index !== -1) {
        searches[index].lastRun = Date.now();
        searches[index].runCount = (searches[index].runCount || 0) + 1;
        await chrome.storage.local.set({ [this.STORAGE_KEY]: searches });
      }
    } catch (error) {
      console.error("SavedSearchesManager: Error updating run stats:", error);
    }
  }

  /**
   * Check if can add more searches
   * @returns {boolean}
   */
  async canAddMore() {
    const searches = await this.getAllSearches();
    return searches.length < this.MAX_SEARCHES;
  }

  /**
   * Get available slots
   * @returns {number}
   */
  async getAvailableSlots() {
    const searches = await this.getAllSearches();
    return this.MAX_SEARCHES - searches.length;
  }

  /**
   * Extract search parameters from LinkedIn URL
   * @param {string} url - LinkedIn job search URL
   * @returns {Object} - Extracted parameters
   */
  extractSearchParams(url) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      return {
        keywords: params.get("keywords") || "",
        location: params.get("location") || "",
        geoId: params.get("geoId") || "",
        filters: {
          timePosted: params.get("f_TPR") || "", // r86400 = 24hr, r604800 = week
          experienceLevel: params.get("f_E") || "", // 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
          jobType: params.get("f_JT") || "", // F=Full-time, P=Part-time, C=Contract
          workplaceType: params.get("f_WT") || "", // 1=On-site, 2=Remote, 3=Hybrid
        },
      };
    } catch (error) {
      console.error("SavedSearchesManager: Error extracting params:", error);
      return {
        keywords: "",
        location: "",
        geoId: "",
        filters: {},
      };
    }
  }

  /**
   * Build search URL from parameters
   * @param {Object} params - Search parameters
   * @returns {string} - LinkedIn search URL
   */
  buildSearchUrl(params) {
    const baseUrl = "https://www.linkedin.com/jobs/search/";
    const urlParams = new URLSearchParams();

    if (params.keywords) urlParams.set("keywords", params.keywords);
    if (params.location) urlParams.set("location", params.location);
    if (params.geoId) urlParams.set("geoId", params.geoId);

    // Add filters
    if (params.filters) {
      if (params.filters.timePosted)
        urlParams.set("f_TPR", params.filters.timePosted);
      if (params.filters.experienceLevel)
        urlParams.set("f_E", params.filters.experienceLevel);
      if (params.filters.jobType) urlParams.set("f_JT", params.filters.jobType);
      if (params.filters.workplaceType)
        urlParams.set("f_WT", params.filters.workplaceType);
    }

    return baseUrl + "?" + urlParams.toString();
  }

  /**
   * Check if current page is a LinkedIn job search
   * @returns {boolean}
   */
  isJobSearchPage() {
    return (
      window.location.hostname === "www.linkedin.com" &&
      window.location.pathname.includes("/jobs/search")
    );
  }

  /**
   * Get current search from URL
   * @returns {Object|null} - Current search parameters or null
   */
  getCurrentSearch() {
    if (!this.isJobSearchPage()) {
      return null;
    }

    const params = this.extractSearchParams(window.location.href);

    // Keywords, location, or workplace filter (e.g. Remote via f_WT) count as valid
    const hasWorkplace =
      params.filters && params.filters.workplaceType;
    if (!params.keywords && !params.location && !hasWorkplace) {
      return null;
    }

    return {
      ...params,
      url:
        window.location.href.split("?")[0] +
        "?" +
        new URL(window.location.href).search,
    };
  }

  /**
   * Generate unique ID for search
   * @returns {string}
   */
  generateId() {
    return (
      "search_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * Clear all saved searches (for testing/reset)
   */
  async clearAll() {
    try {
      await chrome.storage.local.remove([this.STORAGE_KEY]);
      console.log("SavedSearchesManager: All searches cleared");
      return { success: true };
    } catch (error) {
      console.error("SavedSearchesManager: Error clearing searches:", error);
      return {
        success: false,
        error: "Failed to clear searches: " + error.message,
      };
    }
  }

  /**
   * Get statistics
   * @returns {Object} - Stats object
   */
  async getStats() {
    try {
      const searches = await this.getAllSearches();
      return {
        total: searches.length,
        available: this.MAX_SEARCHES - searches.length,
        maxAllowed: this.MAX_SEARCHES,
      };
    } catch (error) {
      console.error("SavedSearchesManager: Error getting stats:", error);
      return {
        total: 0,
        available: this.MAX_SEARCHES,
        maxAllowed: this.MAX_SEARCHES,
      };
    }
  }
}

// Make available globally
if (typeof window !== "undefined") {
  window.SavedSearchesManager = SavedSearchesManager;
}
