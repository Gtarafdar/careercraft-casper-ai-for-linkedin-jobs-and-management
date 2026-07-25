/**
 * Shared helpers for saved LinkedIn job searches (popup + options).
 */
(function (global) {
  const MAX_SAVED_SEARCHES = 5;

  const WORKPLACE_LABELS = {
    "1": "On-site",
    "2": "Remote",
    "3": "Hybrid",
  };

  const TIME_POSTED_LABELS = {
    r3600: "Past hour",
    r86400: "Past 24 hours",
    r604800: "Past week",
    r2592000: "Past month",
  };

  const EXPERIENCE_LABELS = {
    "1": "Internship",
    "2": "Entry level",
    "3": "Associate",
    "4": "Mid-Senior",
    "5": "Director",
    "6": "Executive",
  };

  const JOB_TYPE_LABELS = {
    F: "Full-time",
    P: "Part-time",
    C: "Contract",
    T: "Temporary",
    I: "Internship",
    V: "Volunteer",
  };

  function splitCsv(value) {
    if (!value) return [];
    return String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function mapCsvLabels(value, map) {
    return splitCsv(value)
      .map((k) => map[k] || k)
      .filter(Boolean);
  }

  function workplaceLabels(workplaceType) {
    return mapCsvLabels(workplaceType, WORKPLACE_LABELS);
  }

  /**
   * Extract LinkedIn job search params from a URL.
   */
  function extractSearchParamsFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      return {
        keywords: params.get("keywords") || "",
        location: params.get("location") || "",
        geoId: params.get("geoId") || "",
        filters: {
          timePosted: params.get("f_TPR") || "",
          experienceLevel: params.get("f_E") || "",
          jobType: params.get("f_JT") || "",
          workplaceType: params.get("f_WT") || "",
        },
      };
    } catch (e) {
      return {
        keywords: "",
        location: "",
        geoId: "",
        filters: {
          timePosted: "",
          experienceLevel: "",
          jobType: "",
          workplaceType: "",
        },
      };
    }
  }

  /**
   * Build LinkedIn search URL from structured params.
   */
  function buildSearchUrl(params) {
    const urlParams = new URLSearchParams();
    if (params.keywords) urlParams.set("keywords", params.keywords);
    if (params.location && !/^remote$/i.test(params.location.trim())) {
      urlParams.set("location", params.location);
    }
    if (params.geoId) urlParams.set("geoId", params.geoId);
    const filters = params.filters || {};
    if (filters.timePosted) urlParams.set("f_TPR", filters.timePosted);
    if (filters.experienceLevel) urlParams.set("f_E", filters.experienceLevel);
    if (filters.jobType) urlParams.set("f_JT", filters.jobType);
    if (filters.workplaceType) urlParams.set("f_WT", filters.workplaceType);
    return "https://www.linkedin.com/jobs/search/?" + urlParams.toString();
  }

  /**
   * Normalize location + filters so Remote (f_WT=2) is preserved.
   */
  function normalizeSearchFields({
    keywords = "",
    location = "",
    geoId = "",
    filters = {},
    url = "",
  } = {}) {
    const fromUrl = url ? extractSearchParamsFromUrl(url) : null;
    const mergedFilters = {
      timePosted:
        (filters && filters.timePosted) ||
        (fromUrl && fromUrl.filters.timePosted) ||
        "",
      experienceLevel:
        (filters && filters.experienceLevel) ||
        (fromUrl && fromUrl.filters.experienceLevel) ||
        "",
      jobType:
        (filters && filters.jobType) ||
        (fromUrl && fromUrl.filters.jobType) ||
        "",
      workplaceType:
        (filters && filters.workplaceType) ||
        (fromUrl && fromUrl.filters.workplaceType) ||
        "",
    };

    let loc = (location || (fromUrl && fromUrl.location) || "").trim();
    const kw = (keywords || (fromUrl && fromUrl.keywords) || "").trim();
    const gid = geoId || (fromUrl && fromUrl.geoId) || "";

    // Typed "Remote" → workplace filter
    if (/^remote$/i.test(loc) && !mergedFilters.workplaceType) {
      mergedFilters.workplaceType = "2";
    }
    if (/^hybrid$/i.test(loc) && !mergedFilters.workplaceType) {
      mergedFilters.workplaceType = "3";
    }
    if (/^on-?site$/i.test(loc) && !mergedFilters.workplaceType) {
      mergedFilters.workplaceType = "1";
    }

    // Empty location but workplace set → friendly label (Remote etc.)
    if (!loc && mergedFilters.workplaceType) {
      const labels = workplaceLabels(mergedFilters.workplaceType);
      if (labels.length) loc = labels.join(", ");
    }

    // If location is only a workplace label, prefer f_WT over location= in URL
    let urlLocation = loc;
    if (/^(remote|hybrid|on-?site)(,\s*(remote|hybrid|on-?site))*$/i.test(loc)) {
      urlLocation = "";
    }

    const finalUrl =
      url && String(url).includes("linkedin.com/jobs/search")
        ? (() => {
            try {
              const u = new URL(url);
              if (kw) u.searchParams.set("keywords", kw);
              else u.searchParams.delete("keywords");
              if (urlLocation) u.searchParams.set("location", urlLocation);
              else u.searchParams.delete("location");
              if (gid) u.searchParams.set("geoId", gid);
              if (mergedFilters.timePosted)
                u.searchParams.set("f_TPR", mergedFilters.timePosted);
              else u.searchParams.delete("f_TPR");
              if (mergedFilters.experienceLevel)
                u.searchParams.set("f_E", mergedFilters.experienceLevel);
              else u.searchParams.delete("f_E");
              if (mergedFilters.jobType)
                u.searchParams.set("f_JT", mergedFilters.jobType);
              else u.searchParams.delete("f_JT");
              if (mergedFilters.workplaceType)
                u.searchParams.set("f_WT", mergedFilters.workplaceType);
              else u.searchParams.delete("f_WT");
              u.searchParams.delete("currentJobId");
              return u.toString();
            } catch (e) {
              return buildSearchUrl({
                keywords: kw,
                location: urlLocation,
                geoId: gid,
                filters: mergedFilters,
              });
            }
          })()
        : buildSearchUrl({
            keywords: kw,
            location: urlLocation,
            geoId: gid,
            filters: mergedFilters,
          });

    return {
      keywords: kw,
      location: loc,
      geoId: gid,
      filters: mergedFilters,
      url: finalUrl,
    };
  }

  /**
   * Human-readable location for lists (Remote instead of All Locations).
   */
  function getLocationDisplay(search) {
    if (!search) return "All Locations";
    if (search.location && String(search.location).trim()) {
      return String(search.location).trim();
    }
    const wt =
      (search.filters && search.filters.workplaceType) ||
      (search.url
        ? extractSearchParamsFromUrl(search.url).filters.workplaceType
        : "") ||
      "";
    const labels = workplaceLabels(wt);
    if (labels.length) return labels.join(", ");
    return "All Locations";
  }

  /**
   * Extra criteria line (time posted, job type, experience).
   */
  function getCriteriaSummary(search) {
    if (!search) return "";
    const filters =
      search.filters && Object.keys(search.filters).length
        ? search.filters
        : search.url
          ? extractSearchParamsFromUrl(search.url).filters
          : {};
    const parts = [];
    if (filters.timePosted) {
      parts.push(
        TIME_POSTED_LABELS[filters.timePosted] || filters.timePosted
      );
    }
    const exp = mapCsvLabels(filters.experienceLevel, EXPERIENCE_LABELS);
    if (exp.length) parts.push(exp.join(", "));
    const jt = mapCsvLabels(filters.jobType, JOB_TYPE_LABELS);
    if (jt.length) parts.push(jt.join(", "));
    // Workplace already shown in location when derived; only add if location is a geo name
    const loc = (search.location || "").trim();
    const wtLabels = workplaceLabels(filters.workplaceType);
    if (
      wtLabels.length &&
      loc &&
      !/^(remote|hybrid|on-?site)/i.test(loc)
    ) {
      parts.push(wtLabels.join(", "));
    }
    return parts.join(" · ");
  }

  function getDetailsLine(search) {
    const keywords = (search && search.keywords) || "All Jobs";
    const location = getLocationDisplay(search);
    const criteria = getCriteriaSummary(search);
    return criteria
      ? `${keywords} • ${location} • ${criteria}`
      : `${keywords} • ${location}`;
  }

  global.SavedSearchUtils = {
    MAX_SAVED_SEARCHES,
    extractSearchParamsFromUrl,
    buildSearchUrl,
    normalizeSearchFields,
    getLocationDisplay,
    getCriteriaSummary,
    getDetailsLine,
    workplaceLabels,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
