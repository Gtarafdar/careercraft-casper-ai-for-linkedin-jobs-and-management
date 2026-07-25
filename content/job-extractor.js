/**
 * LinkedIn Job Description Extractor
 * Extracts comprehensive job details from LinkedIn job postings
 */

class JobExtractor {
  constructor() {
    this.selectors = {
      title: [
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        "h1.t-24.t-bold",
        ".jobs-details-top-card__job-title",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".jobs-details-top-card__company-name a",
      ],
      location: [
        ".job-details-jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__bullet",
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
      ".jobs-description__content, .jobs-box__html-content",
      5000
    );

    const jobData = {
      title: this.extractTitle(),
      company: this.extractCompany(),
      location: this.extractLocation(),
      jobType: this.extractJobType(),
      experience: this.extractExperienceLevel(),
      description: await this.extractDescription(),
    };

    console.log("JobExtractor: Job data extracted:", jobData);
    return jobData;
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
        return el.textContent.trim();
      }
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
        return el.textContent.trim();
      }
    }
    return "Company Not Found";
  }

  /**
   * Extract location
   */
  extractLocation() {
    for (const selector of this.selectors.location) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.trim();
        // Filter out non-location text
        if (
          text &&
          !text.includes("applicants") &&
          !text.includes("reposted")
        ) {
          return text;
        }
      }
    }

    // Alternative: look for location in bullets
    const bullets = document.querySelectorAll(
      ".jobs-unified-top-card__bullet, .job-details-jobs-unified-top-card__bullet"
    );
    for (const bullet of bullets) {
      const text = bullet.textContent.trim();
      if (text && !text.includes("applicants") && !text.includes("reposted")) {
        return text;
      }
    }

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

    // Auto-expand "show more" button immediately on page load
    await this.autoExpandShowMore();

    // Now find and extract the full description
    const descriptionSelectors = [
      ".job-details-about-the-job-module__description .feed-shared-inline-show-more-text",
      ".job-details-about-the-job-module__description",
      ".jobs-description__content",
      ".jobs-box__html-content",
    ];

    let descriptionEl = null;
    for (const selector of descriptionSelectors) {
      descriptionEl = document.querySelector(selector);
      if (descriptionEl) {
        console.log("JobExtractor: Found description using:", selector);
        break;
      }
    }

    if (!descriptionEl) {
      console.log("JobExtractor: Description element not found");
      return "Description not available";
    }

    // Extract text content with better structure preservation
    console.log("JobExtractor: Extracting text content...");
    let description = "";

    // Try to get structured content
    const contentSections = descriptionEl.querySelectorAll("p, li, h3, h4");
    if (contentSections.length > 0) {
      description = Array.from(contentSections)
        .map((el) => el.textContent.trim())
        .filter((text) => text.length > 0)
        .join(" ");
    } else {
      description = descriptionEl.textContent.trim();
    }

    // Clean up the description
    description = description
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/Show less/gi, "")
      .replace(/Show more/gi, "")
      .replace(/See more/gi, "")
      .replace(/See less/gi, "")
      .trim();

    // Extract key sections if identifiable
    const sections = this.parseJobSections(description);
    if (
      sections.responsibilities ||
      sections.qualifications ||
      sections.requirements
    ) {
      const structured = [];
      if (sections.about) structured.push(`About: ${sections.about}`);
      if (sections.responsibilities)
        structured.push(`Responsibilities: ${sections.responsibilities}`);
      if (sections.qualifications)
        structured.push(`Qualifications: ${sections.qualifications}`);
      if (sections.requirements)
        structured.push(`Requirements: ${sections.requirements}`);
      if (sections.benefits) structured.push(`Benefits: ${sections.benefits}`);

      if (structured.length > 0) {
        description = structured.join(" | ");
      }
    }

    // Limit length to avoid token limits (8000 chars to keep more details)
    if (description.length > 8000) {
      description = description.substring(0, 8000) + "... [truncated]";
    }

    console.log(
      `JobExtractor: Extracted description (${description.length} chars)`
    );
    return description;
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
   * Smart auto-expansion of "show more" button
   */
  async autoExpandShowMore() {
    console.log("JobExtractor: Looking for show more button...");

    // Exact selector from user's HTML structure
    const exactSelector =
      ".feed-shared-inline-show-more-text__see-more-less-toggle";

    // Wait for button to appear (max 3 seconds)
    const button = await this.waitForElement(exactSelector, 3000);

    if (button) {
      const buttonText = button.textContent.trim().toLowerCase();
      // Check if it's the "show more" button (not "show less")
      if (buttonText.includes("show more") || buttonText.includes("see more")) {
        console.log(
          "JobExtractor: ✅ Found show more button, clicking automatically..."
        );
        try {
          // Scroll into view
          button.scrollIntoView({ behavior: "smooth", block: "center" });
          await new Promise((resolve) => setTimeout(resolve, 200));

          // Click the button
          button.click();
          console.log("JobExtractor: ✅ Show more button clicked!");

          // Wait for content to expand
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Verify expansion
          const expandedContent = document.querySelector(
            ".feed-shared-inline-show-more-text--expanded"
          );
          if (expandedContent) {
            console.log("JobExtractor: ✅ Content successfully expanded!");
          }

          return true;
        } catch (e) {
          console.error("JobExtractor: Error clicking button:", e);
        }
      } else {
        console.log(
          "JobExtractor: Content already expanded (show less visible)"
        );
      }
    } else {
      console.log(
        "JobExtractor: Show more button not found (might already be expanded)"
      );
    }
    return false;
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
