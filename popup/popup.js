/**
 * Popup script for LinkedIn Text Formatter extension
 * Handles saved job searches display and management
 */

// Initialize on load
document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSearches();
  await checkCurrentPage();
  setupEventListeners();
  await loadToolbarSettings();
  await loadCasperStatus();
  await loadPopupAiStatus();

  // Casper chat button
  const openChatBtn = document.getElementById("openCasperChat");
  if (openChatBtn) {
    openChatBtn.addEventListener("click", openCasperChat);
  }

  // Setup CSP-compliant hover effects
  setupCasperSettingsLinkHover();
});

/**
 * Compact AI status line for popup header
 */
async function loadPopupAiStatus() {
  const el = document.getElementById("popupAiStatus");
  if (!el) return;
  try {
    const data = await chrome.storage.local.get([
      "active_provider",
      "gemini_api_key",
      "openai_api_key",
      "openrouter_api_key",
    ]);
    const provider = data.active_provider || null;
    const ready =
      (provider === "gemini" && data.gemini_api_key) ||
      (provider === "openai" && data.openai_api_key) ||
      (provider === "openrouter" && data.openrouter_api_key);
    el.textContent = ready
      ? `AI: ${provider} · ready`
      : "AI: not configured — open AI Keys";
  } catch (e) {
    el.textContent = "AI: —";
  }
}

/**
 * Load and display saved searches
 */
async function loadSavedSearches() {
  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];

    const listContainer = document.getElementById("savedSearchesList");
    const emptyContainer = document.getElementById("savedSearchesEmpty");
    const slotInfo = document.getElementById("searchSlotInfo");

    // Update slot info
    const MAX_SEARCHES =
      (typeof SavedSearchUtils !== "undefined" &&
        SavedSearchUtils.MAX_SAVED_SEARCHES) ||
      5;
    const available = MAX_SEARCHES - searches.length;
    slotInfo.textContent = `${searches.length}/${MAX_SEARCHES} slots used`;

    if (searches.length === 0) {
      listContainer.style.display = "none";
      emptyContainer.style.display = "block";
    } else {
      listContainer.style.display = "block";
      emptyContainer.style.display = "none";
      listContainer.innerHTML = "";

      searches.forEach((search) => {
        const item = createSearchItem(search);
        listContainer.appendChild(item);
      });
    }
  } catch (error) {
    console.error("Error loading saved searches:", error);
  }
}

/**
 * Create search item element
 */
function createSearchItem(search) {
  const item = document.createElement("div");
  item.className = "saved-search-item";

  // Extract display info
  const keywords = search.keywords || "All Jobs";
  const location =
    typeof SavedSearchUtils !== "undefined"
      ? SavedSearchUtils.getLocationDisplay(search)
      : search.location || "All Locations";
  const details =
    typeof SavedSearchUtils !== "undefined"
      ? SavedSearchUtils.getDetailsLine(search)
      : `${keywords} • ${location}`;

  item.innerHTML = `
    <div class="saved-search-info">
      <div class="saved-search-name">${escapeHtml(search.name)}</div>
      <div class="saved-search-details">${escapeHtml(details)}</div>
    </div>
    <div class="saved-search-actions">
      <button class="saved-search-btn btn-run" data-id="${
        search.id
      }">▶ Run</button>
      <button class="saved-search-btn btn-delete" data-id="${
        search.id
      }">✕</button>
    </div>
  `;

  // Add event listeners
  const runBtn = item.querySelector(".btn-run");
  const deleteBtn = item.querySelector(".btn-delete");

  runBtn.addEventListener("click", () => runSearch(search));
  deleteBtn.addEventListener("click", () => deleteSearch(search.id));

  return item;
}

/**
 * Run a saved search
 */
async function runSearch(search) {
  try {
    // Update run stats
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const index = searches.findIndex((s) => s.id === search.id);

    if (index !== -1) {
      searches[index].lastRun = Date.now();
      searches[index].runCount = (searches[index].runCount || 0) + 1;
      await chrome.storage.local.set({ saved_job_searches: searches });
    }

    // Open search URL in new tab
    await chrome.tabs.create({ url: search.url });
    window.close();
  } catch (error) {
    console.error("Error running search:", error);
    alert("Failed to run search");
  }
}

/**
 * Delete a saved search
 */
async function deleteSearch(searchId) {
  if (!confirm("Delete this saved search?")) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const filtered = searches.filter((s) => s.id !== searchId);

    await chrome.storage.local.set({ saved_job_searches: filtered });

    // Clean up notification counts
    const countResult = await chrome.storage.local.get([
      "notification_job_counts",
    ]);
    const counts = countResult.notification_job_counts || {};
    if (counts[searchId]) {
      delete counts[searchId];
      await chrome.storage.local.set({ notification_job_counts: counts });
    }

    // Reload list
    await loadSavedSearches();
    await checkCurrentPage();
  } catch (error) {
    console.error("Error deleting search:", error);
    alert("Failed to delete search");
  }
}

/**
 * Check current page and show save button if on job search
 */
async function checkCurrentPage() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    const saveButton = document.getElementById("saveSearchButton");

    if (!tab || !tab.url) {
      saveButton.style.display = "none";
      return;
    }

    // Check if on LinkedIn job search page
    const isJobSearch = tab.url.includes("linkedin.com/jobs/search");

    if (isJobSearch) {
      // Check if can add more searches
      const result = await chrome.storage.local.get(["saved_job_searches"]);
      const searches = result.saved_job_searches || [];
      const MAX_SEARCHES =
        (typeof SavedSearchUtils !== "undefined" &&
          SavedSearchUtils.MAX_SAVED_SEARCHES) ||
        5;

      if (searches.length < MAX_SEARCHES) {
        saveButton.style.display = "block";
      } else {
        saveButton.style.display = "none";
      }
    } else {
      saveButton.style.display = "none";
    }
  } catch (error) {
    console.error("Error checking current page:", error);
  }
}

/**
 * Save current search
 */
async function saveCurrentSearch() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url || !tab.url.includes("linkedin.com/jobs/search")) {
      alert("Please navigate to a LinkedIn job search page first");
      return;
    }

    // Extract search params from URL
    const url = new URL(tab.url);
    const params = url.searchParams;

    const rawKeywords = params.get("keywords") || "";
    const rawLocation = params.get("location") || "";
    const filters = {
      timePosted: params.get("f_TPR") || "",
      experienceLevel: params.get("f_E") || "",
      jobType: params.get("f_JT") || "",
      workplaceType: params.get("f_WT") || "",
    };

    const normalized =
      typeof SavedSearchUtils !== "undefined"
        ? SavedSearchUtils.normalizeSearchFields({
            keywords: rawKeywords,
            location: rawLocation,
            geoId: params.get("geoId") || "",
            filters,
            url: tab.url,
          })
        : {
            keywords: rawKeywords,
            location: rawLocation,
            geoId: params.get("geoId") || "",
            filters,
            url: tab.url,
          };

    if (
      !normalized.keywords &&
      !normalized.location &&
      !(normalized.filters && normalized.filters.workplaceType)
    ) {
      alert(
        "This search has no keywords or location. Please add search criteria first."
      );
      return;
    }

    // Prompt for name
    const defaultName = normalized.keywords
      ? `${normalized.keywords} jobs`
      : normalized.location
        ? `${normalized.location} jobs`
        : "Job search";
    const name = prompt("Name your saved search:", defaultName);

    if (!name || name.trim() === "") {
      return; // User cancelled
    }

    // Create search object (location derived from f_WT when Remote etc.)
    const search = {
      id:
        "search_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      keywords: normalized.keywords,
      location: normalized.location,
      geoId: normalized.geoId,
      filters: normalized.filters,
      url: normalized.url,
      dateCreated: Date.now(),
      lastRun: null,
      runCount: 0,
    };

    // Save to storage
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const MAX_SEARCHES =
      (typeof SavedSearchUtils !== "undefined" &&
        SavedSearchUtils.MAX_SAVED_SEARCHES) ||
      5;

    if (searches.length >= MAX_SEARCHES) {
      alert(
        `Maximum ${MAX_SEARCHES} saved searches allowed. Please delete one first.`
      );
      return;
    }

    searches.push(search);
    await chrome.storage.local.set({ saved_job_searches: searches });

    // Initialize notification job count (silent baseline)
    try {
      const countResult = await chrome.storage.local.get([
        "notification_job_counts",
      ]);
      const counts = countResult.notification_job_counts || {};

      // Extract job count from page if possible
      chrome.tabs.sendMessage(tab.id, { action: "getJobCount" }, (response) => {
        // Check for connection errors (content script not loaded)
        if (chrome.runtime.lastError) {
          // Silently ignore - page may not be ready yet
          return;
        }
        if (response && response.count) {
          counts[search.id] = response.count;
          chrome.storage.local.set({ notification_job_counts: counts });
        }
      });
    } catch (e) {
      // Non-critical, continue
    }

    // Reload list
    await loadSavedSearches();
    await checkCurrentPage();

    alert("Search saved successfully!");
  } catch (error) {
    console.error("Error saving search:", error);
    alert("Failed to save search: " + error.message);
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  const saveBtn = document.getElementById("saveCurrentSearch");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveCurrentSearch);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Load and setup toolbar settings
 */
async function loadToolbarSettings() {
  try {
    // Load saved settings
    const result = await chrome.storage.local.get([
      "toolbarEnabled",
      "toolbarTheme",
      "toolbarLocations",
      "atsCheckerEnabled",
    ]);
    const toolbarEnabled = result.toolbarEnabled !== false; // Default true if undefined
    const toolbarTheme = result.toolbarTheme || "light"; // Default light
    const toolbarLocations =
      result.toolbarLocations === "posts" ||
      result.toolbarLocations === "comments" ||
      result.toolbarLocations === "both"
        ? result.toolbarLocations
        : "both";
    const atsCheckerEnabled = result.atsCheckerEnabled !== false; // Default true if undefined

    // Set UI state for toolbar enabled
    const enabledCheckbox = document.getElementById("toolbarEnabled");
    const lightRadio = document.getElementById("themeLight");
    const darkRadio = document.getElementById("themeDark");
    const locBoth = document.getElementById("toolbarLocBoth");
    const locPosts = document.getElementById("toolbarLocPosts");
    const locComments = document.getElementById("toolbarLocComments");

    if (enabledCheckbox) {
      enabledCheckbox.checked = toolbarEnabled;
      enabledCheckbox.addEventListener("change", async (e) => {
        await chrome.storage.local.set({ toolbarEnabled: e.target.checked });
      });
    }

    if (locBoth && locPosts && locComments) {
      if (toolbarLocations === "posts") locPosts.checked = true;
      else if (toolbarLocations === "comments") locComments.checked = true;
      else locBoth.checked = true;

      const locHandler = async (e) => {
        if (!e.target.checked) return;
        await chrome.storage.local.set({ toolbarLocations: e.target.value });
      };
      locBoth.addEventListener("change", locHandler);
      locPosts.addEventListener("change", locHandler);
      locComments.addEventListener("change", locHandler);
    }

    // Set UI state for ATS Checker
    const atsCheckerCheckbox = document.getElementById("atsCheckerEnabled");
    if (atsCheckerCheckbox) {
      atsCheckerCheckbox.checked = atsCheckerEnabled;
      atsCheckerCheckbox.addEventListener("change", async (e) => {
        await chrome.storage.local.set({ atsCheckerEnabled: e.target.checked });
      });
    }

    if (lightRadio && darkRadio) {
      if (toolbarTheme === "dark") {
        darkRadio.checked = true;
      } else {
        lightRadio.checked = true;
      }

      const themeHandler = async (e) => {
        await chrome.storage.local.set({ toolbarTheme: e.target.value });
      };

      lightRadio.addEventListener("change", themeHandler);
      darkRadio.addEventListener("change", themeHandler);
    }
  } catch (error) {
    console.error("Error loading toolbar settings:", error);
  }
}

/**
 * Load and display Casper status
 */
async function loadCasperStatus() {
  try {
    const result = await chrome.storage.local.get([
      "casper_enabled",
      "casper_show_post_buttons",
    ]);
    const isEnabled = result.casper_enabled === true;
    const showPostButtons = result.casper_show_post_buttons !== false; // Default true

    const enabledSection = document.getElementById("casperEnabled");
    const disabledSection = document.getElementById("casperDisabled");

    if (isEnabled) {
      enabledSection.style.display = "block";
      disabledSection.style.display = "none";

      // Set toggle state
      const toggle = document.getElementById("casperPostButtonsToggle");
      if (toggle) {
        toggle.checked = showPostButtons;

        // Add event listener for toggle
        toggle.addEventListener("change", async (e) => {
          const newState = e.target.checked;
          await chrome.storage.local.set({
            casper_show_post_buttons: newState,
          });

          // Show reload notice
          const reloadNotice = document.getElementById("casperReloadNotice");
          if (reloadNotice) {
            reloadNotice.style.display = "block";

            // Hide after 5 seconds
            setTimeout(() => {
              reloadNotice.style.display = "none";
            }, 5000);
          }

          // Inject or remove CSS in active LinkedIn tabs
          const tabs = await chrome.tabs.query({
            url: "https://www.linkedin.com/*",
          });
          for (const tab of tabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: "toggleCasperPostButtons",
                show: newState,
              });
            } catch (error) {
              // Silently ignore tabs where content script isn't loaded yet
              // This is expected when page is still loading or extension just installed
              if (
                error.message?.includes("Could not establish connection") ||
                error.message?.includes("Receiving end does not exist")
              ) {
                // Content script not ready yet - user can refresh to apply changes
              } else {
                console.warn(
                  "Failed to send message to tab:",
                  tab.id,
                  error.message
                );
              }
            }
          }
        });
      }
    } else {
      enabledSection.style.display = "none";
      disabledSection.style.display = "block";
    }
  } catch (error) {
    console.error("Error loading Casper status:", error);
  }
}

/**
 * Open Casper chat on LinkedIn
 */
async function openCasperChat() {
  try {
    // Get the active LinkedIn tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url?.includes("linkedin.com")) {
      alert("Please open a LinkedIn page first!");
      return;
    }

    // Send message to content script to open Casper
    chrome.tabs.sendMessage(tab.id, { action: "openCasper" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error opening Casper:", chrome.runtime.lastError);
        alert(
          "⚠️ Could not connect to LinkedIn page.\n\nPlease:\n1. Refresh the LinkedIn page\n2. Make sure Casper is enabled in Settings\n3. Try again"
        );
      } else if (response && response.success) {
        // Close popup after opening chat
        window.close();
      } else if (response && response.error) {
        alert("⚠️ " + response.error + "\n\nGo to Settings to enable Casper.");
      } else {
        alert("⚠️ Unexpected error. Please refresh LinkedIn and try again.");
      }
    });
  } catch (error) {
    console.error("Error opening Casper chat:", error);
    alert("Failed to open Casper. Please refresh LinkedIn and try again.");
  }
}

/**
 * Add hover effect to Casper settings link (CSP-compliant)
 */
function setupCasperSettingsLinkHover() {
  const link = document.getElementById("casperSettingsLink");
  if (link) {
    link.addEventListener("mouseover", () => {
      link.style.color = "#764ba2";
    });
    link.addEventListener("mouseout", () => {
      link.style.color = "#667eea";
    });
  }
}
