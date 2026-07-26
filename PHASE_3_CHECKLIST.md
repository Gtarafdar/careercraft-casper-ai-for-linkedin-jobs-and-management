# Phase 3 Checklist — Job Tracker (+ enhancements)

**Version:** 2.4.0  
**Branch:** `phase/job-tracker`  
**Living roadmap:** [PROGRESS.md](PROGRESS.md)

## Storage note

Uses **`chrome.storage.local` key `casper_job_tracker`** so LinkedIn content scripts and Options share one store.  
(Original PRD proposed IndexedDB; deferred until volume requires it.)

## Automated / implemented

- [x] Store: stars, atsDetails, bulk delete, recency, export-by-ids
- [x] Soft hooks: applicants + full ATS on view/cache
- [x] Alert card ingest soft path in notification hidden tab
- [x] UI: bulk actions, recent/old, stars, detail panel, pagination, refresh settings
- [x] Background refresh alarms settings-gated (default OFF)
- [x] Statuses: new, viewed, applied, interview (“Got interview call”), confirmed, rejected, expired, archived
- [x] Status filter + human-readable labels
- [x] Date filters: Today / Yesterday / dated days + custom From–To
- [x] Company / location / applicants extraction + migrations
- [x] Dashboard Application pipeline: Applied, Interview, Confirmed, Rejected, Favorites (click → filter)
- [x] Actions column: flex on inner wrapper (table borders intact); buttons stay horizontal

## Manual smoke (after Reload)

1. Job Tracker seeds prior ATS jobs; **Details** shows ATS snapshot when available
2. Bulk select → delete / export / copy selected
3. Recent / Old / Date / Starred filters + pagination
4. Set status to Got interview call / Confirmed / Rejected; Status filter works
5. Star + rating persist after reload; Dashboard Favorites count updates
6. Dashboard cards open Job Tracker with matching filter
7. Open LinkedIn job → applicants / company / location fill when page has data
8. Alerts: soft-ingest may add Alert-badged cards; notifications still work if extract fails
9. Refresh settings default OFF — no surprise background tabs until enabled
10. ATS / Casper / formatter / paste / saved search / full-bleed layout unchanged

## Exit criteria

Viewing a job creates/updates a row; ATS updates score; CSV/copy works; pipeline statuses + dashboard cards work; no regression to core LinkedIn tools.

## Deferred to later phases

- IndexedDB migration (optional)
- Right-rail widgets → Phase 4
- Company people enrichment → Phase 5
