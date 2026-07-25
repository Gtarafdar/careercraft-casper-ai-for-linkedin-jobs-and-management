# Chrome Web Store Permission Justifications

**Copy-paste ready responses for reviewer questions**

---

## Permission: `activeTab`

**Why do you need this permission?**

```
The extension injects a text formatting toolbar, ATS analysis panel, and Casper AI assistant directly into LinkedIn pages that users are actively viewing. This requires access to the active tab's DOM to insert UI elements and read job/profile data for analysis. The activeTab permission ensures we only access pages the user explicitly interacts with, enhancing privacy.
```

---

## Permission: `clipboardRead`

**Why do you need this permission?**

```
Users can paste images from their clipboard directly into LinkedIn posts without saving files first. This streamlines the image sharing workflow. The extension reads clipboard data only when users explicitly use the paste function (Ctrl+V) in LinkedIn's post editor. No clipboard data is accessed, stored, or transmitted otherwise.
```

---

## Permission: `storage`

**Why do you need this permission?**

```
The extension stores user preferences, settings, and functional data locally using Chrome's storage API:

1. AI provider preferences (Gemini, OpenAI, or OpenRouter)
2. User-provided API keys (encrypted before storage)
3. Selected AI models for analysis
4. Cached job descriptions and profile data (reduces API costs)
5. ATS analysis results (cached for 24 hours)
6. Saved job searches and notification settings
7. Casper AI chat history (stored locally, never transmitted)
8. UI preferences (toolbar state, theme, notification intervals)

All data is stored locally on the user's device. We do not operate external databases or servers that store user data.
```

---

## Permission: `tabs`

**Why do you need this permission?**

```
Required to manage LinkedIn tab interactions for job notifications and saved searches:

1. Open LinkedIn job search URLs when users click notification alerts
2. Check if active tab is a LinkedIn page to enable extension features
3. Query tabs to determine if LinkedIn is open for profile extraction
4. Create background tabs for periodic job search checks (without disturbing user)

We do not track browsing history, read non-LinkedIn tabs, or access tab content beyond LinkedIn.com domain.
```

---

## Permission: `scripting`

**Why do you need this permission?**

```
Manifest V3 requires the scripting permission to dynamically inject content scripts into web pages. We use this to:

1. Inject the text formatting toolbar into LinkedIn post editors
2. Add ATS analysis buttons to job posting pages
3. Insert Casper AI ghost icons on LinkedIn posts
4. Inject "Last 1 Hour" filter button on job search pages

Content scripts are only injected into linkedin.com pages and only contain code bundled with the extension (no remote code execution). This is the standard Manifest V3 approach for content script injection.
```

---

## Permission: `notifications`

**Why do you need this permission?**

```
Users can save up to 2 LinkedIn job searches and receive desktop notifications when new matching jobs are posted.

How it works:
1. User saves a LinkedIn job search URL via the extension popup
2. User enables notifications and sets check interval (15 minutes to 24 hours)
3. Extension periodically checks saved searches for new jobs
4. If new jobs are found, a desktop notification is displayed (e.g., "5 New Jobs Found - Software Engineer")
5. Clicking the notification opens the job search in LinkedIn

Notification frequency is fully user-controlled. Users can disable notifications at any time via settings. This feature helps job seekers stay competitive by alerting them to fresh opportunities.
```

---

## Permission: `alarms`

**Why do you need this permission?**

```
Required to schedule periodic checks for new job postings based on user-saved searches.

The alarms API allows the extension to run background checks at user-defined intervals (15 minutes to 24 hours) without requiring the browser to remain active. This is more battery-efficient than using setInterval.

When an alarm fires:
1. Extension opens saved job search URLs in background tabs
2. Extracts current total job count from LinkedIn
3. Compares with previous baseline count
4. Sends notification if new jobs are detected
5. Updates baseline for next check

Users control check frequency via settings. Alarms are only active when notifications are enabled. This is the standard Manifest V3 approach for periodic background tasks.
```

---

## Host Permission: `https://www.linkedin.com/*`

**Why do you need access to this domain?**

```
LinkedIn.com is the primary domain where the extension provides all its functionality:

1. Text formatting toolbar in post editors
2. Job description extraction for ATS analysis
3. Profile data extraction for compatibility scoring
4. Casper AI assistant on posts and articles
5. "Last 1 Hour" job filter on search pages
6. Image clipboard paste in post editors
7. Saved job search monitoring

The extension reads visible page content (DOM scraping) to extract job and profile data. No LinkedIn credentials, messages, or connections are accessed. We do not use LinkedIn's official API.
```

---

## Host Permission: `https://generativelanguage.googleapis.com/*`

**Why do you need access to this domain?**

```
Google Gemini API endpoint. Users who choose Gemini as their AI provider use this domain for:

1. ATS job analysis and compatibility scoring
2. Casper AI assistant conversations
3. CV/resume text extraction from PDF uploads

Important: Users provide their own Gemini API keys (free tier available). The extension makes direct API calls from the user's browser to Google's servers. We do not intercept, log, or store these API calls or responses. The extension is only a client that facilitates communication using user-provided credentials.

Refer to Google's Privacy Policy: https://policies.google.com/privacy
```

---

## Host Permission: `https://api.openai.com/*`

**Why do you need access to this domain?**

```
OpenAI API endpoint. Users who choose OpenAI as their AI provider use this domain for:

1. ATS job analysis using GPT models (GPT-3.5, GPT-4, GPT-4o)
2. Casper AI assistant conversations
3. Advanced job compatibility insights

Important: Users provide their own OpenAI API keys. The extension makes direct API calls from the user's browser to OpenAI's servers. We do not intercept, log, or store these API calls or responses. The extension is only a client that facilitates communication using user-provided credentials.

Refer to OpenAI's Privacy Policy: https://openai.com/privacy/
```

---

## Host Permission: `https://openrouter.ai/*` (if you add it)

**Why do you need access to this domain?**

```
OpenRouter API endpoint. Users who choose OpenRouter as their AI provider use this domain for:

1. Access to multiple AI models (Llama, Claude, Gemini via unified API)
2. ATS job analysis using various models
3. Casper AI assistant with model flexibility
4. Cost-effective AI options (free Llama models available)

Important: Users provide their own OpenRouter API keys. The extension makes direct API calls from the user's browser to OpenRouter's servers. We do not intercept, log, or store these API calls or responses.

OpenRouter acts as a proxy to multiple AI providers, allowing users to access different models with a single API key.
```

---

## Data Collection Disclosure

**What data does your extension collect?**

```
The extension does NOT collect, transmit, or store any user data on external servers owned by us.

Local Storage Only (chrome.storage.local):
✓ AI provider preferences
✓ User-provided API keys (encrypted)
✓ Cached job/profile data (for performance)
✓ Casper AI chat history
✓ UI preferences and settings

External Services (with user control):
✓ AI providers (Gemini/OpenAI) - User's own API keys
✓ LinkedIn.com - DOM scraping for data extraction

We Do NOT Collect:
✗ Analytics or usage statistics
✗ Tracking or telemetry
✗ Personally identifiable information (PII)
✗ LinkedIn credentials
✗ Browsing history
```

---

## Remote Code Disclosure

**Does your extension execute remote code?**

```
NO. The extension does not execute any remote code.

✓ All JavaScript code is bundled with the extension
✓ No eval() or Function() constructors used
✓ No dynamic script loading from external sources
✓ Content Security Policy (CSP) compliant

External API calls return data only (JSON), not executable code:
- AI providers return text responses (analysis results, chat messages)
- License validation service returns JSON status (active/inactive)
- No external scripts are loaded or executed

This complies with Chrome Web Store policies prohibiting remote code execution.
```

---

## Single Purpose Statement

**What is the single purpose of your extension?**

```
CareerCraft AI enhances the LinkedIn user experience by providing text formatting tools, AI-powered job analysis with ATS compatibility scoring, and an intelligent assistant to help users optimize their career journey and job application success.

All features are directly related to improving LinkedIn productivity and career management.
```

---

## User Data Handling

**How do you handle user data?**

```
Privacy-First Approach:

1. Local Storage: All user data stored locally using Chrome's storage API
2. User-Controlled: Users provide their own AI API keys; we never see them
3. No Tracking: Zero analytics, telemetry, or usage tracking
4. Encrypted Keys: API keys encrypted before local storage
5. Temporary Caching: Job/profile data cached locally for 24 hours (configurable)
6. User Deletion: Users can clear all data via settings or by uninstalling

External Data Flow:
- Job/profile data sent to user's chosen AI provider (Gemini/OpenAI)
- No data sent to servers owned by us

Compliance:
✓ GDPR compliant
✓ CCPA compliant
✓ Chrome Web Store policies compliant
✓ Privacy policy hosted at: https://nyxto.com/privacy/careercraft-ai
```

---

## Pricing / Monetization

**How is the extension monetized?**

```
Free. All features are available at no cost.

Users provide their own AI API keys (Gemini, OpenAI, or OpenRouter) for AI features.
No license keys, subscriptions, or in-app purchases.
```

---

## Testimonial/Review Request Compliance

**Does your extension solicit reviews?**

```
NO. The extension does not:
✗ Prompt users to leave reviews
✗ Offer incentives for positive reviews
✗ Direct users to specific review platforms
✗ Manipulate ratings in any way

We comply with Chrome Web Store policies prohibiting review solicitation and manipulation.
```

---

## Cryptocurrency/Blockchain

**Does your extension involve cryptocurrency?**

```
NO. The extension does not:
✗ Mine cryptocurrency
✗ Facilitate cryptocurrency transactions
✗ Interact with blockchain networks
✗ Promote cryptocurrency services

The extension is solely focused on LinkedIn productivity and career tools.
```

---

**End of Justifications**

_These responses are ready to copy-paste if Chrome Web Store reviewers request additional information during the review process._
