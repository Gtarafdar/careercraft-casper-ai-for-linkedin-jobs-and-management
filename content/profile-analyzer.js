/**
 * LinkedIn AI Profile Analyzer
 * Analyzes LinkedIn profiles using AI to provide insights about compatibility,
 * shared interests, and connection potential
 */

class ProfileAnalyzer {
  constructor() {
    this.analyzeButton = null;
    this.isAnalyzing = false;
    this.cachedAnalysis = null;
    this.currentProfileUrl = null;
    this.init();
  }

  /**
   * Initialize the profile analyzer
   */
  async init() {
    try {
      // Check if ATS Checker is enabled
      try {
        const result = await chrome.storage.local.get(["atsCheckerEnabled"]);
        const atsCheckerEnabled = result.atsCheckerEnabled !== false; // Default true if undefined

        if (!atsCheckerEnabled) {
          console.log("ProfileAnalyzer: ATS Checker disabled by user");
          return;
        }
      } catch (error) {
        console.error(
          "ProfileAnalyzer: Error checking ATS Checker settings, proceeding with enabled",
          error
        );
      }

      console.log("ProfileAnalyzer: 🚀 Initializing...");
      console.log("ProfileAnalyzer: Current URL:", window.location.href);

      // Only run on LinkedIn profile pages
      if (!this.isProfilePage()) {
        console.log("ProfileAnalyzer: Not a profile page, skipping");
        return;
      }

      console.log("ProfileAnalyzer: ✅ Profile page detected");

      // Wait for profile page to load, then inject button
      this.waitForProfile()
        .then(() => {
          console.log("ProfileAnalyzer: Profile loaded, injecting button...");
          this.injectAnalyzeButton();
          console.log("ProfileAnalyzer: ✅ Ready");
        })
        .catch((error) => {
          console.error("ProfileAnalyzer: Error during initialization:", error);
        });

      // Re-inject button on navigation
      this.setupNavigationMonitor();
    } catch (error) {
      console.error("ProfileAnalyzer: Fatal initialization error:", error);
    }
  }

  /**
   * Check if current page is a LinkedIn profile page
   */
  isProfilePage() {
    const url = window.location.href;
    return url.includes("linkedin.com/in/");
  }

  /**
   * Wait for profile page elements to load
   */
  waitForProfile() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 60; // 12 seconds - give more time for LinkedIn to load

      const checkProfile = () => {
        attempts++;

        // Look for profile header container with multiple selectors
        const profileHeader = document.querySelector(
          ".pv-text-details__left-panel, .ph5.pb5, .pv-top-card, [class*='profile-top-card']"
        );

        const actionBar =
          document.querySelector(".pvs-profile-actions") ||
          document.querySelector('[class*="profile-actions"]') ||
          document.querySelector(".pv-top-card");

        // Log progress every 10 attempts
        if (attempts % 10 === 0) {
          console.log(
            `ProfileAnalyzer: Waiting for profile... (attempt ${attempts}/${maxAttempts})`
          );
          console.log("ProfileAnalyzer: Elements found:", {
            profileHeader: !!profileHeader,
            actionBar: !!actionBar,
          });
        }

        if (profileHeader || actionBar) {
          console.log("ProfileAnalyzer: ✅ Profile page elements loaded");
          resolve();
          return true;
        }
        return false;
      };

      if (checkProfile()) return;

      const observer = new MutationObserver(() => {
        if (checkProfile()) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        if (attempts >= maxAttempts) {
          console.error(
            "ProfileAnalyzer: ⚠️ Timeout waiting for profile elements"
          );
          // Still resolve to try injection anyway
          resolve();
        } else {
          resolve();
        }
      }, 12000);
    });
  }

  /**
   * Monitor URL changes to re-inject button on navigation
   */
  setupNavigationMonitor() {
    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;

      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.currentProfileUrl = currentUrl;
        this.cachedAnalysis = null; // Clear cache on profile change

        if (this.isProfilePage() && !this.analyzeButton) {
          this.waitForProfile().then(() => {
            this.injectAnalyzeButton();
          });
        } else if (!this.isProfilePage() && this.analyzeButton) {
          this.analyzeButton.remove();
          this.analyzeButton = null;
        }
      }
    }, 500);
  }

  /**
   * Inject "Analyze with AI" button next to More button
   */
  injectAnalyzeButton() {
    // Don't inject if already exists
    if (document.querySelector("#lf-ai-analyze-btn")) {
      console.log("ProfileAnalyzer: Button already exists");
      return;
    }

    console.log("ProfileAnalyzer: Attempting to inject button...");

    // Wait for LinkedIn to finish rendering (LinkedIn loads dynamically)
    setTimeout(() => {
      this.performButtonInjection();
    }, 2000); // Wait 2 seconds for LinkedIn to fully load
  }

  /**
   * Perform the actual button injection after waiting for page load
   */
  performButtonInjection() {
    console.log("ProfileAnalyzer: Starting button injection after delay...");

    let moreDropdown = null;
    let actionBar = null;

    // Strategy 1: Find the More dropdown by looking for artdeco-dropdown with "More" text in profile header
    const dropdowns = document.querySelectorAll(".artdeco-dropdown");
    console.log(`ProfileAnalyzer: Found ${dropdowns.length} dropdowns on page`);

    for (const dropdown of dropdowns) {
      const trigger = dropdown.querySelector('button[aria-label*="More"]');
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const hasMoreText = trigger.textContent.toLowerCase().includes("more");
        const isInHeader = rect.top < 600 && rect.top > 0;

        console.log(
          `ProfileAnalyzer: Checking dropdown - hasMoreText: ${hasMoreText}, isInHeader: ${isInHeader}, top: ${rect.top}`
        );

        if (hasMoreText && isInHeader) {
          moreDropdown = dropdown;
          // The actionBar is the parent div that contains all action buttons (Message + More + our button)
          actionBar = dropdown.parentElement;
          console.log(
            "ProfileAnalyzer: ✅ Found More dropdown and action bar container"
          );
          break;
        }
      }
    }

    // Strategy 2: Look for Message button and More dropdown siblings (IMPROVED)
    if (!moreDropdown || !actionBar) {
      console.log(
        "ProfileAnalyzer: Strategy 2 - Looking for button siblings..."
      );

      // Find Message button in profile header - try multiple selectors
      const messageButtons = Array.from(
        document.querySelectorAll('button[aria-label*="Message"]')
      );

      for (const msgBtn of messageButtons) {
        const rect = msgBtn.getBoundingClientRect();
        // Check if button is visible in viewport
        if (rect.top < 600 && rect.top > 0 && rect.width > 0) {
          console.log(
            "ProfileAnalyzer: Found Message button at top:",
            rect.top
          );

          // Message button is inside .entry-point div
          const msgParent = msgBtn.closest(".entry-point");
          if (msgParent) {
            console.log("ProfileAnalyzer: Found .entry-point parent");

            // The action bar is the parent of .entry-point
            const parentDiv = msgParent.parentElement;
            if (parentDiv) {
              console.log(
                "ProfileAnalyzer: Checking parent div:",
                parentDiv.className
              );

              // Look for More dropdown as a sibling
              const dropdown = parentDiv.querySelector(".artdeco-dropdown");
              if (dropdown) {
                const moreBtn = dropdown.querySelector(
                  'button[aria-label*="More"]'
                );
                if (moreBtn) {
                  moreDropdown = dropdown;
                  actionBar = parentDiv;
                  console.log(
                    "ProfileAnalyzer: ✅ Found action bar via Message button siblings"
                  );
                  console.log(
                    "ProfileAnalyzer: Action bar class:",
                    actionBar.className
                  );
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Strategy 3: Find by looking for Connect/Message/More button container (ENHANCED)
    if (!actionBar) {
      console.log(
        "ProfileAnalyzer: Strategy 3 - Looking for button container..."
      );

      // Look for divs containing both .entry-point and .artdeco-dropdown
      const allDivs = document.querySelectorAll("div");
      console.log(`ProfileAnalyzer: Checking ${allDivs.length} divs...`);

      let candidatesFound = 0;

      for (const div of allDivs) {
        // Check if this div has both entry-point and artdeco-dropdown as direct children
        const entryPoint = Array.from(div.children).find((child) =>
          child.classList.contains("entry-point")
        );
        const dropdown = Array.from(div.children).find((child) =>
          child.classList.contains("artdeco-dropdown")
        );

        if (entryPoint && dropdown) {
          candidatesFound++;
          console.log(`ProfileAnalyzer: Found candidate ${candidatesFound}:`, {
            className: div.className,
            hasEntryPoint: !!entryPoint,
            hasDropdown: !!dropdown,
          });

          // Verify this is the profile header by checking for Message or Connect button
          const hasMessageBtn = entryPoint.querySelector(
            'button[aria-label*="Message"]'
          );
          const hasConnectBtn = div.querySelector(
            'button[aria-label*="connect" i]'
          );
          const moreBtn = dropdown.querySelector('button[aria-label*="More"]');

          console.log(
            `ProfileAnalyzer: Candidate ${candidatesFound} buttons:`,
            {
              hasMessageBtn: !!hasMessageBtn,
              hasConnectBtn: !!hasConnectBtn,
              hasMoreBtn: !!moreBtn,
            }
          );

          if (moreBtn && (hasMessageBtn || hasConnectBtn)) {
            // Check position to ensure it's in the header
            const rect = div.getBoundingClientRect();
            console.log(
              `ProfileAnalyzer: Candidate ${candidatesFound} position:`,
              {
                top: rect.top,
                isInHeader: rect.top < 600 && rect.top > 0,
              }
            );

            if (rect.top < 600 && rect.top > 0) {
              actionBar = div;
              moreDropdown = dropdown;
              console.log(
                "ProfileAnalyzer: ✅ Found action bar via button container search"
              );
              console.log(
                "ProfileAnalyzer: Action bar class:",
                actionBar.className
              );
              break;
            }
          }
        }
      }

      console.log(
        `ProfileAnalyzer: Total candidates found: ${candidatesFound}`
      );
    }

    // Strategy 4: Direct search for Connect button parent (NEW - SMART APPROACH)
    if (!actionBar) {
      console.log(
        "ProfileAnalyzer: Strategy 4 - Direct search for Connect/Message button parent..."
      );

      // Look for Connect button (it's usually present on profiles)
      const connectButtons = document.querySelectorAll(
        'button[aria-label*="connect" i], button[aria-label*="Invite" i]'
      );
      console.log(
        `ProfileAnalyzer: Found ${connectButtons.length} Connect buttons`
      );

      for (const connectBtn of connectButtons) {
        const rect = connectBtn.getBoundingClientRect();
        // Check if in header area
        if (rect.top > 0 && rect.top < 600 && rect.width > 0) {
          console.log(
            "ProfileAnalyzer: Found Connect button in header at top:",
            rect.top
          );

          // Walk up the DOM to find the parent containing all buttons
          let currentParent = connectBtn.parentElement;
          let attempts = 0;

          while (currentParent && attempts < 5) {
            attempts++;
            console.log(
              `ProfileAnalyzer: Checking parent level ${attempts}:`,
              currentParent.className
            );

            // Check if this parent contains both a dropdown and the connect button
            const hasDropdown = currentParent.querySelector(
              '.artdeco-dropdown button[aria-label*="More"]'
            );
            const hasConnect = currentParent.contains(connectBtn);

            console.log(
              `ProfileAnalyzer: Parent level ${attempts} - hasDropdown: ${!!hasDropdown}, hasConnect: ${hasConnect}`
            );

            if (hasDropdown && hasConnect) {
              // Found the action bar!
              actionBar = currentParent;
              moreDropdown = currentParent.querySelector(".artdeco-dropdown");
              console.log(
                "ProfileAnalyzer: ✅ Found action bar via Connect button parent search!"
              );
              console.log(
                "ProfileAnalyzer: Action bar class:",
                actionBar.className
              );
              break;
            }

            currentParent = currentParent.parentElement;
          }

          if (actionBar) break;
        }
      }
    }

    // Strategy 5: Last resort - create floating button
    if (!actionBar) {
      console.warn(
        "ProfileAnalyzer: Could not find action bar after all strategies, creating floating button"
      );
      this.createFloatingButton();
      return;
    }

    console.log("ProfileAnalyzer: ✅ Action bar located, creating button...");
    console.log("ProfileAnalyzer: actionBar element:", actionBar);
    console.log("ProfileAnalyzer: moreDropdown element:", moreDropdown);

    // Create button matching LinkedIn's native button style
    const analyzeBtn = document.createElement("button");
    analyzeBtn.className =
      "artdeco-button artdeco-button--2 artdeco-button--secondary ember-view UKhuQCcmgNIQPJgaHDAXzAxxDoBIVVmeHY";
    analyzeBtn.setAttribute("aria-label", "Analyze with AI");
    analyzeBtn.setAttribute("type", "button");
    analyzeBtn.id = "lf-ai-analyze-btn";

    // Icon + text matching LinkedIn's button style exactly
    analyzeBtn.innerHTML = `
      <svg role="none" aria-hidden="true" class="artdeco-button__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
        <path d="M8 1c.3 0 .5.2.5.5V3h2c.3 0 .5.2.5.5s-.2.5-.5.5h-2v2c0 .3-.2.5-.5.5s-.5-.2-.5-.5V4h-2c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h2V1.5c0-.3.2-.5.5-.5zm0 11c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-1c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z" fill="currentColor"/>
      </svg>
      <span class="artdeco-button__text">Analyze with AI</span>
    `;

    // Add click handler
    analyzeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleAnalyzeClick();
    });

    // Insert button in the actionBar BEFORE the More dropdown
    if (moreDropdown && actionBar) {
      actionBar.insertBefore(analyzeBtn, moreDropdown);
      console.log("ProfileAnalyzer: ✅ Button inserted before More dropdown");
      console.log("ProfileAnalyzer: Action bar classes:", actionBar.className);
      console.log("ProfileAnalyzer: Button classes:", analyzeBtn.className);
    } else if (actionBar) {
      actionBar.appendChild(analyzeBtn);
      console.log("ProfileAnalyzer: Button appended to action bar");
    } else {
      console.error("ProfileAnalyzer: ❌ No action bar found");
      this.createFloatingButton();
      return;
    }

    this.analyzeButton = analyzeBtn;
    console.log("ProfileAnalyzer: ✅ Button injected successfully");
    console.log("ProfileAnalyzer: Button element:", analyzeBtn);
    console.log(
      "ProfileAnalyzer: Button parent:",
      analyzeBtn.parentElement?.tagName
    );

    // Verify button is visible
    setTimeout(() => {
      if (this.analyzeButton && this.analyzeButton.offsetParent === null) {
        console.warn("ProfileAnalyzer: ⚠️ Button injected but not visible");
        console.log(
          "ProfileAnalyzer: Button display:",
          window.getComputedStyle(this.analyzeButton).display
        );
        console.log(
          "ProfileAnalyzer: Button parent:",
          this.analyzeButton.parentElement?.tagName
        );
      } else if (this.analyzeButton) {
        console.log("ProfileAnalyzer: ✅ Button is visible on page");
      }
    }, 100);
  }

  /**
   * Apply LinkedIn-style button CSS
   */
  applyButtonStyles(button, referenceButton) {
    // Circle button styles - no custom styles needed, LinkedIn classes handle it
    // Just ensure it's visible
    button.style.marginLeft = "8px";

    // Simple spinner animation
    const iconStyles = document.createElement("style");
    iconStyles.textContent = `
      .lf-analyze-profile-btn.analyzing {
        pointer-events: none;
        opacity: 0.6;
      }
      
      .lf-btn-loading {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .lf-spinner {
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;

    if (!document.querySelector("#lf-profile-analyzer-styles")) {
      iconStyles.id = "lf-profile-analyzer-styles";
      document.head.appendChild(iconStyles);
    }
  }

  /**
   * Create a small floating button as fallback (matches inline button size)
   */
  createFloatingButton() {
    console.log("ProfileAnalyzer: Creating floating button as fallback");

    // Check if button already exists
    if (document.querySelector("#lf-ai-analyze-btn")) {
      console.log("ProfileAnalyzer: Button already exists");
      return;
    }

    const analyzeBtn = document.createElement("button");
    analyzeBtn.className =
      "artdeco-button artdeco-button--2 artdeco-button--secondary";
    analyzeBtn.setAttribute("aria-label", "Analyze with AI");
    analyzeBtn.id = "lf-ai-analyze-btn";

    // Small icon only - matching inline button
    analyzeBtn.innerHTML = `
      <svg role="none" aria-hidden="true" class="artdeco-button__icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <path d="M8 1c.3 0 .5.2.5.5V3h2c.3 0 .5.2.5.5s-.2.5-.5.5h-2v2c0 .3-.2.5-.5.5s-.5-.2-.5-.5V4h-2c-.3 0-.5-.2-.5-.5s.2-.5.5-.5h2V1.5c0-.3.2-.5.5-.5zm0 11c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-1c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4z" fill="currentColor"/>
        </svg>
    `;

    // Compact floating styles - small button like inline version
    analyzeBtn.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      left: 24px !important;
      z-index: 9999 !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
      min-width: 32px !important;
      min-height: 32px !important;
      padding: 8px !important;
    `;

    // Add click handler
    analyzeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleAnalyzeClick();
    });

    // Append to body
    document.body.appendChild(analyzeBtn);
    this.analyzeButton = analyzeBtn;

    console.log(
      "ProfileAnalyzer: ✅ Floating button created and added to page"
    );

    // Verify visibility
    setTimeout(() => {
      if (this.analyzeButton && this.analyzeButton.offsetParent !== null) {
        console.log("ProfileAnalyzer: ✅ Floating button is visible");
      } else {
        console.error(
          "ProfileAnalyzer: ❌ Floating button created but not visible"
        );
      }
    }, 100);
  }

  /**
   * Handle analyze button click
   */
  async handleAnalyzeClick() {
    if (this.isAnalyzing) {
      console.log("ProfileAnalyzer: Already analyzing");
      return;
    }

    // Show loading state
    this.setButtonLoading(true);
    this.isAnalyzing = true;

    try {
      // Check if we have cached analysis for this profile
      if (
        this.cachedAnalysis &&
        this.currentProfileUrl === window.location.href
      ) {
        console.log("ProfileAnalyzer: Using cached analysis");
        this.displayAnalysis(this.cachedAnalysis);
        return;
      }

      // Extract profile data
      console.log("ProfileAnalyzer: Extracting profile data...");
      const profileData = await this.extractProfileData();

      // Get user's own profile for comparison
      console.log("ProfileAnalyzer: Getting user profile...");
      const userProfile = await this.getUserProfile();

      // Analyze with AI
      console.log("ProfileAnalyzer: Analyzing with AI...");
      const analysis = await this.analyzeWithAI(profileData, userProfile);

      // Cache the analysis
      this.cachedAnalysis = analysis;
      this.currentProfileUrl = window.location.href;

      // Display results
      this.displayAnalysis(analysis);
    } catch (error) {
      console.error("ProfileAnalyzer: Error during analysis:", error);

      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (
        errorMessage.includes("quota") ||
        errorMessage.includes("rate limit")
      ) {
        errorMessage =
          "API quota exceeded. Please try again later or check your API settings. If you just added a new API key, make sure it's activated and has available quota.";
      } else if (errorMessage.includes("API key")) {
        errorMessage =
          "API key issue. Please check your API key in the extension settings.";
      } else if (errorMessage.includes("not configured")) {
        errorMessage =
          "AI service not configured. Please add your API key in the extension settings.";
      }

      this.showError(errorMessage);
    } finally {
      this.setButtonLoading(false);
      this.isAnalyzing = false;
    }
  }

  /**
   * Set button loading state
   */
  setButtonLoading(loading) {
    if (!this.analyzeButton) return;

    const content = this.analyzeButton.querySelector(".lf-btn-content");
    const loadingSpinner = this.analyzeButton.querySelector(".lf-btn-loading");

    if (loading) {
      this.analyzeButton.classList.add("analyzing");
      content.style.display = "none";
      loadingSpinner.style.display = "flex";
    } else {
      this.analyzeButton.classList.remove("analyzing");
      content.style.display = "flex";
      loadingSpinner.style.display = "none";
    }
  }

  /**
   * Extract profile data from the page
   */
  async extractProfileData() {
    const profile = {
      name: "",
      headline: "",
      location: "",
      about: "",
      experience: [],
      education: [],
      skills: [],
      connections: "",
      profileUrl: window.location.href,
    };

    // Extract name
    const nameElement =
      document.querySelector(".text-heading-xlarge") ||
      document.querySelector('[class*="pv-text-details__left-panel"] h1');
    if (nameElement) {
      profile.name = nameElement.textContent.trim();
    }

    // Extract headline
    const headlineElement =
      document.querySelector(".text-body-medium.break-words") ||
      document.querySelector(
        '[class*="pv-text-details__left-panel"] .text-body-medium'
      );
    if (headlineElement) {
      profile.headline = headlineElement.textContent.trim();
    }

    // Extract location
    const locationElement = document.querySelector(
      ".text-body-small.inline.t-black--light.break-words"
    );
    if (locationElement) {
      profile.location = locationElement.textContent.trim();
    }

    // Extract connections count
    const connectionsElement = document.querySelector(
      'a[href*="overlay/connections"], .pvs-header__subtitle'
    );
    if (connectionsElement) {
      profile.connections = connectionsElement.textContent.trim();
    }

    // Extract About section
    const aboutSection = Array.from(document.querySelectorAll("section")).find(
      (section) => {
        const heading = section.querySelector("h2, .pvs-header__title");
        return (
          heading && heading.textContent.trim().toLowerCase().includes("about")
        );
      }
    );

    if (aboutSection) {
      const aboutText = aboutSection.querySelector(
        ".inline-show-more-text, .pvs-list__outer-container"
      );
      if (aboutText) {
        profile.about = aboutText.textContent.trim().substring(0, 1000); // Limit length
      }
    }

    // Extract Experience
    const experienceSection = Array.from(
      document.querySelectorAll("section")
    ).find((section) => {
      const heading = section.querySelector("h2, .pvs-header__title");
      return (
        heading &&
        heading.textContent.trim().toLowerCase().includes("experience")
      );
    });

    if (experienceSection) {
      const expItems = experienceSection.querySelectorAll(
        "li.artdeco-list__item"
      );
      expItems.forEach((item, index) => {
        if (index >= 5) return; // Limit to 5 items

        const titleEl = item.querySelector(
          '[class*="t-bold"], .mr1.hoverable-link-text.t-bold'
        );
        const companyEl = item.querySelector(
          '.t-14.t-normal, [class*="t-black--light"]'
        );
        const durationEl = item.querySelector(
          '.t-14.t-normal.t-black--light, [class*="date-range"]'
        );

        if (titleEl) {
          profile.experience.push({
            title: titleEl.textContent.trim(),
            company: companyEl ? companyEl.textContent.trim() : "",
            duration: durationEl ? durationEl.textContent.trim() : "",
          });
        }
      });
    }

    // Extract Education
    const educationSection = Array.from(
      document.querySelectorAll("section")
    ).find((section) => {
      const heading = section.querySelector("h2, .pvs-header__title");
      return (
        heading &&
        heading.textContent.trim().toLowerCase().includes("education")
      );
    });

    if (educationSection) {
      const eduItems = educationSection.querySelectorAll(
        "li.artdeco-list__item"
      );
      eduItems.forEach((item, index) => {
        if (index >= 3) return; // Limit to 3 items

        const schoolEl = item.querySelector(
          '[class*="t-bold"], .mr1.hoverable-link-text.t-bold'
        );
        const degreeEl = item.querySelector(".t-14.t-normal");

        if (schoolEl) {
          profile.education.push({
            school: schoolEl.textContent.trim(),
            degree: degreeEl ? degreeEl.textContent.trim() : "",
          });
        }
      });
    }

    // Extract Skills (if visible)
    const skillsSection = Array.from(document.querySelectorAll("section")).find(
      (section) => {
        const heading = section.querySelector("h2, .pvs-header__title");
        return (
          heading && heading.textContent.trim().toLowerCase().includes("skill")
        );
      }
    );

    if (skillsSection) {
      const skillItems = skillsSection.querySelectorAll(
        "li.artdeco-list__item"
      );
      skillItems.forEach((item, index) => {
        if (index >= 10) return; // Limit to 10 skills

        const skillEl = item.querySelector('[class*="t-bold"]');
        if (skillEl) {
          profile.skills.push(skillEl.textContent.trim());
        }
      });
    }

    console.log("ProfileAnalyzer: Extracted profile:", profile);
    return profile;
  }

  /**
   * Get the current user's profile for comparison
   */
  async getUserProfile() {
    try {
      const profileExtractor = new ProfileExtractor();
      const userProfile = await profileExtractor.extractProfile();
      console.log("ProfileAnalyzer: User profile:", userProfile);
      return userProfile;
    } catch (error) {
      console.error("ProfileAnalyzer: Error getting user profile:", error);
      return null;
    }
  }

  /**
   * Analyze profile using AI
   */
  async analyzeWithAI(profileData, userProfile) {
    try {
      const aiService = new AIService();

      // Initialize AI service
      const initialized = await aiService.initialize();
      if (!initialized) {
        throw new Error(
          "AI service not configured. Please add your API key in extension settings (click extension icon → Settings)."
        );
      }

      // Build analysis prompt
      const prompt = this.buildAnalysisPrompt(profileData, userProfile);

      // Call AI API
      const response = await aiService.analyzeProfile(prompt);

      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error("ProfileAnalyzer: AI analysis error:", error);
      throw error;
    }
  }

  /**
   * Build AI analysis prompt
   */
  buildAnalysisPrompt(profileData, userProfile) {
    let prompt = `Analyze this LinkedIn profile and provide insights about potential compatibility, shared interests, and connection value.

**Profile to Analyze:**
- Name: ${profileData.name}
- Headline: ${profileData.headline}
- Location: ${profileData.location}
- Connections: ${profileData.connections}
- About: ${profileData.about || "Not provided"}
- Experience: ${
      profileData.experience.length > 0
        ? profileData.experience
            .map((exp) => `${exp.title} at ${exp.company}`)
            .join(", ")
        : "Not provided"
    }
- Education: ${
      profileData.education.length > 0
        ? profileData.education
            .map((edu) => `${edu.degree} from ${edu.school}`)
            .join(", ")
        : "Not provided"
    }
- Skills: ${
      profileData.skills.length > 0
        ? profileData.skills.join(", ")
        : "Not provided"
    }
`;

    if (userProfile && userProfile.name !== "Your Profile") {
      prompt += `

**Your Profile (for comparison):**
- Name: ${userProfile.name}
- Headline: ${userProfile.headline}
- Location: ${userProfile.location}
- About: ${userProfile.about || "Not provided"}
- Experience: ${userProfile.experience || "Not provided"}
- Skills: ${userProfile.skills || "Not provided"}
`;
    }

    prompt += `

**Provide analysis in the following format:**

MATCH_SCORE: [0-100 number representing overall compatibility]

SHARED_INTERESTS: [List 3-5 specific shared interests, industries, or commonalities. If few commonalities exist, mention potential areas of mutual interest or complementary skills]

SUMMARY: [2-3 sentence professional summary of this person's background and expertise]

INSIGHTS: [3-4 bullet points about their professional mindset, potential value as a connection, areas of expertise, and whether they seem like a helpful/collaborative professional. Be positive but honest]

CONNECTION_VALUE: [One sentence explaining the potential value of connecting with this person]

COMPATIBILITY_FACTORS: [List 2-3 specific factors that make this a good or interesting connection]

---

Important: Base your analysis on the data provided. Be professional, insightful, and constructive. Focus on professional compatibility and potential for meaningful connection.`;

    return prompt;
  }

  /**
   * Parse AI response into structured data
   */
  parseAnalysisResponse(responseText) {
    const analysis = {
      matchScore: 0,
      sharedInterests: [],
      summary: "",
      insights: [],
      connectionValue: "",
      compatibilityFactors: [],
      rawResponse: responseText,
    };

    try {
      // Extract match score
      const scoreMatch = responseText.match(/MATCH_SCORE:\s*(\d+)/i);
      if (scoreMatch) {
        analysis.matchScore = parseInt(scoreMatch[1]);
      }

      // Extract shared interests
      const interestsMatch = responseText.match(
        /SHARED_INTERESTS:(.*?)(?=\n\n|SUMMARY:|$)/is
      );
      if (interestsMatch) {
        const interestsText = interestsMatch[1].trim();
        analysis.sharedInterests = interestsText
          .split(/\n|;|,/)
          .map((s) => s.replace(/^[-•*]\s*/, "").trim())
          .filter((s) => s.length > 0);
      }

      // Extract summary
      const summaryMatch = responseText.match(
        /SUMMARY:(.*?)(?=\n\n|INSIGHTS:|$)/is
      );
      if (summaryMatch) {
        analysis.summary = summaryMatch[1].trim();
      }

      // Extract insights
      const insightsMatch = responseText.match(
        /INSIGHTS:(.*?)(?=\n\n|CONNECTION_VALUE:|$)/is
      );
      if (insightsMatch) {
        const insightsText = insightsMatch[1].trim();
        analysis.insights = insightsText
          .split(/\n/)
          .map((s) => s.replace(/^[-•*]\s*/, "").trim())
          .filter((s) => s.length > 0);
      }

      // Extract connection value
      const connectionMatch = responseText.match(
        /CONNECTION_VALUE:(.*?)(?=\n\n|COMPATIBILITY_FACTORS:|$)/is
      );
      if (connectionMatch) {
        analysis.connectionValue = connectionMatch[1].trim();
      }

      // Extract compatibility factors
      const compatMatch = responseText.match(/COMPATIBILITY_FACTORS:(.*?)$/is);
      if (compatMatch) {
        const compatText = compatMatch[1].trim();
        analysis.compatibilityFactors = compatText
          .split(/\n/)
          .map((s) => s.replace(/^[-•*]\s*/, "").trim())
          .filter((s) => s.length > 0);
      }
    } catch (error) {
      console.error("ProfileAnalyzer: Error parsing AI response:", error);
    }

    return analysis;
  }

  /**
   * Display analysis results in a modal
   */
  displayAnalysis(analysis) {
    // Remove existing modal if any
    const existingModal = document.querySelector(".lf-profile-analysis-modal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement("div");
    modal.className = "lf-profile-analysis-modal";
    modal.innerHTML = `
      <div class="lf-modal-overlay"></div>
      <div class="lf-modal-container">
        <div class="lf-modal-header">
          <h2>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="lf-header-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            AI Profile Analysis
          </h2>
          <button class="lf-modal-close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <div class="lf-modal-body">
          <!-- Match Score -->
          <div class="lf-analysis-section lf-match-score">
            <div class="lf-score-circle" data-score="${analysis.matchScore}">
              <svg class="lf-score-ring" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="#e0e0e0" stroke-width="12"/>
                <circle cx="60" cy="60" r="54" fill="none" stroke="#0a66c2" stroke-width="12" 
                        stroke-dasharray="${
                          (analysis.matchScore / 100) * 339.29
                        } 339.29" 
                        stroke-linecap="round" transform="rotate(-90 60 60)"/>
              </svg>
              <div class="lf-score-text">
                <div class="lf-score-number">${analysis.matchScore}</div>
                <div class="lf-score-label">Match</div>
              </div>
            </div>
            <div class="lf-score-details">
              <h3>Compatibility Score</h3>
              <p>${this.getScoreDescription(analysis.matchScore)}</p>
            </div>
          </div>

          <!-- Summary -->
          <div class="lf-analysis-section">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>
              Profile Summary
            </h3>
            <p class="lf-summary-text">${analysis.summary}</p>
          </div>

          <!-- Shared Interests -->
          ${
            analysis.sharedInterests.length > 0
              ? `
          <div class="lf-analysis-section">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Shared Interests & Commonalities
            </h3>
            <ul class="lf-interests-list">
              ${analysis.sharedInterests
                .map((interest) => `<li>${interest}</li>`)
                .join("")}
            </ul>
          </div>
          `
              : ""
          }

          <!-- Insights -->
          ${
            analysis.insights.length > 0
              ? `
          <div class="lf-analysis-section">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              Professional Insights
            </h3>
            <ul class="lf-insights-list">
              ${analysis.insights
                .map((insight) => `<li>${insight}</li>`)
                .join("")}
            </ul>
          </div>
          `
              : ""
          }

          <!-- Connection Value -->
          ${
            analysis.connectionValue
              ? `
          <div class="lf-analysis-section lf-connection-value">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              Why Connect?
            </h3>
            <p>${analysis.connectionValue}</p>
          </div>
          `
              : ""
          }

          <!-- Compatibility Factors -->
          ${
            analysis.compatibilityFactors.length > 0
              ? `
          <div class="lf-analysis-section">
            <h3>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Key Compatibility Factors
            </h3>
            <ul class="lf-compatibility-list">
              ${analysis.compatibilityFactors
                .map((factor) => `<li>${factor}</li>`)
                .join("")}
            </ul>
          </div>
          `
              : ""
          }

          <!-- Disclaimer -->
          <div class="lf-disclaimer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            <p><strong>Note:</strong> This analysis is AI-generated and may not be completely accurate. Use your own judgment and instincts when deciding to connect.</p>
          </div>
        </div>

        <div class="lf-modal-footer">
          <button class="lf-btn-secondary lf-close-btn">Close</button>
          <button class="lf-btn-primary lf-connect-btn">Send Connection Request</button>
        </div>
      </div>
    `;

    // Apply modal styles
    this.applyModalStyles();

    // Add to page
    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector(".lf-modal-overlay").addEventListener("click", () => {
      modal.remove();
    });

    modal.querySelector(".lf-modal-close").addEventListener("click", () => {
      modal.remove();
    });

    modal.querySelector(".lf-close-btn").addEventListener("click", () => {
      modal.remove();
    });

    modal.querySelector(".lf-connect-btn").addEventListener("click", () => {
      // Find and click LinkedIn's connect button
      const connectButton = document.querySelector(
        'button[aria-label*="Invite"][aria-label*="to connect"], button[aria-label*="Connect"]'
      );
      if (connectButton) {
        connectButton.click();
        modal.remove();
      } else {
        alert("Could not find connect button. Please connect manually.");
      }
    });

    // Animate in
    setTimeout(() => {
      modal.classList.add("lf-modal-visible");
    }, 10);
  }

  /**
   * Get score description based on match score
   */
  getScoreDescription(score) {
    if (score >= 80) {
      return "Excellent match! Strong potential for a valuable professional connection.";
    } else if (score >= 60) {
      return "Good match. Several shared interests and complementary backgrounds.";
    } else if (score >= 40) {
      return "Moderate match. Some commonalities that could lead to interesting connections.";
    } else {
      return "Limited overlap currently, but potential for diverse perspectives.";
    }
  }

  /**
   * Apply modal styles
   */
  applyModalStyles() {
    if (document.querySelector("#lf-profile-modal-styles")) return;

    const styles = document.createElement("style");
    styles.id = "lf-profile-modal-styles";
    styles.textContent = `
      .lf-profile-analysis-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .lf-profile-analysis-modal.lf-modal-visible {
        opacity: 1;
      }
      
      .lf-modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }
      
      .lf-modal-container {
        position: relative;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 700px;
        width: 90%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      }
      
      .lf-modal-visible .lf-modal-container {
        transform: scale(1);
      }
      
      .lf-modal-header {
        padding: 24px 32px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .lf-modal-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #000;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .lf-header-icon {
        width: 28px;
        height: 28px;
        color: #0a66c2;
      }
      
      .lf-modal-close {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: #666;
        border-radius: 50%;
        transition: all 0.2s;
      }
      
      .lf-modal-close:hover {
        background: #f3f6f8;
        color: #000;
      }
      
      .lf-modal-close svg {
        width: 24px;
        height: 24px;
        display: block;
      }
      
      .lf-modal-body {
        padding: 24px 32px;
        overflow-y: auto;
        flex: 1;
      }
      
      .lf-analysis-section {
        margin-bottom: 28px;
      }
      
      .lf-analysis-section h3 {
        font-size: 18px;
        font-weight: 600;
        color: #000;
        margin: 0 0 12px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .lf-analysis-section h3 svg {
        width: 20px;
        height: 20px;
        color: #0a66c2;
      }
      
      .lf-match-score {
        display: flex;
        align-items: center;
        gap: 24px;
        padding: 24px;
        background: linear-gradient(135deg, #f3f6f8 0%, #e8edf1 100%);
        border-radius: 12px;
      }
      
      .lf-score-circle {
        position: relative;
        width: 120px;
        height: 120px;
        flex-shrink: 0;
      }
      
      .lf-score-ring {
        transform: rotate(-90deg);
      }
      
      .lf-score-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
      }
      
      .lf-score-number {
        font-size: 32px;
        font-weight: 700;
        color: #0a66c2;
        line-height: 1;
      }
      
      .lf-score-label {
        font-size: 14px;
        color: #666;
        margin-top: 4px;
      }
      
      .lf-score-details h3 {
        margin-bottom: 8px;
      }
      
      .lf-score-details p {
        color: #666;
        line-height: 1.5;
        margin: 0;
      }
      
      .lf-summary-text {
        color: #333;
        line-height: 1.6;
        margin: 0;
        font-size: 15px;
      }
      
      .lf-interests-list,
      .lf-insights-list,
      .lf-compatibility-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      
      .lf-interests-list li,
      .lf-insights-list li,
      .lf-compatibility-list li {
        padding: 10px 12px;
        background: #f8f9fa;
        border-radius: 8px;
        margin-bottom: 8px;
        color: #333;
        line-height: 1.5;
        position: relative;
        padding-left: 32px;
      }
      
      .lf-interests-list li:before {
        content: "❤️";
        position: absolute;
        left: 12px;
      }
      
      .lf-insights-list li:before {
        content: "💡";
        position: absolute;
        left: 12px;
      }
      
      .lf-compatibility-list li:before {
        content: "✓";
        position: absolute;
        left: 12px;
        color: #0a66c2;
        font-weight: bold;
      }
      
      .lf-connection-value {
        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
        padding: 20px;
        border-radius: 12px;
        border-left: 4px solid #0a66c2;
      }
      
      .lf-connection-value h3 {
        color: #0a66c2;
      }
      
      .lf-connection-value p {
        color: #1565c0;
        margin: 0;
        line-height: 1.6;
        font-weight: 500;
      }
      
      .lf-disclaimer {
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 8px;
        padding: 16px;
        display: flex;
        gap: 12px;
        align-items: start;
      }
      
      .lf-disclaimer svg {
        width: 20px;
        height: 20px;
        color: #f57c00;
        flex-shrink: 0;
        margin-top: 2px;
      }
      
      .lf-disclaimer p {
        margin: 0;
        color: #856404;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .lf-modal-footer {
        padding: 20px 32px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }
      
      .lf-btn-primary,
      .lf-btn-secondary {
        padding: 12px 24px;
        border-radius: 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
      }
      
      .lf-btn-primary {
        background: #0a66c2;
        color: white;
      }
      
      .lf-btn-primary:hover {
        background: #004182;
      }
      
      .lf-btn-secondary {
        background: #f3f6f8;
        color: #666;
      }
      
      .lf-btn-secondary:hover {
        background: #e8edf1;
        color: #000;
      }
    `;

    document.head.appendChild(styles);
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error("ProfileAnalyzer: Showing error to user:", message);

    // Create a nice error modal instead of alert
    const errorModal = document.createElement("div");
    errorModal.className = "lf-profile-analysis-modal lf-modal-visible";
    errorModal.innerHTML = `
      <div class="lf-modal-overlay"></div>
      <div class="lf-modal-container" style="max-width: 500px;">
        <div class="lf-modal-header">
          <h2 style="color: #d32f2f;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 28px; height: 28px; display: inline-block; vertical-align: middle; margin-right: 8px;">
              <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
            </svg>
            Analysis Error
          </h2>
          <button class="lf-modal-close" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="lf-modal-body" style="padding: 24px 32px;">
          <p style="margin: 0 0 16px 0; color: #333; line-height: 1.6;">${message}</p>
          ${
            message.includes("API key")
              ? `
            <p style="margin: 0; padding: 16px; background: #e3f2fd; border-radius: 8px; color: #1565c0; font-size: 14px;">
              💡 <strong>Tip:</strong> Click the extension icon in your browser toolbar, then click "Settings" to add your API key.
            </p>
          `
              : ""
          }
        </div>
        <div class="lf-modal-footer">
          <button class="lf-btn-primary" style="background: #d32f2f; width: 100%;">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(errorModal);

    const closeModal = () => errorModal.remove();
    errorModal
      .querySelector(".lf-modal-overlay")
      .addEventListener("click", closeModal);
    errorModal
      .querySelector(".lf-modal-close")
      .addEventListener("click", closeModal);
    errorModal
      .querySelector(".lf-btn-primary")
      .addEventListener("click", closeModal);
  }
}

// Initialize on page load (with settings check)
console.log(
  "ProfileAnalyzer: Script loaded, document.readyState =",
  document.readyState
);

if (document.readyState === "loading") {
  console.log("ProfileAnalyzer: Waiting for DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", () => {
    console.log(
      "ProfileAnalyzer: DOMContentLoaded fired, creating instance..."
    );
    window.linkedInProfileAnalyzer = new ProfileAnalyzer();
  });
} else {
  console.log(
    "ProfileAnalyzer: DOM already loaded, creating instance immediately..."
  );
  window.linkedInProfileAnalyzer = new ProfileAnalyzer();
}

// Export for debugging in console
console.log("ProfileAnalyzer: ✅ Module loaded and ready");
