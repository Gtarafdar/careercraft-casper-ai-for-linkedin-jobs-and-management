# Phase 2B Checklist — DeepSeek, Qwen, OpenRouter presets

**Version:** 2.2.0  
**Branch:** `phase/ai-providers`

## Automated (run by agent)

- [x] `node --check` on touched JS files
- [x] Manifest JSON valid; hosts include DeepSeek + DashScope intl
- [x] Critical IDs present: gemini / openai / openrouter / deepseek / qwen
- [x] Gemini + OpenRouter fetch URLs unchanged
- [x] No debug ingest host (`127.0.0.1:7478`)

## Manual smoke (after Reload extension)

### Key UX regression

1. Options → **AI API Keys**
2. Gemini (or current provider): key still masked; Save / Clear still work
3. Switch active provider radio — other keys stay Configured
4. Success toast is **green**; errors are red
5. Extension reload → keys still configured

### New providers

6. DeepSeek block visible: model select, Save / Clear / Test
7. Qwen block visible: intl DashScope note, Save / Clear / Test
8. If you have keys: Test connection succeeds for DeepSeek and/or Qwen
9. OpenRouter model dropdown includes DeepSeek Chat, DeepSeek R1, Qwen 2.5 72B

### Product smoke (must not break)

10. LinkedIn: formatter on share/comment
11. Image paste into compose
12. ATS box on a job detail page (with active provider)
13. Casper chat open + one message
14. Last 1 hour filter pill
15. Save / run / edit saved search
16. Job notification settings save
17. Job Tracker still lists ATS-cached jobs
18. Options layout still full-bleed (no gray frame beside sidebar)

## Exit criteria

DeepSeek + Qwen usable via direct APIs; OpenRouter presets expanded; Gemini / OpenAI / OpenRouter behavior unchanged; smoke matrix green.
