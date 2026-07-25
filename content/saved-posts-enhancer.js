/**
 * LinkedIn Saved Posts Enhancer
 * Simple approach: Scrape → Group → Display
 */

class SavedPostsEnhancer {
  constructor() {
    this.isActive = false;
    this.currentFilter = "all";
    this.currentDateFilter = "all";
    this.contentObserver = null;
    this.filterBarObserver = null;
    this.intersectionObserver = null;
    this.isProcessing = false;
    this.processedItems = new Set(); // Track which items we've already processed

    // Scraped and grouped data
    this.allItems = [];
    this.groupedData = {
      all: [],
      posts: [],
      articles: [],
      images: [],
      videos: [],
    };

    // LinkedIn selectors - will be detected dynamically
    this.selectors = {
      mainContainer: ".scaffold-finite-scroll__content",
      individualItem: null, // Will be auto-detected
      itemsList: null, // Will be auto-detected
      // Content type indicators
      videoIcon: ".ivm-view-attr__video-icon",
      embeddedObject: ".entity-result__content-embedded-object",
      imageWrapper: ".ivm-image-view-model",
      // Metadata
      authorLink:
        ".entity-result__content-actor a[href*='/in/'], .entity-result__content-actor a[href*='/company/']",
      timeText: ".entity-result__content-actor p.t-black--light.t-12",
      contentSummary: ".entity-result__content-summary",
      // LinkedIn's native filter container
      nativeFilterBar: "#search-reusables__filters-bar",
      nativeFilterList: ".search-reusables__filter-list",
    };

    this.init();
  }

  /**
   * Initialize the enhancer
   */
  async init() {
    console.log("SavedPostsEnhancer: Initializing...");

    // Check if we're on saved posts page
    if (!this.isSavedPostsPage()) {
      return;
    }

    // Wait for page to load
    await this.waitForPage();

    // Process items and inject UI
    await this.processAndInject();

    // Setup observers for dynamic content and navigation
    this.setupObservers();

    this.isActive = true;
    console.log(
      `SavedPostsEnhancer: Active! Found ${this.allItems.length} items`
    );
  }

  /**
   * Process items and inject filters (lazy loading approach)
   */
  async processAndInject() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Auto-detect selectors if not set
      if (!this.selectors.individualItem) {
        this.detectSelectors();
      }

      // Process visible items only
      console.log("SavedPostsEnhancer: Processing visible items...");
      await this.processVisibleItems();

      // Group by type
      console.log("SavedPostsEnhancer: Grouping items...");
      this.groupItems();

      // Inject UI with counts
      console.log("SavedPostsEnhancer: Injecting UI...");
      this.injectFilterUI();

      // Setup lazy loading for remaining items
      this.setupLazyLoading();

      // Apply current filter
      if (this.currentFilter !== "all") {
        this.applyFilter(this.currentFilter);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Setup observers to monitor DOM changes and page navigation
   */
  setupObservers() {
    // 1. Watch for new items being added (infinite scroll)
    this.setupContentObserver();

    // 2. Watch for filter bar changes (when LinkedIn reloads content)
    this.setupFilterBarObserver();

    // 3. Watch for URL changes (navigation)
    this.setupNavigationMonitor();
  }

  /**
   * Monitor content list for new items (infinite scroll)
   */
  setupContentObserver() {
    const mainContainer = document.querySelector(this.selectors.mainContainer);
    if (!mainContainer) return;

    this.contentObserver = new MutationObserver((mutations) => {
      const newItems = [];

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === 1 &&
            node.matches &&
            this.selectors.individualItem &&
            node.matches(this.selectors.individualItem)
          ) {
            newItems.push(node);
          }
        });
      });

      if (newItems.length > 0) {
        console.log(
          `SavedPostsEnhancer: ${newItems.length} new items detected via scroll`
        );

        // Add new items to intersection observer for lazy processing
        if (this.intersectionObserver) {
          newItems.forEach((item) => {
            if (!this.processedItems.has(item)) {
              this.intersectionObserver.observe(item);
            }
          });
        }
      }
    });

    this.contentObserver.observe(mainContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Monitor filter bar to detect when LinkedIn changes tabs or reloads content
   */
  setupFilterBarObserver() {
    // Check if our filters get removed and reinject if needed
    const mainContainer = document.querySelector(this.selectors.mainContainer);
    if (!mainContainer) return;

    this.filterBarObserver = new MutationObserver((mutations) => {
      // Check if our custom filter bar was removed
      const customFilterBar = document.getElementById("lf-custom-filter-bar");
      const hasOurFilters = document.querySelector(".lf-filter-tab");

      if (
        !hasOurFilters &&
        !customFilterBar &&
        this.isActive &&
        this.allItems.length > 0
      ) {
        console.log("SavedPostsEnhancer: Filters removed, reinjecting...");
        setTimeout(() => this.injectFilterUI(), 500);
      }
    });

    this.filterBarObserver.observe(mainContainer, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Monitor URL changes for navigation
   */
  setupNavigationMonitor() {
    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;

        if (this.isSavedPostsPage() && !this.isActive) {
          console.log(
            "SavedPostsEnhancer: Navigated to saved posts, reinitializing..."
          );
          this.cleanup(); // Clean up first
          this.init();
        } else if (!this.isSavedPostsPage() && this.isActive) {
          console.log("SavedPostsEnhancer: Left saved posts page");
          this.cleanup();
        }
      }
    }, 500);
  }

  /**
   * Cleanup observers and data
   */
  cleanup() {
    this.isActive = false;
    this.processedItems.clear();
    this.allItems = [];
    this.groupedData = {
      all: [],
      posts: [],
      articles: [],
      images: [],
      videos: [],
    };
    if (this.contentObserver) this.contentObserver.disconnect();
    if (this.filterBarObserver) this.filterBarObserver.disconnect();
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
  }

  /**
   * Auto-detect correct selectors for saved items page
   * @param {boolean} silent - If true, don't log errors (used during waiting)
   */
  detectSelectors(silent = false) {
    if (!silent) {
      console.log("SavedPostsEnhancer: Auto-detecting selectors...");
    }

    // Try multiple possible selectors for list items (from most specific to most general)
    const possibleItemSelectors = [
      "div[data-chameleon-result-urn]", // Items with result URN (from actual HTML)
      "li.ciasUsXCidZaECHXyxdmlZBZITWiniWb", // Original specific class
      "li.reusable-search__result-container", // Search result container
      "li[class*='reusable-search']", // Any list item with reusable-search in class
      ".scaffold-finite-scroll__content > ul > li", // Direct child li
      ".scaffold-finite-scroll__content li", // Any li descendant
      "ul[class*='reusable'] > li", // List items in reusable lists
      ".entity-result", // Entity result divs
      "li.artdeco-list__item", // LinkedIn's artdeco list items
    ];

    for (const selector of possibleItemSelectors) {
      try {
        const items = document.querySelectorAll(selector);

        // Validate items have content (not empty or header items)
        const validItems = Array.from(items).filter((item) => {
          const hasContent =
            item.querySelector(".entity-result__content") ||
            item.querySelector('[class*="content"]');
          const hasMinHeight = item.offsetHeight > 50; // Filter out tiny items
          return hasContent && hasMinHeight;
        });

        if (validItems.length > 0) {
          this.selectors.individualItem = selector;
          console.log(
            `SavedPostsEnhancer: ✅ Found ${validItems.length} valid items using: ${selector}`
          );

          // Find parent list
          const firstItem = validItems[0];
          const parentList = firstItem.parentElement;
          if (parentList && parentList.tagName === "UL") {
            const classes = parentList.className
              .split(" ")
              .filter((c) => c.length > 0);
            if (classes.length > 0) {
              this.selectors.itemsList = "." + classes.join(".");
              console.log(
                `SavedPostsEnhancer: ✅ Found list: ${this.selectors.itemsList}`
              );
            }
          }

          return true;
        }
      } catch (e) {
        // Only log warnings if not in silent mode
        if (!silent) {
          console.warn(
            `SavedPostsEnhancer: Selector "${selector}" failed:`,
            e.message
          );
        }
      }
    }

    // Only log detailed errors if not in silent mode (not during waiting)
    if (!silent) {
      console.error(
        "SavedPostsEnhancer: ❌ Could not find any items with known selectors"
      );
      console.log("SavedPostsEnhancer: 💡 Trying to inspect page structure...");

      // Debug: Show what's in the main container
      const mainContainer = document.querySelector(
        this.selectors.mainContainer
      );
      if (mainContainer) {
        console.log(
          "Main container found. First few children:",
          Array.from(mainContainer.children)
            .slice(0, 5)
            .map((el) => ({
              tag: el.tagName,
              classes: el.className,
              children: el.children.length,
            }))
        );
      }
    }

    return false;
  }

  /**
   * Process only currently visible items (lazy loading approach)
   */
  async processVisibleItems() {
    if (!this.selectors.individualItem) {
      console.error("SavedPostsEnhancer: ❌ No selector detected!");
      return;
    }

    const allItemElements = document.querySelectorAll(
      this.selectors.individualItem
    );
    console.log(
      `SavedPostsEnhancer: Found ${allItemElements.length} total items`
    );

    if (allItemElements.length === 0) {
      console.warn(
        "SavedPostsEnhancer: No items found! Check selector:",
        this.selectors.individualItem
      );
      return;
    }

    // Process first batch of visible items (first 20)
    const batchSize = 20;
    const itemsToProcess = Array.from(allItemElements).slice(0, batchSize);

    console.log(
      `SavedPostsEnhancer: Processing ${itemsToProcess.length} items in first batch...`
    );

    for (const element of itemsToProcess) {
      if (!this.processedItems.has(element)) {
        await this.processItem(element);
        this.processedItems.add(element);
      }
    }

    console.log(
      `SavedPostsEnhancer: Processed ${this.processedItems.size} items so far, allItems.length = ${this.allItems.length}`
    );
  }

  /**
   * Process a single item element
   */
  async processItem(element) {
    try {
      const type = this.detectType(element);

      const itemData = {
        index: this.allItems.length, // Add index for filtering
        element,
        type,
        author: this.extractAuthor(element),
        time: this.extractTime(element),
        summary: this.extractSummary(element),
      };

      this.allItems.push(itemData);
    } catch (error) {
      console.error("SavedPostsEnhancer: Error processing item:", error);
    }
  }

  /**
   * Setup Intersection Observer for lazy loading remaining items
   */
  setupLazyLoading() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const element = entry.target;

            if (!this.processedItems.has(element)) {
              // Process this item as it becomes visible
              this.processItem(element).then(() => {
                this.processedItems.add(element);

                // Update grouping and counts
                this.groupItems();
                this.updateFilterCounts();

                // Apply current filter if needed
                if (this.currentFilter !== "all") {
                  this.applyFilter(this.currentFilter);
                }
              });
            }

            // Stop observing this item
            this.intersectionObserver.unobserve(element);
          }
        });
      },
      {
        root: null,
        rootMargin: "200px", // Start loading 200px before item becomes visible
        threshold: 0.01,
      }
    );

    // Observe all unprocessed items
    const allItemElements = document.querySelectorAll(
      this.selectors.individualItem
    );
    allItemElements.forEach((element) => {
      if (!this.processedItems.has(element)) {
        this.intersectionObserver.observe(element);
      }
    });
  }

  /**
   * Hide our custom filters
   */
  hideFilters() {
    const existingFilters = document.querySelectorAll(".lf-filter-tab");
    existingFilters.forEach((filter) => (filter.style.display = "none"));
  }

  /**
   * Check if we're on the saved posts page
   */
  isSavedPostsPage() {
    const url = window.location.href;
    return url.includes("/my-items");
  }

  /**
   * Wait for the saved posts container to load
   */
  waitForPage() {
    return new Promise((resolve) => {
      let attemptCount = 0;
      const maxAttempts = 50; // 10 seconds (50 * 200ms)

      const checkContainer = () => {
        attemptCount++;
        const container = document.querySelector(this.selectors.mainContainer);

        // Auto-detect selectors (silent mode to avoid spam)
        if (!this.selectors.individualItem) {
          const detected = this.detectSelectors(true); // Silent mode
          if (!detected) {
            // Only log every 10 attempts (every 2 seconds) to reduce noise
            if (attemptCount % 10 === 0) {
              console.log(
                "SavedPostsEnhancer: ⏳ Waiting for items to load..."
              );
            }
            return false;
          }
        }

        const items = this.selectors.individualItem
          ? document.querySelectorAll(this.selectors.individualItem)
          : [];

        if (container && items.length > 0) {
          console.log(
            `SavedPostsEnhancer: ✅ Page loaded with ${items.length} items using selector: ${this.selectors.individualItem}`
          );
          resolve();
          return true;
        }
        return false;
      };

      // Check immediately
      if (checkContainer()) return;

      // Wait for it to appear with MutationObserver
      const observer = new MutationObserver(() => {
        if (checkContainer()) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect();

        // Final attempt with full error logging
        if (!this.selectors.individualItem) {
          console.error(
            "SavedPostsEnhancer: ❌ Timeout waiting for items to load"
          );
          this.detectSelectors(false); // Non-silent to show debug info
        }

        resolve();
      }, 10000);
    });
  }

  /**
   * Scrape all saved items from the page
   */
  async scrapeAllItems() {
    const itemElements = document.querySelectorAll(
      this.selectors.individualItem
    );
    this.allItems = [];

    console.log(
      `SavedPostsEnhancer: Found ${itemElements.length} items to scrape`
    );
    console.log(
      `SavedPostsEnhancer: Using selector: ${this.selectors.individualItem}`
    );

    itemElements.forEach((element, index) => {
      try {
        const type = this.detectType(element);
        const text = this.extractText(element);
        const author = this.extractAuthor(element);
        const date = this.extractDate(element);

        const item = {
          index: index,
          element: element,
          type: type,
          text: text,
          author: author,
          date: date,
          dateObj: null, // Will be parsed
        };

        // Parse date for filtering
        if (item.date) {
          item.dateObj = this.parseDate(item.date);
        }

        this.allItems.push(item);

        // Log first 5 items for debugging
        if (index < 5) {
          const hasVideo = element.querySelector(this.selectors.videoIcon)
            ? "✓"
            : "✗";
          const hasEmbedded = element.querySelector(
            this.selectors.embeddedObject
          )
            ? "✓"
            : "✗";
          const hasDirectImage = element.querySelector(
            ".mh4 > a > .ivm-image-view-model"
          )
            ? "✓"
            : "✗";

          console.log(`🔍 Item ${index} → [${type.toUpperCase()}]:`, {
            author: author,
            date: date,
            flags: `Video:${hasVideo} | Article:${hasEmbedded} | Image:${hasDirectImage}`,
            textPreview: text.substring(0, 50) + "...",
          });
        }
      } catch (error) {
        console.error(
          `SavedPostsEnhancer: Error scraping item ${index}:`,
          error
        );
      }
    });

    console.log(
      `SavedPostsEnhancer: Successfully scraped ${this.allItems.length} items`
    );
  }

  /**
   * Detect the type of content
   * Based on actual LinkedIn structure:
   * - Videos: Have play icon (.ivm-view-attr__video-icon)
   * - Articles: Have embedded object link (.entity-result__content-embedded-object)
   * - Images: Have image in main content area without embedded object
   * - Posts: Text-only content (no media, no external links, just text)
   */
  detectType(element) {
    // Priority 1: Check for video (has play icon)
    const videoIcon = element.querySelector(this.selectors.videoIcon);
    if (videoIcon) {
      return "videos";
    }

    // Priority 2: Check for article (has embedded object = external link with preview)
    // These are article links from external sites
    const embeddedObject = element.querySelector(this.selectors.embeddedObject);
    if (embeddedObject) {
      return "articles";
    }

    // Priority 3: Check for images in main content area
    // Text-only posts should have NO images except profile pictures
    const contentContainer =
      element.querySelector(".entity-result__content-inner-container") ||
      element;

    // Look for content images (not profile pictures)
    const allImages = contentContainer.querySelectorAll("img");
    let hasContentImage = false;

    for (let img of allImages) {
      // Skip profile pictures and avatars
      const isProfilePic =
        img.closest(".entity-result__image") ||
        img.closest(".entity-result__content-image") ||
        img.closest("[class*='avatar']") ||
        img.closest(".presence-entity");

      // Skip images in embedded objects (already handled as articles)
      const isInEmbedded = img.closest(
        ".entity-result__content-embedded-object"
      );

      if (!isProfilePic && !isInEmbedded) {
        hasContentImage = true;
        break;
      }
    }

    // If there's any content image, it's an image post
    if (hasContentImage) {
      return "images";
    }

    // Priority 4: Text-only posts
    // No video, no article link, no images = pure text post
    return "posts";
  }

  /**
   * Extract text content
   */
  extractText(element) {
    const textEl = element.querySelector(this.selectors.contentSummary);
    if (textEl) {
      return textEl.textContent.trim();
    }
    return "";
  }

  /**
   * Extract author
   */
  extractAuthor(element) {
    const authorEl = element.querySelector(this.selectors.authorLink);
    if (authorEl) {
      // Get the span content inside the link
      const nameSpan = authorEl.querySelector("span[dir='ltr']");
      if (nameSpan) {
        return nameSpan.textContent.trim();
      }
      return authorEl.textContent.trim();
    }
    return "Unknown";
  }

  /**
   * Extract time (alias for extractDate for lazy loading)
   */
  extractTime(element) {
    return this.extractDate(element);
  }

  /**
   * Extract summary (alias for extractText for lazy loading)
   */
  extractSummary(element) {
    return this.extractText(element);
  }

  /**
   * Extract date
   */
  extractDate(element) {
    const timeEl = element.querySelector(this.selectors.timeText);
    if (timeEl) {
      const text = timeEl.textContent.trim();
      // Extract date like "3d •", "10mo •", "2h •"
      const match = text.match(/^([^•]+)•/);
      if (match) {
        return match[1].trim();
      }
    }
    return "";
  }

  /**
   * Parse date string to Date object
   */
  parseDate(dateStr) {
    // Try ISO format first
    if (dateStr.includes("T") || dateStr.includes("-")) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Parse relative dates (e.g., "3d", "1w", "2mo")
    const now = new Date();
    if (dateStr.includes("d")) {
      const days = parseInt(dateStr);
      return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }
    if (dateStr.includes("w")) {
      const weeks = parseInt(dateStr);
      return new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    }
    if (dateStr.includes("mo")) {
      const months = parseInt(dateStr);
      return new Date(now.getTime() - months * 30 * 24 * 60 * 60 * 1000);
    }
    if (dateStr.includes("y")) {
      const years = parseInt(dateStr);
      return new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);
    }

    return new Date();
  }

  /**
   * Group items by type
   */
  groupItems() {
    // Reset groups
    this.groupedData = {
      all: [...this.allItems],
      posts: [],
      articles: [],
      images: [],
      videos: [],
    };

    // Group by type
    this.allItems.forEach((item) => {
      if (this.groupedData[item.type]) {
        this.groupedData[item.type].push(item);
      }
    });

    const summary = {
      total: this.groupedData.all.length,
      posts: this.groupedData.posts.length,
      articles: this.groupedData.articles.length,
      images: this.groupedData.images.length,
      videos: this.groupedData.videos.length,
    };

    console.log("SavedPostsEnhancer: ✅ Grouped data:", summary);
    console.log(
      `📊 Distribution: Posts (${summary.posts}) | Articles (${summary.articles}) | Images (${summary.images}) | Videos (${summary.videos})`
    );
  }

  /**
   * Inject filter UI into LinkedIn's native filter bar
   */
  injectFilterUI() {
    // Check if already injected, if so just update counts and show
    const existingFilters = document.querySelectorAll(".lf-filter-tab");
    if (existingFilters.length > 0) {
      console.log(
        "SavedPostsEnhancer: Filters already exist, updating counts and showing"
      );
      this.updateFilterCounts();
      existingFilters.forEach(
        (filter) => (filter.parentElement.style.display = "")
      );
      return;
    }

    // Try to find LinkedIn's native filter list
    let filterList = document.querySelector(this.selectors.nativeFilterList);

    // If no native filter list, create custom container
    if (!filterList) {
      console.log(
        "SavedPostsEnhancer: No native filter list, creating custom container"
      );
      filterList = this.createCustomFilterContainer();
      if (!filterList) {
        console.log("SavedPostsEnhancer: Failed to create filter container");
        return;
      }
    }

    // Create our filter buttons
    const counts = {
      posts: this.groupedData.posts.length,
      images: this.groupedData.images.length,
      videos: this.groupedData.videos.length,
    };

    console.log("SavedPostsEnhancer: Injecting filters with counts:", counts);

    // Inject "All" button first, then our custom filters
    this.injectFilterButton(
      filterList,
      "all",
      "All",
      this.groupedData.all.length
    );
    this.injectFilterButton(filterList, "posts", "Posts", counts.posts);
    this.injectFilterButton(filterList, "images", "Images", counts.images);
    this.injectFilterButton(filterList, "videos", "Videos", counts.videos);

    // Set "All" as active by default
    const allButton = document.querySelector(
      '.lf-filter-tab[data-filter="all"]'
    );
    if (allButton) {
      allButton.classList.add("artdeco-pill--selected");
      allButton.setAttribute("aria-pressed", "true");
    }

    // Attach listeners to LinkedIn's native "All" and "Articles" buttons (if they exist)
    this.attachNativeButtonListeners();

    console.log("SavedPostsEnhancer: ✅ Filters injected successfully");
  }

  /**
   * Create a custom filter container when LinkedIn's native one doesn't exist
   */
  createCustomFilterContainer() {
    // Find the main content area
    const mainContainer = document.querySelector(this.selectors.mainContainer);
    if (!mainContainer) {
      console.log("SavedPostsEnhancer: Main container not found");
      return null;
    }

    // Create custom filter bar
    const filterBar = document.createElement("div");
    filterBar.id = "lf-custom-filter-bar";
    filterBar.style.cssText = `
      position: sticky;
      top: 52px;
      z-index: 100;
      background: white;
      padding: 16px 24px;
      margin-bottom: 16px;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    `;

    // Create filter list (ul element)
    const filterList = document.createElement("ul");
    filterList.className = "lf-custom-filter-list";
    filterList.style.cssText = `
      display: flex;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0;
      flex-wrap: wrap;
    `;

    filterBar.appendChild(filterList);

    // Insert at the top of main container
    mainContainer.insertBefore(filterBar, mainContainer.firstChild);

    console.log("SavedPostsEnhancer: Created custom filter container");
    return filterList;
  }

  /**
   * Update filter button counts dynamically
   */
  updateFilterCounts() {
    const filterButtons = document.querySelectorAll(".lf-filter-tab");

    filterButtons.forEach((button) => {
      const type = button.getAttribute("data-filter");
      const count = this.groupedData[type] ? this.groupedData[type].length : 0;
      const label = button.textContent.split(" ")[0]; // Get label without count
      button.textContent = `${label} ${count}`;
    });
  }

  /**
   * Attach listeners to LinkedIn's native filter buttons
   */
  attachNativeButtonListeners() {
    const allButtons = document.querySelectorAll(
      ".search-reusables__filter-pill-button"
    );

    allButtons.forEach((button) => {
      const text = button.textContent.trim().toLowerCase();

      // Handle "All" button
      if (text.includes("all")) {
        button.addEventListener("click", () => {
          this.applyFilter("all");
          // Remove selection from our custom buttons
          document.querySelectorAll(".lf-filter-tab").forEach((tab) => {
            tab.classList.remove("artdeco-pill--selected");
            tab.setAttribute("aria-pressed", "false");
          });
        });
      }

      // Handle "Articles" button
      if (text.includes("article")) {
        button.addEventListener("click", () => {
          this.applyFilter("articles");
          // Remove selection from our custom buttons
          document.querySelectorAll(".lf-filter-tab").forEach((tab) => {
            tab.classList.remove("artdeco-pill--selected");
            tab.setAttribute("aria-pressed", "false");
          });
        });
      }
    });
  }

  /**
   * Create a single filter button matching LinkedIn's style
   */
  injectFilterButton(filterList, type, label, count) {
    const li = document.createElement("li");
    li.className = "search-reusables__primary-filter";

    const button = document.createElement("button");
    button.className =
      "artdeco-pill artdeco-pill--slate artdeco-pill--choice artdeco-pill--2 search-reusables__filter-pill-button lf-filter-tab";
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("type", "button");
    button.setAttribute("data-filter", type);
    button.textContent = `${label} ${count}`;

    // Add tooltips
    const tooltips = {
      all: "Show all saved items",
      posts: "Show text posts only (no media)",
      images: "Show posts with images",
      videos: "Show posts with videos",
    };
    if (tooltips[type]) {
      button.setAttribute("title", tooltips[type]);
    }

    button.addEventListener("click", () => {
      this.applyFilter(type);
      this.updateActiveTab(button);
    });

    li.appendChild(button);
    filterList.appendChild(li);
  }

  /**
   * Create the filter UI HTML (OLD - keeping for reference)
   */
  createFilterUI_OLD() {
    const wrapper = document.createElement("div");
    wrapper.id = "lf-saved-posts-filters";
    wrapper.style.cssText = `
      position: sticky;
      top: 52px;
      z-index: 100;
      background: white;
      padding: 16px 24px;
      margin: -24px -24px 24px -24px;
      border-bottom: 1px solid #e0e0e0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    `;

    // Use actual counts from grouped data
    const counts = {
      total: this.groupedData.all.length,
      posts: this.groupedData.posts.length,
      articles: this.groupedData.articles.length,
      images: this.groupedData.images.length,
      videos: this.groupedData.videos.length,
    };

    wrapper.innerHTML = `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span style="font-size: 16px; font-weight: 600; color: #000000de;">
            📚 Organize Saved Items
          </span>
          <span style="font-size: 13px; color: #00000099;">
            ${counts.total} items total
          </span>
        </div>
        
        <!-- Search Bar -->
        <input 
          type="text" 
          id="lf-saved-search" 
          placeholder="🔍 Search saved items..."
          style="
            width: 100%;
            padding: 10px 16px;
            border: 1px solid #d0d0d0;
            border-radius: 24px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
          "
        />
      </div>

      <!-- Filter Tabs -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="lf-filter-tab active" data-filter="all" style="
          padding: 8px 16px;
          border: 2px solid #0a66c2;
          background: #0a66c2;
          color: white;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>All</span>
          <span style="
            background: rgba(255,255,255,0.3);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          ">${counts.total}</span>
        </button>

        <button class="lf-filter-tab" data-filter="posts" style="
          padding: 8px 16px;
          border: 2px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>📝 Posts</span>
          <span style="
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          ">${counts.posts}</span>
        </button>

        <button class="lf-filter-tab" data-filter="articles" style="
          padding: 8px 16px;
          border: 2px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>🔗 Articles</span>
          <span style="
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          ">${counts.articles}</span>
        </button>

        <button class="lf-filter-tab" data-filter="images" style="
          padding: 8px 16px;
          border: 2px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>🖼️ Images</span>
          <span style="
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          ">${counts.images}</span>
        </button>

        <button class="lf-filter-tab" data-filter="videos" style="
          padding: 8px 16px;
          border: 2px solid #e0e0e0;
          background: white;
          color: #666;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span>🎥 Videos</span>
          <span style="
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
          ">${counts.videos}</span>
        </button>
      </div>
    `;

    return wrapper;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Event listeners are now attached directly when creating buttons in injectFilterButton()
    // This method kept for compatibility but does nothing now
    console.log(
      "SavedPostsEnhancer: Event listeners attached via button creation"
    );
  }

  /**
   * Apply filter to saved items
   */
  applyFilter(filter) {
    this.currentFilter = filter;

    if (filter === "all") {
      // Show all items
      this.allItems.forEach((item) => {
        if (item.element) {
          item.element.style.display = "";
        }
      });
      console.log(
        `SavedPostsEnhancer: ✅ Showing all ${this.allItems.length} items`
      );
      return;
    }

    // Get items to show from grouped data
    const itemsToShow = this.groupedData[filter] || [];

    // Create set of elements to show for fast lookup
    const elementsToShow = new Set(itemsToShow.map((item) => item.element));

    // Hide ALL items first, then show only filtered ones
    this.allItems.forEach((item) => {
      if (item.element) {
        if (elementsToShow.has(item.element)) {
          item.element.style.display = "";
        } else {
          item.element.style.display = "none";
        }
      }
    });

    console.log(
      `SavedPostsEnhancer: ✅ Applied filter "${filter}" - showing ${itemsToShow.length} of ${this.allItems.length} items`
    );
  }

  /**
   * Apply search filter
   */
  applySearch(keyword) {
    const lowerKeyword = keyword.toLowerCase().trim();

    if (!lowerKeyword) {
      // If no keyword, just apply category filter
      this.applyFilter(this.currentFilter);
      return;
    }

    // Get items from current filter (all if "all", or specific type)
    const baseItems =
      this.currentFilter === "all"
        ? this.groupedData.all
        : this.groupedData[this.currentFilter] || [];

    // Filter by search keyword
    const elementsToShow = new Set();
    baseItems.forEach((item) => {
      const searchText = `${item.summary} ${item.author}`.toLowerCase();
      if (searchText.includes(lowerKeyword)) {
        elementsToShow.add(item.element);
      }
    });

    // Apply visibility - hide ALL first, then show matches
    this.allItems.forEach((item) => {
      if (item.element) {
        if (elementsToShow.has(item.element)) {
          item.element.style.display = "";
        } else {
          item.element.style.display = "none";
        }
      }
    });

    console.log(
      `SavedPostsEnhancer: 🔍 Search "${keyword}" in ${this.currentFilter} - found ${indicesToShow.size} of ${baseItems.length} items`
    );
  }

  /**
   * Update active tab styling to match LinkedIn's native style
   */
  updateActiveTab(activeButton) {
    // Remove active/selected from all our custom filter buttons
    document.querySelectorAll(".lf-filter-tab").forEach((tab) => {
      tab.classList.remove("artdeco-pill--selected");
      tab.setAttribute("aria-pressed", "false");
    });

    // Add active to clicked tab
    activeButton.classList.add("artdeco-pill--selected");
    activeButton.setAttribute("aria-pressed", "true");
  }
}

// Auto-initialize when on saved posts page
if (window.location.href.includes("/my-items")) {
  // Wait for page load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new SavedPostsEnhancer();
    });
  } else {
    new SavedPostsEnhancer();
  }
}

// Export for use
if (typeof module !== "undefined" && module.exports) {
  module.exports = SavedPostsEnhancer;
}
