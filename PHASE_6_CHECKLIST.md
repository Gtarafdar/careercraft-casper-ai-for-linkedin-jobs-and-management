# Phase 6 Checklist — Timeline job discovery

**Version:** 2.7.0  
**Branch:** `phase/sidebar-widgets`  
**Flag:** `feedJobDiscover: false` (default OFF)  
**Status:** **Done** (2026-07-26)

## Scope

- Passive LinkedIn feed scan for hiring / freelance / job-share posts
- Keyword settings gate matches
- Real `/jobs/view/{id}` → soft-upsert `source: feed`
- Organic posts → review-first candidate queue; Accept → tracker
- Multi-job list posts → split into separate candidates
- Jobs to review: **From your feed** section
- **No** people scrape (5B remains deferred)

## Automated

- [x] `node --check` on new/touched JS
- [x] Manifest includes `content/feed-job-discover.js`
- [x] Version `2.7.0`
- [x] `feedJobDiscover` default **false**
- [x] `companyPeople` still **false** / unimplemented

## E2E (after Reload extension)

### A — Flag OFF (default)

- [ ] Feed: no timeline job scan; no feed candidates written
- [ ] Existing Jobs to review / authors / tracker unchanged

### B — Flag ON + keywords

- [ ] Options → Feed Widgets: Timeline job discovery settings save
- [ ] Popup toggle syncs flag
- [ ] Scroll feed with matching hiring post + `/jobs/view/` link → tracker row `source: feed`
- [ ] Organic hiring post (no job id) → appears under **From your feed**; Accept → tracker; Dismiss removes
- [ ] Multi-role list post → multiple candidates
- [ ] Caps: session / hour limits respected

### C — Soft-fail

- [ ] Detector errors do not break formatter / ATS / Casper / Phase 4–5
- [ ] Empty keywords: no noisy ingest (or clear empty-state guidance)

## Exit criteria

- [x] Docs: Phase 6 Timeline job discovery; 5B skipped for now
- [x] Schema + flag + settings + candidate store
- [x] Detector + ingest + UI
- [ ] User smoke A–C after reload
