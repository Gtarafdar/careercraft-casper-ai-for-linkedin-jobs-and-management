# Privacy Policy for CareerCraft AI

**Last Updated:** January 7, 2026  
**Effective Date:** January 7, 2026

## Introduction

CareerCraft AI ("we", "our", or "the Extension") is a Chrome browser extension that enhances your LinkedIn experience with text formatting, AI-powered job analysis, and career management tools. This Privacy Policy explains how we handle your data.

## Data Collection and Storage

### What We Store (Locally Only)

CareerCraft AI stores all data **locally on your device** using Chrome's storage API (`chrome.storage.local`). We do **NOT** collect, transmit, or store any data on external servers owned by us.

**Local Storage Includes:**

- **AI Provider Preferences**: Your choice of AI provider (Google Gemini, OpenAI, or OpenRouter)
- **API Keys**: Your personal API keys for AI services (encrypted and stored locally)
- **AI Model Selection**: Your preferred AI models for analysis
- **Cached Data**:
  - LinkedIn profile data extracted for ATS analysis
  - Job descriptions (cached for up to 24 hours to reduce API calls)
  - ATS compatibility analysis results
  - Saved job searches and notification settings
  - **Job Tracker** rows (viewed jobs, ATS scores, application status, favorites) — local only; CSV/spreadsheet export is user-initiated; optional background applicant/expiry refresh is off by default and user-controlled
- **Chat History**: Casper AI conversation history (stored locally, never transmitted to us)
- **UI Preferences**: Toolbar state, notification settings, theme preferences

### What We Do NOT Collect

- ❌ Your LinkedIn credentials or passwords
- ❌ Your browsing history
- ❌ Personally identifiable information (PII)
- ❌ Analytics or usage statistics
- ❌ Tracking data or cookies
- ❌ Your LinkedIn connections or messages

## External Service Communications

CareerCraft AI communicates with the following external services:

### 1. AI Providers (Your Choice)

**Google Gemini API** or **OpenAI API** or **OpenRouter API**

- **Purpose**: Generate ATS job analysis, Casper AI responses, and extract text from uploaded CVs
- **Data Sent**: Job descriptions, your LinkedIn profile data, and user prompts (temporarily for processing)
- **Your Control**: You provide your own API keys; we never see or store them on our servers
- **Data Retention**: Data is processed in real-time and not stored by the extension on external servers
- **Privacy Policies**:
  - Google Gemini: [https://policies.google.com/privacy](https://policies.google.com/privacy)
  - OpenAI: [https://openai.com/privacy/](https://openai.com/privacy/)
  - OpenRouter: [https://openrouter.ai/privacy](https://openrouter.ai/privacy)

**Important**: API requests are made directly from your browser to these services. We do not intercept, log, or store this communication.

### 2. LinkedIn.com

**DOM Scraping Only**

- **Purpose**: Extract job descriptions and profile data for ATS analysis
- **Method**: Content script reads visible page content via JavaScript DOM manipulation
- **No API Calls**: We do not use LinkedIn's official API
- **No Data Transmission**: Extracted data is processed locally or sent directly to your chosen AI provider

## Data Security

### How We Protect Your Data

- **Encrypted Storage**: API keys are encrypted before storage in Chrome's local storage
- **HTTPS Only**: All external communications use secure HTTPS connections
- **No Server Storage**: We do not operate servers that store user data
- **Local Processing**: Profile and job data are cached locally for your convenience
- **Minimal Permissions**: We request only the permissions necessary for functionality

## Your Data Rights

### Access and Control

You have complete control over your data:

- **View Data**: All stored data is accessible via Chrome Developer Tools > Application > Storage
- **Delete Data**:
  - Clear cached data via extension settings
  - Remove API keys via settings page
  - Uninstall extension to delete all local data permanently
- **Export Data**: All data stored locally can be accessed via Chrome's storage API

### Data Retention

- **API Keys**: Stored until you clear them manually
- **Cached Job/Profile Data**: Automatically cleaned after configured period (default: 7-30 days)
- **Chat History**: Stored until you delete or auto-cleanup period expires (configurable: 7-30 days)

## Third-Party Services

CareerCraft AI integrates with third-party services that have their own privacy policies:

| Service       | Purpose            | Privacy Policy                                               |
| ------------- | ------------------ | ------------------------------------------------------------ |
| Google Gemini | AI analysis        | [Google Privacy Policy](https://policies.google.com/privacy) |
| OpenAI        | AI analysis        | [OpenAI Privacy Policy](https://openai.com/privacy/)         |
| OpenRouter    | AI analysis        | [OpenRouter Privacy Policy](https://openrouter.ai/privacy)   |

We recommend reviewing these policies to understand how your data is handled by these services.

## Children's Privacy

CareerCraft AI is not intended for users under the age of 13. We do not knowingly collect information from children under 13. If you believe a child has provided us with information, please contact us immediately.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Continued use of the extension after changes constitutes acceptance of the updated policy.

## Data Processing Location

- **Local Data**: Stored on your device (location depends on your device location)
- **AI Processing**: Depends on your chosen AI provider's data centers

## Compliance

CareerCraft AI is designed to comply with:

- **GDPR** (General Data Protection Regulation)
- **CCPA** (California Consumer Privacy Act)
- **Chrome Web Store Developer Program Policies**

## Contact Us

If you have questions, concerns, or requests regarding this Privacy Policy or your data:

- **Email**: support@nyxto.com
- **Website**: [https://nyxto.com/extensions/careercraft-ai-linkedin-career-assistant/](https://nyxto.com/extensions/careercraft-ai-linkedin-career-assistant/)
- **Support**: [https://nyxto.com/contact/](https://nyxto.com/contact/)

## Your Consent

By installing and using CareerCraft AI, you consent to this Privacy Policy and agree to its terms.

---

**Summary (TL;DR):**

- ✅ All data stored **locally** on your device
- ✅ AI analysis uses **your own API keys**
- ✅ **No tracking** or analytics
- ✅ You control all data (delete anytime)
- ✅ **No servers** owned by us store your data
- ✅ All features free — no license or payment required
