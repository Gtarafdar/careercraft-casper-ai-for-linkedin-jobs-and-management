/**
 * Casper Chat History Manager
 * Handles storage, retrieval, and management of chat conversations
 */

class CasperHistory {
  constructor() {
    this.storageKey = "casper_chats";
    this.settingsKey = "casper_settings";
  }

  /**
   * Save a chat conversation
   * @param {Object} chat - Chat object {id, title, date, messages, postContext}
   */
  async saveChat(chat) {
    try {
      const chats = await this.loadAllChats();

      // Check if chat exists (update) or new (add)
      const existingIndex = chats.findIndex((c) => c.id === chat.id);

      if (existingIndex >= 0) {
        chats[existingIndex] = chat;
      } else {
        chats.unshift(chat); // Add to beginning (most recent first)
      }

      // Apply cleanup based on settings
      const cleanedChats = await this.applyCleanupRules(chats);

      await chrome.storage.local.set({ [this.storageKey]: cleanedChats });
      console.log("Casper History: Chat saved", chat.id);

      return true;
    } catch (error) {
      console.error("Casper History: Error saving chat:", error);
      return false;
    }
  }

  /**
   * Load all chats
   * @returns {Promise<Array>} Array of chat objects
   */
  async loadAllChats() {
    try {
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || [];
    } catch (error) {
      console.error("Casper History: Error loading chats:", error);
      return [];
    }
  }

  /**
   * Load a specific chat by ID
   * @param {string} chatId - Chat ID
   * @returns {Promise<Object|null>} Chat object or null
   */
  async loadChat(chatId) {
    const chats = await this.loadAllChats();
    return chats.find((c) => c.id === chatId) || null;
  }

  /**
   * Delete a chat
   * @param {string} chatId - Chat ID to delete
   */
  async deleteChat(chatId) {
    try {
      const chats = await this.loadAllChats();
      const filtered = chats.filter((c) => c.id !== chatId);
      await chrome.storage.local.set({ [this.storageKey]: filtered });
      console.log("Casper History: Chat deleted", chatId);
      return true;
    } catch (error) {
      console.error("Casper History: Error deleting chat:", error);
      return false;
    }
  }

  /**
   * Delete all chats
   */
  async deleteAllChats() {
    try {
      await chrome.storage.local.set({ [this.storageKey]: [] });
      console.log("Casper History: All chats deleted");
      return true;
    } catch (error) {
      console.error("Casper History: Error deleting all chats:", error);
      return false;
    }
  }

  /**
   * Search chats by title or content
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching chats
   */
  async searchChats(query) {
    const chats = await this.loadAllChats();
    const lowerQuery = query.toLowerCase();

    return chats.filter((chat) => {
      // Search in title
      if (chat.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in messages
      return chat.messages.some((msg) =>
        msg.content.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Group chats by date
   * @param {Array} chats - Array of chats
   * @returns {Object} Grouped chats {Today: [], Yesterday: [], etc.}
   */
  groupChatsByDate(chats) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(today);
    thisMonth.setDate(thisMonth.getDate() - 30);

    const groups = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      "This Month": [],
      Older: [],
    };

    chats.forEach((chat) => {
      const chatDate = new Date(chat.date);

      if (chatDate >= today) {
        groups["Today"].push(chat);
      } else if (chatDate >= yesterday) {
        groups["Yesterday"].push(chat);
      } else if (chatDate >= thisWeek) {
        groups["This Week"].push(chat);
      } else if (chatDate >= thisMonth) {
        groups["This Month"].push(chat);
      } else {
        groups["Older"].push(chat);
      }
    });

    return groups;
  }

  /**
   * Apply cleanup rules based on settings
   * @param {Array} chats - All chats
   * @returns {Promise<Array>} Cleaned chats
   */
  async applyCleanupRules(chats) {
    const settings = await this.getSettings();
    let cleaned = [...chats];

    // Delete chats older than specified days
    if (settings.autoDeleteDays && settings.autoDeleteDays !== "never") {
      const cutoffDate = new Date();
      cutoffDate.setDate(
        cutoffDate.getDate() - parseInt(settings.autoDeleteDays)
      );

      cleaned = cleaned.filter((chat) => {
        return new Date(chat.date) >= cutoffDate;
      });
    }

    // Limit total number of chats
    if (settings.maxChats && settings.maxChats !== "unlimited") {
      const limit = parseInt(settings.maxChats);
      if (cleaned.length > limit) {
        // Keep most recent chats
        cleaned = cleaned.slice(0, limit);
      }
    }

    return cleaned;
  }

  /**
   * Get Casper settings
   * @returns {Promise<Object>} Settings object
   */
  async getSettings() {
    try {
      const result = await chrome.storage.local.get([this.settingsKey]);
      return (
        result[this.settingsKey] || {
          maxChats: 50,
          autoDeleteDays: 30,
        }
      );
    } catch (error) {
      console.error("Casper History: Error loading settings:", error);
      return { maxChats: 50, autoDeleteDays: 30 };
    }
  }

  /**
   * Save settings
   * @param {Object} settings - Settings to save
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.local.set({ [this.settingsKey]: settings });
      console.log("Casper History: Settings saved");
      return true;
    } catch (error) {
      console.error("Casper History: Error saving settings:", error);
      return false;
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Stats {chatCount, storageBytes}
   */
  async getStorageStats() {
    try {
      const chats = await this.loadAllChats();
      const result = await chrome.storage.local.get([this.storageKey]);
      const dataString = JSON.stringify(result[this.storageKey] || []);
      const bytes = new Blob([dataString]).size;

      return {
        chatCount: chats.length,
        storageBytes: bytes,
        storageKB: (bytes / 1024).toFixed(2),
      };
    } catch (error) {
      console.error("Casper History: Error getting stats:", error);
      return { chatCount: 0, storageBytes: 0, storageKB: "0" };
    }
  }

  /**
   * Create a new chat object
   * @param {Object} postContext - Initial post context
   * @returns {Object} New chat object
   */
  createNewChat(postContext = null) {
    const chatId = `chat_${Date.now()}`;

    // Generate a better title for post analysis chats
    let title = "New Conversation";
    if (postContext) {
      // Use first 40 chars of post content for the title
      if (postContext.content && postContext.content.trim().length > 0) {
        const contentPreview = postContext.content.trim().substring(0, 40);
        title = `Post: ${contentPreview}${
          postContext.content.length > 40 ? "..." : ""
        }`;
      } else {
        title = "Post Analysis";
      }
    }

    return {
      id: chatId,
      title: title,
      date: new Date().toISOString(),
      messages: [],
      postContext: postContext,
    };
  }

  /**
   * Add message to chat
   * @param {Object} chat - Chat object
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @returns {Object} Updated chat
   */
  addMessageToChat(chat, role, content) {
    chat.messages.push({
      role: role,
      content: content,
      timestamp: new Date().toISOString(),
    });
    return chat;
  }
}

// Make available globally immediately
window.CasperHistory = CasperHistory;
console.log("Casper: History module loaded");
