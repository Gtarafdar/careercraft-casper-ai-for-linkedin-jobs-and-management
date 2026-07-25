/**
 * Casper API Handler
 * Wraps existing AIService for Casper chat functionality
 * READ-ONLY: Does not modify AI service configuration
 */

class CasperAPI {
  constructor() {
    this.aiService = null;
    this.initialized = false;
  }

  /**
   * Initialize by using existing AIService instance
   */
  async initialize() {
    try {
      // Check if AIService is available globally
      if (typeof window.AIService === "undefined") {
        console.error("Casper API: AIService not found on window object");
        return false;
      }

      // Create new instance and initialize with existing settings
      this.aiService = new window.AIService();
      const success = await this.aiService.initialize();

      if (!success) {
        console.warn(
          "Casper API: No AI provider configured - user needs to set up API keys"
        );
        this.initialized = false;
        return false;
      }

      this.initialized = true;
      console.log(
        "Casper API: Initialized successfully with provider:",
        this.aiService.activeProvider
      );
      return true;
    } catch (error) {
      console.error("Casper API: Initialization error:", error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * Send a message to AI and get response with conversation history
   * @param {string} prompt - The prompt to send
   * @param {Array} conversationHistory - Previous messages [{role: 'user'|'assistant', content: 'text'}]
   * @param {string} context - Optional context ('postAnalysis', 'general', etc.)
   * @returns {Promise<string>} AI response
   */
  async sendMessage(prompt, conversationHistory = [], context = "general") {
    if (!this.initialized || !this.aiService) {
      console.log("[Casper API] Reinitializing AI service...");
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        throw new Error("noApiConfigured");
      }
    }

    // Double-check API key is still valid before making call
    if (!this.aiService.apiKey || this.aiService.apiKey.trim() === "") {
      console.error("[Casper API] API key missing, reinitializing...");
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        throw new Error("noApiConfigured");
      }
    }

    try {
      let response;

      console.log(
        "[Casper API] Sending message with provider:",
        this.aiService.activeProvider
      );
      console.log("[Casper API] API key present:", !!this.aiService.apiKey);

      // Build full prompt with conversation history for context
      const fullPrompt = this.buildConversationPrompt(
        prompt,
        conversationHistory,
        context
      );

      // Call appropriate AI service method - use TEXT methods for Casper chat
      if (this.aiService.activeProvider === "gemini") {
        response = await this.aiService.callGeminiText(fullPrompt);
      } else if (this.aiService.activeProvider === "openai") {
        response = await this.aiService.callOpenAIText(fullPrompt);
      } else if (this.aiService.activeProvider === "openrouter") {
        response = await this.aiService.callOpenRouterText(fullPrompt);
      } else {
        throw new Error("invalidProvider");
      }

      // AIService methods return text directly (already parsed)
      if (typeof response === "string" && response.trim().length > 0) {
        // Check if response is JSON and format it nicely
        return this.formatResponse(response);
      } else if (response && typeof response === "object") {
        // Handle any unexpected object format
        if (response.text && typeof response.text === "string")
          return this.formatResponse(response.text);
        if (response.content && typeof response.content === "string")
          return this.formatResponse(response.content);
        if (response.message && typeof response.message === "string")
          return this.formatResponse(response.message);
        // Check for choices array (OpenAI format)
        if (response.choices && response.choices[0]?.message?.content) {
          return this.formatResponse(response.choices[0].message.content);
        }
        // Format JSON object directly
        return this.formatJsonObject(response);
      } else {
        console.error(
          "Casper API: Invalid response:",
          typeof response,
          response
        );
        throw new Error("Invalid response format from AI");
      }
    } catch (error) {
      console.error("Casper API: Error sending message:", error);

      // Handle 401 errors by reinitializing (API key might have been cleared)
      if (
        error.message.includes("401") ||
        error.message.includes("User not found")
      ) {
        console.warn(
          "[Casper API] 401 error detected, attempting to reinitialize..."
        );
        try {
          this.initialized = false;
          this.aiService = null;
          const initSuccess = await this.initialize();
          if (initSuccess) {
            console.log(
              "[Casper API] Reinitialization successful, please try again"
            );
            throw new Error("invalidKey"); // Tell user to retry
          }
        } catch (reinitError) {
          console.error("[Casper API] Reinitialization failed:", reinitError);
        }
      }

      // Map errors to user-friendly messages
      if (
        error.message.includes("API key") ||
        error.message.includes("401") ||
        error.message.includes("User not found")
      ) {
        throw new Error("invalidKey");
      } else if (
        error.message.includes("rate limit") ||
        error.message.includes("429")
      ) {
        throw new Error("rateLimitHit");
      } else if (
        error.message.includes("Network") ||
        error.message.includes("fetch")
      ) {
        throw new Error("networkError");
      } else if (error.message === "noApiConfigured") {
        throw error;
      } else {
        throw new Error("apiFailure");
      }
    }
  }

  /**
   * Build conversation prompt with history for context awareness
   * @param {string} currentPrompt - Current user message
   * @param {Array} history - Conversation history
   * @param {string} context - Context type
   * @returns {string} Full prompt with context
   */
  buildConversationPrompt(currentPrompt, history = [], context = "general") {
    console.log(
      "[Casper Prompt] Building prompt with history length:",
      history.length
    );
    console.log(
      "[Casper Prompt] Current prompt:",
      currentPrompt.substring(0, 100)
    );

    // Get system prompt
    const systemPrompt =
      window.CasperPersonality?.systemPrompt ||
      "You are Casper, a LinkedIn AI assistant.";

    // Optimize history: Keep only last 12 messages (6 exchanges)
    // This limits token usage while maintaining good context
    const recentHistory = history.slice(-12);
    console.log(
      "[Casper Prompt] Using",
      recentHistory.length,
      "messages from history"
    );

    // Build conversation context
    let conversationContext = "";
    if (recentHistory.length > 0) {
      conversationContext = "\n\n--- Previous conversation for context ---\n";
      recentHistory.forEach((msg) => {
        const role = msg.role === "user" ? "User" : "Casper";
        // Truncate very long messages to save tokens (keep first 800 chars)
        const content =
          msg.content.length > 800
            ? msg.content.substring(0, 800) +
              "... [message truncated for brevity]"
            : msg.content;
        conversationContext += `\n${role}: ${content}\n`;
      });
      conversationContext += "\n--- End of previous conversation ---\n\n";
      console.log(
        "[Casper Prompt] Added conversation context:",
        conversationContext.length,
        "chars"
      );
    } else {
      console.log("[Casper Prompt] No history to add");
    }

    // Combine: System prompt + History + Current message
    // Natural flow: here's your personality, here's what was said before, here's the new message
    const fullPrompt = `${systemPrompt}${conversationContext}User: ${currentPrompt}\n\nCasper:`;
    console.log(
      "[Casper Prompt] Final prompt length:",
      fullPrompt.length,
      "chars"
    );
    console.log(
      "[Casper Prompt] Full prompt preview:",
      fullPrompt.substring(0, 500) + "..."
    );

    return fullPrompt;
  }

  /**
   * Analyze a LinkedIn post
   * @param {Object} postContext - Post data {author, text, postId, url}
   * @returns {Promise<string>} Analysis result
   */
  async analyzePost(postContext) {
    if (!CasperPersonality) {
      throw new Error("CasperPersonality not loaded");
    }

    const prompt = CasperPersonality.buildPostAnalysisPrompt(postContext);
    return await this.sendMessage(prompt, [], "postAnalysis");
  }

  /**
   * Get help with a reply to a post
   * @param {Object} postContext - Original post context
   * @param {string} userIntent - What the user wants to say
   * @returns {Promise<string>} Suggested reply
   */
  async helpWithReply(postContext, userIntent) {
    const prompt = `${CasperPersonality.systemPrompt}

User request: Help me write a professional reply

Original Post by ${postContext.author}:
${postContext.text}

What I want to say:
${userIntent}

Please craft a professional, engaging LinkedIn comment based on my intent. Keep it concise and authentic.`;

    return await this.sendMessage(prompt, "replyHelp");
  }

  /**
   * Generate a connection request message
   * @param {Object} profileContext - Target profile information
   * @param {string} reason - Why user wants to connect
   * @returns {Promise<string>} Connection message
   */
  async createConnectionMessage(profileContext, reason) {
    const prompt = `${CasperPersonality.systemPrompt}

User request: Help me write a connection request

Target Profile: ${profileContext.name}
${profileContext.headline ? `Headline: ${profileContext.headline}` : ""}

Why I want to connect:
${reason}

Please create a personalized, professional connection request message. Keep it under 300 characters as LinkedIn requires.`;

    return await this.sendMessage(prompt, "connectionRequest");
  }

  /**
   * Format AI response - convert JSON to readable text if needed
   * @param {string} text - Raw AI response
   * @returns {string} Formatted response
   */
  formatResponse(text) {
    try {
      // Try to parse as JSON
      const json = JSON.parse(text);
      return this.formatJsonObject(json);
    } catch (e) {
      // Not JSON, return as-is
      return text;
    }
  }

  /**
   * Format JSON object into readable text
   * @param {Object} obj - JSON object
   * @returns {string} Formatted text
   */
  formatJsonObject(obj) {
    let formatted = "";

    // Handle title
    if (obj.title) {
      formatted += `📌 **${obj.title}**\n\n`;
    }

    // Handle bulletins/points array
    if (obj.bulletins && Array.isArray(obj.bulletins)) {
      formatted += "**Key Points:**\n\n";
      obj.bulletins.forEach((item, index) => {
        if (item.point) {
          formatted += `${index + 1}. ${item.point}`;
          if (item.importance) formatted += ` (${item.importance})`;
          if (item.impact) formatted += ` [Impact: ${item.impact}]`;
          if (item.priority) formatted += ` [Priority: ${item.priority}]`;
          if (item.trend) formatted += ` [Trend: ${item.trend}]`;
          if (item.effectiveness)
            formatted += ` [Effectiveness: ${item.effectiveness}]`;
          if (item.shift) formatted += ` [Shift: ${item.shift}]`;
          if (item.strategy) formatted += ` [Strategy: ${item.strategy}]`;
          formatted += "\n\n";
        }
      });
    }

    // Handle conclusion/summary
    if (obj.conclusion) {
      formatted += `\n**Conclusion:**\n${obj.conclusion}`;
    } else if (obj.summary) {
      formatted += `\n**Summary:**\n${obj.summary}`;
    }

    // If no structured format found, create a generic representation
    if (!formatted) {
      formatted = "**Response:**\n\n";
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          formatted += `**${this.capitalize(key)}:**\n`;
          value.forEach((item, i) => {
            if (typeof item === "object") {
              formatted += `${i + 1}. ${JSON.stringify(item, null, 2)}\n`;
            } else {
              formatted += `• ${item}\n`;
            }
          });
          formatted += "\n";
        } else if (typeof value === "object") {
          formatted += `**${this.capitalize(key)}:**\n${JSON.stringify(
            value,
            null,
            2
          )}\n\n`;
        } else {
          formatted += `**${this.capitalize(key)}:** ${value}\n\n`;
        }
      }
    }

    return formatted || JSON.stringify(obj, null, 2);
  }

  /**
   * Capitalize first letter
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
  }

  /**
   * Check if API is configured and ready
   * @returns {boolean} True if API is ready
   */
  isReady() {
    return this.initialized && this.aiService && this.aiService.apiKey;
  }

  /**
   * Get current provider name
   * @returns {string|null} Provider name or null
   */
  getProvider() {
    return this.aiService ? this.aiService.activeProvider : null;
  }
}

// Make available globally immediately
window.CasperAPI = CasperAPI;
console.log("Casper: API module loaded");
