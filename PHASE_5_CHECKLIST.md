# Phase 5 Checklist — Outreach fit (employer classification)

**Version:** 2.6.0  
**Branch:** `phase/sidebar-widgets`  
**Flag:** `companyPeople: false` (People scrape **not** implemented; Phase 5B only)  
**Status:** **Done** (2026-07-26)

## Scope (this phase)

- Classify tracker jobs: `employerKind` = `direct` | `agency` | `job_board` | `unknown`
- Confidence + reason; one-click manual override
- Job Tracker badges + agency/board-aware expand guidance
- Optional Jobs-to-review rail chips (`Agency` / `Board`)
- **No** LinkedIn People navigation, alumni scrape, or Find contacts button

## Explicitly deferred (Phase 5B)

- [ ] On-demand Find contacts only for `direct` (medium+ or override)
- [ ] People page soft-fail + hard caps
- [ ] Store compliance review before enabling `companyPeople`

## Automated

- [x] `node --check` on touched JS (`job-tracker-store.js`, `options-shell.js`, `aside-widgets.js`, `feature-flags.js`)
- [x] Version `2.6.0`
- [x] `companyPeople` default remains **false**
- [x] `alumni[]` / `contacts[]` still empty placeholders on normalize
- [x] No Find contacts / People scrape code paths added

## E2E matrix (after Reload extension)

### A — Classification

- [ ] Agency-named company → **Agency listing** badge
- [ ] BDJobs / Indeed / Jobbd-style company → **Job board** badge
- [ ] Normal product company → **Direct employer**
- [ ] Sparse company → **Unclear**
- [ ] Confirm there is **no** Find contacts button (intentionally deferred to Phase 5B)

### B — Override + company link

- [ ] Expand Details → Outreach fit + tip by kind
- [ ] Employer type override updates badge; Auto reclassifies
- [ ] Company name in **table row** and **Details** matches (never “Company Not Found” when row has a real name)
- [ ] Company name is a clickable LinkedIn link (company page or company search)

### C — Badge filters

- [ ] Source filter: ATS / Alert / Viewed narrows the list
- [ ] Employer filter: Agency / Job board / Direct / Unclear narrows the list
- [ ] Existing Status / Date / Favorites / search still work

### D — Jobs to review rail (flag ON)

- [ ] Agency / Board chip when classified
- [ ] Direct / Unclear: no chip

### E — Regression

- [ ] Tracker upsert / ATS / favorites still work
- [ ] Feed widgets remount stable
- [ ] Formatter / Casper / ATS box unchanged

## Exit criteria

- [x] Docs: PROGRESS Phase 5 = Outreach fit; people scrape → 5B
- [x] Employer-kind model on upsert + view + one-time migration
- [x] Tracker badges + override + outreach copy (no Find contacts)
- [x] Rail Agency/Board chips
- [x] `companyPeople` OFF; scrape unimplemented
- [ ] User smoke of A–E after reload
