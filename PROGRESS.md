# CareerCraft Casper AI — Progress & Roadmap

**Last updated:** 2026-07-26  
**Product version:** 2.7.0  
**Active branch:** `phase/sidebar-widgets`  
**Repo:** [careercraft-casper-ai-for-linkedin-jobs-and-management](https://github.com/Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management)

Source PRD: Cursor plan `casper_redesign_prd` (System PRD & Implementation Plan).  
Phase 5 pivot: outreach-fit classification supersedes classic company-people scrape (deferred as **5B**).  
Phase 6: timeline / feed job discovery (people scrape still skipped).

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
| 5 | Outreach fit (employer kind) | **Done** |
| 5B | Company people enrichment (gated, direct employers only) | **Deferred / skipped for now** |
| 6 | Timeline job discovery | **Done** (flag `feedJobDiscover` OFF by default) |

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
- **Outreach fit (Phase 5):** `employerKind` classification (agency / job board / direct / unknown) on upsert + view; badges + manual override; no people scrape

### Feed Widgets (Phase 4)
- Right-rail cards on LinkedIn feed (`aside[aria-label="Aside"]`), soft-fail, flags default **OFF**
- **Jobs to review:** alerts + tracker fill; ATS/applicants when known; exclude applied/pipeline; dismiss; LinkedIn + Tracker links; check-for-jobs
- **Favorite authors:** miniature posts, avatars, LinkedIn-style times, original-only filter, soft-fetch + passive extract, dismiss, auto-refresh interval
- Options **Feed Widgets** panel + popup toggles; CareerCraft footers

### Timeline job discovery (Phase 6)
- Passive `/feed` scan (no network-wide crawl); flag `feedJobDiscover` default **OFF**
- Keyword-gated hiring / freelance / job-share detection; list-post splitting
- Real `/jobs/view/{id}` → tracker `source: feed`; organic → review-first candidates
- Jobs to review **From your feed**; Accept / Dismiss; Adv Filter Source = Feed
- Soft-fail; hard caps; people scrape still not implemented (5B skipped)

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

### Phase 5B — Company people enrichment (**skipped for now**)
- Remains deferred until an explicit decision; `companyPeople` stays OFF
- Prefer timeline discovery (Phase 6) over people scrape for agency/board-heavy pipelines

### Phase 6 — Timeline job discovery — **Done**
- See [`PHASE_6_CHECKLIST.md`](PHASE_6_CHECKLIST.md)
- Keep `feedJobDiscover` OFF until smoke + Store/compliance comfort

### Follow-ups / polish
- [ ] Merge `phase/job-tracker` + `phase/sidebar-widgets` → `main` after smoke matrix
- [ ] Optional: migrate Job Tracker to IndexedDB if storage volume becomes an issue
- [ ] Orphaned modules decision (`profile-analyzer`, `saved-content-*`) still open from Phase 1D
- [ ] Windows Chrome spot-check of smoke matrix
- [ ] Chrome Web Store packaging pass (`CHROME_STORE_SUBMISSION_PLAN.md`)
- [ ] Consider enabling Feed Widgets / timeline discovery flags by default only after Store / compliance review
- [ ] Phase 6B (optional): AI ranking of feed candidates; richer client-company extract from JD text

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
- Job Tracker: employer-kind badge + override; Agency/Board guidance (no Find contacts)
- Jobs to review: Agency / Board meta chip when classified
- `companyPeople` flag remains OFF; no People scrape
- Timeline discovery OFF by default; ON: keyword matches → Feed candidates / `source: feed` rows; list split; Accept/Dismiss

---

## Checklists

- [PHASE_2A_CHECKLIST.md](PHASE_2A_CHECKLIST.md)
- [PHASE_2B_CHECKLIST.md](PHASE_2B_CHECKLIST.md)
- [PHASE_3_CHECKLIST.md](PHASE_3_CHECKLIST.md)
- [PHASE_4_CHECKLIST.md](PHASE_4_CHECKLIST.md)
- [PHASE_5_CHECKLIST.md](PHASE_5_CHECKLIST.md)
- [PHASE_6_CHECKLIST.md](PHASE_6_CHECKLIST.md)
