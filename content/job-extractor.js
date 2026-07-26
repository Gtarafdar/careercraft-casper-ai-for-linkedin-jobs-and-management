/**
 * LinkedIn Job Description Extractor
 * Extracts comprehensive job details from LinkedIn job postings
 */

class JobExtractor {
  constructor() {
    this.selectors = {
      title: [
        ".job-details-jobs-unified-top-card__job-title",
        "h1.job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        "h1.t-24.t-bold",
        "h1.t-24",
        ".jobs-details-top-card__job-title",
        "h1",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".jobs-details-top-card__company-name a",
        ".jobs-details-top-card__company-name",
        "a.job-details-jobs-unified-top-card__company-name",
      ],
      location: [
        ".job-details-jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__bullet",
        ".job-details-jobs-unified-top-card__primary-description-container",
        ".jobs-details-top-card__job-info .t-black--light",
      ],
      jobType: [
        ".job-details-jobs-unified-top-card__job-insight",
        ".jobs-unified-top-card__job-insight",
      ],
      description: [
        ".jobs-description__content",
        ".jobs-box__html-content",
        ".jobs-description-content__text",
        "#job-details",
        '[class*="jobs-description"]',
      ],
      criteria: [
        ".job-details-jobs-unified-top-card__job-insight",
        ".jobs-unified-top-card__job-insight-view-model-secondary",
      ],
    };
  }

  /**
   * Extract job data from current page
   */
  async extractJobData() {
    console.log("JobExtractor: Starting job extraction...");

    // Wait for job details to load
    await this.waitForElement(
      ".jobs-description__content, .jobs-box__html-content, #job-details, [class*='jobs-description'], h1.job-details-jobs-unified-top-card__job-title, h1.t-24",
      5000
    );

    let title = this.extractTitle();
    let company = this.extractCompany();
    // Description first — often contains "City · time ago · applicants" meta
    const description = await this.extractDescription();
    let location = this.extractLocation();

    const split = this.splitRoleAndCompany(title);
    if (split.company) {
      if (
        !company ||
        company.toLowerCase() === "company not found" ||
        company.toLowerCase() === "not found"
      ) {
        company = split.company;
      }
      if (split.title) title = split.title;
    }
    if (
      !location ||
      location.toLowerCase() === "location not specified" ||
      location.toLowerCase() === "not specified"
    ) {
      location =
        this.extractLocationFromText(description) ||
        this.extractLocationFromText(
          (document.body && document.body.innerText
            ? document.body.innerText.slice(0, 4000)
            : "") || ""
        ) ||
        location;
    }

    const jobData = {
      title: title,
      company: company,
      location: location,
      jobType: this.extractJobType(),
      experience: this.extractExperienceLevel(),
      description: description,
    };

    console.log("JobExtractor: Job data extracted:", jobData);
    return jobData;
  }

  /**
   * Split "Role | Company" titles used on many standalone LinkedIn job tabs.
   */
  splitRoleAndCompany(rawTitle) {
    const t = String(rawTitle || "").trim();
    if (!t || !t.includes("|")) return { title: t, company: null };
    const parts = t.split(/\s*\|\s*/).map(function (p) {
      return p.trim();
    }).filter(Boolean);
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

  /**
   * Pull location from LinkedIn meta lines:
   * "Dhaka, Dhaka, Bangladesh · 1 week ago · 4 people clicked apply"
   * Description previews may glue company/role in front of the city.
   */
  extractLocationFromText(raw) {
    const text = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return null;

    const clean = (loc) => {
      let out = String(loc || "").trim();
      if (
        typeof LinkedInDOM !== "undefined" &&
        LinkedInDOM.cleanLocationText
      ) {
        out = LinkedInDOM.cleanLocationText(out) || out;
      }
      if (
        !out ||
        out.length < 2 ||
        out.toLowerCase() === "location not specified" ||
        /applicant|clicked apply|promoted|hiring/i.test(out)
      ) {
        return null;
      }
      return out;
    };

    // Prefer "... City, Region, Country · N week ago"
    const meta = text.match(
      /([^\n·•]{3,140}?)\s*[·•]\s*(?:\d+\s+(?:minute|hour|day|week|month|year)s?\s+ago|[A-Za-z]+\s+ago|over\s+\d+|\d+\+?\s+people|\d+\+?\s+applicant|be among|promoted)/i
    );
    if (meta && meta[1]) {
      const before = meta[1].trim();
      // Trailing "City, Area, Country" (comma-separated place)
      let geo = before.match(
        /([A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*(?:,\s*[A-Z][A-Za-z.]+(?:[\s-][A-Za-z.]+)*){1,3})\s*$/
      );
      if (geo && geo[1]) {
        const cleaned = clean(geo[1]);
        if (cleaned) return cleaned;
      }
      // Trailing region codes / Remote
      geo = before.match(
        /\b((?:Remote(?:\s*[—–-]\s*[A-Za-z][\w\s-]{0,40})?)|APAC|EMEA|LATAM|Americas|Europe|Worldwide|United States|United Kingdom|Bangladesh|India|Canada|Australia)\s*$/i
      );
      if (geo && geo[1]) {
        const cleaned = clean(geo[1]);
        if (cleaned) return cleaned;
      }
      // Short pure location segment (no long role text)
      if (before.length <= 60 && !/\d{4,}/.test(before)) {
        const cleaned = clean(before);
        if (cleaned) return cleaned;
      }
    }

    const remote = text.match(
      /\b(Remote(?:\s*[—–-]\s*[A-Za-z][\w\s-]{0,40})?)\b/i
    );
    if (remote && remote[1]) {
      const cleaned = clean(remote[1]);
      if (cleaned) return cleaned;
    }

    return null;
  }

  /**
   * Wait for element to appear
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
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
   * Extract job title
   */
  extractTitle() {
    for (const selector of this.selectors.title) {
      const el = document.querySelector(selector);
      if (el) {
        const t = el.textContent.trim();
        if (
          t &&
          t.toLowerCase() !== "job title not found" &&
          t.length < 300
        ) {
          // Skip generic page chrome headings
          if (/^linkedin$/i.test(t)) continue;
          return t;
        }
      }
    }
    // document.title: "Company hiring Role in Place | LinkedIn"
    const docTitle = (document.title || "").trim();
    let m = docTitle.match(
      /^(.+?)\s+hiring\s+(.+?)\s+in\s+/i
    );
    if (m && m[2]) return m[2].trim();
    m = docTitle.match(/^(.+?)\s+\|\s+LinkedIn/i);
    if (m && m[1] && !/hiring/i.test(m[1])) return m[1].trim();
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) {
      const ogt = og.content.trim();
      const om = ogt.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+/i);
      if (om && om[2]) return om[2].trim();
      if (ogt && !/linkedin/i.test(ogt)) return ogt;
    }
    return "Job Title Not Found";
  }

  /**
   * Extract company name
   */
  extractCompany() {
    for (const selector of this.selectors.company) {
      const el = document.querySelector(selector);
      if (el) {
        const t = el.textContent.trim();
        if (t && t.toLowerCase() !== "company not found") return t;
      }
    }
    const docTitle = (document.title || "").trim();
    const m = docTitle.match(/^(.+?)\s+hiring\s+/i);
    if (m && m[1]) return m[1].trim();
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) {
      const om = og.content.trim().match(/^(.+?)\s+hiring\s+/i);
      if (om && om[1]) return om[1].trim();
    }
    // "Role | Company" / "Role | Company | LinkedIn"
    const fromPipe = this.splitRoleAndCompany(
      docTitle.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim()
    );
    if (fromPipe.company) return fromPipe.company;
    if (og && og.content) {
      const fromOg = this.splitRoleAndCompany(
        og.content.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim()
      );
      if (fromOg.company) return fromOg.company;
    }
    return "Company Not Found";
  }

  /**
   * Extract location
   */
  extractLocation() {
    const isMetaNoise = (text) =>
      /applicants?/i.test(text) ||
      /people\s+clicked\s+apply/i.test(text) ||
      /people\s+applied/i.test(text) ||
      /reposted/i.test(text) ||
      /promoted by hirer/i.test(text) ||
      /responses managed/i.test(text);

    const clean = (text) => {
      if (
        typeof LinkedInDOM !== "undefined" &&
        LinkedInDOM.cleanLocationText
      ) {
        return LinkedInDOM.cleanLocationText(text);
      }
      return String(text || "").trim();
    };

    for (const selector of this.selectors.location) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        if (!text) continue;
        // Primary description often includes time + applicants — clean it
        if (isMetaNoise(text) || /[·|•]/.test(text)) {
          const cleaned = clean(text);
          if (cleaned) return cleaned;
          continue;
        }
        return text;
      }
    }

    // Alternative: look for location in bullets
    const bullets = document.querySelectorAll(
      ".jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__bullet"
    );
    for (const bullet of bullets) {
      const text = bullet.textContent.trim();
      if (!text) continue;
      if (isMetaNoise(text) || /[·|•]/.test(text)) {
        const cleaned = clean(text);
        if (cleaned) return cleaned;
        continue;
      }
      return text;
    }

    // Standalone /jobs/view pages often omit classic location selectors
    try {
      const bodySlice =
        document.body && document.body.innerText
          ? document.body.innerText.slice(0, 3500)
          : "";
      const fromBody = this.extractLocationFromText(bodySlice);
      if (fromBody) return fromBody;
    } catch (e) {}

    return "Location Not Specified";
  }

  /**
   * Extract job type (Full-time, Part-time, etc.)
   */
  extractJobType() {
    const insights = document.querySelectorAll(
      ".jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight"
    );

    for (const insight of insights) {
      const text = insight.textContent.trim();
      if (
        text.match(
          /full-time|part-time|contract|temporary|volunteer|internship/i
        )
      ) {
        return text;
      }
    }

    return "Not Specified";
  }

  /**
   * Extract experience level
   */
  extractExperienceLevel() {
    const criteriaContainer = document.querySelector(
      ".jobs-unified-top-card__job-insight-view-model-secondary"
    );

    if (criteriaContainer) {
      const items = criteriaContainer.querySelectorAll("li");
      for (const item of items) {
        const text = item.textContent.trim();
        if (
          text.match(
            /entry level|associate|mid-senior|director|executive|internship/i
          )
        ) {
          return text;
        }
      }
    }

    // Alternative: check in description
    const description = document.querySelector(".jobs-description__content");
    if (description) {
      const text = description.textContent;
      const experienceMatch = text.match(
        /(\d+)\+?\s*years?\s*of\s*experience/i
      );
      if (experienceMatch) {
        return `${experienceMatch[1]}+ years experience`;
      }
    }

    return "Not Specified";
  }

  /**
   * Extract full job description with smart auto-expansion
   */
  async extractDescription() {
    console.log("JobExtractor: Starting description extraction...");

    // Auto-expand "… more" / see more on standalone + search panes
    const expandInfo = await this.autoExpandShowMore();
    // Give LinkedIn time to swap truncated → full DOM after click
    if (expandInfo && expandInfo.clicked) {
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    const descriptionSelectors = [
      ".job-details-about-the-job-module__description .feed-shared-inline-show-more-text",
      ".job-details-about-the-job-module__description",
      ".jobs-description__content .jobs-box__html-content",
      ".jobs-description__content",
      ".jobs-box__html-content",
      "#job-details",
      "article.jobs-description__container",
      "[class*='about-the-job'] [class*='description']",
      "[class*='about-the-job']",
      "[class*='jobs-description']",
      ".jobs-description",
      "[class*='job-details'] [class*='description']",
    ];

    let descriptionEl = null;
    for (const selector of descriptionSelectors) {
      try {
        descriptionEl = document.querySelector(selector);
      } catch (e) {
        descriptionEl = null;
      }
      if (descriptionEl && descriptionEl.textContent.trim().length > 80) {
        console.log("JobExtractor: Found description using:", selector);
        break;
      }
      descriptionEl = null;
    }

    // Prefer the expanded show-more container we just clicked
    if (
      !descriptionEl &&
      expandInfo &&
      expandInfo.container &&
      expandInfo.container.isConnected
    ) {
      const fromExpand = expandInfo.container;
      if (fromExpand.textContent && fromExpand.textContent.trim().length > 80) {
        descriptionEl = fromExpand;
        console.log("JobExtractor: Using expand-control container for JD");
      }
    }

    // "About the job" heading → following content
    if (!descriptionEl) {
      const headings = document.querySelectorAll("h2, h3, h4, strong");
      for (let i = 0; i < headings.length; i++) {
        const h = headings[i];
        const ht = (h.textContent || "").trim().toLowerCase();
        if (ht === "about the job" || ht.startsWith("about the job")) {
          let node =
            h.parentElement && h.parentElement.nextElementSibling
              ? h.parentElement.nextElementSibling
              : h.nextElementSibling;
          if (!node && h.parentElement) node = h.parentElement;
          // Walk up to a sizable section
          let section = node;
          for (let u = 0; u < 4 && section; u++) {
            if ((section.textContent || "").trim().length > 120) {
              descriptionEl = section;
              console.log("JobExtractor: Found JD via About the job heading");
              break;
            }
            section = section.parentElement;
          }
          if (descriptionEl) break;
        }
      }
    }

    // Largest text block in main (standalone /jobs/view hashed DOM)
    if (!descriptionEl) {
      const root =
        document.querySelector("main") ||
        document.querySelector(".scaffold-layout__detail") ||
        document.body;
      let best = null;
      let bestLen = 0;
      const blocks = root.querySelectorAll(
        "section, article, div[class*='description'], div[class*='details']"
      );
      for (let i = 0; i < blocks.length; i++) {
        const el = blocks[i];
        if (!el || el.querySelector(".lf-job-stats-box")) continue;
        const text = (el.innerText || el.textContent || "").trim();
        if (text.length < 200) continue;
        // Prefer blocks that look like job posts
        const score =
          text.length +
          (/responsibilit|qualification|requirement|experience|salary/i.test(
            text
          )
            ? 500
            : 0);
        if (score > bestLen) {
          bestLen = score;
          best = el;
        }
      }
      if (best) {
        descriptionEl = best;
        console.log(
          "JobExtractor: Using largest main text block for JD, score=",
          bestLen
        );
      }
    }

    if (!descriptionEl) {
      console.log("JobExtractor: Description element not found");
      return "Description not available";
    }

    console.log("JobExtractor: Extracting text content...");
    let description = "";
    const contentSections = descriptionEl.querySelectorAll("p, li, h3, h4");
    if (contentSections.length > 0) {
      description = Array.from(contentSections)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0)
        .join(" ");
    } else {
      description = (descriptionEl.innerText || descriptionEl.textContent || "")
        .trim();
    }

    description = description
      .replace(/\s+/g, " ")
      .replace(/Show less/gi, "")
      .replace(/Show more/gi, "")
      .replace(/See more/gi, "")
      .replace(/See less/gi, "")
      .replace(/\s*\u2026?\s*more\s*$/i, "")
      .replace(/\s*…\s*more\s*$/i, "")
      .trim();

    if (description.length > 8000) {
      description = description.substring(0, 8000) + "... [truncated]";
    }

    console.log(
      `JobExtractor: Extracted description (${description.length} chars)`
    );
    return description || "Description not available";
  }

  /**
   * Wait for element to appear in DOM
   */
  waitForElement(selector, timeout = 3000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
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
   * Smart auto-expansion of "show more" / "more" controls in the job description.
   * Standalone /jobs/view pages often use a plain <span>more</span> (not "see more").
   */
  async autoExpandShowMore() {
    console.log("JobExtractor: Looking for show more button...");

    const toggleSelectors = [
      ".feed-shared-inline-show-more-text__see-more-less-toggle",
      "button.feed-shared-inline-show-more-text__see-more-less-toggle",
      ".inline-show-more-text__button",
      ".jobs-description__footer button",
      ".jobs-box__html-content button",
      "[class*='show-more-text'] button",
      "[class*='show-more-text'] span",
      "[class*='see-more']",
      ".jobs-description button",
      ".jobs-description span",
      "#job-details button",
      "#job-details span",
      "[class*='about-the-job'] button",
      "[class*='about-the-job'] span",
      "[class*='jobs-description'] button",
      "[class*='jobs-description'] span",
    ];

    const isExpandLabel = (raw) => {
      const t = String(raw || "")
        .replace(/\u2026/g, "...")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (!t) return false;
      if (t.includes("less")) return false; // already expanded
      if (t === "more" || t === "...more" || t === "…more") return true;
      if (t === "see more" || t === "show more") return true;
      if (/^(see|show)\s+more$/.test(t)) return true;
      // LinkedIn sometimes prefixes with ellipsis: "… more"
      if (/^\.{0,3}\s*more$/.test(t)) return true;
      return false;
    };

    const scopeRoots = [
      document.querySelector(".jobs-description__content"),
      document.querySelector(".jobs-box__html-content"),
      document.querySelector("#job-details"),
      document.querySelector("[class*='about-the-job']"),
      document.querySelector("[class*='jobs-description']"),
      document.querySelector(".jobs-details__main-content"),
      document.querySelector("main"),
      document.body,
    ].filter(Boolean);

    let button = null;
    // Prefer waiting for classic toggle first (search pane)
    button = await this.waitForElement(toggleSelectors[0], 1500);
    if (button && !isExpandLabel(button.textContent)) {
      button = null;
    }

    if (!button) {
      for (let r = 0; r < scopeRoots.length && !button; r++) {
        const root = scopeRoots[r];
        for (let s = 0; s < toggleSelectors.length && !button; s++) {
          let nodes = [];
          try {
            nodes = Array.from(root.querySelectorAll(toggleSelectors[s]));
          } catch (e) {
            nodes = [];
          }
          for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            if (!el || !el.isConnected) continue;
            if (isExpandLabel(el.textContent)) {
              button = el;
              break;
            }
          }
        }
        // Last resort in this root: any clickable whose trimmed text is "more"
        if (!button) {
          const candidates = root.querySelectorAll(
            "button, span, a, [role='button']"
          );
          for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            const t = (el.textContent || "").trim();
            // Avoid huge containers — expand control is a tiny leaf-ish node
            if (t.length > 24) continue;
            if (isExpandLabel(t)) {
              button = el;
              break;
            }
          }
        }
      }
    }

    if (button) {
      console.log(
        "JobExtractor: ✅ Found expand control, clicking:",
        button.textContent.trim()
      );
      try {
        button.scrollIntoView({ behavior: "smooth", block: "center" });
        await new Promise((resolve) => setTimeout(resolve, 200));
        // Prefer clicking the nearest button/role if the match was an inner span
        const clickTarget =
          button.closest("button, [role='button'], a") || button;
        const container =
          clickTarget.closest(
            "[class*='show-more-text'], [class*='description'], [class*='about-the-job'], section, article"
          ) ||
          clickTarget.parentElement ||
          clickTarget;
        clickTarget.click();
        console.log("JobExtractor: ✅ Expand control clicked!");
        await new Promise((resolve) => setTimeout(resolve, 800));

        const expandedContent = document.querySelector(
          ".feed-shared-inline-show-more-text--expanded, .inline-show-more-text--is-expanded, [class*='show-more-text'][class*='expanded']"
        );
        if (expandedContent) {
          console.log("JobExtractor: ✅ Content successfully expanded!");
        }
        return {
          clicked: true,
          container: expandedContent || container,
        };
      } catch (e) {
        console.error("JobExtractor: Error clicking expand control:", e);
      }
    } else {
      console.log(
        "JobExtractor: Expand control not found (might already be expanded)"
      );
    }
    return { clicked: false, container: null };
  }

  /**
   * Parse job description into sections
   */
  parseJobSections(text) {
    const sections = {};
    const lowerText = text.toLowerCase();

    // Common section headers
    const sectionPatterns = {
      responsibilities: /responsibilities:|what you'll do:|your role:/i,
      qualifications: /qualifications:|requirements:|what we're looking for:/i,
      requirements: /requirements:|must have:|required skills:/i,
      benefits: /benefits:|what we offer:|perks:/i,
      about: /about (the |this )?(role|position|job):|job description:/i,
    };

    return sections;
  }

  /**
   * Check if we're on a job details page
   */
  isJobDetailsPage() {
    return (
      window.location.href.includes("/jobs/view/") ||
      window.location.href.includes("/jobs/collections/")
    );
  }
}
