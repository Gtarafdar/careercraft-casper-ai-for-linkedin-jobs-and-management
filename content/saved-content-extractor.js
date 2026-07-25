/**
 * Saved Content Extractor
 * Extracts and categorizes saved LinkedIn items
 */

class SavedContentExtractor {
  constructor() {
    this.selectors = {
      // LinkedIn saved items page selectors
      savedContainer: [
        ".scaffold-finite-scroll__content",
        '[data-view-name="my-items-saved-posts"]',
        ".my-items-container",
        ".reusable-search__entity-results-list",
      ],
      savedItem: [
        ".reusable-search__result-container",
        ".saved-item",
        "li.reusable-search__result-container",
      ],
      // Post content selectors
      postContent: [
        ".update-components-text",
        ".feed-shared-update-v2__description",
        ".feed-shared-text",
      ],
      // Image/Visual selectors
      images: [
        ".update-components-image",
        ".feed-shared-image",
        "img.ivm-view-attr__img--centered",
      ],
      // Video selectors
      videos: [".update-components-video", ".feed-shared-video", "video"],
      // Article/Link selectors
      externalLinks: [
        ".update-components-article",
        ".feed-shared-article",
        "a[href^='http']",
      ],
      // Metadata selectors
      author: [
        ".update-components-actor__name",
        ".feed-shared-actor__name",
        ".entity-result__title-text",
      ],
      timestamp: [
        "time",
        ".update-components-actor__sub-description",
        ".entity-result__secondary-subtitle",
      ],
      thumbnail: [
        ".update-components-image__image",
        ".feed-shared-image__image-link img",
        ".entity-result__item img",
      ],
    };
  }

  /**
   * Check if we're on the saved items page
   */
  isSavedItemsPage() {
    const url = window.location.href;
    return (
      url.includes("/my-items/saved-posts") ||
      url.includes("/saved") ||
      url.includes("/my-items")
    );
  }

  /**
   * Extract all saved items from the page
   */
  async extractAllSavedItems() {
    console.log("SavedContentExtractor: Starting extraction...");

    if (!this.isSavedItemsPage()) {
      throw new Error("Not on saved items page");
    }

    // Wait for content to load
    await this.waitForContent();

    // Scroll to load all items (LinkedIn uses lazy loading)
    await this.scrollToLoadAll();

    // Extract individual items
    const items = await this.extractItems();

    console.log(`SavedContentExtractor: Extracted ${items.length} items`);

    return items;
  }

  /**
   * Wait for saved content to load
   */
  waitForContent(timeout = 5000) {
    return new Promise((resolve) => {
      let container = null;

      for (const selector of this.selectors.savedContainer) {
        container = document.querySelector(selector);
        if (container) break;
      }

      if (container) {
        resolve(container);
        return;
      }

      const observer = new MutationObserver(() => {
        for (const selector of this.selectors.savedContainer) {
          container = document.querySelector(selector);
          if (container) {
            observer.disconnect();
            resolve(container);
            return;
          }
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
   * Scroll to load all lazy-loaded content
   */
  async scrollToLoadAll() {
    console.log("SavedContentExtractor: Loading all items via scroll...");

    let lastHeight = document.body.scrollHeight;
    let scrollAttempts = 0;
    const maxScrolls = 20; // Limit to prevent infinite loop

    while (scrollAttempts < maxScrolls) {
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);

      // Wait for new content to load
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const newHeight = document.body.scrollHeight;

      if (newHeight === lastHeight) {
        // No new content loaded
        break;
      }

      lastHeight = newHeight;
      scrollAttempts++;
    }

    // Scroll back to top
    window.scrollTo(0, 0);

    console.log(`SavedContentExtractor: Completed ${scrollAttempts} scroll(s)`);
  }

  /**
   * Extract individual saved items
   */
  async extractItems() {
    const items = [];
    let itemElements = [];

    // Find all saved item elements
    for (const selector of this.selectors.savedItem) {
      itemElements = document.querySelectorAll(selector);
      if (itemElements.length > 0) {
        console.log(
          `SavedContentExtractor: Found ${itemElements.length} items using ${selector}`
        );
        break;
      }
    }

    if (itemElements.length === 0) {
      console.log("SavedContentExtractor: No items found");
      return items;
    }

    // Process each item
    for (let i = 0; i < itemElements.length; i++) {
      try {
        const itemData = await this.extractItemData(itemElements[i], i);
        if (itemData) {
          items.push(itemData);
        }
      } catch (error) {
        console.error(
          `SavedContentExtractor: Error extracting item ${i}:`,
          error
        );
      }
    }

    return items;
  }

  /**
   * Extract data from a single saved item
   */
  async extractItemData(element, index) {
    const item = {
      id: `saved_${Date.now()}_${index}`,
      dateAdded: new Date().toISOString(),
      type: "unknown",
      category: "uncategorized",
      title: "",
      content: "",
      url: "",
      thumbnail: "",
      author: "",
      timestamp: "",
      metadata: {},
    };

    // Extract URL
    const linkElement = element.querySelector("a[href*='linkedin.com']");
    if (linkElement) {
      item.url = linkElement.href;
    }

    // Extract author
    for (const selector of this.selectors.author) {
      const authorEl = element.querySelector(selector);
      if (authorEl) {
        item.author = authorEl.textContent.trim();
        break;
      }
    }

    // Extract timestamp
    for (const selector of this.selectors.timestamp) {
      const timeEl = element.querySelector(selector);
      if (timeEl) {
        item.timestamp =
          timeEl.getAttribute("datetime") || timeEl.textContent.trim();
        break;
      }
    }

    // Extract thumbnail
    for (const selector of this.selectors.thumbnail) {
      const thumbEl = element.querySelector(selector);
      if (thumbEl) {
        item.thumbnail =
          thumbEl.src || thumbEl.getAttribute("data-delayed-url");
        break;
      }
    }

    // Extract content
    for (const selector of this.selectors.postContent) {
      const contentEl = element.querySelector(selector);
      if (contentEl) {
        item.content = contentEl.textContent.trim();
        item.title = item.content.substring(0, 100) + "...";
        break;
      }
    }

    // Detect content type and categorize
    this.categorizeItem(item, element);

    return item;
  }

  /**
   * Categorize item based on content type
   */
  categorizeItem(item, element) {
    // Check for video
    const hasVideo = element.querySelector(this.selectors.videos.join(", "));
    if (hasVideo) {
      item.type = "video";
      item.category = "videos";
      item.metadata.hasVideo = true;
      return;
    }

    // Check for external link/article
    const hasExternalLink = element.querySelector(
      ".feed-shared-article, .update-components-article"
    );
    if (hasExternalLink) {
      item.type = "article";
      item.category = "links";
      item.metadata.isExternalLink = true;

      // Try to extract article title
      const articleTitle = element.querySelector(
        ".feed-shared-article__title, .article-title"
      );
      if (articleTitle) {
        item.title = articleTitle.textContent.trim();
      }
      return;
    }

    // Check for images/visuals
    const images = element.querySelectorAll(this.selectors.images.join(", "));
    if (images.length > 0) {
      item.type = "image";
      item.category = "visuals";
      item.metadata.imageCount = images.length;

      // Check if it's a carousel
      const carousel = element.querySelector(
        ".feed-shared-image__carousel, .carousel"
      );
      if (carousel || images.length > 1) {
        item.type = "carousel";
        item.metadata.isCarousel = true;
      }
      return;
    }

    // Check for document/PDF
    const hasDocument = element.querySelector(
      ".feed-shared-document, .document-card"
    );
    if (hasDocument) {
      item.type = "document";
      item.category = "visuals";
      item.metadata.isDocument = true;
      return;
    }

    // Default to text post
    if (item.content) {
      item.type = "post";
      item.category = "posts";
      item.metadata.isTextPost = true;
    }
  }

  /**
   * Get categorized statistics
   */
  getCategoryStats(items) {
    const stats = {
      total: items.length,
      posts: 0,
      links: 0,
      visuals: 0,
      videos: 0,
      uncategorized: 0,
    };

    items.forEach((item) => {
      if (stats.hasOwnProperty(item.category)) {
        stats[item.category]++;
      } else {
        stats.uncategorized++;
      }
    });

    return stats;
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = SavedContentExtractor;
}
