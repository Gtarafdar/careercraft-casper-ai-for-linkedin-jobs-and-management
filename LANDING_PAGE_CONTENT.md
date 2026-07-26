# CareerCraft AI — Landing Page Content (v2.7.0)

Ready-to-implement copy for the public landing page. Structure mirrors a high-converting indie product site (see [Porter](https://gtarafdar.github.io/porter/)): clear hero → gap → proof → how-to → feature gallery → who it’s for → trust → maker story → FAQ → CTA.

**Product name:** CareerCraft AI  
**Tagline options below.**  
**Repo:** [careercraft-casper-ai-for-linkedin-jobs-and-management](https://github.com/Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management)  
**Type:** Chrome extension for LinkedIn · Local AI keys · No CareerCraft cloud  

---

## 1. SEO fundamentals (meta & technical)

### Primary keyword cluster
- LinkedIn job tracker Chrome extension  
- LinkedIn ATS score / resume job match  
- LinkedIn post formatter Unicode  
- LinkedIn job alerts saved search  
- Casper AI LinkedIn assistant  

### Suggested `<title>` (≤60 chars preferred)
`CareerCraft AI — LinkedIn Jobs, ATS Scoring & Post Tools`

### Meta description (≤155–160 chars)
`Track LinkedIn jobs, score fit with ATS AI, format posts, save searches, and catch hiring posts in your feed — all in Chrome. Your keys stay local.`

### H1 (one per page — use hero headline)
`CareerCraft AI`

### Open Graph / Twitter
- **og:title:** CareerCraft AI — LinkedIn career assistant in your browser  
- **og:description:** Job Tracker, ATS scores, Casper chat, feed discovery, alerts, and post formatting — without a CareerCraft cloud.  
- **og:type:** website  
- **twitter:card:** summary_large_image  

### Canonical URL
`https://[your-domain]/` (set when publishing)

### Suggested URL slugs for section anchors
`#overview` `#not-another-bot` `#screenshots` `#how-to` `#features` `#gallery` `#who` `#privacy` `#why` `#maker` `#workshop` `#faq` `#install`

### Schema.org (JSON-LD outline)
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "CareerCraft AI",
  "applicationCategory": "BrowserApplication",
  "operatingSystem": "Chrome",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "description": "Chrome extension for LinkedIn: Job Tracker, ATS scoring, Casper AI, feed job discovery, saved searches, and post formatting.",
  "author": {
    "@type": "Person",
    "name": "Gobinda Tarafdar",
    "url": "https://gtarafdar.github.io/porter/"
  }
}
```

Also add FAQPage schema from the FAQ section below.

---

## 2. Nav labels (sticky)

Overview · Not a scraper · Screenshots · How to use · Features · Who it’s for · Privacy · Maker · Why free · FAQ · Install

**CTAs (nav):** Install extension · GitHub  

---

## 3. Hero section

### Eyebrow / kicker
`For people who job-hunt on LinkedIn every week`

### Headline (H1 visual / brand-first)
**CareerCraft AI**

### Subheadline (clear product meaning — one sentence)
LinkedIn job hunting, posting, and outreach — with a tracker, ATS scores, alerts, and Casper AI in Chrome. Your API keys stay on your machine.

### Supporting line (optional, shorter)
Format posts. Score jobs against your profile. Track applications. Catch hiring posts in your feed. No CareerCraft cloud account.

### Primary CTA
`Add to Chrome`  
*(or “Install from Chrome Web Store” when listed · “Get the latest release” if GitHub-only)*

### Secondary CTA
`View source on GitHub`

### Trust chips under CTAs
`Chrome · LinkedIn · Local AI keys · MIT workshop product · v2.7`

### Hero visual brief (for design)
- Full-bleed LinkedIn-adjacent mock: Job Tracker table + Casper ghost + ATS % score card  
- Avoid purple-glow AI clichés; use LinkedIn-blue (`#0a66c2`) + navy sidebar language from the Options shell  
- Brand signal: **Casper ghost** next to CareerCraft AI (same mark as the extension sidebar)

### Hero alt text (SEO + a11y)
`CareerCraft AI Options dashboard showing Job Tracker pipeline, ATS status, and Casper branding`

---

## 4. The gap (problem section)

### Section label
`The gap`

### Heading
## LinkedIn is where the jobs are. Your process is still scattered.

### Body
Job tabs pile up. Saved searches get forgotten. You open a role, wonder if it fits, apply, then lose the thread. Feed hiring posts scroll by. Post formatting fights Unicode. AI chat lives in another tab.

CareerCraft keeps the hunt **on LinkedIn** — with a tracker, scores, alerts, and an assistant that already knows the page.

### Two-column contrast

#### Spreadsheet + tabs + hope
- Job URLs in notes apps  
- “Did I apply?” guesswork  
- No ATS signal until after you apply  
- Feed hiring posts disappear into the void  
- Generic ChatGPT with no LinkedIn context  

#### CareerCraft AI
- Job Tracker with status pipeline on every view  
- ATS score against your CV / LinkedIn profile  
- Saved searches + desktop alerts when counts rise  
- Feed discovery + Jobs to review rail  
- Casper chat on the page — and post analyze icons  

---

## 5. Honest positioning (“Not another…”)

### Section label
`Not another scraper`

### Heading
## What CareerCraft is — and is not

### Is
- A **Chrome extension** that enhances LinkedIn pages you already use  
- A **local** Job Tracker and ATS cache in your browser storage  
- **Your** Gemini / OpenAI / OpenRouter / DeepSeek / Qwen key  
- Opt-in widgets and feed discovery (off until you turn them on)  

### Is not
- A cloud ATS platform that stores your résumé on our servers  
- A bulk LinkedIn people scraper or auto-apply bot  
- Remote desktop or a second LinkedIn account manager  
- “Set and forget” spam messaging  

### One-liner for SEO / social
`CareerCraft AI is a local-first LinkedIn career assistant for Chrome — tracker, ATS, Casper, alerts, and post tools — not a cloud job board.`

---

## 6. Screenshots / product gallery (placeholder captions)

### Section label
`Product`

### Heading
## See CareerCraft in use

Sensitive details redacted in public shots.

| Slide | Caption (UI) | Suggested file name |
| ----- | ------------ | ------------------- |
| 1 | Options Dashboard — features & application pipeline | `shot-dashboard.png` |
| 2 | Job Tracker — search, source filters, statuses | `shot-job-tracker.png` |
| 3 | ATS analysis on a LinkedIn job page | `shot-ats-score.png` |
| 4 | Casper chat + ghost analyze on a post | `shot-casper.png` |
| 5 | Jobs to review + Favorite authors on feed rail | `shot-feed-rail.png` |
| 6 | Feed discovery keywords + Send to Job Tracker | `shot-feed-discover.png` |
| 7 | Searches & Alerts + notification settings | `shot-alerts.png` |
| 8 | Post formatting toolbar in compose | `shot-formatter.png` |
| 9 | AI API Keys — multi-provider | `shot-ai-keys.png` |
| 10 | Compact Chrome popup | `shot-popup.png` |

---

## 7. How to use (step stack)

### Section label
`Hands-on`

### Heading
## How to use CareerCraft

Scroll the stack from install to feed discovery. Nothing here is auto-apply or network-wide scrape.

### Step 1 — Install the extension
Add CareerCraft from the Chrome Web Store (or load the release build). Pin the icon. Open **Welcome** once if it appears after install.

### Step 2 — Add an AI key (for ATS & Casper)
Open Settings → **AI API Keys**. Pick Gemini, OpenAI, OpenRouter, DeepSeek, or Qwen. Save and test. Keys stay in Chrome local storage — not on a CareerCraft server.

### Step 3 — Load your profile for scoring
Account → upload a CV (PDF/DOC/DOCX/TXT, max 5MB), paste profile text, or **Auto extract** while on your LinkedIn profile. ATS uses this for match %.

### Step 4 — Hunt jobs with scores
Open any LinkedIn job. CareerCraft shows an **ATS analysis** box when enabled. Scores soft-add the role to **Job Tracker**.

### Step 5 — Track applications
Options → **Job Tracker**. Set status (Applied → Interview → Confirmed / Rejected). Star favorites. Filter by source: ATS, alerts, feed, or opened-only. Export CSV when you need a sheet.

### Step 6 — Save searches & turn on alerts
Searches & Alerts → save up to **5** LinkedIn search URLs. Enable notifications. CareerCraft checks on an interval and notifies when the **job count rises** (first enable sets a quiet baseline).

### Step 7 — Format posts & paste images
In LinkedIn compose, use the toolbar for Unicode bold/italic, lists, and typography styles. Paste a clipboard image into the post when LinkedIn’s uploader cooperates.

### Step 8 — Enable Casper (optional)
Casper → Enable. Chat on LinkedIn for replies, connection notes, and strategy. Toggle **post analyze** ghost icons on feed posts.

### Step 9 — Feed widgets & timeline discovery (optional)
Feed Widgets → turn on **Jobs to review** and/or **Favorite authors**. Timeline discovery → add keywords → browse `/feed`. Accept candidates or use **Send to Job Tracker** in the post ⋯ menu. Adv Filter → Source → **Feed**.

### Step 10 — Dashboard as command center
Dashboard shows what’s On/Off, pipeline counts, how-to tips, and quick jumps to every panel.

---

## 8. Feature gallery (capability cards — landing “Features” grid)

### Section label
`Capabilities`

### Heading
## Built for a real LinkedIn hunt

Tap a card for detail (link each card to `#feature-*` below).

1. **Job Tracker** — Status pipeline, favorites, filters, export. Every viewed/scored/alert/feed job in one place.  
2. **ATS scoring** — Compatibility % vs your CV/profile, strengths, gaps, requirements breakdown.  
3. **Casper AI** — In-page chat + ghost icons on posts. Opt-in.  
4. **Saved searches & alerts** — Up to 5 searches; desktop notices when results grow.  
5. **Feed Jobs to review** — Right-rail shortlist from alerts, tracker, and feed candidates.  
6. **Favorite authors** — Follow up to 5 LinkedIn voices in the rail.  
7. **Timeline job discovery** — Keyword-gated hiring posts while you scroll the feed.  
8. **Post formatting** — Unicode styles, lists, case tools in compose.  
9. **Image paste** — Clipboard image into LinkedIn posts.  
10. **Last 1 hour filter** — One-click Past hour on Jobs search.  
11. **Multi-provider AI** — Gemini, OpenAI, OpenRouter, DeepSeek, Qwen — your key.  
12. **Outreach fit labels** — Agency / job board / direct / unclear — no people scrape.  
13. **Saved posts filters** — Extra filters on LinkedIn My Items.  
14. **Dashboard command center** — Status tiles, pipeline, how-to, quick options.  

---

## 9. Feature details (exhaustive — do not omit)

Use these as accordion / long-form gallery copy. Each block: **name · what it does · where · notes**.

---

### `#feature-formatter` Post formatting toolbar
**What it does:** Injects a formatting bar above LinkedIn post and comment composers. Convert selection to Unicode bold, italic, underline, strikethrough; UPPER/lower/Title/Sentence case; typography presets (serif, sans, script, Fraktur, monospace, double-struck, circled, squared); bullet and numbered lists; clear formatting. Collapse/expand remembered.  
**Where:** LinkedIn compose (posts and/or comments). Configure locations & light/dark theme in the popup.  
**Notes:** Unicode styling (not LinkedIn rich HTML). Toolbar on by default; disable in popup if you want a clean editor.

### `#feature-image-paste` Clipboard image paste
**What it does:** Paste PNG/JPG from the clipboard into LinkedIn share compose by driving LinkedIn’s media UI.  
**Where:** Post compose with editor focused.  
**Notes:** Best under ~1MB; soft-fails if LinkedIn changes upload UI.

### `#feature-filter-pill` Last 1 hour job filter
**What it does:** Adds a CareerCraft “Last 1 hour” pill next to LinkedIn Date posted filters (`f_TPR=r3600`).  
**Where:** LinkedIn Jobs search results; also linked from the popup.  
**Notes:** Speeds “fresh roles only” hunting without digging through LinkedIn’s date menu.

### `#feature-ats` AI-powered ATS analysis
**What it does:** On job detail pages, shows compatibility score and breakdown (skills, experience, education, keywords, responsibilities), strengths, improvements, summary, and structured must-have / nice-to-have requirements. Soft-adds the job to Job Tracker (`source: ats`).  
**Where:** LinkedIn `/jobs/view/` and search detail pane. Toggle in popup / Tools.  
**Notes:** Needs an AI key for full AI scoring. Results can be cached (Tools → Cache) with refresh that uses API credits. Without AI, a basic overview still appears.

### `#feature-live-stats` Live applicants & views
**What it does:** Enriches the job stats UI with applicant/view signals when LinkedIn exposes them.  
**Where:** Job detail ATS/stats area.  

### `#feature-ai-keys` AI providers & API keys
**What it does:** Choose one active provider — Gemini, OpenAI, OpenRouter, DeepSeek, or Qwen. Save, mask, and test keys; pick models/presets; see simple usage stats.  
**Where:** Options → AI API Keys.  
**Notes:** Keys stored **locally** in Chrome. Host permissions only for those APIs. No CareerCraft proxy.

### `#feature-profile` Profile & CV for scoring
**What it does:** Upload CV (PDF/DOC/DOCX/TXT ≤5MB), paste profile fields, or auto-extract from LinkedIn. Clear stored profile when needed.  
**Where:** Options → Account.  
**Notes:** Powers ATS match quality. Cache invalidates when profile updates.

### `#feature-cache` ATS analysis cache
**What it does:** Caches scored jobs to save API cost. Configure max size, auto-cleanup days, view stats, clear all.  
**Where:** Options → Tools. Dashboard shows cached job count.

### `#feature-casper` Casper AI assistant
**What it does:** Opt-in floating chat on LinkedIn for post analysis, reply ideas, connection messages, and career tips. Conversation history with retention limits. Light/dark theme.  
**Where:** LinkedIn overlay; open from popup or post ghost icon. Enable under Options → Casper.  
**Notes:** Off until you enable. Requires AI key. History defaults: 50 chats, 30-day auto-delete (configurable).

### `#feature-casper-posts` Post analyze ghost icons
**What it does:** Adds a Casper ghost control on feed posts to open chat with that post’s context.  
**Where:** LinkedIn feed posts. Toggle in Options/Popup.  
**Notes:** May need a feed refresh after toggling.

### `#feature-tracker` Job Tracker
**What it does:** Local database of jobs from views, ATS, alerts, and feed. Status pipeline: New → Viewed → Applied → Got interview call → Confirmed → Rejected → Expired → Archived. Favorites/stars. Search. Filters: status, source (ATS / alerts / feed / opened-only), employer kind, recency, date range. Details panel with ATS, applicants, company, outreach tip. Bulk select, export/copy CSV/TSV, delete. Pagination (25/page). Optional applicant/expiry background refresh (off by default).  
**Where:** Options → Job Tracker; Dashboard pipeline cards deep-link filters.  
**Notes:** Data in `chrome.storage.local` on your machine.

### `#feature-outreach-fit` Outreach fit (employer kind)
**What it does:** Classifies listings as agency, job board, direct employer, or unclear. Badges + manual override + outreach guidance.  
**Where:** Job Tracker rows/details; chips on Jobs to review when known.  
**Notes:** **Does not** scrape company people or “Find contacts” (deferred). Classification only.

### `#feature-searches` Saved job searches
**What it does:** Save up to **5** LinkedIn job search URLs with name/keywords/location. Edit, delete, run. Slot counter on Dashboard.  
**Where:** Options → Searches & Alerts; popup “Save current search” on job-search tabs.

### `#feature-alerts` Job search notifications
**What it does:** Desktop notifications when a saved search’s **result count increases**. Interval 15–120 minutes (default 30). Test notification, check now, activity log, clear logs.  
**Where:** Options → Searches & Alerts.  
**Notes:** Off until enabled. First enable sets baseline (no spam). Soft-ingests new alert jobs into Tracker when ingest is on.

### `#feature-rail-jobs` Jobs to review (feed rail)
**What it does:** Right-rail card on LinkedIn home feed: shortlist from alerts + tracker (+ feed candidates). Shows ATS/applicants when known. Dismiss. Open on LinkedIn / Tracker. Check for new jobs. “From your feed” Accept/Dismiss.  
**Where:** LinkedIn `/feed` aside. Enable in Feed Widgets / popup.  
**Notes:** **Off by default.** Soft-fail if LinkedIn layout shifts. Does not scrape the network just to fill the list.

### `#feature-rail-authors` Favorite authors (feed rail)
**What it does:** Follow up to **5** LinkedIn profiles; show miniature posts with avatars and relative times; original-only filter option; dismiss; auto-refresh interval.  
**Where:** LinkedIn feed aside. Enable in Feed Widgets.  
**Notes:** **Off by default.** Soft background refresh, rate-limited.

### `#feature-feed-discover` Timeline / feed job discovery
**What it does:** While you scroll `/feed`, detects hiring / freelance / job-share language and job links. Keyword match (any/all). Splits multi-job list posts. Soft-adds LinkedIn job links to Tracker (`source: feed`) or queues organic posts for review. Caps per session/hour.  
**Where:** LinkedIn feed; results in Tracker + Jobs to review. Settings under Feed Widgets.  
**Notes:** **Off by default.** No whole-network crawl. No people scrape.

### `#feature-send-tracker` Send to Job Tracker (⋯ menu)
**What it does:** Adds a **Send to Job Tracker** item in the LinkedIn post overflow menu to capture a real post permalink and upsert the row.  
**Where:** Feed post ⋯ menu when discovery is enabled.  
**Notes:** Prefer real `/feed/update/…` URLs — not invented job IDs.

### `#feature-saved-posts` Saved posts enhancer
**What it does:** Extra filters on LinkedIn My Items saved posts: All / Posts / Images / Videos / Articles with counts.  
**Where:** `linkedin.com/my-items/saved-posts/`.

### `#feature-dashboard` Options Dashboard
**What it does:** Command center: feature status tiles (search slots, active AI, ATS, Casper, alerts, feed discover, feed widgets, tracked jobs, ATS cache), application pipeline cards, how-to, quick options.  
**Where:** Options → Dashboard.  
**Notes:** Feature **name** is the heading; status is the badge. Tiles navigate to settings.

### `#feature-popup` Chrome popup
**What it does:** Compact control surface: LinkedIn/AI status, toolbar settings, ATS toggle, Casper, feed toggles + keywords, saved searches, last-hour link, alerts entry, welcome guide.  
**Where:** Extension toolbar icon.

### `#feature-welcome` Welcome / onboarding
**What it does:** First-run steps: AI key → LinkedIn tools → searches & alerts → Casper. Links to Settings and LinkedIn.  
**Where:** `welcome.html` after install; linked from popup.

### `#feature-flags-note` Defaults that protect you
Several power features ship **off** until you opt in: Jobs to review rail, Favorite authors, Feed job discover, Casper enable, job notifications, tracker applicant/expiry refresh. Core formatter, ATS path, and Job Tracker storage default on.

### Explicitly not included (say it on the page)
- Company people / contact scrape (“Find contacts”) — not shipped  
- Auto-apply / InMail spam bots — not CareerCraft  
- Cloud sync of your tracker to CareerCraft servers — none  

---

## 10. Who it’s for

### Section label
`Ideal fit`

### Heading
## Who CareerCraft is for

If LinkedIn is your main job channel and you want structure without another SaaS login, this is for you.

### Cards

#### Active job seekers
You open roles daily, apply often, and need status, favorites, and ATS signal before you burn a cover letter.

#### Recruiters & sourcers who still post personally
You write LinkedIn posts, need Unicode formatting, and want Casper for reply drafts — without leaving the feed.

#### Side-hustle & freelance hunters
You watch the feed for “we’re hiring” and freelance posts. Timeline discovery + Jobs to review catch what search alerts miss.

#### Privacy-minded operators
You bring your own API key. Tracker and cache stay in the browser. Feed widgets stay off until you say so.

### Honest mismatch
Skip CareerCraft if you need bulk auto-apply, people scraping, a hosted ATS CRM for a team, or LinkedIn automation that violates LinkedIn’s rules. Those are different products — and different risks.

---

## 11. Privacy & trust

### Section label
`Trust`

### Heading
## Local-first on purpose

- **Your AI keys** — stored in Chrome; sent only to the provider you chose  
- **Job Tracker & cache** — `chrome.storage.local` on your machine  
- **No CareerCraft cloud account** — no CareerCraft login for core features  
- **Opt-in rails** — feed widgets and discovery default **off**  
- **No people scrape** in current release  

Link out: Privacy policy · Security notes · GitHub source  

---

## 12. Why I built this

### Section label
`Case study`

### Heading
## Why I built CareerCraft AI

### The bind
I live on LinkedIn for work and for the hunt — marketing roles, product roles, side experiments. Tabs multiplied. Spreadsheets lagged. “Is this job even a fit?” arrived too late. Hiring posts in the feed vanished after one scroll. Formatting a post meant Unicode gymnastics. AI lived in another window with none of the page context.

### What I needed instead
One assistant that stays **on LinkedIn**: score the role against my profile, remember what I opened, ping me when a saved search grows, format the post I’m writing, and optionally watch the feed for hiring language — without uploading my career to another cloud ATS.

### What I shipped
CareerCraft AI (with **Casper**) is that toolkit: Job Tracker, ATS analysis, multi-provider AI keys, saved searches and alerts, feed widgets, timeline discovery, post formatting, and a dashboard that shows what’s actually on. I built it in the workshop for my own loop first — then hardened flags so power features stay off until you opt in.

### Why free / open workshop
I’m not selling a CareerCraft job cloud. The hard part was stitching real LinkedIn workflows with local data and your own model key. Locking that behind a subscription felt wrong for a tool I needed every week. Use it, star the repo, tip the workshop if it saves you a messy hunt.

*(Tone aligned with the Porter “Why I built” section on [gtarafdar.github.io/porter](https://gtarafdar.github.io/porter/).)*

---

## 13. About the maker

### Section label
`Maker`

### Heading
## About the maker

### Name
**Gobinda Tarafdar**

### One-liner
WordPress product marketer · stubborn problem-solver · lifelong Harry Potter devotee

### Bio (from Porter, adapted)
By day I am the Product Marketing Specialist at [WPBakery](https://wpbakery.com/). Before that, I helped a single plugin cross **400,000+ active users**.

When the day-job owl flies home, I tinker on my own workshop of spells — including [Porter](https://gtarafdar.github.io/porter/), CareerCraft AI, and the tools below.

### Links
- X / Twitter  
- LinkedIn  
- GitHub — [Gtarafdar](https://github.com/Gtarafdar)  
- Donate (same workshop tip jar as Porter)  
- Portrait: reuse Porter maker photo  

---

## 14. Also from the workshop (recent works)

### Section label
`Workshop`

### Heading
## Also from the workshop

Pull from the Porter “Also from the workshop” grid ([porter landing](https://gtarafdar.github.io/porter/)):

| Product | One-line |
| ------- | -------- |
| **[Porter](https://gtarafdar.github.io/porter/)** | Copy folders between your Macs like Finder — LAN, Tailscale, MCP for AI IDEs |
| **Aligner** | Free local Chrome toolkit for design, measure, and WordPress |
| **FinderFlow** | Mac file manager with built-in editor |
| **Slack Agent Bridge** | MCP bridge for Cursor and Claude |
| **Auto AFK Slack** | Lock your Mac, Slack goes AFK |
| **Slack Teammate Time** | Teammate local times inline in Slack |
| **Broken Link Checker** | Find broken links without leaving the page |
| **Docscriber** | Documentation, conjured |
| **TheRecaller** | A memory charm for what you forget online |
| **TheEditra** | AI video editor |
| **The Quill Press** | Tech news, Daily Prophet style |
| **Costlas** | Cost of living for 140+ countries |
| **WPBakery** | Page builder I do product marketing for |

**Featured companion:** Porter — *Your files are on the other Mac. Your AI is on this one.* CareerCraft is the LinkedIn-side workshop sibling.

---

## 15. FAQ (SEO FAQPage)

### Is CareerCraft free?
Yes for the extension itself in the workshop model. You may pay your own AI provider for ATS and Casper tokens.

### Does CareerCraft store my résumé on a server?
No CareerCraft cloud for core tracking. Profile/CV and Job Tracker data live in Chrome local storage on your device. AI requests go to the provider you configure.

### Is this a LinkedIn auto-apply bot?
No. CareerCraft does not auto-apply or mass-message. It helps you score, track, format, alert, and optionally review feed hiring posts.

### Do I need an API key?
For full ATS AI scoring and Casper, yes. Post formatting, Job Tracker viewing, saved searches UI, and many helpers work without a key. Basic job overview can still show without AI.

### Will feed widgets mess up my LinkedIn?
They mount in the right rail and soft-fail if the layout changes. Both Jobs to review and Favorite authors are **off by default**.

### What is Casper?
Casper is CareerCraft’s friendly ghost assistant — in-page chat and optional analyze icons on posts. Enable it under Options → Casper.

### Does timeline discovery scrape my whole network?
No. It only observes posts on the feed you’re already scrolling, with keyword gates and rate caps. No people scrape in this release.

### Chrome only?
Yes — Manifest V3 Chrome extension targeting `linkedin.com`.

### Where is the source?
GitHub: [careercraft-casper-ai-for-linkedin-jobs-and-management](https://github.com/Gtarafdar/careercraft-casper-ai-for-linkedin-jobs-and-management)

---

## 16. Final CTA

### Heading
## If CareerCraft saves you a messy hunt

Install the extension. Bring your own AI key. Turn on only the rails you want.

**Primary:** Add to Chrome  
**Secondary:** ★ Star on GitHub · Donate · Follow on X  

Footer line:  
`CareerCraft AI · Casper · Local-first LinkedIn toolkit · © 2026 Gobinda Tarafdar`

Footer links: Privacy · GitHub · Porter · Workshop  

---

## 17. Suggested page outline (implement order)

1. Nav + Hero  
2. The gap  
3. Not another scraper  
4. Screenshot gallery  
5. How to use (10 steps)  
6. Capabilities grid (14 cards)  
7. Feature details / accordion (full inventory)  
8. Who it’s for + honest mismatch  
9. Privacy & trust  
10. Why I built this  
11. About the maker  
12. Workshop / recent works  
13. FAQ  
14. Final CTA + footer  

---

## 18. Microcopy bank (buttons & empty states)

- `Add to Chrome`  
- `Open Settings`  
- `Enable Casper`  
- `Turn on Jobs to review`  
- `Add feed keywords`  
- `Send to Job Tracker`  
- `View on LinkedIn`  
- `Export CSV`  
- `Test notification`  
- `Your keys stay local`  

---

*Document version: 2026-07-26 · Product v2.7.0 · Feature inventory complete for landing publish. Extension code untouched by this file.*
