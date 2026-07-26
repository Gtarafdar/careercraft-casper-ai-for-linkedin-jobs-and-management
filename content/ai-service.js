/**
 * AI Service Module
 * Handles communication with Gemini and OpenAI APIs
 */

class AIService {
  constructor() {
    this.activeProvider = null;
    this.apiKey = null;
    this.geminiModel = "gemini-2.5-flash"; // Default model (current stable)
    this.openaiModel = "gpt-3.5-turbo"; // Default model
    this.openrouterModel = "google/gemini-2.5-flash"; // Default model
    this.deepseekModel = "deepseek-chat";
    this.qwenModel = "qwen-plus";
  }

  /**
   * Initialize AI service with stored credentials
   */
  async initialize() {
    try {
      const result = await chrome.storage.local.get([
        "active_provider",
        "gemini_api_key",
        "openai_api_key",
        "openrouter_api_key",
        "deepseek_api_key",
        "qwen_api_key",
        "gemini_model",
        "openai_model",
        "openrouter_model",
        "deepseek_model",
        "qwen_model",
      ]);

      this.activeProvider = result.active_provider;

      // Load model selections
      this.geminiModel = result.gemini_model || "gemini-2.5-flash";
      this.openaiModel = result.openai_model || "gpt-3.5-turbo";
      this.openrouterModel =
        result.openrouter_model || "google/gemini-2.5-flash";
      this.deepseekModel = result.deepseek_model || "deepseek-chat";
      this.qwenModel = result.qwen_model || "qwen-plus";

      if (this.activeProvider === "gemini" && result.gemini_api_key) {
        this.apiKey = result.gemini_api_key;
        console.log(
          "AI Service: Initialized with Gemini, model:",
          this.geminiModel
        );
        return true;
      } else if (this.activeProvider === "openai" && result.openai_api_key) {
        this.apiKey = result.openai_api_key;
        console.log(
          "AI Service: Initialized with OpenAI, model:",
          this.openaiModel
        );
        return true;
      } else if (
        this.activeProvider === "openrouter" &&
        result.openrouter_api_key
      ) {
        this.apiKey = result.openrouter_api_key;
        console.log(
          "AI Service: Initialized with OpenRouter, model:",
          this.openrouterModel
        );
        return true;
      } else if (
        this.activeProvider === "deepseek" &&
        result.deepseek_api_key
      ) {
        this.apiKey = result.deepseek_api_key;
        console.log(
          "AI Service: Initialized with DeepSeek, model:",
          this.deepseekModel
        );
        return true;
      } else if (this.activeProvider === "qwen" && result.qwen_api_key) {
        this.apiKey = result.qwen_api_key;
        console.log(
          "AI Service: Initialized with Qwen, model:",
          this.qwenModel
        );
        return true;
      }

      console.log("AI Service: No API key configured");
      return false;
    } catch (error) {
      console.error("AI Service: Initialization error:", error);
      return false;
    }
  }

  /**
   * Analyze job posting and user profile for ATS compatibility
   */
  async analyzeJobCompatibility(jobData, userProfile) {
    if (!this.activeProvider || !this.apiKey) {
      throw new Error(
        "AI service not configured. Please add your API key in settings."
      );
    }

    const prompt = this.buildAnalysisPrompt(jobData, userProfile);

    if (this.activeProvider === "gemini") {
      return await this.callGemini(prompt);
    } else if (this.activeProvider === "openai") {
      return await this.callOpenAI(prompt);
    } else if (this.activeProvider === "openrouter") {
      return await this.callOpenRouter(prompt);
    } else if (this.activeProvider === "deepseek") {
      return await this.callDeepSeek(prompt);
    } else if (this.activeProvider === "qwen") {
      return await this.callQwen(prompt);
    }
  }

  /**
   * Extract structured job requirements from job description
   */
  async extractJobRequirements(jobDescription) {
    if (!this.activeProvider || !this.apiKey) {
      throw new Error("AI service not configured");
    }

    const desc = String(jobDescription || "").trim();
    // Stub / missing JD — do not call the model (it echoes the prompt examples)
    if (
      !desc ||
      desc.length < 80 ||
      /^description not available$/i.test(desc)
    ) {
      return null;
    }

    try {
      // Truncate very long job descriptions to avoid API limits
      const maxLength = 2000; // Optimized to reduce token usage
      const truncatedDesc =
        desc.length > maxLength ? desc.substring(0, maxLength) + "..." : desc;

      const prompt = `Extract key requirements from this job. Return ONLY valid JSON, NO trailing commas.
Use REAL values from the job description. Do NOT copy placeholder example words.

Job Description:
${truncatedDesc}

Return ONLY this JSON structure (replace every field with real content from the JD):
{
  "mustHave": {
    "skills": ["real skill from JD"],
    "experience": "experience required from JD",
    "education": "education from JD or Not specified",
    "other": []
  },
  "niceToHave": {
    "skills": [],
    "experience": "",
    "other": []
  },
  "responsibilities": ["real responsibility from JD"],
  "summary": "one sentence summary of the role"
}`;

      let result = null;
      if (this.activeProvider === "gemini") {
        result = await this.callGemini(prompt);
      } else if (this.activeProvider === "openai") {
        result = await this.callOpenAI(prompt);
      } else if (this.activeProvider === "openrouter") {
        result = await this.callOpenRouter(prompt);
      } else if (this.activeProvider === "deepseek") {
        result = await this.callDeepSeek(prompt);
      } else if (this.activeProvider === "qwen") {
        result = await this.callQwen(prompt);
      }

      if (this.isPlaceholderRequirements(result)) {
        console.warn(
          "AI Service: Requirements looked like prompt placeholders — discarding"
        );
        return null;
      }
      return result;
    } catch (error) {
      // Don't break the entire analysis if requirements extraction fails
      return null;
    }
  }

  /**
   * Detect when the model echoed the prompt template (skill1 / duty1 / X years).
   */
  isPlaceholderRequirements(req) {
    if (!req || typeof req !== "object") return true;
    const blob = JSON.stringify(req).toLowerCase();
    const markers = [
      '"skill1"',
      "skill1",
      "duty1",
      "duty2",
      "x years",
      "1 sentence summary",
      "bonus exp",
      '"req1"',
      "pref1",
    ];
    let hits = 0;
    for (let i = 0; i < markers.length; i++) {
      if (blob.includes(markers[i])) hits++;
    }
    return hits >= 2;
  }

  /**
   * Build the analysis prompt
   */
  buildAnalysisPrompt(jobData, userProfile) {
    // Truncate job description to save tokens
    const maxDescLength = 2000;
    const description = jobData.description || "Not provided";
    const truncatedDesc =
      description.length > maxDescLength
        ? description.substring(0, maxDescLength) + "..."
        : description;

    return `You are an expert ATS (Applicant Tracking System) analyzer. Analyze the compatibility between this job posting and candidate profile.

JOB POSTING:
Title: ${jobData.title || "Not specified"}
Company: ${jobData.company || "Not specified"}
Location: ${jobData.location || "Not specified"}
Job Type: ${jobData.jobType || "Not specified"}
Experience Required: ${jobData.experience || "Not specified"}
Description: ${truncatedDesc}

CANDIDATE PROFILE:
Name: ${userProfile.name || "Not specified"}
Headline: ${userProfile.headline || "Not specified"}
About: ${userProfile.about || "Not specified"}
Experience: ${userProfile.experienceSummary || "Not provided"}
Education: ${userProfile.education || "Not provided"}
Skills: ${userProfile.skills || "Not provided"}

CRITICAL INSTRUCTIONS:
- Respond ONLY with valid JSON
- NO trailing commas in arrays or objects
- NO explanatory text before or after the JSON
- Ensure all strings are properly quoted
- All arrays must end without trailing commas

Provide your analysis in this exact JSON structure:
{
  "overallScore": <number 0-100>,
  "breakdown": {
    "skillsMatch": {
      "score": <number 0-100>,
      "matched": [<array of matched skills>],
      "missing": [<array of missing key skills>],
      "explanation": "<brief explanation>"
    },
    "experienceLevel": {
      "score": <number 0-100>,
      "explanation": "<brief explanation>"
    },
    "education": {
      "score": <number 0-100>,
      "explanation": "<brief explanation>"
    },
    "keywords": {
      "score": <number 0-100>,
      "matched": [<array of matched keywords>],
      "explanation": "<brief explanation>"
    },
    "responsibilities": {
      "score": <number 0-100>,
      "explanation": "<brief explanation>"
    }
  },
  "strengths": [<array of 3-5 key strengths>],
  "improvements": [<array of 3-5 suggestions>],
  "summary": "<2-3 sentence overall assessment>"
}

Be specific, honest, and constructive. Focus on actual matches and gaps.`;
  }

  /**
   * Call Gemini API with retry logic and model fallback
   */
  async callGemini(prompt, retryCount = 0, fallbackModel = null) {
    const maxRetries = 2;

    try {
      // Use fallback model if provided, otherwise use configured model
      const model = fallbackModel || this.geminiModel;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      console.log(
        `AI Service: Using Gemini model: ${model} (attempt ${retryCount + 1}${
          fallbackModel ? " - FALLBACK" : ""
        })`
      );

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 4096,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
          }),
        });
      } catch (fetchError) {
        // Network error - retry once if first attempt
        if (retryCount === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.callGemini(prompt, retryCount + 1, fallbackModel);
        }
        // Silent fail - don't spam console with network errors
        throw new Error(
          "Network error. Please check your connection and try again."
        );
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API Error Response:", errorData);

        // Retry on 503 (overloaded) or 429 (rate limit)
        if (
          (response.status === 503 || response.status === 429) &&
          retryCount < maxRetries
        ) {
          const waitTime = (retryCount + 1) * 2000; // 2s, 4s
          console.log(`API overloaded, retrying in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          return this.callGemini(prompt, retryCount + 1, fallbackModel);
        }

        throw new Error(
          `Gemini API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();

      // Log full response for debugging
      console.log("Gemini API response:", JSON.stringify(data, null, 2));

      if (!data.candidates || !data.candidates[0]) {
        console.error("Invalid Gemini response - no candidates:", data);

        // Check for prompt feedback (safety/policy issues)
        if (data.promptFeedback) {
          const feedback = data.promptFeedback;
          console.error("Prompt feedback:", feedback);
          throw new Error(
            `Gemini blocked the request: ${
              feedback.blockReason || "Safety filter triggered"
            }`
          );
        }

        throw new Error(
          "Invalid response from Gemini API - no candidates returned"
        );
      }

      const candidate = data.candidates[0];

      // Log candidate details for debugging
      console.log("Candidate finishReason:", candidate.finishReason);
      console.log("Candidate has content:", !!candidate.content);
      if (candidate.content) {
        console.log("Content has parts:", !!candidate.content.parts);
        if (candidate.content.parts) {
          console.log("Parts length:", candidate.content.parts.length);
        }
      }

      // Check finish reason FIRST before accessing content
      if (candidate.finishReason) {
        switch (candidate.finishReason) {
          case "SAFETY":
            console.error("Content blocked - SAFETY:", candidate.safetyRatings);
            throw new Error(
              "Gemini blocked this request due to safety filters. The job description may contain flagged content."
            );

          case "RECITATION":
            console.error("Content blocked - RECITATION");
            throw new Error(
              "Gemini blocked this request due to potential copyright content."
            );

          case "MAX_TOKENS":
            // Suppress warning - handled automatically with retry
            // Retry with fallback model if this is the first attempt
            if (retryCount === 0 && !fallbackModel) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              return this.callGemini(
                prompt,
                retryCount + 1,
                "gemini-2.0-flash"
              );
            }
            // If already using fallback, throw error
            throw new Error(
              "Response too large for token limit. Try using gemini-2.5-pro in Settings for complex jobs."
            );

          case "STOP":
            // Normal completion - continue
            break;

          default:
            console.warn("Unexpected finishReason:", candidate.finishReason);
        }
      }

      // Now check content structure with detailed logging
      if (!candidate.content || typeof candidate.content !== "object") {
        console.error("No content in candidate:", JSON.stringify(candidate));

        // Check if it's actually blocked
        if (
          candidate.finishReason === "SAFETY" ||
          candidate.finishReason === "RECITATION"
        ) {
          throw new Error(
            "Content blocked by Gemini safety filters. Try a different job."
          );
        }

        throw new Error(
          "Gemini API error: Empty or invalid response. API may be experiencing issues."
        );
      }

      // Check if parts property exists at all
      if (!candidate.content.hasOwnProperty("parts")) {
        console.error(
          "Content missing parts property:",
          JSON.stringify(candidate.content)
        );

        // Try fallback models if this is the first attempt
        if (retryCount === 0 && !fallbackModel) {
          console.log("Trying fallback model: gemini-2.0-flash (stable)");
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause
          return this.callGemini(prompt, retryCount + 1, "gemini-2.0-flash");
        }

        throw new Error(
          "Gemini API returned incomplete response. Please try again or switch to OpenAI in Settings."
        );
      }
      if (!candidate.content.parts || !Array.isArray(candidate.content.parts)) {
        console.error(
          "Parts is not an array:",
          JSON.stringify(candidate.content.parts)
        );

        // Try fallback model if this is the first attempt
        if (retryCount === 0 && !fallbackModel) {
          console.log("Trying fallback model: gemini-2.0-flash (stable)");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.callGemini(prompt, retryCount + 1, "gemini-2.0-flash");
        }

        throw new Error(
          "Gemini API returned invalid response format. Try switching to OpenAI in Settings."
        );
      }
      if (candidate.content.parts.length === 0) {
        console.error("Parts array is empty");

        // Try fallback model if this is the first attempt
        if (retryCount === 0 && !fallbackModel) {
          console.log("Trying fallback model: gemini-2.0-flash (stable)");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.callGemini(prompt, retryCount + 1, "gemini-2.0-flash");
        }

        throw new Error(
          "Gemini returned empty response. Try switching to OpenAI in Settings."
        );
      }
      const firstPart = candidate.content.parts[0];
      if (!firstPart || typeof firstPart !== "object") {
        console.error("First part is invalid:", firstPart);
        throw new Error("Gemini API returned invalid response format.");
      }

      if (!firstPart.text || typeof firstPart.text !== "string") {
        console.error("First part has no text:", firstPart);
        throw new Error(
          "Gemini API returned no text. Please try again or reduce the job description length."
        );
      }

      const text = firstPart.text;
      console.log("Gemini raw response length:", text.length);

      if (!text || text.trim().length === 0) {
        console.error("Gemini returned empty text");
        throw new Error("Gemini API returned empty response");
      }

      // Track usage
      await this.trackUsage("gemini", prompt, text);

      // Extract and clean JSON from response - ROBUST METHOD
      return this.parseAIJson(text);
    } catch (error) {
      // Only log critical errors (not network/retry handled ones)
      if (
        error.message.includes("Safety filters") ||
        error.message.includes("blocked")
      ) {
        console.error("Gemini API Error:", error);
      }
      throw error;
    }
  }

  /**
   * Robust JSON parser for AI responses
   */
  parseAIJson(text) {
    // Try to extract JSON from markdown code blocks or plain text
    let jsonStr = text;

    // Remove markdown code blocks if present
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1];
    } else {
      // Try to find JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
    }

    try {
      // Aggressive JSON cleaning
      jsonStr = jsonStr
        // Remove trailing commas before closing brackets/braces
        .replace(/,(\s*[}\]])/g, "$1")
        // Remove comments (// and /* */)
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        // Fix missing commas between array elements (common issue)
        .replace(/("\s*)\n\s*"/g, '",\n"')
        // Fix missing commas between object properties
        .replace(/("\s*)\n\s*"([^"]+)":/g, '",\n"$2":')
        // Remove any trailing commas that were missed
        .replace(/,+(\s*[}\]])/g, "$1")
        // Clean up whitespace
        .trim();

      // First attempt - direct parse
      return JSON.parse(jsonStr);
    } catch (firstError) {
      console.warn("First parse attempt failed:", firstError.message);

      try {
        // Second attempt - try to fix truncated JSON
        // If JSON is incomplete, try to close it properly
        let fixed = jsonStr;
        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;

        // Add missing closing brackets
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          fixed += "]";
        }
        // Add missing closing braces
        for (let i = 0; i < openBraces - closeBraces; i++) {
          fixed += "}";
        }

        // Remove any trailing commas again after fixes
        fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

        return JSON.parse(fixed);
      } catch (secondError) {
        console.error("JSON Parse Error:", secondError);
        console.error("Attempted to parse:", jsonStr.substring(0, 500));
        throw new Error(
          `Failed to parse AI response as JSON: ${secondError.message}`
        );
      }
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(prompt) {
    try {
      console.log(`AI Service: Using OpenAI model: ${this.openaiModel}`);
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.openaiModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert ATS analyzer. Always respond with valid JSON only. NO trailing commas.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `OpenAI API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;

      // Track usage
      await this.trackUsage("openai", prompt, text);

      // Use robust JSON parser
      return this.parseAIJson(text);
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw error;
    }
  }

  /**
   * Call OpenRouter API with automatic fallback to free model
   */
  async callOpenRouter(prompt, retryCount = 0) {
    const maxRetries = 1; // One retry with fallback model
    const fallbackModel = "meta-llama/llama-3.1-8b-instruct"; // Free fallback

    try {
      const model = retryCount === 0 ? this.openrouterModel : fallbackModel;
      console.log(
        `AI Service: Using OpenRouter model: ${model}${
          retryCount > 0 ? " (FALLBACK)" : ""
        }`
      );

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://linkedin.com",
            "X-Title": "LinkedIn ATS Analyzer",
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert ATS analyzer. Always respond with valid JSON only. NO trailing commas.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenRouter API Error Response:", errorData);

        // Retry with fallback model if primary fails and haven't retried yet
        if (retryCount < maxRetries && model !== fallbackModel) {
          console.log(
            `Primary model failed, trying fallback: ${fallbackModel}`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Brief pause
          return this.callOpenRouter(prompt, retryCount + 1);
        }

        throw new Error(
          `OpenRouter API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();

      // Validate response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid OpenRouter response structure:", data);

        // Retry with fallback if this is first attempt
        if (retryCount < maxRetries) {
          console.log("Invalid response, trying fallback model");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.callOpenRouter(prompt, retryCount + 1);
        }

        throw new Error("Invalid response structure from OpenRouter API");
      }

      const text = data.choices[0].message.content;

      if (!text || text.trim().length === 0) {
        console.error("OpenRouter returned empty response");

        // Retry with fallback if this is first attempt
        if (retryCount < maxRetries) {
          console.log("Empty response, trying fallback model");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return this.callOpenRouter(prompt, retryCount + 1);
        }

        throw new Error("OpenRouter API returned empty response");
      }

      // Track usage
      await this.trackUsage("openrouter", prompt, text);

      // Use robust JSON parser
      return this.parseAIJson(text);
    } catch (error) {
      // If this was already a fallback attempt, don't retry again
      if (retryCount >= maxRetries) {
        console.error("OpenRouter API Error (after fallback):", error);
        throw error;
      }

      // For network errors or unexpected failures, try fallback
      if (
        error.message.includes("fetch") ||
        error.message.includes("Network")
      ) {
        console.log("Network error, trying fallback model");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.callOpenRouter(prompt, retryCount + 1);
      }

      console.error("OpenRouter API Error:", error);
      throw error;
    }
  }

  /**
   * Call DeepSeek OpenAI-compatible API (JSON)
   */
  async callDeepSeek(prompt) {
    try {
      console.log(`AI Service: Using DeepSeek model: ${this.deepseekModel}`);
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.deepseekModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert ATS analyzer. Always respond with valid JSON only. NO trailing commas.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `DeepSeek API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      await this.trackUsage("deepseek", prompt, text);
      return this.parseAIJson(text);
    } catch (error) {
      console.error("DeepSeek API Error:", error);
      throw error;
    }
  }

  /**
   * Call Qwen (DashScope intl) OpenAI-compatible API (JSON)
   */
  async callQwen(prompt) {
    try {
      console.log(`AI Service: Using Qwen model: ${this.qwenModel}`);
      const response = await fetch(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.qwenModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert ATS analyzer. Always respond with valid JSON only. NO trailing commas.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.5,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Qwen API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      await this.trackUsage("qwen", prompt, text);
      return this.parseAIJson(text);
    } catch (error) {
      console.error("Qwen API Error:", error);
      throw error;
    }
  }

  /**
   * Analyze LinkedIn profile for compatibility and insights
   */
  async analyzeProfile(prompt) {
    if (!this.activeProvider || !this.apiKey) {
      throw new Error(
        "AI service not configured. Please add your API key in settings."
      );
    }

    try {
      if (this.activeProvider === "gemini") {
        return await this.callGeminiText(prompt);
      } else if (this.activeProvider === "openai") {
        return await this.callOpenAIText(prompt);
      } else if (this.activeProvider === "openrouter") {
        return await this.callOpenRouterText(prompt);
      } else if (this.activeProvider === "deepseek") {
        return await this.callDeepSeekText(prompt);
      } else if (this.activeProvider === "qwen") {
        return await this.callQwenText(prompt);
      }
    } catch (error) {
      console.error("AI Profile Analysis Error:", error);
      throw error;
    }
  }

  /**
   * Call Gemini API for text response (not JSON)
   */
  async callGeminiText(prompt) {
    try {
      const model = this.geminiModel;
      console.log(`AI Service: Using Gemini model: ${model}`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 4096,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE",
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Gemini API Error:", errorData);
        throw new Error(
          `Gemini API error: ${response.status} - ${
            errorData.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();
      console.log("Gemini text response:", JSON.stringify(data, null, 2));

      if (!data.candidates || !data.candidates[0]) {
        console.error("Invalid Gemini response:", data);

        if (data.promptFeedback) {
          throw new Error(
            `Gemini blocked the request: ${
              data.promptFeedback.blockReason || "Safety filter"
            }`
          );
        }

        throw new Error("Invalid response from Gemini API");
      }

      const candidate = data.candidates[0];

      if (
        candidate.finishReason === "SAFETY" ||
        candidate.finishReason === "RECITATION"
      ) {
        console.error("Content blocked:", candidate);
        throw new Error(
          `Gemini blocked the response: ${candidate.finishReason}`
        );
      }

      if (
        !candidate.content ||
        !candidate.content.parts ||
        !candidate.content.parts[0]
      ) {
        console.error("Invalid response structure:", candidate);
        throw new Error("Invalid response structure from Gemini API");
      }

      const text = candidate.content.parts[0].text;

      if (!text || text.trim().length === 0) {
        throw new Error("Gemini API returned empty response");
      }

      // Track usage
      await this.trackUsage("gemini", prompt, text);

      return text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  /**
   * Call OpenAI API for text response
   */
  async callOpenAIText(prompt) {
    try {
      console.log(`AI Service: Using OpenAI model: ${this.openaiModel}`);
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.openaiModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert at analyzing LinkedIn profiles and providing professional insights about compatibility and connection potential.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `OpenAI API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;

      // Track usage
      await this.trackUsage("openai", prompt, text);

      return text;
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw error;
    }
  }

  /**
   * Call OpenRouter API for text response (not JSON)
   */
  async callOpenRouterText(prompt) {
    try {
      console.log(
        `AI Service: Using OpenRouter model: ${this.openrouterModel}`
      );
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://linkedin.com",
            "X-Title": "LinkedIn ATS Analyzer",
          },
          body: JSON.stringify({
            model: this.openrouterModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert at analyzing LinkedIn profiles and providing professional insights about compatibility and connection potential.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("OpenRouter API Error Response:", error);
        throw new Error(
          `OpenRouter API error: ${response.status} - ${
            error.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();

      // Validate response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error("Invalid OpenRouter response:", data);
        throw new Error("Invalid response structure from OpenRouter API");
      }

      const text = data.choices[0].message.content;

      if (!text || text.trim().length === 0) {
        throw new Error("OpenRouter API returned empty response");
      }

      // Track usage
      await this.trackUsage("openrouter", prompt, text);

      return text;
    } catch (error) {
      console.error("OpenRouter API Error:", error);
      throw error;
    }
  }

  /**
   * Call DeepSeek for text response (not JSON)
   */
  async callDeepSeekText(prompt) {
    try {
      console.log(`AI Service: Using DeepSeek model: ${this.deepseekModel}`);
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.deepseekModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert at analyzing LinkedIn profiles and providing professional insights about compatibility and connection potential.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `DeepSeek API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      await this.trackUsage("deepseek", prompt, text);
      return text;
    } catch (error) {
      console.error("DeepSeek API Error:", error);
      throw error;
    }
  }

  /**
   * Call Qwen for text response (not JSON)
   */
  async callQwenText(prompt) {
    try {
      console.log(`AI Service: Using Qwen model: ${this.qwenModel}`);
      const response = await fetch(
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.qwenModel,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert at analyzing LinkedIn profiles and providing professional insights about compatibility and connection potential.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Qwen API error: ${error.error?.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices[0].message.content;
      await this.trackUsage("qwen", prompt, text);
      return text;
    } catch (error) {
      console.error("Qwen API Error:", error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    if (!this.activeProvider || !this.apiKey) {
      return { success: false, message: "No API key configured" };
    }

    try {
      const testPrompt = 'Respond with: {"status": "working"}';

      if (this.activeProvider === "gemini") {
        await this.callGemini(testPrompt);
      } else if (this.activeProvider === "openai") {
        await this.callOpenAI(testPrompt);
      } else if (this.activeProvider === "openrouter") {
        await this.callOpenRouter(testPrompt);
      } else if (this.activeProvider === "deepseek") {
        await this.callDeepSeek(testPrompt);
      } else if (this.activeProvider === "qwen") {
        await this.callQwen(testPrompt);
      }

      return { success: true, message: "API connection successful" };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Track API usage
   */
  async trackUsage(provider, prompt, response) {
    try {
      const storageKey = `api_usage_${provider}`;
      const result = await chrome.storage.local.get([storageKey]);

      const usage = result[storageKey] || { requests: 0, tokens: 0 };

      // Increment request count
      usage.requests++;

      // Estimate tokens (rough approximation: ~4 chars per token)
      const estimatedTokens = Math.ceil((prompt.length + response.length) / 4);
      usage.tokens += estimatedTokens;

      // Save updated usage
      await chrome.storage.local.set({ [storageKey]: usage });
    } catch (error) {
      console.error("Error tracking usage:", error);
      // Don't throw - usage tracking shouldn't break API calls
    }
  }
}

// Export for use in content script
if (typeof module !== "undefined" && module.exports) {
  module.exports = AIService;
}

// Make available globally for Casper
window.AIService = AIService;
console.log("AIService: Module loaded and exported to window");
