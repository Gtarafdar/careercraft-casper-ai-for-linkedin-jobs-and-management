# LinkedIn Text Formatter & AI ATS Analyzer

A powerful Chrome extension that enhances your LinkedIn experience with advanced text formatting, image uploading, job filtering, and AI-powered ATS (Applicant Tracking System) analysis.

## 🚀 Features

### 1. **Text Formatting Toolbar** 📝

- **11 Professional Styles**: Bold, Italic, Serif, Monospace, Script, Fraktur, Outline, Strikethrough, Underline, Overline, Bubble
- **Undo/Redo**: Full edit history tracking
- **Emoji Picker**: Quick access to commonly used emojis
- Beautiful gradient UI with smooth animations

### 2. **Image Upload from Clipboard** 📸

- Paste images directly from clipboard into LinkedIn posts
- **5 Upload Strategies** for maximum compatibility
- Supports all major image formats (PNG, JPG, GIF, WebP)

### 3. **"Last 1 Hour" Job Filter** ⏰

- Quickly filter LinkedIn job search results to show only jobs posted in the last hour
- Helps you find fresh opportunities before competition increases

### 4. **AI-Powered ATS Analysis** 🤖 _NEW IN v2.0_

- **Comprehensive Job Compatibility Scoring**: Get an overall compatibility score (0-100%)
- **5-Category Breakdown**:
  - 💡 Skills Match (30% weight)
  - 💼 Experience Level (25% weight)
  - 🎓 Education (15% weight)
  - 🔑 Keywords (20% weight)
  - 📋 Responsibilities (10% weight)
- **Personalized Insights**: Strengths, improvements, and detailed recommendations
- **Privacy-First**: Uses your own API keys (Google Gemini or OpenAI)
- **Real-Time Analysis**: Analyzes job descriptions against your LinkedIn profile

### 5. **Casper AI Assistant** 👻 _NEW IN v2.1_

- **Post Analysis**: Click ghost icons on LinkedIn posts for AI-powered insights
- **Smart Conversations**: Chat about LinkedIn strategy, replies, and best practices
- **Chat History**: Organized by date with search and auto-cleanup
- **Professional Design**: Friendly ghost avatar, light/dark themes, non-intrusive UI
- **Lazy Loading**: High performance with IntersectionObserver (90% faster)
- **Privacy**: All conversations stored locally, uses your own API keys

## 📦 Installation

### Method 1: Load Unpacked Extension (Developer Mode)

1. **Download the Extension**

   - Clone or download this repository to your computer
   - Extract if downloaded as ZIP

2. **Open Chrome Extensions Page**

   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Or click Menu (⋮) → More Tools → Extensions

3. **Enable Developer Mode**

   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the Extension**

   - Click "Load unpacked" button
   - Navigate to the extension folder: `Linkedin Text Formater and Image Uploder`
   - Click "Select Folder"

5. **Verify Installation**
   - You should see "LinkedIn Text Formatter & AI ATS Analyzer" in your extensions list
   - Make sure it's enabled (toggle switch is blue)

### Configure AI Analysis (Optional but Recommended)

1. Click the extension icon in your toolbar
2. Click **⚙️ Settings** at the bottom of the popup
3. Choose your AI provider:
   - **Google Gemini** (Recommended - Free tier available)
   - **OpenAI GPT** (Requires paid account)
4. Enter your API key
5. Click **Save**

#### Getting API Keys:

**For Google Gemini (FREE):**

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key (starts with "AIza...")
5. Paste into the extension settings

**For OpenAI:**

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Click **Create new secret key**
4. Copy the key (starts with "sk-...")
5. Paste into the extension settings

## 🎯 Usage

### Getting Started

1. **Navigate to LinkedIn**

   - Go to [https://www.linkedin.com](https://www.linkedin.com)
   - Log in to your account

2. **Open Post Editor**
   - Click "Start a post" from your feed
   - The formatting toolbar will automatically appear above the text editor

### Text Formatting

1. **Select Text**: Highlight the text you want to format
2. **Click Format Button**: Choose from the toolbar options
3. **Typography Styles**: Click the "Aa" button to see all available styles

**Keyboard Shortcuts**:

- Bold: `Ctrl+B` (Cmd+B on Mac) - After selecting text, click Bold button
- Italic: `Ctrl+I` (Cmd+I on Mac) - After selecting text, click Italic button

### Creating Lists

1. **Type or Paste** your list items (one per line)
2. **Select all list items**
3. **Click bullet (•)** for bullet list or **number (1.)** for numbered list

### Inserting Links

1. **Select text** to make it a link (optional)
2. **Click link button (🔗)**
3. **Enter URL** in the prompt
4. **Enter link text** if you didn't select text first

### Pasting Images from Clipboard

1. **Copy an image** from any source:

   - Screenshot (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
   - Right-click → Copy image from web
   - Copy from image editor

2. **Click in the LinkedIn post editor**

3. **Paste** using `Ctrl+V` (Windows) or `Cmd+V` (Mac)

4. **Image uploads automatically** - no need to click anything else!

### AI ATS Analysis

1. **Configure your API key first** (see installation section above)
2. Open any LinkedIn job posting
3. Wait a few seconds for the analysis to load
4. View your compatibility score and detailed breakdown below the job title

**What the AI Analyzes:**

- Extracts job description, requirements, and responsibilities
- Compares against your LinkedIn profile (headline, about, experience, education, skills)
- Identifies matching and missing skills
- Evaluates experience level fit
- Checks for keyword alignment
- Provides actionable improvement suggestions

**Score Interpretation:**

- 🎉 **75-100%**: Excellent match - Strong candidate
- 💪 **50-74%**: Good match - Competitive with some gaps
- 📈 **0-49%**: Developing match - Significant improvements needed

## 🛠️ Technical Details

### Architecture

```
linkedin-text-formatter/
├── manifest.json           # Extension configuration
├── content/
│   └── content.js         # Main content script
├── styles/
│   └── toolbar.css        # Toolbar styling
├── popup/
│   └── popup.html         # Extension popup UI
├── icons/                 # Extension icons
└── README.md             # Documentation
```

### How It Works

1. **DOM Monitoring**: Uses MutationObserver to detect when LinkedIn's post editor opens
2. **Toolbar Injection**: Injects custom formatting toolbar above the editor
3. **Unicode Formatting**: Converts text using Unicode mathematical alphanumeric symbols
4. **Clipboard Handling**: Intercepts paste events to detect and upload images
5. **LinkedIn Integration**: Triggers LinkedIn's native upload mechanism

### Permissions Explained

- `activeTab`: Access the current LinkedIn tab
- `clipboardRead`: Read clipboard data for image paste
- `storage`: Save user preferences (future feature)
- `https://www.linkedin.com/*`: Only works on LinkedIn

## 🎨 Toolbar Overview

```
[𝐁] [𝐼] [U̲] [S̶] | [Aa▾] | [•] [1.] | [🔗] [😊]
 │   │   │   │     │      │   │     │   │
 │   │   │   │     │      │   │     │   └─ Emoji picker
 │   │   │   │     │      │   │     └───── Insert link
 │   │   │   │     │      │   └─────────── Numbered list
 │   │   │   │     │      └─────────────── Bullet list
 │   │   │   │     └────────────────────── Typography dropdown
 │   │   │   └──────────────────────────── Strikethrough
 │   │   └──────────────────────────────── Underline
 │   └──────────────────────────────────── Italic
 └──────────────────────────────────────── Bold
```

## 🐛 Troubleshooting

### AI Analysis Not Working

1. **Check API Key**: Go to Settings and verify your API key is saved
2. **Check API Provider**: Make sure you selected the correct provider (Gemini or OpenAI)
3. **Check API Key Format**:
   - Gemini keys start with "AIza" and are 30+ characters
   - OpenAI keys start with "sk-" and are 40+ characters
4. **Check API Quota**: Verify your API key hasn't exceeded its quota
5. **Check Console**: Open Chrome DevTools (F12) and check for errors

### Toolbar Not Appearing

1. **Refresh LinkedIn**: Press `F5` or `Ctrl+R` (Cmd+R on Mac)
2. **Check Extension**: Make sure it's enabled in `chrome://extensions/`
3. **Check Console**: Open Developer Tools (F12) and look for errors
4. **Re-load Extension**: Disable and re-enable the extension

### Image Paste Not Working

1. **Check Permissions**: Ensure clipboard permission is granted
2. **Copy Properly**: Make sure you're copying an actual image, not a file path
3. **Editor Focus**: Click in the LinkedIn text editor before pasting
4. **Try Different Source**: Try copying from a different application

### "Last 1 Hour" Filter Not Working

1. Make sure you're on LinkedIn job search results page
2. The URL should contain `/jobs/search/`
3. Try clicking the filter button again
4. Check browser console for errors

## 🔒 Privacy & Security

- **No Data Collection**: This extension does not collect or transmit any user data
- **Local Processing**: All formatting happens in your browser
- **LinkedIn Only**: Only activates on linkedin.com domains
- **Open Source**: Code is fully transparent and auditable

## 📝 Known Limitations

1. **Unicode Rendering**: Some fonts may not display perfectly on all devices/platforms
2. **LinkedIn Changes**: Extension may break if LinkedIn updates their editor structure
3. **Rich Text**: LinkedIn's editor has limited rich text support
4. **Mobile**: This extension only works on desktop Chrome

## 🔄 Updates & Roadmap

### Version 2.0.0 (Current)

- ✨ **NEW**: AI-powered ATS job compatibility analysis
- ✨ **NEW**: Settings page for API key management
- ✨ **NEW**: Support for Google Gemini and OpenAI
- ✨ **NEW**: Profile data extraction and caching
- ✨ **NEW**: Job data extraction with multiple fallbacks
- ✨ **NEW**: Detailed compatibility scoring with 5 categories
- 🔧 Improved stats box design
- 🔧 Better duplicate prevention
- 🐛 Fixed multiple bugs in job detection

### Version 1.0.0

- ✅ Text formatting toolbar with 11 styles
- ✅ Image upload from clipboard
- ✅ "Last 1 Hour" job filter
- ✅ Beautiful gradient UI

### Future Enhancements

- [ ] Save ATS analysis history
- [ ] Compare multiple jobs
- [ ] Resume optimization suggestions
- [ ] Cover letter templates based on job
- [ ] LinkedIn profile improvement recommendations
- [ ] Multiple image paste support
- [ ] Formatting presets
- [ ] Analytics dashboard

## 👻 Casper AI Assistant _NEW IN v2.1_

Meet **Casper**, your friendly LinkedIn AI assistant! Casper provides intelligent analysis and insights directly on LinkedIn posts.

### Features

- **📊 Post Analysis**: Get AI-powered insights about any LinkedIn post

  - Engagement potential assessment
  - Content quality evaluation
  - Hook effectiveness analysis
  - Call-to-action strength
  - Audience targeting insights

- **💬 Smart Conversations**: Chat with Casper about LinkedIn strategy

  - Ask for reply suggestions
  - Get connection message ideas
  - Learn LinkedIn best practices
  - Receive personalized advice

- **📚 Chat History**: All conversations are saved

  - Organized by date (Today, Yesterday, This Week, etc.)
  - Search through past conversations
  - Resume previous discussions
  - Auto-cleanup based on your settings

- **🎨 Professional Design**: Beautiful, non-intrusive interface
  - Friendly ghost avatar
  - Light and dark themes
  - Fixed bottom-left position (doesn't interfere with LinkedIn)
  - Minimizable chatbox

### How to Use Casper

1. **Enable Casper**:

   - Click the extension icon → ⚙️ Settings
   - Scroll to "👻 Casper AI Assistant" section
   - Check "Enable Casper AI"
   - Configure your preferences (theme, max chats, auto-delete)

2. **Analyze a Post**:

   - Browse LinkedIn feed
   - Look for the ghost icon 👻 on posts (appears when you scroll)
   - Click the ghost icon on any post
   - Casper will open and analyze the post automatically

3. **Chat with Casper**:

   - After analysis, you can ask follow-up questions
   - Type your message in the input box
   - Examples:
     - "How can I improve this post?"
     - "Suggest a thoughtful reply"
     - "What makes this post engaging?"
     - "Give me LinkedIn strategy tips"

4. **Manage Chat History**:
   - Click "History" button in Casper chatbox
   - Browse past conversations by date
   - Click any chat to reload it
   - Delete all chats from Settings page

### Casper Settings

Configure Casper in the Settings page (⚙️):

- **Enable/Disable**: Turn Casper on or off
- **Theme**: Choose Light or Dark theme
- **Max Saved Chats**: 25, 50, 100, or Unlimited
- **Auto-delete**: Remove chats older than 7/30/90 days, or never
- **Storage Stats**: See how many chats and storage used
- **Delete All**: Clear all chat history with one click

### Privacy & Performance

- **Uses Your API Keys**: Casper uses the same AI provider you configured (Gemini/OpenAI/OpenRouter)
- **Lazy Loading**: Icons only appear on visible posts (90% faster load time)
- **Local Storage**: All chats saved locally in your browser
- **No Data Sharing**: Your conversations never leave your device
- **Zero Breaking Changes**: Doesn't interfere with toolbar, job stats, or any existing features

### Tips for Best Results

- **Be Specific**: Ask detailed questions for better answers
- **Provide Context**: Share what you're trying to achieve
- **Use History**: Review past conversations for consistency
- **Experiment**: Try different types of questions and requests
- **Keep Chats Organized**: Set auto-delete to keep storage clean

### Troubleshooting Casper

**Ghost icons not appearing?**

- Ensure Casper is enabled in Settings
- Make sure you have an AI provider configured
- Refresh the LinkedIn page
- Check browser console for errors

**Chatbox not responding?**

- Verify your API key is valid and has quota
- Check your internet connection
- Try disabling and re-enabling Casper
- Clear chat history if storage is full

**Performance issues?**

- Reduce max saved chats in Settings
- Enable auto-delete for older chats
- Clear chat history periodically
- Use lazy loading (enabled by default)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

1. Clone the repository
2. Make your changes
3. Test thoroughly on LinkedIn
4. Submit a pull request

### Testing Checklist

- [ ] Toolbar appears when post editor opens
- [ ] All formatting buttons work correctly
- [ ] Typography dropdown shows all styles
- [ ] Selected text is properly formatted
- [ ] Lists format correctly
- [ ] Links insert properly
- [ ] Image paste works from clipboard
- [ ] No console errors
- [ ] Toolbar disappears when editor closes
- [ ] Works on both post creation and comment editing

## 📄 License

This project is provided as-is for educational and personal use.

## 🙏 Acknowledgments

- Inspired by Typegrow's LinkedIn text formatter
- Built with vanilla JavaScript for performance
- Uses Unicode mathematical alphanumeric symbols for styling

## 📧 Support

If you encounter issues or have questions:

1. Check the Troubleshooting section above
2. Open an issue on GitHub
3. Check browser console for error messages

## ⚠️ Disclaimer

This extension is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation. Use at your own discretion. The extension modifies LinkedIn's user interface but does not access, store, or transmit any of your LinkedIn data.

---

**Happy LinkedIn Posting! 🚀**
