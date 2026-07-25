/**
 * LinkedIn Profile Extractor
 * Extracts user profile data from LinkedIn
 */

class ProfileExtractor {
  constructor() {
    this.cachedProfile = null;
    this.cacheTimestamp = null;
    this.CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
    this.STORAGE_KEY = "linkedin_user_profile";
  }

  /**
   * Get stored profile from chrome.storage
   */
  async getStoredProfile() {
    try {
      const result = await chrome.storage.local.get([
        this.STORAGE_KEY,
        "profile_updated_at",
      ]);
      if (result[this.STORAGE_KEY] && result.profile_updated_at) {
        const age = Date.now() - result.profile_updated_at;
        // Use stored profile if less than 24 hours old
        if (age < 24 * 60 * 60 * 1000) {
          console.log("ProfileExtractor: Using stored profile from storage");
          return result[this.STORAGE_KEY];
        }
      }
    } catch (error) {
      console.error("ProfileExtractor: Error reading stored profile:", error);
    }
    return null;
  }

  /**
   * Save profile to chrome.storage
   */
  async saveProfile(profile) {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: profile,
        profile_updated_at: Date.now(),
      });
      console.log("ProfileExtractor: Profile saved to storage");
    } catch (error) {
      console.error("ProfileExtractor: Error saving profile:", error);
    }
  }

  /**
   * Extract current user's profile data
   */
  async extractProfile() {
    // Check memory cache first (fastest)
    if (
      this.cachedProfile &&
      this.cacheTimestamp &&
      Date.now() - this.cacheTimestamp < this.CACHE_DURATION
    ) {
      console.log("ProfileExtractor: Using memory cached profile");
      return this.cachedProfile;
    }

    // Check storage cache (persistent)
    const storedProfile = await this.getStoredProfile();
    if (storedProfile && this.isProfileComplete(storedProfile)) {
      console.log("ProfileExtractor: Using stored complete profile");
      this.cachedProfile = storedProfile;
      this.cacheTimestamp = Date.now();
      return storedProfile;
    }

    console.log("ProfileExtractor: Extracting fresh profile data...");

    // Try to extract from current page first
    let profile = await this.extractFromCurrentPage();

    // If profile is incomplete and we're not on profile page, try to get it from mini profile
    if (
      !this.isProfileComplete(profile) &&
      !window.location.href.includes("/in/")
    ) {
      console.log(
        "ProfileExtractor: Profile incomplete, trying mini profile..."
      );
      const miniProfile = await this.extractFromMiniProfile();
      profile = this.mergeProfiles(profile, miniProfile);
    }

    // Save to storage if we have meaningful data
    if (
      profile.name !== "Your Profile" ||
      profile.headline !== "Professional"
    ) {
      await this.saveProfile(profile);
    }

    // Cache the profile in memory
    this.cachedProfile = profile;
    this.cacheTimestamp = Date.now();

    console.log("ProfileExtractor: Profile extracted:", profile);
    return profile;
  }

  /**
   * Extract profile data from current page
   */
  async extractFromCurrentPage() {
    const profile = {
      name: this.extractName(),
      headline: this.extractHeadline(),
      about: await this.extractAbout(),
      experienceSummary: await this.extractExperience(),
      education: await this.extractEducation(),
      skills: await this.extractSkills(),
    };
    return profile;
  }

  /**
   * Extract from mini profile dropdown
   */
  async extractFromMiniProfile() {
    const profile = {
      name: this.extractName(),
      headline: this.extractHeadline(),
      about: "Click your profile to provide more details",
      experienceSummary: "Click your profile to provide more details",
      education: "Click your profile to provide more details",
      skills: "Click your profile to provide more details",
    };
    return profile;
  }

  /**
   * Check if profile has sufficient data
   */
  isProfileComplete(profile) {
    if (!profile) return false;

    const hasBasicInfo = profile.name && profile.name !== "Your Profile";
    const hasDetailedInfo =
      profile.about &&
      !profile.about.includes("Visit your profile") &&
      profile.experienceSummary &&
      !profile.experienceSummary.includes("Visit your profile");

    return hasBasicInfo && hasDetailedInfo;
  }

  /**
   * Merge two profile objects, preferring more detailed data
   */
  mergeProfiles(profile1, profile2) {
    return {
      name: this.preferBetter(profile1.name, profile2.name, "Your Profile"),
      headline: this.preferBetter(
        profile1.headline,
        profile2.headline,
        "Professional"
      ),
      about: this.preferBetter(profile1.about, profile2.about, "Not provided"),
      experienceSummary: this.preferBetter(
        profile1.experienceSummary,
        profile2.experienceSummary,
        "Not provided"
      ),
      education: this.preferBetter(
        profile1.education,
        profile2.education,
        "Not provided"
      ),
      skills: this.preferBetter(
        profile1.skills,
        profile2.skills,
        "Not provided"
      ),
    };
  }

  /**
   * Choose better value between two options
   */
  preferBetter(val1, val2, defaultVal) {
    if (val1 && val1 !== defaultVal && !val1.includes("Visit your profile"))
      return val1;
    if (val2 && val2 !== defaultVal && !val2.includes("Visit your profile"))
      return val2;
    return val1 || val2 || defaultVal;
  }

  /**
   * Extract user's name
   */
  extractName() {
    // Try from navigation bar
    const selectors = [
      ".global-nav__me-photo",
      '[data-control-name="identity_profile_photo"]',
      ".feed-identity-module__member-photo",
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const alt = el.getAttribute("alt");
        if (alt && !alt.includes("Photo")) {
          return alt;
        }
      }
    }

    // Try from profile page if we're on it
    const profileName = document.querySelector(".text-heading-xlarge");
    if (profileName) {
      return profileName.textContent.trim();
    }

    return "Your Profile";
  }

  /**
   * Extract user's headline
   */
  extractHeadline() {
    // Check if we're on profile page
    if (window.location.href.includes("/in/")) {
      const headline = document.querySelector(".text-body-medium.break-words");
      if (headline) {
        return headline.textContent.trim();
      }
    }

    // Try from feed
    const feedHeadline = document.querySelector(
      ".feed-identity-module__description"
    );
    if (feedHeadline) {
      return feedHeadline.textContent.trim();
    }

    return "Professional";
  }

  /**
   * Extract About section
   */
  async extractAbout() {
    if (!window.location.href.includes("/in/")) {
      return "Visit your profile to extract About section";
    }

    // Try multiple selectors for About section
    const aboutSelectors = [
      "#about",
      '[id^="about"]',
      ".pv-about-section",
      ".pv-about__summary-text",
    ];

    for (const selector of aboutSelectors) {
      const aboutSection = document.querySelector(selector);
      if (aboutSection) {
        const section = aboutSection.closest("section") || aboutSection;

        // Try to find and click "see more" button
        const seeMoreButtons = section.querySelectorAll("button");
        for (const button of seeMoreButtons) {
          const buttonText = button.textContent.toLowerCase();
          if (
            buttonText.includes("see more") ||
            buttonText.includes("show more")
          ) {
            console.log("ProfileExtractor: Clicking About see more button");
            button.click();
            await new Promise((resolve) => setTimeout(resolve, 800));
            break;
          }
        }

        // Extract text from various possible containers
        const textContainers = [
          section.querySelector(".inline-show-more-text"),
          section.querySelector(".pv-about__summary-text"),
          section.querySelector('[class*="about"]'),
          section,
        ];

        for (const container of textContainers) {
          if (container) {
            const text = container.textContent.trim();
            if (
              text &&
              text.length > 20 &&
              !text.toLowerCase().includes("see more")
            ) {
              console.log(
                `ProfileExtractor: Found About text (${text.length} chars)`
              );
              return text.substring(0, 2000); // Increased limit
            }
          }
        }
      }
    }

    return "Not provided";
  }

  /**
   * Extract Experience summary
   */
  async extractExperience() {
    if (!window.location.href.includes("/in/")) {
      return "Visit your profile to extract experience";
    }

    const experienceSelectors = [
      "#experience",
      '[id^="experience"]',
      ".experience-section",
    ];

    for (const selector of experienceSelectors) {
      const experienceSection = document.querySelector(selector);
      if (experienceSection) {
        const experiences = [];
        const section =
          experienceSection.closest("section") || experienceSection;

        // Try multiple item selectors
        const itemSelectors = [
          "li.artdeco-list__item",
          "ul > li",
          '[data-view-name*="profile-component-entity"]',
          ".pvs-list__paged-list-item",
        ];

        let items = [];
        for (const itemSel of itemSelectors) {
          items = section.querySelectorAll(itemSel);
          if (items.length > 0) break;
        }

        if (items.length > 0) {
          for (let i = 0; i < Math.min(items.length, 5); i++) {
            const item = items[i];

            // Try multiple selector patterns for title, company, duration
            const titleSelectors = [
              ".mr1.t-bold span",
              '[class*="profile-experience-card__title"]',
              ".t-bold span:first-child",
              'span[aria-hidden="true"]:first-child',
            ];

            let title = null;
            for (const sel of titleSelectors) {
              const el = item.querySelector(sel);
              if (el && el.textContent.trim().length > 0) {
                title = el.textContent.trim();
                break;
              }
            }

            // Extract company
            const companySelectors = [
              ".t-14.t-normal span",
              '[class*="profile-experience-card__company"]',
              '.t-14 span[aria-hidden="true"]',
            ];

            let company = null;
            for (const sel of companySelectors) {
              const el = item.querySelector(sel);
              if (
                el &&
                el.textContent.trim().length > 0 &&
                !el.textContent.includes("·")
              ) {
                company = el.textContent.trim();
                break;
              }
            }

            // Extract duration
            const durationSelectors = [
              ".t-14.t-normal.t-black--light span",
              '[class*="date-range"]',
              ".t-black--light span",
            ];

            let duration = null;
            for (const sel of durationSelectors) {
              const el = item.querySelector(sel);
              if (el) {
                const text = el.textContent.trim();
                if (
                  text.match(/\d+\s+(year|month|yr|mo)/i) ||
                  text.includes("-")
                ) {
                  duration = text;
                  break;
                }
              }
            }

            if (title && title.length > 2) {
              const expStr = `${title}${company ? " at " + company : ""}${
                duration ? " (" + duration + ")" : ""
              }`;
              experiences.push(expStr);
              console.log("ProfileExtractor: Found experience:", expStr);
            }
          }
        }

        if (experiences.length > 0) {
          return experiences.join(" | ");
        }
      }
    }

    return "Not provided";
  }

  /**
   * Extract Education
   */
  async extractEducation() {
    if (!window.location.href.includes("/in/")) {
      return "Visit your profile to extract education";
    }

    const educationSelectors = [
      "#education",
      '[id^="education"]',
      ".education-section",
    ];

    for (const selector of educationSelectors) {
      const educationSection = document.querySelector(selector);
      if (educationSection) {
        const educations = [];
        const section = educationSection.closest("section") || educationSection;
        const items = section.querySelectorAll(
          "li.artdeco-list__item, ul > li, .pvs-list__paged-list-item"
        );

        if (items.length > 0) {
          for (let i = 0; i < Math.min(items.length, 3); i++) {
            const item = items[i];

            const schoolSelectors = [
              ".mr1.t-bold span",
              ".t-bold span:first-child",
              'span[aria-hidden="true"]:first-child',
            ];

            let school = null;
            for (const sel of schoolSelectors) {
              const el = item.querySelector(sel);
              if (el && el.textContent.trim().length > 0) {
                school = el.textContent.trim();
                break;
              }
            }

            const degreeSelectors = [
              ".t-14.t-normal span",
              '.t-14 span[aria-hidden="true"]',
            ];

            let degree = null;
            for (const sel of degreeSelectors) {
              const el = item.querySelector(sel);
              if (el && el.textContent.trim().length > 0) {
                degree = el.textContent.trim();
                break;
              }
            }

            if (school && school.length > 2) {
              educations.push(`${school}${degree ? " - " + degree : ""}`);
              console.log("ProfileExtractor: Found education:", school);
            }
          }
        }

        if (educations.length > 0) {
          return educations.join(" | ");
        }
      }
    }

    return "Not provided";
  }

  /**
   * Extract Skills
   */
  async extractSkills() {
    if (!window.location.href.includes("/in/")) {
      return "Visit your profile to extract skills";
    }

    const skillsSelectors = ["#skills", '[id^="skills"]', ".skills-section"];

    for (const selector of skillsSelectors) {
      const skillsSection = document.querySelector(selector);
      if (skillsSection) {
        const skills = [];
        const section = skillsSection.closest("section") || skillsSection;

        // Try multiple skill item selectors
        const skillSelectors = [
          '.mr1.hoverable-link-text.t-bold span[aria-hidden="true"]',
          '.t-bold span[aria-hidden="true"]',
          'span[aria-hidden="true"]',
          '.pvs-list__paged-list-item span[aria-hidden="true"]',
        ];

        let items = [];
        for (const sel of skillSelectors) {
          items = section.querySelectorAll(sel);
          if (items.length > 0) break;
        }

        if (items.length > 0) {
          items.forEach((item) => {
            const skill = item.textContent.trim();
            // Filter out noise (dates, "Show all", etc)
            if (
              skill &&
              skills.length < 30 &&
              skill.length > 1 &&
              skill.length < 50 &&
              !skill.match(/\d+\s+(year|month)/i) &&
              !skill.toLowerCase().includes("show") &&
              !skill.toLowerCase().includes("see")
            ) {
              skills.push(skill);
            }
          });
        }

        if (skills.length > 0) {
          console.log(`ProfileExtractor: Found ${skills.length} skills`);
          return skills.join(", ");
        }
      }
    }

    return "Not provided";
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cachedProfile = null;
    this.cacheTimestamp = null;
  }
}
