/**
 * Phase 6 — Timeline job discovery (passive feed scan).
 * Flag feedJobDiscover default OFF. Soft-fail; no People scrape; no auto-scroll bot.
 */
(function (global) {
  const SETTINGS_KEY = "feed_job_settings_v1";
  const CANDIDATES_KEY = "casper_feed_job_candidates";
  const DISMISS_KEY = "casper_feed_job_dismissed";
  const RATE_KEY = "casper_feed_job_rate";

  const DEFAULT_SETTINGS = {
    keywords: [],
    matchMode: "any", // any | all
    autoAddJobLinks: true,
    autoAddOrganic: true, // skip Accept — soft-add to Job Tracker
    includeFreelance: true,
    maxPerSession: 50,
    maxPerHour: 100,
  };

  const HIRING_RE =
    /\b(hiring|#hiring|we(?:'| a)?re\s+hiring|open\s+role|open\s+position|job\s+opening|join\s+(?:our|the)\s+team|now\s+hiring|vacancies?|apply\s+(?:now|here)|dm\s+(?:for|me)|looking\s+for\s+(?:a\s+)?(?:candidate|developer|engineer|designer|manager|freelancer)|seeking\s+(?:a\s+)?(?:candidate|talent)|we(?:'| a)?re\s+looking\s+for|remote\s+(?:frontend|backend|full[\s-]?stack)?\s*(?:developer|engineer))\b/i;
  const FREELANCE_RE =
    /\b(freelance|freelancer|contract\s+(?:role|work|position)|gig\s+work|remote\s+contract|part[- ]time\s+(?:role|contract))\b/i;
  const LIST_HINT_RE =
    /\b(roles?\s+below|openings?\s+below|positions?\s+below|hiring\s+for\s+the\s+following|multiple\s+(?:roles|openings)|we(?:'| a)?re\s+hiring\s+for)\b/i;

  let started = false;
  let observer = null;
  let visibilityObserver = null;
  let scanTimer = null;
  let sessionCount = 0;
  let seenKeys = {};
  let observedEls = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  let pathWatcher = null;
  let scrollListening = false;

  function onFeedScroll() {
    scheduleScan();
  }

  function now() {
    return Date.now();
  }

  function simpleHash(str) {
    const s = String(str || "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function parseKeywords(raw) {
    if (Array.isArray(raw)) {
      return raw
        .map(function (k) {
          return String(k || "")
            .trim()
            .toLowerCase();
        })
        .filter(Boolean);
    }
    return String(raw || "")
      .split(/[\n,]+/)
      .map(function (k) {
        return k.trim().toLowerCase();
      })
      .filter(Boolean)
      .slice(0, 40);
  }

  async function getSettings() {
    try {
      const r = await chrome.storage.local.get([SETTINGS_KEY]);
      const cur = r[SETTINGS_KEY] && typeof r[SETTINGS_KEY] === "object"
        ? r[SETTINGS_KEY]
        : {};
      return Object.assign({}, DEFAULT_SETTINGS, cur, {
        keywords: parseKeywords(
          cur.keywords != null ? cur.keywords : DEFAULT_SETTINGS.keywords
        ),
      });
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  async function setSettings(partial) {
    const cur = await getSettings();
    const next = Object.assign({}, cur, partial || {});
    if (partial && partial.keywords != null) {
      next.keywords = parseKeywords(partial.keywords);
    }
    next.matchMode = next.matchMode === "all" ? "all" : "any";
    next.autoAddJobLinks = next.autoAddJobLinks !== false;
    next.autoAddOrganic = next.autoAddOrganic !== false;
    next.includeFreelance = next.includeFreelance !== false;
    next.maxPerSession = Math.max(
      1,
      Math.min(80, Number(next.maxPerSession) || 50)
    );
    next.maxPerHour = Math.max(
      1,
      Math.min(150, Number(next.maxPerHour) || 100)
    );
    await chrome.storage.local.set({ [SETTINGS_KEY]: next });
    return next;
  }

  async function isDiscoverEnabled() {
    try {
      if (typeof FeatureFlags !== "undefined") {
        const flags = await FeatureFlags.load();
        return flags.feedJobDiscover === true;
      }
    } catch (e) {}
    return false;
  }

  function isFeedPage() {
    try {
      const path = (location.pathname || "").toLowerCase();
      return path === "/feed" || path.indexOf("/feed/") === 0 || path === "/";
    } catch (e) {
      return false;
    }
  }

  function extractJobIdFromHref(href) {
    const m = String(href || "").match(/\/jobs\/view\/(\d+)/i);
    return m ? m[1] : null;
  }

  function getPostNodes(root) {
    const scope = root || document;
    const out = [];
    const seen = [];

    function add(el) {
      if (!el || seen.indexOf(el) >= 0) return;
      let node = el;
      try {
        const outer =
          el.closest(
            '[data-id*="activity"], [data-urn*="activity"], .feed-shared-update-v2, [class*="occludable-update"], [class*="feed-shared-update"], [role="article"]'
          ) || el;
        node = outer;
      } catch (e) {}
      // Skip if nested inside an already-collected card
      for (let i = 0; i < seen.length; i++) {
        if (seen[i].contains(node)) return;
      }
      // Drop previously collected children of this node
      for (let i = seen.length - 1; i >= 0; i--) {
        if (node.contains(seen[i]) && node !== seen[i]) {
          out.splice(out.indexOf(seen[i]), 1);
          seen.splice(i, 1);
        }
      }
      if (seen.indexOf(node) >= 0) return;
      const textLen = String(node.innerText || "").replace(/\s+/g, " ").trim()
        .length;
      if (textLen < 40) return;
      seen.push(node);
      out.push(node);
    }

    const sels = [
      '[componentkey*="FeedType_MAIN_FEED"]',
      '[componentkey*="FeedType"]',
      '[id*="FeedType_MAIN_FEED"]',
      '[role="listitem"][componentkey*="FeedType"]',
      '[role="article"]',
      '[data-id^="urn:li:activity"]',
      '[data-id*="urn:li:activity"]',
      '[data-id*="urn:li:share"]',
      '[data-urn^="urn:li:activity"]',
      '[data-urn*="activity"]',
      '[data-urn*="share"]',
      "div.feed-shared-update-v2",
      "article.feed-shared-update-v2",
      'div[class*="feed-shared-update"]',
      'div[class*="occludable-update"]',
      'div[class*="Update"][data-id]',
    ];
    if (
      typeof LinkedInDOM !== "undefined" &&
      LinkedInDOM.SELECTORS &&
      LinkedInDOM.SELECTORS.feedPosts
    ) {
      sels.unshift.apply(sels, LinkedInDOM.SELECTORS.feedPosts);
    }
    sels.forEach(function (sel) {
      try {
        scope.querySelectorAll(sel).forEach(add);
      } catch (e) {}
    });

    // LinkedIn finite-scroll: each direct child is often one feed item wrapper
    try {
      const main =
        document.querySelector("main.scaffold-layout__main") ||
        document.querySelector("main") ||
        scope;
      const scroll =
        main.querySelector(".scaffold-finite-scroll__content") ||
        main.querySelector('[class*="scaffold-finite-scroll"]') ||
        main.querySelector('[data-testid="mainFeed"]') ||
        null;
      const parent = scroll || main;
      Array.prototype.forEach.call(parent.children || [], function (child) {
        if (!child || child.nodeType !== 1) return;
        const inner =
          child.querySelector(
            '[data-id*="activity"], [data-urn*="activity"], .feed-shared-update-v2, [class*="feed-shared-update"], [role="article"]'
          ) || child;
        add(inner);
      });
    } catch (e) {}

    return out;
  }

  function keywordsMatch(text, settings) {
    const kws = settings.keywords || [];
    // Empty keywords = no keyword filter (still gated by looksJobLike / job links).
    if (!kws.length) return { ok: true, matched: [] };
    const hay = String(text || "").toLowerCase();
    const matched = [];
    kws.forEach(function (k) {
      if (!k) return;
      if (hay.indexOf(k) >= 0) {
        matched.push(k);
        return;
      }
      // Multi-word: all tokens present (order-independent), e.g. "frontend engineer"
      const parts = k.split(/\s+/).filter(function (p) {
        return p.length >= 3;
      });
      if (
        parts.length >= 2 &&
        parts.every(function (p) {
          return hay.indexOf(p) >= 0;
        })
      ) {
        matched.push(k);
      }
    });
    if (settings.matchMode === "all") {
      return { ok: matched.length === kws.length, matched: matched };
    }
    return { ok: matched.length > 0, matched: matched };
  }

  function getViewerNameHints() {
    const hints = [];
    try {
      const nodes = document.querySelectorAll(
        ".feed-identity-module, .feed-identity-module__actor-meta, .global-nav__me-content, .global-nav__primary-link--me"
      );
      for (let i = 0; i < nodes.length; i++) {
        const t = String(nodes[i].textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (t && t.length >= 4 && t.length < 160) hints.push(t);
      }
      const meLink = document.querySelector(
        '.feed-identity-module a[href*="/in/"], .global-nav__me a[href*="/in/"]'
      );
      if (meLink && meLink.href) {
        const m = meLink.href.match(/\/in\/([^/?#]+)/i);
        if (m) hints.push(decodeURIComponent(m[1]).replace(/-/g, " "));
      }
    } catch (e) {}
    return hints;
  }

  function looksLikeViewerText(text) {
    const t = String(text || "").toLowerCase().replace(/\s+/g, " ");
    if (!t) return false;
    if (/product marketing specialist.*wpbakery/i.test(t)) return true;
    const hints = getViewerNameHints();
    for (let i = 0; i < hints.length; i++) {
      const h = String(hints[i] || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      if (h.length >= 6 && t.indexOf(h) >= 0) return true;
      const first = h.split(/\s+/)[0];
      const second = h.split(/\s+/)[1];
      if (
        first &&
        second &&
        first.length >= 3 &&
        t.indexOf(first) >= 0 &&
        t.indexOf(second) >= 0 &&
        /marketing|specialist|plugin|growth/i.test(t)
      ) {
        return true;
      }
    }
    return false;
  }

  function extractAuthor(el) {
    try {
      // Prefer the post actor block — never the left-rail identity / global nav
      const actor =
        el.querySelector(
          ".update-components-actor, .update-components-actor__container, [class*='update-components-actor'], [data-view-name*='feed-actor']"
        ) || el;
      const candidates = actor.querySelectorAll(
        'a[href*="/in/"] span[aria-hidden="true"], a[href*="/in/"] span[dir], a.update-components-actor__meta-link, a[href*="/in/"], a[href*="/company/"] span[aria-hidden="true"], a[href*="/company/"], a[href*="/showcase/"]'
      );
      for (let i = 0; i < candidates.length; i++) {
        const a = candidates[i];
        if (a.closest && a.closest(".feed-identity-module, .global-nav__me, header, aside")) {
          continue;
        }
        let t = (a.textContent || "").replace(/\s+/g, " ").trim();
        t = t.replace(/\s*[•·].*$/, "").trim();
        if (!t || t.length > 80) continue;
        if (/^(follow|connect|message|view|promoted)$/i.test(t)) continue;
        if (looksLikeViewerText(t)) continue;
        return t;
      }
    } catch (e) {}
    return "";
  }

  function isSpecificPostPermalink(href) {
    const h = String(href || "");
    if (!h) return false;
    // Real single-post URLs, e.g.
    // /posts/remote-job-hub-..._mercor-...-activity-7487046555892555776-ngKd
    if (/\/posts\/[^/?#]+-activity-\d+/i.test(h)) return true;
    if (/\/feed\/update\//i.test(h)) return true;
    if (/urn:li:(?:activity|share|ugcPost):\d+/i.test(h)) return true;
    return false;
  }

  function isBadPostUrl(href) {
    const h = String(href || "").toLowerCase();
    if (!h || h === "#" || h.indexOf("javascript:") === 0) return true;
    if (/\/feed\/?(\?|$)/.test(h) && h.indexOf("/feed/update/") < 0) return true;
    // Company/showcase "all posts" index — NOT a specific post
    if (/\/(company|showcase)\/[^/]+\/posts\/?(\?|#|$)/i.test(h)) return true;
    if (/\/showcase\//.test(h) && !isSpecificPostPermalink(href)) return true;
    if (/\/company\//.test(h) && !isSpecificPostPermalink(href)) return true;
    if (/\/in\/[^/]+\/?(\?|$)/.test(h)) return true;
    if (/\/search\//.test(h)) return true;
    // Bare /posts/ without activity id
    if (/\/posts\/?(\?|#|$)/i.test(h)) return true;
    return false;
  }

  function cleanPostUrl(href) {
    try {
      const u = new URL(href, "https://www.linkedin.com");
      if (!/linkedin\.com$/i.test(u.hostname) && !/\.linkedin\.com$/i.test(u.hostname)) {
        return String(href).split("?")[0];
      }
      return u.origin + u.pathname;
    } catch (e) {
      return String(href || "").split("?")[0];
    }
  }

  function activityIdFromHref(href) {
    const h = String(href || "");
    let m = h.match(/-activity-(\d{8,})/i);
    if (m) return m[1];
    m = h.match(/urn:li:activity:(\d+)/i);
    if (m) return m[1];
    m = h.match(/activity[:%3A]+(\d{8,})/i);
    if (m) return m[1];
    return "";
  }

  function shareOrActivityUrnFromText(text) {
    const raw = String(text || "");
    let m =
      raw.match(/(urn:li:activity:\d+)/i) ||
      raw.match(/(urn:li:share:\d+)/i) ||
      raw.match(/(urn:li:ugcPost:\d+)/i);
    if (m) return m[1];
    m = raw.match(/targetUrn=([^&"'<\s]+)/i);
    if (m) {
      try {
        const decoded = decodeURIComponent(m[1]);
        const u = decoded.match(/(urn:li:(?:activity|share|ugcPost):\d+)/i);
        if (u) return u[1];
      } catch (e) {}
    }
    m = raw.match(/urn%3Ali%3A(activity|share|ugcPost)%3A(\d+)/i);
    if (m) return "urn:li:" + m[1] + ":" + m[2];
    m = raw.match(
      /["'](?:entityUrn|updateUrn|backendUrn|trackingUrn|shareUrn|activityUrn|urn)["']\s*:\s*["'](urn:li:(?:activity|share|ugcPost):\d+)["']/i
    );
    if (m) return m[1];
    return "";
  }

  function digUrnFromValue(val, depth, seen) {
    if (val == null || depth > 7) return "";
    if (typeof val === "string") {
      return shareOrActivityUrnFromText(val) || "";
    }
    if (typeof val !== "object") return "";
    if (seen) {
      if (seen.has(val)) return "";
      seen.add(val);
    }
    const prefer = [
      "urn",
      "entityUrn",
      "updateUrn",
      "backendUrn",
      "trackingUrn",
      "permalink",
      "shareUrn",
      "activityUrn",
      "ugcPostUrn",
      "preDashEntityUrn",
    ];
    for (let i = 0; i < prefer.length; i++) {
      try {
        if (val[prefer[i]] != null) {
          const u = digUrnFromValue(val[prefer[i]], depth + 1, seen);
          if (u) return u;
        }
      } catch (e) {}
    }
    try {
      const keys = Object.keys(val);
      const limit = Math.min(keys.length, 50);
      for (let i = 0; i < limit; i++) {
        const k = keys[i];
        if (
          k === "children" ||
          k === "stateNode" ||
          k.charAt(0) === "_" ||
          k === "ref" ||
          k === "type"
        ) {
          continue;
        }
        const u = digUrnFromValue(val[k], depth + 1, seen);
        if (u) return u;
      }
    } catch (e) {}
    return "";
  }

  /**
   * New LinkedIn feed often keeps share/activity URN on React fiber props only.
   */
  function digUrnFromReact(el) {
    try {
      if (!el) return "";
      const seen = typeof WeakSet !== "undefined" ? new WeakSet() : null;
      let node = el;
      for (let d = 0; d < 6 && node; d++) {
        const keys = Object.keys(node);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          if (
            k.indexOf("__reactFiber") !== 0 &&
            k.indexOf("__reactInternalInstance") !== 0 &&
            k.indexOf("__reactProps") !== 0
          ) {
            continue;
          }
          let fiber = node[k];
          for (let hop = 0; hop < 35 && fiber; hop++) {
            const props = fiber.memoizedProps || fiber.pendingProps || fiber;
            const urn = digUrnFromValue(props, 0, seen);
            if (urn) return urn;
            fiber = fiber.return;
          }
        }
        node = node.parentElement;
      }
    } catch (e) {}
    return "";
  }

  function feedUpdateUrlFromUrn(urn) {
    const u = String(urn || "");
    if (!/urn:li:(activity|share|ugcPost):\d+/i.test(u)) return "";
    return "https://www.linkedin.com/feed/update/" + encodeURIComponent(u);
  }

  function activityUrlFromUrn(urn) {
    const raw = String(urn || "");
    const fromShare = shareOrActivityUrnFromText(raw);
    if (fromShare) return feedUpdateUrlFromUrn(fromShare);
    const id = activityIdFromHref(raw) || "";
    if (!id && !/urn:li:activity:/i.test(raw)) return "";
    const urnFull = /urn:li:activity:\d+/i.test(raw)
      ? raw.match(/urn:li:activity:\d+/i)[0]
      : "urn:li:activity:" + id;
    return feedUpdateUrlFromUrn(urnFull);
  }

  function scanDomForActivityId(el) {
    const found = scanDomForPostRef(el);
    return found && found.id ? found.id : "";
  }

  function scanDomForPostRef(el) {
    try {
      // React fiber first — new feed often has no href/urn attributes
      const fiberUrn = digUrnFromReact(el);
      if (fiberUrn) {
        return {
          permalink: feedUpdateUrlFromUrn(fiberUrn),
          id: fiberUrn.match(/:(\d+)$/) ? fiberUrn.match(/:(\d+)$/)[1] : "",
          urn: fiberUrn,
        };
      }
      // Attributes on node + ancestors
      let cur = el;
      for (let depth = 0; depth < 10 && cur; depth++) {
        if (cur.getAttribute) {
          const attrs = [
            "data-id",
            "data-urn",
            "data-activity-urn",
            "data-entity-urn",
            "data-chameleon-result-urn",
            "componentkey",
          ];
          for (let a = 0; a < attrs.length; a++) {
            const v = cur.getAttribute(attrs[a]) || "";
            const urn = shareOrActivityUrnFromText(v);
            if (urn) {
              return {
                permalink: feedUpdateUrlFromUrn(urn),
                id: urn.match(/:(\d+)$/) ? urn.match(/:(\d+)$/)[1] : "",
                urn: urn,
              };
            }
            const id = activityIdFromHref(v);
            if (id) return { permalink: "", id: id, urn: "" };
          }
        }
        cur = cur.parentElement;
      }
      // Any descendant attribute / href
      const nodes = el.querySelectorAll(
        "a[href], [data-id], [data-urn], [data-entity-urn], [componentkey]"
      );
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const href = n.href || "";
        if (/\/posts\/[^/?#]+-activity-\d+/i.test(href)) {
          return { permalink: cleanPostUrl(href), id: activityIdFromHref(href) };
        }
        let id = activityIdFromHref(href);
        if (id) return { permalink: "", id: id };
        const attrs = n.getAttributeNames ? n.getAttributeNames() : [];
        for (let j = 0; j < attrs.length; j++) {
          id = activityIdFromHref(n.getAttribute(attrs[j]) || "");
          if (id) return { permalink: "", id: id };
        }
      }
      // Last resort: raw HTML (share / activity / embed-modal targetUrn)
      const html = String(el.outerHTML || "").slice(0, 120000);
      const urn = shareOrActivityUrnFromText(html);
      if (urn) {
        const permalink = feedUpdateUrlFromUrn(urn);
        const id =
          activityIdFromHref(urn) ||
          (urn.match(/:(\d+)$/) ? urn.match(/:(\d+)$/)[1] : "");
        return { permalink: permalink, id: id, urn: urn };
      }
      let m = html.match(
        /https?:\/\/(?:www\.)?linkedin\.com\/posts\/[^"'<\s]+-activity-\d+[^"'<\s]*/i
      );
      if (m) {
        return {
          permalink: cleanPostUrl(m[0].replace(/&amp;/g, "&")),
          id: activityIdFromHref(m[0]),
          urn: "",
        };
      }
      m = html.match(/(\/posts\/[^"'<\s]+-activity-\d{8,}[^"'<\s]*)/i);
      if (m) {
        return {
          permalink: cleanPostUrl("https://www.linkedin.com" + m[1]),
          id: activityIdFromHref(m[1]),
          urn: "",
        };
      }
      m = html.match(/embed-modal\/\?targetUrn=([^"'<\s&]+)/i);
      if (m) {
        const u = shareOrActivityUrnFromText("targetUrn=" + m[1]);
        if (u) {
          return {
            permalink: feedUpdateUrlFromUrn(u),
            id: u.match(/:(\d+)$/) ? u.match(/:(\d+)$/)[1] : "",
            urn: u,
          };
        }
      }
    } catch (e) {}
    return { permalink: "", id: "", urn: "" };
  }

  function extractCompanyVanity(el) {
    try {
      const a =
        el.querySelector('a[href*="/company/"]') ||
        el.querySelector('a[href*="/showcase/"]');
      if (!a || !a.href) return "";
      const m = a.href.match(/\/(?:company|showcase)\/([^/?#]+)/i);
      return m ? decodeURIComponent(m[1]) : "";
    } catch (e) {
      return "";
    }
  }

  function buildPostsPermalink(vanity, activityId) {
    if (!vanity || !activityId) return "";
    // Best-effort exact post URL when LinkedIn hides the share link in the feed card
    return (
      "https://www.linkedin.com/posts/" +
      encodeURIComponent(vanity) +
      "-activity-" +
      activityId
    );
  }

  function extractActivityKey(el) {
    try {
      const ref = scanDomForPostRef(el);
      if (ref && ref.urn) return ref.urn;
      if (ref && ref.id) return "urn:li:activity:" + ref.id;
      const links = el.querySelectorAll("a[href]");
      for (let i = 0; i < links.length; i++) {
        const href = links[i].href || "";
        const urn = shareOrActivityUrnFromText(href);
        if (urn) return urn;
        if (isSpecificPostPermalink(href)) {
          const aid = activityIdFromHref(href);
          if (aid) return "urn:li:activity:" + aid;
          return cleanPostUrl(href);
        }
      }
    } catch (e) {}
    return "";
  }

  function extractPostUrl(el) {
    try {
      // Cached from menu harvest (⋯ → embed / copy link)
      if (el && el.getAttribute) {
        const cached = el.getAttribute("data-cc-post-url");
        if (cached && isSpecificPostPermalink(cached)) return cleanPostUrl(cached);
      }

      const timeAnchors = el.querySelectorAll(
        'a time, time[datetime], a.update-components-actor__sub-description-link, a[href*="-activity-"], a[href*="/feed/update/"], a[href*="/posts/"], a[href*="embed-modal"]'
      );
      for (let i = 0; i < timeAnchors.length; i++) {
        let a = timeAnchors[i];
        if (a.tagName !== "A") a = a.closest("a");
        const href = (a && a.href) || "";
        if (!href || isBadPostUrl(href)) continue;
        if (/\/posts\/[^/?#]+-activity-\d+/i.test(href)) return cleanPostUrl(href);
        if (/\/feed\/update\//i.test(href)) return cleanPostUrl(href);
        const urn = shareOrActivityUrnFromText(href);
        if (urn) return feedUpdateUrlFromUrn(urn);
      }

      const links = el.querySelectorAll("a[href]");
      let feedUpdate = "";
      for (let i = 0; i < links.length; i++) {
        const href = links[i].href || "";
        if (!href || isBadPostUrl(href)) continue;
        if (/\/posts\/[^/?#]+-activity-\d+/i.test(href)) {
          return cleanPostUrl(href);
        }
        if (!feedUpdate && /\/feed\/update\//i.test(href)) {
          feedUpdate = cleanPostUrl(href);
        }
        const urn = shareOrActivityUrnFromText(href);
        if (urn) return feedUpdateUrlFromUrn(urn);
      }

      const ref = scanDomForPostRef(el);
      if (ref && ref.permalink && (isSpecificPostPermalink(ref.permalink) || /\/feed\/update\//i.test(ref.permalink))) {
        return cleanPostUrl(ref.permalink);
      }
      if (ref && ref.urn) return feedUpdateUrlFromUrn(ref.urn);
      if (ref && ref.id) {
        if (feedUpdate) return feedUpdate;
        return activityUrlFromUrn("urn:li:activity:" + ref.id);
      }

      if (feedUpdate) return feedUpdate;
    } catch (e) {}
    return "";
  }

  function extractUrlsFromText(text) {
    const raw = String(text || "");
    const out = [];
    const re = /https?:\/\/[^\s<>"'）)\]]+/gi;
    let m;
    while ((m = re.exec(raw))) {
      let u = m[0].replace(/[.,;:!?]+$/, "");
      if (u && out.indexOf(u) < 0) out.push(u);
    }
    return out;
  }

  function extractExternalApplyUrl(el, snippet) {
    try {
      const links = el.querySelectorAll("a[href]");
      for (let i = 0; i < links.length; i++) {
        const href = links[i].href || "";
        if (!href) continue;
        if (
          /lnkd\.in\//i.test(href) ||
          /bit\.ly\//i.test(href) ||
          /t\.co\//i.test(href)
        ) {
          return href.split("?")[0];
        }
        if (/mercor\.com\//i.test(href) || /t\.mercor\.com\//i.test(href)) {
          return href.split("?")[0];
        }
        if (
          /\/jobs\/view\//i.test(href) ||
          isSpecificPostPermalink(href) ||
          /linkedin\.com\/(in|company|showcase|search|feed)\b/i.test(href)
        ) {
          continue;
        }
        const txt = (links[i].textContent || "").toLowerCase();
        if (
          /apply|job|role|opening|hiring/.test(txt) &&
          /^https?:/i.test(href)
        ) {
          return href.split("?")[0];
        }
      }
      // URLs pasted as plain text in the post body
      const fromText = extractUrlsFromText(snippet || extractSnippet(el));
      for (let i = 0; i < fromText.length; i++) {
        const href = fromText[i];
        if (/linkedin\.com\//i.test(href) && !isSpecificPostPermalink(href)) {
          continue;
        }
        if (/^https?:/i.test(href)) return href.split("?")[0];
      }
    } catch (e) {}
    return "";
  }

  function stripFeedChrome(text) {
    return stripMenuJunk(
      String(text || "")
        .replace(/^Feed\s+post\s+/i, "")
        .replace(/\bFeed\s+post\b/gi, " ")
        .replace(/\b\d+\s*[smhdw]\s*[•·]\s*/gi, " ")
        .replace(
          /\b(Follow|Connect|Promoted|Suggested|Visible to anyone on or off LinkedIn)\b/gi,
          " "
        )
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  function stripMenuJunk(text) {
    return String(text || "")
      .replace(
        /\bSave\b[\s\S]*?\bCopy link to post\b[\s\S]*$/i,
        " "
      )
      .replace(/\bCopy link to post\b[\s\S]*$/i, " ")
      .replace(/\bSend to Job Tracker\b[\s\S]*$/i, " ")
      .replace(
        /\b(Embed this post|Hide posts by[^.]{0,80}|Not interested|Report post|Saving…|Saved to Job Tracker|Could not save)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function isMenuJunkText(text) {
    return /copy link to post|embed this post|send to job tracker|not interested|report post|hide posts by|saving…/i.test(
      String(text || "")
    );
  }

  function extractSnippet(el) {
    try {
      const nodes = el.querySelectorAll(
        ".update-components-text, .feed-shared-update-v2__description, [class*='update-components-update-v2__commentary'], [class*='feed-shared-update-v2__description'] .break-words, span.break-words[dir='ltr']"
      );
      let best = "";
      for (let i = 0; i < nodes.length; i++) {
        if (
          nodes[i].closest &&
          nodes[i].closest(
            '[role="menu"], [role="dialog"], .feed-identity-module, aside, header.global-nav'
          )
        ) {
          continue;
        }
        const t = stripFeedChrome(
          (nodes[i].innerText || nodes[i].textContent || "")
            .replace(/\s+/g, " ")
            .trim()
        );
        if (isMenuJunkText(t) || looksLikeViewerText(t)) continue;
        if (t.length > best.length) best = t;
      }
      if (!best || best.length < 24) {
        const clone = el.cloneNode(true);
        try {
          clone
            .querySelectorAll(
              '[role="menu"], [role="dialog"], [data-cc-send-tracker], .artdeco-dropdown__content, .feed-identity-module, .social-details-social-counts, .feed-shared-social-actions, button, [class*="comments"]'
            )
            .forEach(function (n) {
              n.remove();
            });
        } catch (e) {}
        best = stripFeedChrome(
          (clone.innerText || "").replace(/\s+/g, " ").trim().slice(0, 800)
        );
      }
      if (isMenuJunkText(best) || looksLikeViewerText(best)) return "";
      // Strip leading "Feed post" / actor chrome that leaks into commentary
      best = best
        .replace(/^Feed\s*post\s*/i, "")
        .replace(/^[\w.\s]{2,60}\s+[123](?:st|nd|rd|th)\+?\s*/i, "")
        .trim();
      return best.slice(0, 800);
    } catch (e) {
      return "";
    }
  }

  function deriveTitle(snippet, author) {
    const s = stripFeedChrome(snippet);
    if (!s || isMenuJunkText(s) || looksLikeViewerText(s)) {
      return author
        ? String(author).slice(0, 60) + " — hiring post"
        : "Hiring post from feed";
    }
    const patterns = [
      /(?:we(?:'|’)(?:re| are)\s+hiring|hiring)\s*[:\-–—]\s*([^.!?\n#]{4,90})/i,
      /#hiring\s+([^.!?\n#]{6,90})/i,
      /(?:hiring|looking for|seeking)[:\s—-]+([^.!?\n#]{6,90})/i,
      /\b((?:remote\s+)?(?:senior\s+|junior\s+|lead\s+|full[\s-]?stack\s+)?(?:frontend|backend|full[\s-]?stack|software|product|data|marketing|android|ios|wordpress|web)?\s*(?:developer|engineer|designer|manager|specialist|analyst)[^.!?\n]{0,40})/i,
    ];
    for (let i = 0; i < patterns.length; i++) {
      const m = s.match(patterns[i]);
      if (m && m[1]) {
        let t = m[1].replace(/\s+/g, " ").trim();
        t = t.replace(/\s+(Apply here|Apply now|📍|Location:).*$/i, "").trim();
        t = t.replace(/^[:\-–—\s]+/, "").trim();
        if (t.length >= 4 && !isMenuJunkText(t) && !looksLikeViewerText(t)) {
          return t.slice(0, 120);
        }
      }
    }
    let first = s.split(/[.!?\n]/)[0].trim();
    if (author && first.toLowerCase().indexOf(String(author).toLowerCase()) === 0) {
      first = first.slice(author.length).replace(/^[\s•·,-]+/, "");
    }
    // Avoid useless fragment titles like "for a Product..." / "a talented..."
    if (/^(for|a|an|the)\s+/i.test(first) && first.length < 50) {
      const hiringLine = s.match(
        /(?:hiring|looking for)[^.!?\n]{0,100}/i
      );
      if (hiringLine) first = hiringLine[0].replace(/\s+/g, " ").trim();
    }
    if (isMenuJunkText(first) || looksLikeViewerText(first)) {
      return author
        ? String(author).slice(0, 60) + " — hiring post"
        : "Hiring post from feed";
    }
    return (first || "Hiring post from feed").slice(0, 120);
  }

  function extractJobLinks(el) {
    const ids = [];
    const seen = {};
    try {
      el.querySelectorAll('a[href*="/jobs/view/"]').forEach(function (a) {
        const id = extractJobIdFromHref(a.href);
        if (id && !seen[id]) {
          seen[id] = true;
          ids.push({
            id: id,
            url: "https://www.linkedin.com/jobs/view/" + id,
            title: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
          });
        }
      });
    } catch (e) {}
    return ids;
  }

  function looksJobLike(text, settings) {
    const t = String(text || "");
    if (!t || t.length < 20) return false;
    if (HIRING_RE.test(t)) return true;
    if (settings.includeFreelance !== false && FREELANCE_RE.test(t)) return true;
    if (/\/jobs\/view\//i.test(t)) return true;
    if (/\b(remote\s+)?(flutter|ios|android|mern|react|shopify|frontend|backend)\s+(developer|engineer)\b/i.test(t)) {
      return true;
    }
    return false;
  }

  function splitJobList(text) {
    const lines = String(text || "")
      .split(/\r?\n+/)
      .map(function (l) {
        return l.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);
    const items = [];
    const bulletRe = /^(?:[-–—•*●◦▪]|[0-9]{1,2}[.)]|[a-z][.)])\s+(.+)$/i;
    lines.forEach(function (line) {
      const m = line.match(bulletRe);
      if (m && m[1]) {
        const role = m[1].trim();
        if (role.length >= 6 && role.length <= 200) items.push(role);
      }
    });
    if (items.length >= 2) return items.slice(0, 12);
    if (LIST_HINT_RE.test(text) && items.length === 1) return items;
    return [];
  }

  function classifyPost(el, settings) {
    if (!el) return [];
    const snippet = extractSnippet(el);
    let author = extractAuthor(el);
    if (looksLikeViewerText(author)) author = "";
    const ref = scanDomForPostRef(el);
    let postUrl = extractPostUrl(el);
    if (postUrl && isBadPostUrl(postUrl)) postUrl = "";
    if (!postUrl && ref && ref.permalink && !isBadPostUrl(ref.permalink)) {
      postUrl = ref.permalink;
    }
    if (!postUrl && ref && ref.urn) {
      postUrl = feedUpdateUrlFromUrn(ref.urn);
    }
    const applyUrl = extractExternalApplyUrl(el, snippet);
    const activityKey =
      (ref && ref.urn) ||
      extractActivityKey(el) ||
      postUrl ||
      applyUrl ||
      simpleHash(snippet);
    const jobLinks = extractJobLinks(el);
    const hay = [author, snippet, jobLinks.map(function (j) {
      return j.title;
    }).join(" ")].join(" \n ");
    const kw = keywordsMatch(hay, settings);
    if (!kw.ok) return [];
    if (!looksJobLike(hay, settings) && !jobLinks.length) return [];

    if (!postUrl || isBadPostUrl(postUrl)) postUrl = "";
    const openUrl = postUrl || applyUrl || "";

    const out = [];
    const stableId =
      ref && ref.urn
        ? "feed:" + String(ref.urn).replace(/^urn:li:/i, "").replace(/:/g, "-")
        : "feed:" + simpleHash(activityKey);
    const parentKey = stableId;

    if (jobLinks.length) {
      jobLinks.forEach(function (j) {
        out.push({
          tier: "A",
          kind: "job_link",
          id: j.id,
          title:
            (j.title && j.title.length > 4
              ? j.title
              : deriveTitle(snippet, author)) || "Job from feed",
          company: author || "",
          url: j.url,
          feedPostUrl: openUrl || j.url,
          feedAuthor: author,
          feedSnippet: snippet.slice(0, 280),
          feedMatchKeywords: kw.matched,
          parentFeedKey: parentKey,
          at: now(),
        });
      });
      return out;
    }

    const listItems = splitJobList(snippet);
    if (listItems.length >= 2) {
      listItems.forEach(function (line, idx) {
        out.push({
          tier: "D",
          kind: "organic_list",
          id: parentKey + ":L" + idx,
          title: line.slice(0, 160),
          company: author || "",
          url: openUrl,
          feedPostUrl: openUrl,
          feedAuthor: author,
          feedSnippet: line.slice(0, 280),
          feedMatchKeywords: kw.matched,
          parentFeedKey: parentKey,
          at: now(),
        });
      });
      return out;
    }

    const title = deriveTitle(snippet, author);
    out.push({
      tier: "C",
      kind: "organic",
      id: parentKey,
      title: title,
      company: author || "",
      url: openUrl,
      feedPostUrl: openUrl,
      feedAuthor: author,
      feedSnippet: snippet.slice(0, 280),
      feedMatchKeywords: kw.matched,
      parentFeedKey: parentKey,
      at: now(),
    });
    return out;
  }

  function scanDocument(settings) {
    const posts = getPostNodes(document);
    const found = [];
    posts.forEach(function (el) {
      try {
        const items = classifyPost(el, settings || DEFAULT_SETTINGS);
        items.forEach(function (it) {
          found.push(it);
        });
      } catch (e) {}
    });
    return found;
  }

  async function readCandidates() {
    try {
      const r = await chrome.storage.local.get([CANDIDATES_KEY]);
      return r[CANDIDATES_KEY] && typeof r[CANDIDATES_KEY] === "object"
        ? r[CANDIDATES_KEY]
        : {};
    } catch (e) {
      return {};
    }
  }

  async function writeCandidates(map) {
    await chrome.storage.local.set({ [CANDIDATES_KEY]: map });
  }

  async function readDismissed() {
    try {
      const r = await chrome.storage.local.get([DISMISS_KEY]);
      return r[DISMISS_KEY] && typeof r[DISMISS_KEY] === "object"
        ? r[DISMISS_KEY]
        : {};
    } catch (e) {
      return {};
    }
  }

  async function dismissCandidate(id) {
    if (!id) return;
    const map = await readDismissed();
    map[String(id)] = now();
    await chrome.storage.local.set({ [DISMISS_KEY]: map });
    const cands = await readCandidates();
    if (cands[String(id)]) {
      delete cands[String(id)];
      await writeCandidates(cands);
    }
  }

  async function clearCandidates() {
    await chrome.storage.local.set({ [CANDIDATES_KEY]: {} });
  }

  async function listCandidates(limit) {
    const map = await readCandidates();
    const dismissed = await readDismissed();
    return Object.keys(map)
      .map(function (k) {
        return map[k];
      })
      .filter(function (c) {
        return c && c.id && !dismissed[String(c.id)];
      })
      .sort(function (a, b) {
        return (b.at || 0) - (a.at || 0);
      })
      .slice(0, limit || 20);
  }

  async function checkRate(settings) {
    try {
      const r = await chrome.storage.local.get([RATE_KEY]);
      const rate = r[RATE_KEY] && typeof r[RATE_KEY] === "object" ? r[RATE_KEY] : {};
      const hourAgo = now() - 60 * 60 * 1000;
      const stamps = Array.isArray(rate.stamps)
        ? rate.stamps.filter(function (t) {
            return t >= hourAgo;
          })
        : [];
      if (sessionCount >= (settings.maxPerSession || 15)) {
        return { ok: false, reason: "session" };
      }
      if (stamps.length >= (settings.maxPerHour || 40)) {
        return { ok: false, reason: "hour" };
      }
      return { ok: true, stamps: stamps };
    } catch (e) {
      return { ok: true, stamps: [] };
    }
  }

  async function bumpRate(stamps) {
    const next = (stamps || []).concat([now()]).slice(-80);
    await chrome.storage.local.set({ [RATE_KEY]: { stamps: next } });
    sessionCount++;
  }

  async function upsertFeedItem(item) {
    if (!item || !item.id || typeof JobTrackerStore === "undefined") return null;
    let openUrl = item.url || item.feedPostUrl || "";
    if (
      !openUrl ||
      isBadPostUrl(openUrl) ||
      /\/jobs\/view\/feed/i.test(openUrl) ||
      (typeof JobTrackerStore.isUnusableTrackerUrl === "function" &&
        JobTrackerStore.isUnusableTrackerUrl(openUrl))
    ) {
      openUrl = "";
    }
    let company = item.company || item.feedAuthor || "";
    let feedAuthor = item.feedAuthor || "";
    if (looksLikeViewerText(company)) company = "";
    if (looksLikeViewerText(feedAuthor)) feedAuthor = "";
    let id = String(item.id);
    // Dedupe: reuse existing tracker row that already has this post URL
    if (openUrl && JobTrackerStore.listJobs) {
      try {
        const rows = await JobTrackerStore.listJobs({ status: "all", q: "" });
        const hit = (rows || []).find(function (r) {
          if (!r || r.source !== "feed") return false;
          const u = String(r.feedPostUrl || r.url || "");
          return (
            u &&
            (u === openUrl ||
              cleanPostUrl(u) === cleanPostUrl(openUrl) ||
              decodeURIComponent(u) === decodeURIComponent(openUrl))
          );
        });
        if (hit && hit.id) id = String(hit.id);
      } catch (e) {}
    }
    return JobTrackerStore.safeUpsert({
      id: id,
      title: item.title || "Job from feed",
      company: company,
      url: openUrl,
      source: "feed",
      status: "new",
      statusSource: "auto",
      feedPostUrl: openUrl || null,
      feedAuthor: feedAuthor || null,
      feedSnippet: item.feedSnippet || null,
      feedDetectedAt: item.at || now(),
      feedMatchKeywords: item.feedMatchKeywords || [],
      parentFeedKey: item.parentFeedKey || id,
      companyDetails: company
        ? { name: company, linkedinUrl: null, raw: null }
        : null,
      touchViewed: false,
    });
  }

  async function upsertJobLink(item) {
    return upsertFeedItem(item);
  }

  async function addOrganicCandidate(item) {
    if (!item || !item.id) return null;
    const dismissed = await readDismissed();
    if (dismissed[String(item.id)]) return null;
    const map = await readCandidates();
    if (map[String(item.id)]) return map[String(item.id)];
    map[String(item.id)] = {
      id: String(item.id),
      title: item.title || "Hiring post",
      company: item.company || "",
      url: item.url || item.feedPostUrl || "",
      feedPostUrl: item.feedPostUrl || null,
      feedAuthor: item.feedAuthor || null,
      feedSnippet: item.feedSnippet || null,
      feedMatchKeywords: item.feedMatchKeywords || [],
      parentFeedKey: item.parentFeedKey || null,
      kind: item.kind || "organic",
      tier: item.tier || "C",
      at: item.at || now(),
      status: "pending",
    };
    await writeCandidates(map);
    return map[String(item.id)];
  }

  async function acceptCandidate(id) {
    const map = await readCandidates();
    const item = map[String(id)];
    if (!item) return null;
    const row = await upsertFeedItem(item);
    delete map[String(id)];
    await writeCandidates(map);
    return row;
  }

  async function ingestFound(items, settings) {
    if (!items || !items.length) return { added: 0, candidates: 0 };
    let added = 0;
    let candidates = 0;
    const autoOrganic = settings.autoAddOrganic !== false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || !item.id) continue;
      const key = String(item.id);
      if (seenKeys[key]) continue;
      seenKeys[key] = true;
      const rate = await checkRate(settings);
      if (!rate.ok) break;
      try {
        if (item.kind === "job_link") {
          if (settings.autoAddJobLinks === false) {
            await addOrganicCandidate(item);
            candidates++;
          } else {
            await upsertFeedItem(item);
            added++;
          }
          await bumpRate(rate.stamps);
        } else if (autoOrganic) {
          const row = await upsertFeedItem(item);
          if (row) added++;
          try {
            const map = await readCandidates();
            if (map[key]) {
              delete map[key];
              await writeCandidates(map);
            }
          } catch (e) {}
          await bumpRate(rate.stamps);
        } else {
          await addOrganicCandidate(item);
          candidates++;
          await bumpRate(rate.stamps);
        }
      } catch (e) {}
    }
    return { added: added, candidates: candidates };
  }

  function idFromPostUrl(url) {
    const urn = shareOrActivityUrnFromText(url);
    if (urn) {
      return (
        "feed:" + String(urn).replace(/^urn:li:/i, "").replace(/:/g, "-")
      );
    }
    return "";
  }

  function attachUrlToItems(items, url, el) {
    if (!items || !items.length || !url) return items;
    const clean = cleanPostUrl(url);
    const stable = idFromPostUrl(clean);
    if (el) {
      try {
        el.setAttribute("data-cc-post-url", clean);
      } catch (e) {}
    }
    items.forEach(function (it) {
      if (!it) return;
      if (it.kind === "job_link") {
        if (!it.feedPostUrl) it.feedPostUrl = clean;
        return;
      }
      it.url = clean;
      it.feedPostUrl = clean;
      if (stable && (!it.id || /^feed:[a-z0-9]{4,10}$/i.test(String(it.id)))) {
        it.id = stable;
        it.parentFeedKey = stable;
      }
    });
    return items;
  }

  let lastSilentHarvestAt = 0;
  const harvestedEls =
    typeof WeakSet !== "undefined" ? new WeakSet() : { has: function () { return false; }, add: function () {} };

  async function ensurePostUrlForElement(el) {
    if (!el) return "";
    let url = extractPostUrl(el) || "";
    if (url && !isBadPostUrl(url)) return cleanPostUrl(url);
    const ref = scanDomForPostRef(el);
    if (ref && ref.permalink && !isBadPostUrl(ref.permalink)) {
      return cleanPostUrl(ref.permalink);
    }
    if (ref && ref.urn) {
      url = feedUpdateUrlFromUrn(ref.urn);
      if (url) return url;
    }
    // Per-card once — avoid dropping keyword matches due to global rate limit
    if (harvestedEls.has(el)) {
      return extractPostUrl(el) || "";
    }
    const nowTs = Date.now();
    if (nowTs - lastSilentHarvestAt < 400) {
      await waitMs(420 - (nowTs - lastSilentHarvestAt));
    }
    lastSilentHarvestAt = Date.now();
    harvestedEls.add(el);
    url = await silentlyHarvestFromCard(el);
    return url || "";
  }

  async function classifyAndResolve(el, settings) {
    const items = classifyPost(el, settings || DEFAULT_SETTINGS);
    if (!items.length) return [];
    const needsUrl = items.some(function (it) {
      return (
        it &&
        it.kind !== "job_link" &&
        (!it.url || isBadPostUrl(it.url)) &&
        (!it.feedPostUrl || isBadPostUrl(it.feedPostUrl))
      );
    });
    if (!needsUrl) return items;
    const url = await ensurePostUrlForElement(el);
    if (url) attachUrlToItems(items, url, el);
    // Drop organic rows that still have no openable URL — they break Open post forever
    return items.filter(function (it) {
      if (!it) return false;
      if (it.kind === "job_link") return true;
      const u = it.url || it.feedPostUrl || "";
      return !!(u && !isBadPostUrl(u) && isSpecificPostPermalink(u));
    });
  }

  async function processPostElement(el, settings) {
    if (!el) return 0;
    try {
      const items = await classifyAndResolve(el, settings || DEFAULT_SETTINGS);
      if (!items.length) return 0;
      const result = await ingestFound(items, settings);
      return (result && result.added) || 0;
    } catch (e) {
      return 0;
    }
  }

  async function runScan() {
    try {
      const enabled = await isDiscoverEnabled();
      if (!enabled) {
        return;
      }
      if (!isFeedPage()) {
        return;
      }
      const settings = await getSettings();
      const posts = getPostNodes(document);
      watchPostsForVisibility(posts);
      const found = [];
      for (let i = 0; i < posts.length; i++) {
        try {
          const items = await classifyAndResolve(posts[i], settings);
          for (let j = 0; j < items.length; j++) found.push(items[j]);
        } catch (e) {}
      }
      await ingestFound(found, settings);
    } catch (e) {
      console.warn("FeedJobDiscover: scan failed", e);
    }
  }

  function scheduleScan() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      runScan().catch(function () {});
    }, 280);
  }

  function watchPostsForVisibility(posts) {
    if (!visibilityObserver) return;
    (posts || []).forEach(function (el) {
      try {
        if (!el) return;
        if (observedEls) {
          if (observedEls.has(el)) return;
          observedEls.add(el);
        }
        visibilityObserver.observe(el);
      } catch (e) {}
    });
  }

  function stopObserver() {
    try {
      if (observer) observer.disconnect();
    } catch (e) {}
    observer = null;
    try {
      if (visibilityObserver) visibilityObserver.disconnect();
    } catch (e) {}
    visibilityObserver = null;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    observedEls = typeof WeakSet !== "undefined" ? new WeakSet() : null;
  }

  function startObserver() {
    stopObserver();
    if (!isFeedPage()) return;
    try {
      const root =
        (typeof LinkedInDOM !== "undefined" &&
          LinkedInDOM.queryFirst &&
          LinkedInDOM.queryFirst(
            LinkedInDOM.SELECTORS.feedMain || ["main"]
          )) ||
        document.querySelector("main") ||
        document.body;
      if (!root) return;

      // Capture each post while it is on screen (LinkedIn virtualizes off-screen nodes away)
      visibilityObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting || !entry.target) return;
            getSettings()
              .then(function (settings) {
                return processPostElement(entry.target, settings);
              })
              .catch(function () {});
          });
        },
        { root: null, rootMargin: "120px 0px", threshold: 0.15 }
      );

      observer = new MutationObserver(function () {
        scheduleScan();
      });
      observer.observe(root, { childList: true, subtree: true });

      if (!scrollListening) {
        try {
          window.addEventListener("scroll", onFeedScroll, { passive: true });
          scrollListening = true;
        } catch (e) {}
      }

      scheduleScan();
    } catch (e) {
      console.warn("FeedJobDiscover: observer failed", e);
    }
  }

  async function migratePendingToTracker() {
    try {
      const settings = await getSettings();
      if (settings.autoAddOrganic === false) return 0;
      const map = await readCandidates();
      const ids = Object.keys(map);
      let n = 0;
      for (let i = 0; i < ids.length; i++) {
        const item = map[ids[i]];
        if (!item) continue;
        await upsertFeedItem(item);
        delete map[ids[i]];
        n++;
      }
      if (n) await writeCandidates(map);
      return n;
    } catch (e) {
      return 0;
    }
  }

  async function syncRunning() {
    try {
      const on = await isDiscoverEnabled();
      const feed = isFeedPage();
      if (on) {
        if (
          typeof JobTrackerStore !== "undefined" &&
          JobTrackerStore.repairBadFeedUrls
        ) {
          JobTrackerStore.repairBadFeedUrls().catch(function () {});
        }
        migratePendingToTracker().catch(function () {});
      }
      if (on && feed) startObserver();
      else stopObserver();
    } catch (e) {
      stopObserver();
    }
  }

  function findOpenCopyMenu() {
    try {
      const menus = document.querySelectorAll(
        '[role="menu"], .artdeco-dropdown__content, [data-test-dropdown-menu], div[class*="artdeco-dropdown"]'
      );
      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        if (!menu || menu.offsetParent === null) continue;
        if (/copy link to post/i.test(menu.textContent || "")) return menu;
      }
    } catch (e) {}
    return null;
  }

  function findCopyLinkMenuItem(menuRoot) {
    if (!menuRoot) return null;
    return (
      Array.prototype.find.call(
        menuRoot.querySelectorAll('[role="menuitem"], div[role="button"], li, button, div'),
        function (el) {
          if (el.getAttribute && el.getAttribute("data-cc-send-tracker")) {
            return false;
          }
          const t = (el.textContent || "").replace(/\s+/g, " ").trim();
          return /^copy link to post$/i.test(t) || /copy link to post/i.test(t) && t.length < 40;
        }
      ) || null
    );
  }

  function isLinkedInPostUrl(text) {
    const t = String(text || "").trim();
    if (!t) return false;
    if (/\/feed\/update\//i.test(t)) return true;
    if (/\/posts\/[^/?#]+-activity-\d+/i.test(t)) return true;
    if (/urn:li:(?:share|activity|ugcPost):\d+/i.test(t)) return true;
    return false;
  }

  function scrapeUrlFromLinkedInToast() {
    try {
      const roots = document.querySelectorAll(
        ".artdeco-toast-item, [data-test-artdeco-toast-item-type], .artdeco-toasts"
      );
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i];
        if (!/link copied|view post/i.test(root.textContent || "")) continue;
        const links = root.querySelectorAll("a[href]");
        for (let j = 0; j < links.length; j++) {
          const href = links[j].href || "";
          if (isLinkedInPostUrl(href)) return cleanPostUrl(href);
        }
      }
      // Global fallback: any fresh "View post" control
      const view = Array.prototype.find.call(
        document.querySelectorAll("a[href], button"),
        function (el) {
          return /^view post$/i.test((el.textContent || "").trim());
        }
      );
      if (view && view.href && isLinkedInPostUrl(view.href)) {
        return cleanPostUrl(view.href);
      }
    } catch (e) {}
    return "";
  }

  function hideCopyToastsTemporarily(ms) {
    try {
      const id = "cc-hide-copy-toast";
      let style = document.getElementById(id);
      if (!style) {
        style = document.createElement("style");
        style.id = id;
        style.textContent =
          ".artdeco-toast-item:has(*), .artdeco-toasts { opacity:0 !important; pointer-events:none !important; }";
        (document.head || document.documentElement).appendChild(style);
      }
      setTimeout(function () {
        try {
          const s = document.getElementById(id);
          if (s) s.remove();
        } catch (e) {}
      }, ms || 2500);
    } catch (e) {}
  }

  /**
   * Trigger LinkedIn's "Copy link to post" and capture the JS clipboard / toast URL.
   */
  function triggerCopyLinkAndCapture(copyItem) {
    return new Promise(function (resolve) {
      if (!copyItem) {
        resolve("");
        return;
      }
      let settled = false;
      let origWriteText = null;
      let origWrite = null;
      let toastObs = null;
      const done = function (url, via) {
        if (settled) return;
        settled = true;
        try {
          document.removeEventListener("copy", onCopy, true);
        } catch (e) {}
        try {
          if (toastObs) toastObs.disconnect();
        } catch (e) {}
        try {
          if (origWriteText && navigator.clipboard) {
            navigator.clipboard.writeText = origWriteText;
          }
          if (origWrite && navigator.clipboard) {
            navigator.clipboard.write = origWrite;
          }
        } catch (e) {}
        const cleaned = url ? cleanPostUrl(url) : "";
        resolve(cleaned);
      };
      const onCopy = function (e) {
        try {
          const t =
            (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
          if (isLinkedInPostUrl(t)) done(t, "copy-event");
        } catch (err) {}
      };
      document.addEventListener("copy", onCopy, true);
      hideCopyToastsTemporarily(2800);
      try {
        toastObs = new MutationObserver(function () {
          const fromToast = scrapeUrlFromLinkedInToast();
          if (fromToast) done(fromToast, "toast");
        });
        toastObs.observe(document.body, { childList: true, subtree: true });
      } catch (e) {}
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          origWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
          navigator.clipboard.writeText = function (text) {
            if (isLinkedInPostUrl(text)) done(text, "writeText");
            return origWriteText(text);
          };
        }
        if (navigator.clipboard && navigator.clipboard.write) {
          origWrite = navigator.clipboard.write.bind(navigator.clipboard);
          navigator.clipboard.write = function (items) {
            try {
              Promise.resolve()
                .then(async function () {
                  for (let i = 0; i < (items || []).length; i++) {
                    const item = items[i];
                    if (!item || !item.types) continue;
                    if (item.types.indexOf("text/plain") < 0) continue;
                    const blob = await item.getType("text/plain");
                    const text = await blob.text();
                    if (isLinkedInPostUrl(text)) done(text, "clipboard.write");
                  }
                })
                .catch(function () {});
            } catch (e) {}
            return origWrite(items);
          };
        }
      } catch (e) {}
      try {
        // Prefer a real click sequence LinkedIn listens for
        copyItem.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
        );
        copyItem.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
        );
        copyItem.click();
      } catch (e) {
        done("", "click-fail");
        return;
      }
      // Poll toast + clipboard for up to ~1.2s
      let tries = 0;
      const poll = setInterval(function () {
        if (settled) {
          clearInterval(poll);
          return;
        }
        tries++;
        const fromToast = scrapeUrlFromLinkedInToast();
        if (fromToast) {
          clearInterval(poll);
          done(fromToast, "toast-poll");
          return;
        }
        if (tries >= 8) {
          clearInterval(poll);
          if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard
              .readText()
              .then(function (t) {
                if (isLinkedInPostUrl(t)) done(t, "readText");
                else done("", "timeout");
              })
              .catch(function () {
                done("", "timeout");
              });
          } else {
            done("", "timeout");
          }
        }
      }, 150);
    });
  }

  async function capturePostUrlFromOpenMenu(menuRoot) {
    if (!menuRoot) menuRoot = findOpenCopyMenu();
    if (!menuRoot) return "";
    let url = harvestPostUrlFromMenu(menuRoot) || "";
    if (url) return url;
    const copyItem = findCopyLinkMenuItem(menuRoot);
    url = await triggerCopyLinkAndCapture(copyItem);
    return url || "";
  }

  function findPostCardFromMenu(menuRoot) {
    try {
      // Prefer the post whose ⋯ button opened this menu
      const expanded = document.querySelector(
        'button[aria-expanded="true"][aria-label*="control menu" i], button[aria-expanded="true"][aria-label*="More actions" i], button[aria-expanded="true"][id*="feed-control"], button[aria-expanded="true"][aria-label*="More" i]'
      );
      if (expanded) {
        const posts = getPostNodes(document);
        for (let i = 0; i < posts.length; i++) {
          if (posts[i].contains(expanded)) return posts[i];
        }
        const viaClosest =
          expanded.closest(
            '[componentkey*="FeedType"], [role="article"], .feed-shared-update-v2, [class*="occludable-update"], [data-id*="activity"], [data-urn*="activity"], [data-urn*="share"]'
          ) || null;
        if (viaClosest) return viaClosest;
      }

      // Walk up from menu / popover to a feed card when possible
      let cur = menuRoot;
      for (let i = 0; i < 12 && cur; i++) {
        if (
          cur.getAttribute &&
          (/FeedType/i.test(cur.getAttribute("componentkey") || "") ||
            /FeedType/i.test(cur.id || "") ||
            /activity|share/i.test(cur.getAttribute("data-id") || "") ||
            /activity|share/i.test(cur.getAttribute("data-urn") || ""))
        ) {
          return cur;
        }
        cur = cur.parentElement;
      }
      // Fallback: nearest visible post card under the popover's Y position
      const posts = getPostNodes(document);
      if (!posts.length) return null;
      const rect = menuRoot.getBoundingClientRect
        ? menuRoot.getBoundingClientRect()
        : null;
      if (!rect) return posts[0];
      let best = null;
      let bestDist = Infinity;
      posts.forEach(function (p) {
        const r = p.getBoundingClientRect();
        const dist = Math.abs(r.top - rect.top);
        if (dist < bestDist) {
          bestDist = dist;
          best = p;
        }
      });
      return best;
    } catch (e) {
      return null;
    }
  }

  function harvestPostUrlFromMenu(menuRoot) {
    try {
      const embed = menuRoot.querySelector('a[href*="embed-modal"][href*="targetUrn"]');
      if (embed && embed.href) {
        const urn = shareOrActivityUrnFromText(embed.href);
        if (urn) return feedUpdateUrlFromUrn(urn);
      }
      const html = String(menuRoot.innerHTML || "");
      const urn = shareOrActivityUrnFromText(html);
      if (urn) return feedUpdateUrlFromUrn(urn);
    } catch (e) {}
    return "";
  }

  function setMenuItemLabel(item, label) {
    try {
      const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (/copy link to post/i.test(node.nodeValue || "")) {
          node.nodeValue = String(node.nodeValue || "").replace(
            /copy link to post/gi,
            label
          );
          return;
        }
      }
      const els = item.querySelectorAll("span, p, div");
      for (let i = 0; i < els.length; i++) {
        const t = (els[i].textContent || "").trim();
        if (/^copy link to post$/i.test(t)) {
          els[i].textContent = label;
          return;
        }
      }
    } catch (e) {}
  }

  async function sendPostCardToTracker(postEl, explicitUrl) {
    if (!postEl) return null;
    const settings = await getSettings();
    let url = explicitUrl || extractPostUrl(postEl) || "";
    if (url) {
      try {
        postEl.setAttribute("data-cc-post-url", url);
      } catch (e) {}
    }
    const snippet = extractSnippet(postEl);
    const author = extractAuthor(postEl);
    const ref = scanDomForPostRef(postEl);
    if (!url && ref && ref.urn) url = feedUpdateUrlFromUrn(ref.urn);
    let stableId = "";
    if (ref && ref.urn) {
      stableId =
        "feed:" +
        String(ref.urn).replace(/^urn:li:/i, "").replace(/:/g, "-");
    } else {
      const fromUrl = shareOrActivityUrnFromText(url);
      if (fromUrl) {
        stableId =
          "feed:" +
          String(fromUrl).replace(/^urn:li:/i, "").replace(/:/g, "-");
      } else {
        stableId =
          "feed:" + simpleHash(url || snippet || String(Date.now()));
      }
    }
    let title = deriveTitle(snippet, author) || "Hiring post from feed";
    if (isMenuJunkText(title)) {
      title = author
        ? String(author).slice(0, 60) + " — hiring post"
        : "Hiring post from feed";
    }
    try {
      delete seenKeys[stableId];
    } catch (e) {}
    const row = await upsertFeedItem({
      kind: "organic",
      id: stableId,
      title: title,
      company: author || "",
      url: url,
      feedPostUrl: url,
      feedAuthor: author,
      feedSnippet: snippet.slice(0, 280),
      feedMatchKeywords: (settings.keywords || []).filter(function (k) {
        return (
          String(snippet || "")
            .toLowerCase()
            .indexOf(k) >= 0
        );
      }),
      parentFeedKey: stableId,
      at: now(),
    });
    return row;
  }

  function injectTrackerMenuItem(menuRoot) {
    if (!menuRoot || menuRoot.querySelector("[data-cc-send-tracker]")) return;
    const copyItem = findCopyLinkMenuItem(menuRoot);
    if (!copyItem) return;

    // Harvest embed URN silently (no toast). Cache on card + upgrade empty tracker rows.
    const harvested = harvestPostUrlFromMenu(menuRoot);
    const postEl = findPostCardFromMenu(menuRoot);
    if (harvested && postEl) {
      try {
        postEl.setAttribute("data-cc-post-url", harvested);
      } catch (e) {}
      maybeUpgradeStoredUrl(postEl, harvested).catch(function () {});
    }

    // Fresh menuitem — do NOT clone Copy link (LinkedIn event delegation treats clone as Copy)
    const item = document.createElement("div");
    item.setAttribute("role", "menuitem");
    item.setAttribute("tabindex", "-1");
    item.setAttribute("data-cc-send-tracker", "1");
    item.className = copyItem.className || "";
    item.style.cssText =
      "display:flex;align-items:center;gap:12px;padding:8px 12px;cursor:pointer;" +
      "font-size:14px;line-height:1.4;color:inherit;box-sizing:border-box;";
    item.innerHTML =
      '<span aria-hidden="true" style="width:24px;text-align:center;flex:0 0 24px;">＋</span>' +
      '<span data-cc-send-label>Send to Job Tracker</span>';
    item.addEventListener("mouseenter", function () {
      item.style.backgroundColor = "rgba(0,0,0,0.08)";
    });
    item.addEventListener("mouseleave", function () {
      item.style.backgroundColor = "transparent";
    });

    let sending = false;
    item.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (sending) return;
        sending = true;
        const label = item.querySelector("[data-cc-send-label]");
        if (label) label.textContent = "Saving…";
        (async function () {
          let url = harvested || harvestPostUrlFromMenu(menuRoot) || "";
          // Silent Copy link only when embed URN is missing
          if (!url) {
            const copyEl = findCopyLinkMenuItem(menuRoot);
            if (copyEl) url = await triggerCopyLinkAndCapture(copyEl);
          }
          if (!url) url = await capturePostUrlFromOpenMenu(menuRoot);
          const card = postEl || findPostCardFromMenu(menuRoot);
          if (!card) {
            if (label) label.textContent = "Could not save";
            sending = false;
            return;
          }
          const row = await sendPostCardToTracker(card, url);
          if (label) {
            label.textContent = row ? "Saved to Job Tracker" : "Could not save";
          }
          setTimeout(function () {
            if (label) label.textContent = "Send to Job Tracker";
            sending = false;
          }, 1600);
        })().catch(function () {
          if (label) label.textContent = "Could not save";
          sending = false;
        });
      },
      true
    );

    if (copyItem.parentNode) {
      if (copyItem.nextSibling) {
        copyItem.parentNode.insertBefore(item, copyItem.nextSibling);
      } else {
        copyItem.parentNode.appendChild(item);
      }
    }
  }

  function scanOpenFeedMenus() {
    try {
      document.querySelectorAll('[role="menu"]').forEach(function (menu) {
        if (/copy link to post/i.test(menu.textContent || "")) {
          injectTrackerMenuItem(menu);
        }
      });
    } catch (e) {}
  }

  async function maybeUpgradeStoredUrl(postEl, harvested) {
    if (!harvested || !postEl || typeof JobTrackerStore === "undefined") return;
    try {
      const snippet = extractSnippet(postEl);
      const author = extractAuthor(postEl);
      const ref = scanDomForPostRef(postEl);
      const id =
        ref && ref.urn
          ? "feed:" +
            String(ref.urn).replace(/^urn:li:/i, "").replace(/:/g, "-")
          : null;
      let existing = null;
      if (id && JobTrackerStore.getJobsByIds) {
        const found = await JobTrackerStore.getJobsByIds([id]);
        existing = found && found[0] ? found[0] : null;
      }
      const rows =
        typeof JobTrackerStore.listJobs === "function"
          ? await JobTrackerStore.listJobs({ status: "all", q: "" })
          : [];

      // Repair polluted menu-title rows that already have this URL
      for (let i = 0; i < (rows || []).length; i++) {
        const r = rows[i];
        if (!r || r.source !== "feed") continue;
        if (
          isMenuJunkText(r.title) &&
          (r.feedPostUrl === harvested ||
            r.url === harvested ||
            (id && r.id === id))
        ) {
          const fixedTitle = deriveTitle(snippet, author);
          await JobTrackerStore.safeUpsert({
            id: r.id,
            title: isMenuJunkText(fixedTitle)
              ? author
                ? String(author).slice(0, 60) + " — hiring post"
                : "Hiring post from feed"
              : fixedTitle,
            feedPostUrl: harvested,
            url: harvested,
            feedAuthor: author || r.feedAuthor,
            feedSnippet: snippet.slice(0, 280) || r.feedSnippet,
            touchViewed: false,
          });
        }
      }

      if (!existing) {
        const title = deriveTitle(snippet, author);
        const match = (rows || []).find(function (r) {
          if (!r || r.source !== "feed") return false;
          if (
            r.feedPostUrl &&
            !JobTrackerStore.isUnusableTrackerUrl(r.feedPostUrl)
          ) {
            return false;
          }
          const sameAuthor =
            author &&
            String(r.company || r.feedAuthor || "")
              .toLowerCase()
              .indexOf(String(author).toLowerCase().slice(0, 24)) >= 0;
          const sameTitle =
            title &&
            String(r.title || "")
              .toLowerCase()
              .indexOf(String(title).toLowerCase().slice(0, 20)) >= 0;
          return sameAuthor || sameTitle;
        });
        if (!match) return;
        if (match.feedPostUrl === harvested || match.url === harvested) return;
        await JobTrackerStore.safeUpsert({
          id: match.id,
          feedPostUrl: harvested,
          url: harvested,
          touchViewed: false,
        });
        return;
      }
      if (
        existing.feedPostUrl === harvested ||
        existing.url === harvested ||
        (existing.feedPostUrl &&
          !JobTrackerStore.isUnusableTrackerUrl(existing.feedPostUrl) &&
          !isMenuJunkText(existing.title))
      ) {
        return;
      }
      await JobTrackerStore.safeUpsert({
        id: existing.id,
        feedPostUrl: harvested,
        url: harvested,
        title: isMenuJunkText(existing.title)
          ? deriveTitle(snippet, author)
          : undefined,
        touchViewed: false,
      });
    } catch (e) {}
  }

  function significantTokens(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(function (w) {
        return (
          w.length > 3 &&
          !/^(with|from|that|this|have|your|looking|hiring|remote|detail|oriented)$/.test(
            w
          )
        );
      })
      .slice(0, 6);
  }

  function findLiveCardForJob(jobId, titleHint, authorHint) {
    try {
      const posts = getPostNodes(document);
      const hint = String(titleHint || "").toLowerCase();
      const author = String(authorHint || "").toLowerCase().slice(0, 28);
      const id = String(jobId || "");
      const tokens = significantTokens(hint);
      let best = null;
      let bestScore = 0;
      for (let i = 0; i < posts.length; i++) {
        const el = posts[i];
        const cached = el.getAttribute && el.getAttribute("data-cc-post-url");
        if (cached && isSpecificPostPermalink(cached)) {
          const ref = scanDomForPostRef(el);
          if (ref && ref.urn) {
            const expect =
              "feed:" +
              String(ref.urn).replace(/^urn:li:/i, "").replace(/:/g, "-");
            if (expect === id) return el;
          }
        }
        const sn = extractSnippet(el).toLowerCase();
        const elAuthor = String(extractAuthor(el) || "").toLowerCase();
        const title = deriveTitle(sn, elAuthor).toLowerCase();
        let score = 0;
        if (hint && (title.indexOf(hint.slice(0, 24)) >= 0 || sn.indexOf(hint.slice(0, 24)) >= 0)) {
          score += 5;
        }
        for (let t = 0; t < tokens.length; t++) {
          if (sn.indexOf(tokens[t]) >= 0 || title.indexOf(tokens[t]) >= 0) {
            score += 1;
          }
        }
        if (author && elAuthor.indexOf(author.slice(0, 16)) >= 0) score += 3;
        if (score > bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best && bestScore >= 5) return best;
      return null;
    } catch (e) {
      return null;
    }
  }

  function findControlMenuButton(card) {
    if (!card) return null;
    const sels = [
      'button[aria-label*="Open control menu" i]',
      'button[aria-label*="More actions" i]',
      'button[id*="feed-control"]',
      'button[aria-label*="control menu" i]',
      'button[aria-label*="More" i]',
    ];
    for (let i = 0; i < sels.length; i++) {
      try {
        const b = card.querySelector(sels[i]);
        if (b) return b;
      } catch (e) {}
    }
    // Fallback: rightmost header-ish button in the card
    try {
      const buttons = card.querySelectorAll("button");
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        const al = (b.getAttribute("aria-label") || "").toLowerCase();
        if (/more|menu|control|options|overflow/.test(al)) return b;
      }
    } catch (e) {}
    return null;
  }

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function dismissOpenMenus() {
    try {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
        })
      );
    } catch (e) {}
  }

  async function waitForCopyMenu(timeoutMs) {
    const end = Date.now() + (timeoutMs || 1600);
    while (Date.now() < end) {
      const menu = findOpenCopyMenu();
      if (menu) return menu;
      await waitMs(100);
    }
    return null;
  }

  async function silentlyHarvestFromCard(card) {
    if (!card) return "";
    let url = extractPostUrl(card) || "";
    if (url) return url;

    // If a ⋯ menu is already open, use it (common when user just opened menu)
    const already = findOpenCopyMenu();
    if (already) {
      url = await capturePostUrlFromOpenMenu(already);
      if (url) {
        try {
          card.setAttribute("data-cc-post-url", url);
        } catch (e) {}
        return url;
      }
    }

    const btn = findControlMenuButton(card);
    if (!btn) {
      return "";
    }
    try {
      btn.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
      );
      btn.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
      );
      btn.click();
      const menu = await waitForCopyMenu(1800);
      if (!menu) {
        dismissOpenMenus();
        return "";
      }
      // Prefer embed URN (no toast). Fall back to silent Copy link click.
      url = harvestPostUrlFromMenu(menu) || "";
      if (!url) {
        url = await triggerCopyLinkAndCapture(findCopyLinkMenuItem(menu));
      } else {
        dismissOpenMenus();
      }
      if (url) {
        try {
          card.setAttribute("data-cc-post-url", url);
        } catch (e) {}
      }
    } catch (e) {
      dismissOpenMenus();
    }
    return url || "";
  }

  function urlFromFeedJobId(id) {
    const s = String(id || "");
    let m = s.match(/^feed:(share|activity|ugcPost)-(\d+)$/i);
    if (m) {
      return feedUpdateUrlFromUrn("urn:li:" + m[1].toLowerCase() + ":" + m[2]);
    }
    m = s.match(/^feed:(urn:li:(?:share|activity|ugcPost):\d+)$/i);
    if (m) return feedUpdateUrlFromUrn(m[1]);
    return "";
  }

  /**
   * Resolve a real LinkedIn post URL for a feed tracker row.
   * Prefer stored URL → id reconstruction → live card → ⋯ / Copy link harvest.
   */
  async function resolvePostUrlForJob(jobId, titleHint) {
    const id = String(jobId || "");
    let url = urlFromFeedJobId(id);
    let job = null;
    try {
      if (typeof JobTrackerStore !== "undefined" && JobTrackerStore.getJobsByIds) {
        const found = await JobTrackerStore.getJobsByIds([id]);
        job = found && found[0] ? found[0] : null;
        if (job) {
          const resolved =
            typeof JobTrackerStore.resolveJobOpenUrl === "function"
              ? JobTrackerStore.resolveJobOpenUrl(job)
              : job.feedPostUrl || job.url || "";
          if (resolved && !isBadPostUrl(resolved)) url = resolved;
        }
      }
    } catch (e) {}
    if (url && !isBadPostUrl(url)) {
      return cleanPostUrl(url);
    }

    // If user already has ⋯ open, capture from that menu (embed or Copy link)
    const openMenu = findOpenCopyMenu();
    if (openMenu) {
      url = await capturePostUrlFromOpenMenu(openMenu);
      if (url) {
        try {
          if (typeof JobTrackerStore !== "undefined" && JobTrackerStore.safeUpsert) {
            await JobTrackerStore.safeUpsert({
              id: id,
              feedPostUrl: url,
              url: url,
              touchViewed: false,
            });
          }
        } catch (e) {}
        const cardFromMenu = findPostCardFromMenu(openMenu);
        if (cardFromMenu) {
          maybeUpgradeStoredUrl(cardFromMenu, url).catch(function () {});
        }
        return cleanPostUrl(url);
      }
    }

    const hint =
      titleHint ||
      (job && job.title) ||
      (job && job.feedSnippet) ||
      "";
    const authorHint =
      (job && (job.feedAuthor || job.company)) || "";
    const card = findLiveCardForJob(id, hint, authorHint);
    if (card) {
      try {
        card.scrollIntoView({ block: "center", behavior: "smooth" });
        await waitMs(250);
      } catch (e) {}
      url = extractPostUrl(card) || "";
      if (!url) url = await silentlyHarvestFromCard(card);
      if (url) {
        try {
          if (typeof JobTrackerStore !== "undefined" && JobTrackerStore.safeUpsert) {
            await JobTrackerStore.safeUpsert({
              id: id,
              feedPostUrl: url,
              url: url,
              touchViewed: false,
            });
          }
        } catch (e) {}
        maybeUpgradeStoredUrl(card, url).catch(function () {});
        return cleanPostUrl(url);
      }
    }
    return "";
  }

  let menuObserver = null;
  let menuScanTimer = null;
  function startMenuHook() {
    if (menuObserver) return;
    try {
      menuObserver = new MutationObserver(function () {
        if (menuScanTimer) return;
        menuScanTimer = setTimeout(function () {
          menuScanTimer = null;
          scanOpenFeedMenus();
        }, 180);
      });
      menuObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
      });
      scanOpenFeedMenus();
    } catch (e) {}
  }

  function start() {
    if (started) return;
    started = true;
    sessionCount = 0;
    seenKeys = {};
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        if (
          changes.feature_flags ||
          changes[SETTINGS_KEY]
        ) {
          syncRunning().catch(function () {});
        }
      });
    } catch (e) {}
    try {
      let last = location.pathname;
      pathWatcher = setInterval(function () {
        if (location.pathname !== last) {
          last = location.pathname;
          sessionCount = 0;
          seenKeys = {};
          syncRunning().catch(function () {});
        }
      }, 1200);
    } catch (e) {}
    startMenuHook();
    syncRunning().catch(function () {});
  }

  global.FeedJobDiscover = {
    SETTINGS_KEY: SETTINGS_KEY,
    CANDIDATES_KEY: CANDIDATES_KEY,
    DISMISS_KEY: DISMISS_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    getSettings: getSettings,
    setSettings: setSettings,
    parseKeywords: parseKeywords,
    classifyPost: classifyPost,
    splitJobList: splitJobList,
    scanDocument: scanDocument,
    listCandidates: listCandidates,
    dismissCandidate: dismissCandidate,
    acceptCandidate: acceptCandidate,
    clearCandidates: clearCandidates,
    runScan: runScan,
    start: start,
    isDiscoverEnabled: isDiscoverEnabled,
    sendPostCardToTracker: sendPostCardToTracker,
    resolvePostUrlForJob: resolvePostUrlForJob,
    urlFromFeedJobId: urlFromFeedJobId,
  };

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        start();
      });
    } else {
      start();
    }
  } catch (e) {
    try {
      start();
    } catch (e2) {}
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
