# Phase 2A checklist (UX shell)

Run after reloading the extension:

## Options
- [ ] Options opens with left nav (Dashboard, Job Tracker, Searches, AI Keys, Casper, Tools, Account)
- [ ] Dashboard metrics load (slots, AI, ATS, Casper, alerts, cache)
- [ ] AI API Keys: save/mask/clear/test still work for Gemini/OpenAI/OpenRouter
- [ ] Searches: list/edit/run/delete + add form still work
- [ ] Notifications: save settings + test notification
- [ ] Casper: toggles save
- [ ] Tools: cache stats + clear
- [ ] Account: profile fields load
- [ ] Success toast is green (not red)

## Popup
- [ ] Compact layout; AI status line shows
- [ ] Toolbar / ATS toggles persist
- [ ] Saved searches Run/Delete/Save still work
- [ ] Casper section still toggles

## Welcome
- [ ] Opening `welcome.html` works; Settings / LinkedIn links work
- [ ] Fresh install opens welcome once (onboarding_completed set)

## Regression (LinkedIn)
- [ ] Formatter toolbar appears
- [ ] Image paste works
- [ ] ATS box on job detail
- [ ] Last 1 hour pill
- [ ] Casper chat (if enabled)
