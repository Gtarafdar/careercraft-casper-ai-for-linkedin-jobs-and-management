/**
 * Casper Chat UI Component
 * Handles chatbox DOM creation, interactions, and UI updates
 */

class CasperChatUI {
  constructor(casperAPI, casperHistory) {
    this.api = casperAPI;
    this.history = casperHistory;
    this.chatbox = null;
    this.currentChat = null;
    this.isMinimized = false;
    this.isOpen = false;
    this.userProfile = null; // Store user profile info
  }

  /**
   * Initialize and create chatbox (hidden by default)
   */
  init() {
    if (this.chatbox) {
      console.log("Casper UI: Already initialized");
      return;
    }

    // Extract user profile from LinkedIn
    this.extractUserProfile();

    this.chatbox = this.createChatbox();
    document.body.appendChild(this.chatbox);
    this.attachEventListeners();
    console.log("Casper UI: Chatbox created");
  }

  /**
   * Extract user profile information from LinkedIn
   */
  extractUserProfile() {
    try {
      // Try to find user's profile info from LinkedIn's global identity
      const profileCard =
        document.querySelector(".global-nav__me-photo") ||
        document.querySelector(".nav-item__profile-member-photo") ||
        document.querySelector('[data-control-name="identity_profile_photo"]');

      const profileImg = profileCard?.querySelector("img");
      const profilePhoto =
        profileImg?.src || profileImg?.getAttribute("data-delayed-url") || "";

      // Try to get name from profile dropdown or navigation
      const nameElement =
        document.querySelector(".global-nav__me-content .t-16") ||
        document.querySelector(".feed-identity-module__actor-meta .t-bold") ||
        document.querySelector(
          ".global-nav__primary-link-me-menu-trigger span"
        );

      let fullName = nameElement?.textContent?.trim() || "User";

      // Extract first name (everything before first space)
      const firstName = fullName.split(" ")[0];

      this.userProfile = {
        fullName: fullName,
        firstName: firstName,
        photo: profilePhoto,
      };

      console.log("Casper UI: User profile extracted:", this.userProfile);
    } catch (error) {
      console.error("Casper UI: Error extracting user profile:", error);
      this.userProfile = {
        fullName: "User",
        firstName: "User",
        photo: "",
      };
    }
  }

  /**
   * Create chatbox DOM structure
   * @returns {HTMLElement} Chatbox element
   */
  createChatbox() {
    const chatbox = document.createElement("div");
    chatbox.id = "casper-chatbox";
    chatbox.className = "casper-chatbox casper-chatbox-hidden";

    chatbox.innerHTML = `
      <div class="casper-chatbox-header">
        <div class="casper-header-left">
          ${window.CasperAvatar ? window.CasperAvatar.small("light") : ""}
          <span class="casper-header-title">Casper AI</span>
        </div>
        <div class="casper-header-actions">
          <button class="casper-header-btn casper-minimize-btn" title="Minimize">−</button>
          <button class="casper-header-btn casper-close-btn" title="Close">×</button>
        </div>
      </div>
      
      <div class="casper-chatbox-body">
        <div class="casper-messages-container">
          <div class="casper-welcome-screen">
            ${window.CasperAvatar ? window.CasperAvatar.large("light") : ""}
            <h3>Hi! I'm Casper 👋</h3>
            <p>Your LinkedIn AI assistant. I can help you:</p>
            <ul>
              <li>Analyze posts for engagement insights</li>
              <li>Suggest thoughtful replies</li>
              <li>Create connection messages</li>
              <li>Provide LinkedIn strategy tips</li>
            </ul>
            <p class="casper-welcome-tip">Type a message below or click the ghost icon on any LinkedIn post!</p>
          </div>
        </div>
      </div>

      <div class="casper-chatbox-footer">
        <div class="casper-input-container">
          <textarea 
            class="casper-input" 
            placeholder="Type your message..."
            rows="1"
          ></textarea>
          <button class="casper-send-btn" title="Send">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10L18 2L12 18L10 11L2 10Z"/>
            </svg>
          </button>
        </div>
        <div class="casper-footer-actions">
          <button class="casper-footer-btn casper-new-chat-btn">New Chat</button>
          <button class="casper-footer-btn casper-history-btn">History</button>
        </div>
      </div>
    `;

    return chatbox;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Header buttons
    this.chatbox
      .querySelector(".casper-minimize-btn")
      ?.addEventListener("click", () => {
        this.minimize();
      });

    this.chatbox
      .querySelector(".casper-close-btn")
      ?.addEventListener("click", () => {
        this.close();
      });

    // Input handling
    const input = this.chatbox.querySelector(".casper-input");
    const sendBtn = this.chatbox.querySelector(".casper-send-btn");

    sendBtn?.addEventListener("click", () => {
      this.handleSendMessage();
    });

    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Auto-resize textarea
    input?.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });

    // Footer buttons
    this.chatbox
      .querySelector(".casper-new-chat-btn")
      ?.addEventListener("click", () => {
        this.startNewChat();
      });

    this.chatbox
      .querySelector(".casper-history-btn")
      ?.addEventListener("click", () => {
        this.showHistory();
      });
  }

  /**
   * Open chatbox
   * @param {Object} postContext - Optional post context to analyze
   */
  async open(postContext = null) {
    if (!this.chatbox) {
      console.error("Casper UI: Chatbox not initialized");
      return;
    }

    this.isOpen = true;
    this.chatbox.classList.remove("casper-chatbox-hidden");
    this.chatbox.classList.add("casper-chatbox-visible");

    // Start new chat with post context
    if (postContext) {
      await this.startNewChat(postContext);
      await this.analyzePost(postContext);
    } else {
      // Initialize a new chat silently (don't show greeting yet)
      // This allows user to type messages immediately while keeping welcome screen
      this.currentChat = this.history.createNewChat(null);
      this.showWelcomeScreen();
      console.log("Casper UI: Chat initialized, welcome screen shown");
    }

    console.log("Casper UI: Chatbox opened");
  }

  /**
   * Close chatbox
   */
  close() {
    if (!this.chatbox) return;

    this.isOpen = false;
    this.chatbox.classList.remove("casper-chatbox-visible");
    this.chatbox.classList.add("casper-chatbox-hidden");

    console.log("Casper UI: Chatbox closed");
  }

  /**
   * Minimize/expand chatbox
   */
  minimize() {
    if (!this.chatbox) return;

    this.isMinimized = !this.isMinimized;
    const body = this.chatbox.querySelector(".casper-chatbox-body");
    const footer = this.chatbox.querySelector(".casper-chatbox-footer");
    const minimizeBtn = this.chatbox.querySelector(".casper-minimize-btn");

    if (this.isMinimized) {
      // Hide body and footer completely
      if (body) body.style.display = "none";
      if (footer) footer.style.display = "none";
      // Shrink chatbox to header only
      this.chatbox.style.height = "60px";
      if (minimizeBtn) {
        minimizeBtn.innerHTML = "↑";
        minimizeBtn.title = "Expand";
      }
    } else {
      // Show body and footer with correct display values
      if (body) body.style.display = "";
      if (footer) footer.style.display = "";
      // Restore full height
      this.chatbox.style.height = "500px";
      if (minimizeBtn) {
        minimizeBtn.innerHTML = "−";
        minimizeBtn.title = "Minimize";
      }
    }
  }

  /**
   * Build conversation history from current chat messages
   * @returns {Array} Array of {role, content} objects
   */
  buildConversationHistory() {
    if (!this.currentChat || !this.currentChat.messages) {
      console.log("[Casper Memory] No current chat or messages");
      return [];
    }

    console.log(
      "[Casper Memory] Total messages in chat:",
      this.currentChat.messages.length
    );
    console.log(
      "[Casper Memory] All messages:",
      this.currentChat.messages.map(
        (m, i) => `[${i}] ${m.role}: ${m.content.substring(0, 50)}...`
      )
    );

    // Convert chat messages to conversation history format
    // Skip: [0] greeting, [-1] the user message we just added (it's the current prompt)
    const messages = this.currentChat.messages.slice(1, -1);

    console.log(
      "[Casper Memory] History after slice(1, -1):",
      messages.length,
      "messages"
    );
    console.log(
      "[Casper Memory] History content:",
      messages.map((m) => `${m.role}: ${m.content.substring(0, 50)}...`)
    );

    return messages.map((msg) => ({
      role: msg.role, // 'user' or 'assistant'
      content: msg.content,
    }));
  }

  /**
   * Show welcome screen (only used when clearing all messages)
   */
  showWelcomeScreen() {
    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (!container) return;

    container.innerHTML = `
      <div class="casper-welcome-screen">
        ${window.CasperAvatar ? window.CasperAvatar.large("light") : ""}
        <h3>Hi! I'm Casper 👋</h3>
        <p>Your LinkedIn AI assistant. I can help you:</p>
        <ul>
          <li>Analyze posts for engagement insights</li>
          <li>Suggest thoughtful replies</li>
          <li>Create connection messages</li>
          <li>Provide LinkedIn strategy tips</li>
        </ul>
        <p class="casper-welcome-tip">Type a message below or click the ghost icon on any post!</p>
      </div>
    `;
  }

  /**
   * Start new chat
   * @param {Object} postContext - Optional post context
   */
  async startNewChat(postContext = null) {
    this.currentChat = this.history.createNewChat(postContext);
    this.clearMessages();

    // Add greeting
    const greeting = window.CasperPersonality
      ? window.CasperPersonality.getGreeting(postContext ? "post" : "general")
      : "Hello! How can I help you today?";

    this.addMessage("assistant", greeting);
    // IMPORTANT: Save greeting to history so slice(1,-1) works correctly
    this.history.addMessageToChat(this.currentChat, "assistant", greeting);
    console.log("Casper UI: New chat started", this.currentChat.id);
  }

  /**
   * Analyze post
   * @param {Object} postContext - Post context to analyze
   */
  async analyzePost(postContext) {
    try {
      this.showLoading("Analyzing post...");

      const response = await this.api.analyzePost(postContext);

      this.hideLoading();
      this.addMessage("assistant", response);

      // Save to history
      this.history.addMessageToChat(this.currentChat, "assistant", response);
      await this.history.saveChat(this.currentChat);
    } catch (error) {
      this.hideLoading();

      // Get friendly error message
      let errorMsg = "Failed to analyze post";
      if (window.CasperPersonality) {
        errorMsg =
          window.CasperPersonality.getErrorMessage(error.message) || errorMsg;
      }

      this.showError(errorMsg);
      console.error("Casper UI: Analysis error:", error);
    }
  }

  /**
   * Handle send message
   */
  async handleSendMessage() {
    const input = this.chatbox?.querySelector(".casper-input");
    const message = input?.value.trim();

    if (!message) return;

    // If no current chat exists, create one first
    if (!this.currentChat) {
      console.log("Casper UI: No active chat, creating one...");
      await this.startNewChat(null);
    }

    // Remove welcome screen if present (user is starting conversation)
    const welcomeScreen = this.chatbox?.querySelector(".casper-welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.remove();
    }

    // Clear input
    input.value = "";
    input.style.height = "auto";

    // Add user message
    this.addMessage("user", message);
    this.history.addMessageToChat(this.currentChat, "user", message);

    try {
      this.showLoading("Thinking...");

      // Build conversation history from current chat
      const conversationHistory = this.buildConversationHistory();

      // Send to API with conversation context
      const response = await this.api.sendMessage(
        message,
        conversationHistory,
        "general"
      );

      this.hideLoading();
      this.addMessage("assistant", response);

      // Save to history
      this.history.addMessageToChat(this.currentChat, "assistant", response);
      await this.history.saveChat(this.currentChat);
    } catch (error) {
      this.hideLoading();

      // Get friendly error message
      let errorMsg = "Failed to send message";
      if (window.CasperPersonality) {
        errorMsg =
          window.CasperPersonality.getErrorMessage(error.message) || errorMsg;
      }

      this.showError(errorMsg);
      console.error("Casper UI: Send error:", error);
    }
  }

  /**
   * Add message to chat
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  addMessage(role, content) {
    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (!container) return;

    // Remove welcome screen if present
    const welcomeScreen = container.querySelector(".casper-welcome-screen");
    if (welcomeScreen) {
      welcomeScreen.remove();
    }

    const messageDiv = document.createElement("div");
    messageDiv.className = `casper-message casper-message-${role}`;

    if (role === "assistant") {
      messageDiv.innerHTML = `
        <div class="casper-message-avatar">
          ${window.CasperAvatar ? window.CasperAvatar.small("light") : ""}
        </div>
        <div class="casper-message-bubble">
          <div class="casper-message-sender">Casper</div>
          <div class="casper-message-content">${this.formatMessage(
            content
          )}</div>
        </div>
      `;
    } else {
      // User message with profile photo and first name
      const userPhoto = this.userProfile?.photo || "";
      const userName = this.userProfile?.firstName || "You";

      const avatarHTML = userPhoto
        ? `<img src="${userPhoto}" alt="${userName}" class="casper-user-photo" />`
        : `<div class="casper-user-photo-placeholder">${userName
            .charAt(0)
            .toUpperCase()}</div>`;

      messageDiv.innerHTML = `
        <div class="casper-message-bubble">
          <div class="casper-message-sender">${userName}</div>
          <div class="casper-message-content">${this.formatMessage(
            content
          )}</div>
        </div>
        <div class="casper-message-avatar">
          ${avatarHTML}
        </div>
      `;
    }

    container.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * Format message content (basic markdown support)
   * @param {string} content - Raw content
   * @returns {string} Formatted HTML
   */
  formatMessage(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br>")
      .replace(/`(.*?)`/g, "<code>$1</code>");
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (container) {
      container.innerHTML = "";
    }
  }

  /**
   * Show loading indicator
   * @param {string} text - Loading text
   */
  showLoading(text = "Loading...") {
    this.hideLoading(); // Remove existing

    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (!container) return;

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "casper-loading";
    loadingDiv.innerHTML = `
      <div class="casper-loading-spinner"></div>
      <span>${text}</span>
    `;

    container.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    const loading = this.chatbox?.querySelector(".casper-loading");
    if (loading) {
      loading.remove();
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (!container) return;

    const errorDiv = document.createElement("div");
    errorDiv.className = "casper-error";
    errorDiv.innerHTML = `
      <strong>⚠️ Error:</strong> ${message}
    `;

    container.appendChild(errorDiv);
    this.scrollToBottom();
  }

  /**
   * Scroll to bottom of messages
   */
  scrollToBottom() {
    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  /**
   * Show chat history
   */
  async showHistory() {
    const chats = await this.history.loadAllChats();
    const grouped = this.history.groupChatsByDate(chats);

    const container = this.chatbox?.querySelector(".casper-messages-container");
    if (!container) return;

    let historyHTML = '<div class="casper-history-view"><h3>Chat History</h3>';

    for (const [group, groupChats] of Object.entries(grouped)) {
      if (groupChats.length === 0) continue;

      historyHTML += `<div class="casper-history-group"><h4>${group}</h4>`;

      groupChats.forEach((chat) => {
        const date = new Date(chat.date).toLocaleString();
        historyHTML += `
          <div class="casper-history-item" data-chat-id="${chat.id}">
            <div class="casper-history-item-title">${chat.title}</div>
            <div class="casper-history-item-date">${date}</div>
          </div>
        `;
      });

      historyHTML += "</div>";
    }

    historyHTML += "</div>";
    container.innerHTML = historyHTML;

    // Add click handlers
    container.querySelectorAll(".casper-history-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const chatId = item.dataset.chatId;
        await this.loadChat(chatId);
      });
    });
  }

  /**
   * Load a specific chat
   * @param {string} chatId - Chat ID
   */
  async loadChat(chatId) {
    const chat = await this.history.loadChat(chatId);
    if (!chat) return;

    this.currentChat = chat;
    this.clearMessages();

    // Restore messages
    chat.messages.forEach((msg) => {
      this.addMessage(msg.role, msg.content);
    });

    console.log("Casper UI: Chat loaded", chatId);
  }
}

// Make available globally immediately
window.CasperChatUI = CasperChatUI;
console.log("Casper: Chat UI module loaded");
