/**
 * LinkedIn Text Formatter & Image Upload Extension
 * Main content script - Handles toolbar injection and functionality
 */

// Global error handlers for extension context issues
window.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  if (
    error?.message?.includes("Extension context invalidated") ||
    error?.message?.includes("Could not establish connection")
  ) {
    event.preventDefault(); // Suppress the error
    console.log(
      "Extension was reloaded. Please refresh the page for full functionality."
    );
  }
});

class LinkedInFormatter {
  constructor() {
    this.toolbar = null;
    this.editor = null;
    this.isToolbarVisible = false;
    this.isToolbarCollapsed = false;
    this.toolbarLocations = "both"; // both | posts | comments
    this.apiData = {}; // Store intercepted API data
    this.init();
  }

  /**
   * Whether toolbar should appear for this editor kind (share/comment)
   */
  shouldShowToolbarFor(kind) {
    const loc = this.toolbarLocations || "both";
    if (loc === "posts") return kind === "share";
    if (loc === "comments") return kind === "comment";
    return true; // both
  }

  /**
   * Initialize the extension
   */
  async init() {
    console.log("LinkedIn Formatter: Initializing...");

    // Only intercept API and show job stats on job-related pages (independent of toolbar)
    const isJobPage = window.location.href.includes("/jobs/");
    if (isJobPage) {
      // Check if ATS Checker is enabled for job analysis
      try {
        const atsResult = await chrome.storage.local.get(["atsCheckerEnabled"]);
        const atsCheckerEnabled = atsResult.atsCheckerEnabled !== false; // Default true

        if (atsCheckerEnabled) {
          this.interceptLinkedInAPI();
          this.initJobStats();
        } else {
          console.log("LinkedIn Formatter: ATS Checker disabled by user");
        }
      } catch (error) {
        console.error(
          "LinkedIn Formatter: Error checking ATS settings, proceeding with enabled",
          error
        );
        // Fallback: still initialize if error checking settings
        this.interceptLinkedInAPI();
        this.initJobStats();
      }
    }

    // Check if toolbar is enabled for text formatting features
    try {
      const result = await chrome.storage.local.get([
        "toolbarEnabled",
        "toolbarLocations",
      ]);
      const toolbarEnabled = result.toolbarEnabled !== false; // Default true if undefined
      const loc = result.toolbarLocations;
      this.toolbarLocations =
        loc === "posts" || loc === "comments" || loc === "both" ? loc : "both";


      if (!toolbarEnabled) {
        console.log("LinkedIn Formatter: Toolbar disabled by user");
        // Don't return - continue to initialize Casper and other features
      } else {
        // Only initialize toolbar-related features if enabled
        this.waitForEditor();
        this.setupClipboardListener();
        this.initJobFilters();
      }

      // Live-update location preference without full page reload when possible
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes.toolbarLocations) {
          const v = changes.toolbarLocations.newValue;
          this.toolbarLocations =
            v === "posts" || v === "comments" || v === "both" ? v : "both";
          if (typeof this.resyncToolbars === "function") {
            this.resyncToolbars("settings");
          }
        }
        if (changes.toolbarTheme && this.editorToolbars?.size) {
          for (const [, meta] of this.editorToolbars) {
            const prev = this.toolbar;
            this.toolbar = meta.toolbar;
            this.applyToolbarTheme();
            this.toolbar = prev;
          }
        }
      });
    } catch (error) {
      console.error(
        "LinkedIn Formatter: Error checking toolbar settings, proceeding with toolbar enabled",
        error
      );
      // Fallback: still initialize toolbar features
      this.waitForEditor();
      this.setupClipboardListener();
      this.initJobFilters();
    }

    // Initialize Casper AI (safe to fail, independent of toolbar and ATS settings)
    try {
      if (typeof CasperManager !== "undefined") {
        window.casperInstance = new CasperManager();
        await window.casperInstance.init();
        console.log("LinkedIn Formatter: Casper initialized successfully");


        // Apply post buttons visibility setting
        this.applyCasperPostButtonsVisibility();
      }
    } catch (error) {
      console.error(
        "LinkedIn Formatter: Casper initialization failed (non-critical):",
        error
      );
    }
  }

  /**
   * Apply Casper post buttons visibility based on user setting
   */
  async applyCasperPostButtonsVisibility() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.log("Casper: Extension context invalidated, skipping");
        return;
      }

      const result = await chrome.storage.local.get([
        "casper_show_post_buttons",
      ]);
      const showButtons = result.casper_show_post_buttons !== false; // Default true

      const styleId = "casper-post-buttons-style";
      const existingStyle = document.getElementById(styleId);

      if (existingStyle) {
        existingStyle.remove();
      }

      if (!showButtons) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          .feed-shared-social-action-bar__action-button:has(.casper-analyze-icon) {
            display: none !important;
          }
        `;
        document.head.appendChild(style);
        console.log("Casper: Post buttons hidden (user preference)");
      }
    } catch (error) {
      // Silent fail if extension context is invalidated
      if (error.message?.includes("Extension context invalidated")) {
        console.log("Casper: Extension reloaded, please refresh page");
      } else {
        console.error("Casper: Error applying button visibility:", error);
      }
    }
  }

  /**
   * Intercept LinkedIn API calls to get real-time job data
   */
  interceptLinkedInAPI() {
    console.log("LinkedIn Formatter: Setting up API interceptor...");

    // Store original fetch
    const originalFetch = window.fetch;
    const self = this;

    // Override fetch to intercept responses
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      // Clone response so we can read it without consuming it
      const clonedResponse = response.clone();
      const url = args[0];

      // Check if this is a LinkedIn job API call - broader matching
      if (typeof url === "string" && url.includes("linkedin.com")) {
        const isJobAPI =
          (url.includes("voyager") && url.includes("job")) ||
          url.includes("Jobs") ||
          url.includes("jobPosting") ||
          url.includes("jobView") ||
          url.includes("jobCard") ||
          url.includes("decoration");

        if (isJobAPI) {
          try {
            const data = await clonedResponse.json();
            console.log(
              "LinkedIn Formatter: ✅ Intercepted fetch API:",
              url.substring(0, 100) + "..."
            );
            console.log("LinkedIn Formatter: API Response data:", data);

            // Extract job data from response
            self.extractAPIJobData(data, url);
          } catch (e) {
            console.log(
              "LinkedIn Formatter: Could not parse fetch response:",
              e.message
            );
          }
        }
      }

      return response;
    };

    // Also intercept XHR requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this._url = url;
      return originalXHROpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener("load", function () {
        if (
          this._url &&
          typeof this._url === "string" &&
          this._url.includes("linkedin.com")
        ) {
          const isJobAPI =
            (this._url.includes("voyager") && this._url.includes("job")) ||
            this._url.includes("Jobs") ||
            this._url.includes("jobPosting") ||
            this._url.includes("jobView") ||
            this._url.includes("jobCard") ||
            this._url.includes("decoration");

          if (isJobAPI) {
            try {
              const data = JSON.parse(this.responseText);
              console.log(
                "LinkedIn Formatter: ✅ Intercepted XHR API:",
                this._url.substring(0, 100) + "..."
              );
              console.log("LinkedIn Formatter: XHR Response data:", data);
              self.extractAPIJobData(data, this._url);
            } catch (e) {
              console.log(
                "LinkedIn Formatter: Could not parse XHR response:",
                e.message
              );
            }
          }
        }
      });

      return originalXHRSend.apply(this, args);
    };
  }

  /**
   * Extract job data from intercepted API responses
   */
  extractAPIJobData(data, url) {
    try {
      console.log("LinkedIn Formatter: 🔍 Parsing API data structure...");

      let foundData = false;

      // Look for all possible applicant/view count fields
      const findJobData = (obj, path = "", depth = 0) => {
        if (!obj || typeof obj !== "object" || depth > 20) return;

        // List of all possible field names for applicants
        const applicantFields = [
          "appliedCount",
          "numApplicants",
          "applicantCount",
          "totalApplicants",
          "applies",
          "numApplies",
          "applicationCount",
          "totalApplications",
        ];

        // List of all possible field names for views
        const viewFields = [
          "viewCount",
          "numViews",
          "totalViews",
          "views",
          "impressions",
          "viewerCount",
        ];

        // Check all applicant fields
        for (const field of applicantFields) {
          if (field in obj && typeof obj[field] === "number") {
            console.log(
              `LinkedIn Formatter: ✅ Found ${field}: ${obj[field]} at path: ${path}`
            );
            this.apiData.appliedCount = obj[field];
            foundData = true;
          }
        }

        // Check all view fields
        for (const field of viewFields) {
          if (field in obj && typeof obj[field] === "number") {
            console.log(
              `LinkedIn Formatter: ✅ Found ${field}: ${obj[field]} at path: ${path}`
            );
            this.apiData.viewCount = obj[field];
            foundData = true;
          }
        }

        // Special check for text fields that might contain counts
        if (typeof obj === "string" && obj.match(/\d+\s*applicant/i)) {
          const match = obj.match(/(\d+)\s*applicant/i);
          if (match) {
            console.log(
              `LinkedIn Formatter: ✅ Found applicant in text: ${match[1]}`
            );
            this.apiData.appliedCount = parseInt(match[1]);
            foundData = true;
          }
        }

        // Recursively search nested objects and arrays
        for (const key in obj) {
          if (typeof obj[key] === "object" && obj[key] !== null) {
            const newPath = path ? `${path}.${key}` : key;
            findJobData(obj[key], newPath, depth + 1);
          }
        }
      };

      findJobData(data);

      // Update display if we found new data
      if (foundData && Object.keys(this.apiData).length > 0) {
        console.log("LinkedIn Formatter: 🎯 FOUND API DATA:", this.apiData);
        this.updateStatsBoxWithAPIData();

        // Also trigger a stats box refresh if it exists
        setTimeout(() => {
          if (
            this.isJobDetailPage() &&
            !document.querySelector(".lf-job-stats-box")
          ) {
            console.log(
              "LinkedIn Formatter: Refreshing stats box with new API data"
            );
            this.displayJobStats();
          }
        }, 500);
      } else {
        console.log(
          "LinkedIn Formatter: ⚠️ No applicant/view data found in this API response"
        );
      }
    } catch (error) {
      console.error("LinkedIn Formatter: Error parsing API data:", error);
    }
  }

  /**
   * Try to extract data from embedded JSON in page scripts
   */
  tryExtractFromPageScripts() {
    try {
      console.log("LinkedIn Formatter: Searching for embedded JSON data...");

      // Check script tags for JSON data
      const scripts = document.querySelectorAll(
        'script[type="application/json"]'
      );
      scripts.forEach((script, index) => {
        try {
          const jsonData = JSON.parse(script.textContent);
          console.log(`LinkedIn Formatter: Checking script tag ${index}...`);
          this.extractAPIJobData(jsonData, "embedded-json");
        } catch (e) {
          // Not valid JSON, skip
        }
      });

      // Also check for data in code/script tags
      const allScripts = document.querySelectorAll("script");
      allScripts.forEach((script) => {
        const content = script.textContent;
        // Look for applicant count patterns in JavaScript
        const applicantMatch = content.match(
          /"(?:appliedCount|numApplicants|applicantCount)"\s*:\s*(\d+)/
        );
        if (applicantMatch) {
          console.log(
            "LinkedIn Formatter: ✅ Found applicant count in script:",
            applicantMatch[1]
          );
          this.apiData.appliedCount = parseInt(applicantMatch[1]);
        }

        const viewMatch = content.match(/"(?:viewCount|numViews)"\s*:\s*(\d+)/);
        if (viewMatch) {
          console.log(
            "LinkedIn Formatter: ✅ Found view count in script:",
            viewMatch[1]
          );
          this.apiData.viewCount = parseInt(viewMatch[1]);
        }
      });
    } catch (error) {
      console.log("LinkedIn Formatter: Error extracting from scripts:", error);
    }
  }

  /**
   * Update the stats box with live API data
   */
  updateStatsBoxWithAPIData() {
    const statsBox = document.querySelector(".lf-job-stats-box");
    if (!statsBox) return;

    // Find the applicants stat item
    const statItems = statsBox.querySelectorAll(".lf-stat-item");
    statItems.forEach((item) => {
      const label = item.querySelector(".lf-stat-label");
      const value = item.querySelector(".lf-stat-value");

      if (label && label.textContent.includes("Applicants")) {
        // Update with API data
        if (this.apiData.appliedCount !== undefined) {
          value.textContent = `${this.apiData.appliedCount} applicants`;
          value.style.color = "#059669";
          value.style.fontWeight = "700";
        } else if (this.apiData.numApplicants !== undefined) {
          value.textContent = `${this.apiData.numApplicants} applicants`;
          value.style.color = "#059669";
          value.style.fontWeight = "700";
        } else if (this.apiData.applicantCount !== undefined) {
          value.textContent = `${this.apiData.applicantCount} applicants`;
          value.style.color = "#059669";
          value.style.fontWeight = "700";
        }
      }

      if (label && label.textContent.includes("Views")) {
        // Update with API view data
        if (this.apiData.viewCount !== undefined) {
          value.textContent = `${this.apiData.viewCount} views`;
          value.style.color = "#7c3aed";
          value.style.fontWeight = "700";
        } else if (this.apiData.numViews !== undefined) {
          value.textContent = `${this.apiData.numViews} views`;
          value.style.color = "#7c3aed";
          value.style.fontWeight = "700";
        }
      }
    });
  }

  /**
   * Wait for LinkedIn post editor to appear using MutationObserver
   */
  waitForEditor() {
    // Multi-editor support: Create-post Quill modal AND TipTap comments.
    if (!this.editorToolbars) this.editorToolbars = new Map();

    const queryDeep = (selector, root = document) => {
      const results = [];
      const roots = [root];
      // Only pierce known LinkedIn interop shells — full * walk is too expensive
      try {
        root
          .querySelectorAll(
            '#artdeco-modal-outlet, [data-testid="interop-shadowdom"], [data-test-modal-id="sharebox"]'
          )
          .forEach((el) => {
            if (el.shadowRoot) roots.push(el.shadowRoot);
          });
      } catch (_) {}
      roots.forEach((r) => {
        try {
          results.push(...r.querySelectorAll(selector));
        } catch (_) {}
      });
      return results;
    };

    const discoverEditors = () => {
      const out = [];
      const add = (el, kind) => {
        if (!el || el.classList?.contains("ql-clipboard")) return;
        // Skip non-editable shells
        if (
          el.getAttribute("contenteditable") === "false" ||
          el.getAttribute("contenteditable") === "inherit"
        ) {
          return;
        }
        if (out.some((x) => x.el === el)) return;
        out.push({ el, kind });
      };

      const inShareContext = (el) =>
        !!(
          el.closest?.(
            [
              ".share-box",
              ".share-creation-state",
              ".share-box-v2__modal",
              '[data-test-modal-id="sharebox"]',
              "#artdeco-modal-outlet .artdeco-modal",
              '[aria-labelledby="share-to-linkedin-modal__header"]',
            ].join(",")
          ) || el.closest?.("#artdeco-modal-outlet")
        );

      // 1) Explicit share / create-post Quill editors (attribute optional —
      //    modal sometimes mounts .ql-editor before contenteditable flips)
      queryDeep(
        [
          "#artdeco-modal-outlet .ql-editor",
          '[data-test-modal-id="sharebox"] .ql-editor',
          ".share-box .ql-editor",
          ".share-creation-state .ql-editor",
          ".share-box-v2__modal .ql-editor",
          '.ql-editor[data-test-ql-editor-contenteditable="true"]',
          '.ql-editor[aria-label="Text editor for creating content"]',
          '.ql-editor[data-placeholder*="talk about"]',
          '.ql-editor[aria-placeholder*="talk about"]',
        ].join(",")
      ).forEach((el) => add(el, "share"));

      // 2) Any textbox labeled as create-post content
      queryDeep(
        '[contenteditable="true"][role="textbox"], [contenteditable="true"].ql-editor, [contenteditable="true"].ProseMirror, [contenteditable="true"].tiptap'
      ).forEach((el) => {
        const label = (
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-placeholder") ||
          el.getAttribute("data-placeholder") ||
          ""
        ).toLowerCase();
        if (
          label.includes("creating content") ||
          label.includes("talk about") ||
          label.includes("what do you want")
        ) {
          add(el, "share");
          return;
        }
        if (inShareContext(el) && !label.includes("comment")) {
          add(el, "share");
          return;
        }
        if (label.includes("comment") || label.includes("creating comment")) {
          add(el, "comment");
          return;
        }
        if (
          el.classList.contains("ProseMirror") ||
          el.classList.contains("tiptap")
        ) {
          if (!inShareContext(el)) add(el, "comment");
        }
      });

      // 3) Same-origin iframes (interop)
      document.querySelectorAll("iframe").forEach((frame) => {
        try {
          const doc = frame.contentDocument;
          if (!doc) return;
          doc
            .querySelectorAll(
              '#artdeco-modal-outlet .ql-editor, [data-test-modal-id="sharebox"] .ql-editor, .share-box .ql-editor, .ql-editor[data-test-ql-editor-contenteditable="true"]'
            )
            .forEach((el) => add(el, "share"));
        } catch (_) {
          /* cross-origin */
        }
      });

      return out;
    };

    const tryInject = (editor, source, kind) => {
      if (!editor || this.editorToolbars.has(editor)) return;
      if (!this.shouldShowToolbarFor(kind)) {
        return;
      }
      console.log("LinkedIn Formatter: Editor detected via", source, kind);
      const toolbar = this.injectToolbarFor(editor, kind);
      if (!toolbar) return;
      this.editorToolbars.set(editor, { toolbar, kind });
      this.editor = editor;
      this.editorKind = kind;
      this.toolbar = toolbar;
      this.isToolbarVisible = this.editorToolbars.size > 0;
    };

    let syncScheduled = false;
    let needsResync = false;
    const syncToolbar = (source) => {
      const run = () => {
        syncScheduled = false;
        const found = discoverEditors();
        const live = new Set(found.map((f) => f.el));


        for (const [editor, meta] of [...this.editorToolbars.entries()]) {
          if (
            !live.has(editor) ||
            !editor.isConnected ||
            !this.shouldShowToolbarFor(meta.kind)
          ) {
            meta.toolbar?.remove();
            this.editorToolbars.delete(editor);
          }
        }

        for (const { el, kind } of found) {
          tryInject(el, source, kind);
        }

        const focused = found.find(
          (f) =>
            f.el === document.activeElement ||
            f.el.contains?.(document.activeElement)
        );
        // Prefer share editor when present
        const shareFirst = found.find((f) => f.kind === "share");
        const active = focused || shareFirst || found[0];
        if (active) {
          this.editor = active.el;
          this.editorKind = active.kind;
          this.toolbar = this.editorToolbars.get(active.el)?.toolbar || null;
        } else {
          this.editor = null;
          this.toolbar = null;
        }
        this.isToolbarVisible = this.editorToolbars.size > 0;

        if (needsResync) {
          needsResync = false;
          requestAnimationFrame(run);
          syncScheduled = true;
        }
      };

      if (source === "mutation") {
        if (syncScheduled) {
          needsResync = true; // trailing edge — don't drop late modal mounts
          return;
        }
        syncScheduled = true;
        requestAnimationFrame(run);
      } else {
        run();
      }
    };

    this.resyncToolbars = syncToolbar;

    const observer = new MutationObserver(() => syncToolbar("mutation"));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["contenteditable", "class", "aria-hidden", "style"],
    });

    // Watch modal outlet separately when it exists / appears
    const watchModalOutlet = () => {
      const outlet = document.getElementById("artdeco-modal-outlet");
      if (outlet && !outlet._lfObserved) {
        outlet._lfObserved = true;
        observer.observe(outlet, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["contenteditable", "class", "aria-hidden"],
        });
      }
    };
    watchModalOutlet();

    this._sharePoll = setInterval(() => {
      watchModalOutlet();
      syncToolbar("poll");
    }, 800);

    document.addEventListener(
      "click",
      (e) => {
        const t = e.target?.closest?.(
          'button, [role="button"], a, .share-box-feed-entry__trigger'
        );
        if (!t) return;
        const label = (
          t.getAttribute("aria-label") ||
          t.textContent ||
          ""
        ).toLowerCase();
        if (
          label.includes("start a post") ||
          label.includes("post") ||
          label.includes("share") ||
          label.includes("comment") ||
          t.closest(".share-box-feed-entry")
        ) {
          [200, 500, 1000, 2000, 3500].forEach((ms, i) => {
            setTimeout(() => syncToolbar(`click-${i}`), ms);
          });
        }
      },
      true
    );

    syncToolbar("existing");
  }

  /**
   * Root for toolbar queries (shadow DOM when used)
   */
  getToolbarRoot(toolbar = this.toolbar) {
    return toolbar?.shadowRoot || toolbar;
  }

  /**
   * Isolated CSS so LinkedIn modal styles cannot break the toolbar layout
   */
  getIsolatedToolbarCSS() {
    return `
      :host { all: initial; display: block; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
      * { box-sizing: border-box; }
      .lf-toolbar-container {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        align-items: center !important;
        gap: 8px !important;
        padding: 8px 12px !important;
        background: #f3f6f8 !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 8px !important;
        overflow: visible !important;
        width: 100% !important;
        max-width: 100% !important;
      }
      .lf-toolbar-section {
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        gap: 4px !important;
        position: relative !important;
        overflow: visible !important;
      }
      .lf-toolbar-divider {
        width: 1px !important;
        height: 24px !important;
        background: #d0d0d0 !important;
        flex-shrink: 0 !important;
      }
      .lf-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 32px !important;
        height: 32px !important;
        min-width: 32px !important;
        border: none !important;
        background: #fff !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 16px !important;
        color: #333 !important;
        box-shadow: 0 1px 3px rgba(0,0,0,.05) !important;
        padding: 0 !important;
        margin: 0 !important;
        line-height: 1 !important;
      }
      .lf-btn:hover { background: #0a66c2 !important; color: #fff !important; }
      .lf-btn-case, .lf-btn-typography { min-width: 40px !important; width: auto !important; padding: 0 6px !important; }
      .lf-icon { font-size: 16px !important; line-height: 1 !important; display: inline !important; }
      .lf-dropdown, .lf-case-dropdown {
        position: absolute !important;
        top: calc(100% + 4px) !important;
        left: 0 !important;
        background: #fff !important;
        border: 1px solid #e0e0e0 !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,.15) !important;
        padding: 8px !important;
        display: none !important;
        flex-direction: column !important;
        gap: 4px !important;
        z-index: 2147483647 !important;
        min-width: 180px !important;
        max-height: 280px !important;
        overflow-y: auto !important;
      }
      .lf-dropdown.lf-dropdown-active, .lf-case-dropdown.lf-dropdown-active {
        display: flex !important;
      }
      .lf-dropdown-item {
        display: block !important;
        width: 100% !important;
        padding: 8px 12px !important;
        border: none !important;
        background: transparent !important;
        text-align: left !important;
        cursor: pointer !important;
        border-radius: 4px !important;
        font-size: 14px !important;
        color: #333 !important;
        white-space: nowrap !important;
      }
      .lf-dropdown-item:hover { background: #f3f6f8 !important; color: #0a66c2 !important; }
      .lf-toolbar-info {
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      .lf-toggle-btn {
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        padding: 0 !important;
      }
      .lf-toggle-btn .lf-toggle-icon {
        width: 14px !important;
        height: 14px !important;
        display: block !important;
        pointer-events: none !important;
      }
      /* Compact comment toolbar — must not cover the whole compose box */
      :host([data-lf-kind="comment"]) {
        margin: 4px 0 !important;
        max-width: 100% !important;
      }
      :host([data-lf-kind="comment"]) .lf-toolbar-container {
        flex-wrap: wrap !important;
        padding: 4px 6px !important;
        gap: 3px !important;
        width: auto !important;
        max-width: 100% !important;
      }
      :host([data-lf-kind="comment"]) .lf-btn {
        width: 26px !important;
        height: 26px !important;
        min-width: 26px !important;
        font-size: 13px !important;
      }
      :host([data-lf-kind="comment"]) .lf-btn-case,
      :host([data-lf-kind="comment"]) .lf-btn-typography {
        min-width: 32px !important;
        padding: 0 4px !important;
      }
      :host([data-lf-kind="comment"]) .lf-toolbar-divider {
        height: 18px !important;
      }
      .lf-toolbar-collapsed .lf-toolbar-section,
      .lf-toolbar-collapsed .lf-toolbar-divider { display: none !important; }
      .lf-toolbar-container.lf-toolbar-collapsed {
        display: inline-flex !important;
        width: auto !important;
        max-width: none !important;
        padding: 2px !important;
        gap: 0 !important;
        margin: 0 !important;
        background: transparent !important;
        border: none !important;
        box-shadow: none !important;
      }
      .lf-toolbar-collapsed .lf-toolbar-info { margin-left: 0 !important; }
      .lf-toolbar-collapsed .lf-toggle-btn {
        background: #f3f6f8 !important;
        border: 1px solid #d0d0d0 !important;
        color: #555 !important;
        box-shadow: none !important;
      }
      .lf-toolbar-collapsed .lf-toggle-btn:hover {
        background: #0a66c2 !important;
        border-color: #0a66c2 !important;
        color: #fff !important;
      }
      .lf-toolbar-container[data-theme="dark"] {
        background: #1b1f23 !important;
        border-color: #38434f !important;
      }
      .lf-toolbar-container[data-theme="dark"] .lf-btn {
        background: #38434f !important;
        color: #fff !important;
      }
      .lf-toolbar-container[data-theme="dark"].lf-toolbar-collapsed {
        background: transparent !important;
        border: none !important;
      }
      .lf-toolbar-container[data-theme="dark"].lf-toolbar-collapsed .lf-toggle-btn {
        background: #38434f !important;
        border-color: #5a6875 !important;
        color: #fff !important;
      }
    `;
  }

  /**
   * Inject a toolbar for a specific editor instance
   */
  injectToolbarFor(editor, kind = "share") {
    if (!editor) return null;

    const textEditorShell = editor.closest(
      ".share-creation-state__text-editor"
    );
    const editorContainer =
      textEditorShell ||
      editor.closest('[data-testid="ui-core-tiptap-text-editor-wrapper"]') ||
      editor.closest(".editor-content") ||
      editor.closest(".ql-container") ||
      editor.closest(".editor-container") ||
      editor.closest(".share-box") ||
      editor.parentElement;

    if (!editorContainer?.parentNode) {
      return null;
    }

    // Host in light DOM; UI isolated in shadow root (LinkedIn CSS cannot flatten it)
    const host = document.createElement("div");
    host.className = "linkedin-formatter-toolbar";
    host.dataset.lfKind = kind;
    host._lfEditor = editor;
    host._lfCollapsed = false;
    this.applyHostLayout(host, false);

    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = this.getIsolatedToolbarCSS();
    shadow.appendChild(style);
    const tmp = document.createElement("div");
    tmp.innerHTML = this.getToolbarHTML();
    while (tmp.firstChild) shadow.appendChild(tmp.firstChild);

    // Share: place OUTSIDE text-editor shell (sibling before it) so Quill styles don't apply
    if (kind === "share" && textEditorShell?.parentNode) {
      textEditorShell.parentNode.insertBefore(host, textEditorShell);
    } else {
      editorContainer.parentNode.insertBefore(host, editorContainer);
    }

    const prevToolbar = this.toolbar;
    const prevEditor = this.editor;
    this.toolbar = host;
    this.editor = editor;
    this.attachToolbarListeners();
    this.applyToolbarTheme();
    // Restore collapsed preference; comments start as a small chip
    if (kind === "comment") {
      this.setToolbarCollapsed(host, true, { persist: false });
    } else if (localStorage.getItem("lf-toolbar-collapsed") === "true") {
      this.setToolbarCollapsed(host, true);
    }
    this.toolbar = prevToolbar;
    this.editor = prevEditor;


    return host;
  }

  /**
   * Inject formatting toolbar above the editor
   */
  injectToolbar() {
    if (this.toolbar) return;

    console.log("LinkedIn Formatter: Injecting toolbar");

    // Prefer Quill share-box anchors; keep toolbar visible above modal editor
    const editorContainer =
      this.editor.closest(".share-creation-state__text-editor") ||
      this.editor.closest(".editor-content") ||
      this.editor.closest(".ql-container") ||
      this.editor.closest(".editor-container") ||
      this.editor.closest(".share-box") ||
      this.editor.parentElement;

    if (!editorContainer || !editorContainer.parentNode) {
      console.error("LinkedIn Formatter: Could not find editor container");
      return;
    }

    this.toolbar = document.createElement("div");
    this.toolbar.className = "linkedin-formatter-toolbar";
    this.toolbar.innerHTML = this.getToolbarHTML();
    this.toolbar.style.cssText =
      "position:relative;z-index:10000;margin:8px 12px 4px;pointer-events:auto;";

    // Insert toolbar before editor container (or above the editable itself)
    const insertParent = editorContainer.parentNode;
    insertParent.insertBefore(this.toolbar, editorContainer);


    // Attach event listeners
    this.attachToolbarListeners();

    // Apply theme from settings
    this.applyToolbarTheme();

    // Restore collapsed state from localStorage
    const savedState = localStorage.getItem("lf-toolbar-collapsed");
    if (savedState === "true") {
      const container = this.toolbar.querySelector(".lf-toolbar-container");
      container.classList.add("lf-toolbar-collapsed");
      this.isToolbarCollapsed = true;
      const toggleBtn = this.toolbar.querySelector(
        '[data-action="toggle-toolbar"]'
      );
      if (toggleBtn) {
        toggleBtn.setAttribute("title", "Show Toolbar");
      }
    }
  }

  /**
   * Generate toolbar HTML structure
   */
  getToolbarHTML() {
    // Single toggle icon (swapped in JS) — avoids double-chevron CSS fights
    const chevronDown = `<svg class="lf-toggle-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06z"/></svg>`;
    return `
      <div class="lf-toolbar-container">
        <div class="lf-toolbar-section">
          <button type="button" class="lf-btn" data-action="bold" aria-label="Bold">
            <span class="lf-icon">𝐁</span>
          </button>
          <button type="button" class="lf-btn" data-action="italic" aria-label="Italic">
            <span class="lf-icon">𝐼</span>
          </button>
          <button type="button" class="lf-btn" data-action="underline" aria-label="Underline">
            <span class="lf-icon">U̲</span>
          </button>
          <button type="button" class="lf-btn" data-action="strikethrough" aria-label="Strikethrough">
            <span class="lf-icon">S̶</span>
          </button>
        </div>

        <div class="lf-toolbar-divider"></div>

        <div class="lf-toolbar-section">
          <button type="button" class="lf-btn lf-btn-case" data-action="case-converter" aria-label="Case converter">
            <span class="lf-icon">Tt</span>
          </button>
          <div class="lf-dropdown lf-case-dropdown">
            <button type="button" class="lf-dropdown-item" data-case="upper">UPPERCASE</button>
            <button type="button" class="lf-dropdown-item" data-case="lower">lowercase</button>
            <button type="button" class="lf-dropdown-item" data-case="title">Title Case</button>
            <button type="button" class="lf-dropdown-item" data-case="sentence">Sentence case</button>
          </div>
        </div>

        <div class="lf-toolbar-divider"></div>

        <div class="lf-toolbar-section">
          <button type="button" class="lf-btn lf-btn-typography" data-action="typography" aria-label="Typography styles">
            <span class="lf-icon">Aa</span>
          </button>
          <div class="lf-dropdown lf-typography-dropdown">
            <button type="button" class="lf-dropdown-item" data-style="bold-serif">𝐁𝐨𝐥𝐝 𝐒𝐞𝐫𝐢𝐟</button>
            <button type="button" class="lf-dropdown-item" data-style="bold-sans">𝗕𝗼𝗹𝗱 𝗦𝗮𝗻𝘀</button>
            <button type="button" class="lf-dropdown-item" data-style="italic-serif">𝐼𝑡𝑎𝑙𝑖𝑐 𝑆𝑒𝑟𝑖𝑓</button>
            <button type="button" class="lf-dropdown-item" data-style="italic-sans">𝘐𝘵𝘢𝘭𝘪𝘤 𝘚𝘢𝘯𝘴</button>
            <button type="button" class="lf-dropdown-item" data-style="bold-italic">𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄</button>
            <button type="button" class="lf-dropdown-item" data-style="script">𝒮𝒸𝓇𝒾𝓅𝓉</button>
            <button type="button" class="lf-dropdown-item" data-style="fraktur">𝔉𝔯𝔞𝔨𝔱𝔲𝔯</button>
            <button type="button" class="lf-dropdown-item" data-style="monospace">𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎</button>
            <button type="button" class="lf-dropdown-item" data-style="double-struck">𝔻𝕠𝕦𝕓𝕝𝕖 𝕊𝕥𝕣𝕦𝕔𝕜</button>
            <button type="button" class="lf-dropdown-item" data-style="circled">Ⓒⓘⓡⓒⓛⓔⓓ</button>
            <button type="button" class="lf-dropdown-item" data-style="squared">🅂🅀🅄🄰🅁🄴🄳</button>
          </div>
        </div>

        <div class="lf-toolbar-divider"></div>

        <div class="lf-toolbar-section">
          <button type="button" class="lf-btn" data-action="bullet-list" aria-label="Bullet list">
            <span class="lf-icon">•</span>
          </button>
          <button type="button" class="lf-btn" data-action="number-list" aria-label="Numbered list">
            <span class="lf-icon">1.</span>
          </button>
        </div>

        <div class="lf-toolbar-divider"></div>

        <div class="lf-toolbar-section">
          <button type="button" class="lf-btn" data-action="clear" aria-label="Clear formatting">
            <span class="lf-icon">✕</span>
          </button>
        </div>

        <div class="lf-toolbar-info">
          <button type="button" class="lf-btn lf-toggle-btn" data-action="toggle-toolbar" aria-label="Hide formatting toolbar" aria-expanded="true">
            ${chevronDown}
          </button>
        </div>
      </div>
    `;
  }

  getToggleIconSVG(collapsed) {
    if (collapsed) {
      // Chevron right = show / expand
      return `<svg class="lf-toggle-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.2 4.2a.75.75 0 0 1 1.06 0l3.27 3.27a.75.75 0 0 1 0 1.06L7.26 11.8a.75.75 0 1 1-1.06-1.06L9.94 8 6.2 5.26a.75.75 0 0 1 0-1.06z"/></svg>`;
    }
    // Chevron down = hide / collapse
    return `<svg class="lf-toggle-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06z"/></svg>`;
  }

  /**
   * Host layout for expanded vs collapsed chip
   */
  applyHostLayout(host, collapsed) {
    if (!host) return;
    if (collapsed) {
      host.style.cssText =
        "display:inline-block;width:auto;position:relative;z-index:10001;margin:4px 12px;pointer-events:auto;vertical-align:middle;";
    } else {
      host.style.cssText =
        "display:block;width:auto;max-width:100%;position:relative;z-index:10001;margin:8px 12px;pointer-events:auto;";
    }
  }

  /**
   * Set collapsed state for a specific toolbar host
   */
  /**
   * Set collapsed state for a specific toolbar host
   */
  setToolbarCollapsed(host, collapsed, { persist = true } = {}) {
    if (!host) return;
    const root = this.getToolbarRoot(host);
    const container = root?.querySelector(".lf-toolbar-container");
    const toggleBtn = root?.querySelector('[data-action="toggle-toolbar"]');
    if (!container) return;

    host._lfCollapsed = !!collapsed;
    this.applyHostLayout(host, collapsed);

    if (collapsed) {
      container.classList.add("lf-toolbar-collapsed");
      if (persist) localStorage.setItem("lf-toolbar-collapsed", "true");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", "Show formatting toolbar");
        toggleBtn.setAttribute("aria-expanded", "false");
        toggleBtn.removeAttribute("title");
        toggleBtn.innerHTML = this.getToggleIconSVG(true);
      }
    } else {
      container.classList.remove("lf-toolbar-collapsed");
      if (persist) localStorage.setItem("lf-toolbar-collapsed", "false");
      if (toggleBtn) {
        toggleBtn.setAttribute("aria-label", "Hide formatting toolbar");
        toggleBtn.setAttribute("aria-expanded", "true");
        toggleBtn.removeAttribute("title");
        toggleBtn.innerHTML = this.getToggleIconSVG(false);
      }
    }

  }

  /**
   * Attach event listeners to toolbar buttons
   */
  attachToolbarListeners() {
    const toolbarEl = this.toolbar;
    const root = this.getToolbarRoot(toolbarEl);
    const bindEditor = () => {
      if (toolbarEl?._lfEditor) this.editor = toolbarEl._lfEditor;
      this.toolbar = toolbarEl;
    };

    // Exclude case / typography / toggle — they have dedicated handlers.
    // Including toggle here caused a double-fire (collapse then immediately expand).
    const buttons = root.querySelectorAll(
      ".lf-btn:not(.lf-btn-typography):not(.lf-btn-case):not(.lf-toggle-btn)"
    );
    buttons.forEach((btn) => {
      // Keep editor selection when clicking toolbar (critical for format)
      btn.addEventListener("mousedown", (e) => e.preventDefault());
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        bindEditor();
        const action = btn.getAttribute("data-action");
        this.handleAction(action);
      });
    });

    const caseBtn = root.querySelector(".lf-btn-case");
    const caseDropdown = root.querySelector(".lf-case-dropdown");
    const typographyBtn = root.querySelector(".lf-btn-typography");
    const typographyDropdown = root.querySelector(".lf-typography-dropdown");

    if (caseBtn && caseDropdown) {
      caseBtn.addEventListener("mousedown", (e) => e.preventDefault());
      caseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        bindEditor();
        caseDropdown.classList.toggle("lf-dropdown-active");
        typographyDropdown?.classList.remove("lf-dropdown-active");
      });

      caseDropdown.querySelectorAll(".lf-dropdown-item").forEach((item) => {
        item.addEventListener("mousedown", (e) => e.preventDefault());
        item.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          bindEditor();
          this.applyCaseConversion(item.getAttribute("data-case"));
          caseDropdown.classList.remove("lf-dropdown-active");
        });
      });
    }

    if (typographyBtn && typographyDropdown) {
      typographyBtn.addEventListener("mousedown", (e) => e.preventDefault());
      typographyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        bindEditor();
        typographyDropdown.classList.toggle("lf-dropdown-active");
        caseDropdown?.classList.remove("lf-dropdown-active");
      });

      typographyDropdown
        .querySelectorAll(".lf-dropdown-item")
        .forEach((item) => {
          item.addEventListener("mousedown", (e) => e.preventDefault());
          item.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            bindEditor();
            this.applyTypography(item.getAttribute("data-style"));
            typographyDropdown.classList.remove("lf-dropdown-active");
          });
        });
    }

    document.addEventListener("click", (e) => {
      if (toolbarEl.contains(e.target)) return;
      typographyDropdown?.classList.remove("lf-dropdown-active");
      caseDropdown?.classList.remove("lf-dropdown-active");
    });

    const toggleBtn = root.querySelector('[data-action="toggle-toolbar"]');
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        bindEditor();
        this.toggleToolbarVisibility();
      });
    }
  }

  /**
   * Handle formatting actions
   */
  handleAction(action) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText) {
      this.showNotification("Please select text to format");
      return;
    }

    let formattedText = "";

    switch (action) {
      case "bold":
        formattedText = this.convertToBold(selectedText);
        break;
      case "italic":
        formattedText = this.convertToItalic(selectedText);
        break;
      case "underline":
        formattedText = this.addUnderline(selectedText);
        break;
      case "strikethrough":
        formattedText = this.addStrikethrough(selectedText);
        break;
      case "bullet-list":
        formattedText = this.createBulletList(selectedText);
        break;
      case "number-list":
        formattedText = this.createNumberList(selectedText);
        break;
      case "clear":
        this.clearFormatting();
        return;
      case "toggle-toolbar":
        this.toggleToolbarVisibility();
        return;
      default:
        return;
    }

    if (formattedText) {
      this.replaceSelection(formattedText);
    }
  }

  /**
   * Toggle toolbar visibility (show/hide buttons)
   */
  toggleToolbarVisibility() {
    const host = this.toolbar;
    if (!host) return;
    const root = this.getToolbarRoot(host);
    const typographyDropdown = root?.querySelector(".lf-typography-dropdown");
    const caseDropdown = root?.querySelector(".lf-case-dropdown");
    typographyDropdown?.classList.remove("lf-dropdown-active");
    caseDropdown?.classList.remove("lf-dropdown-active");

    const next = !host._lfCollapsed;
    this.isToolbarCollapsed = next;
    this.setToolbarCollapsed(host, next);
  }

  /**
   * Apply toolbar theme from settings
   */
  async applyToolbarTheme() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.log(
          "LinkedIn Formatter: Extension context invalidated, using default theme"
        );
        return;
      }

      const result = await chrome.storage.local.get(["toolbarTheme"]);
      const theme = result.toolbarTheme || "light"; // Default light
      const root = this.getToolbarRoot(this.toolbar);
      const container = root?.querySelector(".lf-toolbar-container");

      if (container) {
        container.setAttribute("data-theme", theme);
      }
    } catch (error) {
      // Silent fail if extension context is invalidated
      if (error.message?.includes("Extension context invalidated")) {
        console.log(
          "LinkedIn Formatter: Extension reloaded, please refresh page"
        );
      } else {
        console.error("LinkedIn Formatter: Error applying theme", error);
      }
    }
  }

  /**
   * Convert text to bold using Unicode characters
   */
  convertToBold(text) {
    const plain = this.decodeFancyCharacters(this.normalizeEditorLines(text));
    const boldMap = {
      A: "𝐀",
      B: "𝐁",
      C: "𝐂",
      D: "𝐃",
      E: "𝐄",
      F: "𝐅",
      G: "𝐆",
      H: "𝐇",
      I: "𝐈",
      J: "𝐉",
      K: "𝐊",
      L: "𝐋",
      M: "𝐌",
      N: "𝐍",
      O: "𝐎",
      P: "𝐏",
      Q: "𝐐",
      R: "𝐑",
      S: "𝐒",
      T: "𝐓",
      U: "𝐔",
      V: "𝐕",
      W: "𝐖",
      X: "𝐗",
      Y: "𝐘",
      Z: "𝐙",
      a: "𝐚",
      b: "𝐛",
      c: "𝐜",
      d: "𝐝",
      e: "𝐞",
      f: "𝐟",
      g: "𝐠",
      h: "𝐡",
      i: "𝐢",
      j: "𝐣",
      k: "𝐤",
      l: "𝐥",
      m: "𝐦",
      n: "𝐧",
      o: "𝐨",
      p: "𝐩",
      q: "𝐪",
      r: "𝐫",
      s: "𝐬",
      t: "𝐭",
      u: "𝐮",
      v: "𝐯",
      w: "𝐰",
      x: "𝐱",
      y: "𝐲",
      z: "𝐳",
      0: "𝟎",
      1: "𝟏",
      2: "𝟐",
      3: "𝟑",
      4: "𝟒",
      5: "𝟓",
      6: "𝟔",
      7: "𝟕",
      8: "𝟖",
      9: "𝟗",
    };
    return this.convertWithMap(plain, boldMap);
  }

  /**
   * Convert text to italic using Unicode characters
   */
  convertToItalic(text) {
    const plain = this.decodeFancyCharacters(this.normalizeEditorLines(text));
    const italicMap = {
      A: "𝐴",
      B: "𝐵",
      C: "𝐶",
      D: "𝐷",
      E: "𝐸",
      F: "𝐹",
      G: "𝐺",
      H: "𝐻",
      I: "𝐼",
      J: "𝐽",
      K: "𝐾",
      L: "𝐿",
      M: "𝑀",
      N: "𝑁",
      O: "𝑂",
      P: "𝑃",
      Q: "𝑄",
      R: "𝑅",
      S: "𝑆",
      T: "𝑇",
      U: "𝑈",
      V: "𝑉",
      W: "𝑊",
      X: "𝑋",
      Y: "𝑌",
      Z: "𝑍",
      a: "𝑎",
      b: "𝑏",
      c: "𝑐",
      d: "𝑑",
      e: "𝑒",
      f: "𝑓",
      g: "𝑔",
      h: "ℎ",
      i: "𝑖",
      j: "𝑗",
      k: "𝑘",
      l: "𝑙",
      m: "𝑚",
      n: "𝑛",
      o: "𝑜",
      p: "𝑝",
      q: "𝑞",
      r: "𝑟",
      s: "𝑠",
      t: "𝑡",
      u: "𝑢",
      v: "𝑣",
      w: "𝑤",
      x: "𝑥",
      y: "𝑦",
      z: "𝑧",
    };
    return this.convertWithMap(plain, italicMap);
  }

  /**
   * Add underline using combining character
   */
  addUnderline(text) {
    const plain = this.decodeFancyCharacters(this.normalizeEditorLines(text));
    return Array.from(plain)
      .map((char) => {
        if (char === " " || char === "\n") return char;
        return char + "\u0332"; // Combining low line
      })
      .join("");
  }

  /**
   * Add strikethrough using combining character
   */
  addStrikethrough(text) {
    const plain = this.decodeFancyCharacters(this.normalizeEditorLines(text));
    return Array.from(plain)
      .map((char) => {
        if (char === " " || char === "\n") return char;
        return char + "\u0336"; // Combining long stroke overlay
      })
      .join("");
  }

  /**
   * Convert text using a character map (code-point safe for Unicode)
   */
  convertWithMap(text, map) {
    return Array.from(String(text ?? ""))
      .map((char) => map[char] || char)
      .join("");
  }

  /**
   * Apply typography style — replaces any previous Unicode font style
   */
  applyTypography(style) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText) {
      this.showNotification("Please select text to format");
      return;
    }

    // Quill selections use \n\n between paragraphs — collapse before styling
    const normalized = this.normalizeEditorLines(selectedText);
    // Decode existing fancy fonts back to ASCII first (exclusive switch)
    const plain = this.decodeFancyCharacters(normalized);
    const maps = this.getTypographyMaps();
    const formattedText = this.convertWithMap(plain, maps[style] || {});


    this.replaceSelection(formattedText);
  }

  /**
   * Get typography character maps
   */
  getTypographyMaps() {
    return {
      "bold-sans": {
        A: "𝗔",
        B: "𝗕",
        C: "𝗖",
        D: "𝗗",
        E: "𝗘",
        F: "𝗙",
        G: "𝗚",
        H: "𝗛",
        I: "𝗜",
        J: "𝗝",
        K: "𝗞",
        L: "𝗟",
        M: "𝗠",
        N: "𝗡",
        O: "𝗢",
        P: "𝗣",
        Q: "𝗤",
        R: "𝗥",
        S: "𝗦",
        T: "𝗧",
        U: "𝗨",
        V: "𝗩",
        W: "𝗪",
        X: "𝗫",
        Y: "𝗬",
        Z: "𝗭",
        a: "𝗮",
        b: "𝗯",
        c: "𝗰",
        d: "𝗱",
        e: "𝗲",
        f: "𝗳",
        g: "𝗴",
        h: "𝗵",
        i: "𝗶",
        j: "𝗷",
        k: "𝗸",
        l: "𝗹",
        m: "𝗺",
        n: "𝗻",
        o: "𝗼",
        p: "𝗽",
        q: "𝗾",
        r: "𝗿",
        s: "𝘀",
        t: "𝘁",
        u: "𝘂",
        v: "𝘃",
        w: "𝘄",
        x: "𝘅",
        y: "𝘆",
        z: "𝘇",
        0: "𝟬",
        1: "𝟭",
        2: "𝟮",
        3: "𝟯",
        4: "𝟰",
        5: "𝟱",
        6: "𝟲",
        7: "𝟳",
        8: "𝟴",
        9: "𝟵",
      },
      "italic-sans": {
        A: "𝘈",
        B: "𝘉",
        C: "𝘊",
        D: "𝘋",
        E: "𝘌",
        F: "𝘍",
        G: "𝘎",
        H: "𝘏",
        I: "𝘐",
        J: "𝘑",
        K: "𝘒",
        L: "𝘓",
        M: "𝘔",
        N: "𝘕",
        O: "𝘖",
        P: "𝘗",
        Q: "𝘘",
        R: "𝘙",
        S: "𝘚",
        T: "𝘛",
        U: "𝘜",
        V: "𝘝",
        W: "𝘞",
        X: "𝘟",
        Y: "𝘠",
        Z: "𝘡",
        a: "𝘢",
        b: "𝘣",
        c: "𝘤",
        d: "𝘥",
        e: "𝘦",
        f: "𝘧",
        g: "𝘨",
        h: "𝘩",
        i: "𝘪",
        j: "𝘫",
        k: "𝘬",
        l: "𝘭",
        m: "𝘮",
        n: "𝘯",
        o: "𝘰",
        p: "𝘱",
        q: "𝘲",
        r: "𝘳",
        s: "𝘴",
        t: "𝘵",
        u: "𝘶",
        v: "𝘷",
        w: "𝘸",
        x: "𝘹",
        y: "𝘺",
        z: "𝘻",
      },
      "bold-italic": {
        A: "𝑨",
        B: "𝑩",
        C: "𝑪",
        D: "𝑫",
        E: "𝑬",
        F: "𝑭",
        G: "𝑮",
        H: "𝑯",
        I: "𝑰",
        J: "𝑱",
        K: "𝑲",
        L: "𝑳",
        M: "𝑴",
        N: "𝑵",
        O: "𝑶",
        P: "𝑷",
        Q: "𝑸",
        R: "𝑹",
        S: "𝑺",
        T: "𝑻",
        U: "𝑼",
        V: "𝑽",
        W: "𝑾",
        X: "𝑿",
        Y: "𝒀",
        Z: "𝒁",
        a: "𝒂",
        b: "𝒃",
        c: "𝒄",
        d: "𝒅",
        e: "𝒆",
        f: "𝒇",
        g: "𝒈",
        h: "𝒉",
        i: "𝒊",
        j: "𝒋",
        k: "𝒌",
        l: "𝒍",
        m: "𝒎",
        n: "𝒏",
        o: "𝒐",
        p: "𝒑",
        q: "𝒒",
        r: "𝒓",
        s: "𝒔",
        t: "𝒕",
        u: "𝒖",
        v: "𝒗",
        w: "𝒘",
        x: "𝒙",
        y: "𝒚",
        z: "𝒛",
      },
      script: {
        A: "𝒜",
        B: "𝐵",
        C: "𝒞",
        D: "𝒟",
        E: "𝐸",
        F: "𝐹",
        G: "𝒢",
        H: "𝐻",
        I: "𝐼",
        J: "𝒥",
        K: "𝒦",
        L: "𝐿",
        M: "𝑀",
        N: "𝒩",
        O: "𝒪",
        P: "𝒫",
        Q: "𝒬",
        R: "𝑅",
        S: "𝒮",
        T: "𝒯",
        U: "𝒰",
        V: "𝒱",
        W: "𝒲",
        X: "𝒳",
        Y: "𝒴",
        Z: "𝒵",
        a: "𝒶",
        b: "𝒷",
        c: "𝒸",
        d: "𝒹",
        e: "𝑒",
        f: "𝒻",
        g: "𝑔",
        h: "𝒽",
        i: "𝒾",
        j: "𝒿",
        k: "𝓀",
        l: "𝓁",
        m: "𝓂",
        n: "𝓃",
        o: "𝑜",
        p: "𝓅",
        q: "𝓆",
        r: "𝓇",
        s: "𝓈",
        t: "𝓉",
        u: "𝓊",
        v: "𝓋",
        w: "𝓌",
        x: "𝓍",
        y: "𝓎",
        z: "𝓏",
      },
      fraktur: {
        A: "𝔄",
        B: "𝔅",
        C: "ℭ",
        D: "𝔇",
        E: "𝔈",
        F: "𝔉",
        G: "𝔊",
        H: "ℌ",
        I: "ℑ",
        J: "𝔍",
        K: "𝔎",
        L: "𝔏",
        M: "𝔐",
        N: "𝔑",
        O: "𝔒",
        P: "𝔓",
        Q: "𝔔",
        R: "ℜ",
        S: "𝔖",
        T: "𝔗",
        U: "𝔘",
        V: "𝔙",
        W: "𝔚",
        X: "𝔛",
        Y: "𝔜",
        Z: "ℨ",
        a: "𝔞",
        b: "𝔟",
        c: "𝔠",
        d: "𝔡",
        e: "𝔢",
        f: "𝔣",
        g: "𝔤",
        h: "𝔥",
        i: "𝔦",
        j: "𝔧",
        k: "𝔨",
        l: "𝔩",
        m: "𝔪",
        n: "𝔫",
        o: "𝔬",
        p: "𝔭",
        q: "𝔮",
        r: "𝔯",
        s: "𝔰",
        t: "𝔱",
        u: "𝔲",
        v: "𝔳",
        w: "𝔴",
        x: "𝔵",
        y: "𝔶",
        z: "𝔷",
      },
      monospace: {
        A: "𝙰",
        B: "𝙱",
        C: "𝙲",
        D: "𝙳",
        E: "𝙴",
        F: "𝙵",
        G: "𝙶",
        H: "𝙷",
        I: "𝙸",
        J: "𝙹",
        K: "𝙺",
        L: "𝙻",
        M: "𝙼",
        N: "𝙽",
        O: "𝙾",
        P: "𝙿",
        Q: "𝚀",
        R: "𝚁",
        S: "𝚂",
        T: "𝚃",
        U: "𝚄",
        V: "𝚅",
        W: "𝚆",
        X: "𝚇",
        Y: "𝚈",
        Z: "𝚉",
        a: "𝚊",
        b: "𝚋",
        c: "𝚌",
        d: "𝚍",
        e: "𝚎",
        f: "𝚏",
        g: "𝚐",
        h: "𝚑",
        i: "𝚒",
        j: "𝚓",
        k: "𝚔",
        l: "𝚕",
        m: "𝚖",
        n: "𝚗",
        o: "𝚘",
        p: "𝚙",
        q: "𝚚",
        r: "𝚛",
        s: "𝚜",
        t: "𝚝",
        u: "𝚞",
        v: "𝚟",
        w: "𝚠",
        x: "𝚡",
        y: "𝚢",
        z: "𝚣",
        0: "𝟶",
        1: "𝟷",
        2: "𝟸",
        3: "𝟹",
        4: "𝟺",
        5: "𝟻",
        6: "𝟼",
        7: "𝟽",
        8: "𝟾",
        9: "𝟿",
      },
      "double-struck": {
        A: "𝔸",
        B: "𝔹",
        C: "ℂ",
        D: "𝔻",
        E: "𝔼",
        F: "𝔽",
        G: "𝔾",
        H: "ℍ",
        I: "𝕀",
        J: "𝕁",
        K: "𝕂",
        L: "𝕃",
        M: "𝕄",
        N: "ℕ",
        O: "𝕆",
        P: "ℙ",
        Q: "ℚ",
        R: "ℝ",
        S: "𝕊",
        T: "𝕋",
        U: "𝕌",
        V: "𝕍",
        W: "𝕎",
        X: "𝕏",
        Y: "𝕐",
        Z: "ℤ",
        a: "𝕒",
        b: "𝕓",
        c: "𝕔",
        d: "𝕕",
        e: "𝕖",
        f: "𝕗",
        g: "𝕘",
        h: "𝕙",
        i: "𝕚",
        j: "𝕛",
        k: "𝕜",
        l: "𝕝",
        m: "𝕞",
        n: "𝕟",
        o: "𝕠",
        p: "𝕡",
        q: "𝕢",
        r: "𝕣",
        s: "𝕤",
        t: "𝕥",
        u: "𝕦",
        v: "𝕧",
        w: "𝕨",
        x: "𝕩",
        y: "𝕪",
        z: "𝕫",
        0: "𝟘",
        1: "𝟙",
        2: "𝟚",
        3: "𝟛",
        4: "𝟜",
        5: "𝟝",
        6: "𝟞",
        7: "𝟟",
        8: "𝟠",
        9: "𝟡",
      },
      circled: {
        A: "Ⓐ",
        B: "Ⓑ",
        C: "Ⓒ",
        D: "Ⓓ",
        E: "Ⓔ",
        F: "Ⓕ",
        G: "Ⓖ",
        H: "Ⓗ",
        I: "Ⓘ",
        J: "Ⓙ",
        K: "Ⓚ",
        L: "Ⓛ",
        M: "Ⓜ",
        N: "Ⓝ",
        O: "Ⓞ",
        P: "Ⓟ",
        Q: "Ⓠ",
        R: "Ⓡ",
        S: "Ⓢ",
        T: "Ⓣ",
        U: "Ⓤ",
        V: "Ⓥ",
        W: "Ⓦ",
        X: "Ⓧ",
        Y: "Ⓨ",
        Z: "Ⓩ",
        a: "ⓐ",
        b: "ⓑ",
        c: "ⓒ",
        d: "ⓓ",
        e: "ⓔ",
        f: "ⓕ",
        g: "ⓖ",
        h: "ⓗ",
        i: "ⓘ",
        j: "ⓙ",
        k: "ⓚ",
        l: "ⓛ",
        m: "ⓜ",
        n: "ⓝ",
        o: "ⓞ",
        p: "ⓟ",
        q: "ⓠ",
        r: "ⓡ",
        s: "ⓢ",
        t: "ⓣ",
        u: "ⓤ",
        v: "ⓥ",
        w: "ⓦ",
        x: "ⓧ",
        y: "ⓨ",
        z: "ⓩ",
        0: "⓪",
        1: "①",
        2: "②",
        3: "③",
        4: "④",
        5: "⑤",
        6: "⑥",
        7: "⑦",
        8: "⑧",
        9: "⑨",
      },
      squared: {
        A: "🄰",
        B: "🄱",
        C: "🄲",
        D: "🄳",
        E: "🄴",
        F: "🄵",
        G: "🄶",
        H: "🄷",
        I: "🄸",
        J: "🄹",
        K: "🄺",
        L: "🄻",
        M: "🄼",
        N: "🄽",
        O: "🄾",
        P: "🄿",
        Q: "🅀",
        R: "🅁",
        S: "🅂",
        T: "🅃",
        U: "🅄",
        V: "🅅",
        W: "🅆",
        X: "🅇",
        Y: "🅈",
        Z: "🅉",
        a: "🄰",
        b: "🄱",
        c: "🄲",
        d: "🄳",
        e: "🄴",
        f: "🄵",
        g: "🄶",
        h: "🄷",
        i: "🄸",
        j: "🄹",
        k: "🄺",
        l: "🄻",
        m: "🄼",
        n: "🄽",
        o: "🄾",
        p: "🄿",
        q: "🅀",
        r: "🅁",
        s: "🅂",
        t: "🅃",
        u: "🅄",
        v: "🅅",
        w: "🅆",
        x: "🅇",
        y: "🅈",
        z: "🅉",
        0: "0",
        1: "1",
        2: "2",
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
      },
      "bold-serif": {
        A: "𝐀",
        B: "𝐁",
        C: "𝐂",
        D: "𝐃",
        E: "𝐄",
        F: "𝐅",
        G: "𝐆",
        H: "𝐇",
        I: "𝐈",
        J: "𝐉",
        K: "𝐊",
        L: "𝐋",
        M: "𝐌",
        N: "𝐍",
        O: "𝐎",
        P: "𝐏",
        Q: "𝐐",
        R: "𝐑",
        S: "𝐒",
        T: "𝐓",
        U: "𝐔",
        V: "𝐕",
        W: "𝐖",
        X: "𝐗",
        Y: "𝐘",
        Z: "𝐙",
        a: "𝐚",
        b: "𝐛",
        c: "𝐜",
        d: "𝐝",
        e: "𝐞",
        f: "𝐟",
        g: "𝐠",
        h: "𝐡",
        i: "𝐢",
        j: "𝐣",
        k: "𝐤",
        l: "𝐥",
        m: "𝐦",
        n: "𝐧",
        o: "𝐨",
        p: "𝐩",
        q: "𝐪",
        r: "𝐫",
        s: "𝐬",
        t: "𝐭",
        u: "𝐮",
        v: "𝐯",
        w: "𝐰",
        x: "𝐱",
        y: "𝐲",
        z: "𝐳",
        0: "𝟎",
        1: "𝟏",
        2: "𝟐",
        3: "𝟑",
        4: "𝟒",
        5: "𝟓",
        6: "𝟔",
        7: "𝟕",
        8: "𝟖",
        9: "𝟗",
      },
      "italic-serif": {
        A: "𝐴",
        B: "𝐵",
        C: "𝐶",
        D: "𝐷",
        E: "𝐸",
        F: "𝐹",
        G: "𝐺",
        H: "𝐻",
        I: "𝐼",
        J: "𝐽",
        K: "𝐾",
        L: "𝐿",
        M: "𝑀",
        N: "𝑁",
        O: "𝑂",
        P: "𝑃",
        Q: "𝑄",
        R: "𝑅",
        S: "𝑆",
        T: "𝑇",
        U: "𝑈",
        V: "𝑉",
        W: "𝑊",
        X: "𝑋",
        Y: "𝑌",
        Z: "𝑍",
        a: "𝑎",
        b: "𝑏",
        c: "𝑐",
        d: "𝑑",
        e: "𝑒",
        f: "𝑓",
        g: "𝑔",
        h: "ℎ",
        i: "𝑖",
        j: "𝑗",
        k: "𝑘",
        l: "𝑙",
        m: "𝑚",
        n: "𝑛",
        o: "𝑜",
        p: "𝑝",
        q: "𝑞",
        r: "𝑟",
        s: "𝑠",
        t: "𝑡",
        u: "𝑢",
        v: "𝑣",
        w: "𝑤",
        x: "𝑥",
        y: "𝑦",
        z: "𝑧",
      },
    };
  }

  /**
   * Apply case conversion to selected text
   */
  applyCaseConversion(caseType) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText || selectedText.trim().length === 0) {
      this.showNotification("Please select text to convert case");
      return;
    }

    let convertedText = "";
    switch (caseType) {
      case "upper":
        convertedText = this.toUpperCase(selectedText);
        break;
      case "lower":
        convertedText = this.toLowerCase(selectedText);
        break;
      case "title":
        convertedText = this.toTitleCase(selectedText);
        break;
      case "sentence":
        convertedText = this.toSentenceCase(selectedText);
        break;
      default:
        return;
    }

    if (convertedText) {
      this.replaceSelection(convertedText);
    }
  }

  /**
   * Common brand names and proper nouns to preserve
   */
  getBrandNames() {
    return [
      // Tech brands
      "WordPress",
      "iPhone",
      "iPad",
      "iOS",
      "macOS",
      "LinkedIn",
      "GitHub",
      "YouTube",
      "JavaScript",
      "TypeScript",
      "PowerPoint",
      "OneDrive",
      "SharePoint",
      "OneNote",
      "LinkedIn",
      "DevOps",
      "MongoDB",
      "MySQL",
      "PostgreSQL",
      "GraphQL",
      "OpenAI",
      "ChatGPT",
      "TikTok",
      "WhatsApp",
      "PlayStation",
      "Xbox",
      "PayPal",
      "eBay",
      "iTunes",
      // Companies
      "Microsoft",
      "Google",
      "Apple",
      "Amazon",
      "Facebook",
      "Meta",
      "Netflix",
      "Tesla",
      "Twitter",
      "Instagram",
      "Snapchat",
      "Reddit",
      // Common abbreviations
      "CEO",
      "CTO",
      "CFO",
      "CIO",
      "VP",
      "SVP",
      "EVP",
      "CMO",
      "COO",
      "AI",
      "ML",
      "API",
      "SDK",
      "HTML",
      "CSS",
      "SQL",
      "REST",
      "JSON",
      "XML",
      "HTTP",
      "HTTPS",
      "FTP",
      "SSH",
      "AWS",
      "GCP",
      "Azure",
      "SaaS",
      "PaaS",
      "IaaS",
      "B2B",
      "B2C",
      "SEO",
      "SEM",
      "CRM",
      "ERP",
      "HR",
      "IT",
      "PR",
      "UI",
      "UX",
      "QA",
      "R&D",
      "ROI",
      "KPI",
      // Days and months
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Sept",
      "Oct",
      "Nov",
      "Dec",
    ];
  }

  /**
   * Convert to UPPERCASE
   */
  toUpperCase(text) {
    return text.toUpperCase();
  }

  /**
   * Convert to lowercase
   */
  toLowerCase(text) {
    return text.toLowerCase();
  }

  /**
   * Convert to Title Case with smart brand name preservation
   */
  toTitleCase(text) {
    const brandNames = this.getBrandNames();
    const brandMap = new Map();

    // Create case-insensitive map of brand names
    brandNames.forEach((brand) => {
      brandMap.set(brand.toLowerCase(), brand);
    });

    // Known acronyms to preserve (when already in correct case)
    const knownAcronyms = new Set([
      "CEO",
      "CTO",
      "CFO",
      "CIO",
      "VP",
      "SVP",
      "EVP",
      "CMO",
      "COO",
      "AI",
      "ML",
      "API",
      "SDK",
      "HTML",
      "CSS",
      "SQL",
      "REST",
      "JSON",
      "XML",
      "HTTP",
      "HTTPS",
      "FTP",
      "SSH",
      "AWS",
      "GCP",
      "SaaS",
      "PaaS",
      "IaaS",
      "B2B",
      "B2C",
      "SEO",
      "SEM",
      "CRM",
      "ERP",
      "HR",
      "IT",
      "PR",
      "UI",
      "UX",
      "QA",
      "ROI",
      "KPI",
    ]);

    // Articles and prepositions to keep lowercase (unless first/last word)
    const minorWords = new Set([
      "a",
      "an",
      "the",
      "and",
      "but",
      "or",
      "nor",
      "for",
      "yet",
      "so",
      "at",
      "by",
      "in",
      "of",
      "on",
      "to",
      "up",
      "as",
      "is",
      "if",
      "via",
      "per",
      "from",
      "into",
      "onto",
      "with",
      "over",
      "upon",
    ]);

    const words = text.split(/\s+/);

    return words
      .map((word, index) => {
        if (!word) return word;

        // Check if it's a brand name (case-insensitive)
        const lowerWord = word.toLowerCase();
        if (brandMap.has(lowerWord)) {
          return brandMap.get(lowerWord);
        }

        // Check if it's a known acronym (must match exactly)
        if (knownAcronyms.has(word)) {
          return word; // Keep known acronyms as-is
        }

        // Check if it contains special chars (like hyphenated words)
        if (word.includes("-")) {
          return word
            .split("-")
            .map((part, i) => {
              const lowerPart = part.toLowerCase();
              if (brandMap.has(lowerPart)) {
                return brandMap.get(lowerPart);
              }
              return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            })
            .join("-");
        }

        // Handle possessives (e.g., "company's")
        const possessiveMatch = word.match(/^(.+)('s|'s)$/i);
        if (possessiveMatch) {
          const baseWord = possessiveMatch[1];
          const suffix = possessiveMatch[2];
          const lowerBase = baseWord.toLowerCase();
          if (brandMap.has(lowerBase)) {
            return brandMap.get(lowerBase) + suffix;
          }
          return (
            baseWord.charAt(0).toUpperCase() +
            baseWord.slice(1).toLowerCase() +
            suffix
          );
        }

        // Check if it's a minor word (and not first/last)
        if (
          index !== 0 &&
          index !== words.length - 1 &&
          minorWords.has(lowerWord)
        ) {
          return lowerWord;
        }

        // Default: capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  /**
   * Convert to Sentence case with smart brand name preservation
   */
  toSentenceCase(text) {
    const brandNames = this.getBrandNames();
    const brandMap = new Map();

    // Create case-insensitive map of brand names
    brandNames.forEach((brand) => {
      brandMap.set(brand.toLowerCase(), brand);
    });

    // Known acronyms to preserve (when already in correct case)
    const knownAcronyms = new Set([
      "CEO",
      "CTO",
      "CFO",
      "CIO",
      "VP",
      "SVP",
      "EVP",
      "CMO",
      "COO",
      "AI",
      "ML",
      "API",
      "SDK",
      "HTML",
      "CSS",
      "SQL",
      "REST",
      "JSON",
      "XML",
      "HTTP",
      "HTTPS",
      "FTP",
      "SSH",
      "AWS",
      "GCP",
      "SaaS",
      "PaaS",
      "IaaS",
      "B2B",
      "B2C",
      "SEO",
      "SEM",
      "CRM",
      "ERP",
      "HR",
      "IT",
      "PR",
      "UI",
      "UX",
      "QA",
      "ROI",
      "KPI",
    ]);

    // Split by sentence boundaries (., !, ?, etc.)
    const sentences = text.split(/([.!?]\s+)/);

    return sentences
      .map((sentence, index) => {
        // Skip delimiters
        if (index % 2 === 1) return sentence;

        if (!sentence) return sentence;

        const words = sentence.split(/\s+/);

        return words
          .map((word, wordIndex) => {
            if (!word) return word;

            // Check if it's a brand name (case-insensitive)
            const lowerWord = word.toLowerCase();
            if (brandMap.has(lowerWord)) {
              return brandMap.get(lowerWord);
            }

            // Check if it's a known acronym (must match exactly)
            if (knownAcronyms.has(word)) {
              return word; // Keep known acronyms as-is
            }

            // Handle possessives
            const possessiveMatch = word.match(/^(.+)('s|'s)$/i);
            if (possessiveMatch) {
              const baseWord = possessiveMatch[1];
              const suffix = possessiveMatch[2];
              const lowerBase = baseWord.toLowerCase();
              if (brandMap.has(lowerBase)) {
                return brandMap.get(lowerBase) + suffix;
              }
              if (wordIndex === 0) {
                return (
                  baseWord.charAt(0).toUpperCase() +
                  baseWord.slice(1).toLowerCase() +
                  suffix
                );
              }
              return baseWord.toLowerCase() + suffix;
            }

            // First word of sentence: capitalize
            if (wordIndex === 0) {
              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }

            // All other words: lowercase
            return word.toLowerCase();
          })
          .join(" ");
      })
      .join("");
  }

  /**
   * Quill/TipTap selections often use \n\n between paragraphs.
   * Normalize to single newlines for list/clear text ops.
   */
  normalizeEditorLines(text) {
    return String(text ?? "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{2,}/g, "\n");
  }

  /**
   * Strip bullet / numbered prefixes (repeat until clean for stacked "1. • …")
   */
  stripListMarkers(line) {
    let current = String(line ?? "");
    let prev;
    do {
      prev = current;
      current = current
        .replace(/^[•◦▪▫‣⁃]\s*/u, "")
        .replace(/^\d+[.)]\s*/u, "")
        .trim();
    } while (current !== prev);
    return current;
  }

  /**
   * Create bullet list (replaces any existing list markers)
   */
  createBulletList(text) {
    const lines = this.normalizeEditorLines(text)
      .split("\n")
      .map((line) => this.stripListMarkers(line))
      .filter((line) => line.length > 0);
    return lines.map((line) => `• ${line}`).join("\n");
  }

  /**
   * Create numbered list (replaces any existing list markers)
   */
  createNumberList(text) {
    const lines = this.normalizeEditorLines(text)
      .split("\n")
      .map((line) => this.stripListMarkers(line))
      .filter((line) => line.length > 0);
    return lines.map((line, index) => `${index + 1}. ${line}`).join("\n");
  }

  /**
   * Replace selected text with formatted text (Quill/TipTap-safe)
   */
  replaceSelection(newText) {
    this.saveState();

    const editor = this.editor;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const trimmedText = String(newText ?? "");
    // Keep intentional leading/trailing spaces only when whole selection had them;
    // unicode maps already preserve structure — avoid aggressive trim wiping lists.
    const textToInsert =
      trimmedText.includes("\n") || /^\s|\s$/.test(trimmedText)
        ? trimmedText
        : trimmedText.trim();

    // Keep focus on editor so Quill/TipTap accept the mutation
    try {
      editor.focus({ preventScroll: true });
    } catch (_) {
      editor.focus();
    }

    let ok = false;

    // Preferred: insertText — Quill and ProseMirror usually hook this
    try {
      if (
        selection.rangeCount &&
        editor.contains(range.commonAncestorContainer)
      ) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      ok = document.execCommand("insertText", false, textToInsert);
    } catch (_) {
      ok = false;
    }

    // Fallback: InputEvent insertText
    if (!ok) {
      try {
        document.execCommand("delete", false);
        const inputEvt = new InputEvent("beforeinput", {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: textToInsert,
        });
        if (editor.dispatchEvent(inputEvt)) {
          ok = document.execCommand("insertText", false, textToInsert);
        }
      } catch (_) {
        /* continue */
      }
    }

    // Last resort: direct DOM (may be reverted by Quill/TipTap)
    if (!ok) {
      try {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const textNode = document.createTextNode(textToInsert);
        r.insertNode(textNode);
        r.setStartAfter(textNode);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        ok = true;
      } catch (_) {
        ok = false;
      }
    }

    // Notify LinkedIn editors
    try {
      editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          cancelable: false,
          inputType: "insertText",
          data: textToInsert,
        })
      );
    } catch (_) {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /**
   * Insert text at cursor position
   */
  insertAtCursor(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) {
      // If no selection, append to editor
      const textNode = document.createTextNode(text);
      this.editor.appendChild(textNode);
    } else {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /**
   * Setup clipboard listener for image paste
   */
  setupClipboardListener() {
    document.addEventListener("paste", async (e) => {
      // Only handle if we're in the LinkedIn editor
      if (!this.editor || !this.editor.contains(e.target)) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Look for image in clipboard
      for (let item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          console.log("LinkedIn Formatter: Image detected in clipboard");

          const blob = item.getAsFile();
          if (blob) {
            await this.handleImageUpload(blob);
          }
          break;
        }
      }
    });
  }

  /**
   * Handle image upload from clipboard - Bulletproof automated upload
   */
  async handleImageUpload(blob) {
    try {
      console.log("LinkedIn Formatter: Processing clipboard image upload");
      this.showNotification("📤 Uploading image...");

      // Create a File object from blob
      const file = new File([blob], `clipboard-image-${Date.now()}.png`, {
        type: blob.type,
      });

      // Strategy 1: If file input exists (modal is open), use it directly
      let fileInput = this.findFileInput();
      if (fileInput) {
        console.log("LinkedIn Formatter: Found existing file input");
        await this.uploadToInput(fileInput, file);
        await this.waitForImagePreview();
        this.showNotification("✓ Image uploaded!");
        return;
      }

      // Strategy 2: Try drag-and-drop simulation on editor (most reliable)
      console.log("LinkedIn Formatter: Trying drag-and-drop simulation...");
      const dropSuccess = await this.simulateDragAndDrop(file);
      if (dropSuccess) {
        this.showNotification("✓ Image uploaded!");
        return;
      }

      // Strategy 3: Click button and use the file input that appears
      console.log("LinkedIn Formatter: Trying button click method...");
      const clickSuccess = await this.clickAndUpload(file);
      if (clickSuccess) {
        this.showNotification("✓ Image uploaded!");
        return;
      }

      // Strategy 4: Create persistent hidden input and inject into LinkedIn's state
      console.log("LinkedIn Formatter: Trying React state injection...");
      const injectSuccess = await this.injectIntoReactState(file);
      if (injectSuccess) {
        this.showNotification("✓ Image uploaded!");
        return;
      }

      // Strategy 5: Force the modal open and use it
      console.log("LinkedIn Formatter: Force modal approach...");
      await this.forceModalAndUpload(file);
    } catch (error) {
      console.error("LinkedIn Formatter: All upload strategies failed:", error);
      this.showNotification(
        "❌ Upload failed. Try clicking the photo button and pasting again."
      );
    }
  }

  /**
   * Simulate drag and drop - Most reliable method
   */
  async simulateDragAndDrop(file) {
    try {
      const dropZone = this.editor;
      if (!dropZone) return false;

      // Create DataTransfer
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      // Simulate drag events
      const dragEnter = new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
      });

      const dragOver = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
      });

      const drop = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer: dataTransfer,
      });

      // Dispatch events in sequence
      dropZone.dispatchEvent(dragEnter);
      await new Promise((resolve) => setTimeout(resolve, 50));
      dropZone.dispatchEvent(dragOver);
      await new Promise((resolve) => setTimeout(resolve, 50));
      dropZone.dispatchEvent(drop);

      // Also try on parent containers
      const containers = [
        dropZone.closest(".share-creation-state__editor"),
        dropZone.closest(".share-box"),
        dropZone.closest(".feed-shared-update-v2__description-wrapper"),
        document.querySelector(".share-creation-state"),
      ].filter(Boolean);

      for (const container of containers) {
        container.dispatchEvent(drop);
      }

      // Wait and check for success
      await new Promise((resolve) => setTimeout(resolve, 800));
      return await this.waitForImagePreview();
    } catch (error) {
      console.error("LinkedIn Formatter: Drag-drop simulation failed:", error);
      return false;
    }
  }

  /**
   * Click button and upload via the input that appears
   */
  async clickAndUpload(file) {
    try {
      const clicked = await this.clickMediaButton();
      if (!clicked) return false;

      // Wait for file input with aggressive checking
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 150));

        const fileInput = this.findFileInput();
        if (fileInput) {
          console.log(
            `LinkedIn Formatter: File input found after ${attempt * 150}ms`
          );
          await this.uploadToInput(fileInput, file);

          // Close modal
          setTimeout(() => this.closeModal(), 400);

          return await this.waitForImagePreview();
        }
      }

      return false;
    } catch (error) {
      console.error("LinkedIn Formatter: Click and upload failed:", error);
      return false;
    }
  }

  /**
   * Inject file into React component state
   */
  async injectIntoReactState(file) {
    try {
      // Find the share box React fiber
      const shareBox = document.querySelector(
        ".share-box, .share-creation-state"
      );
      if (!shareBox) return false;

      // Try to find React fiber
      const fiberKey = Object.keys(shareBox).find(
        (key) =>
          key.startsWith("__reactFiber") ||
          key.startsWith("__reactInternalInstance")
      );

      if (fiberKey) {
        // Create a synthetic file input event
        const syntheticInput = document.createElement("input");
        syntheticInput.type = "file";
        syntheticInput.accept = "image/*";

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        syntheticInput.files = dataTransfer.files;

        shareBox.appendChild(syntheticInput);

        // Dispatch events
        ["change", "input"].forEach((eventType) => {
          syntheticInput.dispatchEvent(new Event(eventType, { bubbles: true }));
        });

        await new Promise((resolve) => setTimeout(resolve, 600));
        syntheticInput.remove();

        return await this.waitForImagePreview();
      }

      return false;
    } catch (error) {
      console.error("LinkedIn Formatter: React injection failed:", error);
      return false;
    }
  }

  /**
   * Force modal open and upload
   */
  async forceModalAndUpload(file) {
    // Click the button
    const clicked = await this.clickMediaButton();
    if (!clicked) {
      throw new Error("Could not find or click media button");
    }

    // Wait longer for modal
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Try to find file input more aggressively
    const allInputs = document.querySelectorAll('input[type="file"]');
    let targetInput = null;

    for (const input of allInputs) {
      // Take ANY file input we can find
      targetInput = input;
      break;
    }

    if (targetInput) {
      console.log("LinkedIn Formatter: Found file input, uploading...");
      await this.uploadToInput(targetInput, file);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to close modal
      this.closeModal();

      const hasImage = await this.waitForImagePreview();
      if (hasImage) {
        this.showNotification("✓ Image uploaded!");
        return;
      }
    }

    throw new Error("Could not complete upload");
  }

  /**
   * Wait for image preview to appear
   */
  async waitForImagePreview() {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const preview = document.querySelector(
        '.share-box img[src^="blob:"], ' +
          '.share-creation-state img[src^="blob:"], ' +
          ".feed-shared-image__container img, " +
          "img.ivm-view-attr__img--centered, " +
          ".share-box__preview-container"
      );

      if (preview) {
        console.log("LinkedIn Formatter: Image preview detected!");
        return true;
      }
    }
    return false;
  }

  /**
   * Close modal if open
   */
  closeModal() {
    const modal = document.querySelector('.artdeco-modal, [role="dialog"]');
    if (modal) {
      const closeBtn = modal.querySelector(
        '[aria-label*="Dismiss" i], [aria-label*="Close" i], ' +
          ".artdeco-modal__dismiss, button[data-test-modal-close-btn]"
      );
      if (closeBtn) {
        closeBtn.click();
        console.log("LinkedIn Formatter: Modal closed");
      }
    }
  }

  /**
   * Find file input (including hidden ones)
   */
  findFileInput() {
    const selectors = [
      'input[type="file"][accept*="image" i]',
      'input[type="file"][accept*="png" i]',
      'input[type="file"][accept*="jpg" i]',
      'input[type="file"][accept*="video" i]',
      '.share-creation-state input[type="file"]',
      '.artdeco-modal input[type="file"]',
      '[role="dialog"] input[type="file"]',
      'input[type="file"]',
    ];

    for (const selector of selectors) {
      const inputs = document.querySelectorAll(selector);

      for (const input of inputs) {
        // Accept visible OR recently created hidden inputs
        if (
          input.offsetParent !== null ||
          input.style.display !== "none" ||
          Date.now() - (input.dataset.createdAt || 0) < 5000
        ) {
          console.log("LinkedIn Formatter: Found file input:", selector);
          return input;
        }
      }
    }

    return null;
  }

  /**
   * Click LinkedIn's media button with multiple methods
   */
  async clickMediaButton() {
    const buttonSelectors = [
      'button[aria-label*="photo" i]',
      'button[aria-label*="media" i]',
      'button[aria-label*="Add a photo" i]',
      ".share-actions__primary-action button",
      "button.share-box-footer__trigger-btn",
      'button[data-control-name*="photo"]',
      'button[data-control-name*="media"]',
    ];

    for (const selector of buttonSelectors) {
      const buttons = document.querySelectorAll(selector);

      for (const button of buttons) {
        if (button && !button.disabled && button.offsetParent !== null) {
          const ariaLabel = button.getAttribute("aria-label") || "";
          if (
            ariaLabel.toLowerCase().includes("photo") ||
            ariaLabel.toLowerCase().includes("media") ||
            button.querySelector('svg[data-test-icon="image-medium"]')
          ) {
            console.log(
              `LinkedIn Formatter: Clicking media button: ${selector}`
            );

            // Multiple click methods
            button.click();
            button.dispatchEvent(
              new MouseEvent("click", { bubbles: true, cancelable: true })
            );

            await new Promise((resolve) => setTimeout(resolve, 300));
            return true;
          }
        }
      }
    }

    console.log("LinkedIn Formatter: No media button found");
    return false;
  }

  /**
   * Wait for element to appear in DOM
   */
  async waitForElement(selector, timeout = 3000) {
    return new Promise((resolve) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const startTime = Date.now();
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          observer.disconnect();
          resolve(null);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Show image preview in editor (fallback)
   */

  /**
   * Upload file to file input - Maximum compatibility
   */
  async uploadToInput(fileInput, file) {
    return new Promise((resolve, reject) => {
      try {
        console.log("LinkedIn Formatter: Uploading to file input:", file.name);

        // Create DataTransfer
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // Method 1: Define property
        try {
          Object.defineProperty(fileInput, "files", {
            value: dataTransfer.files,
            writable: false,
            configurable: true,
          });
        } catch (e) {
          // Method 2: Direct assignment
          try {
            fileInput.files = dataTransfer.files;
          } catch (e2) {
            console.warn("LinkedIn Formatter: Files property set failed");
          }
        }

        // Trigger maximum events
        const events = [
          new Event("change", { bubbles: true, cancelable: true }),
          new Event("input", { bubbles: true, cancelable: true }),
          new InputEvent("input", { bubbles: true, inputType: "insertFile" }),
          new Event("change", { bubbles: false }),
          new Event("input", { bubbles: false }),
          new UIEvent("change", { bubbles: true }),
        ];

        // Dispatch on input itself
        events.forEach((event) => {
          try {
            fileInput.dispatchEvent(event);
          } catch (e) {}
        });

        // Focus and blur to trigger React
        try {
          fileInput.focus();
          fileInput.blur();
        } catch (e) {}

        // Trigger on all parent elements
        let parent = fileInput.parentElement;
        let depth = 0;
        while (parent && depth < 8) {
          try {
            parent.dispatchEvent(new Event("change", { bubbles: true }));
            parent.dispatchEvent(new Event("input", { bubbles: true }));
          } catch (e) {}
          parent = parent.parentElement;
          depth++;
        }

        // If input has an onchange, call it directly
        if (typeof fileInput.onchange === "function") {
          try {
            fileInput.onchange({ target: fileInput });
          } catch (e) {}
        }

        console.log("LinkedIn Formatter: All upload events dispatched");
        setTimeout(() => resolve(true), 300);
      } catch (error) {
        console.error("LinkedIn Formatter: uploadToInput failed:", error);
        reject(error);
      }
    });
  }

  /**
   * Start observing for file input creation and auto-upload pending image
   */
  /**
   * Save current selection/cursor position
   */
  saveSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0);
    }
    return null;
  }

  /**
   * Restore saved selection/cursor position
   */
  restoreSelection(range) {
    if (range) {
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * Place cursor at the end of editor content
   */
  placeCursorAtEnd() {
    this.editor.focus();
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(this.editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Save current editor state (no-op - undo/redo removed)
   */
  saveState() {
    // No-op: undo/redo functionality removed
    return;
  }

  /**
   * Clear all formatting from selected text
   */
  clearFormatting() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString();
    if (!selectedText) {
      this.showNotification("Please select text to clear formatting");
      return;
    }

    this.saveState();

    // Remove all Unicode formatting by converting to plain text
    const plainText = this.removeFancyFormatting(selectedText);
    this.replaceSelection(plainText);

    this.showNotification("Formatting cleared");
  }

  /**
   * Decode Unicode "fonts" / math alphanumerics back to plain ASCII.
   * Keeps list markers and newlines (call normalizeEditorLines separately).
   */
  decodeFancyCharacters(text) {
    let result = String(text ?? "");

    // Remove combining characters (underline, strikethrough, accents)
    result = result.replace(/[\u0300-\u036F]/g, "");

    // Letterlike Symbols (U+2100-U+214F)
    result = result.replace(/ℂ/g, "C");
    result = result.replace(/ℍ/g, "H");
    result = result.replace(/ℕ/g, "N");
    result = result.replace(/ℙ/g, "P");
    result = result.replace(/ℚ/g, "Q");
    result = result.replace(/ℝ/g, "R");
    result = result.replace(/ℤ/g, "Z");
    result = result.replace(/ℭ/g, "C");
    result = result.replace(/ℌ/g, "H");
    result = result.replace(/ℑ/g, "I");
    result = result.replace(/ℜ/g, "R");
    result = result.replace(/ℨ/g, "Z");
    result = result.replace(/ℎ/g, "h");
    result = result.replace(/ℏ/g, "h");
    result = result.replace(/ℓ/g, "l");
    result = result.replace(/ℯ/g, "e");
    result = result.replace(/ℊ/g, "g");
    result = result.replace(/ℴ/g, "o");
    result = result.replace(/ℵ/g, "N");
    result = result.replace(/ℶ/g, "B");
    result = result.replace(/ℷ/g, "G");
    result = result.replace(/ℸ/g, "D");

    result = Array.from(result)
      .map((char) => {
        const code = char.codePointAt(0);

        if (code >= 0x2460 && code <= 0x2473) {
          return String.fromCharCode(49 + (code - 0x2460));
        }
        if (code >= 0x24b6 && code <= 0x24cf) {
          return String.fromCharCode(65 + (code - 0x24b6));
        }
        if (code >= 0x24d0 && code <= 0x24e9) {
          return String.fromCharCode(97 + (code - 0x24d0));
        }
        if (code === 0x24ea) return "0";

        if (code >= 0x1f130 && code <= 0x1f149) {
          return String.fromCharCode(65 + (code - 0x1f130));
        }

        if (code >= 0x1d400 && code <= 0x1d7ff) {
          if (code >= 0x1d400 && code <= 0x1d419)
            return String.fromCharCode(65 + (code - 0x1d400));
          if (code >= 0x1d41a && code <= 0x1d433)
            return String.fromCharCode(97 + (code - 0x1d41a));
          if (code >= 0x1d434 && code <= 0x1d44d)
            return String.fromCharCode(65 + (code - 0x1d434));
          if (code >= 0x1d44e && code <= 0x1d467)
            return String.fromCharCode(97 + (code - 0x1d44e));
          if (code >= 0x1d468 && code <= 0x1d481)
            return String.fromCharCode(65 + (code - 0x1d468));
          if (code >= 0x1d482 && code <= 0x1d49b)
            return String.fromCharCode(97 + (code - 0x1d482));
          if (code >= 0x1d49c && code <= 0x1d4b5)
            return String.fromCharCode(65 + (code - 0x1d49c));
          if (code >= 0x1d4b6 && code <= 0x1d4cf)
            return String.fromCharCode(97 + (code - 0x1d4b6));
          if (code >= 0x1d4d0 && code <= 0x1d4e9)
            return String.fromCharCode(65 + (code - 0x1d4d0));
          if (code >= 0x1d4ea && code <= 0x1d503)
            return String.fromCharCode(97 + (code - 0x1d4ea));
          if (code >= 0x1d504 && code <= 0x1d51c)
            return String.fromCharCode(65 + (code - 0x1d504));
          if (code >= 0x1d51e && code <= 0x1d537)
            return String.fromCharCode(97 + (code - 0x1d51e));
          if (code >= 0x1d538 && code <= 0x1d551)
            return String.fromCharCode(65 + (code - 0x1d538));
          if (code >= 0x1d552 && code <= 0x1d56b)
            return String.fromCharCode(97 + (code - 0x1d552));
          if (code >= 0x1d56c && code <= 0x1d585)
            return String.fromCharCode(65 + (code - 0x1d56c));
          if (code >= 0x1d586 && code <= 0x1d59f)
            return String.fromCharCode(97 + (code - 0x1d586));
          if (code >= 0x1d5a0 && code <= 0x1d5b9)
            return String.fromCharCode(65 + (code - 0x1d5a0));
          if (code >= 0x1d5ba && code <= 0x1d5d3)
            return String.fromCharCode(97 + (code - 0x1d5ba));
          if (code >= 0x1d5d4 && code <= 0x1d5ed)
            return String.fromCharCode(65 + (code - 0x1d5d4));
          if (code >= 0x1d5ee && code <= 0x1d607)
            return String.fromCharCode(97 + (code - 0x1d5ee));
          if (code >= 0x1d608 && code <= 0x1d621)
            return String.fromCharCode(65 + (code - 0x1d608));
          if (code >= 0x1d622 && code <= 0x1d63b)
            return String.fromCharCode(97 + (code - 0x1d622));
          if (code >= 0x1d63c && code <= 0x1d655)
            return String.fromCharCode(65 + (code - 0x1d63c));
          if (code >= 0x1d656 && code <= 0x1d66f)
            return String.fromCharCode(97 + (code - 0x1d656));
          if (code >= 0x1d670 && code <= 0x1d689)
            return String.fromCharCode(65 + (code - 0x1d670));
          if (code >= 0x1d68a && code <= 0x1d6a3)
            return String.fromCharCode(97 + (code - 0x1d68a));
        }

        return char;
      })
      .join("");

    return result;
  }

  /**
   * Remove fancy Unicode formatting from text
   */
  removeFancyFormatting(text) {
    // Normalize Quill double-paragraph breaks first (fixes extra blank lines)
    let result = this.normalizeEditorLines(text);

    // Remove bullets and numbered lists per line (including stacked markers)
    result = result
      .split("\n")
      .map((line) => this.stripListMarkers(line))
      .join("\n");

    // Decode Unicode fonts / math symbols / combining marks to ASCII
    result = this.decodeFancyCharacters(result);

    // Final pass: no leftover blank lines from editor paragraph separators
    return this.normalizeEditorLines(result).replace(/^\n+|\n+$/g, "");
  }

  /**
   * Show notification to user
   */
  showNotification(message) {
    // Remove existing notification
    const existing = document.querySelector(".lf-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = "lf-notification";
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("lf-notification-show");
    }, 10);

    setTimeout(() => {
      notification.classList.remove("lf-notification-show");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Cleanup when editor is closed
   */
  cleanup() {
    if (this.editorToolbars?.size) {
      for (const [, meta] of this.editorToolbars) {
        meta.toolbar?.remove();
      }
      this.editorToolbars.clear();
    }
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    this.editor = null;
    this.isToolbarVisible = false;
    console.log("LinkedIn Formatter: Cleaned up");
  }

  /**
   * Initialize job filter feature for adding "Last 1 hour" option
   */
  initJobFilters() {
    // Only run on job search pages
    if (!window.location.pathname.includes("/jobs/")) {
      return;
    }

    console.log(
      "LinkedIn Formatter: Job page detected, initializing filters..."
    );

    this._lfFilterInjectTimer = null;
    const scheduleInject = () => {
      if (this._lfFilterInjectTimer) clearTimeout(this._lfFilterInjectTimer);
      // Debounce: LinkedIn rebuilds filters often; early inject breaks alignment
      this._lfFilterInjectTimer = setTimeout(() => {
        this.injectCustomTimeFilter();
      }, 350);
    };

    const observer = new MutationObserver(scheduleInject);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    scheduleInject();
    setTimeout(() => this.injectCustomTimeFilter(), 800);
    setTimeout(() => this.injectCustomTimeFilter(), 2000);

    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        if (url.includes("/jobs/")) {
          scheduleInject();
          setTimeout(() => this.injectCustomTimeFilter(), 600);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Whether "Last 1 hour" filter is active via URL
   */
  isOneHourFilterActive() {
    return new URLSearchParams(window.location.search).get("f_TPR") === "r3600";
  }

  /**
   * Small Casper ghost for the filter pill (white on green, green on idle)
   */
  getFilterCasperIconHtml(selected) {
    const fill = selected ? "#ffffff" : "#057642";
    const eye = selected ? "#057642" : "#ffffff";
    return `<span class="lf-filter-casper-icon" aria-hidden="true" style="display:inline-flex;align-items:center;justify-content:center;line-height:0;width:14px;height:14px;flex-shrink:0;margin-right:6px;"><svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 4 C10 4 6 8 6 14 V24 L9 22 L12 24 L16 22 L20 24 L23 22 L26 24 V14 C26 8 22 4 16 4 Z" fill="${fill}"/><circle cx="13" cy="13" r="2" fill="${eye}"/><circle cx="19" cy="13" r="2" fill="${eye}"/><path d="M12 17 Q16 20 20 17" stroke="${eye}" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></span>`;
  }

  /**
   * Apply selected / idle styles for the Last 1 hour pill
   */
  syncOneHourFilterState(button) {
    const btn =
      button || document.querySelector(".lf-custom-time-filter");
    if (!btn) return;

    const selected = this.isOneHourFilterActive();
    btn.setAttribute("aria-pressed", selected ? "true" : "false");
    btn.classList.toggle("lf-custom-time-filter--selected", selected);

    const icon = this.getFilterCasperIconHtml(selected);
    btn.innerHTML = `${icon}<span class="lf-filter-label">Last 1 hour</span>`;

    if (selected) {
      // Match LinkedIn selected filter green (#057642)
      btn.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0;
        padding: 0 12px 0 10px !important;
        height: 32px !important;
        margin: 0 4px 8px 0 !important;
        border: 1px solid #057642 !important;
        border-radius: 16px !important;
        background: #057642 !important;
        color: #ffffff !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        line-height: 1 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        width: auto !important;
        max-width: none !important;
        flex: 0 0 auto !important;
        vertical-align: middle;
      `;
    } else {
      btn.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0;
        padding: 0 12px 0 10px !important;
        height: 32px !important;
        margin: 0 4px 8px 0 !important;
        border: 1px solid rgba(0, 0, 0, 0.6) !important;
        border-radius: 16px !important;
        background: transparent !important;
        color: rgba(0, 0, 0, 0.9) !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
        line-height: 1 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        width: auto !important;
        max-width: none !important;
        flex: 0 0 auto !important;
        vertical-align: middle;
      `;
    }
  }

  /**
   * Locate LinkedIn date-posted / Past 24 hours filter control
   */
  findDatePostedFilterButton() {
    const selectors = [
      'button[aria-label*="Past 24 hours" i]',
      'button[aria-label*="Date posted" i]',
      'button[aria-label*="Any time" i]',
      "button.search-reusables__filter-pill-button",
      ".search-reusables__filter-pill-button",
      ".artdeco-pill--choice",
    ];

    for (const selector of selectors) {
      for (const button of document.querySelectorAll(selector)) {
        if (button.classList.contains("lf-custom-time-filter")) continue;
        const text = (button.textContent || "").trim();
        const ariaLabel = button.getAttribute("aria-label") || "";
        if (
          /Past 24|24 hours|Date posted|Any time|Past week|Past month/i.test(
            text + " " + ariaLabel
          )
        ) {
          return button;
        }
      }
    }
    return null;
  }

  /**
   * Inject custom "Last 1 hour" filter option
   */
  injectCustomTimeFilter() {
    if (
      typeof FeatureFlags !== "undefined" &&
      !FeatureFlags.isEnabledSync("filterPill")
    ) {
      return;
    }
    if (!window.location.pathname.includes("/jobs/")) {
      return;
    }

    const fTPR = new URLSearchParams(window.location.search).get("f_TPR");
    const isOneHourActive = fTPR === "r3600";
    const existing = document.querySelector(".lf-custom-time-filter");

    // Already present — re-home if misplaced, then sync selected state
    if (existing) {
      const dateBtn =
        this.findDatePostedFilterButton() ||
        (typeof LinkedInDOM !== "undefined"
          ? LinkedInDOM.getDatePostedFilterButton()
          : null);
      if (dateBtn) {
        const anchor = dateBtn.closest("li") || dateBtn;
        const ourWrap = existing.closest("li") || existing;
        const sameRow = ourWrap.parentElement === anchor.parentElement;
        const correctlyAfter =
          sameRow &&
          (anchor.nextElementSibling === ourWrap ||
            ourWrap.previousElementSibling === anchor);
        if (!correctlyAfter) {
          if (anchor.tagName === "LI") {
            let li = existing.closest("li");
            if (!li) {
              li = document.createElement("li");
              li.className =
                anchor.className || "search-reusables__primary-filter";
              li.appendChild(existing);
            }
            anchor.insertAdjacentElement("afterend", li);
          } else {
            anchor.insertAdjacentElement("afterend", existing);
          }
        }
      }
      const needSync =
        existing.getAttribute("aria-pressed") !==
          (isOneHourActive ? "true" : "false") ||
        !existing.querySelector(".lf-filter-casper-icon");
      if (needSync) this.syncOneHourFilterState(existing);
      return;
    }

    const dateBtn =
      this.findDatePostedFilterButton() ||
      (typeof LinkedInDOM !== "undefined"
        ? LinkedInDOM.getDatePostedFilterButton()
        : null);
    if (!dateBtn) {
      // Wait — injecting before LinkedIn filters exist breaks alignment
      return;
    }

    this.addCustomFilterButton(dateBtn);
  }

  /**
   * Add custom filter button next to LinkedIn's date-posted pill
   */
  addCustomFilterButton(datePostedButton) {
    if (!datePostedButton || document.querySelector(".lf-custom-time-filter")) {
      return;
    }

    const customButton = document.createElement("button");
    customButton.className =
      "lf-custom-time-filter artdeco-pill artdeco-pill--slate artdeco-pill--choice artdeco-pill--2 search-reusables__filter-pill-button";
    customButton.setAttribute("type", "button");
    customButton.setAttribute("aria-label", "Last 1 hour — CareerCraft AI");

    this.syncOneHourFilterState(customButton);

    customButton.onmouseenter = () => {
      if (customButton.getAttribute("aria-pressed") === "true") {
        customButton.style.background = "#046236";
        customButton.style.borderColor = "#046236";
        return;
      }
      customButton.style.background = "rgba(0, 0, 0, 0.08)";
      customButton.style.borderColor = "rgba(0, 0, 0, 0.75)";
    };
    customButton.onmouseleave = () => {
      // Re-apply selected/idle styles (don't wipe green)
      this.syncOneHourFilterState(customButton);
    };

    customButton.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.applyOneHourFilter();
    };

    // Insert as sibling after date-posted control (same list row)
    const anchor = datePostedButton.closest("li") || datePostedButton;
    if (anchor.tagName === "LI") {
      const li = document.createElement("li");
      li.className =
        datePostedButton.closest("li")?.className ||
        "search-reusables__primary-filter";
      li.appendChild(customButton);
      anchor.insertAdjacentElement("afterend", li);
    } else {
      anchor.insertAdjacentElement("afterend", customButton);
    }

    console.log('LinkedIn Formatter: Custom "Last 1 hour" filter added!');
  }

  /**
   * Apply the 1-hour filter by modifying URL
   */
  applyOneHourFilter() {
    const currentUrl = new URL(window.location.href);

    // Set f_TPR to r3600 (last 1 hour = 3600 seconds)
    currentUrl.searchParams.set("f_TPR", "r3600");
    currentUrl.searchParams.set("refresh", "true");

    // Optimistic UI before navigation
    const btn = document.querySelector(".lf-custom-time-filter");
    if (btn) this.syncOneHourFilterState(btn);

    this.showNotification("Filtering jobs from last 1 hour...");

    window.location.href = currentUrl.toString();
  }

  /**
   * Initialize job stats display feature
   */
  initJobStats() {
    let displayTimeout = null;
    let lastUrl = location.href;
    let lastJobId = null;
    this.isDisplayingStats = false;

    const checkAndDisplay = () => {
      // Clear any pending display to avoid duplicates
      if (displayTimeout) {
        clearTimeout(displayTimeout);
      }

      // Debounce: wait 1200ms before displaying (increased for stability)
      displayTimeout = setTimeout(() => {
        if (this.isJobDetailPage() && !this.isDisplayingStats) {
          console.log(
            "LinkedIn Formatter: Job detail page detected, displaying stats..."
          );
          this.displayJobStats();
        }
      }, 1200);
    };

    // Try after initial load
    checkAndDisplay();

    // Single observer for both URL changes and content changes
    const observer = new MutationObserver(() => {
      const url = location.href;
      const urlParams = new URLSearchParams(url.split("?")[1] || "");
      const currentJobId =
        urlParams.get("currentJobId") || url.match(/\/jobs\/view\/(\d+)/)?.[1];

      // URL or Job ID changed - remove old box and check new page
      if (url !== lastUrl || (currentJobId && currentJobId !== lastJobId)) {
        lastUrl = url;
        lastJobId = currentJobId;
        const oldBox = document.querySelector(".lf-job-stats-box");
        if (oldBox) oldBox.remove();
        this.isDisplayingStats = false; // Always reset so next job can run

        // Clear API data for new job
        this.apiData = {};
        console.log("LinkedIn Formatter: New job detected, cleared old data");

        checkAndDisplay();
      }
      // Content changed and no box exists and not already processing
      else if (
        this.isJobDetailPage() &&
        !document.querySelector(".lf-job-stats-box") &&
        !this.isDisplayingStats
      ) {
        checkAndDisplay();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Check if current page is a job detail page (not just listing)
   */
  isJobDetailPage() {
    if (typeof LinkedInDOM !== "undefined" && LinkedInDOM.isJobDetailPage) {
      return LinkedInDOM.safeRun("isJobDetailPage", () =>
        LinkedInDOM.isJobDetailPage()
      );
    }
    const url = window.location.href;
    // Must have job identifier in URL AND have the detail view container
    const hasJobUrl =
      url.includes("/jobs/view/") || url.includes("currentJobId=");
    const hasDetailContainer = document.querySelector(
      ".jobs-details__main-content, .jobs-unified-top-card, .scaffold-layout__detail"
    );

    // Also check we're not in the mobile/compact view or listing view
    const isListingView = document
      .querySelector(".jobs-search-results-list")
      ?.contains(document.querySelector(".jobs-unified-top-card"));

    return hasJobUrl && hasDetailContainer && !isListingView;
  }

  /**
   * Casper ghost SVG for ATS / AI headers (falls back if avatar module missing)
   */
  getCasperIconHtml(size = 20) {
    let svg;
    if (typeof CasperAvatar !== "undefined" && CasperAvatar.icon) {
      svg = CasperAvatar.icon(size);
    } else if (typeof CasperAvatar !== "undefined" && CasperAvatar.getSVG) {
      svg = CasperAvatar.getSVG({
        size,
        className: "casper-avatar casper-inline-icon",
      });
    } else {
      svg = `<svg class="casper-avatar casper-inline-icon" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 4 C10 4 6 8 6 14 V24 L9 22 L12 24 L16 22 L20 24 L23 22 L26 24 V14 C26 8 22 4 16 4 Z" fill="#0a66c2"/><circle cx="13" cy="13" r="2" fill="white"/><circle cx="19" cy="13" r="2" fill="white"/><path d="M12 17 Q16 20 20 17" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
    }
    return `<span class="lf-casper-icon-wrap" style="display:inline-flex;align-items:center;justify-content:center;line-height:0;width:${size}px;height:${size}px;flex-shrink:0;transform:translateY(2px);">${svg}</span>`;
  }

  /**
   * Ensure shared ATS box CSS is present (and keep it updated)
   */
  ensureJobStatsStyles() {
    const css = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .lf-stats-header {
        font-size: 16px;
        font-weight: 700;
        color: #1a56db;
        margin: 0 0 20px 0;
        padding: 0;
        text-align: center;
        letter-spacing: 0.3px;
        display: flex !important;
        align-items: center !important;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;
        line-height: 1.25;
      }
      .lf-stats-header .lf-casper-icon-wrap {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        line-height: 0;
        margin: 0;
        padding: 0;
        /* Ghost SVG reads high — optical nudge to match text midline */
        transform: translateY(2px);
      }
      .lf-stats-header .lf-casper-icon-wrap .casper-inline-icon,
      .lf-stats-header .lf-casper-icon-wrap svg {
        display: block !important;
        margin: 0;
        padding: 0;
        line-height: 0;
      }
      .lf-stats-header > span:not(.lf-casper-icon-wrap) {
        display: inline-flex;
        align-items: center;
        line-height: 1.25;
      }
      .lf-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
      }
      @media (max-width: 768px) {
        .lf-stats-grid {
          grid-template-columns: 1fr;
        }
      }
      .lf-stat-item {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        transition: all 0.2s ease;
      }
      .lf-stat-item:hover {
        border-color: #93c5fd;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      .lf-stat-label {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 5px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .lf-stat-value {
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
        line-height: 1.4;
        word-break: break-word;
      }
    `;

    let style = document.querySelector("#lf-job-stats-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "lf-job-stats-styles";
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  /**
   * Apply styles to job stats box
   * Top margin 50px keeps the card clear of LinkedIn's sticky job title bar
   */
  applyJobStatsStyles(box) {
    this.ensureJobStatsStyles();
    const TOP_MARGIN = 50;
    box.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
      border: 2px solid #0ea5e9;
      border-radius: 14px;
      padding: 18px;
      margin: ${TOP_MARGIN}px 0 16px;
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.15);
      animation: slideIn 0.3s ease-out;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
      display: flow-root;
    `;
  }

  async displayJobStats(retryCount = 0) {
    if (
      typeof FeatureFlags !== "undefined" &&
      !(await FeatureFlags.isEnabled("ats"))
    ) {
      return;
    }

    // Check if we're on the right page
    if (!this.isJobDetailPage()) {
      console.log("LinkedIn Formatter: Not on job detail page, skipping");
      return;
    }

    // Don't create duplicate boxes - check thoroughly
    if (document.querySelector(".lf-job-stats-box")) {
      console.log("LinkedIn Formatter: Stats box already exists, skipping");
      return;
    }

    // Prevent concurrent executions (blinking fix)
    if (this.isDisplayingStats) {
      console.log("LinkedIn Formatter: Already processing, skipping");
      return;
    }
    this.isDisplayingStats = true;

    // Also check if we're in the job list card (not detail view)
    const jobCard = document.querySelector(
      ".jobs-search-results-list .job-card-container"
    );
    if (jobCard && jobCard.querySelector(".jobs-unified-top-card")) {
      console.log(
        "LinkedIn Formatter: Detected job list card, not detail view"
      );
      this.isDisplayingStats = false;
      return;
    }

    // Find the right-side job details container with multiple fallbacks
    const containerSelectors = [
      ".jobs-details__main-content",
      ".jobs-details",
      ".job-view-layout",
      ".jobs-search__job-details",
      ".jobs-details-top-card",
      'div[class*="jobs-details"]',
    ];

    let jobContainer =
      (typeof LinkedInDOM !== "undefined" &&
        LinkedInDOM.getJobDetailContainer()) ||
      null;
    if (jobContainer) {
      console.log("LinkedIn Formatter: Found container via LinkedInDOM");
    } else {
      for (const selector of containerSelectors) {
        jobContainer = document.querySelector(selector);
        if (jobContainer) {
          console.log("LinkedIn Formatter: Found container:", selector);
          break;
        }
      }
    }

    if (!jobContainer) {
      console.log("LinkedIn Formatter: No job container found");
      // Clear lock so retry / later mutations can run
      this.isDisplayingStats = false;
      if (retryCount === 0) {
        setTimeout(() => this.displayJobStats(1), 1500);
      }
      return;
    }

    try {
      // Initialize AI service and extractors
      const aiService = new AIService();
      const jobExtractor = new JobExtractor();
      const profileExtractor = new ProfileExtractor();

      // Extract job data using JobExtractor
      console.log("LinkedIn Formatter: Extracting job data...");
      const jobData = await jobExtractor.extractJobData();

      // Create loading box first
      const loadingBox = this.createLoadingBox();
      this.insertStatsBox(loadingBox, jobContainer);

      // Check if AI is configured
      const aiInitialized = await aiService.initialize();

      if (!aiInitialized) {
        console.log(
          "LinkedIn Formatter: AI not configured, showing basic stats"
        );
        loadingBox.remove();
        const basicStatsBox = this.createBasicStatsBox(jobData);
        this.insertStatsBox(basicStatsBox, jobContainer);
        return;
      }

      // Extract profile data
      console.log("LinkedIn Formatter: Extracting profile data...");
      const profileData = await profileExtractor.extractProfile();

      // Initialize cache manager
      const cacheManager = new CacheManager();

      // Extract job ID from URL
      const url = window.location.href;
      const urlParams = new URLSearchParams(url.split("?")[1] || "");
      const jobId =
        urlParams.get("currentJobId") || url.match(/\/jobs\/view\/(\d+)/)?.[1];

      // Check cache first
      let atsAnalysis = null;
      let isCached = false;

      if (jobId) {
        console.log(`LinkedIn Formatter: Checking cache for job ${jobId}...`);
        atsAnalysis = await cacheManager.getAtsCache(jobId, profileData);

        if (atsAnalysis) {
          console.log("LinkedIn Formatter: ✅ Cache HIT - using cached result");
          isCached = true;

          // Still extract requirements for display (quick, doesn't need cache)
          try {
            const requirements = await aiService.extractJobRequirements(
              jobData.description
            );
            jobData.requirements = requirements;
          } catch (error) {
            console.error("Failed to extract requirements:", error);
            jobData.requirements = null;
          }
        } else {
          console.log(
            "LinkedIn Formatter: ❌ Cache MISS - running AI analysis"
          );
        }
      }

      // If not cached, run full AI analysis
      if (!atsAnalysis) {
        // Extract job requirements using AI
        console.log("LinkedIn Formatter: Extracting job requirements...");
        try {
          const requirements = await aiService.extractJobRequirements(
            jobData.description
          );
          jobData.requirements = requirements;
          console.log(
            "LinkedIn Formatter: Job requirements extracted:",
            requirements
          );
        } catch (error) {
          console.error(
            "LinkedIn Formatter: Failed to extract requirements:",
            error
          );
          jobData.requirements = null;
        }

        // Run AI analysis
        console.log("LinkedIn Formatter: Running AI ATS analysis...");
        atsAnalysis = await aiService.analyzeJobCompatibility(
          jobData,
          profileData
        );

        // Save to cache
        if (atsAnalysis && jobId) {
          await cacheManager.saveAtsCache(
            jobId,
            atsAnalysis,
            profileData,
            jobData
          );
          console.log("LinkedIn Formatter: Result saved to cache");
        }
      }

      // Remove loading box and show results
      loadingBox.remove();

      if (atsAnalysis && atsAnalysis.overallScore !== undefined) {
        console.log("LinkedIn Formatter: AI analysis complete:", atsAnalysis);
        const statsBox = this.createAIStatsBox(jobData, atsAnalysis, isCached);
        this.insertStatsBox(statsBox, jobContainer);
      } else {
        console.log(
          "LinkedIn Formatter: AI analysis failed, showing basic stats"
        );
        const basicStatsBox = this.createBasicStatsBox(jobData);
        this.insertStatsBox(basicStatsBox, jobContainer);
      }
    } catch (error) {
      console.error("LinkedIn Formatter: Error in stats display:", error);
      // Remove loading box if it exists
      const loadingBox = document.querySelector(".lf-job-stats-box");
      if (loadingBox) loadingBox.remove();

      // Show error message
      const errorBox = this.createErrorBox(error.message, jobContainer);
      if (errorBox && jobContainer) {
        this.insertStatsBox(errorBox, jobContainer);
      }
    } finally {
      // Always clear the processing flag
      this.isDisplayingStats = false;
    }
  }

  /**
   * Insert stats box into the page at the best location
   */
  insertStatsBox(statsBox, jobContainer) {
    // Find the best insertion point - after the job title/company but before apply button
    const insertionPoints = [
      ".jobs-details__main-content > .mt5",
      ".jobs-unified-top-card",
      ".jobs-details-top-card__content",
      ".jobs-box--generic-attributes",
    ];

    let inserted = false;
    for (const selector of insertionPoints) {
      const targetElement = jobContainer.querySelector(selector);
      if (targetElement) {
        // Insert after the target element
        targetElement.parentNode.insertBefore(
          statsBox,
          targetElement.nextSibling
        );
        inserted = true;
        console.log("LinkedIn Formatter: Inserted after", selector);
        break;
      }
    }

    if (!inserted) {
      // Fallback: insert at the very top but with proper spacing
      const firstChild = jobContainer.querySelector(
        ".scaffold-layout__detail > *"
      );
      if (firstChild) {
        firstChild.parentNode.insertBefore(statsBox, firstChild);
      } else {
        jobContainer.insertBefore(statsBox, jobContainer.firstChild);
      }
    }

    console.log("LinkedIn Formatter: Job stats box displayed successfully");
  }

  /**
   * Extract job information from the page
   */
  async extractJobInfo() {
    const info = {};

    try {
      console.log("LinkedIn Formatter: Starting extraction...");
      console.log(
        "LinkedIn Formatter: Current page URL:",
        window.location.href
      );

      // FIRST: Get ALL visible text from the page for debugging
      const pageText = document.body.innerText;
      console.log(
        "LinkedIn Formatter: Full page text (first 500 chars):",
        pageText.substring(0, 500)
      );

      // Check if "applicants" text exists anywhere
      const applicantMatches = pageText.match(/\d+[+]?\s+applicant/gi);
      console.log(
        "LinkedIn Formatter: Found applicant text on page:",
        applicantMatches
      );

      // Try to extract from embedded JSON in page (if API intercept didn't work)
      if (Object.keys(this.apiData).length === 0) {
        console.log(
          "LinkedIn Formatter: No API data yet, checking page scripts..."
        );
        this.tryExtractFromPageScripts();
      }

      // Extract job title
      const titleSelectors = [
        "h1.job-details-jobs-unified-top-card__job-title",
        "h2.t-24",
        ".jobs-unified-top-card__job-title",
        "h1.jobs-unified-top-card__job-title",
        ".job-details h1",
        ".jobs-details h1",
      ];

      for (const selector of titleSelectors) {
        const titleEl = document.querySelector(selector);
        if (titleEl && titleEl.textContent.trim()) {
          info.title = titleEl.textContent.trim();
          console.log("LinkedIn Formatter: Found title:", info.title);
          break;
        }
      }

      // Extract company name
      const companySelectors = [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        ".jobs-unified-top-card__subtitle-primary-grouping a",
        ".job-details .jobs-unified-top-card__company-name",
      ];

      for (const selector of companySelectors) {
        const companyEl = document.querySelector(selector);
        if (companyEl && companyEl.textContent.trim()) {
          info.company = companyEl.textContent.trim();
          console.log("LinkedIn Formatter: Found company:", info.company);
          break;
        }
      }

      // Strategy 1: Get ALL text from the subtitle/primary area (where "11 applicants", "1 hour ago" appear)
      const subtitleSelectors = [
        ".jobs-unified-top-card__primary-description",
        ".jobs-unified-top-card__subtitle-primary-grouping",
        ".job-details-jobs-unified-top-card__primary-description",
        ".jobs-details__main-content > div:first-child",
      ];

      let fullSubtitleText = "";
      for (const selector of subtitleSelectors) {
        const el = document.querySelector(selector);
        if (el) {
          fullSubtitleText = el.textContent.trim();
          console.log(
            "LinkedIn Formatter: Found subtitle area text:",
            fullSubtitleText
          );
          break;
        }
      }

      // Extract applicants - prioritize API data (most accurate)
      // Strategy 1: Use intercepted API data (LIVE DATA - most reliable)
      if (this.apiData.appliedCount !== undefined) {
        info.applicants = `${this.apiData.appliedCount} applicants`;
        info.applicantsSource = "API (Live)";
        console.log(
          "LinkedIn Formatter: Found applicants from API:",
          info.applicants
        );
      } else if (this.apiData.numApplicants !== undefined) {
        info.applicants = `${this.apiData.numApplicants} applicants`;
        info.applicantsSource = "API (Live)";
        console.log(
          "LinkedIn Formatter: Found numApplicants from API:",
          info.applicants
        );
      } else if (this.apiData.applicantCount !== undefined) {
        info.applicants = `${this.apiData.applicantCount} applicants`;
        info.applicantsSource = "API (Live)";
        console.log(
          "LinkedIn Formatter: Found applicantCount from API:",
          info.applicants
        );
      }

      // Strategy 2: Direct page text search (MOST RELIABLE)
      if (!info.applicants) {
        const allText = document.body.innerText;
        console.log(
          "LinkedIn Formatter: Searching for applicants in full text..."
        );

        // Simple pattern: any number followed by "applicant" or "application"
        const patterns = [
          /(\d+\+?)\s+applicants?/i,
          /(\d+\+?)\s+applications?/i,
          /applicants?:\s*(\d+\+?)/i,
        ];

        for (const pattern of patterns) {
          const match = allText.match(pattern);
          if (match) {
            info.applicants = match[0];
            info.applicantsSource = "DOM";
            console.log(
              "LinkedIn Formatter: ✅ Found applicants:",
              info.applicants,
              "using pattern:",
              pattern
            );
            break;
          }
        }
      }

      // Strategy 3: From subtitle text (specific location)
      if (!info.applicants && fullSubtitleText) {
        console.log("LinkedIn Formatter: Checking subtitle for applicants...");
        const applicantMatch = fullSubtitleText.match(
          /(\d+\+?)\s+applicants?/i
        );
        if (applicantMatch) {
          info.applicants = applicantMatch[0];
          info.applicantsSource = "DOM";
          console.log(
            "LinkedIn Formatter: ✅ Found applicants from subtitle:",
            info.applicants
          );
        }
      }

      // Strategy 4: Look for specific elements
      if (!info.applicants) {
        console.log("LinkedIn Formatter: Searching elements for applicants...");
        const allElements = document.querySelectorAll("*");
        for (const el of allElements) {
          const text = el.textContent.trim();
          // Only check leaf elements (no children) and short text
          if (
            el.children.length === 0 &&
            text.length < 100 &&
            text.match(/\d+\s+applicant/i)
          ) {
            const match = text.match(/(\d+\+?)\s+applicants?/i);
            if (match) {
              info.applicants = match[0];
              info.applicantsSource = "DOM";
              console.log(
                "LinkedIn Formatter: ✅ Found applicants in element:",
                info.applicants
              );
              break;
            }
          }
        }
      }

      // Extract posted time from subtitle text (e.g., "1 hour ago")
      if (fullSubtitleText) {
        const timeMatch = fullSubtitleText.match(
          /(\\d+\\s+(?:hour|minute|day|week|month)s?\\s+ago)/i
        );
        if (timeMatch) {
          info.postedTime = timeMatch[1];
          console.log(
            "LinkedIn Formatter: Found posted time:",
            info.postedTime
          );
        }
      }

      // Extract location from subtitle text (e.g., "Dhaka, Dhaka, Bangladesh")
      if (fullSubtitleText) {
        // Look for location pattern before " · " or at the start
        const locationMatch = fullSubtitleText.match(/^([^·]+?)(?:\\s*·|$)/);
        if (locationMatch && locationMatch[1]) {
          const locationText = locationMatch[1].trim();
          // Validate it's a location (contains comma or known location keywords)
          if (
            locationText.includes(",") ||
            locationText.match(/remote|hybrid|on-site/i)
          ) {
            info.location = locationText;
            console.log("LinkedIn Formatter: Found location:", info.location);
          }
        }
      }

      // Strategy 2: Extract job type from pills/badges (Full-time, On-site, etc.)
      const workplaceTypeSelectors = [
        ".jobs-unified-top-card__job-insight",
        ".jobs-unified-top-card__workplace-type",
        "button[aria-label*='workplace']",
        "li[class*='job-insight']",
      ];

      const jobTypes = [];
      const workplaceTypes = [];

      // Get all text from job details top area
      const topCard = document.querySelector(
        ".jobs-unified-top-card, .job-details-jobs-unified-top-card"
      );
      if (topCard) {
        const allText = topCard.textContent;

        // Extract employment type
        if (allText.match(/full-time/i)) jobTypes.push("Full-time");
        else if (allText.match(/part-time/i)) jobTypes.push("Part-time");
        else if (allText.match(/contract/i)) jobTypes.push("Contract");
        else if (allText.match(/internship/i)) jobTypes.push("Internship");
        else if (allText.match(/temporary/i)) jobTypes.push("Temporary");

        // Extract workplace type
        if (allText.match(/on-site/i)) workplaceTypes.push("On-site");
        else if (allText.match(/remote/i)) workplaceTypes.push("Remote");
        else if (allText.match(/hybrid/i)) workplaceTypes.push("Hybrid");
      }

      if (jobTypes.length > 0 || workplaceTypes.length > 0) {
        info.jobType = [...jobTypes, ...workplaceTypes].join(", ");
        console.log("LinkedIn Formatter: Found job type:", info.jobType);
      }

      // Extract views - prioritize API data
      // Strategy 1: Use intercepted API data (LIVE DATA - most reliable)
      if (this.apiData.viewCount !== undefined) {
        info.views = `${this.apiData.viewCount} views`;
        info.viewsSource = "API (Live)";
        console.log("LinkedIn Formatter: Found views from API:", info.views);
      } else if (this.apiData.numViews !== undefined) {
        info.views = `${this.apiData.numViews} views`;
        info.viewsSource = "API (Live)";
        console.log("LinkedIn Formatter: Found numViews from API:", info.views);
      }

      // Strategy 2: Extract from page text (fallback)
      if (!info.views) {
        const pageText = document.body.textContent;

        // Pattern 1: "X LinkedIn members viewed"
        let viewsMatch = pageText.match(/(\\d+[+]?)\\s+LinkedIn\\s+members?/i);
        if (viewsMatch) {
          info.views = viewsMatch[0];
          info.viewsSource = "DOM";
          console.log(
            "LinkedIn Formatter: Found views (LinkedIn members):",
            info.views
          );
        }

        // Pattern 2: Look for views in insights area
        if (!info.views) {
          viewsMatch = pageText.match(/(\\d+[+]?)\\s+views?/i);
          if (viewsMatch) {
            info.views = viewsMatch[0];
            info.viewsSource = "DOM";
            console.log("LinkedIn Formatter: Found views:", info.views);
          }
        }

        // Pattern 3: Search in specific view-related elements
        if (!info.views) {
          const viewElements = document.querySelectorAll(
            '[class*="insight"], [class*="view"], [class*="engagement"]'
          );
          for (const el of viewElements) {
            const text = el.textContent.trim();
            if (text.match(/\\d+.*(?:view|member)/i)) {
              const match = text.match(
                /(\\d+[+]?)\\s*(?:LinkedIn\\s+)?(?:members?|views?)/i
              );
              if (match) {
                info.views = match[0];
                info.viewsSource = "DOM";
                console.log(
                  "LinkedIn Formatter: Found views (element search):",
                  info.views
                );
                break;
              }
            }
          }
        }
      }

      // Extract job description text for detailed analysis
      let jobDescriptionText = "";
      const jdSelectors = [
        ".jobs-description__content",
        ".jobs-description",
        "[class*='job-description']",
        ".jobs-box__html-content",
        "[id*='job-details']",
        ".jobs-details__main-content",
        "article[class*='jobs']",
        ".jobs-box--description",
      ];

      // First, try to click "Show more" if it exists to get full description
      const showMoreButtons = document.querySelectorAll("button");
      for (const btn of showMoreButtons) {
        const btnText = btn.textContent.trim().toLowerCase();
        if (btnText.includes("show more") || btnText === "see more") {
          console.log("LinkedIn Formatter: Clicking 'Show more' button");
          try {
            btn.click();
            // Wait a moment for content to expand
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (e) {
            console.log("LinkedIn Formatter: Could not click show more:", e);
          }
          break;
        }
      }

      for (const selector of jdSelectors) {
        const jdElement = document.querySelector(selector);
        if (jdElement && jdElement.textContent.length > 100) {
          jobDescriptionText = jdElement.textContent;
          console.log(
            "LinkedIn Formatter: Found job description, length:",
            jobDescriptionText.length
          );
          break;
        }
      }

      // If no JD found with selectors, try broader search
      if (!jobDescriptionText) {
        const showMoreButtons = Array.from(
          document.querySelectorAll("button, a")
        );
        for (const btn of showMoreButtons) {
          if (
            btn.textContent.includes("Show more") ||
            btn.textContent.includes("See more")
          ) {
            const container = btn.closest(
              "[class*='description'], [class*='details'], [class*='content']"
            );
            if (container) {
              jobDescriptionText = container.textContent;
              console.log(
                "LinkedIn Formatter: Found JD via show more button, length:",
                jobDescriptionText.length
              );
              break;
            }
          }
        }
      }

      // Last resort: get any large text block in the details area
      if (!jobDescriptionText || jobDescriptionText.length < 200) {
        const detailsContainer = document.querySelector(
          ".jobs-details, .job-details, [class*='job-view']"
        );
        if (detailsContainer) {
          const textBlocks = detailsContainer.querySelectorAll(
            "div, article, section"
          );
          for (const block of textBlocks) {
            const text = block.textContent.trim();
            if (text.length > 500 && text.length > jobDescriptionText.length) {
              jobDescriptionText = text;
              console.log(
                "LinkedIn Formatter: Found JD via large text block, length:",
                jobDescriptionText.length
              );
            }
          }
        }
      }

      // Extract experience level from badges/pills first (most reliable)
      const experienceKeywords = [
        "Entry level",
        "Mid-Senior level",
        "Associate",
        "Executive",
        "Director",
        "Internship",
        "Not Applicable",
      ];

      for (const keyword of experienceKeywords) {
        if (pageText.includes(keyword)) {
          info.experience = keyword;
          console.log("LinkedIn Formatter: Found experience:", info.experience);
          break;
        }
      }

      // Extract years of experience from job description
      if (jobDescriptionText) {
        // Pattern 1: "X+ years of experience"
        const yearsPattern1 = jobDescriptionText.match(
          /(\\d+)\\+?\\s*(?:-|to)?\\s*(\\d+)?\\s*years?\\s+of\\s+(?:experience|work)/i
        );
        // Pattern 2: "X-Y years experience"
        const yearsPattern2 = jobDescriptionText.match(
          /(\\d+)\\s*(?:-|to)\\s*(\\d+)\\s*years?\\s+experience/i
        );
        // Pattern 3: "Minimum X years"
        const yearsPattern3 = jobDescriptionText.match(
          /(?:minimum|at least|minimum of)\\s+(\\d+)\\+?\\s*years?/i
        );
        // Pattern 4: "X years in" or "X years of"
        const yearsPattern4 = jobDescriptionText.match(
          /(\\d+)\\+?\\s*years?\\s+(?:in|of|with)/i
        );

        let yearsRequired = null;
        if (yearsPattern1) {
          yearsRequired = yearsPattern2
            ? `${yearsPattern1[1]}-${yearsPattern1[2]} years`
            : `${yearsPattern1[1]}+ years`;
        } else if (yearsPattern2) {
          yearsRequired = `${yearsPattern2[1]}-${yearsPattern2[2]} years`;
        } else if (yearsPattern3) {
          yearsRequired = `${yearsPattern3[1]}+ years`;
        } else if (yearsPattern4) {
          yearsRequired = `${yearsPattern4[1]}+ years`;
        }

        if (yearsRequired) {
          // Add or append to experience field
          if (info.experience) {
            info.experience = `${info.experience} (${yearsRequired} required)`;
          } else {
            info.experience = `${yearsRequired} required`;
          }
          console.log(
            "LinkedIn Formatter: Extracted years from JD:",
            yearsRequired
          );
        }
      }

      // Extract company size
      const companySizeMatch = pageText.match(
        /(\\d+[\\d,]*[-–]\\d+[\\d,]*\\s+employees?)/i
      );
      if (companySizeMatch) {
        info.companySize = companySizeMatch[1];
        console.log(
          "LinkedIn Formatter: Found company size:",
          info.companySize
        );
      }

      // Extract salary if available
      const salaryMatch = pageText.match(
        /(?:BDT|\$|USD|EUR|GBP)\s*[\d,]+(?:[-][\d,]+)?(?:\s*(?:per|\/)\s*(?:year|month|hour))?/i
      );
      if (salaryMatch) {
        info.salary = salaryMatch[0];
        console.log("LinkedIn Formatter: Found salary:", info.salary);
      }

      // Final fallback: If we still have nothing, add placeholder to show box is working
      if (!info.applicants) {
        console.log(
          "LinkedIn Formatter: ⚠️ No applicants data found - checking if this is a job page"
        );
        // Verify we're actually on a job page
        if (document.querySelector(".jobs-unified-top-card, .job-details")) {
          info.applicants = "Not available";
          info.applicantsSource = "N/A";
        }
      }

      console.log("LinkedIn Formatter: ✅ Final extracted info:", info);
      console.log(
        "LinkedIn Formatter: Total fields extracted:",
        Object.keys(info).length
      );
    } catch (error) {
      console.error("LinkedIn Formatter: ❌ Error extracting job info:", error);
    }

    return info;
  }

  /**
   * Create the job stats box HTML
   */
  createJobStatsBox(jobInfo) {
    console.log("LinkedIn Formatter: Creating stats box with data:", jobInfo);
    console.log("LinkedIn Formatter: API data available:", this.apiData);

    const box = document.createElement("div");
    box.className = "lf-job-stats-box";

    // Build stats HTML
    let statsHTML = '<div class="lf-stats-header">📊 Quick Job Overview</div>';
    statsHTML += '<div class="lf-stats-grid">';

    // Add each stat if available
    if (jobInfo.experience) {
      statsHTML += this.createStatItem(
        "💼 Experience",
        jobInfo.experience,
        "#2563eb"
      );
    }

    if (jobInfo.jobType) {
      statsHTML += this.createStatItem(
        "⏰ Job Type",
        jobInfo.jobType,
        "#059669"
      );
    }

    if (jobInfo.applicants) {
      const isLive = jobInfo.applicantsSource === "API (Live)";
      const label = isLive ? "👥 Applicants 🔴 LIVE" : "👥 Applicants";
      statsHTML += this.createStatItem(
        label,
        jobInfo.applicants,
        "#dc2626",
        isLive
      );
    }

    if (jobInfo.views) {
      const isLive = jobInfo.viewsSource === "API (Live)";
      const label = isLive ? "👀 Views 🔴 LIVE" : "👀 Views";
      statsHTML += this.createStatItem(label, jobInfo.views, "#7c3aed", isLive);
    }

    if (jobInfo.location) {
      statsHTML += this.createStatItem(
        "📍 Location",
        jobInfo.location,
        "#ea580c"
      );
    }

    if (jobInfo.postedTime) {
      statsHTML += this.createStatItem(
        "🕐 Posted",
        jobInfo.postedTime,
        "#64748b"
      );
    }

    if (jobInfo.salary) {
      statsHTML += this.createStatItem("💰 Salary", jobInfo.salary, "#059669");
    }

    if (jobInfo.companySize) {
      statsHTML += this.createStatItem(
        "🏢 Company Size",
        jobInfo.companySize,
        "#2563eb"
      );
    }

    statsHTML += "</div>";

    box.innerHTML = statsHTML;

    // Apply styles
    this.applyJobStatsStyles(box);

    return box;
  }

  /**
   * Create individual stat item
   */
  createStatItem(label, value, color, isLive = false) {
    const pulseAnimation = isLive ? "animation: pulse 2s infinite;" : "";
    const liveStyle = isLive
      ? "font-weight: 800; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);"
      : "";

    return `
      <div class=\"lf-stat-item\" style=\"${liveStyle}\">
        <div class=\"lf-stat-label\" style=\"color: ${color}; ${pulseAnimation}\">${label}</div>
        <div class=\"lf-stat-value\" style=\"${
          isLive ? "font-weight: 800; color: #b91c1c;" : ""
        }\">${value}</div>
      </div>
    `;
  }

  /**
   * Create loading box while AI analysis runs
   */
  createLoadingBox() {
    this.ensureJobStatsStyles();
    const box = document.createElement("div");
    box.className = "lf-job-stats-box";
    const casperIcon = this.getCasperIconHtml(22);
    box.innerHTML = `
      <div class="lf-stats-header">${casperIcon}<span>AI-Powered ATS Analysis</span></div>
      <div style="text-align: center; padding: 30px 20px;">
        <div class="lf-spinner"></div>
        <div style="margin-top: 16px; font-size: 14px; color: #64748b;">
          Analyzing job compatibility with AI...
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
          This may take a few seconds
        </div>
      </div>
    `;

    box.style.cssText = `
      background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
      border: 2px solid #0ea5e9;
      border-radius: 14px;
      padding: 18px;
      margin: 50px 0 16px;
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.15);
      animation: slideIn 0.3s ease-out;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
      display: flow-root;
    `;

    // Add spinner CSS if not exists
    if (!document.querySelector("#lf-spinner-styles")) {
      const style = document.createElement("style");
      style.id = "lf-spinner-styles";
      style.textContent = `
        .lf-spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e0f2fe;
          border-top-color: #0ea5e9;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    return box;
  }

  /**
   * Create basic stats box when AI is not configured
   */
  createBasicStatsBox(jobData) {
    const box = document.createElement("div");
    box.className = "lf-job-stats-box";

    let statsHTML = '<div class="lf-stats-header">📊 Quick Job Overview</div>';
    statsHTML += '<div class="lf-stats-grid">';

    if (jobData.jobType) {
      statsHTML += this.createStatItem(
        "⏰ Job Type",
        jobData.jobType,
        "#059669"
      );
    }

    if (jobData.experience) {
      statsHTML += this.createStatItem(
        "💼 Experience",
        jobData.experience,
        "#2563eb"
      );
    }

    if (jobData.location) {
      statsHTML += this.createStatItem(
        "📍 Location",
        jobData.location,
        "#ea580c"
      );
    }

    statsHTML += "</div>";

    // Add AI configuration notice
    const casperIcon = this.getCasperIconHtml(18);
    statsHTML += `
      <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 8px; border: 1px solid #fbbf24;">
        <div style="font-size: 13px; color: #92400e; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
          ${casperIcon} <span>Want AI-Powered ATS Analysis?</span>
        </div>
        <div style="font-size: 12px; color: #78350f; line-height: 1.5;">
          Configure your API key in settings to get detailed compatibility scores, skill matching, and personalized insights!
        </div>
        <button class="lf-settings-btn" style="margin-top: 8px; padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          ⚙️ Open Settings
        </button>
      </div>
    `;

    box.innerHTML = statsHTML;
    this.applyJobStatsStyles(box);

    // Add click handler for settings button
    const settingsBtn = box.querySelector(".lf-settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        try {
          if (chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ action: "openOptions" });
          } else {
            // Extension context invalidated - show user-friendly message
            alert(
              "⚠️ Extension was reloaded. Please refresh this page to continue."
            );
          }
        } catch (error) {
          if (error?.message?.includes("Extension context invalidated")) {
            alert(
              "⚠️ Extension was reloaded. Please refresh this page to continue."
            );
          } else {
            console.error("Error opening settings:", error);
          }
        }
      });
    }

    return box;
  }

  /**
   * Create error box when AI analysis fails
   */
  createErrorBox(errorMessage) {
    const box = document.createElement("div");
    box.className = "lf-job-stats-box";

    const statsHTML = `
      <div class="lf-stats-header" style="background: #fef2f2; color: #991b1b;">⚠️ AI Analysis Error</div>
      <div style="padding: 16px;">
        <div style="font-size: 14px; color: #b91c1c; margin-bottom: 12px; font-weight: 600;">
          Unable to analyze this job posting
        </div>
        <div style="font-size: 13px; color: #7f1d1d; line-height: 1.5; margin-bottom: 12px;">
          ${errorMessage || "An unexpected error occurred"}
        </div>
        <div style="font-size: 12px; color: #991b1b; background: #fee2e2; padding: 10px; border-radius: 6px; line-height: 1.5;">
          <strong>Common fixes:</strong><br>
          • Check your API key in Settings<br>
          • Verify your API key hasn't exceeded quota<br>
          • Try reloading the page<br>
          • Check your internet connection
        </div>
        <button class="lf-settings-btn" style="margin-top: 12px; padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
          ⚙️ Open Settings
        </button>
      </div>
    `;

    box.innerHTML = statsHTML;

    box.style.cssText = `
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border: 2px solid #ef4444;
      border-radius: 12px;
      padding: 0;
      margin: 50px 0 16px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);
      animation: slideIn 0.3s ease-out;
      width: 100%;
      box-sizing: border-box;
      position: relative;
      z-index: 1;
    `;

    // Add click handler for settings button
    const settingsBtn = box.querySelector(".lf-settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => {
        try {
          if (chrome.runtime && chrome.runtime.id) {
            chrome.runtime.sendMessage({ action: "openOptions" });
          } else {
            // Extension context invalidated - show user-friendly message
            alert(
              "⚠️ Extension was reloaded. Please refresh this page to continue."
            );
          }
        } catch (error) {
          if (error?.message?.includes("Extension context invalidated")) {
            alert(
              "⚠️ Extension was reloaded. Please refresh this page to continue."
            );
          } else {
            console.error("Error opening settings:", error);
          }
        }
      });
    }

    return box;
  }

  /**
   * Create AI-powered stats box with ATS analysis
   */
  createAIStatsBox(jobData, atsAnalysis, isCached = false) {
    const box = document.createElement("div");
    box.className = "lf-job-stats-box";

    const score = atsAnalysis.overallScore;
    const scoreColor =
      score >= 75 ? "#059669" : score >= 50 ? "#f59e0b" : "#dc2626";
    const scoreEmoji = score >= 75 ? "🎉" : score >= 50 ? "💪" : "📈";
    const scoreBgGradient =
      score >= 75
        ? "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
        : score >= 50
        ? "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)"
        : "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)";

    // Add cache badge if result is cached
    const cacheBadge = isCached
      ? '<div style="display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: 8px; border: 1px solid #60a5fa;"><span style="font-size: 13px;">💾</span> Cached Result <span style="cursor: pointer; margin-left: 4px; font-size: 10px;" title="Click to refresh with new analysis">🔄</span></div>'
      : "";

    let statsHTML = `<div class="lf-stats-header">${this.getCasperIconHtml(22)}<span>AI-Powered ATS Analysis</span>${cacheBadge}</div>`;

    // Job Requirements Section (NEW)
    if (jobData.requirements) {
      statsHTML += `
        <div class="lf-ats-section" style="margin-top: 8px; margin-bottom: 18px; padding: 16px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; border: 2px solid #60a5fa; box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);">
          <div style="font-size: 15px; color: #1e40af; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 18px;">📋</span> What This Job Requires
          </div>
          
          ${
            jobData.requirements.summary
              ? `
            <div style="font-size: 13px; color: #1e3a8a; margin-bottom: 14px; padding: 10px; background: white; border-radius: 8px; font-weight: 500;">
              ${jobData.requirements.summary}
            </div>
          `
              : ""
          }
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            ${
              jobData.requirements.mustHave
                ? `
              <div style="padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #dc2626;">
                <div style="font-size: 12px; font-weight: 700; color: #dc2626; margin-bottom: 8px; text-transform: uppercase;">
                  ⚠️ Must Have
                </div>
                ${
                  jobData.requirements.mustHave.skills &&
                  jobData.requirements.mustHave.skills.length > 0
                    ? `
                  <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 4px;">Skills:</div>
                  <div style="font-size: 12px; color: #4b5563; margin-bottom: 8px;">
                    ${jobData.requirements.mustHave.skills
                      .map(
                        (skill) =>
                          `<span style="display: inline-block; background: #fee2e2; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 11px;">${skill}</span>`
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }
                ${
                  jobData.requirements.mustHave.experience
                    ? `
                  <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 2px;">Experience:</div>
                  <div style="font-size: 12px; color: #4b5563; margin-bottom: 6px;">${jobData.requirements.mustHave.experience}</div>
                `
                    : ""
                }
                ${
                  jobData.requirements.mustHave.education
                    ? `
                  <div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 2px;">Education:</div>
                  <div style="font-size: 12px; color: #4b5563;">${jobData.requirements.mustHave.education}</div>
                `
                    : ""
                }
              </div>
            `
                : ""
            }
            
            ${
              jobData.requirements.niceToHave
                ? `
              <div style="padding: 12px; background: white; border-radius: 8px; border-left: 4px solid #10b981;">
                <div style="font-size: 12px; font-weight: 700; color: #10b981; margin-bottom: 8px; text-transform: uppercase;">
                  ✨ Nice to Have
                </div>
                ${
                  jobData.requirements.niceToHave.skills &&
                  jobData.requirements.niceToHave.skills.length > 0
                    ? `
                  <div style="font-size: 12px; color: #4b5563;">
                    ${jobData.requirements.niceToHave.skills
                      .map(
                        (skill) =>
                          `<span style="display: inline-block; background: #d1fae5; padding: 2px 8px; border-radius: 4px; margin: 2px; font-size: 11px;">${skill}</span>`
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }
              </div>
            `
                : ""
            }
          </div>
          
          ${
            jobData.requirements.responsibilities &&
            jobData.requirements.responsibilities.length > 0
              ? `
            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 8px;">
              <div style="font-size: 11px; font-weight: 700; color: #374151; margin-bottom: 6px; text-transform: uppercase;">
                📌 Key Responsibilities
              </div>
              <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #4b5563; line-height: 1.6;">
                ${jobData.requirements.responsibilities
                  .slice(0, 4)
                  .map((r) => `<li style="margin-bottom: 3px;">${r}</li>`)
                  .join("")}
              </ul>
            </div>
          `
              : ""
          }
        </div>
      `;
    }

    // Overall Score Section with enhanced styling
    statsHTML += `
      <div style="text-align: center; padding: 24px 20px; background: ${scoreBgGradient}; border-radius: 12px; margin-top: 8px; margin-bottom: 18px; box-shadow: 0 2px 8px ${scoreColor}25; border: 2px solid ${scoreColor}40;">
        <div style="font-size: 56px; font-weight: 800; color: ${scoreColor}; line-height: 1; text-shadow: 0 2px 4px ${scoreColor}20;">
          ${score}<span style="font-size: 28px; font-weight: 700;">%</span>
        </div>
        <div style="font-size: 15px; font-weight: 700; color: #374151; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span style="font-size: 18px;">${scoreEmoji}</span> Compatibility Score
        </div>
      </div>
    `;

    // Breakdown Section with enhanced grid
    if (atsAnalysis.breakdown) {
      statsHTML +=
        '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px;">';

      const breakdown = atsAnalysis.breakdown;

      if (breakdown.skillsMatch) {
        statsHTML += this.createEnhancedStatItem(
          "💡",
          "Skills Match",
          `${breakdown.skillsMatch.score}%`,
          this.getScoreColor(breakdown.skillsMatch.score)
        );
      }

      if (breakdown.experienceLevel) {
        statsHTML += this.createEnhancedStatItem(
          "💼",
          "Experience",
          `${breakdown.experienceLevel.score}%`,
          this.getScoreColor(breakdown.experienceLevel.score)
        );
      }

      if (breakdown.education) {
        statsHTML += this.createEnhancedStatItem(
          "🎓",
          "Education",
          `${breakdown.education.score}%`,
          this.getScoreColor(breakdown.education.score)
        );
      }

      if (breakdown.keywords) {
        statsHTML += this.createEnhancedStatItem(
          "🔑",
          "Keywords",
          `${breakdown.keywords.score}%`,
          this.getScoreColor(breakdown.keywords.score)
        );
      }

      if (breakdown.responsibilities) {
        statsHTML += this.createEnhancedStatItem(
          "📋",
          "Responsibilities",
          `${breakdown.responsibilities.score}%`,
          this.getScoreColor(breakdown.responsibilities.score)
        );
      }

      statsHTML += "</div>";
    }

    // Strengths Section with better styling
    if (atsAnalysis.strengths && atsAnalysis.strengths.length > 0) {
      statsHTML += `
        <div style="margin-bottom: 14px; padding: 14px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 10px; border: 2px solid #86efac; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.1);">
          <div style="font-size: 14px; color: #166534; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">✅</span> Your Strengths
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #15803d; line-height: 1.7;">
            ${atsAnalysis.strengths
              .map((s) => `<li style="margin-bottom: 4px;">${s}</li>`)
              .join("")}
          </ul>
        </div>
      `;
    }

    // Improvements Section with better styling
    if (atsAnalysis.improvements && atsAnalysis.improvements.length > 0) {
      statsHTML += `
        <div style="margin-bottom: 14px; padding: 14px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 10px; border: 2px solid #fbbf24; box-shadow: 0 2px 6px rgba(245, 158, 11, 0.1);">
          <div style="font-size: 14px; color: #92400e; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 16px;">💡</span> Areas to Improve
          </div>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #78350f; line-height: 1.7;">
            ${atsAnalysis.improvements
              .map((i) => `<li style="margin-bottom: 4px;">${i}</li>`)
              .join("")}
          </ul>
        </div>
      `;
    }

    // Summary Section with better styling
    if (atsAnalysis.summary) {
      statsHTML += `
        <div style="padding: 14px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 10px; border: 2px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);">
          <div style="font-size: 13px; color: #475569; line-height: 1.7; font-weight: 500;">
            💬 ${atsAnalysis.summary}
          </div>
        </div>
      `;
    }

    box.innerHTML = statsHTML;
    this.applyJobStatsStyles(box);

    // Add click handler for refresh icon in cache badge
    if (isCached) {
      const cacheBadge = box.querySelector(".lf-stats-header > div");
      if (cacheBadge) {
        cacheBadge.style.cursor = "pointer";
        cacheBadge.addEventListener("click", async () => {
          if (
            confirm(
              "Refresh this analysis with latest data? This will use API credits."
            )
          ) {
            // Clear the specific cache entry
            const url = window.location.href;
            const urlParams = new URLSearchParams(url.split("?")[1] || "");
            const jobId =
              urlParams.get("currentJobId") ||
              url.match(/\/jobs\/view\/(\d+)/)?.[1];

            if (jobId) {
              const cacheManager = new CacheManager();
              const cache = await cacheManager.getAllCache();

              // Remove all entries for this job (all profile hashes)
              Object.keys(cache).forEach((key) => {
                if (key.startsWith(jobId + "_")) {
                  delete cache[key];
                }
              });

              await chrome.storage.local.set({ ats_analysis_cache: cache });
              console.log("Cache cleared for job", jobId);

              // Remove the stats box to trigger re-analysis
              box.remove();
              this.isDisplayingStats = false;
            }
          }
        });
      }
    }

    return box;
  }

  /**
   * Create enhanced stat item with better styling
   */
  createEnhancedStatItem(emoji, label, value, color) {
    return `
      <div style="background: white; border: 2px solid ${color}30; border-radius: 10px; padding: 12px; transition: all 0.2s ease; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          <span style="font-size: 14px;">${emoji}</span>
          <span>${label}</span>
        </div>
        <div style="font-size: 24px; font-weight: 800; color: ${color}; line-height: 1; text-shadow: 0 1px 2px ${color}20;">
          ${value}
        </div>
      </div>
    `;
  }

  /**
   * Get color based on score
   */
  getScoreColor(score) {
    if (score >= 75) return "#059669";
    if (score >= 50) return "#f59e0b";
    return "#dc2626";
  }
}

// Initialize the extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    new LinkedInFormatter();
  });
} else {
  new LinkedInFormatter();
}

// Helper: Check if extension context is valid
function isExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// Message listener for profile extraction requests from options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Check extension context validity first
  if (!isExtensionContextValid()) {
    console.log("Extension context invalidated - please refresh the page");
    sendResponse({
      success: false,
      error: "Extension was reloaded. Please refresh this page.",
    });
    return false;
  }

  if (request.action === "extractAndSaveProfile") {
    (async () => {
      try {
        console.log("Content script: Received profile extraction request");
        const profileExtractor = new ProfileExtractor();

        // Force fresh extraction
        profileExtractor.clearCache();

        // Extract profile
        const profile = await profileExtractor.extractProfile();

        // Save to storage (with context check)
        if (isExtensionContextValid()) {
          await chrome.storage.local.set({
            linkedin_user_profile: profile,
            profile_updated_at: Date.now(),
          });
          console.log("Content script: Profile extracted and saved", profile);
          sendResponse({ success: true, profile: profile });
        } else {
          sendResponse({ success: false, error: "Extension context lost" });
        }
      } catch (error) {
        console.error("Content script: Profile extraction failed", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true; // Keep message channel open for async response
  }

  // Handle Casper open request from popup
  if (request.action === "openCasper") {
    (async () => {
      try {
        // Check if Casper is available
        if (!window.casperInstance) {
          console.warn("Casper: Not initialized");

          // Try to initialize if CasperManager exists
          if (typeof CasperManager !== "undefined") {
            console.log("Casper: Attempting to initialize...");
            window.casperInstance = new CasperManager();
            await window.casperInstance.init();
          }
        }

        if (window.casperInstance && window.casperInstance.chatUI) {
          window.casperInstance.chatUI.open();
          console.log("Casper: Chatbox opened");
          sendResponse({ success: true });
        } else {
          console.warn("Casper: Not available - may be disabled in settings");
          sendResponse({
            success: false,
            error:
              "Casper is not enabled. Please enable it in extension settings.",
          });
        }
      } catch (error) {
        console.error("Casper: Error opening chat:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep message channel open for async
  }

  // Handle toggle Casper post buttons visibility
  if (request.action === "toggleCasperPostButtons") {
    const show = request.show;
    const styleId = "casper-post-buttons-style";

    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // If hiding buttons, inject CSS to hide them
    if (!show) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .feed-shared-social-action-bar__action-button:has(.casper-analyze-icon) {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
      console.log("Casper: Post buttons hidden via CSS");
    } else {
      console.log("Casper: Post buttons visible");
    }

    sendResponse({ success: true });
    return true;
  }

  // Handle job count extraction for notifications
  if (request.action === "extractJobCount") {
    (async () => {
      try {
        const jobCount = extractJobCountFromPage();
        sendResponse({ count: jobCount });
      } catch (error) {
        console.error("Error extracting job count:", error);
        sendResponse({ count: 0 });
      }
    })();
    return true;
  }
});

/**
 * Extract job count from LinkedIn job search page
 * Returns object with count and metadata for better tracking
 */
function extractJobCountFromPage() {
  try {
    console.log("[Job Count] Starting extraction from page...");

    // Method 1: Try the results header (MOST RELIABLE - shows total count)
    const resultsSelectors = [
      ".jobs-search-results-list__subtitle",
      ".search-results-container__subtitle",
      ".jobs-search-results-list__text",
      "[class*='results-context-header__job-count']",
    ];

    for (const selector of resultsSelectors) {
      const resultsText = document.querySelector(selector);
      if (resultsText) {
        const text = resultsText.textContent;
        const match = text.match(/([\d,]+)\s+results?/i);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ""));
          console.log(
            `[Job Count] ✅ Method 1 SUCCESS: ${count} total results`
          );
          return count;
        }
      }
    }

    // Method 2: Try aria-label on results list
    const resultsList = document.querySelector(
      '[aria-label*="Search results"], [aria-label*="search results"]'
    );
    if (resultsList) {
      const label = resultsList.getAttribute("aria-label");
      const match = label.match(/([\d,]+)\s+search results?/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ""));
        console.log(
          `[Job Count] ✅ Method 2 SUCCESS: ${count} from aria-label`
        );
        return count;
      }
    }

    // Method 3: Try JSON-LD structured data
    const scripts = document.querySelectorAll(
      'script[type="application/ld+json"]'
    );
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);
        if (data.numberOfItems || data.totalResults) {
          const count = data.numberOfItems || data.totalResults;
          console.log(`[Job Count] ✅ Method 3 SUCCESS: ${count} from JSON-LD`);
          return count;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    // Method 4: Try to find pagination or "Showing X of Y" text
    const paginationText = document.body.innerText;
    const showingMatch = paginationText.match(
      /Showing\s+[\d,]+\s+of\s+([\d,]+)/i
    );
    if (showingMatch) {
      const count = parseInt(showingMatch[1].replace(/,/g, ""));
      console.log(`[Job Count] ✅ Method 4 SUCCESS: ${count} from pagination`);
      return count;
    }

    // Method 5: Count visible job cards (FALLBACK ONLY - not reliable for total)
    // This should ONLY be used if we absolutely can't find the total count
    const jobCards = document.querySelectorAll(
      ".job-card-container, .jobs-search-results__list-item, [data-job-id]"
    );
    if (jobCards.length > 0) {
      console.warn(
        `[Job Count] ⚠️ Method 5 FALLBACK: Only ${jobCards.length} visible cards found (not total count)`
      );
      console.warn(
        "[Job Count] ⚠️ This is unreliable - LinkedIn may not have loaded the total count yet"
      );
      // Return 0 instead of visible count to avoid false baselines
      return 0;
    }

    console.error(
      "[Job Count] ❌ FAILED: Could not extract job count from page using any method"
    );
    console.log(
      "[Job Count] Page may not be fully loaded or LinkedIn changed their structure"
    );
    return 0;
  } catch (error) {
    console.error("[Job Count] ❌ Error in extractJobCountFromPage:", error);
    return 0;
  }
}
