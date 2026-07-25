# Windows Chrome Compatibility Notes

Audit date: 2026-07-25 (Phase 1 harden)

## Runtime findings (code review)

| Area | Status | Notes |
|------|--------|--------|
| Platform branching | None | No `navigator.platform` / `win32` checks in extension JS |
| Clipboard / paste | Shared path | Uses ClipboardEvent + File input injection; should work on Windows Chrome; Mac-only copy is UI text only (Ctrl vs Cmd) |
| PDF worker | Relative URL | `lib/pdf.worker.min.js` loaded from extension — OK on Windows |
| Alarms / notifications | MV3 APIs | Platform-agnostic; requires Notifications permission granted |
| OpenRouter host | **Fixed in Phase 1** | `https://openrouter.ai/*` was missing from `host_permissions` after earlier cleanup — would break OpenRouter on all OSes including Windows |

## Likely historical Windows complaints

1. **Missing host permission** for OpenRouter (now restored).
2. **Clipboard permission** — Windows Chrome may prompt; user must allow.
3. **LinkedIn DOM changes** — same fragility on all platforms; mitigated by `content/linkedin-dom.js` multi-selectors + feature flags.

## How to re-test on Windows

1. Reload extension after install.
2. Paste image into LinkedIn compose (Ctrl+V).
3. Run ATS on a job detail page.
4. If using OpenRouter: save key → Test connection on Options.
5. Job notification test from Options.

## Manifest hygiene (orphaned files)

Present on disk but **not** in `content_scripts` (intentionally left unwired until verified):

- `content/profile-analyzer.js`
- `content/notification-manager.js` (logic lives in `background.js`)
- `content/saved-content-extractor.js` / `content/saved-content-storage.js`
- `popup/saved-items.html` (not `action.default_popup`)

Do not wire these mid-redesign without a dedicated smoke pass.
