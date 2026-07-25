# Quick Test - AI Profile Analyzer

## 1️⃣ Reload Extension

`chrome://extensions/` → Click 🔄 on "LinkedIn Text Formatter"

## 2️⃣ Open Profile + DevTools

Visit: `https://www.linkedin.com/in/jeff-chandler-075159301/`
Press: `F12` (DevTools)

## 3️⃣ Find the Button

Look for **"Analyze with AI"** button:

- Next to "More" button (preferred) OR
- Bottom-right corner (floating fallback)

## 4️⃣ Test It

Click button → Wait for spinner → Modal appears ✅

---

## Console Output Should Show:

```
✅ Profile page detected
✅ Profile page elements loaded
✅ Action bar located OR Floating button created
✅ Ready
```

---

## Debug (if needed):

```javascript
window.linkedInProfileAnalyzer;
document.querySelector(".lf-analyze-profile-btn");
```

---

## Success = Button visible + clickable + modal works
