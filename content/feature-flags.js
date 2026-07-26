/**
 * Feature flags — soft-fail kill switches for LinkedIn injectors.
 * Defaults keep all existing product features ON unless explicitly disabled.
 */
(function (global) {
  const STORAGE_KEY = "feature_flags";

  const DEFAULTS = {
    formatter: true,
    ats: true,
    casper: true,
    filterPill: true,
    savedSearches: true,
    notifications: true,
    authorWidget: false,
    jobBoardWidget: false,
    jobTracker: true,
    trackerAlertIngest: true,
    trackerApplicantRefresh: false,
    trackerExpiryRefresh: false,
    companyPeople: false,
    feedJobDiscover: false,
  };

  let cache = null;
  let loadPromise = null;

  async function load() {
    if (cache) return cache;
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      try {
        const result = await chrome.storage.local.get([STORAGE_KEY]);
        cache = { ...DEFAULTS, ...(result[STORAGE_KEY] || {}) };
      } catch (e) {
        const msg = String((e && e.message) || e || "");
        // Orphaned content script after extension reload — do not cache kill-switch defaults
        if (/extension context invalidated/i.test(msg)) {
          loadPromise = null;
          throw e;
        }
        console.warn("FeatureFlags: load failed, using defaults", e);
        cache = { ...DEFAULTS };
      }
      return cache;
    })();
    return loadPromise;
  }

  async function isEnabled(name) {
    const flags = await load();
    return flags[name] !== false;
  }

  function isEnabledSync(name) {
    if (!cache) return DEFAULTS[name] !== false;
    return cache[name] !== false;
  }

  async function setFlags(partial) {
    const flags = await load();
    cache = { ...flags, ...partial };
    await chrome.storage.local.set({ [STORAGE_KEY]: cache });
    return cache;
  }

  function invalidate() {
    cache = null;
    loadPromise = null;
  }

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local" && changes[STORAGE_KEY]) invalidate();
    });
  } catch (e) {}

  // Warm cache early (non-blocking)
  load().catch(() => {});

  global.FeatureFlags = {
    STORAGE_KEY,
    DEFAULTS,
    load,
    isEnabled,
    isEnabledSync,
    setFlags,
    invalidate,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
