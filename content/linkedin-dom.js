/**
 * LinkedIn DOM adapter — multi-strategy selectors + soft helpers.
 * Call sites should prefer this over hardcoding a single LinkedIn class.
 */
(function (global) {
  const VERSION = 1;

  const SELECTORS = {
    jobDetailContainers: [
      ".jobs-details__main-content",
      ".job-view-layout",
      ".jobs-details",
      ".jobs-search__job-details",
      ".jobs-unified-top-card",
      ".scaffold-layout__detail",
      "main.scaffold-layout__main",
      "#job-details",
      '[class*="jobs-details"]',
      "main .jobs-search__job-details",
    ],
    jobDescription: [
      ".jobs-description__content",
      ".jobs-box__html-content",
      "#job-details",
      ".jobs-description-content__text",
      '[class*="jobs-description"]',
    ],
    jobResultsList: [
      ".jobs-search-results-list",
      ".scaffold-layout__list",
      '[data-results-list-container]',
    ],
    jobCards: [
      ".jobs-search-results__list-item",
      ".scaffold-layout__list-item",
      "li.jobs-search-results__list-item",
      "li[data-occludable-job-id]",
      ".job-card-container",
      "div.job-card-list__entity-lockup",
    ],
    closedJobSignals: [
      ".jobs-details-top-card__apply-error",
      ".artdeco-inline-feedback--error",
      '[class*="jobs-details-top-card"]',
    ],
    datePostedFilter: [
      'button.search-reusables__filter-pill-button[aria-label*="Date posted" i]',
      'button.search-reusables__filter-pill-button[aria-label*="Date" i]',
      'button.artdeco-pill--choice[aria-label*="Date posted" i]',
      'button[aria-label*="Past 24 hours" i]',
    ],
    asideRail: [
      'aside[aria-label="Aside"]',
      'aside[aria-label*="Aside" i]',
      "aside.scaffold-layout__aside",
      ".scaffold-layout__aside",
      '[class*="scaffold-layout__aside"]',
      "aside[data-testid='rightRail']",
    ],
    // Soft multi-strategy — LinkedIn renames games/puzzles often
    asidePuzzles: [
      '[data-testid*="puzzle" i]',
      '[data-testid*="games" i]',
      'section[componentkey*="puzzle" i]',
      'section[componentkey*="game" i]',
      'div[class*="puzzle" i]',
      'div[class*="games" i]',
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
      '[data-id*="urn:li:activity"]',
      '[data-urn^="urn:li:activity"]',
      "div.feed-shared-update-v2",
      "article.feed-shared-update-v2",
      'div[class*="occludable-update"]',
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
    // LinkedIn 2026+ feed uses hashed classes + aria-label="Aside"
    try {
      const labeled = document.querySelector(
        'aside[aria-label="Aside"], aside[aria-label*="Aside" i]'
      );
      if (labeled) return labeled;
    } catch (e) {}

    const bySel = queryFirst(SELECTORS.asideRail);
    if (bySel) {
      if (bySel.tagName === "ASIDE") return bySel;
      const wrap = bySel.closest("aside");
      if (wrap) return wrap;
      return bySel;
    }

    // Fallback: climb from Today's puzzles copy
    try {
      const nodes = document.querySelectorAll("p, h2, h3");
      for (let i = 0; i < nodes.length; i++) {
        const t = (nodes[i].textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (t.length > 48) continue;
        if (
          t.indexOf("today") >= 0 &&
          (t.indexOf("puzzle") >= 0 || t.indexOf("game") >= 0)
        ) {
          const aside = nodes[i].closest("aside");
          if (aside) return aside;
        }
      }
    } catch (e) {}

    return null;
  }

  function getAsidePuzzlesCard(aside) {
    const root = aside || getAside();
    if (!root) return null;

    function climbToAsideChild(el) {
      let cur = el;
      let last = el;
      while (cur && cur !== root) {
        last = cur;
        cur = cur.parentElement;
      }
      return last;
    }

    const bySel = queryFirst(SELECTORS.asidePuzzles, root);
    if (bySel) return climbToAsideChild(bySel);

    try {
      const headings = root.querySelectorAll("p, h2, h3, header, span, div");
      for (let i = 0; i < headings.length; i++) {
        const el = headings[i];
        const t = (el.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        if (!t || t.length > 40) continue;
        if (
          t.indexOf("today") >= 0 &&
          (t.indexOf("puzzle") >= 0 || t.indexOf("game") >= 0)
        ) {
          return climbToAsideChild(el);
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Prefer inserting before puzzles; else first child of aside; else aside itself.
   * Returns { parent, before } for insertBefore, or null.
   */
  function findAsideInsertAnchor(aside) {
    const rail = aside || getAside();
    if (!rail) return null;
    const puzzles = getAsidePuzzlesCard(rail);
    if (puzzles && puzzles.parentElement) {
      return { parent: puzzles.parentElement, before: puzzles };
    }
    if (rail.firstElementChild) {
      return { parent: rail, before: rail.firstElementChild };
    }
    return { parent: rail, before: null };
  }

  function getDatePostedFilterButton() {
    return queryFirst(SELECTORS.datePostedFilter);
  }

  function isJobDetailPage() {
    const url = window.location.href;
    const path = window.location.pathname || "";
    const standaloneView = /\/jobs\/view\/\d+/.test(path);
    const hasJobUrl =
      standaloneView ||
      url.includes("/jobs/view/") ||
      url.includes("currentJobId=");

    // Standalone /jobs/view/{id}: strong signal — accept if any job chrome exists
    if (standaloneView) {
      const hasStandaloneChrome = !!(
        getJobDetailContainer() ||
        queryFirst(SELECTORS.jobDescription) ||
        document.querySelector(
          "h1.job-details-jobs-unified-top-card__job-title, h1.t-24, .jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title"
        ) ||
        document.querySelector("main")
      );
      if (hasStandaloneChrome) return true;
    }

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

  /**
   * Extract up to maxCards job cards from a LinkedIn search/results page.
   */
  function extractSearchJobCards(maxCards) {
    const limit = Math.max(1, Math.min(10, maxCards || 5));
    const cards = queryAll(SELECTORS.jobCards);
    const out = [];
    const seen = new Set();

    for (let i = 0; i < cards.length && out.length < limit; i++) {
      const card = cards[i];
      try {
        let id =
          card.getAttribute("data-occludable-job-id") ||
          card.getAttribute("data-job-id") ||
          "";
        if (!id) {
          const link = card.querySelector(
            'a[href*="/jobs/view/"], a[href*="currentJobId="]'
          );
          const href = link ? link.getAttribute("href") || "" : "";
          const m =
            href.match(/\/jobs\/view\/(\d+)/) ||
            href.match(/currentJobId=(\d+)/);
          if (m) id = m[1];
        }
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const titleEl = card.querySelector(
          ".job-card-list__title, .artdeco-entity-lockup__title, a.job-card-container__link, .job-card-list__title--link"
        );
        const companyEl = card.querySelector(
          ".job-card-container__primary-description, .artdeco-entity-lockup__subtitle, .job-card-list__company-name"
        );
        const title = (titleEl && titleEl.textContent
          ? titleEl.textContent
          : ""
        )
          .replace(/\s+/g, " ")
          .trim();
        const company = (companyEl && companyEl.textContent
          ? companyEl.textContent
          : ""
        )
          .replace(/\s+/g, " ")
          .trim();

        out.push({
          id: String(id),
          title: title || "Untitled job",
          company: company || "",
          url: "https://www.linkedin.com/jobs/view/" + encodeURIComponent(id),
        });
      } catch (e) {
        // skip card
      }
    }
    return out;
  }

  function detectClosedJob() {
    try {
      const text = (document.body && document.body.innerText) || "";
      const patterns = [
        /no longer accepting applications/i,
        /no longer accepting applicants/i,
        /this job is no longer available/i,
        /job is closed/i,
        /applications closed/i,
      ];
      for (let i = 0; i < patterns.length; i++) {
        if (patterns[i].test(text)) return true;
      }
    } catch (e) {}
    return false;
  }

  function parseApplicantCountFromText(raw) {
    try {
      const text = String(raw || "");
      if (!text) return null;
      const patterns = [
        /(\d[\d,]*)\+?\s+applicants?/i,
        /(\d[\d,]*)\+?\s+people\s+clicked\s+apply/i,
        /(\d[\d,]*)\+?\s+people\s+applied/i,
        /Be among the first\s+(\d[\d,]*)/i,
      ];
      for (let i = 0; i < patterns.length; i++) {
        const m = text.match(patterns[i]);
        if (m) {
          const n = parseInt(m[1].replace(/,/g, ""), 10);
          if (!Number.isNaN(n)) return n;
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * LinkedIn often packs "Dhaka · 1 hour ago · 4 people clicked apply" into one node.
   * Keep the first segment that looks like a place, not time/applicants/promo.
   */
  function cleanLocationText(raw) {
    try {
      const text = String(raw || "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      const parts = text.split(/\s*[·|•]\s*/);
      const candidates = parts.length > 1 ? parts : [text];
      for (let i = 0; i < candidates.length; i++) {
        let p = candidates[i].trim();
        if (!p) continue;
        if (/applicants?/i.test(p)) continue;
        if (/people\s+clicked\s+apply/i.test(p)) continue;
        if (/people\s+applied/i.test(p)) continue;
        if (/reposted/i.test(p)) continue;
        if (/promoted/i.test(p)) continue;
        if (/responses managed/i.test(p)) continue;
        if (/be among the first/i.test(p)) continue;
        if (/ago$/i.test(p)) continue;
        if (/^\d+\s*(minute|hour|day|week|month|year)s?\b/i.test(p)) continue;
        if (/clicked apply/i.test(p)) continue;
        // LinkedIn action chrome glued into location blobs
        if (/easy apply|save\b|apply\b/i.test(p) && /,/.test(p)) {
          const geo = p.match(
            /([A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*(?:,\s*[A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*){1,3})\s*$/
          );
          if (geo && geo[1]) return geo[1].trim();
          continue;
        }
        if (/^(save|easy apply|apply)\b/i.test(p)) continue;
        if (p.length > 80) continue;
        return p;
      }
      // Last resort: strip known tails from the blob
      return text
        .replace(/\s*[·|•]\s*\d[\d,]*\+?\s+people\s+clicked\s+apply.*/i, "")
        .replace(/\s*[·|•]\s*\d[\d,]*\+?\s+applicants?.*/i, "")
        .replace(/\s*[·|•]\s*\d+\s+(minute|hour|day|week|month|year)s?\s+ago.*/i, "")
        .replace(/Promoted by hirer.*/i, "")
        .replace(/Responses managed.*/i, "")
        .replace(/^[\s\S]*?\b((?:[A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*(?:,\s*[A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*){1,3}))\s*$/m, "$1")
        .trim();
    } catch (e) {
      return String(raw || "").trim();
    }
  }

  function parseApplicantCountFromPage() {
    try {
      const text = (document.body && document.body.innerText) || "";
      const oldParsed = (function () {
        const m = text.match(/(\d[\d,]*)\+?\s+applicants?/i);
        return m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
      })();
      const altParsed = parseApplicantCountFromText(text);
      if (oldParsed != null && !Number.isNaN(oldParsed)) return oldParsed;
      return altParsed;
    } catch (e) {}
    return null;
  }

  global.LinkedInDOM = {
    VERSION,
    SELECTORS,
    queryFirst,
    queryAll,
    getJobDetailContainer,
    getAside,
    getAsidePuzzlesCard,
    findAsideInsertAnchor,
    getDatePostedFilterButton,
    isJobDetailPage,
    waitFor,
    onAsideReady,
    safeRun,
    extractSearchJobCards,
    detectClosedJob,
    parseApplicantCountFromPage,
    parseApplicantCountFromText,
    cleanLocationText,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
