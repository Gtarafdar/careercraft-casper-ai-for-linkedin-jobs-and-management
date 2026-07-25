/**
 * Casper Main Controller
 * Coordinates all Casper components and manages initialization
 */


class CasperManager {
  constructor() {
    this.isInitialized = false;
    this.isEnabled = false;
    this.api = null;
    this.history = null;
    this.chatUI = null;
    this.postInjector = null;
  }

  /**
   * Initialize Casper system
   */
  async init() {
    if (this.isInitialized) {
      console.log("Casper Manager: Already initialized");
      return;
    }

    console.log("Casper Manager: Starting initialization...");

    try {
      // Check if Casper is enabled in settings
      const enabled = await this.checkEnabled();
      if (!enabled) {
        console.log("Casper Manager: Disabled in settings");
        return;
      }

      this.isEnabled = true;

      // Wait for required dependencies
      await this.waitForDependencies();

      // Initialize components in order
      await this.initializeComponents();

      this.isInitialized = true;
      console.log("Casper Manager: Initialization complete ✓");
    } catch (error) {
      console.error("Casper Manager: Initialization failed:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Casper is enabled in settings
   * @returns {Promise<boolean>}
   */
  async checkEnabled() {
    try {
      const result = await chrome.storage.local.get(["casper_enabled"]);
      // Default to false if not set (opt-in feature)
      const enabled = result.casper_enabled === true;
      return enabled;
    } catch (error) {
      console.error("Casper Manager: Error checking enabled status:", error);
      return false;
    }
  }

  /**
   * Wait for required dependencies to load
   * @returns {Promise<void>}
   */
  async waitForDependencies() {
    const maxWait = 5000; // 5 seconds max
    const startTime = Date.now();
    const checkInterval = 50; // Check every 50ms

    while (Date.now() - startTime < maxWait) {
      const deps = {
        CasperAvatar: typeof window.CasperAvatar !== "undefined",
        CasperPersonality: typeof window.CasperPersonality !== "undefined",
        CasperAPI: typeof window.CasperAPI !== "undefined",
        CasperHistory: typeof window.CasperHistory !== "undefined",
        CasperChatUI: typeof window.CasperChatUI !== "undefined",
        CasperPostInjector: typeof window.CasperPostInjector !== "undefined",
        AIService: typeof window.AIService !== "undefined",
      };

      const allLoaded = Object.values(deps).every((loaded) => loaded);

      if (allLoaded) {
        console.log("Casper Manager: All dependencies loaded ✓");
        return;
      }

      // Log missing dependencies
      const missing = Object.keys(deps).filter((key) => !deps[key]);
      if ((Date.now() - startTime) % 1000 < checkInterval) {
        console.log("Casper Manager: Waiting for:", missing.join(", "));
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    // Log final status with detailed info
    const finalDeps = {
      CasperAvatar: typeof window.CasperAvatar,
      CasperPersonality: typeof window.CasperPersonality,
      CasperAPI: typeof window.CasperAPI,
      CasperHistory: typeof window.CasperHistory,
      CasperChatUI: typeof window.CasperChatUI,
      CasperPostInjector: typeof window.CasperPostInjector,
      AIService: typeof window.AIService,
    };
    console.error("Casper Manager: Dependency types:");
    Object.entries(finalDeps).forEach(([name, type]) => {
      console.error(`  - ${name}: ${type}`);
    });

    // Check if AIService exists at all
    if (typeof window.AIService === "undefined") {
      console.error(
        "Casper Manager: AIService not found - this is likely the issue"
      );
      console.error("Casper Manager: Proceeding without AIService for now...");
      // Don't throw error, just warn and continue
      return;
    }

    throw new Error(
      "Casper dependencies not loaded in time. Check console for details."
    );
  }

  /**
   * Initialize all Casper components
   * @returns {Promise<void>}
   */
  async initializeComponents() {
    console.log("Casper Manager: Initializing components...");

    // 1. Initialize API wrapper
    this.api = new window.CasperAPI();
    await this.api.initialize();
    console.log("Casper Manager: API initialized");

    // 2. Initialize history manager
    this.history = new window.CasperHistory();
    console.log("Casper Manager: History initialized");

    // 3. Initialize chat UI
    this.chatUI = new window.CasperChatUI(this.api, this.history);
    this.chatUI.init();
    console.log("Casper Manager: Chat UI initialized");

    // 3.5 Load and apply saved theme
    await this.loadAndApplyTheme();

    // 4. Initialize post injector (lazy loading)
    this.postInjector = new window.CasperPostInjector(this.chatUI);

    // Wait for LinkedIn feed to load
    await this.waitForLinkedInFeed();

    this.postInjector.init();
    console.log("Casper Manager: Post injector initialized");

    // Re-scan once feed settles so late-mounted posts get icons without IO delay
    requestAnimationFrame(() => {
      this.postInjector?.injectVisiblePosts?.();
    });

    // 5. Setup settings listener
    this.setupSettingsListener();
  }

  /**
   * Wait for LinkedIn page to be ready
   * @returns {Promise<void>}
   */
  async waitForLinkedInFeed() {
    const maxWait = 10000; // 10 seconds max
    const startTime = Date.now();

    // Check what type of LinkedIn page we're on
    const currentPath = window.location.pathname;
    const isFeedPage = currentPath === "/feed/" || currentPath === "/";
    const isJobsPage = currentPath.includes("/jobs/");
    const isProfilePage = currentPath.includes("/in/");
    const isMessagingPage = currentPath.includes("/messaging/");
    const isNetworkPage = currentPath.includes("/mynetwork/");

    // For non-feed pages, just wait for main container (Casper chat still works)
    if (!isFeedPage) {
      while (Date.now() - startTime < maxWait) {
        const mainContainer =
          document.querySelector("main") ||
          document.querySelector(".scaffold-layout");
        if (mainContainer) {
          console.log(
            "Casper Manager: LinkedIn page ready (non-feed page, chat available)"
          );
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      // Non-feed pages don't need posts, just proceed
      console.log(
        "Casper Manager: Ready (chat available, post analysis disabled on this page)"
      );
      return;
    }

    // For feed pages, wait for actual feed content
    while (Date.now() - startTime < maxWait) {
      const feedExists =
        document.querySelector('[data-testid="mainFeed"]') ||
        document.querySelector("main.scaffold-layout__main") ||
        document.querySelector(".core-rail") ||
        document.querySelector('[role="listitem"][componentkey*="FeedType"]') ||
        document.querySelector('[data-id^="urn:li:activity"]');

      if (feedExists) {
        console.log(
          "Casper Manager: LinkedIn feed detected (post analysis enabled)"
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Casper Manager: Feed loading slowly, proceeding anyway");
  }

  /**
   * Setup listener for settings changes
   */
  setupSettingsListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      // Handle Casper enable/disable
      if (changes.casper_enabled) {
        const newValue = changes.casper_enabled.newValue;

        if (newValue === true && !this.isEnabled) {
          this.enable();
        } else if (newValue === false && this.isEnabled) {
          this.disable();
        }
      }

      // Handle theme changes
      if (changes.casper_theme) {
        this.applyTheme(changes.casper_theme.newValue);
      }
    });

    console.log("Casper Manager: Settings listener active");
  }

  /**
   * Enable Casper
   */
  enable() {
    if (!this.isInitialized) {
      this.init();
      return;
    }

    this.isEnabled = true;

    if (this.postInjector) {
      this.postInjector.enable();
    }

    console.log("Casper Manager: Enabled");
  }

  /**
   * Disable Casper
   */
  disable() {
    this.isEnabled = false;

    if (this.postInjector) {
      this.postInjector.disable();
    }

    if (this.chatUI && this.chatUI.isOpen) {
      this.chatUI.close();
    }

    console.log("Casper Manager: Disabled");
  }

  /**
   * Load theme from storage and apply it
   */
  async loadAndApplyTheme() {
    try {
      const result = await chrome.storage.local.get(["casper_theme"]);
      const theme = result.casper_theme || "light";
      this.applyTheme(theme);
      console.log("Casper Manager: Initial theme loaded and applied:", theme);
    } catch (error) {
      console.error("Casper Manager: Error loading theme:", error);
      this.applyTheme("light"); // Default to light on error
    }
  }

  /**
   * Apply theme (light/dark)
   * @param {string} theme - 'light' or 'dark'
   */
  applyTheme(theme) {
    const chatbox = document.getElementById("casper-chatbox");
    if (chatbox) {
      chatbox.setAttribute("data-theme", theme);
      console.log("Casper Manager: Theme applied", theme);
    }
  }

  /**
   * Get current status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      apiReady: this.api?.isReady() || false,
      chatUIOpen: this.chatUI?.isOpen || false,
      injectedPostsCount: this.postInjector?.injectedPosts.size || 0,
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    if (this.postInjector) {
      this.postInjector.destroy();
    }

    if (this.chatUI && this.chatUI.chatbox) {
      this.chatUI.chatbox.remove();
    }

    this.isInitialized = false;
    this.isEnabled = false;
    console.log("Casper Manager: Destroyed");
  }
}

// Make available globally immediately
window.CasperManager = CasperManager;
console.log("Casper: Manager module loaded");
