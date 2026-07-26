# CareerCraft Casper AI — Progress & Roadmap

**Last updated:** 2026-07-26  
**Product version:** 2.4.0  
**Active branch:** `phase/job-tracker`  
**Repo:** [careercraft-casper-ai-for-linkedin-jobs-and-management](https://github.com/Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management)

Source PRD: Cursor plan `casper_redesign_prd` (System PRD & Implementation Plan).

---

## Status at a glance

| Phase | Name | Status |
| ----- | ---- | ------ |
| 0 | GitHub backup | **Done** |
| 1 | Harden (DOM adapter, feature flags, manifest hygiene) | **Done** |
| 2A | UX shell (options tabs, popup, welcome) | **Done** |
| 2B | DeepSeek + Qwen + OpenRouter presets | **Done** (in this branch) |
| 3 | Job Tracker hub | **Done** (core + enhancements; see notes) |
| 4 | LinkedIn right-rail widgets | **Next** |
| 5 | Company people enrichment | **Later** |

---

## What we have now (shipped)

### Platform
- Private GitHub remote + phase branches
- LinkedIn DOM adapter + feature flags
- Design system + full-bleed Options shell (Dashboard, Job Tracker, Searches, AI Keys, Casper, Tools, Account)
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

### Phase 4 — Right-rail widgets (next major build)
1. **Favorite Authors** card above “Today’s puzzles” (up to 5 authors, post count setting, rate-limited fetch, cache)
2. **Recent Job Alerts** card (last ~5 from existing notification storage; CTA if alerts off)
3. Feature flags default **off** until stable
4. Soft-fail if aside missing — never break the feed

### Phase 5 — Company people enrichment (after Phase 4 stable)
- On-demand “Find contacts” on a tracker row (never bulk auto-scrape)
- Alumni / role heuristics; hard caps; store on job record
- Chrome Web Store / compliance review before enabling by default

### Follow-ups / polish (not blocked on Phase 4)
- [ ] Merge `phase/job-tracker` → `main` after smoke matrix
- [ ] Optional: migrate Job Tracker to IndexedDB if storage volume becomes an issue
- [ ] Orphaned modules decision (`profile-analyzer`, `saved-content-*`) still open from Phase 1D
- [ ] Windows Chrome spot-check of smoke matrix
- [ ] Chrome Web Store packaging pass (`CHROME_STORE_SUBMISSION_PLAN.md`)

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

---

## Checklists

- [PHASE_2A_CHECKLIST.md](PHASE_2A_CHECKLIST.md)
- [PHASE_2B_CHECKLIST.md](PHASE_2B_CHECKLIST.md)
- [PHASE_3_CHECKLIST.md](PHASE_3_CHECKLIST.md)
