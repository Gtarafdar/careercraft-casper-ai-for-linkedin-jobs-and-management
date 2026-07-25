# Chrome Web Store Submission Plan

**CareerCraft AI - LinkedIn Career Assistant**
**Version:** 2.0.0

---

## ✅ PRE-SUBMISSION CHECKLIST

### 1. Manifest V3 Compliance

- ✅ **manifest_version: 3** confirmed
- ✅ **No remote code execution** - all code is bundled
- ✅ **Content Security Policy** - compliant with MV3 requirements

### 2. Icons Present

- ✅ `icons/icon16.png`
- ✅ `icons/icon48.png`
- ✅ `icons/icon128.png`
- ✅ `icons/icon32.png` (bonus, not required)

### 3. Permissions Audit & Justifications

| Permission      | Justification                                                                               |
| --------------- | ------------------------------------------------------------------------------------------- |
| `activeTab`     | Required to inject text formatting toolbar and Casper AI features into active LinkedIn tabs |
| `clipboardRead` | Enables users to paste images from clipboard directly into LinkedIn posts                   |
| `storage`       | Stores user preferences, API keys, license data, and cached job/profile data locally        |
| `tabs`          | Needed to manage LinkedIn tab interactions and job notification links                       |
| `scripting`     | Required to dynamically inject content scripts for text formatting and AI features          |
| `notifications` | Displays desktop notifications for new job postings matching saved searches                 |
| `alarms`        | Schedules periodic checks for new job postings (configurable intervals)                     |

**Host Permissions:**

- `https://www.linkedin.com/*` - Primary functionality domain
- `https://generativelanguage.googleapis.com/*` - Google Gemini API (user's own API key)
- `https://api.openai.com/*` - OpenAI API (user's own API key)

---

## 📋 DATA COLLECTION & PRIVACY POLICY

### What Data is Collected/Stored?

**LOCAL STORAGE ONLY (chrome.storage.local):**

1. **User Configuration:**
   - AI provider selection (Gemini/OpenAI)
   - API keys (encrypted, stored locally)
   - Model preferences
   - License information (Freemius)
2. **Cached Data:**

   - LinkedIn profile data (for ATS analysis)
   - Job descriptions (cached for 24h)
   - ATS analysis results
   - Saved job searches
   - Casper AI chat history

3. **UI Preferences:**
   - Toolbar collapsed/expanded state (localStorage)
   - Notification settings
   - Cache duration preferences

**EXTERNAL API CALLS:**

1. **User's AI Provider (Gemini or OpenAI)**

   - Purpose: Generate ATS analysis, Casper AI responses
   - Data sent: Job description + user profile (temporarily)
   - User control: Uses their own API keys
   - No data stored by extension on external servers

2. **Freemius License Validation (via Cloudflare Worker)**

   - Purpose: Validate premium license
   - Data sent: License key, email, device UID
   - Endpoint: `https://careercraftai-extension.infonyxto.workers.dev/`
   - Data retained: Install ID, activation timestamp (on Freemius servers per their policy)

3. **LinkedIn.com**
   - Purpose: Extract job/profile data for analysis
   - Method: DOM scraping (no API calls)
   - No data sent to external servers

**NO ANALYTICS OR TRACKING:**

- ✅ No Google Analytics
- ✅ No third-party tracking scripts
- ✅ No usage telemetry sent to developer
- ✅ No cookies created by extension

---

## 📝 PRIVACY POLICY REQUIREMENTS

### Required Privacy Policy (MUST INCLUDE):

```markdown
# Privacy Policy for CareerCraft AI

**Last Updated:** January 7, 2026

## Data Collection

CareerCraft AI stores data **locally only** on your device using Chrome's storage API.

### What We Store Locally:

- Your AI provider preferences and API keys (encrypted)
- Cached LinkedIn profile and job data (for faster analysis)
- License activation information
- Notification settings and saved searches
- Casper AI chat history

### External Services:

1. **AI Services (Your Choice):**

   - Google Gemini API or OpenAI API
   - You provide your own API keys
   - Job descriptions and profile data are sent temporarily for analysis
   - We do not store or log this data
   - Refer to [Google's Privacy Policy](https://policies.google.com/privacy) or [OpenAI's Privacy Policy](https://openai.com/privacy/)

2. **License Validation:**
   - Freemius via Cloudflare Worker
   - Sends: License key, email, device UID
   - Purpose: Verify premium license activation
   - Stored: Installation ID, activation timestamp
   - Refer to [Freemius Privacy Policy](https://freemius.com/privacy/)

### Data We Do NOT Collect:

- ❌ No analytics or usage tracking
- ❌ No personally identifiable information sent to our servers
- ❌ No browsing history
- ❌ No LinkedIn credentials

### Data Security:

- All API keys stored encrypted locally
- No data transmitted to third parties except chosen AI provider
- License validation uses secure HTTPS endpoints

### Your Rights:

- All data stored locally can be deleted by removing the extension
- You can delete cached data anytime via extension settings
- You can revoke license activation via Freemius account

## Contact:

For privacy concerns: [Your Support Email]
Website: https://nyxto.com/extensions/careercraft-ai-linkedin-career-assistant/
```

**ACTION REQUIRED:**

- ✅ Host this privacy policy at a public URL (e.g., nyxto.com/privacy/careercraft-ai)
- ✅ Add the URL to manifest.json under `"privacy_policy"` field (optional but recommended)

---

## 📦 FILE STRUCTURE FOR ZIP

### Files to INCLUDE:

```
CareerCraft-AI/
├── manifest.json
├── background.js
├── options.html
├── options.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── content/
│   ├── content.js
│   ├── ai-service.js
│   ├── cache-manager.js
│   ├── job-extractor.js
│   ├── profile-extractor.js
│   ├── profile-analyzer.js
│   ├── saved-searches-manager.js
│   ├── saved-posts-enhancer.js
│   └── notification-manager.js
├── casper/
│   ├── casper.js
│   ├── casper-api.js
│   ├── casper-avatar.js
│   ├── casper-chat-ui.js
│   ├── casper-history.js
│   ├── casper-personality.js
│   ├── casper-post-injector.js
│   └── casper.css
├── license/
│   ├── license-manager.js
│   ├── activation.html
│   ├── activation.css
│   └── activation.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── styles/
│   └── toolbar.css
└── lib/
    ├── pdf.min.js
    └── pdf.worker.min.js
```

### Files to EXCLUDE:

```
❌ backend/ (Cloudflare Worker - not needed in extension)
❌ *.md (all documentation files)
❌ afk_agent.py.save
❌ README.md
❌ INSTALLATION.md
❌ TESTING.md
❌ (all other .md files)
```

---

## 📸 STORE LISTING MATERIALS

### Required Fields:

**1. Extension Name:**

```
CareerCraft AI - LinkedIn Career Assistant
```

(60 characters max - currently 44 ✅)

**2. Short Description (132 characters max):**

```
AI-powered LinkedIn toolkit: Format posts, analyze jobs with ATS scoring, get AI insights, and craft your dream career
```

(120 characters ✅)

**3. Detailed Description:**

```
🚀 Transform Your LinkedIn Experience with CareerCraft AI

CareerCraft AI is the ultimate LinkedIn productivity toolkit for job seekers and professionals. Combine powerful text formatting, AI-powered job analysis, and an intelligent assistant to supercharge your career journey.

✨ KEY FEATURES:

📝 PROFESSIONAL TEXT FORMATTING
• 11 stylish text formats: Bold, Italic, Serif, Script, Bubble, Outline & more
• One-click formatting with live preview
• Undo/Redo with full edit history
• Emoji picker with popular selections
• Beautiful gradient toolbar interface

🤖 AI-POWERED ATS JOB ANALYSIS
• Instant compatibility scoring (0-100%)
• 5-category breakdown: Skills, Experience, Education, Keywords, Responsibilities
• Personalized strengths and improvement suggestions
• Real-time analysis against your LinkedIn profile
• Beat Applicant Tracking Systems with data-driven insights

👻 CASPER AI ASSISTANT
• Click ghost icons on any LinkedIn post for instant AI insights
• Smart conversations about LinkedIn strategy
• Professional reply suggestions
• Career advice and networking tips
• Chat history with search and auto-cleanup
• Privacy-first: All chats stored locally

📸 IMAGE CLIPBOARD UPLOAD
• Paste images directly into LinkedIn posts
• 5 upload strategies for maximum compatibility
• Supports PNG, JPG, GIF, WebP

🔍 SMART JOB FILTERING
• "Last 1 Hour" filter to catch fresh opportunities
• Saved job searches with notifications
• Customizable check intervals (15min to 24h)
• Never miss new postings

💾 ADVANCED DATA MANAGEMENT
• Saved content manager for posts & articles
• Smart caching system (configurable duration)
• Profile and job data extraction
• ATS analysis caching

🔐 PRIVACY & SECURITY:
• No data collection or tracking
• All data stored locally on your device
• Uses YOUR OWN API keys (Google Gemini or OpenAI)
• Encrypted API key storage
• No third-party analytics

⚙️ FLEXIBLE AI PROVIDERS:
• Google Gemini (Free tier available)
• OpenAI GPT (GPT-3.5, GPT-4, GPT-4o)
• Anthropic Claude (via OpenRouter)
• Multiple AI model support

🎯 PERFECT FOR:
✓ Job seekers optimizing applications
✓ Recruiters analyzing candidate fit
✓ Content creators formatting posts
✓ Professionals managing LinkedIn presence
✓ Career coaches advising clients

📊 SYSTEM REQUIREMENTS:
• Chrome/Edge browser (Manifest V3)
• LinkedIn account
• AI API key (free options available)

🆓 FREE TIER:
• Text formatting (unlimited)
• Image uploads (unlimited)
• Job filters (unlimited)

💎 PREMIUM FEATURES:
• ATS Job Analysis
• Casper AI Assistant
• Advanced caching
• Priority support

Get started today and take control of your LinkedIn career journey!

🔗 Support: https://nyxto.com/contact/
📖 Documentation: Full guide included
🌐 Website: https://nyxto.com/extensions/careercraft-ai-linkedin-career-assistant/
```

**4. Category:**

```
Productivity
```

(Alternative: Social & Communication)

**5. Language:**

```
English
```

---

## 📷 SCREENSHOT RECOMMENDATIONS

Create **5 screenshots** (1280×800 or 640×400):

1. **Text Formatting Toolbar**

   - Show LinkedIn post editor with toolbar open
   - Highlight different text styles (Bold, Script, Bubble)
   - Caption: "Professional Text Formatting - 11 Stylish Formats"

2. **ATS Analysis Results**

   - Show full ATS compatibility report
   - Highlight score (e.g., 87% match)
   - Show category breakdown with percentages
   - Caption: "AI-Powered ATS Job Analysis - Beat Applicant Tracking Systems"

3. **Casper AI Assistant**

   - Show Casper chat interface on a LinkedIn post
   - Display sample conversation
   - Show ghost avatar and clean UI
   - Caption: "Casper AI Assistant - Instant LinkedIn Insights & Strategy"

4. **Job Filtering & Notifications**

   - Show "Last 1 Hour" filter in action
   - Display saved searches panel
   - Show desktop notification
   - Caption: "Smart Job Filtering - Never Miss Fresh Opportunities"

5. **Settings Dashboard**
   - Show AI provider selection (Gemini/OpenAI)
   - Display license status (active/green)
   - Show cache settings
   - Caption: "Flexible Configuration - Your AI, Your Way"

**Design Tips:**

- Use high-contrast, clear screenshots
- Add arrows/highlights to key features
- Include descriptive captions
- Show real LinkedIn interface (blur personal info)
- Use consistent branding/colors

---

## 🎯 PERMISSION JUSTIFICATIONS (For Review)

**Copy-paste ready responses for reviewer questions:**

### Why do you need `clipboardRead`?

"Users can paste images from their clipboard directly into LinkedIn posts. This enables seamless image sharing workflow without manual file uploads."

### Why do you need `storage`?

"We store user preferences (AI provider, model selection), API keys (encrypted locally), license data, cached job/profile information, and Casper AI chat history. All data is stored locally using Chrome's storage API - no external databases."

### Why do you need `notifications`?

"Users can save LinkedIn job searches and receive desktop notifications when new matching jobs are posted. Notification frequency is user-configurable (15min to 24h intervals)."

### Why do you need `alarms`?

"Required to schedule periodic checks for new job postings based on user-saved searches. Users control check intervals via settings."

### Why do you need `scripting`?

"Dynamically injects text formatting toolbar, ATS analysis panel, and Casper AI assistant into LinkedIn pages. Required for content script injection in Manifest V3."

### Why do you need host permissions to googleapis.com and openai.com?

"Extension uses user-provided API keys to call Google Gemini or OpenAI APIs for ATS job analysis and Casper AI features. Users choose their preferred AI provider and supply their own API keys. No data is sent to our servers."

---

## 🚀 SUBMISSION PROCESS

### Step 1: Create Privacy Policy

- [ ] Write complete privacy policy (template above)
- [ ] Host at: `https://nyxto.com/privacy/careercraft-ai`
- [ ] Test URL accessibility

### Step 2: Prepare Clean ZIP

```bash
# Navigate to extension folder
cd "/Users/gtarafdar/Downloads/Linkedin Text Formater and Image Uploder"

# Create clean directory
mkdir -p CareerCraft-AI-Clean

# Copy only necessary files
cp manifest.json CareerCraft-AI-Clean/
cp background.js CareerCraft-AI-Clean/
cp options.html CareerCraft-AI-Clean/
cp options.js CareerCraft-AI-Clean/

# Copy directories
cp -r icons/ CareerCraft-AI-Clean/
cp -r content/ CareerCraft-AI-Clean/
cp -r casper/ CareerCraft-AI-Clean/
cp -r license/ CareerCraft-AI-Clean/
cp -r popup/ CareerCraft-AI-Clean/
cp -r styles/ CareerCraft-AI-Clean/
cp -r lib/ CareerCraft-AI-Clean/

# Create ZIP
cd CareerCraft-AI-Clean
zip -r ../CareerCraft-AI-v2.0.0.zip .

# Verify ZIP contents (should NOT see backend/ or .md files)
unzip -l ../CareerCraft-AI-v2.0.0.zip
```

### Step 3: Create Screenshots

- [ ] Screenshot 1: Text formatting toolbar
- [ ] Screenshot 2: ATS analysis
- [ ] Screenshot 3: Casper AI
- [ ] Screenshot 4: Job filtering
- [ ] Screenshot 5: Settings
- [ ] Resize to 1280×800 or 640×400
- [ ] Add captions/highlights

### Step 4: Developer Dashboard

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay $5 one-time fee (if first time)
3. Click "New Item"
4. Upload `CareerCraft-AI-v2.0.0.zip`

### Step 5: Fill Store Listing

- [ ] Copy extension name
- [ ] Copy short description
- [ ] Copy detailed description
- [ ] Select category: Productivity
- [ ] Select language: English
- [ ] Upload 5 screenshots
- [ ] Add promotional tile (440×280 optional)
- [ ] Add small tile (128×128 optional)

### Step 6: Privacy & Permissions

- [ ] Add privacy policy URL
- [ ] Explain each permission (copy from justifications above)
- [ ] Declare data usage:
  - ✅ Stores data locally
  - ✅ Communicates with external APIs (user's AI provider)
  - ✅ Handles user credentials (API keys - encrypted locally)
  - ❌ No analytics
  - ❌ No personal data collection

### Step 7: Distribution

- [ ] Choose visibility: **Public** (recommended)
- [ ] Select territories: **All countries**
- [ ] Pricing: **Free** (with in-app purchases for premium)

### Step 8: Submit for Review

- [ ] Click "Submit for Review"
- [ ] Monitor email for review status
- [ ] Expected time: 2-7 days

---

## ⚠️ COMMON REJECTION REASONS & HOW WE AVOID THEM

| Rejection Reason                            | Our Prevention                                       |
| ------------------------------------------- | ---------------------------------------------------- |
| Overbroad permissions                       | All permissions justified with specific use cases    |
| Missing privacy policy                      | Comprehensive policy hosted at public URL            |
| Misleading description                      | Accurate feature descriptions, no exaggerated claims |
| Remote code execution                       | All code bundled, no eval() or dynamic imports       |
| Collecting personal data without disclosure | Privacy policy clearly states data usage             |
| API key handling concerns                   | Encrypted local storage, user provides own keys      |
| License/payment confusion                   | Clear free vs premium feature distinction            |

---

## 📞 SUPPORT RESOURCES

**If Rejected:**

1. Read rejection email carefully
2. Fix specific issues mentioned
3. Resubmit with changes documented
4. Response time: Usually 1-3 days for resubmission

**Post-Approval:**

1. Monitor reviews daily
2. Respond to user feedback
3. Fix bugs via updates (auto-review for minor changes)
4. Major feature updates may trigger new review

---

## ✅ FINAL CHECKLIST BEFORE SUBMISSION

- [ ] Privacy policy created and hosted
- [ ] Clean ZIP package created (no backend/, no .md files)
- [ ] All 5 screenshots created and captioned
- [ ] Store listing text ready (name, descriptions)
- [ ] Permission justifications documented
- [ ] Tested extension locally one final time
- [ ] License validation works with Cloudflare Worker
- [ ] No console errors in production build
- [ ] All API keys removed from code (users provide their own)
- [ ] Developer account created and $5 fee paid

---

## 🎉 ESTIMATED TIMELINE

| Phase                    | Duration     |
| ------------------------ | ------------ |
| Privacy policy creation  | 30 minutes   |
| Clean ZIP preparation    | 15 minutes   |
| Screenshot creation      | 1-2 hours    |
| Store listing completion | 30 minutes   |
| Initial review           | 2-7 days     |
| **Total:**               | **3-8 days** |

---

**Good luck with your submission! 🚀**
