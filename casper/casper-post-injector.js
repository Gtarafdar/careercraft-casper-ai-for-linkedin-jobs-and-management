/**
 * Casper Post Icon Injector
 * Handles lazy loading of analyze icons on LinkedIn posts using IntersectionObserver
 */

class CasperPostInjector {
  constructor(chatUI) {
    this.chatUI = chatUI;
    this.injectedPosts = new Set();
    this.observer = null;
    this.mutationObserver = null;
    this.repairTimer = null;
    this.isEnabled = true;
    // 2026 main feed: only real post listitems (avoid nested FeedType wrappers)
    this.postSelector = [
      '[role="listitem"][componentkey*="FeedType_MAIN_FEED"]',
      '[role="listitem"][componentkey*="FeedType"]',
      '[data-id^="urn:li:activity"]',
      "div.feed-shared-update-v2",
      "article.feed-shared-update-v2",
    ].join(", ");
    this.sendSelector =
      'a[aria-label="Send"], [aria-label="Send"], a[aria-label*="Send" i], button[aria-label*="Send" i]';
  }

  /**
   * Initialize the injector
   */
  init() {
    console.log("Casper Injector: Initializing...");

    const currentPath = window.location.pathname;
    const isFeedPage =
      currentPath === "/feed/" ||
      currentPath === "/" ||
      currentPath.startsWith("/feed");

    if (!isFeedPage) {
      console.log(
        "Casper Injector: Not a feed page, post analysis disabled (chat still available)"
      );
      return;
    }

    this.setupScrollObserver();
    this.setupMutationObserver();
    this.setupRepairHeartbeat();
    this.injectVisiblePosts();
    this.repairMissingIcons();
  }

  getPostId(post) {
    if (!post) return null;
    const ck = post.getAttribute?.("componentkey");
    if (ck) return ck;
    return (
      post.getAttribute?.("data-id") ||
      post.getAttribute?.("data-urn") ||
      post.id ||
      "post-" + (post.textContent || "").slice(0, 40).replace(/\s+/g, "")
    );
  }

  setupScrollObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && this.isEnabled) {
            this.injectIcon(entry.target);
            this.observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
  }

  setupMutationObserver() {
    let timer = null;
    const scheduleRepair = () => {
      if (!this.isEnabled) return;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        this.repairMissingIcons();
      }, 300);
    };

    this.mutationObserver = new MutationObserver((mutations) => {
      if (!this.isEnabled) return;

      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (this.isPostElement(node)) this.observePost(node);
          node.querySelectorAll?.(this.postSelector)?.forEach((post) =>
            this.observePost(post)
          );
          // Send buttons can appear after the post shell
          if (
            node.matches?.(this.sendSelector) ||
            node.querySelector?.(this.sendSelector)
          ) {
            scheduleRepair();
          }
        });
      }

      scheduleRepair();
    });

    // Always observe body — LinkedIn replaces mainFeed and detaches old observers
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
    console.log("Casper Injector: MutationObserver active on document.body");
  }

  setupRepairHeartbeat() {
    if (this.repairTimer) clearInterval(this.repairTimer);
    // Safety net: LinkedIn often rebuilds action bars without remounting posts
    this.repairTimer = setInterval(() => {
      if (!this.isEnabled) return;
      this.repairMissingIcons();
    }, 2000);
  }

  isPostElement(element) {
    if (!element?.matches) return false;
    try {
      return element.matches(this.postSelector);
    } catch (_) {
      return false;
    }
  }

  observePost(post) {
    const postId = this.getPostId(post);
    if (!postId) return;

    // Already present on this DOM node
    if (post.querySelector(".casper-analyze-icon")) {
      this.injectedPosts.add(postId);
      return;
    }

    // LinkedIn often remounts posts with the same id — clear stale "done" flag
    if (this.injectedPosts.has(postId)) {
      this.injectedPosts.delete(postId);
    }

    // Eager inject when social bar exists
    if (this.findSocialActions(post)) {
      this.injectIcon(post);
      return;
    }
    // Fallback: wait until the post/actions enter view or mount
    this.observer?.observe(post);
  }

  injectVisiblePosts() {
    const posts = document.querySelectorAll(this.postSelector);
    console.log(`Casper Injector: Found ${posts.length} posts`);
    posts.forEach((post) => this.observePost(post));
  }

  /**
   * Re-attach icons when LinkedIn rebuilds the social action row in-place
   */
  repairMissingIcons() {
    if (!this.isEnabled) return;

    const posts = document.querySelectorAll(this.postSelector);

    posts.forEach((post) => {
      const postId = this.getPostId(post);
      const hasIcon = !!post.querySelector(".casper-analyze-icon");
      if (hasIcon) {
        if (postId) this.injectedPosts.add(postId);
        return;
      }
      if (!this.findSocialActions(post)) return;
      if (postId) this.injectedPosts.delete(postId);
      this.injectIcon(post);
    });

    // Fallback: any Send without a nearby Casper icon (selector-resistant)
    document.querySelectorAll(this.sendSelector).forEach((sendEl) => {
      if (sendEl.parentElement?.querySelector(".casper-analyze-icon")) return;
      const post =
        sendEl.closest(this.postSelector) ||
        sendEl.closest('[role="listitem"]') ||
        sendEl.closest("article") ||
        sendEl.closest('[data-id^="urn:li:activity"]');
      if (post) {
        const postId = this.getPostId(post);
        if (postId) this.injectedPosts.delete(postId);
        this.injectIcon(post);
      } else {
        this.injectBesideSend(sendEl);
      }
    });
  }

  findSendIn(root) {
    if (!root?.querySelector) return null;
    return root.querySelector(this.sendSelector);
  }

  findSocialActions(post) {
    const sendEl = this.findSendIn(post);
    if (sendEl?.parentElement) return sendEl.parentElement;

    const commentBtn =
      post.querySelector('button[aria-label="Comment"]') ||
      post.querySelector('button[aria-label*="Comment" i]');
    if (commentBtn?.parentElement) return commentBtn.parentElement;

    return (
      post.querySelector(".feed-shared-social-action-bar") ||
      post.querySelector('[class*="social-action-bar"]')
    );
  }

  injectBesideSend(sendEl) {
    if (!sendEl?.parentNode) return;
    if (sendEl.parentElement.querySelector(".casper-analyze-icon")) return;

    const post =
      sendEl.closest(this.postSelector) ||
      sendEl.closest('[role="listitem"]') ||
      sendEl.parentElement;
    const postId = this.getPostId(post) || `send-${Date.now()}`;
    const casperBtn = this.createAnalyzeButton(post, postId);

    if (sendEl.nextSibling) {
      sendEl.parentNode.insertBefore(casperBtn, sendEl.nextSibling);
    } else {
      sendEl.parentNode.appendChild(casperBtn);
    }
    this.injectedPosts.add(postId);
    this.guardActionBar(sendEl.parentElement, post);
  }

  injectIcon(post) {
    const postId = this.getPostId(post);
    if (!postId) return;

    if (post.querySelector(".casper-analyze-icon")) {
      this.injectedPosts.add(postId);
      return;
    }

    if (this.injectedPosts.has(postId)) {
      this.injectedPosts.delete(postId);
    }

    const socialActions = this.findSocialActions(post);
    if (!socialActions) {
      this.observer?.observe(post);
      return;
    }

    const casperBtn = this.createAnalyzeButton(post, postId);

    const sendEl =
      this.findSendIn(socialActions) || this.findSendIn(post);

    if (sendEl?.parentNode) {
      if (sendEl.nextSibling) {
        sendEl.parentNode.insertBefore(casperBtn, sendEl.nextSibling);
      } else {
        sendEl.parentNode.appendChild(casperBtn);
      }
      this.guardActionBar(sendEl.parentElement, post);
    } else {
      socialActions.appendChild(casperBtn);
      this.guardActionBar(socialActions, post);
    }

    this.injectedPosts.add(postId);
    console.log("Casper Injector: Icon injected for post", postId);
  }

  /**
   * If LinkedIn clears the action row, reinject into the same parent
   */
  guardActionBar(parent, post) {
    if (!parent || parent._casperGuard) return;
    parent._casperGuard = new MutationObserver(() => {
      if (!this.isEnabled) return;
      if (!parent.isConnected) return;
      if (parent.querySelector(".casper-analyze-icon")) return;
      const postId = this.getPostId(post);
      if (postId) this.injectedPosts.delete(postId);
      if (post?.isConnected) this.injectIcon(post);
      else {
        const send = this.findSendIn(parent);
        if (send) this.injectBesideSend(send);
      }
    });
    parent._casperGuard.observe(parent, { childList: true });
  }

  createAnalyzeButton(post, postId) {
    const wrapper = document.createElement("div");
    wrapper.className = "casper-analyze-wrapper";

    const button = document.createElement("button");
    button.className = "casper-analyze-icon";
    button.type = "button";
    // No native title — browser tooltip is ~1s delayed; use custom tooltip
    button.removeAttribute("title");
    button.setAttribute("aria-label", "Analyze the post with Casper AI");
    button.setAttribute("data-post-id", postId);
    button.innerHTML = `<svg class="casper-icon-svg" width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
           <path d="M16 4 C10 4 6 8 6 14 V24 L9 22 L12 24 L16 22 L20 24 L23 22 L26 24 V14 C26 8 22 4 16 4 Z" fill="currentColor"/>
           <circle cx="13" cy="13" r="2" fill="#fff"/>
           <circle cx="19" cy="13" r="2" fill="#fff"/>
           <path d="M12 17 Q16 20 20 17" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
         </svg>`;

    const tooltip = document.createElement("span");
    tooltip.className = "casper-analyze-tooltip";
    tooltip.textContent = "Analyze the post with Casper AI";
    tooltip.setAttribute("role", "tooltip");

    const stop = (e) => e.stopPropagation();
    ["mouseenter", "mouseover", "pointerenter", "pointerover", "focus"].forEach(
      (evt) => {
        button.addEventListener(evt, stop, true);
        wrapper.addEventListener(evt, stop, true);
      }
    );

    button.addEventListener("mouseenter", () => {
      button.style.setProperty("color", "#0a66c2", "important");
    });
    button.addEventListener("mouseleave", () => {
      button.style.setProperty("color", "#666666", "important");
    });

    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      await this.handleAnalyzeClick(post, postId);
    });

    wrapper.appendChild(button);
    wrapper.appendChild(tooltip);
    return wrapper;
  }

  async handleAnalyzeClick(post, postId) {
    console.log("Casper Injector: Analyze clicked for post", postId);
    try {
      const postContext = this.extractPostContext(post);
      if (!postContext) {
        console.error("Casper Injector: Failed to extract post context");
        return;
      }
      await this.chatUI.open(postContext);
    } catch (error) {
      console.error("Casper Injector: Error handling analyze click:", error);
    }
  }

  extractPostContext(post) {
    try {
      const postId = this.getPostId(post);

      const authorLink =
        post.querySelector(".update-components-actor__name") ||
        post.querySelector(".feed-shared-actor__name");
      let author = authorLink?.textContent?.trim() || "";
      if (!author) {
        const menu = post.querySelector(
          'button[aria-label*="Open control menu for post by"]'
        );
        const m = menu
          ?.getAttribute("aria-label")
          ?.match(/Open control menu for post by (.+)/);
        if (m) author = m[1].trim();
      }
      if (!author) {
        const labeled = post.querySelector(
          '[aria-label*="Verified Profile"], [aria-label*="1st"], [aria-label*="2nd"]'
        );
        author =
          labeled
            ?.getAttribute("aria-label")
            ?.replace(/\s+Verified Profile.*$/, "")
            ?.replace(/\s+[123](st|nd|rd|th).*$/, "")
            ?.trim() || "Unknown Author";
      }

      const headline =
        post
          .querySelector(".update-components-actor__description")
          ?.textContent?.trim() ||
        post
          .querySelector(".feed-shared-actor__description")
          ?.textContent?.trim() ||
        "";

      const contentElement =
        post.querySelector('[data-testid="expandable-text-box"]') ||
        post.querySelector(".feed-shared-update-v2__description") ||
        post.querySelector(".update-components-text") ||
        post.querySelector(".feed-shared-text");
      const content = contentElement?.textContent?.trim() || "";

      const images = post.querySelectorAll(
        "figure img, .update-components-image__container img, .feed-shared-image__container img"
      );

      const likesElement =
        post.querySelector(".social-details-social-counts__reactions-count") ||
        post.querySelector('[aria-label*="reaction"]');
      const commentsElement =
        post.querySelector(".social-details-social-counts__comments") ||
        post.querySelector('[aria-label*="comment"]');

      const hashtags = Array.from(
        post.querySelectorAll('a[href*="hashtag"], a[href*="HASH_TAG"]')
      ).map((el) => el.textContent.trim());

      return {
        postId,
        author,
        headline,
        content,
        hasImages: images.length > 0,
        imageCount: images.length,
        hasVideo: !!post.querySelector("video"),
        hasDocument: !!post.querySelector(".feed-shared-document"),
        hasCarousel: !!post.querySelector(".feed-shared-carousel"),
        likes: likesElement?.textContent?.trim() || "0",
        comments: commentsElement?.textContent?.trim() || "0",
        hashtags,
        url: window.location.href,
      };
    } catch (error) {
      console.error("Casper Injector: Error extracting post context:", error);
      return null;
    }
  }

  enable() {
    this.isEnabled = true;
    console.log("Casper Injector: Enabled");
  }

  disable() {
    this.isEnabled = false;
    console.log("Casper Injector: Disabled");
  }

  destroy() {
    if (this.observer) this.observer.disconnect();
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.repairTimer) clearInterval(this.repairTimer);
    this.repairTimer = null;
    document.querySelectorAll(".casper-analyze-icon").forEach((icon) => {
      icon.closest(".casper-analyze-wrapper")?.remove() || icon.remove();
    });
    this.injectedPosts.clear();
    console.log("Casper Injector: Destroyed");
  }

  refresh() {
    this.injectedPosts.clear();
    this.injectVisiblePosts();
    console.log("Casper Injector: Refreshed");
  }
}

window.CasperPostInjector = CasperPostInjector;
console.log("Casper: Post Injector module loaded");
