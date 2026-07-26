/**
 * CareerCraft aside widgets — LinkedIn right-rail cards (flag-gated, soft-fail).
 * Job alerts card + Favorite authors. Does not modify LinkedIn nodes except insertBefore our host.
 */
(function (global) {
  const HOST_ID = "cc-aside-widgets";
  const SETTINGS_KEY = "aside_widget_settings";
  const ALERTS_KEY = "recent_job_alerts";
  const AUTHOR_POSTS_KEY = "casper_author_posts";
  const DISMISSED_KEY = "casper_author_posts_dismissed";
  const JOB_DISMISSED_KEY = "casper_job_rail_dismissed";
  const DEBUG_KEY = "aside_widgets_debug";

  const DEFAULT_SETTINGS = {
    authors: [],
    postsPerAuthor: 2,
    authorRefreshMinutes: 60,
    authorPostsFilter: "original",
    jobAlertsLimit: 5,
    jobAlertsTtlDays: 7,
    fillFromTracker: true,
  };

  const APPLIED_LIKE = {
    applied: true,
    interview: true,
    confirmed: true,
    rejected: true,
    archived: true,
    expired: true,
  };

  let started = false;
  let remountTimer = null;
  let unwatchAside = null;
  let pathWatcher = null;
  let storageListener = null;
  let extractListenerBound = false;
  let confirmUiOpen = false;
  let lastAutoAuthorAttemptAt = 0;
  let lastRenderFp = "";
  let stickyJobIds = null;

  function dbg() {
    try {
      if (!global.__ccAsideDebugOn) return;
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[CC Aside]");
      console.log.apply(console, args);
    } catch (e) {}
  }

  async function refreshDebugFlag() {
    try {
      const r = await chrome.storage.local.get([DEBUG_KEY]);
      global.__ccAsideDebugOn = r[DEBUG_KEY] === true;
    } catch (e) {
      global.__ccAsideDebugOn = false;
    }
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text == null ? "" : String(text);
    return d.innerHTML;
  }

  function isFeedContext() {
    try {
      const path = (location.pathname || "").toLowerCase();
      if (path === "/feed" || path.indexOf("/feed/") === 0) return true;
      if (typeof LinkedInDOM !== "undefined" && LinkedInDOM.getAside()) {
        return path === "/" || path.indexOf("/feed") === 0;
      }
    } catch (e) {}
    return false;
  }

  function removeHost() {
    try {
      document.querySelectorAll("#" + HOST_ID).forEach(function (el) {
        el.remove();
      });
      dbg("unmount");
    } catch (e) {}
  }

  function assertSingleHost() {
    try {
      const n = document.querySelectorAll("#" + HOST_ID).length;
      if (n > 1) {
        dbg("assert fail: duplicate hosts", n);
        const all = document.querySelectorAll("#" + HOST_ID);
        for (let i = 1; i < all.length; i++) all[i].remove();
      }
      return n <= 1;
    } catch (e) {
      return true;
    }
  }

  async function loadSettings() {
    try {
      const r = await chrome.storage.local.get([SETTINGS_KEY]);
      return Object.assign({}, DEFAULT_SETTINGS, r[SETTINGS_KEY] || {});
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function normalizeProfileUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    let u = s;
    if (u.indexOf("http") !== 0) {
      u = "https://www.linkedin.com/" + u.replace(/^\/+/, "");
    }
    try {
      const url = new URL(u);
      if (!String(url.hostname || "").toLowerCase().includes("linkedin.com")) {
        return null;
      }
      const m = url.pathname.match(/\/in\/([^/?#]+)/i);
      if (!m) return null;
      const handle = decodeURIComponent(m[1]).replace(/\/$/, "");
      return {
        url: "https://www.linkedin.com/in/" + handle + "/",
        handle: handle.toLowerCase(),
        id: handle.toLowerCase(),
      };
    } catch (e) {
      return null;
    }
  }

  function profileKeyFromLocation() {
    try {
      const m = (location.pathname || "").match(/\/in\/([^/?#]+)/i);
      if (!m) return null;
      return decodeURIComponent(m[1]).replace(/\/$/, "").toLowerCase();
    } catch (e) {
      return null;
    }
  }

  function pruneAlerts(list, ttlDays) {
    const ttlMs = Math.max(1, Number(ttlDays) || 7) * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const seen = {};
    const out = [];
    (list || []).forEach(function (item) {
      if (!item) return;
      const at = Number(item.at) || 0;
      if (at && now - at > ttlMs) return;
      const key = String(item.id || item.url || "");
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(item);
    });
    return out.slice(0, 20);
  }

  async function loadJobDismissedMap() {
    try {
      const r = await chrome.storage.local.get([JOB_DISMISSED_KEY]);
      const map = r[JOB_DISMISSED_KEY] || {};
      return typeof map === "object" && map ? map : {};
    } catch (e) {
      return {};
    }
  }

  async function pruneAndSaveJobDismissed(map) {
    const next = {};
    const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    Object.keys(map || {}).forEach(function (id) {
      const row = map[id];
      const at = row && row.at ? Number(row.at) : 0;
      if (at >= cutoff) next[id] = row;
    });
    await chrome.storage.local.set({ [JOB_DISMISSED_KEY]: next });
    return next;
  }

  async function dismissJob(jobId) {
    if (!jobId) return;
    const map = await loadJobDismissedMap();
    map[String(jobId)] = { at: Date.now() };
    await pruneAndSaveJobDismissed(map);
  }

  function normalizeJobId(raw, url) {
    let id = String(raw || "").trim();
    if (!id && url) {
      const m = String(url).match(/\/jobs\/view\/(\d+)/i);
      if (m) id = m[1];
    }
    if (!id) return "";
    const urn = id.match(/(?:jobPosting|job)[:\-](\d+)/i) || id.match(/(\d{8,})/);
    return urn ? urn[1] : id;
  }

  function findTrackerRow(trackerMap, item) {
    if (!trackerMap || !item) return null;
    const id = normalizeJobId(item.id, item.url);
    if (id && trackerMap[id]) return trackerMap[id];
    if (item.id != null && trackerMap[String(item.id)]) {
      return trackerMap[String(item.id)];
    }
    if (!id) return null;
    const keys = Object.keys(trackerMap);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const row = trackerMap[k];
      if (!row) continue;
      if (normalizeJobId(row.id, row.url) === id) return row;
      if (row.url && String(row.url).indexOf(id) >= 0) return row;
    }
    return null;
  }

  function readAtsScore(row) {
    if (!row) return null;
    if (row.atsScore != null && row.atsScore !== "") {
      const n = Number(row.atsScore);
      if (!isNaN(n)) return n;
    }
    if (row.atsDetails && row.atsDetails.overallScore != null) {
      const n = Number(row.atsDetails.overallScore);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  function readApplicantCount(row) {
    if (!row) return null;
    if (row.applicantCount == null || row.applicantCount === "") return null;
    const n = Number(row.applicantCount);
    return isNaN(n) ? null : n;
  }

  function isReviewableJob(job) {
    if (!job) return false;
    const st = String(job.status || "").toLowerCase();
    if (APPLIED_LIKE[st]) return false;
    return true;
  }

  function enrichJobFromTracker(item, trackerMap) {
    if (!item) return item;
    const row = findTrackerRow(trackerMap, item);
    if (!row) {
      return Object.assign({}, item, {
        atsScore: readAtsScore(item),
        applicantCount: readApplicantCount(item),
      });
    }
    return Object.assign({}, item, {
      id: normalizeJobId(item.id || row.id, item.url || row.url) || item.id,
      title: item.title || row.title || "Job",
      company: item.company || row.company || "",
      location: item.location || row.location || "",
      url: item.url || row.url || "",
      atsScore:
        readAtsScore(item) != null ? readAtsScore(item) : readAtsScore(row),
      applicantCount:
        readApplicantCount(item) != null
          ? readApplicantCount(item)
          : readApplicantCount(row),
      status: item.status || row.status || "",
      starred:
        !!item.starred ||
        !!row.starred ||
        !!(row.starRating && row.starRating > 0),
      searchName: item.searchName || row.searchName || "",
    });
  }

  async function loadAlertItems(settings) {
    const limit = [3, 5, 10].indexOf(settings.jobAlertsLimit) >= 0
      ? settings.jobAlertsLimit
      : 5;
    const ttl = [3, 7, 14].indexOf(settings.jobAlertsTtlDays) >= 0
      ? settings.jobAlertsTtlDays
      : 7;
    const poolCap = Math.min(20, Math.max(limit * 3, limit + 5));

    let alerts = [];
    let trackerMap = {};
    try {
      const r = await chrome.storage.local.get([ALERTS_KEY, "casper_job_tracker"]);
      trackerMap = r.casper_job_tracker || {};
      alerts = pruneAlerts(r[ALERTS_KEY] || [], ttl);

      if (alerts.length < poolCap) {
        const rows = Object.keys(trackerMap).map(function (k) {
          return trackerMap[k];
        });
        rows
          .filter(function (j) {
            if (!j || !j.id) return false;
            if (!isReviewableJob(j)) return false;
            const sources = j.sources || [];
            const hasAlert =
              (Array.isArray(sources) && sources.indexOf("alert") >= 0) ||
              j.source === "alert";
            return hasAlert;
          })
          .sort(function (a, b) {
            return (b.updatedAt || b.viewedAt || 0) - (a.updatedAt || a.viewedAt || 0);
          })
          .forEach(function (j) {
            if (alerts.length >= poolCap) return;
            const key = String(j.id);
            if (
              alerts.some(function (x) {
                return String(x.id || x.url) === key;
              })
            )
              return;
            alerts.push({
              id: j.id,
              title: j.title || "Job",
              company: j.company || "",
              location: j.location || "",
              url: j.url || "https://www.linkedin.com/jobs/view/" + j.id,
              searchName: j.searchName || "",
              at: j.updatedAt || j.viewedAt || Date.now(),
              kind: "alert",
              atsScore: readAtsScore(j),
              applicantCount: readApplicantCount(j),
              status: j.status || "",
              starred: !!j.starred || !!(j.starRating && j.starRating > 0),
            });
          });
      }

      // Surface reviewable tracker jobs that already have ATS / applicants
      const usedIds = {};
      alerts.forEach(function (a) {
        usedIds[normalizeJobId(a.id, a.url) || String(a.id || a.url)] = true;
      });
      Object.keys(trackerMap)
        .map(function (k) {
          return trackerMap[k];
        })
        .filter(function (j) {
          if (!j || !j.id || !isReviewableJob(j)) return false;
          const ats = readAtsScore(j);
          const apps = readApplicantCount(j);
          return ats != null || apps != null;
        })
        .sort(function (a, b) {
          const sa = readAtsScore(a) != null ? 1 : 0;
          const sb = readAtsScore(b) != null ? 1 : 0;
          if (sb !== sa) return sb - sa;
          return (b.updatedAt || b.viewedAt || 0) - (a.updatedAt || a.viewedAt || 0);
        })
        .forEach(function (j) {
          if (alerts.length >= poolCap) return;
          const key = normalizeJobId(j.id, j.url) || String(j.id);
          if (usedIds[key]) return;
          usedIds[key] = true;
          alerts.push({
            id: j.id,
            title: j.title || "Job",
            company: j.company || "",
            location: j.location || "",
            url: j.url || "https://www.linkedin.com/jobs/view/" + j.id,
            searchName: j.searchName || "",
            at: j.updatedAt || j.viewedAt || Date.now(),
            kind: "ats",
            atsScore: readAtsScore(j),
            applicantCount: readApplicantCount(j),
            status: j.status || "",
            starred: !!j.starred || !!(j.starRating && j.starRating > 0),
          });
        });
    } catch (e) {
      dbg("loadAlertItems error", e);
    }

    alerts = pruneAlerts(alerts, ttl).slice(0, poolCap);

    const fill = settings.fillFromTracker !== false;
    if (fill && alerts.length < poolCap) {
      try {
        if (!Object.keys(trackerMap).length) {
          const r = await chrome.storage.local.get(["casper_job_tracker"]);
          trackerMap = r.casper_job_tracker || {};
        }
        const rows = Object.keys(trackerMap).map(function (k) {
          return trackerMap[k];
        });
        const used = {};
        alerts.forEach(function (a) {
          used[String(a.id || a.url)] = true;
        });

        function pushRow(j, kind) {
          if (alerts.length >= poolCap || !j || !j.id) return;
          const key = String(j.id);
          if (used[key]) return;
          used[key] = true;
          alerts.push({
            id: j.id,
            title: j.title || "Job",
            company: j.company || "",
            location: j.location || "",
            url: j.url || "https://www.linkedin.com/jobs/view/" + j.id,
            at: j.updatedAt || j.viewedAt || 0,
            kind: kind,
            atsScore: readAtsScore(j),
            applicantCount: readApplicantCount(j),
            status: j.status || "",
            starred: !!j.starred || !!(j.starRating && j.starRating > 0),
            searchName: j.searchName || "",
          });
        }

        const favs = rows
          .filter(function (j) {
            if (!j) return false;
            const starred = !!j.starred || (j.starRating && j.starRating > 0);
            if (!starred) return false;
            return !APPLIED_LIKE[j.status];
          })
          .sort(function (a, b) {
            return (b.updatedAt || 0) - (a.updatedAt || 0);
          });
        favs.forEach(function (j) {
          pushRow(j, "favorite");
        });

        if (alerts.length < poolCap) {
          const recent = rows
            .filter(function (j) {
              return j && j.id && !APPLIED_LIKE[j.status];
            })
            .sort(function (a, b) {
              return (
                (b.viewedAt || b.updatedAt || 0) -
                (a.viewedAt || a.updatedAt || 0)
              );
            });
          recent.forEach(function (j) {
            pushRow(j, "recent");
          });
        }
      } catch (e) {
        dbg("tracker fill error", e);
      }
    }

    const dismissed = await loadJobDismissedMap();
    let hiddenByDismiss = 0;
    let skippedApplied = 0;
    const visible = [];
    let matchedTracker = 0;
    let withAts = 0;
    let withApplicants = 0;
    let trackerAtsTotal = 0;
    let trackerReviewableAts = 0;
    try {
      Object.keys(trackerMap).forEach(function (k) {
        const row = trackerMap[k];
        if (!row) return;
        if (readAtsScore(row) != null) {
          trackerAtsTotal++;
          if (isReviewableJob(row)) trackerReviewableAts++;
        }
      });
    } catch (e) {}

    alerts.forEach(function (raw) {
      const item = enrichJobFromTracker(raw, trackerMap);
      if (!isReviewableJob(item)) {
        skippedApplied++;
        return;
      }
      const key = String(
        normalizeJobId(item.id, item.url) || item.id || item.url || ""
      );
      if (key && dismissed[key]) {
        hiddenByDismiss++;
        return;
      }
      if (findTrackerRow(trackerMap, raw)) matchedTracker++;
      if (item.atsScore != null) withAts++;
      if (item.applicantCount != null) withApplicants++;
      visible.push(item);
    });

    // Prefer roles that already have ATS / applicants so meta isn't buried past the limit
    function hasJobMeta(it) {
      return it.atsScore != null || it.applicantCount != null;
    }
    const preferred = [];
    const rest = [];
    visible.forEach(function (it) {
      if (hasJobMeta(it)) preferred.push(it);
      else rest.push(it);
    });
    const ranked = preferred.concat(rest);
    const byId = {};
    ranked.forEach(function (it) {
      const id = String(
        normalizeJobId(it.id, it.url) || it.id || it.url || ""
      );
      if (id && !byId[id]) byId[id] = it;
    });

    // Keep the shortlist stable across remounts so jobs don't appear to reshuffle
    let items = [];
    if (Array.isArray(stickyJobIds) && stickyJobIds.length) {
      stickyJobIds.forEach(function (id) {
        if (items.length >= limit) return;
        if (byId[id]) {
          items.push(byId[id]);
          delete byId[id];
        }
      });
    }
    ranked.forEach(function (it) {
      if (items.length >= limit) return;
      const id = String(
        normalizeJobId(it.id, it.url) || it.id || it.url || ""
      );
      if (!id || !byId[id]) return;
      items.push(byId[id]);
      delete byId[id];
    });
    stickyJobIds = items.map(function (it) {
      return String(normalizeJobId(it.id, it.url) || it.id || it.url || "");
    });

    return {
      items: items,
      limit: limit,
      hiddenByDismiss: hiddenByDismiss,
      poolCount: alerts.length,
      caughtUp: alerts.length > 0 && items.length === 0,
    };
  }

  function statusShort(status) {
    const s = String(status || "").toLowerCase();
    const map = {
      new: "New",
      viewed: "Viewed",
      applied: "Applied",
      interview: "Interview",
      confirmed: "Confirmed",
      rejected: "Rejected",
      expired: "Expired",
      archived: "Archived",
    };
    return map[s] || "";
  }

  function formatApplicants(n) {
    const num = Number(n);
    if (num !== num) return "";
    if (num >= 1000) {
      const k = Math.round(num / 100) / 10;
      return k + "k applicants";
    }
    return num + (num === 1 ? " applicant" : " applicants");
  }

  function jobMetaLine(it) {
    const bits = [];
    if (it.atsScore != null && it.atsScore !== "" && !isNaN(Number(it.atsScore))) {
      bits.push("ATS " + Math.round(Number(it.atsScore)));
    }
    if (it.applicantCount != null && it.applicantCount !== "") {
      const a = formatApplicants(it.applicantCount);
      if (a) bits.push(a);
    }
    const st = statusShort(it.status);
    if (st && st !== "New") bits.push(st);
    if (it.starred) bits.push("★ Saved");
    if (it.location) {
      const loc = String(it.location)
        .split(/[·•|]/)[0]
        .trim()
        .slice(0, 36);
      if (loc && !/applicant/i.test(loc)) bits.push(loc);
    }
    return bits.join(" · ");
  }

  function kindLabel(kind) {
    if (kind === "favorite") return "Favorites to apply";
    if (kind === "recent") return "Recently viewed";
    if (kind === "ats") return "ATS checked";
    return "From your alerts";
  }

  function buildJobsCardHtml(data, notifEnabled) {
    const items = (data && data.items) || [];
    let body = "";
    if (!items.length && data && data.caughtUp) {
      body =
        '<div class="cc-li-rail-empty-block">' +
        '<p class="cc-li-rail-empty-title">You&rsquo;re caught up on jobs</p>' +
        '<p class="cc-li-rail-empty">No more roles in this shortlist. Run a CareerCraft search, check for new alerts, or open your tracker board.</p>' +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="searches">Search with CareerCraft</a>' +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="job-tracker">Open Job Tracker</a>' +
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-jobs>Check for new jobs</button>' +
        "</div>";
    } else if (!items.length) {
      body =
        '<div class="cc-li-rail-empty-block">' +
        '<p class="cc-li-rail-empty-title">No jobs to review yet</p>' +
        '<p class="cc-li-rail-empty">Add saved searches for alerts, or browse roles so Job Tracker can fill this rail.</p>' +
        (notifEnabled === false
          ? '<a class="cc-li-rail-link" href="#" data-cc-open-options="searches">Turn on job alerts</a>'
          : '<a class="cc-li-rail-link" href="#" data-cc-open-options="searches">Manage searches &amp; alerts</a>') +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="job-tracker">Open Job Tracker</a>' +
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-jobs>Check for new jobs</button>' +
        "</div>";
    } else {
      let lastKind = null;
      items.forEach(function (it) {
        const k = it.kind || "alert";
        if (k !== lastKind) {
          body +=
            '<div class="cc-li-rail-section">' +
            escapeHtml(kindLabel(k)) +
            "</div>";
          lastKind = k;
        }
        const company = it.company
          ? escapeHtml(it.company)
          : it.searchName
            ? escapeHtml(it.searchName)
            : "";
        const meta = jobMetaLine(it);
        const jobKey = String(
          normalizeJobId(it.id, it.url) || it.id || it.url || ""
        );
        const trackerHash =
          "job-tracker?job=" + encodeURIComponent(jobKey);
        body +=
          '<div class="cc-li-job-row-wrap" data-job-id="' +
          escapeHtml(jobKey) +
          '">' +
          '<a class="cc-li-rail-row cc-li-job-row" href="' +
          escapeHtml(it.url) +
          '" target="_blank" rel="noopener">' +
          '<span class="cc-li-rail-row-title">' +
          escapeHtml(it.title || "Job") +
          "</span>" +
          (company
            ? '<span class="cc-li-rail-row-sub">' + company + "</span>"
            : "") +
          (meta
            ? '<span class="cc-li-job-meta">' + escapeHtml(meta) + "</span>"
            : '<span class="cc-li-job-meta cc-li-job-meta--muted">Open job to load ATS &amp; applicants</span>') +
          "</a>" +
          '<div class="cc-li-job-links">' +
          '<a class="cc-li-job-link" href="' +
          escapeHtml(it.url) +
          '" target="_blank" rel="noopener">LinkedIn</a>' +
          '<a class="cc-li-job-link" href="#" data-cc-open-options="' +
          escapeHtml(trackerHash) +
          '">Tracker</a>' +
          "</div>" +
          '<button type="button" class="cc-li-post-mini-dismiss" data-cc-dismiss-job title="Remove from list" aria-label="Remove from list">×</button>' +
          "</div>";
      });
      body +=
        '<div class="cc-li-rail-actions">' +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="job-tracker">Open Job Tracker</a>' +
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-jobs>Check for new jobs</button>' +
        "</div>";
    }

    return (
      '<section class="cc-li-rail-card" data-cc-aside-widget="jobs">' +
      '<header class="cc-li-rail-head">Jobs to review' +
      '<p class="cc-li-rail-head-sub">Open roles from alerts &amp; tracker (not applied)</p>' +
      "</header>" +
      '<div class="cc-li-rail-body">' +
      body +
      "</div>" +
      '<div class="cc-li-confirm" data-cc-job-confirm hidden>' +
      '<p class="cc-li-confirm-title">Remove this job?</p>' +
      '<p class="cc-li-confirm-text">Only remove it if you&rsquo;ve already reviewed it. It stays in Job Tracker; we&rsquo;ll show another role here if one is available.</p>' +
      '<div class="cc-li-confirm-actions">' +
      '<button type="button" class="cc-li-rail-btn" data-cc-job-confirm-yes>Yes, remove</button>' +
      '<button type="button" class="cc-li-rail-btn cc-li-rail-btn--ghost" data-cc-job-confirm-no>Keep</button>' +
      "</div></div>" +
      '<footer class="cc-li-rail-foot">From CareerCraft · Job alerts &amp; Job Tracker</footer>' +
      "</section>"
    );
  }

  async function loadDismissedMap() {
    try {
      const r = await chrome.storage.local.get([DISMISSED_KEY]);
      const map = r[DISMISSED_KEY] || {};
      return typeof map === "object" && map ? map : {};
    } catch (e) {
      return {};
    }
  }

  async function pruneAndSaveDismissed(map) {
    const next = {};
    const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    Object.keys(map || {}).forEach(function (id) {
      const row = map[id];
      const at = row && row.at ? Number(row.at) : 0;
      if (at >= cutoff) next[id] = row;
    });
    await chrome.storage.local.set({ [DISMISSED_KEY]: next });
    return next;
  }

  async function dismissPost(postId, authorId) {
    if (!postId) return;
    const map = await loadDismissedMap();
    map[String(postId)] = {
      at: Date.now(),
      authorId: authorId || "",
    };
    await pruneAndSaveDismissed(map);
  }

  async function loadAuthorPosts(settings) {
    const per = [1, 2, 5].indexOf(settings.postsPerAuthor) >= 0
      ? settings.postsPerAuthor
      : 2;
    const authors = Array.isArray(settings.authors) ? settings.authors : [];
    let cache = {};
    let dismissed = {};
    try {
      const r = await chrome.storage.local.get([AUTHOR_POSTS_KEY, DISMISSED_KEY]);
      cache = r[AUTHOR_POSTS_KEY] || {};
      dismissed = r[DISMISSED_KEY] || {};
    } catch (e) {}

    const items = [];
    let hiddenByDismiss = 0;
    let cacheTotal = 0;
    authors.forEach(function (a) {
      if (!a || !a.id) return;
      const all = cache[a.id] || [];
      cacheTotal += all.length;
      const visible = [];
      all.forEach(function (p) {
        const pid = String((p && p.id) || "");
        if (pid && dismissed[pid]) {
          hiddenByDismiss++;
          return;
        }
        visible.push(p);
      });
      visible.slice(0, per).forEach(function (p) {
        items.push({
          id: p.id || "",
          authorId: a.id,
          authorLabel: a.label || a.id,
          authorUrl: a.url,
          avatarUrl: p.avatarUrl || a.avatarUrl || "",
          text: p.text || "",
          url: p.url || a.url,
          createdAt: p.createdAt || 0,
          relativeLabel: p.relativeLabel || "",
        });
      });
    });
    return {
      authors: authors,
      items: items,
      per: per,
      hiddenByDismiss: hiddenByDismiss,
      cacheTotal: cacheTotal,
      caughtUp: authors.length > 0 && items.length === 0 && cacheTotal > 0,
    };
  }

  function avatarHtml(url, label) {
    const name = String(label || "?").trim();
    const initial = (name.charAt(0) || "?").toUpperCase();
    if (url) {
      return (
        '<img class="cc-li-post-mini-avatar" src="' +
        escapeHtml(url) +
        '" alt="" width="40" height="40" loading="lazy" referrerpolicy="no-referrer" />'
      );
    }
    return (
      '<span class="cc-li-post-mini-avatar cc-li-post-mini-avatar--fallback" aria-hidden="true">' +
      escapeHtml(initial) +
      "</span>"
    );
  }

  function buildAuthorsCardHtml(data) {
    let body = "";
    if (!data.authors.length) {
      body =
        '<div class="cc-li-rail-empty-block">' +
        '<p class="cc-li-rail-empty-title">Follow voices you trust</p>' +
        '<p class="cc-li-rail-empty">Add up to 5 LinkedIn authors and we&rsquo;ll surface their latest posts here.</p>' +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="feed-widgets">Add favorite authors</a>' +
        "</div>";
    } else if (!data.items.length && data.caughtUp) {
      body =
        '<div class="cc-li-rail-empty-block">' +
        '<p class="cc-li-rail-empty-title">You&rsquo;re all caught up</p>' +
        '<p class="cc-li-rail-empty">No more recent posts to show from your saved authors. Add another voice for a fresher feed, or refresh later.</p>' +
        '<a class="cc-li-rail-link" href="#" data-cc-open-options="feed-widgets">Add more authors</a>' +
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-authors>Refresh posts</button>' +
        "</div>";
    } else if (!data.items.length) {
      body =
        '<div class="cc-li-rail-empty-block">' +
        '<p class="cc-li-rail-empty-title">Finding recent posts</p>' +
        '<p class="cc-li-rail-empty">We&rsquo;ll load miniature posts from your authors. You can also open their recent activity or tap Refresh.</p>' +
        "</div>";
      data.authors.forEach(function (a) {
        const activity =
          "https://www.linkedin.com/in/" +
          encodeURIComponent(a.id) +
          "/recent-activity/all/";
        body +=
          '<div class="cc-li-post-mini cc-li-post-mini--empty">' +
          '<div class="cc-li-post-mini-top">' +
          avatarHtml(a.avatarUrl, a.label || a.id) +
          '<div class="cc-li-post-mini-meta">' +
          escapeHtml(a.label || a.id) +
          "</div></div>" +
          '<a class="cc-li-rail-link" href="' +
          escapeHtml(activity) +
          '" target="_blank" rel="noopener">Open recent activity</a>' +
          "</div>";
      });
      body +=
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-authors>Refresh posts</button>';
    } else {
      data.items.forEach(function (it) {
        const snippet = String(it.text || "").replace(/\s+/g, " ").trim();
        const short =
          snippet.length > 160 ? snippet.slice(0, 157) + "…" : snippet;
        body +=
          '<div class="cc-li-post-mini-wrap" data-post-id="' +
          escapeHtml(it.id || "") +
          '" data-author-id="' +
          escapeHtml(it.authorId || "") +
          '">' +
          '<a class="cc-li-post-mini" href="' +
          escapeHtml(it.url) +
          '" target="_blank" rel="noopener">' +
          '<div class="cc-li-post-mini-top">' +
          avatarHtml(it.avatarUrl, it.authorLabel) +
          '<div class="cc-li-post-mini-meta">' +
          escapeHtml(it.authorLabel) +
          (it.relative
            ? '<span class="cc-li-post-mini-time"> · ' +
              escapeHtml(it.relative) +
              "</span>"
            : "") +
          "</div></div>" +
          (short
            ? '<p class="cc-li-post-mini-text">' + escapeHtml(short) + "</p>"
            : '<p class="cc-li-post-mini-text cc-li-post-mini-text--muted">Open post</p>') +
          "</a>" +
          '<button type="button" class="cc-li-post-mini-dismiss" data-cc-dismiss-post title="Remove from list" aria-label="Remove from list">×</button>' +
          "</div>";
      });
      body +=
        '<button type="button" class="cc-li-rail-btn" data-cc-refresh-authors>Refresh posts</button>';
    }

    return (
      '<section class="cc-li-rail-card" data-cc-aside-widget="authors">' +
      '<header class="cc-li-rail-head">Favorite authors</header>' +
      '<div class="cc-li-rail-body">' +
      body +
      "</div>" +
      '<div class="cc-li-confirm" data-cc-confirm hidden>' +
      '<p class="cc-li-confirm-title">Remove this post?</p>' +
      '<p class="cc-li-confirm-text">Only remove it if you&rsquo;ve already viewed it. We&rsquo;ll show another recent post if one is available.</p>' +
      '<div class="cc-li-confirm-actions">' +
      '<button type="button" class="cc-li-rail-btn" data-cc-confirm-yes>Yes, remove</button>' +
      '<button type="button" class="cc-li-rail-btn cc-li-rail-btn--ghost" data-cc-confirm-no>Keep</button>' +
      "</div></div>" +
      '<footer class="cc-li-rail-foot">From CareerCraft · Favorite authors you saved</footer>' +
      "</section>"
    );
  }

  function relativeTime(ts) {
    const n = Number(ts) || 0;
    if (!n) return "";
    const diff = Date.now() - n;
    if (diff < 0) return "now";
    const m = Math.floor(diff / 60000);
    if (m < 1) return "now";
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h";
    const d = Math.floor(h / 24);
    if (d < 7) return d + "d";
    const w = Math.floor(d / 7);
    if (w < 5) return w + "w";
    const mo = Math.floor(d / 30);
    if (mo < 12) return mo + "mo";
    return Math.floor(d / 365) + "yr";
  }

  /**
   * Parse LinkedIn-style relative time ("2d", "3w", "1mo", "Edited • 5h")
   * into a timestamp using the browser's local clock.
   */
  function parseLinkedInRelativeToTs(raw) {
    const text = String(raw || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!text) return 0;
    if (/^(just\s+)?now\b/.test(text)) return Date.now() - 30 * 1000;
    const cleaned = text
      .replace(/^edited\s*[•·\-]\s*/i, "")
      .replace(/^posted\s*[•·\-]\s*/i, "")
      .trim();
    const m = cleaned.match(
      /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|wk|wks|week|weeks|mo|mos|month|months|y|yr|yrs|year|years)\b/
    );
    if (!m) return 0;
    const n = Number(m[1]);
    if (!(n >= 0)) return 0;
    const u = m[2];
    let ms = 0;
    if (/^m(in(ute)?s?)?$/.test(u)) ms = n * 60 * 1000;
    else if (/^h(r|ours?)?s?$/.test(u)) ms = n * 60 * 60 * 1000;
    else if (/^d(ays?)?$/.test(u)) ms = n * 24 * 60 * 60 * 1000;
    else if (/^w(k|ks|eek|eeks)?$/.test(u)) ms = n * 7 * 24 * 60 * 60 * 1000;
    else if (/^mo(s|nth|nths)?$/.test(u)) ms = n * 30 * 24 * 60 * 60 * 1000;
    else if (/^(y|yr|yrs|year|years)$/.test(u)) ms = n * 365 * 24 * 60 * 60 * 1000;
    if (!ms) return 0;
    return Date.now() - ms;
  }

  function activityIdToTs(urnOrId) {
    try {
      const s = String(urnOrId || "");
      const m = s.match(/activity[:\-](\d{10,})/i) || s.match(/^(\d{15,})$/);
      if (!m) return 0;
      const id = BigInt(m[1]);
      const ts = Number(id >> 22n);
      // Sane range: 2015 .. now+1day
      if (ts > 1420070400000 && ts < Date.now() + 86400000) return ts;
    } catch (e) {}
    return 0;
  }

  function extractPostTime(node, urn) {
    let label = "";
    let ts = 0;

    const timeEl =
      node.querySelector("time[datetime]") ||
      node.querySelector("time");
    if (timeEl) {
      const dt = timeEl.getAttribute("datetime") || timeEl.dateTime || "";
      if (dt) {
        const parsed = Date.parse(dt);
        if (!isNaN(parsed)) ts = parsed;
      }
      label = (timeEl.textContent || "").replace(/\s+/g, " ").trim();
    }

    if (!ts || !label) {
      const candidates = node.querySelectorAll(
        'a[href*="/feed/update/"] span, a[href*="activity:"] span, span.update-components-actor__sub-description, span.feed-shared-actor__sub-description, [class*="sub-description"], [class*="actor__sub-description"]'
      );
      for (let i = 0; i < candidates.length; i++) {
        const t = (candidates[i].textContent || "").replace(/\s+/g, " ").trim();
        if (!t || t.length > 40) continue;
        const parsed = parseLinkedInRelativeToTs(t);
        if (parsed) {
          if (!ts) ts = parsed;
          if (!label) label = t.replace(/^edited\s*[•·\-]\s*/i, "").trim();
          break;
        }
      }
    }

    if (!ts) {
      const aria = node.querySelector("[aria-label*='ago'], [aria-label*='week'], [aria-label*='day']");
      if (aria) {
        const al = aria.getAttribute("aria-label") || "";
        const parsed = parseLinkedInRelativeToTs(al);
        if (parsed) ts = parsed;
        if (!label && al) {
          const short = al.match(/(\d+\s*(?:m|h|d|w|mo|yr|min|hour|day|week|month|year)s?)/i);
          if (short) label = short[1].replace(/\s+/g, "");
        }
      }
    }

    if (!ts) ts = activityIdToTs(urn);

    // Prefer LinkedIn-compact label; else derive from ts
    if (!label && ts) label = relativeTime(ts);
    else if (label) {
      // Normalize "2 days" / "Edited • 2d" → LinkedIn-ish short form when possible
      const short = label
        .replace(/^edited\s*[•·\-]\s*/i, "")
        .replace(/\s+/g, "")
        .toLowerCase();
      const nm = short.match(/^(\d+)(m|h|d|w|mo|yr|mins?|hours?|days?|weeks?|months?|years?)/);
      if (nm) {
        let u = nm[2];
        if (/^mins?$/.test(u)) u = "m";
        else if (/^hours?$/.test(u)) u = "h";
        else if (/^days?$/.test(u)) u = "d";
        else if (/^weeks?$/.test(u)) u = "w";
        else if (/^months?$/.test(u)) u = "mo";
        else if (/^years?$/.test(u)) u = "yr";
        label = nm[1] + u;
      }
    }

    return { ts: ts || 0, label: label || "" };
  }

  function isRepostOrQuote(node) {
    try {
      const ck =
        (node.getAttribute &&
          (node.getAttribute("componentkey") ||
            node.getAttribute("data-urn") ||
            "")) ||
        "";
      if (/repost|RESHARE|share_update/i.test(ck) && !/ORIGINAL/i.test(ck)) {
        return true;
      }

      // Nested quoted/shared update
      if (
        node.querySelector(
          ".feed-shared-mini-update-v2, .update-components-mini-update, [class*='mini-update'], [data-test-id*='mini-update']"
        )
      ) {
        return true;
      }

      const headerBits = [];
      const headerEls = node.querySelectorAll(
        '[class*="actor"], [class*="header"], a[href*="/in/"]'
      );
      for (let i = 0; i < Math.min(headerEls.length, 6); i++) {
        headerBits.push((headerEls[i].textContent || "").slice(0, 120));
      }
      const header = headerBits.join(" ").toLowerCase();
      if (
        /\breposted\b/.test(header) ||
        /\brepost\b/.test(header) ||
        /shared this/.test(header) ||
        /^shared a /.test(header.trim()) ||
        /\bquoted\b/.test(header)
      ) {
        return true;
      }

      // "X reposted" strip above the card
      const prev = node.previousElementSibling;
      if (prev) {
        const pt = (prev.textContent || "").toLowerCase();
        if (/\breposted\b/.test(pt) && pt.length < 80) return true;
      }
    } catch (e) {}
    return false;
  }

  function pickAvatarUrl(root) {
    if (!root || !root.querySelectorAll) return "";
    const imgs = root.querySelectorAll("img");
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      const src = (img.currentSrc || img.src || "").trim();
      if (!src || src.indexOf("data:") === 0) continue;
      if (/ghost|emoji|company-logo|logo_100|sprite/i.test(src)) continue;
      if (
        /media\.licdn\.com|static\.licdn\.com/i.test(src) ||
        /profile-displayphoto|shrink_|image\/D4/i.test(src)
      ) {
        return src;
      }
      const cls = String(img.className || "");
      if (/avatar|EntityPhoto|presence-entity|profile-photo/i.test(cls)) {
        return src;
      }
    }
    return "";
  }

  function extractPostsFromDocument(maxPosts, authorMeta, options) {
    const per = Math.max(1, Math.min(5, Number(maxPosts) || 2));
    const author = authorMeta || {};
    const opts = options || {};
    // Default: original written posts only (exclude repost / quote-repost)
    const wantOriginal = opts.filter !== "all";
    const posts = [];
    const seen = {};
    let skippedRepost = 0;
    const pageAvatar =
      pickAvatarUrl(
        document.querySelector(
          ".pv-top-card, .artdeco-card, main, [data-member-id]"
        ) || document.body
      ) ||
      author.avatarUrl ||
      "";
    const nodes = document.querySelectorAll(
      '[data-id^="urn:li:activity"], [data-urn^="urn:li:activity"], div.feed-shared-update-v2, article.feed-shared-update-v2, [role="listitem"][componentkey*="FeedType"], [role="listitem"][componentkey*="Update"]'
    );

    for (let i = 0; i < nodes.length && posts.length < per; i++) {
      const n = nodes[i];
      try {
        if (wantOriginal && isRepostOrQuote(n)) {
          skippedRepost++;
          continue;
        }

        const headerText = (
          n.querySelector("a[href*='/in/']") ||
          n.querySelector('[class*="actor"]') ||
          n
        ).textContent || "";
        const ht = headerText.toLowerCase();
        if (
          ht.indexOf("reposted") >= 0 ||
          ht.indexOf("repost") === 0 ||
          /^shared a /.test(ht.trim())
        ) {
          skippedRepost++;
          continue;
        }

        const textEl =
          n.querySelector(".feed-shared-update-v2__description") ||
          n.querySelector('[class*="update-v2__description"]') ||
          n.querySelector(".update-components-text") ||
          n.querySelector(".break-words") ||
          n.querySelector('span[dir="ltr"]');
        let text = (textEl && textEl.textContent ? textEl.textContent : "")
          .replace(/\s+/g, " ")
          .trim();
        if (!text || text.length < 12) continue;
        if (/^(reposted|shared a)/i.test(text)) {
          skippedRepost++;
          continue;
        }

        const urn =
          n.getAttribute("data-id") ||
          n.getAttribute("data-urn") ||
          "";
        let postUrl = "";
        const link =
          n.querySelector('a[href*="/feed/update/"]') ||
          n.querySelector('a[href*="activity:"]') ||
          n.querySelector('a[href*="/posts/"]');
        if (link && link.href) postUrl = link.href.split("?")[0];
        if (!postUrl && urn.indexOf("urn:li:activity:") === 0) {
          postUrl =
            "https://www.linkedin.com/feed/update/" + encodeURIComponent(urn);
        }
        if (!postUrl) {
          postUrl =
            author.url ||
            "https://www.linkedin.com/in/" +
              encodeURIComponent(author.id || "") +
              "/";
        }

        const id = urn || postUrl || "p-" + posts.length + "-" + text.slice(0, 20);
        if (seen[id]) continue;
        seen[id] = true;

        const avatarUrl = pickAvatarUrl(n) || pageAvatar || "";
        const timeInfo = extractPostTime(n, urn);

        posts.push({
          id: String(id),
          text: text.slice(0, 600),
          url: postUrl,
          createdAt: timeInfo.ts || 0,
          relativeLabel: timeInfo.label || "",
          authorName: author.label || author.id || "",
          avatarUrl: avatarUrl,
          kind: wantOriginal ? "original" : "mixed",
        });
      } catch (e) {}
    }
    return posts;
  }

  function bindExtractListener() {
    if (extractListenerBound) return;
    extractListenerBound = true;
    try {
      chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request && request.action === "extractAuthorPostsFromPage") {
          try {
            const posts = extractPostsFromDocument(
              request.maxPosts || 2,
              request.author || {},
              { filter: request.filter || "original" }
            );
            sendResponse({ success: true, posts: posts });
          } catch (e) {
            sendResponse({ success: false, posts: [], error: String(e) });
          }
          return true;
        }
      });
    } catch (e) {}
  }

  async function renderInto(host) {
    const flags =
      typeof FeatureFlags !== "undefined"
        ? await FeatureFlags.load()
        : { authorWidget: false, jobBoardWidget: false };
    const showJobs = flags.jobBoardWidget === true;
    const showAuthors = flags.authorWidget === true;
    if (!showJobs && !showAuthors) {
      removeHost();
      return;
    }

    const settings = await loadSettings();
    let html = "";
    let notifEnabled = true;
    try {
      const nr = await chrome.storage.local.get(["notification_settings"]);
      notifEnabled = !(
        nr.notification_settings && nr.notification_settings.enabled === false
      );
    } catch (e) {}

    if (showJobs) {
      const jobs = await loadAlertItems(settings);
      html += buildJobsCardHtml(jobs, notifEnabled);
      dbg("jobCount", jobs.items.length);
    }
    if (showAuthors) {
      const authors = await loadAuthorPosts(settings);
      authors.items.forEach(function (it) {
        it.relative =
          (it.createdAt ? relativeTime(it.createdAt) : "") ||
          it.relativeLabel ||
          "";
      });
      html += buildAuthorsCardHtml(authors);
      dbg("authorCount", authors.items.length, "authors", authors.authors.length);
      if (authors.authors.length) {
        maybeAutoAuthorRefresh(authors.authors, settings).catch(function () {});
      }
    }

    // Avoid rewriting DOM when nothing meaningful changed (stops flicker)
    const fp =
      String(html.length) +
      ":" +
      String((html.match(/data-job-id="/g) || []).length) +
      ":" +
      String((html.match(/data-post-id="/g) || []).length) +
      ":" +
      html.slice(0, 120) +
      html.slice(-80);
    if (fp === lastRenderFp && host.getAttribute("data-cc-fp") === fp) {
      return;
    }
    lastRenderFp = fp;
    host.setAttribute("data-cc-fp", fp);
    host.innerHTML = html;
    host.querySelectorAll("[data-cc-open-options]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        try {
          chrome.runtime.sendMessage({
            action: "openOptions",
            hash: a.getAttribute("data-cc-open-options") || "feed-widgets",
          });
        } catch (err) {}
      });
    });
    host.querySelectorAll("[data-cc-refresh-authors]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        btn.disabled = true;
        btn.textContent = "Refreshing…";
        loadSettings()
          .then(function (s) {
            return requestSoftAuthorRefresh(
              s.authors || [],
              s.postsPerAuthor,
              true,
              s.authorPostsFilter
            );
          })
          .then(function () {
            scheduleRemount();
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = "Refresh posts";
          });
      });
    });

    host.querySelectorAll("[data-cc-refresh-jobs]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = "Checking…";
        chrome.runtime.sendMessage({ action: "checkJobsNow" }, function () {
          stickyJobIds = null;
          lastRenderFp = "";
          scheduleRemount();
          try {
            btn.disabled = false;
            btn.textContent = prev || "Check for new jobs";
          } catch (err) {}
        });
      });
    });

    bindAuthorDismissControls(host);
    bindJobDismissControls(host);
  }

  function bindJobDismissControls(host) {
    let pending = null;
    const confirmEl = host.querySelector("[data-cc-job-confirm]");
    function hideConfirm() {
      pending = null;
      confirmUiOpen = false;
      if (confirmEl) confirmEl.hidden = true;
    }
    function showConfirm(wrap) {
      pending = {
        jobId: wrap.getAttribute("data-job-id") || "",
        wrap: wrap,
      };
      confirmUiOpen = true;
      if (confirmEl) {
        confirmEl.hidden = false;
        try {
          confirmEl.scrollIntoView({ block: "nearest" });
        } catch (e) {}
      }
    }

    host.querySelectorAll("[data-cc-dismiss-job]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest(".cc-li-job-row-wrap");
        if (!wrap) return;
        showConfirm(wrap);
      });
    });

    if (confirmEl) {
      const yes = confirmEl.querySelector("[data-cc-job-confirm-yes]");
      const no = confirmEl.querySelector("[data-cc-job-confirm-no]");
      if (no) {
        no.addEventListener("click", function (e) {
          e.preventDefault();
          hideConfirm();
        });
      }
      if (yes) {
        yes.addEventListener("click", function (e) {
          e.preventDefault();
          if (!pending || !pending.jobId) {
            hideConfirm();
            return;
          }
          const jobId = pending.jobId;
          hideConfirm();
          dismissJob(jobId)
            .then(function () {
              stickyJobIds = null;
              lastRenderFp = "";
              scheduleRemount();
            })
            .catch(function () {
              stickyJobIds = null;
              lastRenderFp = "";
              scheduleRemount();
            });
        });
      }
    }
  }

  function bindAuthorDismissControls(host) {
    let pending = null;
    const confirmEl = host.querySelector("[data-cc-confirm]");
    function hideConfirm() {
      pending = null;
      confirmUiOpen = false;
      if (confirmEl) confirmEl.hidden = true;
    }
    function showConfirm(wrap) {
      pending = {
        postId: wrap.getAttribute("data-post-id") || "",
        authorId: wrap.getAttribute("data-author-id") || "",
        wrap: wrap,
      };
      confirmUiOpen = true;
      if (confirmEl) {
        confirmEl.hidden = false;
        try {
          confirmEl.scrollIntoView({ block: "nearest" });
        } catch (e) {}
      }
    }

    host.querySelectorAll("[data-cc-dismiss-post]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest(".cc-li-post-mini-wrap");
        if (!wrap) return;
        showConfirm(wrap);
      });
    });

    if (confirmEl) {
      const yes = confirmEl.querySelector("[data-cc-confirm-yes]");
      const no = confirmEl.querySelector("[data-cc-confirm-no]");
      if (no) {
        no.addEventListener("click", function (e) {
          e.preventDefault();
          hideConfirm();
        });
      }
      if (yes) {
        yes.addEventListener("click", function (e) {
          e.preventDefault();
          if (!pending || !pending.postId) {
            hideConfirm();
            return;
          }
          const postId = pending.postId;
          const authorId = pending.authorId;
          hideConfirm();
          dismissPost(postId, authorId)
            .then(function () {
              return loadSettings();
            })
            .then(function (s) {
              return loadAuthorPosts(s).then(function (data) {
                // If a slot freed and cache is thin for that author, soft-fetch more
                const needMore =
                  data.items.length < data.authors.length * data.per;
                if (needMore && s.authors && s.authors.length) {
                  return requestSoftAuthorRefresh(
                    s.authors,
                    Math.min(5, Math.max(s.postsPerAuthor || 2, 3)),
                    true,
                    s.authorPostsFilter
                  ).then(function () {
                    scheduleRemount();
                  });
                }
                scheduleRemount();
              });
            })
            .catch(function () {
              scheduleRemount();
            });
        });
      }
    }
  }

  let softRefreshBusy = false;
  async function requestSoftAuthorRefresh(authors, postsPerAuthor, force, filter) {
    if (softRefreshBusy) return;
    const list = Array.isArray(authors) ? authors.slice(0, 5) : [];
    if (!list.length) return;
    softRefreshBusy = true;
    try {
      await new Promise(function (resolve) {
        chrome.runtime.sendMessage(
          {
            action: "softFetchAuthorPosts",
            authors: list,
            postsPerAuthor: postsPerAuthor || 2,
            force: !!force,
            filter: filter === "all" ? "all" : "original",
          },
          function () {
            resolve();
          }
        );
      });
    } catch (e) {
      dbg("soft refresh failed", e);
    } finally {
      softRefreshBusy = false;
    }
  }

  async function maybeAutoAuthorRefresh(authors, settings) {
    try {
      const nowTs = Date.now();
      // Remount storms must not re-trigger soft fetch every few hundred ms
      if (nowTs - lastAutoAuthorAttemptAt < 90 * 1000) return;

      const postsData = await loadAuthorPosts(settings);
      // All posts dismissed — empty UI is intentional; do not thrash refresh/remount
      if (postsData.caughtUp) {
        lastAutoAuthorAttemptAt = nowTs;
        return;
      }

      const refreshMin = Number(settings.authorRefreshMinutes);
      if (!postsData.items.length) {
        lastAutoAuthorAttemptAt = nowTs;
        await requestSoftAuthorRefresh(
          authors,
          settings.postsPerAuthor,
          false,
          settings.authorPostsFilter
        );
        const after = await loadAuthorPosts(settings);
        if (after.items.length > 0) {
          lastRenderFp = "";
          scheduleRemount();
        }
        return;
      }
      if (!(refreshMin > 0)) return;

      const metaR = await chrome.storage.local.get(["aside_author_fetch_meta"]);
      const meta = metaR.aside_author_fetch_meta || {};
      const last = Number(meta.lastRunAt) || 0;
      const due = !last || nowTs - last >= refreshMin * 60 * 1000;
      if (!due) {
        lastAutoAuthorAttemptAt = nowTs;
        return;
      }
      lastAutoAuthorAttemptAt = nowTs;
      await requestSoftAuthorRefresh(
        authors,
        settings.postsPerAuthor,
        false,
        settings.authorPostsFilter
      );
      lastRenderFp = "";
      scheduleRemount();
    } catch (e) {}
  }

  async function mount() {
    try {
      if (!isFeedContext()) {
        removeHost();
        dbg("skip: not feed");
        return;
      }

      const flags =
        typeof FeatureFlags !== "undefined"
          ? await FeatureFlags.load()
          : { authorWidget: false, jobBoardWidget: false };
      if (flags.jobBoardWidget !== true && flags.authorWidget !== true) {
        removeHost();
        dbg("skip: flags off");
        return;
      }

      const aside =
        typeof LinkedInDOM !== "undefined" ? LinkedInDOM.getAside() : null;
      if (!aside) {
        dbg("asideFound", false);
        return;
      }
      dbg("asideFound", true);

      let host = document.getElementById(HOST_ID);
      if (host && !aside.contains(host)) {
        try {
          host.remove();
        } catch (e) {}
        host = null;
      }

      if (!host) {
        const anchor =
          typeof LinkedInDOM !== "undefined"
            ? LinkedInDOM.findAsideInsertAnchor(aside)
            : null;
        if (!anchor || !anchor.parent) {
          dbg("anchor", null);
          return;
        }
        dbg("anchor", !!anchor.before);
        host = document.createElement("div");
        host.id = HOST_ID;
        host.setAttribute("data-cc-aside-widget", "host");
        if (anchor.before) {
          anchor.parent.insertBefore(host, anchor.before);
        } else {
          anchor.parent.appendChild(host);
        }
        dbg("mount");
      }

      await renderInto(host);
      assertSingleHost();
    } catch (e) {
      dbg("error", String(e && e.message ? e.message : e));
      console.warn("AsideWidgets: mount failed (soft)", e);
    }
  }

  function scheduleRemount() {
    if (confirmUiOpen) {
      if (remountTimer) clearTimeout(remountTimer);
      remountTimer = setTimeout(function () {
        remountTimer = null;
        if (!confirmUiOpen) mount().catch(function () {});
        else scheduleRemount();
      }, 900);
      return;
    }
    if (remountTimer) clearTimeout(remountTimer);
    remountTimer = setTimeout(function () {
      remountTimer = null;
      if (confirmUiOpen) {
        scheduleRemount();
        return;
      }
      mount().catch(function () {});
    }, 400);
  }

  function watchPath() {
    let last = location.href;
    if (pathWatcher) clearInterval(pathWatcher);
    pathWatcher = setInterval(function () {
      if (location.href === last) return;
      last = location.href;
      scheduleRemount();
      maybePassiveAuthorExtract().catch(function () {});
    }, 800);
  }

  async function maybePassiveAuthorExtract() {
    try {
      const flags =
        typeof FeatureFlags !== "undefined"
          ? await FeatureFlags.load()
          : { authorWidget: false };
      if (flags.authorWidget !== true) return;

      const key = profileKeyFromLocation();
      if (!key) return;

      const settings = await loadSettings();
      const authors = Array.isArray(settings.authors) ? settings.authors : [];
      const match = authors.find(function (a) {
        return a && String(a.id).toLowerCase() === key;
      });
      if (!match) return;

      const per = [1, 2, 5].indexOf(settings.postsPerAuthor) >= 0
        ? settings.postsPerAuthor
        : 2;

      const posts = extractPostsFromDocument(per, match, {
        filter: settings.authorPostsFilter === "all" ? "all" : "original",
      });
      if (!posts.length) return;

      const r = await chrome.storage.local.get([AUTHOR_POSTS_KEY]);
      const cache = r[AUTHOR_POSTS_KEY] || {};
      cache[match.id] = posts;
      await chrome.storage.local.set({ [AUTHOR_POSTS_KEY]: cache });

      const av = posts.find(function (p) {
        return p && p.avatarUrl;
      });
      if (av && av.avatarUrl && match.avatarUrl !== av.avatarUrl) {
        try {
          const sr = await chrome.storage.local.get([SETTINGS_KEY]);
          const s = Object.assign({}, DEFAULT_SETTINGS, sr[SETTINGS_KEY] || {});
          if (!Array.isArray(s.authors)) s.authors = [];
          s.authors = s.authors.map(function (a) {
            if (a && a.id === match.id) {
              return Object.assign({}, a, { avatarUrl: av.avatarUrl });
            }
            return a;
          });
          await chrome.storage.local.set({ [SETTINGS_KEY]: s });
        } catch (e) {}
      }

      dbg("passive extract", match.id, posts.length);
      if (isFeedContext()) scheduleRemount();
    } catch (e) {
      dbg("passive extract error", e);
    }
  }

  async function init() {
    if (started) return;
    started = true;
    try {
      await refreshDebugFlag();
      dbg("init");

      if (typeof LinkedInDOM !== "undefined" && LinkedInDOM.onAsideReady) {
        unwatchAside = LinkedInDOM.onAsideReady(function () {
          scheduleRemount();
        });
      }

      watchPath();
      scheduleRemount();
      maybePassiveAuthorExtract().catch(function () {});

      if (!storageListener) {
        storageListener = function (changes, area) {
          if (area !== "local") return;
          if (
            changes.feature_flags ||
            changes[SETTINGS_KEY] ||
            changes[ALERTS_KEY] ||
            changes[AUTHOR_POSTS_KEY] ||
            changes[DISMISSED_KEY] ||
            changes[JOB_DISMISSED_KEY] ||
            changes.casper_job_tracker ||
            changes[DEBUG_KEY]
          ) {
            if (changes[DEBUG_KEY]) refreshDebugFlag();
            if (typeof FeatureFlags !== "undefined" && FeatureFlags.invalidate) {
              FeatureFlags.invalidate();
            }
            scheduleRemount();
          }
        };
        chrome.storage.onChanged.addListener(storageListener);
      }

      bindExtractListener();
    } catch (e) {
      console.warn("AsideWidgets: init failed (soft)", e);
    }
  }

  // Bind extract handler at script load so soft-fetch tabs can respond
  // before LinkedInFormatter.init() finishes.
  bindExtractListener();

  global.AsideWidgets = {
    init: init,
    mount: mount,
    removeHost: removeHost,
    normalizeProfileUrl: normalizeProfileUrl,
    extractPostsFromDocument: extractPostsFromDocument,
    SETTINGS_KEY: SETTINGS_KEY,
    ALERTS_KEY: ALERTS_KEY,
    AUTHOR_POSTS_KEY: AUTHOR_POSTS_KEY,
    DISMISSED_KEY: DISMISSED_KEY,
    JOB_DISMISSED_KEY: JOB_DISMISSED_KEY,
    DEBUG_KEY: DEBUG_KEY,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    HOST_ID: HOST_ID,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
