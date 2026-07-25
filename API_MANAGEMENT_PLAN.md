# API Management Enhancement Plan

## Mission Critical - Risk Assessment ⚠️

**Current Risk Level:** HIGH  
**Reason:** Making changes to API key management could break authentication system

---

## Research Findings

### 1. **Gemini API (Google)**

#### What's Possible ✅

- **Tier Detection:** We can detect tier by attempting API calls and checking rate limit headers
- **Model Info:** Current model being used (gemini-pro) - ALREADY IN CODE
- **Rate Limits:** Different limits per tier (Free, Tier 1, 2, 3)
- **Usage Tracking:** Google provides usage dashboard at https://aistudio.google.com/usage

#### What's NOT Possible ❌

- **Direct Token Count via API:** Google doesn't provide an endpoint to query remaining tokens
- **Programmatic Tier Detection:** No API endpoint to check if user is on Free vs Paid tier
- **Real-time Quota:** Can't query remaining quota programmatically

#### Free Tier Limits (from research)

- **gemini-pro:** 15 RPM (requests per minute), Unknown TPM
- **gemini-1.5-flash:** 15 RPM, 1M TPM (tokens per minute)
- No official "tokens per day" limit published

---

### 2. **OpenAI API**

#### What's Possible ✅

- **Usage Tracking:** OpenAI provides usage data via API endpoint: `GET https://api.openai.com/v1/usage`
- **Organization Info:** Can get organization details and tier
- **Model Info:** Current model (gpt-3.5-turbo) - ALREADY IN CODE
- **Rate Limits:** Returned in response headers (x-ratelimit-\*)

#### What's NOT Possible ❌

- **Real-time Token Balance:** OpenAI doesn't show "remaining tokens" - only usage
- **Free Tier Detection:** OpenAI doesn't have a free tier (all usage is paid)

#### Rate Limit Headers (Available)

```
x-ratelimit-limit-requests: 200
x-ratelimit-limit-tokens: 40000
x-ratelimit-remaining-requests: 199
x-ratelimit-remaining-tokens: 39940
x-ratelimit-reset-requests: 7m12s
x-ratelimit-reset-tokens: 6ms
```

---

## What We CAN Safely Implement

### 1. **Model Display** ✅ SAFE - LOW RISK

**Current State:**

- Model is hardcoded in `ai-service.js` (gemini-pro, gpt-3.5-turbo)
- Users don't see which model they're using

**Enhancement:**

- Display current model next to each API option
- Show model description (speed vs accuracy)

**Implementation:** Display-only, no API calls needed

---

### 2. **API Key Validation Status** ✅ SAFE - LOW RISK

**Current State:**

- Shows checkmark if key is saved
- No validation of key format

**Enhancement:**

- Validate key format before saving
- Show "Key Format: Valid ✓" or "Invalid ✗"
- Test API connection on save (optional)

**Implementation:** Local validation only

---

### 3. **Usage Tracking (Session-based)** ✅ SAFE - MEDIUM RISK

**Current State:**

- No tracking of API calls

**Enhancement:**

- Track API calls in current browser session
- Count: Requests made, Estimated tokens used
- Store in chrome.storage.local
- Reset: On page reload or manually

**Implementation:**

- Increment counter on each API call
- Estimate tokens (rough calculation)
- Display on options page

**Risk:** Must not interfere with actual API calls

---

### 4. **Rate Limit Info Display** ✅ SAFE - LOW RISK

**Current State:**

- Users don't know rate limits

**Enhancement:**

- Display known rate limits for each tier/model
- Show warning: "Free tier: ~15 requests/minute"
- Educational only, not real-time

**Implementation:** Static information display

---

### 5. **Link to Official Dashboards** ✅ SAFE - ZERO RISK

**Enhancement:**

- Add buttons to open official usage dashboards
- Gemini: https://aistudio.google.com/usage
- OpenAI: https://platform.openai.com/usage

**Implementation:** Simple links

---

## What We CANNOT Safely Implement

### ❌ Real-time Token Balance

**Why:** Neither API provides this
**Alternative:** Session-based estimation

### ❌ Free vs Paid Tier Detection

**Why:** No API endpoint for this
**Alternative:** Educational text about tier differences

### ❌ Exact Token Usage from API

**Why:** Would require additional API calls, increasing risk
**Alternative:** Local estimation based on text length

---

## Recommended Safe Implementation Plan

### Phase 1: Display Enhancements (ZERO RISK)

1. Show model name next to each API option
2. Add model descriptions
3. Add links to official dashboards
4. Show rate limit information (educational)

### Phase 2: Local Tracking (LOW RISK)

1. Add session-based request counter
2. Estimate tokens used (length-based)
3. Display on options page
4. Add reset button

### Phase 3: Validation (MEDIUM RISK)

1. Validate API key format before saving
2. Optional: Test connection on save (with clear error handling)
3. Show validation status

---

## Proposed UI Changes

```
┌─────────────────────────────────────────────┐
│ 🔵 Google Gemini AI                        │
│                                              │
│ Model: gemini-pro                           │
│ Description: Balanced speed and quality     │
│                                              │
│ Status: ✓ Active                            │
│ Session Usage: 5 requests (~2,450 tokens)  │
│                                              │
│ Rate Limits (Free Tier):                   │
│ • 15 requests per minute                   │
│ • View your usage → [Link to Dashboard]   │
│                                              │
│ API Key: ••••••••••••••••••••••••abcd      │
│ [Save Key] [Clear Key]                     │
└─────────────────────────────────────────────┘
```

---

## Safety Checklist Before Implementation

- [ ] Create backup of current options.html and options.js
- [ ] Test all changes in isolated environment
- [ ] Ensure API calls still work after changes
- [ ] Add extensive error handling
- [ ] No modifications to actual API call logic
- [ ] All new features are optional/display-only
- [ ] Fallback to current behavior if errors occur

---

## Conclusion

**SAFE TO IMPLEMENT:**
✅ Model display
✅ Rate limit info (educational)
✅ Links to official dashboards
✅ Session-based usage tracking
✅ API key format validation

**NOT SAFE/POSSIBLE:**
❌ Real-time quota from API
❌ Automatic tier detection
❌ Exact token balance

**Recommendation:** Proceed with Phase 1 and 2 only. These provide value without risk.
