/**
 * Options tab shell — show/hide panels; does not change feature logic.
 */
(function () {
  const PANELS = [
    {
      id: "dashboard",
      label: "Dashboard",
      title: "Dashboard",
      blurb: "Quick status across CareerCraft tools.",
    },
    {
      id: "job-tracker",
      label: "Job Tracker",
      title: "Job Tracker",
      blurb: "Track viewed jobs, ATS scores, and application status.",
    },
    {
      id: "searches",
      label: "Searches & Alerts",
      title: "Searches & Alerts",
      blurb: "Saved LinkedIn searches and job notifications.",
    },
    {
      id: "ai-keys",
      label: "AI API Keys",
      title: "AI API Keys",
      blurb: "Choose your AI provider and manage keys securely.",
    },
    {
      id: "casper",
      label: "Casper",
      title: "Casper AI",
      blurb: "Chat assistant settings for LinkedIn.",
    },
    {
      id: "tools",
      label: "Tools",
      title: "Tools",
      blurb: "ATS scoring reference and cache controls.",
    },
    {
      id: "account",
      label: "Account",
      title: "Profile & Account",
      blurb: "Your profile data used for ATS analysis.",
    },
  ];

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function setActivePanel(panelId) {
    const meta = PANELS.find((p) => p.id === panelId) || PANELS[0];
    $all(".cc-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.panel === meta.id);
    });
    $all(".cc-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === meta.id);
    });
    const title = $("#ccHeaderTitle");
    const blurb = $("#ccHeaderBlurb");
    if (title) title.textContent = meta.title;
    if (blurb) blurb.textContent = meta.blurb;
    try {
      history.replaceState(null, "", "#" + meta.id);
    } catch (e) {}
  }

  async function refreshDashboard() {
    try {
      const data = await chrome.storage.local.get([
        "active_provider",
        "gemini_api_key",
        "openai_api_key",
        "openrouter_api_key",
        "saved_job_searches",
        "casper_enabled",
        "notification_settings",
        "ats_analysis_cache",
        "atsCheckerEnabled",
      ]);

      const searches = data.saved_job_searches || [];
      const max =
        (typeof SavedSearchUtils !== "undefined" &&
          SavedSearchUtils.MAX_SAVED_SEARCHES) ||
        5;
      const provider = data.active_provider || "none";
      const keyReady = !!(
        (provider === "gemini" && data.gemini_api_key) ||
        (provider === "openai" && data.openai_api_key) ||
        (provider === "openrouter" && data.openrouter_api_key)
      );
      const cache = data.ats_analysis_cache || {};
      const cacheCount = Object.keys(cache).length;
      const notifOn = !!(
        data.notification_settings && data.notification_settings.enabled
      );

      const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };

      setText("dashSearchSlots", `${searches.length}/${max}`);
      setText(
        "dashAiProvider",
        keyReady ? String(provider) : "Not configured"
      );
      setText("dashCasper", data.casper_enabled ? "On" : "Off");
      setText("dashAts", data.atsCheckerEnabled === false ? "Off" : "On");
      setText("dashCache", String(cacheCount));
      setText("dashAlerts", notifOn ? "On" : "Off");
    } catch (e) {
      console.warn("Dashboard refresh failed", e);
    }
  }

  function buildShell() {
    if ($("#ccOptionsShell")) return true;

    document.body.classList.add("cc-app");

    const container = $(".container");
    if (!container) return false;

    $all(".section").forEach((section) => {
      const title = (section.querySelector(".section-title")?.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (title.includes("ai provider")) section.dataset.panel = "ai-keys";
      else if (title.includes("saved job search"))
        section.dataset.panel = "searches";
      else if (title.includes("notification"))
        section.dataset.panel = "searches";
      else if (title.includes("casper")) section.dataset.panel = "casper";
      else if (title.includes("ats scoring") || title.includes("cache"))
        section.dataset.panel = "tools";
      else if (title.includes("profile") || title.includes("console"))
        section.dataset.panel = "account";
      else if (!section.dataset.panel) section.dataset.panel = "tools";
    });

    const shell = document.createElement("div");
    shell.id = "ccOptionsShell";
    shell.className = "cc-options-shell";

    const nav = document.createElement("nav");
    nav.className = "cc-options-nav";
    nav.setAttribute("aria-label", "Settings");
    nav.innerHTML =
      '<div class="cc-brand"><h1>CareerCraft AI</h1><p>Casper · Jobs &amp; Management</p></div>' +
      PANELS.map(function (p) {
        return (
          '<button type="button" class="cc-nav-btn" data-panel="' +
          p.id +
          '">' +
          p.label +
          "</button>"
        );
      }).join("");

    const main = document.createElement("div");
    main.className = "cc-options-main";
    main.innerHTML =
      '<header class="cc-options-header">' +
      '<h2 id="ccHeaderTitle">Dashboard</h2>' +
      '<p id="ccHeaderBlurb">Quick status across CareerCraft tools.</p>' +
      "</header>" +
      '<div class="cc-options-content" id="ccOptionsContent"></div>';

    const contentHost = main.querySelector("#ccOptionsContent");

    const dash = document.createElement("div");
    dash.className = "cc-panel active";
    dash.dataset.panel = "dashboard";
    dash.innerHTML =
      '<div class="cc-dashboard-grid">' +
      '<div class="cc-card"><div class="cc-metric" id="dashSearchSlots">—</div><div class="cc-metric-label">Search slots</div></div>' +
      '<div class="cc-card"><div class="cc-metric" id="dashAiProvider">—</div><div class="cc-metric-label">Active AI</div></div>' +
      '<div class="cc-card"><div class="cc-metric" id="dashAts">—</div><div class="cc-metric-label">ATS checker</div></div>' +
      '<div class="cc-card"><div class="cc-metric" id="dashCasper">—</div><div class="cc-metric-label">Casper</div></div>' +
      '<div class="cc-card"><div class="cc-metric" id="dashAlerts">—</div><div class="cc-metric-label">Job alerts</div></div>' +
      '<div class="cc-card"><div class="cc-metric" id="dashCache">—</div><div class="cc-metric-label">Cached ATS jobs</div></div>' +
      "</div>" +
      '<p class="cc-muted">Use the left menu for full settings. All existing controls keep the same IDs — nothing was removed.</p>' +
      '<div class="cc-dashboard-actions">' +
      '<button type="button" class="cc-btn" data-goto="ai-keys">AI API Keys</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" data-goto="searches">Searches &amp; Alerts</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" data-goto="casper">Casper</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" data-goto="job-tracker">Job Tracker</button>' +
      "</div>";
    contentHost.appendChild(dash);

    const tracker = document.createElement("div");
    tracker.className = "cc-panel";
    tracker.dataset.panel = "job-tracker";
    tracker.innerHTML =
      '<div class="cc-placeholder"><strong>Job Tracker is next.</strong><br />' +
      "Viewed jobs, ATS scores, applied/rejected status, CSV export, and applicant counts will live here in Phase 3. Existing ATS analysis on LinkedIn job pages is unchanged.</div>";
    contentHost.appendChild(tracker);

    ["ai-keys", "searches", "casper", "tools", "account"].forEach(function (id) {
      const panel = document.createElement("div");
      panel.className = "cc-panel";
      panel.dataset.panel = id;
      $all('.section[data-panel="' + id + '"]').forEach(function (sec) {
        panel.appendChild(sec);
      });
      contentHost.appendChild(panel);
    });

    const footer = container.querySelector(".footer");
    const accountPanel = contentHost.querySelector(
      '.cc-panel[data-panel="account"]'
    );
    if (footer && accountPanel) accountPanel.appendChild(footer);

    container.replaceWith(shell);
    shell.appendChild(nav);
    shell.appendChild(main);

    nav.addEventListener("click", function (e) {
      const btn = e.target.closest(".cc-nav-btn");
      if (!btn) return;
      setActivePanel(btn.dataset.panel);
      if (btn.dataset.panel === "dashboard") refreshDashboard();
    });

    dash.addEventListener("click", function (e) {
      const goto = e.target.closest("[data-goto]");
      if (!goto) return;
      setActivePanel(goto.dataset.goto);
    });

    const hash = (location.hash || "").replace(/^#/, "");
    const initial = PANELS.some(function (p) {
      return p.id === hash;
    })
      ? hash
      : "dashboard";
    setActivePanel(initial);
    return true;
  }

  window.CCOptionsShell = {
    build: buildShell,
    setActivePanel: setActivePanel,
    refreshDashboard: refreshDashboard,
  };
})();
