/**
 * Job Tracker store — shared chrome.storage.local map (casper_job_tracker).
 * IDB-ready API surface; storage.local so content scripts + Options share data.
 */
(function (global) {
  const STORAGE_KEY = "casper_job_tracker";
  const SEEDED_KEY = "casper_job_tracker_seeded";
  const ALERT_NEW_MIGRATE_KEY = "casper_job_tracker_alert_new_v1";
  const APPLICANTS_LOC_MIGRATE_KEY = "casper_job_tracker_applicants_loc_v1";
  const PLACEHOLDER_TITLE_MIGRATE_KEY = "casper_job_tracker_fix_placeholders_v1";
  const COMPANY_FROM_TITLE_MIGRATE_KEY = "casper_job_tracker_company_from_title_v1";
  const EMPLOYER_KIND_MIGRATE_KEY = "casper_job_tracker_employer_kind_v1";
  const REFRESH_SETTINGS_KEY = "tracker_refresh_settings";
  const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

  const EMPLOYER_KINDS = ["direct", "agency", "job_board", "unknown"];
  const EMPLOYER_KIND_LABELS = {
    direct: "Direct employer",
    agency: "Agency listing",
    job_board: "Job board",
    unknown: "Unclear",
  };
  const EMPLOYER_KIND_CONFIDENCES = ["low", "medium", "high"];

  const AGENCY_NAME_RE =
    /\b(recruit(?:er|ing|ment)?|staffing|talent(?:\s+(?:acquisition|solutions|partners|agency))?|consultanc(?:y|ies)|manpower|outsourcing|\brpo\b|placement|headhunt(?:ing|er)?|executive\s*search|workforce(?:\s+solutions)?|hr\s+solutions|personnel|temp\s+agency|contract\s+staffing|search\s+firm)\b/i;
  const JOB_BOARD_NAME_RE =
    /\b(bdjobs|indeed|glassdoor|monster|careerbuilder|jobstreet|seek|naukri|bayt|linkedin\s+jobs?|job\s*board|jobs?\s+marketplace|careerjet|ziprecruiter|simplyhired)\b|jobbd/i;
  const AGENCY_TITLE_RE =
    /\b(recruit(?:er|ing)|staffing|talent\s+acquisition|rpo|manpower|outsourcing)\b/i;

  const STATUSES = [
    "new",
    "viewed",
    "applied",
    "interview",
    "confirmed",
    "rejected",
    "expired",
    "archived",
  ];

  const STATUS_LABELS = {
    new: "New",
    viewed: "Viewed",
    applied: "Applied",
    interview: "Got interview call",
    confirmed: "Confirmed",
    rejected: "Rejected",
    expired: "Expired",
    archived: "Archived",
  };

  const SOURCES = ["viewed", "alert", "ats", "feed"];

  const DEFAULT_REFRESH_SETTINGS = {
    applicantCheckEnabled: false,
    applicantCheckMinutes: 360,
    expiryCheckEnabled: false,
    expiryCheckMinutes: 720,
    maxJobsPerTick: 3,
  };

  function now() {
    return Date.now();
  }

  function jobUrl(id) {
    const s = String(id || "").trim();
    // Only real LinkedIn job posting IDs — never feed:hash organic ids
    if (/^\d{6,}$/.test(s)) {
      return "https://www.linkedin.com/jobs/view/" + s;
    }
    return "";
  }

  function isUnusableTrackerUrl(url) {
    const u = String(url || "").trim();
    if (!u || u === "#") return true;
    // Organic feed ids wrongly encoded as job views
    if (/\/jobs\/view\/feed/i.test(u)) return true;
    if (/\/jobs\/view\/[^/?#]*feed[%3A:]/i.test(u)) return true;
    // Any /jobs/view/ that is not a pure numeric job id
    const jobId = u.match(/\/jobs\/view\/([^/?#]+)/i);
    if (jobId && !/^\d{6,}$/.test(decodeURIComponent(jobId[1]))) return true;
    if (/\/(company|showcase)\/[^/]+\/posts\/?(\?|#|$)/i.test(u)) return true;
    if (/\/showcase\/[^/]+\/?(\?|#|$)/i.test(u)) return true;
    if (/\/in\/[^/]+\/recent-activity/i.test(u)) return true;
    return false;
  }

  function urlFromFeedStyleId(id) {
    const s = String(id || "");
    let m = s.match(/^feed:(share|activity|ugcPost)-(\d+)$/i);
    if (m) {
      return (
        "https://www.linkedin.com/feed/update/" +
        encodeURIComponent("urn:li:" + m[1].toLowerCase() + ":" + m[2])
      );
    }
    m = s.match(/^feed:(urn:li:(?:share|activity|ugcPost):\d+)$/i);
    if (m) {
      return (
        "https://www.linkedin.com/feed/update/" + encodeURIComponent(m[1])
      );
    }
    return "";
  }

  /**
   * Safe URL for opening a tracker row. Never returns jobs/view/feed:…
   */
  function resolveJobOpenUrl(job) {
    if (!job) return "";
    const candidates = [job.feedPostUrl, job.url];
    for (let i = 0; i < candidates.length; i++) {
      const c = String(candidates[i] || "").trim();
      if (c && !isUnusableTrackerUrl(c)) return c;
    }
    const fromId = urlFromFeedStyleId(job.id);
    if (fromId) return fromId;
    const numeric = jobUrl(job.id);
    return numeric || "";
  }

  function clampRating(n) {
    const v = Number(n);
    if (Number.isNaN(v)) return 0;
    return Math.max(0, Math.min(5, Math.round(v)));
  }

  function parseApplicantCountFromText(raw) {
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
    return null;
  }

  function cleanLocationText(raw) {
    const text = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
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
    return text
      .replace(/\s*[·|•]\s*\d[\d,]*\+?\s+people\s+clicked\s+apply.*/i, "")
      .replace(/\s*[·|•]\s*\d[\d,]*\+?\s+applicants?.*/i, "")
      .replace(
        /\s*[·|•]\s*\d+\s+(minute|hour|day|week|month|year)s?\s+ago.*/i,
        ""
      )
      .replace(/Promoted by hirer.*/i, "")
      .replace(/Responses managed.*/i, "")
      .trim();
  }

  /** Extractor fallbacks that must never wipe a real stored title/company/location. */
  function isPlaceholderField(kind, value) {
    const v = String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (!v) return true;
    if (kind === "title") {
      return (
        v === "job title not found" ||
        v === "untitled job" ||
        v === "not found" ||
        v === "n/a"
      );
    }
    if (kind === "company") {
      return (
        v === "company not found" ||
        v === "not found" ||
        v === "n/a" ||
        v === "unknown company"
      );
    }
    if (kind === "location") {
      return (
        v === "location not specified" ||
        v === "not specified" ||
        v === "n/a" ||
        v === "—" ||
        v === "-"
      );
    }
    return false;
  }

  function employerKindHaystack(job) {
    const bits = [];
    if (!job) return "";
    ["company", "title", "searchName", "location", "atsSummary", "notes"].forEach(
      function (k) {
        if (job[k]) bits.push(String(job[k]));
      }
    );
    if (job.companyDetails) {
      if (job.companyDetails.name) bits.push(String(job.companyDetails.name));
      if (job.companyDetails.industry)
        bits.push(String(job.companyDetails.industry));
    }
    if (job.atsDetails && typeof job.atsDetails === "object") {
      if (job.atsDetails.summary) bits.push(String(job.atsDetails.summary));
      if (job.atsDetails.company) bits.push(String(job.atsDetails.company));
    }
    return bits.join(" \n ");
  }

  /**
   * Soft local heuristics only — no LinkedIn People / company scrape.
   * Returns { employerKind, employerKindConfidence, employerKindReason }.
   */
  function classifyEmployerKind(job) {
    const company = String(
      (job && (job.company || (job.companyDetails && job.companyDetails.name))) ||
        ""
    ).trim();
    const title = String((job && job.title) || "").trim();
    const searchName = String((job && job.searchName) || "").trim();
    const hay = employerKindHaystack(job);

    if (company && JOB_BOARD_NAME_RE.test(company)) {
      return {
        employerKind: "job_board",
        employerKindConfidence: "high",
        employerKindReason: "Company name matches a known job board / marketplace",
      };
    }
    if (searchName && JOB_BOARD_NAME_RE.test(searchName)) {
      return {
        employerKind: "job_board",
        employerKindConfidence: "medium",
        employerKindReason: "Alert / search name looks like a job board",
      };
    }
    if (JOB_BOARD_NAME_RE.test(hay)) {
      return {
        employerKind: "job_board",
        employerKindConfidence: "medium",
        employerKindReason: "Job board signal in title, company, or summary",
      };
    }

    if (company && AGENCY_NAME_RE.test(company)) {
      return {
        employerKind: "agency",
        employerKindConfidence: "high",
        employerKindReason: "Company name looks like recruiting / staffing",
      };
    }
    if (title && AGENCY_TITLE_RE.test(title) && AGENCY_NAME_RE.test(hay)) {
      return {
        employerKind: "agency",
        employerKindConfidence: "medium",
        employerKindReason: "Title and listing text suggest a recruiting firm",
      };
    }
    if (AGENCY_NAME_RE.test(hay)) {
      return {
        employerKind: "agency",
        employerKindConfidence: "medium",
        employerKindReason: "Staffing / recruiting keywords in listing fields",
      };
    }

    if (
      company &&
      !isPlaceholderField("company", company) &&
      company.length >= 2
    ) {
      return {
        employerKind: "direct",
        employerKindConfidence: "medium",
        employerKindReason:
          "Listed company does not match agency or job-board patterns",
      };
    }

    return {
      employerKind: "unknown",
      employerKindConfidence: "low",
      employerKindReason: "Not enough signal to classify employer type",
    };
  }

  function applyEmployerKindFields(job) {
    if (!job) return job;
    const override = job.employerKindOverride;
    if (override && EMPLOYER_KINDS.indexOf(override) >= 0) {
      job.employerKind = override;
      job.employerKindConfidence = "high";
      job.employerKindReason = "Manual override";
      job.employerKindSource = "user";
      return job;
    }
    const c = classifyEmployerKind(job);
    job.employerKind = c.employerKind;
    job.employerKindConfidence = c.employerKindConfidence;
    job.employerKindReason = c.employerKindReason;
    job.employerKindSource = "auto";
    job.employerKindOverride = null;
    return job;
  }

  function employerKindLabel(kind) {
    const key = String(kind || "").trim();
    if (EMPLOYER_KIND_LABELS[key]) return EMPLOYER_KIND_LABELS[key];
    return EMPLOYER_KIND_LABELS.unknown;
  }

  /** Prefer real company name; never surface extractor placeholders. */
  function resolveCompanyName(job) {
    if (!job) return "";
    const company = String(job.company || "").trim();
    const detailName =
      job.companyDetails && job.companyDetails.name
        ? String(job.companyDetails.name).trim()
        : "";
    if (company && !isPlaceholderField("company", company)) return company;
    if (detailName && !isPlaceholderField("company", detailName))
      return detailName;
    return "";
  }

  /**
   * LinkedIn company page when known; otherwise company search.
   * Local only — no scrape.
   */
  function resolveCompanyUrl(job) {
    const name = resolveCompanyName(job);
    const raw =
      job && job.companyDetails && job.companyDetails.linkedinUrl
        ? String(job.companyDetails.linkedinUrl).trim()
        : "";
    if (raw && /linkedin\.com\/company\//i.test(raw)) {
      try {
        const u = new URL(raw, "https://www.linkedin.com");
        if (/linkedin\.com$/i.test(u.hostname) || /\.linkedin\.com$/i.test(u.hostname)) {
          return u.origin + u.pathname.replace(/\/$/, "");
        }
      } catch (e) {}
    }
    if (!name) return "";
    return (
      "https://www.linkedin.com/search/results/companies/?keywords=" +
      encodeURIComponent(name)
    );
  }

  function outreachTipForKind(kind) {
    switch (String(kind || "")) {
      case "agency":
        return "This looks like a recruiting or staffing listing. Follow up with the recruiter on the posting — company People pages usually point at the agency, not the client.";
      case "job_board":
        return "This looks like a job board or marketplace poster. Resolve the real employer from the job description before any warm outreach.";
      case "direct":
        return "Listed company looks like the hiring employer. Update tracker status as you apply. Contact enrichment is deferred (Phase 5B).";
      default:
        return "Employer type is unclear. Tag Agency, Job board, or Direct if you know — that keeps outreach aimed at the right org.";
    }
  }

  function normalizeJob(partial, existing) {
    const id = String(partial.id || (existing && existing.id) || "").trim();
    if (!id) return null;

    const base = existing || {
      id: id,
      title: "",
      company: "",
      location: "",
      url: jobUrl(id),
      viewedAt: now(),
      updatedAt: now(),
      atsScore: null,
      atsSummary: null,
      atsDetails: null,
      status: "viewed",
      statusSource: "auto",
      applicantCount: null,
      applicantUpdatedAt: null,
      expiredDetectedAt: null,
      notes: "",
      starred: false,
      starRating: 0,
      source: "viewed",
      companyDetails: null,
      searchName: null,
      alumni: [],
      contacts: [],
      employerKind: "unknown",
      employerKindConfidence: "low",
      employerKindReason: "",
      employerKindOverride: null,
      employerKindSource: "auto",
      feedPostUrl: null,
      feedAuthor: null,
      feedSnippet: null,
      feedDetectedAt: null,
      feedMatchKeywords: [],
      parentFeedKey: null,
    };

    const next = Object.assign({}, base);

    if (partial.title != null && String(partial.title).trim()) {
      const t = String(partial.title).trim();
      // Never overwrite a real title with extractor placeholders
      if (!isPlaceholderField("title", t)) {
        next.title = t;
      } else if (!existing || isPlaceholderField("title", existing.title)) {
        next.title = existing && existing.title ? existing.title : "";
      }
    }
    if (partial.company != null && String(partial.company).trim()) {
      const c = String(partial.company).trim();
      if (!isPlaceholderField("company", c)) {
        next.company = c;
      } else if (!existing || isPlaceholderField("company", existing.company)) {
        next.company = existing && existing.company ? existing.company : "";
      }
    }
    if (partial.location != null && String(partial.location).trim()) {
      const rawLoc = String(partial.location).trim();
      // Recover applicant count stuck inside LinkedIn meta blobs
      if (next.applicantCount == null && partial.applicantCount == null) {
        const fromLoc = parseApplicantCountFromText(rawLoc);
        if (fromLoc != null) {
          next.applicantCount = fromLoc;
          next.applicantUpdatedAt = now();
        }
      }
      if (!isPlaceholderField("location", rawLoc)) {
        next.location = cleanLocationText(rawLoc) || rawLoc;
      } else if (
        !existing ||
        isPlaceholderField("location", existing.location)
      ) {
        next.location = existing && existing.location ? existing.location : "";
      }
    }
    if (partial.feedPostUrl != null) {
      const fp = String(partial.feedPostUrl).trim();
      next.feedPostUrl = fp && !isUnusableTrackerUrl(fp) ? fp : null;
    }
    if (partial.feedAuthor != null) {
      next.feedAuthor = String(partial.feedAuthor).trim() || null;
    }
    if (partial.feedSnippet != null) {
      next.feedSnippet = String(partial.feedSnippet).trim().slice(0, 280) || null;
    }
    if (partial.feedDetectedAt != null) {
      next.feedDetectedAt = Number(partial.feedDetectedAt) || null;
    }
    if (Array.isArray(partial.feedMatchKeywords)) {
      next.feedMatchKeywords = partial.feedMatchKeywords
        .map(function (k) {
          return String(k || "").trim().toLowerCase();
        })
        .filter(Boolean)
        .slice(0, 20);
    }
    if (partial.parentFeedKey != null) {
      next.parentFeedKey = String(partial.parentFeedKey).trim() || null;
    }

    if (partial.url && !isUnusableTrackerUrl(partial.url)) {
      next.url = String(partial.url).trim();
    } else if (next.feedPostUrl && !isUnusableTrackerUrl(next.feedPostUrl)) {
      next.url = next.feedPostUrl;
    } else if (isUnusableTrackerUrl(next.url)) {
      // Repair bad feed defaults (jobs/view/feed:… or company/…/posts/)
      next.url = jobUrl(id) || "";
    } else if (!next.url) {
      next.url = jobUrl(id);
    }

    if (partial.atsScore != null && partial.atsScore !== "") {
      next.atsScore = Number(partial.atsScore);
    }
    if (partial.atsSummary != null) {
      next.atsSummary = String(partial.atsSummary).slice(0, 280);
    }
    if (partial.atsDetails != null && typeof partial.atsDetails === "object") {
      next.atsDetails = partial.atsDetails;
      if (next.atsScore == null && partial.atsDetails.overallScore != null) {
        next.atsScore = Number(partial.atsDetails.overallScore);
      }
      if (!next.atsSummary && partial.atsDetails.summary) {
        next.atsSummary = String(partial.atsDetails.summary).slice(0, 280);
      }
    }
    if (partial.applicantCount != null && partial.applicantCount !== "") {
      const n = Number(partial.applicantCount);
      if (!Number.isNaN(n)) {
        next.applicantCount = n;
        next.applicantUpdatedAt =
          partial.applicantUpdatedAt != null
            ? partial.applicantUpdatedAt
            : now();
      }
    } else if (partial.applicantUpdatedAt != null) {
      next.applicantUpdatedAt = partial.applicantUpdatedAt;
    }
    if (partial.notes != null) next.notes = String(partial.notes);
    if (partial.expiredDetectedAt != null) {
      next.expiredDetectedAt = partial.expiredDetectedAt;
    }
    if (typeof partial.starred === "boolean") next.starred = partial.starred;
    if (partial.starRating != null) next.starRating = clampRating(partial.starRating);
    if (partial.source && SOURCES.includes(partial.source)) {
      // Prefer more specific sources; don't downgrade ats/alert to viewed/feed on plain upserts
      if (
        !existing ||
        partial.source === "ats" ||
        (partial.source === "alert" && existing.source !== "ats") ||
        (partial.source === "feed" &&
          (!existing.source ||
            existing.source === "viewed" ||
            existing.source === "feed")) ||
        !existing.source
      ) {
        next.source = partial.source;
      }
    }
    if (partial.companyDetails && typeof partial.companyDetails === "object") {
      next.companyDetails = Object.assign(
        {},
        next.companyDetails || {},
        partial.companyDetails
      );
      // Never keep placeholder companyDetails.name when we have a real company
      if (
        next.companyDetails.name &&
        isPlaceholderField("company", next.companyDetails.name)
      ) {
        if (next.company && !isPlaceholderField("company", next.company)) {
          next.companyDetails.name = next.company;
        } else {
          next.companyDetails.name = "";
        }
      }
      if (
        !next.company &&
        next.companyDetails.name &&
        !isPlaceholderField("company", next.companyDetails.name)
      ) {
        next.company = String(next.companyDetails.name);
      }
      // Heal: real company on row but stale/missing details name
      if (
        next.company &&
        !isPlaceholderField("company", next.company) &&
        (!next.companyDetails.name ||
          isPlaceholderField("company", next.companyDetails.name))
      ) {
        next.companyDetails.name = next.company;
      }
      if (
        partial.companyDetails.linkedinUrl &&
        String(partial.companyDetails.linkedinUrl).trim()
      ) {
        next.companyDetails.linkedinUrl = String(
          partial.companyDetails.linkedinUrl
        ).trim();
      }
    } else if (
      next.company &&
      !isPlaceholderField("company", next.company) &&
      next.companyDetails &&
      isPlaceholderField("company", next.companyDetails.name)
    ) {
      next.companyDetails = Object.assign({}, next.companyDetails, {
        name: next.company,
      });
    }
    if (partial.searchName != null) {
      next.searchName = String(partial.searchName);
    }

    // Manual employer-kind override (or clear back to auto)
    if (partial.clearEmployerKindOverride) {
      next.employerKindOverride = null;
    } else if (
      Object.prototype.hasOwnProperty.call(partial, "employerKindOverride")
    ) {
      const ov = partial.employerKindOverride;
      if (ov == null || ov === "" || ov === "auto") {
        next.employerKindOverride = null;
      } else if (EMPLOYER_KINDS.indexOf(String(ov)) >= 0) {
        next.employerKindOverride = String(ov);
      }
    } else if (
      partial.employerKind != null &&
      partial.employerKindSource === "user" &&
      EMPLOYER_KINDS.indexOf(String(partial.employerKind)) >= 0
    ) {
      next.employerKindOverride = String(partial.employerKind);
    }

    // Never overwrite user-set status with auto upserts
    if (
      partial.status &&
      STATUSES.includes(partial.status) &&
      (partial.statusSource === "user" ||
        !existing ||
        existing.statusSource !== "user")
    ) {
      next.status = partial.status;
      if (partial.statusSource) next.statusSource = partial.statusSource;
    }

    if (!existing) {
      next.viewedAt = partial.viewedAt || now();
    } else if (partial.touchViewed) {
      next.viewedAt = now();
    }

    next.updatedAt = now();
    next.id = id;
    if (typeof next.starred !== "boolean") next.starred = false;
    if (next.starRating == null) next.starRating = 0;
    if (!next.source) next.source = "viewed";
    if (!Array.isArray(next.alumni)) next.alumni = [];
    if (!Array.isArray(next.contacts)) next.contacts = [];
    applyEmployerKindFields(next);
    return next;
  }

  async function readMap() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
      ? result[STORAGE_KEY]
      : {};
  }

  async function writeMap(map) {
    await chrome.storage.local.set({ [STORAGE_KEY]: map });
  }

  let alertNewMigratePromise = null;
  let applicantsLocMigratePromise = null;

  /**
   * One-time: alert rows wrongly marked auto-viewed → new.
   * User-set statuses are left alone.
   */
  async function migrateAlertViewedToNew() {
    if (alertNewMigratePromise) return alertNewMigratePromise;
    alertNewMigratePromise = (async function () {
      try {
        const result = await chrome.storage.local.get([
          ALERT_NEW_MIGRATE_KEY,
          STORAGE_KEY,
        ]);
        if (result[ALERT_NEW_MIGRATE_KEY]) return { migrated: 0, skipped: true };
        const map =
          result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
            ? result[STORAGE_KEY]
            : {};
        let migrated = 0;
        Object.keys(map).forEach(function (id) {
          const row = map[id];
          if (!row) return;
          if (
            row.source === "alert" &&
            row.statusSource !== "user" &&
            row.status === "viewed"
          ) {
            row.status = "new";
            row.statusSource = "auto";
            migrated++;
          }
        });
        const patch = {};
        patch[ALERT_NEW_MIGRATE_KEY] = true;
        if (migrated) patch[STORAGE_KEY] = map;
        await chrome.storage.local.set(patch);
        return { migrated: migrated, skipped: false };
      } catch (e) {
        console.warn("JobTrackerStore: alert→new migration failed", e);
        return { migrated: 0, skipped: true, error: e };
      }
    })();
    return alertNewMigratePromise;
  }

  /**
   * One-time: pull applicant counts out of polluted location blobs
   * (e.g. "APAC · 6 hours ago · 4 people clicked apply...") and clean location.
   */
  async function migrateApplicantsFromLocation() {
    if (applicantsLocMigratePromise) return applicantsLocMigratePromise;
    applicantsLocMigratePromise = (async function () {
      try {
        const result = await chrome.storage.local.get([
          APPLICANTS_LOC_MIGRATE_KEY,
          STORAGE_KEY,
        ]);
        if (result[APPLICANTS_LOC_MIGRATE_KEY]) {
          return { migrated: 0, skipped: true };
        }
        const map =
          result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
            ? result[STORAGE_KEY]
            : {};
        let migrated = 0;
        Object.keys(map).forEach(function (id) {
          const row = map[id];
          if (!row) return;
          const loc = row.location != null ? String(row.location) : "";
          let changed = false;
          if (loc) {
            const count = parseApplicantCountFromText(loc);
            if (
              count != null &&
              (row.applicantCount == null || row.applicantCount === "")
            ) {
              row.applicantCount = count;
              row.applicantUpdatedAt = now();
              changed = true;
            }
            const cleaned = cleanLocationText(loc);
            if (cleaned && cleaned !== loc) {
              row.location = cleaned;
              changed = true;
            }
          }
          if (changed) migrated++;
        });
        const patch = {};
        patch[APPLICANTS_LOC_MIGRATE_KEY] = true;
        if (migrated) patch[STORAGE_KEY] = map;
        await chrome.storage.local.set(patch);
        return { migrated: migrated, skipped: false };
      } catch (e) {
        console.warn(
          "JobTrackerStore: applicants-from-location migration failed",
          e
        );
        return { migrated: 0, skipped: true, error: e };
      }
    })();
    return applicantsLocMigratePromise;
  }

  let placeholderTitleMigratePromise = null;

  /**
   * One-time: restore titles/companies wiped by extractor placeholders
   * using ATS cache (and clear leftover placeholder strings).
   */
  async function migrateFixPlaceholderTitles() {
    if (placeholderTitleMigratePromise) return placeholderTitleMigratePromise;
    placeholderTitleMigratePromise = (async function () {
      try {
        const result = await chrome.storage.local.get([
          PLACEHOLDER_TITLE_MIGRATE_KEY,
          STORAGE_KEY,
          "ats_analysis_cache",
        ]);
        if (result[PLACEHOLDER_TITLE_MIGRATE_KEY]) {
          return { migrated: 0, skipped: true };
        }
        const map =
          result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
            ? result[STORAGE_KEY]
            : {};
        const cache = result.ats_analysis_cache || {};
        const byJobId = {};
        Object.keys(cache).forEach(function (key) {
          const entry = cache[key];
          if (!entry || !entry.jobId) return;
          const jid = String(entry.jobId);
          if (!byJobId[jid]) byJobId[jid] = entry;
          else if ((entry.timestamp || 0) > (byJobId[jid].timestamp || 0)) {
            byJobId[jid] = entry;
          }
        });
        let migrated = 0;
        Object.keys(map).forEach(function (id) {
          const row = map[id];
          if (!row) return;
          let changed = false;
          const cached = byJobId[id];
          if (isPlaceholderField("title", row.title)) {
            if (cached && cached.jobTitle) {
              row.title = String(cached.jobTitle).trim();
            } else {
              row.title = "";
            }
            changed = true;
          }
          if (isPlaceholderField("company", row.company)) {
            if (cached && cached.company) {
              row.company = String(cached.company).trim();
            } else {
              row.company = "";
            }
            changed = true;
          }
          if (isPlaceholderField("location", row.location)) {
            row.location = "";
            changed = true;
          }
          if (changed) migrated++;
        });
        const patch = {};
        patch[PLACEHOLDER_TITLE_MIGRATE_KEY] = true;
        if (migrated) patch[STORAGE_KEY] = map;
        await chrome.storage.local.set(patch);
        return { migrated: migrated, skipped: false };
      } catch (e) {
        console.warn(
          "JobTrackerStore: placeholder title migration failed",
          e
        );
        return { migrated: 0, skipped: true, error: e };
      }
    })();
    return placeholderTitleMigratePromise;
  }

  let companyFromTitleMigratePromise = null;

  /**
   * One-time: recover company from "Role | Company" titles when company is blank/placeholder.
   */
  function splitRoleAndCompany(rawTitle) {
    const t = String(rawTitle || "").trim();
    if (!t || t.indexOf("|") < 0) return { title: t, company: null };
    const parts = t
      .split(/\s*\|\s*/)
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean);
    if (parts.length < 2) return { title: t, company: null };
    const company = parts[parts.length - 1];
    const role = parts.slice(0, -1).join(" | ");
    if (
      !company ||
      company.length < 2 ||
      company.length > 80 ||
      /linkedin/i.test(company)
    ) {
      return { title: t, company: null };
    }
    return { title: role || t, company: company };
  }

  async function migrateCompanyFromTitle() {
    if (companyFromTitleMigratePromise) return companyFromTitleMigratePromise;
    companyFromTitleMigratePromise = (async function () {
      try {
        const result = await chrome.storage.local.get([
          COMPANY_FROM_TITLE_MIGRATE_KEY,
          STORAGE_KEY,
        ]);
        if (result[COMPANY_FROM_TITLE_MIGRATE_KEY]) {
          return { migrated: 0, skipped: true };
        }
        const map =
          result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
            ? result[STORAGE_KEY]
            : {};
        let migrated = 0;
        Object.keys(map).forEach(function (id) {
          const row = map[id];
          if (!row) return;
          if (!isPlaceholderField("company", row.company)) return;
          const split = splitRoleAndCompany(row.title);
          if (!split.company) return;
          row.company = split.company;
          if (split.title && split.title !== row.title) {
            row.title = split.title;
          }
          if (!row.companyDetails || !row.companyDetails.name) {
            row.companyDetails = {
              name: split.company,
              linkedinUrl: null,
              raw: null,
            };
          }
          row.updatedAt = now();
          migrated++;
        });
        const patch = {};
        patch[COMPANY_FROM_TITLE_MIGRATE_KEY] = true;
        if (migrated) patch[STORAGE_KEY] = map;
        await chrome.storage.local.set(patch);
        return { migrated: migrated, skipped: false };
      } catch (e) {
        console.warn("JobTrackerStore: company-from-title migration failed", e);
        return { migrated: 0, skipped: true, error: e };
      }
    })();
    return companyFromTitleMigratePromise;
  }

  let employerKindMigratePromise = null;

  /** One-time: backfill employerKind on existing tracker rows. */
  async function migrateEmployerKind() {
    if (employerKindMigratePromise) return employerKindMigratePromise;
    employerKindMigratePromise = (async function () {
      try {
        const result = await chrome.storage.local.get([
          EMPLOYER_KIND_MIGRATE_KEY,
          STORAGE_KEY,
        ]);
        if (result[EMPLOYER_KIND_MIGRATE_KEY]) {
          return { migrated: 0, skipped: true };
        }
        const map =
          result[STORAGE_KEY] && typeof result[STORAGE_KEY] === "object"
            ? result[STORAGE_KEY]
            : {};
        let migrated = 0;
        Object.keys(map).forEach(function (id) {
          const row = map[id];
          if (!row) return;
          applyEmployerKindFields(row);
          if (!Array.isArray(row.alumni)) row.alumni = [];
          if (!Array.isArray(row.contacts)) row.contacts = [];
          migrated++;
        });
        const patch = {};
        patch[EMPLOYER_KIND_MIGRATE_KEY] = true;
        if (migrated) patch[STORAGE_KEY] = map;
        await chrome.storage.local.set(patch);
        return { migrated: migrated, skipped: false };
      } catch (e) {
        console.warn("JobTrackerStore: employer-kind migration failed", e);
        return { migrated: 0, skipped: true, error: e };
      }
    })();
    return employerKindMigratePromise;
  }

  async function upsertJob(partial) {
    if (!partial || !partial.id) return null;
    const map = await readMap();
    const existing = map[String(partial.id)] || null;
    const next = normalizeJob(partial, existing);
    if (!next) return null;
    map[next.id] = next;
    await writeMap(map);
    return next;
  }

  async function updateAts(jobId, score, summary, atsDetails) {
    if (!jobId) return null;
    const patch = {
      id: String(jobId),
      atsScore: score,
      atsSummary: summary != null ? String(summary).slice(0, 280) : null,
      touchViewed: true,
      source: "ats",
    };
    if (atsDetails && typeof atsDetails === "object") {
      patch.atsDetails = atsDetails;
      if (score == null && atsDetails.overallScore != null) {
        patch.atsScore = atsDetails.overallScore;
      }
      if (!summary && atsDetails.summary) {
        patch.atsSummary = String(atsDetails.summary).slice(0, 280);
      }
    }
    return upsertJob(patch);
  }

  async function setStatus(jobId, status) {
    if (!jobId || !STATUSES.includes(status)) return null;
    return upsertJob({
      id: String(jobId),
      status: status,
      statusSource: "user",
    });
  }

  async function setStarred(jobId, starred) {
    if (!jobId) return null;
    const patch = {
      id: String(jobId),
      starred: !!starred,
    };
    // Clear legacy 1–5 rating when unfavoriting so the single-star UI stays in sync
    if (!starred) patch.starRating = 0;
    return upsertJob(patch);
  }

  async function setStarRating(jobId, rating) {
    if (!jobId) return null;
    const n = clampRating(rating);
    return upsertJob({
      id: String(jobId),
      starRating: n,
      starred: n > 0 ? true : undefined,
    });
  }

  /**
   * Set or clear employer-kind override.
   * Pass null / "" / "auto" to clear and reclassify.
   */
  async function setEmployerKind(jobId, kind) {
    if (!jobId) return null;
    const k = kind == null ? "" : String(kind).trim();
    if (!k || k === "auto") {
      return upsertJob({
        id: String(jobId),
        clearEmployerKindOverride: true,
      });
    }
    if (EMPLOYER_KINDS.indexOf(k) < 0) return null;
    return upsertJob({
      id: String(jobId),
      employerKindOverride: k,
      employerKindSource: "user",
    });
  }

  async function deleteJob(jobId) {
    if (!jobId) return false;
    const map = await readMap();
    const key = String(jobId);
    if (!map[key]) return false;
    delete map[key];
    await writeMap(map);
    return true;
  }

  async function deleteJobs(ids) {
    if (!ids || !ids.length) return 0;
    const map = await readMap();
    let removed = 0;
    ids.forEach(function (id) {
      const key = String(id);
      if (map[key]) {
        delete map[key];
        removed++;
      }
    });
    if (removed) await writeMap(map);
    return removed;
  }

  async function migrateRepairBadFeedUrls() {
    try {
      const map = await readMap();
      let changed = 0;
      Object.keys(map).forEach(function (k) {
        const row = map[k];
        if (!row) return;
        let dirty = false;
        if (row.feedPostUrl && isUnusableTrackerUrl(row.feedPostUrl)) {
          row.feedPostUrl = null;
          dirty = true;
        }
        if (isUnusableTrackerUrl(row.url)) {
          var nextUrl = "";
          if (row.feedPostUrl && !isUnusableTrackerUrl(row.feedPostUrl)) {
            nextUrl = row.feedPostUrl;
          } else {
            // Clear invented /jobs/view/feed:… — keep the tracker row
            nextUrl = jobUrl(row.id) || "";
          }
          // Only dirty when the value actually changes — empty→empty must NOT
          // rewrite storage (that remounts Job Tracker and kills the search box).
          if (String(row.url || "") !== String(nextUrl || "")) {
            row.url = nextUrl;
            dirty = true;
          }
        }
        // Remove orphan organic feed rows that never got a real post permalink
        // (legacy hash ids like feed:gpyc8a — Get link can never recover these)
        if (
          row.source === "feed" &&
          /^feed:[a-z0-9]{4,12}$/i.test(String(row.id || "")) &&
          isUnusableTrackerUrl(row.url) &&
          isUnusableTrackerUrl(row.feedPostUrl)
        ) {
          delete map[k];
          changed++;
          return;
        }
        // Clear company/author fields polluted with the LinkedIn viewer's profile
        if (
          row.source === "feed" &&
          /wpbakery|product marketing specialist|wordpress plugin growth/i.test(
            String(row.company || "") + " " + String(row.feedAuthor || "")
          )
        ) {
          if (row.company || row.feedAuthor || row.companyDetails) {
            row.company = "";
            row.feedAuthor = null;
            if (row.companyDetails) row.companyDetails = null;
            dirty = true;
          }
        }
        if (dirty) {
          row.updatedAt = now();
          map[k] = row;
          changed++;
        }
      });
      if (changed) await writeMap(map);
      return changed;
    } catch (e) {
      return 0;
    }
  }

  async function listJobs(filters) {
    await migrateAlertViewedToNew();
    await migrateApplicantsFromLocation();
    await migrateFixPlaceholderTitles();
    await migrateCompanyFromTitle();
    await migrateEmployerKind();
    await migrateRepairBadFeedUrls();
    const map = await readMap();
    let rows = Object.values(map).map(function (r) {
      // Recompute soft classification on view (respects override; no write)
      const copy = Object.assign({}, r);
      if (r.companyDetails && typeof r.companyDetails === "object") {
        copy.companyDetails = Object.assign({}, r.companyDetails);
      }
      applyEmployerKindFields(copy);
      const resolved = resolveCompanyName(copy);
      if (resolved) {
        if (!copy.company || isPlaceholderField("company", copy.company)) {
          copy.company = resolved;
        }
        if (
          copy.companyDetails &&
          isPlaceholderField("company", copy.companyDetails.name)
        ) {
          copy.companyDetails.name = resolved;
        }
      }
      return copy;
    });
    const f = filters || {};
    const status = f.status;
    const q = f.q ? String(f.q).trim().toLowerCase() : "";
    const recency = f.recency || "all";
    const dateKey = f.dateKey || "all";
    const starredOnly = !!f.starredOnly;
    const cutoff = now() - RECENT_MS;

    function toLocalDateKey(ts) {
      const d = new Date(ts || 0);
      if (Number.isNaN(d.getTime()) || !ts) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + day;
    }

    if (status && status !== "all" && STATUSES.includes(status)) {
      rows = rows.filter(function (r) {
        return r.status === status;
      });
    }
    if (q) {
      rows = rows.filter(function (r) {
        return (
          String(r.id || "")
            .toLowerCase()
            .includes(q) ||
          String(r.title || "")
            .toLowerCase()
            .includes(q) ||
          String(r.company || "")
            .toLowerCase()
            .includes(q) ||
          String(r.location || "")
            .toLowerCase()
            .includes(q) ||
          String(r.searchName || "")
            .toLowerCase()
            .includes(q) ||
          String(r.feedAuthor || "")
            .toLowerCase()
            .includes(q) ||
          String(r.feedSnippet || "")
            .toLowerCase()
            .includes(q) ||
          String(r.url || "")
            .toLowerCase()
            .includes(q) ||
          String(r.feedPostUrl || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }
    if (recency === "recent") {
      rows = rows.filter(function (r) {
        return (r.viewedAt || r.updatedAt || 0) >= cutoff;
      });
    } else if (recency === "old") {
      rows = rows.filter(function (r) {
        return (r.viewedAt || r.updatedAt || 0) < cutoff;
      });
    }
    if (dateKey && dateKey !== "all" && dateKey !== "custom") {
      let target = dateKey;
      if (dateKey === "today") target = toLocalDateKey(now());
      else if (dateKey === "yesterday") {
        target = toLocalDateKey(now() - 24 * 60 * 60 * 1000);
      }
      rows = rows.filter(function (r) {
        return toLocalDateKey(r.viewedAt || r.updatedAt) === target;
      });
    }
    const dateFrom = f.dateFrom ? String(f.dateFrom).trim() : "";
    const dateTo = f.dateTo ? String(f.dateTo).trim() : "";
    if (dateFrom || dateTo || dateKey === "custom") {
      function dayStartMs(key) {
        if (!key) return null;
        const parts = String(key).split("-");
        if (parts.length !== 3) return null;
        const d = new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2]),
          0,
          0,
          0,
          0
        );
        return Number.isNaN(d.getTime()) ? null : d.getTime();
      }
      function dayEndMs(key) {
        if (!key) return null;
        const parts = String(key).split("-");
        if (parts.length !== 3) return null;
        const d = new Date(
          Number(parts[0]),
          Number(parts[1]) - 1,
          Number(parts[2]),
          23,
          59,
          59,
          999
        );
        return Number.isNaN(d.getTime()) ? null : d.getTime();
      }
      const fromMs = dayStartMs(dateFrom);
      const toMs = dayEndMs(dateTo);
      rows = rows.filter(function (r) {
        const t = r.viewedAt || r.updatedAt || 0;
        if (!t) return false;
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
        // Custom selected but no bounds yet → show all until user picks dates
        if (!dateFrom && !dateTo && dateKey === "custom") return true;
        return true;
      });
    }
    if (starredOnly) {
      rows = rows.filter(function (r) {
        return !!r.starred || (r.starRating && r.starRating > 0);
      });
    }
    if (f.source && f.source !== "all" && SOURCES.indexOf(f.source) >= 0) {
      rows = rows.filter(function (r) {
        return String(r.source || "viewed") === f.source;
      });
    }
    if (
      f.employerKind &&
      f.employerKind !== "all" &&
      EMPLOYER_KINDS.indexOf(f.employerKind) >= 0
    ) {
      rows = rows.filter(function (r) {
        return String(r.employerKind || "unknown") === f.employerKind;
      });
    }

    rows.sort(function (a, b) {
      const starDiff =
        (b.starred || b.starRating > 0 ? 1 : 0) -
        (a.starred || a.starRating > 0 ? 1 : 0);
      if (starDiff) return starDiff;
      return (b.viewedAt || b.updatedAt || 0) - (a.viewedAt || a.updatedAt || 0);
    });
    return rows;
  }

  async function exportRows(opts) {
    const options = opts || {};
    if (options.ids && options.ids.length) {
      const map = await readMap();
      return options.ids
        .map(function (id) {
          return map[String(id)];
        })
        .filter(Boolean);
    }
    return listJobs(options.filters || options);
  }

  async function getJobsByIds(ids) {
    const map = await readMap();
    return (ids || [])
      .map(function (id) {
        return map[String(id)];
      })
      .filter(Boolean);
  }

  /**
   * Idempotent seed from ats_analysis_cache.
   */
  async function seedFromAtsCache(cacheObject) {
    const cache = cacheObject || {};
    const entries = Object.values(cache);
    if (!entries.length) {
      await chrome.storage.local.set({ [SEEDED_KEY]: true });
      return { created: 0, updated: 0 };
    }

    const map = await readMap();
    let created = 0;
    let updated = 0;

    entries.forEach(function (entry) {
      const id = entry && entry.jobId ? String(entry.jobId) : "";
      if (!id) return;
      const existing = map[id] || null;
      const score =
        entry.atsResult && entry.atsResult.overallScore != null
          ? entry.atsResult.overallScore
          : null;
      const summary =
        entry.atsResult && entry.atsResult.summary
          ? String(entry.atsResult.summary).slice(0, 280)
          : null;
      const atsDetails =
        entry.atsResult && typeof entry.atsResult === "object"
          ? entry.atsResult
          : null;

      if (!existing) {
        map[id] = normalizeJob(
          {
            id: id,
            title: entry.jobTitle || "",
            company: entry.company || "",
            companyDetails: entry.company
              ? { name: entry.company, linkedinUrl: null, raw: null }
              : null,
            atsScore: score,
            atsSummary: summary,
            atsDetails: atsDetails,
            viewedAt: entry.timestamp || now(),
            status: "viewed",
            statusSource: "auto",
            source: "ats",
          },
          null
        );
        created++;
      } else {
        const patch = { id: id };
        let changed = false;
        if (!existing.title && entry.jobTitle) {
          patch.title = entry.jobTitle;
          changed = true;
        }
        if (!existing.company && entry.company) {
          patch.company = entry.company;
          changed = true;
        }
        if (
          (existing.atsScore == null || existing.atsScore === "") &&
          score != null
        ) {
          patch.atsScore = score;
          changed = true;
        }
        if (!existing.atsSummary && summary) {
          patch.atsSummary = summary;
          changed = true;
        }
        if (!existing.atsDetails && atsDetails) {
          patch.atsDetails = atsDetails;
          patch.source = "ats";
          changed = true;
        }
        if (changed) {
          map[id] = normalizeJob(patch, existing);
          updated++;
        }
      }
    });

    await writeMap(map);
    await chrome.storage.local.set({ [SEEDED_KEY]: true });
    return { created: created, updated: updated };
  }

  async function ensureSeeded() {
    await migrateAlertViewedToNew();
    await migrateApplicantsFromLocation();
    await migrateFixPlaceholderTitles();
    await migrateCompanyFromTitle();
    const result = await chrome.storage.local.get([
      SEEDED_KEY,
      STORAGE_KEY,
      "ats_analysis_cache",
    ]);
    const map = result[STORAGE_KEY] || {};
    const empty = Object.keys(map).length === 0;
    // Re-seed atsDetails into existing rows that lack them
    if (result[SEEDED_KEY] && !empty) {
      const cache = result.ats_analysis_cache || {};
      let filled = 0;
      Object.values(cache).forEach(function (entry) {
        const id = entry && entry.jobId ? String(entry.jobId) : "";
        if (!id || !map[id]) return;
        if (!map[id].atsDetails && entry.atsResult) {
          map[id] = normalizeJob(
            { id: id, atsDetails: entry.atsResult, source: "ats" },
            map[id]
          );
          filled++;
        }
      });
      if (filled) await writeMap(map);
      return { created: 0, updated: filled, skipped: filled === 0 };
    }
    return seedFromAtsCache(result.ats_analysis_cache || {});
  }

  function exportHeaders() {
    return [
      "id",
      "title",
      "company",
      "location",
      "atsScore",
      "status",
      "starred",
      "starRating",
      "source",
      "applicantCount",
      "searchName",
      "viewedAt",
      "url",
      "notes",
    ];
  }

  function rowExportCells(r) {
    return [
      r.id,
      r.title,
      r.company,
      r.location,
      r.atsScore,
      r.status,
      r.starred ? "yes" : "no",
      r.starRating || 0,
      r.source || "",
      r.applicantCount,
      r.searchName || "",
      r.viewedAt ? new Date(r.viewedAt).toISOString() : "",
      r.url,
      r.notes,
    ];
  }

  function rowsToCsv(rows) {
    const headers = exportHeaders();
    function cell(v) {
      const s = v == null ? "" : String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    const lines = [headers.join(",")];
    rows.forEach(function (r) {
      lines.push(rowExportCells(r).map(cell).join(","));
    });
    return lines.join("\n");
  }

  function rowsToTsv(rows) {
    const headers = exportHeaders();
    const lines = [headers.join("\t")];
    rows.forEach(function (r) {
      lines.push(
        rowExportCells(r)
          .map(function (v) {
            return v == null
              ? ""
              : String(v).replace(/\t/g, " ").replace(/\n/g, " ");
          })
          .join("\t")
      );
    });
    return lines.join("\n");
  }

  async function getRefreshSettings() {
    const result = await chrome.storage.local.get([REFRESH_SETTINGS_KEY]);
    const settings = Object.assign(
      {},
      DEFAULT_REFRESH_SETTINGS,
      result[REFRESH_SETTINGS_KEY] || {}
    );
    return settings;
  }

  async function setRefreshSettings(partial) {
    const current = await getRefreshSettings();
    const next = Object.assign({}, current, partial || {});
    next.applicantCheckMinutes = Math.max(
      60,
      Math.min(1440, Number(next.applicantCheckMinutes) || 360)
    );
    next.expiryCheckMinutes = Math.max(
      120,
      Math.min(2880, Number(next.expiryCheckMinutes) || 720)
    );
    next.maxJobsPerTick = Math.max(
      1,
      Math.min(10, Number(next.maxJobsPerTick) || 3)
    );
    next.applicantCheckEnabled = !!next.applicantCheckEnabled;
    next.expiryCheckEnabled = !!next.expiryCheckEnabled;
    await chrome.storage.local.set({ [REFRESH_SETTINGS_KEY]: next });
    return next;
  }

  async function pickJobsForApplicantRefresh(limit) {
    const rows = await listJobs({ status: "all" });
    return rows
      .filter(function (r) {
        return (
          r.status === "viewed" ||
          r.status === "applied" ||
          r.starred ||
          (r.starRating && r.starRating > 0)
        );
      })
      .sort(function (a, b) {
        return (a.applicantUpdatedAt || 0) - (b.applicantUpdatedAt || 0);
      })
      .slice(0, limit || 3);
  }

  async function isTrackerEnabled() {
    try {
      if (typeof FeatureFlags !== "undefined") {
        return await FeatureFlags.isEnabled("jobTracker");
      }
    } catch (e) {}
    return true;
  }

  async function safeUpsert(partial) {
    try {
      if (!(await isTrackerEnabled())) return null;
      return await upsertJob(partial);
    } catch (e) {
      console.warn("JobTrackerStore: safeUpsert failed", e);
      return null;
    }
  }

  async function safeUpdateAts(jobId, score, summary, atsDetails) {
    try {
      if (!(await isTrackerEnabled())) return null;
      return await updateAts(jobId, score, summary, atsDetails);
    } catch (e) {
      console.warn("JobTrackerStore: safeUpdateAts failed", e);
      return null;
    }
  }

  function statusLabel(status) {
    const key = String(status || "").trim();
    if (STATUS_LABELS[key]) return STATUS_LABELS[key];
    if (!key) return "";
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  async function countByStatus() {
    const rows = await listJobs({ status: "all", q: "" });
    const counts = {};
    STATUSES.forEach(function (s) {
      counts[s] = 0;
    });
    let favorites = 0;
    rows.forEach(function (r) {
      const s = r && r.status ? String(r.status) : "viewed";
      if (counts[s] == null) counts[s] = 0;
      counts[s]++;
      if (r && (r.starred || (r.starRating && r.starRating > 0))) {
        favorites++;
      }
    });
    return {
      total: rows.length,
      counts: counts,
      applied: counts.applied || 0,
      interview: counts.interview || 0,
      confirmed: counts.confirmed || 0,
      rejected: counts.rejected || 0,
      favorites: favorites,
    };
  }

  global.JobTrackerStore = {
    STORAGE_KEY: STORAGE_KEY,
    REFRESH_SETTINGS_KEY: REFRESH_SETTINGS_KEY,
    STATUSES: STATUSES,
    STATUS_LABELS: STATUS_LABELS,
    SOURCES: SOURCES,
    EMPLOYER_KINDS: EMPLOYER_KINDS,
    EMPLOYER_KIND_LABELS: EMPLOYER_KIND_LABELS,
    EMPLOYER_KIND_CONFIDENCES: EMPLOYER_KIND_CONFIDENCES,
    DEFAULT_REFRESH_SETTINGS: DEFAULT_REFRESH_SETTINGS,
    RECENT_MS: RECENT_MS,
    statusLabel: statusLabel,
    employerKindLabel: employerKindLabel,
    resolveCompanyName: resolveCompanyName,
    resolveCompanyUrl: resolveCompanyUrl,
    resolveJobOpenUrl: resolveJobOpenUrl,
    isUnusableTrackerUrl: isUnusableTrackerUrl,
    jobUrl: jobUrl,
    repairBadFeedUrls: migrateRepairBadFeedUrls,
    outreachTipForKind: outreachTipForKind,
    classifyEmployerKind: classifyEmployerKind,
    applyEmployerKindFields: applyEmployerKindFields,
    isPlaceholderField: isPlaceholderField,
    countByStatus: countByStatus,
    upsertJob: upsertJob,
    updateAts: updateAts,
    setStatus: setStatus,
    setStarred: setStarred,
    setStarRating: setStarRating,
    setEmployerKind: setEmployerKind,
    deleteJob: deleteJob,
    deleteJobs: deleteJobs,
    listJobs: listJobs,
    exportRows: exportRows,
    getJobsByIds: getJobsByIds,
    seedFromAtsCache: seedFromAtsCache,
    ensureSeeded: ensureSeeded,
    migrateAlertViewedToNew: migrateAlertViewedToNew,
    migrateApplicantsFromLocation: migrateApplicantsFromLocation,
    migrateFixPlaceholderTitles: migrateFixPlaceholderTitles,
    migrateCompanyFromTitle: migrateCompanyFromTitle,
    migrateEmployerKind: migrateEmployerKind,
    parseApplicantCountFromText: parseApplicantCountFromText,
    cleanLocationText: cleanLocationText,
    rowsToCsv: rowsToCsv,
    rowsToTsv: rowsToTsv,
    getRefreshSettings: getRefreshSettings,
    setRefreshSettings: setRefreshSettings,
    pickJobsForApplicantRefresh: pickJobsForApplicantRefresh,
    safeUpsert: safeUpsert,
    safeUpdateAts: safeUpdateAts,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
