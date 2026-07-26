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
      id: "feed-widgets",
      label: "Feed Widgets",
      title: "Feed Widgets",
      blurb: "Right-rail cards on LinkedIn: Jobs to review and favorite authors.",
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

    if (meta.id === "job-tracker") {
      renderJobTracker().catch(() => {});
    }
    if (meta.id === "searches") {
      try {
        if (typeof loadNotificationSettings === "function") {
          loadNotificationSettings().catch(function () {});
        }
        if (typeof loadNotificationLogs === "function") {
          loadNotificationLogs().catch(function () {});
        }
      } catch (e) {}
    }
    if (meta.id === "feed-widgets") {
      renderFeedWidgetsSettings().catch(function () {});
    }
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text == null ? "" : String(text);
    return d.innerHTML;
  }

  let trackerFilterStatus = "all";
  let trackerFilterQ = "";
  let trackerFilterRecency = "all";
  let trackerFilterDate = "all";
  let trackerFilterDateFrom = "";
  let trackerFilterDateTo = "";
  let trackerStarredOnly = false;
  let trackerPage = 1;
  const TRACKER_PAGE_SIZE = 25;
  let trackerExpandedId = null;
  let trackerStorageListener = null;

  function statusLabel(status) {
    if (
      typeof JobTrackerStore !== "undefined" &&
      JobTrackerStore.statusLabel
    ) {
      return JobTrackerStore.statusLabel(status);
    }
    const labels = {
      new: "New",
      viewed: "Viewed",
      applied: "Applied",
      interview: "Got interview call",
      confirmed: "Confirmed",
      rejected: "Rejected",
      expired: "Expired",
      archived: "Archived",
    };
    const key = String(status || "");
    return labels[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "");
  }

  function statusOptionsHtml(selected) {
    const statuses =
      (typeof JobTrackerStore !== "undefined" && JobTrackerStore.STATUSES) || [
        "new",
        "viewed",
        "applied",
        "interview",
        "confirmed",
        "rejected",
        "expired",
        "archived",
      ];
    return statuses
      .map(function (s) {
        return (
          '<option value="' +
          s +
          '"' +
          (s === selected ? " selected" : "") +
          ">" +
          escapeHtml(statusLabel(s)) +
          "</option>"
        );
      })
      .join("");
  }

  function sourceBadge(source) {
    const s = source || "viewed";
    const label = s === "alert" ? "Alert" : s === "ats" ? "ATS" : "Viewed";
    return (
      '<span class="cc-source-badge cc-source-' +
      escapeHtml(s) +
      '">' +
      label +
      "</span>"
    );
  }

  function starControlHtml(job) {
    const starred = !!job.starred || (job.starRating && job.starRating > 0);
    return (
      '<button type="button" class="cc-fav-btn' +
      (starred ? " active" : "") +
      '" data-tracker-star data-job-id="' +
      escapeHtml(job.id) +
      '" data-starred="' +
      (starred ? "1" : "0") +
      '" title="' +
      (starred ? "Remove favorite" : "Mark as favorite") +
      '">' +
      (starred ? "★" : "☆") +
      "</button>"
    );
  }

  function atsDetailHtml(job) {
    const d = job.atsDetails;
    if (!d) {
      return (
        '<p class="cc-muted">No detailed ATS snapshot saved yet. Re-open the job on LinkedIn after analysis to capture full details.</p>'
      );
    }
    let html = "";
    if (d.overallScore != null) {
      html +=
        "<p><strong>Overall:</strong> " +
        escapeHtml(String(d.overallScore)) +
        "</p>";
    }
    if (d.summary) {
      html += "<p>" + escapeHtml(String(d.summary)) + "</p>";
    }
    if (d.breakdown && typeof d.breakdown === "object") {
      html += '<ul class="cc-ats-breakdown">';
      Object.keys(d.breakdown).forEach(function (key) {
        const b = d.breakdown[key];
        const score =
          b && typeof b === "object" && b.score != null
            ? b.score
            : typeof b === "number"
            ? b
            : "—";
        html +=
          "<li><strong>" +
          escapeHtml(key) +
          ":</strong> " +
          escapeHtml(String(score)) +
          "</li>";
      });
      html += "</ul>";
    }
    if (Array.isArray(d.strengths) && d.strengths.length) {
      html +=
        "<p><strong>Strengths:</strong> " +
        escapeHtml(d.strengths.join("; ")) +
        "</p>";
    }
    if (Array.isArray(d.gaps) && d.gaps.length) {
      html +=
        "<p><strong>Gaps:</strong> " + escapeHtml(d.gaps.join("; ")) + "</p>";
    }
    return html || '<p class="cc-muted">ATS details present but empty.</p>';
  }

  function currentTrackerFilters() {
    return {
      status: trackerFilterStatus,
      q: trackerFilterQ,
      recency: trackerFilterRecency,
      dateKey: trackerFilterDate,
      dateFrom: trackerFilterDateFrom,
      dateTo: trackerFilterDateTo,
      starredOnly: trackerStarredOnly,
    };
  }

  function toLocalDateKey(ts) {
    const d = new Date(ts || 0);
    if (Number.isNaN(d.getTime()) || !ts) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatDateKeyLabel(key) {
    if (!key) return "";
    if (key === "today") return "Today";
    if (key === "yesterday") return "Yesterday";
    const parts = String(key).split("-");
    if (parts.length !== 3) return key;
    const d = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );
    if (Number.isNaN(d.getTime())) return key;
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function buildDateFilterOptionsHtml(allJobs) {
    const today = toLocalDateKey(Date.now());
    const yesterday = toLocalDateKey(Date.now() - 24 * 60 * 60 * 1000);
    const counts = {};
    (allJobs || []).forEach(function (job) {
      const key = toLocalDateKey(job.viewedAt || job.updatedAt);
      if (!key) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    const keys = Object.keys(counts).sort(function (a, b) {
      return a < b ? 1 : a > b ? -1 : 0;
    });
    let html =
      '<option value="all">All dates</option>' +
      '<option value="today">Today' +
      (counts[today] ? " (" + counts[today] + ")" : "") +
      "</option>" +
      '<option value="yesterday">Yesterday' +
      (counts[yesterday] ? " (" + counts[yesterday] + ")" : "") +
      "</option>" +
      '<option value="custom">Custom range…</option>';
    keys.forEach(function (key) {
      if (key === today || key === yesterday) return;
      html +=
        '<option value="' +
        escapeHtml(key) +
        '">' +
        escapeHtml(formatDateKeyLabel(key)) +
        " (" +
        counts[key] +
        ")</option>";
    });
    return html;
  }

  function downloadCsv(rows, suffix) {
    const csv = JobTrackerStore.rowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download =
      "careercraft-job-tracker-" +
      (suffix || "export") +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function selectedJobIds(tracker) {
    return Array.from(
      tracker.querySelectorAll(".cc-tracker-check:checked")
    ).map(function (el) {
      return el.getAttribute("data-job-id");
    });
  }

  function bindTrackerEvents(tracker) {
    const statusFilter = tracker.querySelector("#ccTrackerStatusFilter");
    const recencyFilter = tracker.querySelector("#ccTrackerRecencyFilter");
    const dateFilter = tracker.querySelector("#ccTrackerDateFilter");
    const starredOnly = tracker.querySelector("#ccTrackerStarredOnly");
    const searchInput = tracker.querySelector("#ccTrackerSearch");
    const exportBtn = tracker.querySelector("#ccTrackerExportCsv");
    const copyBtn = tracker.querySelector("#ccTrackerCopyTsv");
    const exportSel = tracker.querySelector("#ccTrackerExportSelected");
    const copySel = tracker.querySelector("#ccTrackerCopySelected");
    const deleteSel = tracker.querySelector("#ccTrackerDeleteSelected");
    const selectPage = tracker.querySelector("#ccTrackerSelectPage");
    const prevBtn = tracker.querySelector("#ccTrackerPrev");
    const nextBtn = tracker.querySelector("#ccTrackerNext");
    const saveRefresh = tracker.querySelector("#ccTrackerSaveRefresh");

    if (statusFilter) {
      statusFilter.value = trackerFilterStatus;
      statusFilter.addEventListener("change", function () {
        trackerFilterStatus = statusFilter.value;
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (recencyFilter) {
      recencyFilter.value = trackerFilterRecency;
      recencyFilter.addEventListener("change", function () {
        trackerFilterRecency = recencyFilter.value;
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (dateFilter) {
      dateFilter.value = trackerFilterDate;
      dateFilter.addEventListener("change", function () {
        trackerFilterDate = dateFilter.value || "all";
        if (trackerFilterDate !== "custom") {
          trackerFilterDateFrom = "";
          trackerFilterDateTo = "";
        }
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    const dateFrom = tracker.querySelector("#ccTrackerDateFrom");
    const dateTo = tracker.querySelector("#ccTrackerDateTo");
    const clearRange = tracker.querySelector("#ccTrackerClearDateRange");
    if (dateFrom) {
      dateFrom.value = trackerFilterDateFrom;
      dateFrom.addEventListener("change", function () {
        trackerFilterDateFrom = dateFrom.value || "";
        trackerFilterDate = "custom";
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (dateTo) {
      dateTo.value = trackerFilterDateTo;
      dateTo.addEventListener("change", function () {
        trackerFilterDateTo = dateTo.value || "";
        trackerFilterDate = "custom";
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (clearRange) {
      clearRange.addEventListener("click", function () {
        trackerFilterDateFrom = "";
        trackerFilterDateTo = "";
        trackerFilterDate = "all";
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (starredOnly) {
      starredOnly.checked = trackerStarredOnly;
      starredOnly.addEventListener("change", function () {
        trackerStarredOnly = !!starredOnly.checked;
        trackerPage = 1;
        renderJobTracker().catch(function () {});
      });
    }
    if (searchInput) {
      searchInput.value = trackerFilterQ;
      let t = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () {
          trackerFilterQ = searchInput.value || "";
          trackerPage = 1;
          renderJobTracker().catch(function () {});
        }, 200);
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener("click", async function () {
        try {
          const rows = await JobTrackerStore.exportRows({
            filters: currentTrackerFilters(),
          });
          downloadCsv(rows, "filtered");
        } catch (e) {
          console.warn("Export CSV failed", e);
        }
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener("click", async function () {
        try {
          const rows = await JobTrackerStore.exportRows({
            filters: currentTrackerFilters(),
          });
          await navigator.clipboard.writeText(JobTrackerStore.rowsToTsv(rows));
          copyBtn.textContent = "Copied!";
          setTimeout(function () {
            copyBtn.textContent = "Copy visible list";
          }, 1500);
        } catch (e) {
          console.warn("Copy TSV failed", e);
        }
      });
    }
    if (exportSel) {
      exportSel.addEventListener("click", async function () {
        const ids = selectedJobIds(tracker);
        if (!ids.length) {
          alert("Select at least one job first.");
          return;
        }
        const rows = await JobTrackerStore.exportRows({ ids: ids });
        downloadCsv(rows, "selected");
      });
    }
    if (copySel) {
      copySel.addEventListener("click", async function () {
        const ids = selectedJobIds(tracker);
        if (!ids.length) {
          alert("Select at least one job first.");
          return;
        }
        const rows = await JobTrackerStore.exportRows({ ids: ids });
        await navigator.clipboard.writeText(JobTrackerStore.rowsToTsv(rows));
        copySel.textContent = "Copied!";
        setTimeout(function () {
          copySel.textContent = "Copy selected";
        }, 1500);
      });
    }
    if (deleteSel) {
      deleteSel.addEventListener("click", async function () {
        const ids = selectedJobIds(tracker);
        if (!ids.length) {
          alert("Select at least one job first.");
          return;
        }
        if (
          !confirm(
            "Delete " + ids.length + " selected job(s) from the tracker?"
          )
        )
          return;
        await JobTrackerStore.deleteJobs(ids);
        await renderJobTracker();
      });
    }
    if (selectPage) {
      selectPage.addEventListener("change", function () {
        tracker.querySelectorAll(".cc-tracker-check").forEach(function (cb) {
          cb.checked = selectPage.checked;
        });
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        if (trackerPage > 1) {
          trackerPage--;
          renderJobTracker().catch(function () {});
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        trackerPage++;
        renderJobTracker().catch(function () {});
      });
    }

    tracker.querySelectorAll("[data-tracker-status]").forEach(function (sel) {
      sel.addEventListener("change", async function () {
        await JobTrackerStore.setStatus(
          sel.getAttribute("data-job-id"),
          sel.value
        );
        if (trackerFilterStatus !== "all") {
          renderJobTracker().catch(function () {});
        }
      });
    });
    tracker.querySelectorAll("[data-tracker-delete]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-job-id");
        if (!id || !confirm("Remove this job from the tracker?")) return;
        await JobTrackerStore.deleteJob(id);
        await renderJobTracker();
      });
    });
    tracker.querySelectorAll("[data-tracker-star]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const id = btn.getAttribute("data-job-id");
        const on = btn.getAttribute("data-starred") === "1";
        await JobTrackerStore.setStarred(id, !on);
        await renderJobTracker();
      });
    });
    tracker.querySelectorAll("[data-tracker-expand]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-job-id");
        trackerExpandedId = trackerExpandedId === id ? null : id;
        renderJobTracker().catch(function () {});
      });
    });

    if (saveRefresh) {
      saveRefresh.addEventListener("click", async function () {
        try {
          const settings = {
            applicantCheckEnabled: !!tracker.querySelector(
              "#ccApplicantCheckEnabled"
            )?.checked,
            expiryCheckEnabled: !!tracker.querySelector("#ccExpiryCheckEnabled")
              ?.checked,
            applicantCheckMinutes: Number(
              tracker.querySelector("#ccApplicantCheckMinutes")?.value || 360
            ),
            expiryCheckMinutes: Number(
              tracker.querySelector("#ccExpiryCheckMinutes")?.value || 720
            ),
            maxJobsPerTick: Number(
              tracker.querySelector("#ccMaxJobsPerTick")?.value || 3
            ),
          };
          await JobTrackerStore.setRefreshSettings(settings);
          try {
            await chrome.runtime.sendMessage({
              action: "updateTrackerRefreshAlarms",
              settings: settings,
            });
          } catch (e) {}
          saveRefresh.textContent = "Saved";
          setTimeout(function () {
            saveRefresh.textContent = "Save refresh settings";
          }, 1500);
        } catch (e) {
          console.warn("Save refresh settings failed", e);
        }
      });
    }
  }

  function ensureTrackerStorageListener() {
    if (trackerStorageListener) return;
    trackerStorageListener = function (changes, area) {
      if (area !== "local") return;
      if (!changes.casper_job_tracker) return;
      const active = document.querySelector(
        '.cc-panel.active[data-panel="job-tracker"]'
      );
      if (active) renderJobTracker().catch(function () {});
    };
    try {
      chrome.storage.onChanged.addListener(trackerStorageListener);
    } catch (e) {}
  }

  async function renderRefreshSettingsBlock() {
    let settings = JobTrackerStore.DEFAULT_REFRESH_SETTINGS;
    try {
      settings = await JobTrackerStore.getRefreshSettings();
    } catch (e) {}
    return (
      '<details class="cc-tracker-settings"><summary>Job Tracker refresh settings</summary>' +
      '<p class="cc-muted">Optional background checks use quiet LinkedIn tabs. Keep off to save resources. Default is off.</p>' +
      '<div class="cc-tracker-settings-grid">' +
      '<label><input type="checkbox" id="ccApplicantCheckEnabled"' +
      (settings.applicantCheckEnabled ? " checked" : "") +
      " /> Update applicant counts periodically</label>" +
      '<label>Every (minutes) <input type="number" id="ccApplicantCheckMinutes" min="60" max="1440" value="' +
      escapeHtml(String(settings.applicantCheckMinutes)) +
      '" /></label>' +
      '<label><input type="checkbox" id="ccExpiryCheckEnabled"' +
      (settings.expiryCheckEnabled ? " checked" : "") +
      " /> Check if jobs are still open</label>" +
      '<label>Every (minutes) <input type="number" id="ccExpiryCheckMinutes" min="120" max="2880" value="' +
      escapeHtml(String(settings.expiryCheckMinutes)) +
      '" /></label>' +
      '<label>Max jobs per check <input type="number" id="ccMaxJobsPerTick" min="1" max="10" value="' +
      escapeHtml(String(settings.maxJobsPerTick)) +
      '" /></label>' +
      "</div>" +
      '<button type="button" class="cc-btn" id="ccTrackerSaveRefresh">Save refresh settings</button>' +
      "</details>"
    );
  }

  async function renderJobTracker() {
    const tracker = document.querySelector(
      '.cc-panel[data-panel="job-tracker"]'
    );
    if (!tracker) return;
    ensureTrackerStorageListener();

    if (typeof JobTrackerStore === "undefined") {
      tracker.innerHTML =
        '<div class="cc-placeholder">Job Tracker store failed to load. Reload the extension.</div>';
      return;
    }

    try {
      await JobTrackerStore.ensureSeeded();
    } catch (e) {
      console.warn("Job tracker seed failed", e);
    }

    const filters = currentTrackerFilters();
    const jobs = await JobTrackerStore.listJobs(filters);
    const allJobs = await JobTrackerStore.listJobs({ status: "all", q: "" });
    const totalPages = Math.max(1, Math.ceil(jobs.length / TRACKER_PAGE_SIZE));
    if (trackerPage > totalPages) trackerPage = totalPages;
    const start = (trackerPage - 1) * TRACKER_PAGE_SIZE;
    const pageJobs = jobs.slice(start, start + TRACKER_PAGE_SIZE);
    const settingsBlock = await renderRefreshSettingsBlock();
    const dateOptions = buildDateFilterOptionsHtml(allJobs);
    const showCustomRange =
      trackerFilterDate === "custom" ||
      !!trackerFilterDateFrom ||
      !!trackerFilterDateTo;

    const toolbar =
      '<div class="cc-tracker-toolbar">' +
      '<div class="cc-tracker-filters">' +
      '<label>Status <select id="ccTrackerStatusFilter"><option value="all">All</option>' +
      statusOptionsHtml(null).replace(/ selected/g, "") +
      "</select></label>" +
      '<label>Viewed <select id="ccTrackerRecencyFilter">' +
      '<option value="all">All</option>' +
      '<option value="recent">Last 7 days</option>' +
      '<option value="old">Older than 7 days</option>' +
      "</select></label>" +
      '<label>Date <select id="ccTrackerDateFilter">' +
      dateOptions +
      "</select></label>" +
      '<span class="cc-tracker-date-range' +
      (showCustomRange ? " is-open" : "") +
      '" id="ccTrackerDateRange">' +
      '<label>From <input type="date" id="ccTrackerDateFrom" /></label>' +
      '<label>To <input type="date" id="ccTrackerDateTo" /></label>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerClearDateRange">Clear dates</button>' +
      "</span>" +
      '<label class="cc-check-label"><input type="checkbox" id="ccTrackerStarredOnly" /> Favorites only</label>' +
      '<input type="search" id="ccTrackerSearch" placeholder="Search title, company, alert" />' +
      "</div>" +
      '<div class="cc-tracker-actions">' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerExportCsv">Export visible list</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerCopyTsv">Copy visible list</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerExportSelected">Export selected</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerCopySelected">Copy selected</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerDeleteSelected">Delete selected</button>' +
      "</div>" +
      '<p class="cc-tracker-hint">Visible list = Status / Viewed / Date (or custom From–To) / Favorites / search. Selected = checked rows.</p>' +
      "</div>";

    if (allJobs.length === 0) {
      tracker.innerHTML =
        toolbar +
        '<div class="cc-placeholder"><strong>View a job on LinkedIn to start tracking.</strong><br />' +
        "Opening a job detail page adds a row. Job alerts may also add cards when notifications run. Data stays local.</div>" +
        settingsBlock;
      bindTrackerEvents(tracker);
      return;
    }

    if (jobs.length === 0) {
      tracker.innerHTML =
        toolbar +
        '<div class="cc-placeholder">No jobs match this filter.</div>' +
        settingsBlock;
      bindTrackerEvents(tracker);
      return;
    }

    const rows = pageJobs
      .map(function (job) {
        const when = job.viewedAt
          ? new Date(job.viewedAt).toLocaleDateString()
          : "—";
        const score = job.atsScore != null ? job.atsScore : "—";
        const applicants =
          job.applicantCount != null ? String(job.applicantCount) : "—";
        const appUpdated = job.applicantUpdatedAt
          ? new Date(job.applicantUpdatedAt).toLocaleDateString()
          : "";
        const url = job.url || "#";
        const expanded = trackerExpandedId === job.id;
        let detail = "";
        if (expanded) {
          detail =
            '<tr class="cc-tracker-detail-row"><td colspan="10">' +
            '<div class="cc-tracker-detail">' +
            "<h4>ATS details</h4>" +
            atsDetailHtml(job) +
            "<h4>Company</h4><p>" +
            escapeHtml(
              (job.companyDetails && job.companyDetails.name) ||
                job.company ||
                "—"
            ) +
            "</p>" +
            '<p class="cc-muted">Applicants: ' +
            escapeHtml(applicants) +
            (appUpdated ? " (updated " + escapeHtml(appUpdated) + ")" : "") +
            (job.searchName
              ? " · Alert search: " + escapeHtml(job.searchName)
              : "") +
            "</p></div></td></tr>";
        }
        return (
          "<tr>" +
          '<td><input type="checkbox" class="cc-tracker-check" data-job-id="' +
          escapeHtml(job.id) +
          '" /></td>' +
          "<td>" +
          starControlHtml(job) +
          "</td>" +
          "<td><strong>" +
          escapeHtml(job.title || "Unknown") +
          "</strong> " +
          sourceBadge(job.source) +
          "</td>" +
          "<td>" +
          escapeHtml(job.company || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(job.location || "—") +
          "</td>" +
          "<td>" +
          escapeHtml(String(score)) +
          "</td>" +
          '<td><select data-tracker-status data-job-id="' +
          escapeHtml(job.id) +
          '">' +
          statusOptionsHtml(job.status || "viewed") +
          "</select></td>" +
          '<td title="' +
          escapeHtml(appUpdated) +
          '">' +
          escapeHtml(applicants) +
          "</td>" +
          "<td>" +
          escapeHtml(when) +
          "</td>" +
          '<td class="cc-tracker-row-actions"><span class="cc-tracker-row-actions-inner">' +
          '<button type="button" class="cc-btn cc-btn-secondary cc-btn-tiny" data-tracker-expand data-job-id="' +
          escapeHtml(job.id) +
          '">' +
          (expanded ? "Hide" : "Details") +
          "</button>" +
          '<a class="cc-btn cc-btn-secondary cc-btn-tiny" href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener">Open</a>' +
          '<button type="button" class="cc-btn cc-btn-secondary cc-btn-tiny" data-tracker-delete data-job-id="' +
          escapeHtml(job.id) +
          '">Delete</button>' +
          "</span></td></tr>" +
          detail
        );
      })
      .join("");

    tracker.innerHTML =
      toolbar +
      '<p class="cc-tracker-meta">Showing ' +
      pageJobs.length +
      " on page " +
      trackerPage +
      "/" +
      totalPages +
      " · " +
      jobs.length +
      " filtered of " +
      allJobs.length +
      " total (local)" +
      (trackerStarredOnly ? " · Showing favorites only" : "") +
      ".</p>" +
      '<div class="cc-tracker-table-wrap"><table class="cc-tracker-table">' +
      "<thead><tr>" +
      '<th><input type="checkbox" id="ccTrackerSelectPage" title="Select page" /></th>' +
      "<th>Fav</th><th>Title</th><th>Company</th><th>Location</th><th>ATS</th><th>Status</th><th>Applicants</th><th>Viewed</th><th></th>" +
      "</tr></thead><tbody>" +
      rows +
      "</tbody></table></div>" +
      '<div class="cc-tracker-pager">' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerPrev"' +
      (trackerPage <= 1 ? " disabled" : "") +
      ">Previous</button>" +
      "<span>Page " +
      trackerPage +
      " of " +
      totalPages +
      "</span>" +
      '<button type="button" class="cc-btn cc-btn-secondary" id="ccTrackerNext"' +
      (trackerPage >= totalPages ? " disabled" : "") +
      ">Next</button></div>" +
      settingsBlock;

    bindTrackerEvents(tracker);
  }

  async function refreshDashboard() {
    try {
      const data = await chrome.storage.local.get([
        "active_provider",
        "gemini_api_key",
        "openai_api_key",
        "openrouter_api_key",
        "deepseek_api_key",
        "qwen_api_key",
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
        (provider === "openrouter" && data.openrouter_api_key) ||
        (provider === "deepseek" && data.deepseek_api_key) ||
        (provider === "qwen" && data.qwen_api_key)
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

      try {
        if (typeof JobTrackerStore !== "undefined") {
          const stats = JobTrackerStore.countByStatus
            ? await JobTrackerStore.countByStatus()
            : null;
          const tracked = stats
            ? stats.total
            : (await JobTrackerStore.listJobs({ status: "all" })).length;
          setText("dashTrackedJobs", String(tracked || 0));
          setText(
            "dashApplied",
            String(stats ? stats.applied : 0)
          );
          setText(
            "dashInterview",
            String(stats ? stats.interview : 0)
          );
          setText(
            "dashRejected",
            String(stats ? stats.rejected : 0)
          );
          setText(
            "dashConfirmed",
            String(stats ? stats.confirmed : 0)
          );
          setText(
            "dashFavorites",
            String(stats ? stats.favorites : 0)
          );
        }
      } catch (e) {}
    } catch (e) {
      console.warn("Dashboard refresh failed", e);
    }
  }

  async function renderFeedWidgetsSettings() {
    const panel = document.querySelector('.cc-panel[data-panel="feed-widgets"]');
    if (!panel) return;

    const SETTINGS_KEY =
      (typeof AsideWidgets !== "undefined" && AsideWidgets.SETTINGS_KEY) ||
      "aside_widget_settings";
    const ALERTS_KEY =
      (typeof AsideWidgets !== "undefined" && AsideWidgets.ALERTS_KEY) ||
      "recent_job_alerts";
    const AUTHOR_POSTS_KEY =
      (typeof AsideWidgets !== "undefined" && AsideWidgets.AUTHOR_POSTS_KEY) ||
      "casper_author_posts";
    const DEBUG_KEY =
      (typeof AsideWidgets !== "undefined" && AsideWidgets.DEBUG_KEY) ||
      "aside_widgets_debug";
    const defaults =
      (typeof AsideWidgets !== "undefined" && AsideWidgets.DEFAULT_SETTINGS) || {
        authors: [],
        postsPerAuthor: 2,
        authorRefreshMinutes: 60,
        authorPostsFilter: "original",
        jobAlertsLimit: 5,
        jobAlertsTtlDays: 7,
        fillFromTracker: true,
      };

    function normalizeUrl(raw) {
      if (typeof AsideWidgets !== "undefined" && AsideWidgets.normalizeProfileUrl) {
        return AsideWidgets.normalizeProfileUrl(raw);
      }
      const s = String(raw || "").trim();
      if (!s) return null;
      let u = s;
      if (u.indexOf("http") !== 0) {
        u = "https://www.linkedin.com/" + u.replace(/^\/+/, "");
      }
      try {
        const url = new URL(u);
        if (!String(url.hostname || "").includes("linkedin.com")) return null;
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

    const data = await chrome.storage.local.get([
      "feature_flags",
      SETTINGS_KEY,
      DEBUG_KEY,
    ]);
    const flags = Object.assign(
      { authorWidget: false, jobBoardWidget: false },
      data.feature_flags || {}
    );
    const settings = Object.assign({}, defaults, data[SETTINGS_KEY] || {});
    if (!Array.isArray(settings.authors)) settings.authors = [];

    let authorRows = settings.authors
      .map(function (a, idx) {
        return (
          '<div class="cc-fw-author" data-idx="' +
          idx +
          '">' +
          '<div class="cc-fw-author-meta">' +
          "<strong>" +
          escapeHtml(a.label || a.id) +
          "</strong>" +
          '<span class="cc-muted">' +
          escapeHtml(a.url) +
          "</span></div>" +
          '<div class="cc-fw-author-actions">' +
          '<button type="button" class="cc-btn cc-btn-secondary cc-btn-tiny" data-fw-edit="' +
          idx +
          '">Edit</button>' +
          '<button type="button" class="cc-btn cc-btn-secondary cc-btn-tiny" data-fw-remove="' +
          idx +
          '">Remove</button>' +
          "</div></div>"
        );
      })
      .join("");
    if (!authorRows) {
      authorRows = '<p class="cc-muted">No authors yet. Add up to 5 LinkedIn profile URLs.</p>';
    }

    panel.innerHTML =
      '<div class="cc-card cc-fw-block">' +
      "<h3>Jobs to review card</h3>" +
      '<p class="cc-muted">Shows on the LinkedIn feed right rail when enabled. Uses job alerts and Job Tracker (ATS score, applicants, and status when available). Never scrapes LinkedIn just to fill this list.</p>' +
      '<label class="cc-check-label"><input type="checkbox" id="fwJobCardToggle" ' +
      (flags.jobBoardWidget ? "checked" : "") +
      " /> Show Jobs to review card on feed</label>" +
      '<div class="cc-fw-row">' +
      "<label>Max items <select id=\"fwJobLimit\">" +
      [3, 5, 10]
        .map(function (n) {
          return (
            '<option value="' +
            n +
            '"' +
            (settings.jobAlertsLimit === n ? " selected" : "") +
            ">" +
            n +
            "</option>"
          );
        })
        .join("") +
      "</select></label>" +
      "<label>Keep alerts for <select id=\"fwJobTtl\">" +
      [3, 7, 14]
        .map(function (n) {
          return (
            '<option value="' +
            n +
            '"' +
            (settings.jobAlertsTtlDays === n ? " selected" : "") +
            ">" +
            n +
            " days</option>"
          );
        })
        .join("") +
      "</select></label></div>" +
      '<label class="cc-check-label"><input type="checkbox" id="fwFillTracker" ' +
      (settings.fillFromTracker !== false ? "checked" : "") +
      " /> Fill empty slots from favorites &amp; recently viewed</label>" +
      '<p class="cc-muted">Job check alarms stay under Searches &amp; Alerts. <a href="#searches" id="fwGotoSearches">Open notification settings</a></p>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="fwClearAlerts">Clear recent alert items</button>' +
      "</div>" +
      '<div class="cc-card cc-fw-block">' +
      "<h3>Favorite authors card</h3>" +
      '<p class="cc-muted">Up to 5 authors. Shows miniature recent posts with profile photos. Soft auto-refresh uses brief background tabs (rate-limited). Recommended interval: every 1 hour.</p>' +
      '<label class="cc-check-label"><input type="checkbox" id="fwAuthorToggle" ' +
      (flags.authorWidget ? "checked" : "") +
      " /> Show favorite authors card on feed</label>" +
      '<div class="cc-fw-row"><label>Posts per author <select id="fwPostsPer">' +
      [1, 2, 5]
        .map(function (n) {
          return (
            '<option value="' +
            n +
            '"' +
            (settings.postsPerAuthor === n ? " selected" : "") +
            ">" +
            n +
            "</option>"
          );
        })
        .join("") +
      "</select></label>" +
      '<label>Auto-refresh <select id="fwAuthorRefresh">' +
      [
        { v: 0, t: "Manual only" },
        { v: 30, t: "Every 30 minutes" },
        { v: 60, t: "Every 1 hour (recommended)" },
        { v: 180, t: "Every 3 hours" },
        { v: 360, t: "Every 6 hours" },
      ]
        .map(function (o) {
          const cur =
            settings.authorRefreshMinutes == null
              ? 60
              : Number(settings.authorRefreshMinutes);
          return (
            '<option value="' +
            o.v +
            '"' +
            (cur === o.v ? " selected" : "") +
            ">" +
            o.t +
            "</option>"
          );
        })
        .join("") +
      "</select></label></div>" +
      '<div class="cc-fw-row"><label>Show posts <select id="fwAuthorFilter">' +
      [
        { v: "original", t: "Written by them only (no reposts)" },
        { v: "all", t: "All activity (include reposts)" },
      ]
        .map(function (o) {
          const cur =
            settings.authorPostsFilter === "all" ? "all" : "original";
          return (
            '<option value="' +
            o.v +
            '"' +
            (cur === o.v ? " selected" : "") +
            ">" +
            o.t +
            "</option>"
          );
        })
        .join("") +
      "</select></label></div>" +
      '<div id="fwAuthorList">' +
      authorRows +
      "</div>" +
      '<div class="cc-fw-add" id="fwAddForm">' +
      '<input type="url" id="fwAuthorUrl" placeholder="https://www.linkedin.com/in/username" />' +
      '<input type="text" id="fwAuthorLabel" placeholder="Display name (optional)" />' +
      '<button type="button" class="cc-btn" id="fwAuthorAdd"' +
      (settings.authors.length >= 5 ? " disabled" : "") +
      ">Add author</button>" +
      '<button type="button" class="cc-btn cc-btn-secondary" id="fwAuthorSaveEdit" style="display:none">Save edit</button>' +
      '<button type="button" class="cc-btn cc-btn-secondary" id="fwAuthorCancelEdit" style="display:none">Cancel</button>' +
      "</div>" +
      '<p class="cc-muted" id="fwAuthorHint"></p>' +
      "</div>" +
      '<div class="cc-card cc-fw-block">' +
      "<h3>Debug (temporary)</h3>" +
      '<label class="cc-check-label"><input type="checkbox" id="fwDebug" ' +
      (data[DEBUG_KEY] === true ? "checked" : "") +
      " /> Log aside widget events to the LinkedIn page console</label>" +
      '<p class="cc-muted">Keep off unless verifying Phase 4. Does not change LinkedIn UI.</p>' +
      "</div>";

    let editingIdx = null;

    async function saveFlags(partial) {
      const cur = await chrome.storage.local.get(["feature_flags"]);
      const next = Object.assign({}, cur.feature_flags || {}, partial);
      await chrome.storage.local.set({ feature_flags: next });
      if (typeof FeatureFlags !== "undefined" && FeatureFlags.invalidate) {
        FeatureFlags.invalidate();
      }
    }

    async function saveSettings(partial) {
      const cur = await chrome.storage.local.get([SETTINGS_KEY]);
      const next = Object.assign({}, defaults, cur[SETTINGS_KEY] || {}, partial);
      if (!Array.isArray(next.authors)) next.authors = [];
      await chrome.storage.local.set({ [SETTINGS_KEY]: next });
      return next;
    }

    panel.querySelector("#fwJobCardToggle").addEventListener("change", async function (e) {
      await saveFlags({ jobBoardWidget: !!e.target.checked });
    });
    panel.querySelector("#fwAuthorToggle").addEventListener("change", async function (e) {
      await saveFlags({ authorWidget: !!e.target.checked });
      try {
        chrome.runtime.sendMessage({ action: "updateAuthorPostsAlarm" });
      } catch (err) {}
    });
    panel.querySelector("#fwJobLimit").addEventListener("change", async function (e) {
      await saveSettings({ jobAlertsLimit: Number(e.target.value) || 5 });
    });
    panel.querySelector("#fwJobTtl").addEventListener("change", async function (e) {
      await saveSettings({ jobAlertsTtlDays: Number(e.target.value) || 7 });
    });
    panel.querySelector("#fwFillTracker").addEventListener("change", async function (e) {
      await saveSettings({ fillFromTracker: !!e.target.checked });
    });
    panel.querySelector("#fwPostsPer").addEventListener("change", async function (e) {
      await saveSettings({ postsPerAuthor: Number(e.target.value) || 2 });
    });
    panel.querySelector("#fwAuthorRefresh").addEventListener("change", async function (e) {
      await saveSettings({
        authorRefreshMinutes: Number(e.target.value) || 0,
      });
      try {
        chrome.runtime.sendMessage({ action: "updateAuthorPostsAlarm" });
      } catch (err) {}
    });
    panel.querySelector("#fwAuthorFilter").addEventListener("change", async function (e) {
      await saveSettings({
        authorPostsFilter: e.target.value === "all" ? "all" : "original",
      });
    });
    panel.querySelector("#fwDebug").addEventListener("change", async function (e) {
      await chrome.storage.local.set({ [DEBUG_KEY]: !!e.target.checked });
    });
    panel.querySelector("#fwClearAlerts").addEventListener("click", async function () {
      await chrome.storage.local.set({ [ALERTS_KEY]: [] });
      const hint = panel.querySelector("#fwAuthorHint");
      if (hint) hint.textContent = "Cleared recent alert items (Job Tracker unchanged).";
    });
    const goto = panel.querySelector("#fwGotoSearches");
    if (goto) {
      goto.addEventListener("click", function (e) {
        e.preventDefault();
        setActivePanel("searches");
      });
    }

    function setEditMode(on, idx) {
      editingIdx = on ? idx : null;
      panel.querySelector("#fwAuthorAdd").style.display = on ? "none" : "";
      panel.querySelector("#fwAuthorSaveEdit").style.display = on ? "" : "none";
      panel.querySelector("#fwAuthorCancelEdit").style.display = on ? "" : "none";
    }

    panel.querySelector("#fwAuthorAdd").addEventListener("click", async function () {
      const hint = panel.querySelector("#fwAuthorHint");
      const urlRaw = panel.querySelector("#fwAuthorUrl").value;
      const label = panel.querySelector("#fwAuthorLabel").value.trim();
      const norm = normalizeUrl(urlRaw);
      if (!norm) {
        if (hint) hint.textContent = "Enter a valid LinkedIn profile URL (/in/...).";
        return;
      }
      const cur = await saveSettings({});
      if (cur.authors.length >= 5) {
        if (hint) hint.textContent = "Maximum 5 authors.";
        return;
      }
      if (
        cur.authors.some(function (a) {
          return a.id === norm.id;
        })
      ) {
        if (hint) hint.textContent = "That author is already in the list.";
        return;
      }
      cur.authors.push({
        id: norm.id,
        url: norm.url,
        label: label || norm.id,
      });
      await saveSettings({ authors: cur.authors });
      try {
        chrome.runtime.sendMessage({ action: "updateAuthorPostsAlarm" });
      } catch (err) {}
      renderFeedWidgetsSettings().catch(function () {});
    });

    panel.querySelector("#fwAuthorSaveEdit").addEventListener("click", async function () {
      if (editingIdx == null) return;
      const hint = panel.querySelector("#fwAuthorHint");
      const urlRaw = panel.querySelector("#fwAuthorUrl").value;
      const label = panel.querySelector("#fwAuthorLabel").value.trim();
      const norm = normalizeUrl(urlRaw);
      if (!norm) {
        if (hint) hint.textContent = "Enter a valid LinkedIn profile URL (/in/...).";
        return;
      }
      const cur = await saveSettings({});
      const prev = cur.authors[editingIdx];
      cur.authors[editingIdx] = {
        id: norm.id,
        url: norm.url,
        label: label || norm.id,
        avatarUrl: prev && prev.avatarUrl ? prev.avatarUrl : "",
      };
      await saveSettings({ authors: cur.authors });
      if (prev && prev.id !== norm.id) {
        try {
          const r = await chrome.storage.local.get([AUTHOR_POSTS_KEY]);
          const cache = r[AUTHOR_POSTS_KEY] || {};
          delete cache[prev.id];
          await chrome.storage.local.set({ [AUTHOR_POSTS_KEY]: cache });
        } catch (e) {}
      }
      try {
        chrome.runtime.sendMessage({ action: "updateAuthorPostsAlarm" });
      } catch (err) {}
      renderFeedWidgetsSettings().catch(function () {});
    });

    panel.querySelector("#fwAuthorCancelEdit").addEventListener("click", function () {
      setEditMode(false);
      panel.querySelector("#fwAuthorUrl").value = "";
      panel.querySelector("#fwAuthorLabel").value = "";
    });

    panel.querySelectorAll("[data-fw-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const idx = Number(btn.getAttribute("data-fw-edit"));
        const a = settings.authors[idx];
        if (!a) return;
        panel.querySelector("#fwAuthorUrl").value = a.url;
        panel.querySelector("#fwAuthorLabel").value = a.label || "";
        setEditMode(true, idx);
      });
    });

    panel.querySelectorAll("[data-fw-remove]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const idx = Number(btn.getAttribute("data-fw-remove"));
        const cur = await saveSettings({});
        const removed = cur.authors.splice(idx, 1)[0];
        await saveSettings({ authors: cur.authors });
        if (removed && removed.id) {
          try {
            const r = await chrome.storage.local.get([AUTHOR_POSTS_KEY]);
            const cache = r[AUTHOR_POSTS_KEY] || {};
            delete cache[removed.id];
            await chrome.storage.local.set({ [AUTHOR_POSTS_KEY]: cache });
          } catch (e) {}
        }
        try {
          chrome.runtime.sendMessage({ action: "updateAuthorPostsAlarm" });
        } catch (err) {}
        renderFeedWidgetsSettings().catch(function () {});
      });
    });
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
      '<div class="cc-card"><div class="cc-metric" id="dashTrackedJobs">—</div><div class="cc-metric-label">Tracked jobs</div></div>' +
      "</div>" +
      '<h3 class="cc-dashboard-heading">Application pipeline</h3>' +
      '<p class="cc-muted cc-dashboard-blurb">Counts from Job Tracker statuses. Click a card to open that filter. Update status on each row to keep these accurate.</p>' +
      '<div class="cc-dashboard-grid cc-dashboard-pipeline">' +
      '<button type="button" class="cc-card cc-card-stat" data-goto="job-tracker" data-status-filter="applied"><div class="cc-metric" id="dashApplied">—</div><div class="cc-metric-label">Applied</div></button>' +
      '<button type="button" class="cc-card cc-card-stat" data-goto="job-tracker" data-status-filter="interview"><div class="cc-metric" id="dashInterview">—</div><div class="cc-metric-label">Got interview call</div></button>' +
      '<button type="button" class="cc-card cc-card-stat" data-goto="job-tracker" data-status-filter="confirmed"><div class="cc-metric" id="dashConfirmed">—</div><div class="cc-metric-label">Confirmed</div></button>' +
      '<button type="button" class="cc-card cc-card-stat" data-goto="job-tracker" data-status-filter="rejected"><div class="cc-metric" id="dashRejected">—</div><div class="cc-metric-label">Rejected</div></button>' +
      '<button type="button" class="cc-card cc-card-stat" data-goto="job-tracker" data-starred-filter="1"><div class="cc-metric" id="dashFavorites">—</div><div class="cc-metric-label">Favorites</div></button>' +
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
      '<div class="cc-placeholder">Loading job tracker…</div>';
    contentHost.appendChild(tracker);

    const feedWidgets = document.createElement("div");
    feedWidgets.className = "cc-panel";
    feedWidgets.dataset.panel = "feed-widgets";
    feedWidgets.innerHTML =
      '<div class="cc-placeholder">Loading feed widgets…</div>';
    contentHost.appendChild(feedWidgets);

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
      const statusFilter = goto.getAttribute("data-status-filter");
      const starredFilter = goto.getAttribute("data-starred-filter");
      if (starredFilter === "1") {
        trackerStarredOnly = true;
        trackerFilterStatus = "all";
        trackerPage = 1;
      } else if (statusFilter) {
        trackerFilterStatus = statusFilter;
        trackerStarredOnly = false;
        trackerPage = 1;
      }
      setActivePanel(goto.dataset.goto);
    });

    const hash = (location.hash || "").replace(/^#/, "");
    const hashPanel = hash.split("?")[0];
    const hashQuery = hash.indexOf("?") >= 0 ? hash.slice(hash.indexOf("?") + 1) : "";
    let focusJobId = "";
    try {
      focusJobId = new URLSearchParams(hashQuery).get("job") || "";
    } catch (e) {
      focusJobId = "";
    }
    if (focusJobId && hashPanel === "job-tracker") {
      trackerExpandedId = focusJobId;
      trackerFilterQ = focusJobId;
      trackerFilterStatus = "all";
      trackerPage = 1;
    }
    const initial = PANELS.some(function (p) {
      return p.id === hashPanel;
    })
      ? hashPanel
      : "dashboard";
    setActivePanel(initial);
    if (focusJobId && hashPanel === "job-tracker") {
      renderJobTracker().catch(function () {});
    }
    return true;
  }

  window.CCOptionsShell = {
    build: buildShell,
    setActivePanel: setActivePanel,
    refreshDashboard: refreshDashboard,
    renderJobTracker: renderJobTracker,
    renderFeedWidgetsSettings: renderFeedWidgetsSettings,
  };
})();
