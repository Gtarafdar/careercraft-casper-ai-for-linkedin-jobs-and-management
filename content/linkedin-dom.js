/**
 * LinkedIn DOM adapter — multi-strategy selectors + soft helpers.
 * Call sites should prefer this over hardcoding a single LinkedIn class.
 */
(function (global) {
  const VERSION = 1;

  const SELECTORS = {
    jobDetailContainers: [
      ".jobs-details__main-content",
      ".jobs-unified-top-card",
      ".scaffold-layout__detail",
      '[class*="jobs-details"]',
      "main .jobs-search__job-details",
    ],
    jobDescription: [
      ".jobs-description__content",
      ".jobs-box__html-content",
      "#job-details",
      '[class*="jobs-description"]',
    ],
    jobResultsList: [
      ".jobs-search-results-list",
      ".scaffold-layout__list",
      '[data-results-list-container]',
    ],
    datePostedFilter: [
      'button.search-reusables__filter-pill-button[aria-label*="Date posted" i]',
      'button.search-reusables__filter-pill-button[aria-label*="Date" i]',
      'button.artdeco-pill--choice[aria-label*="Date posted" i]',
      'button[aria-label*="Past 24 hours" i]',
    ],
    asideRail: [
      "aside.scaffold-layout__aside",
      ".scaffold-layout__aside",
      '[class*="scaffold-layout__aside"]',
      "aside[data-testid='rightRail']",
    ],
    feedMain: [
      "main.scaffold-layout__main",
      '[data-testid="mainFeed"]',
      "main[role='main']",
    ],
    feedPosts: [
      '[role="listitem"][componentkey*="FeedType_MAIN_FEED"]',
      '[role="listitem"][componentkey*="FeedType"]',
      '[data-id^="urn:li:activity"]',
      "div.feed-shared-update-v2",
      "article.feed-shared-update-v2",
    ],
    composeEditors: [
      "#artdeco-modal-outlet .ql-editor",
      '[data-test-modal-id="sharebox"] .ql-editor',
      ".share-box .ql-editor",
      ".share-creation-state .ql-editor",
      '.ql-editor[data-test-ql-editor-contenteditable="true"]',
      '[contenteditable="true"].ql-editor',
      '[contenteditable="true"].ProseMirror',
      '[contenteditable="true"].tiptap',
    ],
  };

  function queryFirst(selectors, root) {
    const scope = root || document;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      try {
        const el = scope.querySelector(sel);
        if (el) return el;
      } catch (e) {
        // Invalid selector — skip
      }
    }
    return null;
  }

  function queryAll(selectors, root) {
    const scope = root || document;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const out = [];
    const seen = new Set();
    for (const sel of list) {
      try {
        scope.querySelectorAll(sel).forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            out.push(el);
          }
        });
      } catch (e) {
        // skip
      }
    }
    return out;
  }

  function getJobDetailContainer() {
    return queryFirst(SELECTORS.jobDetailContainers);
  }

  function getAside() {
    return queryFirst(SELECTORS.asideRail);
  }

  function getDatePostedFilterButton() {
    return queryFirst(SELECTORS.datePostedFilter);
  }

  function isJobDetailPage() {
    const url = window.location.href;
    const hasJobUrl =
      url.includes("/jobs/view/") || url.includes("currentJobId=");
    const hasDetailContainer = !!getJobDetailContainer();
    const list = queryFirst(SELECTORS.jobResultsList);
    const topCard = queryFirst([".jobs-unified-top-card"]);
    const isListingView = !!(list && topCard && list.contains(topCard));
    return hasJobUrl && hasDetailContainer && !isListingView;
  }

  function waitFor(findFn, { timeoutMs = 8000, intervalMs = 250 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        try {
          const el = findFn();
          if (el) {
            resolve(el);
            return;
          }
        } catch (e) {
          // continue
        }
        if (Date.now() - start >= timeoutMs) {
          resolve(null);
          return;
        }
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  function onAsideReady(callback, { timeoutMs = 15000 } = {}) {
    const existing = getAside();
    if (existing) {
      try {
        callback(existing);
      } catch (e) {
        console.warn("LinkedInDOM: onAsideReady callback error", e);
      }
      return () => {};
    }

    let done = false;
    const finish = (aside) => {
      if (done || !aside) return;
      done = true;
      try {
        observer.disconnect();
      } catch (e) {}
      try {
        callback(aside);
      } catch (e) {
        console.warn("LinkedInDOM: onAsideReady callback error", e);
      }
    };

    const observer = new MutationObserver(() => {
      finish(getAside());
    });
    try {
      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (e) {
      return () => {};
    }

    const timer = setTimeout(() => {
      done = true;
      try {
        observer.disconnect();
      } catch (e) {}
    }, timeoutMs);

    return () => {
      done = true;
      clearTimeout(timer);
      try {
        observer.disconnect();
      } catch (e) {}
    };
  }

  function safeRun(label, fn) {
    try {
      return fn();
    } catch (error) {
      console.warn(`LinkedInDOM: ${label} failed (soft):`, error);
      return undefined;
    }
  }

  global.LinkedInDOM = {
    VERSION,
    SELECTORS,
    queryFirst,
    queryAll,
    getJobDetailContainer,
    getAside,
    getDatePostedFilterButton,
    isJobDetailPage,
    waitFor,
    onAsideReady,
    safeRun,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
