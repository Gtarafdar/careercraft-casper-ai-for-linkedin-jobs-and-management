# Phase 4 Checklist — Feed Widgets (right-rail)

**Version:** 2.5.0  
**Branch:** `phase/sidebar-widgets`  
**Flags default:** `jobBoardWidget: false`, `authorWidget: false`  
**Status:** **Done** (2026-07-26)

## Automated

- [x] `node --check` on touched JS files
- [x] Manifest valid; includes `content/aside-widgets.js` + `styles/aside-widgets.css`
- [x] Version `2.5.0`
- [x] Critical Options/Popup IDs still present (`toolbarEnabled`, notification controls, AI key fields)
- [x] No `127.0.0.1` debug ingest leftovers
- [x] Feature flags still default widgets **OFF**

## Debug (optional while verifying)

1. Options → Feed Widgets → enable “Log aside widget events”
2. Reload LinkedIn feed; DevTools console should show `[CC Aside]` events when flags ON
3. Assert: at most one `#cc-aside-widgets`; turn debug **OFF** when done

## E2E matrix (after Reload extension)

### A — Flags OFF (default)

- [x] Feed: no `#cc-aside-widgets` in DOM (flags default off)
- [x] Soft-fail mount; LinkedIn aside intact when widgets off
- [x] Existing features untouched by Phase 4 soft init hook
- [x] Debug ingest removed after verification

### B — Jobs to review card ON only

- [x] Card mounts in LinkedIn aside (`aside[aria-label="Aside"]`), above puzzles when possible
- [x] Footer: `From CareerCraft · Job alerts & Job Tracker`
- [x] Limit / TTL / fill-from-tracker; sections labeled; applied/pipeline statuses excluded
- [x] ATS / applicants when present in tracker; LinkedIn + Tracker per-job links
- [x] Dismiss with confirm; sticky shortlist (no remount thrash)
- [x] Empty / caught-up CTAs: Search, Job Tracker, Check for new jobs

### C — Authors card ON only

- [x] Empty / caught-up CTAs; footer note present
- [x] Options: Add / Edit / Remove (max 5); posts per author; auto-refresh; original-only filter
- [x] Popup toggle syncs; miniature posts with avatar + LinkedIn-style time
- [x] Soft-fetch + passive extract; dismiss with confirm
- [x] Remount thrash fixed when authors caught up

### D — Both ON

- [x] Both cards stack in aside without replacing LinkedIn puzzles host
- [x] Storage / toggle remount without duplicate `#cc-aside-widgets`
- [x] Soft-fail: mount errors do not break LinkedIn or other extension features

## Exit criteria

- [x] Automated green
- [x] E2E A–D verified in session (widgets, dismiss, times, remount stability)
- [x] Debug ingest logging off / removed
- [x] User confirmed: widgets usable; remount flicker fixed; no LinkedIn UI break from soft host insert
