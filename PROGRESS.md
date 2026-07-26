# CareerCraft Casper AI — Progress & Roadmap

**Last updated:** 2026-07-26  
**Product version:** 2.5.0  
**Active branch:** `phase/sidebar-widgets`  
**Repo:** [careercraft-casper-ai-for-linkedin-jobs-and-management](https://github.com/Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management)

Source PRD: Cursor plan `casper_redesign_prd` (System PRD & Implementation Plan).

---

## Status at a glance

| Phase | Name | Status |
| ----- | ---- | ------ |
| 0 | GitHub backup | **Done** |
| 1 | Harden (DOM adapter, feature flags, manifest hygiene) | **Done** |
| 2A | UX shell (options tabs, popup, welcome) | **Done** |
| 2B | DeepSeek + Qwen + OpenRouter presets | **Done** |
| 3 | Job Tracker hub | **Done** |
| 4 | LinkedIn right-rail widgets | **Done** (`phase/sidebar-widgets`, flags OFF by default) |
| 5 | Company people enrichment | **Next** |

---

## What we have now (shipped)

### Platform
- Private GitHub remote + phase branches
- LinkedIn DOM adapter + feature flags
- Design system + full-bleed Options shell (Dashboard, Job Tracker, Searches, Feed Widgets, AI Keys, Casper, Tools, Account)
- Compact popup + welcome onboarding

### AI
- Gemini / OpenAI / OpenRouter (unchanged careful key UX)
- DeepSeek + Qwen direct APIs
- Expanded OpenRouter model presets
- Host permissions for DeepSeek + DashScope intl

### Job Tracker (`casper_job_tracker` in `chrome.storage.local`)
> **Note:** PRD originally called for IndexedDB. We shipped on `chrome.storage.local` so content scripts and Options share one store without a separate IDB layer. IndexedDB remains optional later if volume grows.

- Soft upsert from job views, ATS cache, and alert cards
- Status pipeline: New → Viewed → Applied → Got interview call → Confirmed → Rejected → Expired → Archived
- Filters: status, recency, date / custom range, favorites, search
- Stars / favorites, bulk select, export / copy (visible + selected), delete, pagination
- ATS details panel, applicants refresh settings (default OFF)
- Company / location / applicants extraction hardening + migrations
- Dashboard **Application pipeline** cards: Applied, Interview, Confirmed, Rejected, Favorites (click → filtered tracker)

### Feed Widgets (Phase 4)
- Right-rail cards on LinkedIn feed (`aside[aria-label="Aside"]`), soft-fail, flags default **OFF**
- **Jobs to review:** alerts + tracker fill; ATS/applicants when known; exclude applied/pipeline; dismiss; LinkedIn + Tracker links; check-for-jobs
- **Favorite authors:** miniature posts, avatars, LinkedIn-style times, original-only filter, soft-fetch + passive extract, dismiss, auto-refresh interval
- Options **Feed Widgets** panel + popup toggles; CareerCraft footers

### Job alerts (hardened along the way)
- Alarm schedule preserved across reloads
- Stronger job-count extraction + soft-ingest notifications for new job IDs
- Notification icon / macOS button retry fixes
- Activity log depth improved

### Reliability fixes
- PDF worker for resume extract
- Formatter toolbar / Casper feed injectors updated for newer LinkedIn DOM
- Job Tracker Actions column table-border fix (flex on inner wrapper, not `<td>`)

---

## What’s left (next plan)

### Phase 5 — Company people enrichment (next)
- On-demand “Find contacts” on a tracker row (never bulk auto-scrape)
- Alumni / role heuristics; hard caps; store on job record
- Chrome Web Store / compliance review before enabling by default

### Follow-ups / polish
- [ ] Merge `phase/job-tracker` + `phase/sidebar-widgets` → `main` after smoke matrix
- [ ] Optional: migrate Job Tracker to IndexedDB if storage volume becomes an issue
- [ ] Orphaned modules decision (`profile-analyzer`, `saved-content-*`) still open from Phase 1D
- [ ] Windows Chrome spot-check of smoke matrix
- [ ] Chrome Web Store packaging pass (`CHROME_STORE_SUBMISSION_PLAN.md`)
- [ ] Consider enabling Feed Widgets flags by default only after Store / compliance review

---

## Smoke matrix (run after reload)

- Formatter on share + comment
- Image paste into compose
- ATS box on job detail
- Casper chat + feed analyze icon
- Last 1 hour filter pill
- Save / run / edit saved search
- Job notification settings + test notice
- Options green success toast
- AI Keys: save / mask / test; switch provider without losing other keys
- Job Tracker: filter by new statuses + Favorites dashboard card
- Dashboard pipeline counts match tracker
- Feed Widgets OFF by default; ON: Jobs to review + Favorite authors in aside, no duplicate host

---

## Checklists

- [PHASE_2A_CHECKLIST.md](PHASE_2A_CHECKLIST.md)
- [PHASE_2B_CHECKLIST.md](PHASE_2B_CHECKLIST.md)
- [PHASE_3_CHECKLIST.md](PHASE_3_CHECKLIST.md)
- [PHASE_4_CHECKLIST.md](PHASE_4_CHECKLIST.md)
