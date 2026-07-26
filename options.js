/**
 * Options Page Script
 * Handles API key storage and management
 */

// Configure PDF.js worker immediately when script loads
if (typeof pdfjsLib !== "undefined") {
  // Extension pages must use chrome.runtime.getURL so the worker resolves correctly
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
    "lib/pdf.worker.min.js"
  );
}

// Store actual API keys in memory (not masked)
const actualKeys = {
  gemini: null,
  openai: null,
  openrouter: null,
  deepseek: null,
  qwen: null,
};

const PROVIDER_LABELS = {
  gemini: "Gemini",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
  qwen: "Qwen",
};

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider;
}

/**
 * Load saved API keys and active provider
 */
async function loadSavedSettings() {
  try {
    const result = await chrome.storage.local.get([
      "gemini_api_key",
      "openai_api_key",
      "openrouter_api_key",
      "deepseek_api_key",
      "qwen_api_key",
      "active_provider",
      "gemini_model",
      "openai_model",
      "openrouter_model",
      "deepseek_model",
      "qwen_model",
    ]);

    // Update Gemini status
    if (result.gemini_api_key) {
      actualKeys.gemini = result.gemini_api_key;
      updateStatus("gemini", true);
      const input = document.getElementById("input-gemini");
      input.value = maskApiKey(result.gemini_api_key);
      input.dataset.hasSavedKey = "true";
    }

    // Load Gemini model selection with migration for old model names
    let geminiModel = result.gemini_model;

    // Migrate old model names to new ones
    const modelMigration = {
      "gemini-1.5-flash": "gemini-2.5-flash",
      // "gemini-1.5-pro" - Keep as is, it's stable and available in v1 API
      "gemini-2.0-flash-exp": "gemini-2.0-flash",
      "gemini-pro": "gemini-2.5-flash", // Old deprecated model
    };

    if (geminiModel && modelMigration[geminiModel]) {
      geminiModel = modelMigration[geminiModel];
      // Save the migrated model name
      await chrome.storage.local.set({ gemini_model: geminiModel });
      console.log(
        `Migrated Gemini model from ${result.gemini_model} to ${geminiModel}`
      );
    }

    if (geminiModel) {
      document.getElementById("gemini-model-select").value = geminiModel;
    }

    // Update OpenAI status
    if (result.openai_api_key) {
      actualKeys.openai = result.openai_api_key;
      updateStatus("openai", true);
      const input = document.getElementById("input-openai");
      input.value = maskApiKey(result.openai_api_key);
      input.dataset.hasSavedKey = "true";
    }

    // Load OpenAI model selection
    if (result.openai_model) {
      document.getElementById("openai-model-select").value =
        result.openai_model;
    }

    // Update OpenRouter status
    if (result.openrouter_api_key) {
      actualKeys.openrouter = result.openrouter_api_key;
      updateStatus("openrouter", true);
      const input = document.getElementById("input-openrouter");
      input.value = maskApiKey(result.openrouter_api_key);
      input.dataset.hasSavedKey = "true";
    }

    // Load OpenRouter model selection
    if (result.openrouter_model) {
      document.getElementById("openrouter-model-select").value =
        result.openrouter_model;
    }

    // DeepSeek
    if (result.deepseek_api_key) {
      actualKeys.deepseek = result.deepseek_api_key;
      updateStatus("deepseek", true);
      const input = document.getElementById("input-deepseek");
      if (input) {
        input.value = maskApiKey(result.deepseek_api_key);
        input.dataset.hasSavedKey = "true";
      }
    }
    if (result.deepseek_model) {
      const sel = document.getElementById("deepseek-model-select");
      if (sel) sel.value = result.deepseek_model;
    }

    // Qwen
    if (result.qwen_api_key) {
      actualKeys.qwen = result.qwen_api_key;
      updateStatus("qwen", true);
      const input = document.getElementById("input-qwen");
      if (input) {
        input.value = maskApiKey(result.qwen_api_key);
        input.dataset.hasSavedKey = "true";
      }
    }
    if (result.qwen_model) {
      const sel = document.getElementById("qwen-model-select");
      if (sel) sel.value = result.qwen_model;
    }

    // Set active provider
    if (result.active_provider) {
      const radio = document.getElementById(`radio-${result.active_provider}`);
      const option = document.querySelector(
        `[data-provider="${result.active_provider}"]`
      );
      if (radio) radio.checked = true;
      if (option) option.classList.add("active");
    }
  } catch (error) {
    console.error("Error loading settings:", error);
    showError("Failed to load saved settings");
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Radio button changes
  document.querySelectorAll(".api-radio").forEach((radio) => {
    radio.addEventListener("change", (e) => {
      // Remove active class from all
      document
        .querySelectorAll(".api-option")
        .forEach((opt) => opt.classList.remove("active"));
      // Add to selected
      e.target.closest(".api-option").classList.add("active");
      // Save active provider
      saveActiveProvider(e.target.value);
    });
  });

  // Input event to detect when user starts typing (clear the saved key flag)
  document.querySelectorAll(".api-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const provider = input.id.replace("input-", "");
      // If user is typing, they're entering a new key
      if (e.target.dataset.hasSavedKey === "true") {
        // Clear the saved key when user starts typing
        e.target.dataset.hasSavedKey = "false";
        actualKeys[provider] = null;
      }
    });

    // Enter key on inputs
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const provider = input.id.replace("input-", "");
        saveApiKey(provider);
      }
    });
  });

  // Button click handlers (using data attributes instead of inline onclick)
  document.querySelectorAll(".btn, .clear-usage-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const provider = e.target.dataset.provider;
      const action = e.target.dataset.action;

      if (action === "save") {
        saveApiKey(provider);
      } else if (action === "clear") {
        clearApiKey(provider);
      } else if (action === "clear-usage") {
        clearUsageStats(provider);
      } else if (action === "test-compat") {
        testCompatibleConnection(provider);
      }
    });
  });

  // Model selection handlers
  document.querySelectorAll(".model-select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const provider = e.target.dataset.provider;
      const model = e.target.value;
      saveModelSelection(provider, model);
    });
  });

  // CV Upload button handler
  const uploadBtn = document.getElementById("uploadCVBtn");
  if (uploadBtn) {
    uploadBtn.addEventListener("click", handleCVUpload);
  }

  // Cache management handlers
  const cacheEnabled = document.getElementById("cacheEnabled");
  const maxCacheSize = document.getElementById("maxCacheSize");
  const autoCleanupDays = document.getElementById("autoCleanupDays");
  const refreshCacheStats = document.getElementById("refreshCacheStats");
  const clearAllCache = document.getElementById("clearAllCache");

  if (cacheEnabled) {
    cacheEnabled.addEventListener("change", saveCacheSettings);
  }
  if (maxCacheSize) {
    maxCacheSize.addEventListener("input", (e) => {
      document.getElementById("maxCacheSizeValue").textContent = e.target.value;
    });
    maxCacheSize.addEventListener("change", saveCacheSettings);
  }
  if (autoCleanupDays) {
    autoCleanupDays.addEventListener("input", (e) => {
      document.getElementById("autoCleanupDaysValue").textContent =
        e.target.value;
    });
    autoCleanupDays.addEventListener("change", saveCacheSettings);
  }
  if (refreshCacheStats) {
    refreshCacheStats.addEventListener("click", loadCacheStats);
  }
  if (clearAllCache) {
    clearAllCache.addEventListener("click", handleClearAllCache);
  }

  // Load cache settings and stats
  loadCacheSettings();
  loadCacheStats();

  // Load and display usage stats
  loadUsageStats();

  // OpenRouter test connection button
  const testOpenRouterBtn = document.getElementById("testOpenRouterBtn");
  if (testOpenRouterBtn) {
    testOpenRouterBtn.addEventListener("click", testOpenRouterConnection);
  }
}

/**
 * Save model selection for a provider
 */
async function saveModelSelection(provider, model) {
  try {
    const storageKey = `${provider}_model`;
    await chrome.storage.local.set({ [storageKey]: model });
    showSuccess(`${providerLabel(provider)} model updated to ${model}`);
    console.log(`Model selection saved: ${provider} -> ${model}`);
  } catch (error) {
    console.error("Error saving model selection:", error);
    showError("Failed to save model selection");
  }
}

/**
 * Save API key for a provider
 */
async function saveApiKey(provider) {
  const input = document.getElementById(`input-${provider}`);
  let apiKey = input.value.trim();

  // If input has a saved key and user hasn't modified it, use the actual key from memory
  if (input.dataset.hasSavedKey === "true" && actualKeys[provider]) {
    apiKey = actualKeys[provider];
    console.log(`Using stored ${provider} key (not the masked display)`);
  }

  if (!apiKey) {
    showError("Please enter an API key");
    input.classList.add("error");
    return;
  }

  // Don't validate if it's a masked key (user didn't change it)
  if (apiKey.includes("•")) {
    showSuccess(`${providerLabel(provider)} API key already saved!`);
    return;
  }

  // Validate API key format
  if (!validateApiKey(provider, apiKey)) {
    showError(`Invalid ${providerLabel(provider)} API key format`);
    input.classList.add("error");
    return;
  }

  input.classList.remove("error");

  try {
    // Save to storage
    const storageKey = `${provider}_api_key`;
    await chrome.storage.local.set({ [storageKey]: apiKey });

    // Store actual key in memory
    actualKeys[provider] = apiKey;

    // Update status
    updateStatus(provider, true);

    // Set as active provider if none selected
    const result = await chrome.storage.local.get(["active_provider"]);
    if (!result.active_provider) {
      document.getElementById(`radio-${provider}`).checked = true;
      await saveActiveProvider(provider);
    }

    // Mask the input and mark as having saved key
    input.value = maskApiKey(apiKey);
    input.dataset.hasSavedKey = "true";

    showSuccess(`${providerLabel(provider)} API key saved successfully!`);
  } catch (error) {
    console.error("Error saving API key:", error);
    showError("Failed to save API key");
  }
}

/**
 * Clear API key for a provider
 */
async function clearApiKey(provider) {
  if (
    !confirm(
      `Are you sure you want to remove your ${providerLabel(provider)} API key?`
    )
  ) {
    return;
  }

  try {
    const storageKey = `${provider}_api_key`;
    await chrome.storage.local.remove(storageKey);

    // Clear actual key from memory
    actualKeys[provider] = null;

    // Clear input
    const input = document.getElementById(`input-${provider}`);
    input.value = "";
    input.dataset.hasSavedKey = "false";

    // Update status
    updateStatus(provider, false);

    // If this was the active provider, clear it
    const result = await chrome.storage.local.get(["active_provider"]);
    if (result.active_provider === provider) {
      await chrome.storage.local.remove("active_provider");
      document.getElementById(`radio-${provider}`).checked = false;
      document
        .querySelector(`[data-provider="${provider}"]`)
        .classList.remove("active");
    }

    showSuccess(`${providerLabel(provider)} API key removed`);
  } catch (error) {
    console.error("Error clearing API key:", error);
    showError("Failed to clear API key");
  }
}

/**
 * Save active provider
 */
async function saveActiveProvider(provider) {
  try {
    await chrome.storage.local.set({ active_provider: provider });
    console.log("Active provider set to:", provider);
  } catch (error) {
    console.error("Error saving active provider:", error);
  }
}

/**
 * Validate API key format
 */
function validateApiKey(provider, key) {
  if (provider === "gemini") {
    // Gemini keys start with "AIza"
    return key.startsWith("AIza") && key.length > 30;
  } else if (provider === "openai") {
    // OpenAI keys start with "sk-"
    return key.startsWith("sk-") && key.length > 40;
  } else if (provider === "openrouter") {
    // OpenRouter keys start with "sk-or-v1-"
    return key.startsWith("sk-or-v1-") && key.length > 40;
  } else if (provider === "deepseek") {
    // DeepSeek keys typically start with sk-
    return key.startsWith("sk-") && key.length > 20;
  } else if (provider === "qwen") {
    // DashScope keys typically start with sk-
    return key.startsWith("sk-") && key.length > 20;
  }
  return false;
}

/**
 * Mask API key for display
 */
function maskApiKey(key) {
  if (key.length <= 12) return key;
  return key.substring(0, 8) + "•".repeat(20) + key.substring(key.length - 4);
}

/**
 * Update provider status
 */
function updateStatus(provider, isConfigured) {
  const statusEl = document.getElementById(`status-${provider}`);
  if (!statusEl) return;
  if (isConfigured) {
    statusEl.textContent = "Configured";
    statusEl.classList.remove("not-configured");
    statusEl.classList.add("configured");
  } else {
    statusEl.textContent = "Not Configured";
    statusEl.classList.remove("configured");
    statusEl.classList.add("not-configured");
  }
}

/**
 * Toast Notification System
 * Creates toast notifications that slide in from bottom-right
 */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  // Set icon based on type
  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-content">${message}</span>
    <button class="toast-close" aria-label="Close">×</button>
  `;

  // Add to container
  container.appendChild(toast);

  // Close button functionality
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    removeToast(toast);
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 5000);
}

/**
 * Remove toast with animation
 */
function removeToast(toast) {
  if (!toast || toast.classList.contains("removing")) return;

  toast.classList.add("removing");
  setTimeout(() => {
    toast.remove();
  }, 300); // Match animation duration
}

/**
 * Show success message (wrapper for backward compatibility)
 */
function showSuccess(message) {
  showToast(message, "success");
}

/**
 * Show error message (wrapper for backward compatibility)
 */
function showError(message) {
  showToast(message, "error");
}

/**
 * Test OpenRouter API connection
 */
async function testOpenRouterConnection() {
  const btn = document.getElementById("testOpenRouterBtn");
  const originalText = btn.textContent;

  try {
    // Disable button during test
    btn.disabled = true;
    btn.textContent = "🔄 Testing...";
    btn.style.opacity = "0.6";

    // Get OpenRouter API key
    const result = await chrome.storage.local.get([
      "openrouter_api_key",
      "openrouter_model",
    ]);

    if (!result.openrouter_api_key) {
      showError("Please save your OpenRouter API key first");
      return;
    }

    const model = result.openrouter_model || "google/gemini-2.5-flash";

    // Send test request to OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${result.openrouter_api_key}`,
          "HTTP-Referer": "https://linkedin.com",
          "X-Title": "LinkedIn ATS Analyzer",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: 'Respond with: {"status": "working"}',
            },
          ],
          max_tokens: 50,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API returned ${response.status}`
      );
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      showSuccess(`✅ OpenRouter API connection successful! Model: ${model}`);
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (error) {
    console.error("OpenRouter test failed:", error);
    showError(`❌ Connection failed: ${error.message}`);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = originalText;
    btn.style.opacity = "1";
  }
}

/**
 * Test DeepSeek / Qwen OpenAI-compatible connection
 */
async function testCompatibleConnection(provider) {
  const endpoints = {
    deepseek: {
      url: "https://api.deepseek.com/chat/completions",
      keyField: "deepseek_api_key",
      modelField: "deepseek_model",
      defaultModel: "deepseek-chat",
      btnId: "testDeepSeekBtn",
    },
    qwen: {
      url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
      keyField: "qwen_api_key",
      modelField: "qwen_model",
      defaultModel: "qwen-plus",
      btnId: "testQwenBtn",
    },
  };

  const cfg = endpoints[provider];
  if (!cfg) {
    showError("Unknown provider for connection test");
    return;
  }

  const btn = document.getElementById(cfg.btnId);
  const originalText = btn ? btn.textContent : "";

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Testing...";
      btn.style.opacity = "0.6";
    }

    const result = await chrome.storage.local.get([
      cfg.keyField,
      cfg.modelField,
    ]);
    const apiKey = result[cfg.keyField];
    if (!apiKey) {
      showError(`Please save your ${providerLabel(provider)} API key first`);
      return;
    }

    const model = result[cfg.modelField] || cfg.defaultModel;
    const response = await fetch(cfg.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: 'Respond with: {"status": "working"}',
          },
        ],
        max_tokens: 50,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `API returned ${response.status}`
      );
    }

    const data = await response.json();
    if (data.choices && data.choices[0] && data.choices[0].message) {
      showSuccess(
        `${providerLabel(provider)} API connection successful! Model: ${model}`
      );
    } else {
      throw new Error("Unexpected response format");
    }
  } catch (error) {
    console.error(`${provider} test failed:`, error);
    showError(`Connection failed: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
      btn.style.opacity = "1";
    }
  }
}

/**
 * Check and display profile status
 */
async function checkProfileStatus() {
  const statusDiv = document.getElementById("profileStatus");

  try {
    const result = await chrome.storage.local.get([
      "linkedin_user_profile",
      "profile_updated_at",
    ]);

    if (result.linkedin_user_profile && result.profile_updated_at) {
      const profile = result.linkedin_user_profile;
      const updatedAt = new Date(result.profile_updated_at);
      const age = Math.floor(
        (Date.now() - result.profile_updated_at) / (1000 * 60 * 60)
      );

      // Check completeness
      const hasName = profile.name && profile.name !== "Your Profile";
      const hasHeadline =
        profile.headline && profile.headline !== "Professional";
      const hasExperience =
        profile.experienceSummary &&
        !profile.experienceSummary.includes("Visit your profile");
      const hasSkills =
        profile.skills && !profile.skills.includes("Visit your profile");

      const completeness = [
        hasName,
        hasHeadline,
        hasExperience,
        hasSkills,
      ].filter(Boolean).length;
      const percentage = Math.round((completeness / 4) * 100);

      let statusHTML = `
        <p><strong>✓ Profile Data Found</strong></p>
        <p>Last updated: ${updatedAt.toLocaleString()} (${age}h ago)</p>
        <p>Completeness: ${percentage}% (${completeness}/4 sections)</p>
        <ul style="margin-top: 8px; padding-left: 20px;">
          <li>${hasName ? "✓" : "✗"} Name: ${profile.name}</li>
          <li>${hasHeadline ? "✓" : "✗"} Headline: ${profile.headline.substring(
        0,
        50
      )}...</li>
          <li>${hasExperience ? "✓" : "✗"} Experience ${
        hasExperience ? "captured" : "missing"
      }</li>
          <li>${hasSkills ? "✓" : "✗"} Skills ${
        hasSkills ? "captured" : "missing"
      }</li>
        </ul>
      `;

      if (percentage < 75) {
        statusHTML += `<p style="color: #dc2626; margin-top: 8px;">⚠️ Profile incomplete! Visit your LinkedIn profile and click "Update Profile" below.</p>`;
      }

      statusDiv.innerHTML = statusHTML;
    } else {
      statusDiv.innerHTML = `
        <p><strong>⚠️ No Profile Data Stored</strong></p>
        <p>To get accurate ATS analysis, you need to extract your LinkedIn profile data:</p>
        <ol style="margin-top: 8px; padding-left: 20px;">
          <li>Open your LinkedIn profile page (linkedin.com/in/your-profile)</li>
          <li>Click "Update Profile from LinkedIn" button below</li>
          <li>The extension will automatically extract your data</li>
        </ol>
      `;
    }
  } catch (error) {
    statusDiv.innerHTML = `<p style="color: #dc2626;">Error checking profile: ${error.message}</p>`;
  }
}

/**
 * Update profile from LinkedIn
 */
async function updateProfileFromLinkedIn() {
  const btn = document.getElementById("updateProfileBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Updating...";

  try {
    // Search for ANY LinkedIn tab (not just active tab)
    const allTabs = await chrome.tabs.query({});
    const linkedInTabs = allTabs.filter(
      (tab) => tab.url && tab.url.includes("linkedin.com/in/")
    );

    if (linkedInTabs.length === 0) {
      showError(
        "No LinkedIn profile tab found! Please open linkedin.com/in/your-profile in any tab."
      );
      return;
    }

    // Use the first LinkedIn profile tab found
    const linkedInTab = linkedInTabs[0];

    showToast("Found LinkedIn tab, extracting profile...", "info");

    // Inject content script if needed and extract profile
    const response = await chrome.tabs.sendMessage(linkedInTab.id, {
      action: "extractAndSaveProfile",
    });

    // Wait a bit for extraction
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Refresh status
    await checkProfileStatus();

    // Load extracted data into form fields immediately
    await loadProfileDataIntoForm();

    showSuccess("✓ Profile updated successfully from LinkedIn!");
  } catch (error) {
    console.error("Profile update error:", error);
    showError(
      `Could not update profile: ${error.message}. Make sure you're on your LinkedIn profile page and the extension is loaded.`
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 Update Profile from LinkedIn";
  }
}

/**
 * Clear stored profile
 */
async function clearStoredProfile() {
  if (!confirm("Are you sure you want to clear your stored profile data?")) {
    return;
  }

  try {
    await chrome.storage.local.remove([
      "linkedin_user_profile",
      "profile_updated_at",
    ]);
    await checkProfileStatus();
    showSuccess("Profile data cleared");
  } catch (error) {
    showError("Failed to clear profile: " + error.message);
  }
}

/**
 * Save manually entered profile data
 */
async function saveManualProfile() {
  const btn = document.getElementById("saveProfileTextBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Saving...";

  try {
    const profile = {
      name:
        document.getElementById("profileName").value.trim() || "Your Profile",
      headline:
        document.getElementById("profileHeadline").value.trim() ||
        "Professional",
      about:
        document.getElementById("profileAbout").value.trim() || "Not provided",
      experienceSummary:
        document.getElementById("profileExperience").value.trim() ||
        "Not provided",
      education:
        document.getElementById("profileEducation").value.trim() ||
        "Not provided",
      skills:
        document.getElementById("profileSkills").value.trim() || "Not provided",
    };

    // Validate at least name or headline is provided
    if (
      profile.name === "Your Profile" &&
      profile.headline === "Professional"
    ) {
      showError("Please enter at least your name or headline");
      return;
    }

    await chrome.storage.local.set({
      linkedin_user_profile: profile,
      profile_updated_at: Date.now(),
    });

    await checkProfileStatus();
    showSuccess("✓ Profile data saved successfully!");
  } catch (error) {
    showError("Failed to save profile: " + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Save Profile Data";
  }
}

/**
 * Load existing profile data into form fields
 */
async function loadProfileDataIntoForm() {
  try {
    const result = await chrome.storage.local.get(["linkedin_user_profile"]);
    if (result.linkedin_user_profile) {
      const profile = result.linkedin_user_profile;

      // List of values to skip (placeholders/defaults)
      const skipValues = [
        "Your Profile",
        "Professional",
        "Not provided",
        "Unknown",
        "Click your profile to provide more details",
      ];

      // Helper to check if value is valid
      const isValidValue = (val) => {
        return val && !skipValues.includes(val) && val.trim().length > 0;
      };

      if (isValidValue(profile.name))
        document.getElementById("profileName").value = profile.name;
      if (isValidValue(profile.headline))
        document.getElementById("profileHeadline").value = profile.headline;
      if (isValidValue(profile.about))
        document.getElementById("profileAbout").value = profile.about;
      if (isValidValue(profile.experienceSummary))
        document.getElementById("profileExperience").value =
          profile.experienceSummary;
      if (isValidValue(profile.education))
        document.getElementById("profileEducation").value = profile.education;
      if (isValidValue(profile.skills))
        document.getElementById("profileSkills").value = profile.skills;
    }
  } catch (error) {
    console.error("Error loading profile data:", error);
  }
}

// Add profile button event listeners
document
  .getElementById("updateProfileBtn")
  ?.addEventListener("click", updateProfileFromLinkedIn);
document
  .getElementById("clearProfileBtn")
  ?.addEventListener("click", clearStoredProfile);
document
  .getElementById("saveProfileTextBtn")
  ?.addEventListener("click", saveManualProfile);

// Tab switching for profile methods
document.querySelectorAll(".profile-method-tab").forEach((tab) => {
  tab.addEventListener("click", (e) => {
    // Remove active from all tabs
    document.querySelectorAll(".profile-method-tab").forEach((t) => {
      t.classList.remove("active");
      t.style.background = "#e5e7eb";
      t.style.color = "#6b7280";
    });

    // Add active to clicked tab
    e.target.classList.add("active");
    e.target.style.background = "#10b981";
    e.target.style.color = "white";

    // Hide all methods
    document.querySelectorAll(".profile-method-content").forEach((content) => {
      content.style.display = "none";
    });

    // Show selected method
    const method = e.target.dataset.method;
    document.getElementById(`method-${method}`).style.display = "block";
  });
});

// Load existing profile data into form after status check
setTimeout(() => loadProfileDataIntoForm(), 500);

/**
 * Handle CV/Resume Upload
 */
async function handleCVUpload() {
  const fileInput = document.getElementById("cvUpload");
  const statusDiv = document.getElementById("uploadStatus");
  const statusContent = statusDiv.querySelector("div");

  if (!fileInput.files || fileInput.files.length === 0) {
    showUploadStatus("error", "Please select a file to upload");
    return;
  }

  const file = fileInput.files[0];

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showUploadStatus("error", "File too large. Maximum size is 5MB");
    return;
  }

  // Validate file type
  const validTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (!validTypes.includes(file.type)) {
    showUploadStatus(
      "error",
      "Invalid file type. Please upload PDF, DOC, DOCX, or TXT"
    );
    return;
  }

  try {
    let text = "";

    if (file.type === "text/plain") {
      // Read text file directly
      showUploadStatus("loading", "📄 Reading text file...");
      text = await file.text();
    } else {
      // For PDF/DOC files, extract text
      text = await extractTextFromDocument(file);
    }

    // Parse profile data from text using AI
    showUploadStatus(
      "loading",
      `${
        typeof CasperAvatar !== "undefined"
          ? CasperAvatar.icon(16)
          : ""
      } Analyzing and extracting profile data with Casper AI...`
    );
    const profileData = await parseProfileDataWithAI(text);

    if (profileData) {
      // Save to storage with timestamp
      await chrome.storage.local.set({
        linkedin_user_profile: profileData,
        profile_updated_at: Date.now(),
      });

      showUploadStatus(
        "success",
        "✅ Profile data extracted and saved successfully!"
      );

      // Populate form fields immediately with extracted data
      await loadProfileDataIntoForm();

      // Refresh profile status
      setTimeout(() => checkProfileStatus(), 1000);
    } else {
      showUploadStatus(
        "error",
        "Could not extract profile data. Please try manual entry."
      );
    }
  } catch (error) {
    console.error("CV Upload error:", error);
    showUploadStatus(
      "error",
      "❌ Failed to process document: " + error.message
    );
  }
}

/**
 * Extract text from PDF/DOC file
 * Uses client-side PDF.js library for PDF files (works with ANY AI provider!)
 * Uses Gemini API for DOC/DOCX files (requires Gemini key)
 */
async function extractTextFromDocument(file) {
  const result = await chrome.storage.local.get([
    "gemini_api_key",
    "active_provider",
  ]);
  const provider = result.active_provider || "gemini";

  // For PDF files - use PDF.js (client-side extraction, works with ALL providers!)
  if (file.type === "application/pdf") {
    try {
      showUploadStatus(
        "loading",
        "📄 Extracting text from PDF (client-side)..."
      );
      const text = await extractTextFromPDF(file);

      // Notify user about extraction method
      if (provider !== "gemini") {
        console.log(
          `PDF text extracted client-side, will be parsed using ${provider}`
        );
      }

      return text;
    } catch (error) {
      console.error("PDF extraction error:", error);
      throw new Error(
        `Failed to extract text from PDF: ${error.message}. Please try uploading a .txt file or paste your resume text instead.`
      );
    }
  }

  // For DOC/DOCX files - requires Gemini API (only provider with document vision)
  if (
    file.type === "application/msword" ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    if (!result.gemini_api_key) {
      throw new Error(
        `DOC/DOCX extraction requires Gemini API key (FREE at https://makersuite.google.com/app/apikey).
        
        Alternative: Save your DOC as PDF or TXT and upload that instead.`
      );
    }

    showUploadStatus("loading", "📄 Extracting text from DOC using Gemini...");
    return await extractTextWithGemini(file, result.gemini_api_key);
  }

  throw new Error("Unsupported file type");
}

/**
 * Extract text from PDF using PDF.js (client-side, works with ALL AI providers!)
 */
async function extractTextFromPDF(file) {
  // Check if PDF.js is loaded
  if (typeof pdfjsLib === "undefined") {
    throw new Error("PDF.js library not loaded");
  }

  try {

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    console.log(`PDF loaded: ${pdf.numPages} pages`);

    let fullText = "";

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items
      const pageText = textContent.items.map((item) => item.str).join(" ");

      fullText += pageText + "\n\n";
    }

    if (!fullText.trim()) {
      throw new Error("No text found in PDF. It might be an image-based PDF.");
    }

    console.log(`Extracted ${fullText.length} characters from PDF`);
    return fullText;
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw error;
  }
}

/**
 * Extract text using Gemini API (for DOC/DOCX files only)
 */
async function extractTextWithGemini(file, apiKey) {
  // Convert file to base64
  const reader = new FileReader();
  const base64 = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Extract all text content from this document. Return ONLY the text, no formatting or analysis.",
            },
            {
              inline_data: {
                mime_type: file.type,
                data: base64.split(",")[1], // Remove data:mime;base64, prefix
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Gemini API Error:", errorData);
    throw new Error(
      `API error: ${response.status} - ${
        errorData.error?.message || response.statusText
      }`
    );
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0]) {
    console.error("Invalid API response:", data);
    throw new Error("Invalid response from Gemini API");
  }

  if (
    !data.candidates[0].content ||
    !data.candidates[0].content.parts ||
    !data.candidates[0].content.parts[0]
  ) {
    console.error("Invalid response structure:", data.candidates[0]);
    throw new Error("Invalid response structure from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Parse profile data from text using AI (supports all providers)
 * This function DOES work with any provider since it's just text parsing, not PDF extraction
 */
async function parseProfileDataWithAI(text) {
  const result = await chrome.storage.local.get([
    "active_provider",
    "gemini_api_key",
    "gemini_model",
    "openai_api_key",
    "openai_model",
    "openrouter_api_key",
    "openrouter_model",
    "deepseek_api_key",
    "deepseek_model",
    "qwen_api_key",
    "qwen_model",
  ]);

  const provider = result.active_provider || "gemini";

  const prompt = `Parse this resume/CV text and extract structured profile data. Return ONLY valid JSON with NO trailing commas, NO markdown code blocks, NO extra text.

CRITICAL: Match this EXACT format:
{
  "name": "Full Name from resume",
  "headline": "Current job title/professional headline",
  "location": "City, Country if found",
  "about": "Professional summary/about section",
  "experienceSummary": "Summary of work experience as a paragraph",
  "education": "Education details as a single string",
  "skills": "Comma-separated list of skills"
}

Resume text:
${text}

Remember: 
- NO trailing commas in objects or arrays
- Return ONLY the JSON object, nothing else
- NO markdown formatting like \`\`\`json
- Use the exact field names shown above`;

  let responseText;

  if (provider === "gemini") {
    if (!result.gemini_api_key) {
      throw new Error("Gemini API key not configured");
    }

    const model = result.gemini_model || "gemini-2.0-flash-exp";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${result.gemini_api_key}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API Error:", errorData);
      throw new Error(
        `API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    if (
      !data.candidates ||
      !data.candidates[0] ||
      !data.candidates[0].content ||
      !data.candidates[0].content.parts ||
      !data.candidates[0].content.parts[0]
    ) {
      console.error("Invalid Gemini response:", data);
      throw new Error("Invalid response from Gemini API");
    }

    responseText = data.candidates[0].content.parts[0].text;
  } else if (provider === "openai") {
    if (!result.openai_api_key) {
      throw new Error("OpenAI API key not configured");
    }

    const model = result.openai_model || "gpt-4o-mini";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${result.openai_api_key}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API Error:", errorData);
      throw new Error(
        `API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid OpenAI response:", data);
      throw new Error("Invalid response from OpenAI API");
    }

    responseText = data.choices[0].message.content;
  } else if (provider === "openrouter") {
    if (!result.openrouter_api_key) {
      throw new Error("OpenRouter API key not configured");
    }

    const model = result.openrouter_model || "meta-llama/llama-3.1-8b-instruct";

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${result.openrouter_api_key}`,
          "HTTP-Referer": "https://linkedin.com",
          "X-Title": "LinkedIn Resume Parser",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API Error:", errorData);
      throw new Error(
        `API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("Invalid OpenRouter response:", data);
      throw new Error("Invalid response from OpenRouter API");
    }

    responseText = data.choices[0].message.content;
  } else if (provider === "deepseek" || provider === "qwen") {
    const isDeepseek = provider === "deepseek";
    const apiKey = isDeepseek ? result.deepseek_api_key : result.qwen_api_key;
    if (!apiKey) {
      throw new Error(`${providerLabel(provider)} API key not configured`);
    }
    const model = isDeepseek
      ? result.deepseek_model || "deepseek-chat"
      : result.qwen_model || "qwen-plus";
    const url = isDeepseek
      ? "https://api.deepseek.com/chat/completions"
      : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`${providerLabel(provider)} API Error:`, errorData);
      throw new Error(
        `API error: ${response.status} - ${
          errorData.error?.message || response.statusText
        }`
      );
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error(`Invalid response from ${providerLabel(provider)} API`);
    }
    responseText = data.choices[0].message.content;
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  console.log("AI Response:", responseText);

  // Clean response text - remove markdown code blocks if present
  let cleanedText = responseText.trim();

  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  cleanedText = cleanedText
    .replace(/```(?:json)?\s*/g, "")
    .replace(/```\s*$/g, "");

  // Trim again after removing code blocks
  cleanedText = cleanedText.trim();

  console.log("Cleaned response:", cleanedText);

  // Extract JSON from response - support multiple patterns
  let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      let jsonStr = jsonMatch[0];

      // Remove trailing commas
      jsonStr = jsonStr.replace(/,\s*([\]}])/g, "$1");

      const parsed = JSON.parse(jsonStr);
      console.log("Parsed profile data:", parsed);

      // Map to expected format and add timestamp
      const profileData = {
        name: parsed.name || "Unknown",
        headline: parsed.headline || "Professional",
        location: parsed.location || "",
        about: parsed.about || "Click your profile to provide more details",
        experienceSummary:
          parsed.experienceSummary ||
          parsed.experience ||
          "Click your profile to provide more details",
        education:
          parsed.education || "Click your profile to provide more details",
        skills: parsed.skills || "Click your profile to provide more details",
        extractedAt: Date.now(),
      };

      console.log("Final profile data to save:", profileData);
      return profileData;
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Attempted to parse:", jsonMatch[0]);
      throw new Error(`Failed to parse profile data: ${parseError.message}`);
    }
  }

  throw new Error("No JSON found in AI response");
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Show upload status message
 */
function showUploadStatus(type, message) {
  const statusDiv = document.getElementById("uploadStatus");
  const statusContent = statusDiv.querySelector("div");

  statusDiv.style.display = "block";

  const colors = {
    loading: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
    error: { bg: "#fee2e2", border: "#dc2626", text: "#991b1b" },
  };

  const color = colors[type];
  statusContent.style.background = color.bg;
  statusContent.style.border = `2px solid ${color.border}`;
  statusContent.style.color = color.text;
  statusContent.style.display = "flex";
  statusContent.style.alignItems = "center";
  statusContent.style.gap = "8px";
  statusContent.innerHTML = message;
}

/**
 * Load and display usage statistics
 */
async function loadUsageStats() {
  try {
    const result = await chrome.storage.local.get([
      "api_usage_gemini",
      "api_usage_openai",
      "api_usage_openrouter",
      "api_usage_deepseek",
      "api_usage_qwen",
    ]);

    // Always display usage stats (even if 0)
    updateUsageDisplay(
      "gemini",
      result.api_usage_gemini || { requests: 0, tokens: 0 }
    );
    updateUsageDisplay(
      "openai",
      result.api_usage_openai || { requests: 0, tokens: 0 }
    );
    updateUsageDisplay(
      "openrouter",
      result.api_usage_openrouter || { requests: 0, tokens: 0 }
    );
    updateUsageDisplay(
      "deepseek",
      result.api_usage_deepseek || { requests: 0, tokens: 0 }
    );
    updateUsageDisplay(
      "qwen",
      result.api_usage_qwen || { requests: 0, tokens: 0 }
    );
  } catch (error) {
    console.error("Error loading usage stats:", error);
  }
}

/**
 * Update usage display for a provider
 */
function updateUsageDisplay(provider, usage) {
  const usageDiv = document.getElementById(`usage-${provider}`);
  const requestsSpan = document.getElementById(`usage-${provider}-requests`);
  const tokensSpan = document.getElementById(`usage-${provider}-tokens`);

  if (!usageDiv || !requestsSpan || !tokensSpan) return;

  // Always show usage stats section
  usageDiv.style.display = "block";

  if (usage) {
    requestsSpan.textContent = usage.requests || 0;
    tokensSpan.textContent = (usage.tokens || 0).toLocaleString();
  } else {
    requestsSpan.textContent = 0;
    tokensSpan.textContent = 0;
  }
}

/**
 * Clear usage statistics for a provider
 */
async function clearUsageStats(provider) {
  if (
    !confirm(
      `Clear all usage statistics for ${providerLabel(provider)}?`
    )
  ) {
    return;
  }

  try {
    const storageKey = `api_usage_${provider}`;
    await chrome.storage.local.remove(storageKey);

    // Update display
    updateUsageDisplay(provider, { requests: 0, tokens: 0 });

    showSuccess(`${providerLabel(provider)} usage statistics cleared!`);
  } catch (error) {
    console.error("Error clearing usage stats:", error);
    showError("Failed to clear usage statistics");
  }
}

/**
 * Load cache settings from storage
 */
async function loadCacheSettings() {
  try {
    const result = await chrome.storage.local.get(["cache_settings"]);
    const settings = result.cache_settings || {
      maxCacheSize: 50,
      autoCleanupDays: 15,
      enabled: true,
    };

    document.getElementById("cacheEnabled").checked = settings.enabled;
    document.getElementById("maxCacheSize").value = settings.maxCacheSize;
    document.getElementById("maxCacheSizeValue").textContent =
      settings.maxCacheSize;
    document.getElementById("autoCleanupDays").value = settings.autoCleanupDays;
    document.getElementById("autoCleanupDaysValue").textContent =
      settings.autoCleanupDays;
  } catch (error) {
    console.error("Error loading cache settings:", error);
  }
}

/**
 * Save cache settings to storage
 */
async function saveCacheSettings() {
  try {
    const settings = {
      enabled: document.getElementById("cacheEnabled").checked,
      maxCacheSize: parseInt(document.getElementById("maxCacheSize").value),
      autoCleanupDays: parseInt(
        document.getElementById("autoCleanupDays").value
      ),
    };

    await chrome.storage.local.set({ cache_settings: settings });
    showSuccess("Cache settings saved!");

    // Reload stats to reflect any changes
    await loadCacheStats();
  } catch (error) {
    console.error("Error saving cache settings:", error);
    showError("Failed to save cache settings");
  }
}

/**
 * Load and display cache statistics
 */
async function loadCacheStats() {
  try {
    const result = await chrome.storage.local.get(["ats_analysis_cache"]);
    const cache = result.ats_analysis_cache || {};
    const entries = Object.values(cache);

    const totalEntries = entries.length;
    const totalAccesses = entries.reduce(
      (sum, entry) => sum + (entry.accessCount || 1),
      0
    );
    const savedCalls = totalAccesses - totalEntries; // Subtract initial calls
    const estimatedSavings = (savedCalls * 0.001).toFixed(2);

    document.getElementById("cachedJobsCount").textContent = totalEntries;
    document.getElementById("savedApiCalls").textContent =
      savedCalls > 0 ? savedCalls : 0;
    document.getElementById(
      "estimatedSavings"
    ).textContent = `$${estimatedSavings}`;

    console.log("Cache stats loaded:", {
      totalEntries,
      totalAccesses,
      savedCalls,
      estimatedSavings,
    });
  } catch (error) {
    console.error("Error loading cache stats:", error);
    document.getElementById("cachedJobsCount").textContent = "Error";
    document.getElementById("savedApiCalls").textContent = "Error";
    document.getElementById("estimatedSavings").textContent = "Error";
  }
}

/**
 * Clear all cached ATS results
 */
async function handleClearAllCache() {
  if (
    !confirm("Clear all cached ATS analysis results? This cannot be undone.")
  ) {
    return;
  }

  try {
    await chrome.storage.local.remove("ats_analysis_cache");

    // Update display
    document.getElementById("cachedJobsCount").textContent = "0";
    document.getElementById("savedApiCalls").textContent = "0";
    document.getElementById("estimatedSavings").textContent = "$0.00";

    showSuccess("All cached results cleared successfully!");
    console.log("All cache cleared");
  } catch (error) {
    console.error("Error clearing cache:", error);
    showError("Failed to clear cache");
  }
}

/**
 * ═══════════════════════════════════════════════════════════
 * SAVED JOB SEARCHES
 * ═══════════════════════════════════════════════════════════
 */

// Load saved searches on page load
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.CCOptionsShell && typeof window.CCOptionsShell.build === "function") {
      window.CCOptionsShell.build();
    }
  } catch (e) {
    console.warn("Options shell build failed; using classic layout", e);
  }

  await loadSavedSettings();
  setupEventListeners();
  await checkProfileStatus();

  // Load saved searches and notifications
  await loadSavedSearches();
  setupSavedSearchesListeners();
  await loadNotificationSettings();
  setupNotificationListeners();

  // Load Casper settings
  await loadCasperSettings();
  setupCasperListeners();

  try {
    if (window.CCOptionsShell && window.CCOptionsShell.refreshDashboard) {
      await window.CCOptionsShell.refreshDashboard();
    }
  } catch (e) {
    console.warn("Dashboard refresh failed", e);
  }
});

/**
 * Load and display saved searches
 */
async function loadSavedSearches() {
  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const MAX_SEARCHES =
      (typeof SavedSearchUtils !== "undefined" &&
        SavedSearchUtils.MAX_SAVED_SEARCHES) ||
      5;

    const slotsUsed = document.getElementById("searchSlotsUsed");
    const emptyDiv = document.getElementById("savedSearchesEmpty");
    const tableDiv = document.getElementById("savedSearchesTable");
    const addBtn = document.getElementById("showAddSearchForm");
    const addHint = document.getElementById("addSearchHint");

    slotsUsed.textContent = searches.length;

    if (searches.length === 0) {
      emptyDiv.style.display = "block";
      tableDiv.style.display = "none";
    } else {
      emptyDiv.style.display = "none";
      tableDiv.style.display = "block";
      renderSearchesTable(searches);
    }

    // Update add button state
    if (searches.length >= MAX_SEARCHES) {
      addBtn.disabled = true;
      addBtn.style.opacity = "0.5";
      addBtn.style.cursor = "not-allowed";
      addHint.textContent = `Maximum ${MAX_SEARCHES} searches allowed (slots full)`;
    } else {
      addBtn.disabled = false;
      addBtn.style.opacity = "1";
      addBtn.style.cursor = "pointer";
      const left = MAX_SEARCHES - searches.length;
      addHint.textContent = `${left} slot${left > 1 ? "s" : ""} available`;
    }
  } catch (error) {
    console.error("Error loading saved searches:", error);
  }
}

/**
 * Render searches table
 */
function renderSearchesTable(searches) {
  const tableDiv = document.getElementById("savedSearchesTable");

  let html = '<table style="width: 100%; border-collapse: collapse;">';
  html +=
    '<thead><tr style="background: #f3f4f6; border-bottom: 2px solid #d1d5db;">';
  html +=
    '<th style="padding: 10px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">Name</th>';
  html +=
    '<th style="padding: 10px; text-align: left; font-size: 12px; font-weight: 600; color: #374151;">Details</th>';
  html +=
    '<th style="padding: 10px; text-align: center; font-size: 12px; font-weight: 600; color: #374151;">Actions</th>';
  html += "</tr></thead><tbody>";

  searches.forEach((search) => {
    const details =
      typeof SavedSearchUtils !== "undefined"
        ? SavedSearchUtils.getDetailsLine(search)
        : `${search.keywords || "All Jobs"} • ${
            search.location || "All Locations"
          }`;
    const runCount = search.runCount || 0;
    const lastRun = search.lastRun
      ? new Date(search.lastRun).toLocaleDateString()
      : "Never";

    html += '<tr style="border-bottom: 1px solid #e5e7eb;">';
    html += `<td style="padding: 12px; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(
      search.name
    )}</td>`;
    html += `<td style="padding: 12px; font-size: 12px; color: #6b7280;">
      <div>${escapeHtml(details)}</div>
      <div style="margin-top: 4px; font-size: 11px; color: #9ca3af;">Runs: ${runCount} | Last: ${lastRun}</div>
    </td>`;
    html += `<td style="padding: 12px; text-align: center; white-space: nowrap;">
      <button data-action="run" data-search-id="${search.id}" class="btn search-action-btn" style="padding: 6px 10px; font-size: 11px; background: #0284c7; margin-right: 4px;">▶ Run</button>
      <button data-action="edit" data-search-id="${search.id}" class="btn search-action-btn" style="padding: 6px 10px; font-size: 11px; background: #4b5563; margin-right: 4px;">✎ Edit</button>
      <button data-action="delete" data-search-id="${search.id}" class="btn search-action-btn" style="padding: 6px 10px; font-size: 11px; background: #dc2626;">✕ Delete</button>
    </td>`;
    html += "</tr>";
  });

  html += "</tbody></table>";
  tableDiv.innerHTML = html;

  // Setup event delegation for action buttons
  tableDiv.querySelectorAll(".search-action-btn").forEach((btn) => {
    btn.addEventListener("click", async function (e) {
      const action = this.dataset.action;
      const searchId = this.dataset.searchId;

      if (action === "run") {
        await runSavedSearch(searchId);
      } else if (action === "edit") {
        await openEditSearchForm(searchId);
      } else if (action === "delete") {
        await deleteSavedSearch(searchId);
      }
    });
  });
}

/**
 * Open edit form for an existing saved search
 */
async function openEditSearchForm(searchId) {
  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const search = searches.find((s) => s.id === searchId);
    if (!search) {
      showError("Search not found");
      return;
    }

    const locationDisplay =
      typeof SavedSearchUtils !== "undefined"
        ? SavedSearchUtils.getLocationDisplay(search)
        : search.location || "";

    document.getElementById("addSearchForm").style.display = "block";
    document.getElementById("formTitle").textContent = "✎ Edit Search";
    document.getElementById("editSearchId").value = search.id;
    document.getElementById("searchName").value = search.name || "";
    document.getElementById("searchKeywords").value = search.keywords || "";
    document.getElementById("searchLocation").value =
      locationDisplay === "All Locations" ? "" : locationDisplay;
    document.getElementById("searchUrl").value = search.url || "";

    document.getElementById("addSearchForm").scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  } catch (error) {
    console.error("Error opening edit form:", error);
    showError("Failed to open edit form");
  }
}

/**
 * Setup saved searches event listeners
 */
function setupSavedSearchesListeners() {
  const showFormBtn = document.getElementById("showAddSearchForm");
  const saveBtn = document.getElementById("saveSearchBtn");
  const cancelBtn = document.getElementById("cancelSearchBtn");

  if (showFormBtn) {
    showFormBtn.addEventListener("click", () => {
      document.getElementById("addSearchForm").style.display = "block";
      document.getElementById("formTitle").textContent = "➕ Add New Search";
      document.getElementById("editSearchId").value = "";
      clearSearchForm();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveSearchForm);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      document.getElementById("addSearchForm").style.display = "none";
      clearSearchForm();
    });
  }
}

/**
 * Save search from form (create or update)
 */
async function saveSearchForm() {
  const editId = document.getElementById("editSearchId").value.trim();
  const name = document.getElementById("searchName").value.trim();
  const keywords = document.getElementById("searchKeywords").value.trim();
  const location = document.getElementById("searchLocation").value.trim();
  const url = document.getElementById("searchUrl").value.trim();

  if (!name) {
    showError("Please enter a search name");
    return;
  }

  if (!url || !url.includes("linkedin.com/jobs/search")) {
    showError("Please enter a valid LinkedIn job search URL");
    return;
  }

  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const MAX_SEARCHES =
      (typeof SavedSearchUtils !== "undefined" &&
        SavedSearchUtils.MAX_SAVED_SEARCHES) ||
      5;

    const existing = editId ? searches.find((s) => s.id === editId) : null;

    const normalized =
      typeof SavedSearchUtils !== "undefined"
        ? SavedSearchUtils.normalizeSearchFields({
            keywords,
            location,
            geoId: (existing && existing.geoId) || "",
            filters: (existing && existing.filters) || {},
            url,
          })
        : {
            keywords,
            location,
            geoId: "",
            filters: {},
            url,
          };

    if (editId) {
      const index = searches.findIndex((s) => s.id === editId);
      if (index === -1) {
        showError("Search not found");
        return;
      }
      searches[index] = {
        ...searches[index],
        name,
        keywords: normalized.keywords,
        location: normalized.location,
        geoId: normalized.geoId,
        filters: normalized.filters,
        url: normalized.url,
      };
      await chrome.storage.local.set({ saved_job_searches: searches });
      showSuccess("Search updated successfully!");
    } else {
      if (searches.length >= MAX_SEARCHES) {
        showError(`Maximum ${MAX_SEARCHES} searches allowed`);
        return;
      }

      const search = {
        id:
          "search_" +
          Date.now() +
          "_" +
          Math.random().toString(36).substr(2, 9),
        name,
        keywords: normalized.keywords,
        location: normalized.location,
        geoId: normalized.geoId,
        filters: normalized.filters,
        url: normalized.url,
        dateCreated: Date.now(),
        lastRun: null,
        runCount: 0,
      };

      searches.push(search);
      await chrome.storage.local.set({ saved_job_searches: searches });
      showSuccess("Search saved successfully!");
    }

    document.getElementById("addSearchForm").style.display = "none";
    clearSearchForm();
    await loadSavedSearches();
  } catch (error) {
    console.error("Error saving search:", error);
    showError("Failed to save search");
  }
}

/**
 * Clear search form
 */
function clearSearchForm() {
  document.getElementById("searchName").value = "";
  document.getElementById("searchKeywords").value = "";
  document.getElementById("searchLocation").value = "";
  document.getElementById("searchUrl").value = "";
  document.getElementById("editSearchId").value = "";
}

/**
 * Run saved search
 */
async function runSavedSearch(searchId) {
  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const search = searches.find((s) => s.id === searchId);

    if (search) {
      // Update run stats
      search.lastRun = Date.now();
      search.runCount = (search.runCount || 0) + 1;
      await chrome.storage.local.set({ saved_job_searches: searches });

      // Open URL
      window.open(search.url, "_blank");
      await loadSavedSearches();
    }
  } catch (error) {
    console.error("Error running search:", error);
    showError("Failed to run search");
  }
}

/**
 * Delete saved search
 */
async function deleteSavedSearch(searchId) {
  if (!confirm("Delete this saved search?")) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(["saved_job_searches"]);
    const searches = result.saved_job_searches || [];
    const filtered = searches.filter((s) => s.id !== searchId);

    await chrome.storage.local.set({ saved_job_searches: filtered });

    // Clean up notification counts
    const countResult = await chrome.storage.local.get([
      "notification_job_counts",
    ]);
    const counts = countResult.notification_job_counts || {};
    if (counts[searchId]) {
      delete counts[searchId];
      await chrome.storage.local.set({ notification_job_counts: counts });
    }

    showSuccess("Search deleted");
    await loadSavedSearches();
  } catch (error) {
    console.error("Error deleting search:", error);
    showError("Failed to delete search");
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * ═══════════════════════════════════════════════════════════
 * NOTIFICATION SETTINGS
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Load notification settings
 */
async function loadNotificationSettings() {
  try {
    const result = await chrome.storage.local.get(["notification_settings"]);
    const settings = result.notification_settings || {
      enabled: false,
      checkInterval: 30,
      lastChecked: null,
      notificationsSent: 0,
    };

    document.getElementById("notificationsEnabled").checked = settings.enabled;
    document.getElementById("checkInterval").value = settings.checkInterval;
    document.getElementById("checkIntervalValue").textContent = formatInterval(
      settings.checkInterval
    );

    // Update stats
    document.getElementById("lastChecked").textContent = settings.lastChecked
      ? new Date(settings.lastChecked).toLocaleString()
      : "Never";
    document.getElementById("notificationsSent").textContent =
      settings.notificationsSent || 0;

    // Toggle visibility of settings
    toggleNotificationSettings(settings.enabled);

    // Live health: alarm + saved searches + permission
    await refreshAlertHealth();
  } catch (error) {
    console.error("Error loading notification settings:", error);
  }
}

/**
 * Refresh alert health line (alarm schedule, searches, permission).
 * Falls back to storage if the service worker message fails.
 */
async function refreshAlertHealth() {
  const statusEl = document.getElementById("alertHealthStatus");
  const searchEl = document.getElementById("alertSavedSearchCount");
  const nextEl = document.getElementById("nextCheckAt");
  let health = null;
  try {
    health = await chrome.runtime.sendMessage({
      action: "getNotificationHealth",
    });
  } catch (e) {
    health = null;
  }

  // Storage fallback when SW is asleep / message fails
  if (!health || !health.success) {
    try {
      const result = await chrome.storage.local.get([
        "notification_settings",
        "saved_job_searches",
      ]);
      const settings = result.notification_settings || {};
      const searches = result.saved_job_searches || [];
      health = {
        success: true,
        enabled: !!settings.enabled,
        checkInterval: settings.checkInterval || null,
        lastChecked: settings.lastChecked || null,
        notificationsSent: settings.notificationsSent || 0,
        savedSearchCount: searches.length,
        permission: "unknown",
        alarmScheduled: null,
        nextCheckAt: null,
        fromStorageFallback: true,
      };
    } catch (e2) {
      health = null;
    }
  }

  if (!health || !health.success) {
    if (statusEl) statusEl.textContent = "Unable to read status";
    if (searchEl) searchEl.textContent = "—";
    if (nextEl) nextEl.textContent = "—";
    return;
  }

  // If alerts are ON but alarm missing, force re-schedule
  if (health.enabled && health.alarmScheduled === false) {
    try {
      const result = await chrome.storage.local.get(["notification_settings"]);
      await chrome.runtime.sendMessage({
        action: "updateNotificationAlarm",
        settings: result.notification_settings || { enabled: true },
      });
      const again = await chrome.runtime.sendMessage({
        action: "getNotificationHealth",
      });
      if (again && again.success) health = again;
    } catch (e3) {}
  }

  if (searchEl) searchEl.textContent = String(health.savedSearchCount || 0);
  if (nextEl) {
    nextEl.textContent = health.nextCheckAt
      ? new Date(health.nextCheckAt).toLocaleString()
      : health.enabled
      ? health.alarmScheduled === false
        ? "Not scheduled — click Check for Jobs Now"
        : health.fromStorageFallback
        ? "Open this page after reload to refresh"
        : "—"
      : "—";
  }
  if (statusEl) {
    if (!health.enabled) {
      statusEl.textContent = "Off";
    } else if (health.permission === "denied") {
      statusEl.textContent = "Permission needed";
    } else if (!health.savedSearchCount) {
      statusEl.textContent = "On — add a saved search first";
    } else if (health.alarmScheduled === false) {
      statusEl.textContent = "On — alarm missing (re-saving…)";
    } else if (health.fromStorageFallback) {
      statusEl.textContent =
        "On — " +
        (health.savedSearchCount || 0) +
        " search(es); verify with Check for Jobs Now";
    } else {
      statusEl.textContent = "Working (alarm scheduled)";
    }
  }
}

/**
 * Save notification settings
 */
async function saveNotificationSettings() {
  try {
    const enabled = document.getElementById("notificationsEnabled").checked;
    const checkInterval = parseInt(
      document.getElementById("checkInterval").value
    );

    // Get existing settings to preserve stats
    const result = await chrome.storage.local.get(["notification_settings"]);
    const existingSettings = result.notification_settings || {};

    const settings = {
      ...existingSettings,
      enabled,
      checkInterval,
    };

    await chrome.storage.local.set({ notification_settings: settings });

    // Request notification permission if enabling
    if (enabled) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // User denied, revert checkbox
        document.getElementById("notificationsEnabled").checked = false;
        settings.enabled = false;
        await chrome.storage.local.set({ notification_settings: settings });
        showError(
          "Notification permission denied. Please enable in browser settings."
        );
        return;
      }
    }

    // Tell background script to update alarm
    chrome.runtime.sendMessage({
      action: "updateNotificationAlarm",
      settings,
    });

    toggleNotificationSettings(enabled);
    showSuccess("Notification settings saved!");
    await refreshAlertHealth();
  } catch (error) {
    console.error("Error saving notification settings:", error);
    showError("Failed to save notification settings");
  }
}

/**
 * Toggle visibility of notification settings
 */
function toggleNotificationSettings(enabled) {
  const settingsDiv = document.getElementById("notificationSettings");
  if (settingsDiv) {
    settingsDiv.style.opacity = enabled ? "1" : "0.5";
    settingsDiv.style.pointerEvents = enabled ? "auto" : "none";
  }
}

/**
 * Format interval for display
 */
function formatInterval(minutes) {
  if (minutes < 60) {
    return `${minutes} minutes`;
  } else {
    const hours = minutes / 60;
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }
}

/**
 * Send test notification
 */
async function sendTestNotification() {
  try {
    chrome.runtime.sendMessage(
      {
        action: "sendTestNotification",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showError(
            "Test failed: " + chrome.runtime.lastError.message
          );
          loadNotificationLogs();
          return;
        }
        if (response && response.success) {
          showSuccess(
            "Test notification sent — check top-right banner or Notification Centre"
          );
        } else {
          showError(
            "Test notification failed" +
              (response && response.error ? ": " + response.error : "")
          );
        }
        setTimeout(() => loadNotificationLogs(), 500);
      }
    );
  } catch (error) {
    console.error("Error sending test notification:", error);
    showError("Failed to send test notification");
  }
}

/**
 * Setup notification event listeners
 */
function setupNotificationListeners() {
  const enabledCheckbox = document.getElementById("notificationsEnabled");
  const intervalSlider = document.getElementById("checkInterval");
  const testButton = document.getElementById("testNotification");

  if (enabledCheckbox) {
    enabledCheckbox.addEventListener("change", saveNotificationSettings);
  }

  if (intervalSlider) {
    intervalSlider.addEventListener("input", (e) => {
      document.getElementById("checkIntervalValue").textContent =
        formatInterval(e.target.value);
    });
    intervalSlider.addEventListener("change", saveNotificationSettings);
  }

  if (testButton) {
    testButton.addEventListener("click", async () => {
      await sendTestNotification();
      // Refresh logs after test
      setTimeout(() => loadNotificationLogs(), 1000);
    });
  }

  // Check Jobs Now button
  const checkJobsButton = document.getElementById("checkJobsNow");
  if (checkJobsButton) {
    checkJobsButton.addEventListener("click", async () => {
      checkJobsButton.disabled = true;
      checkJobsButton.textContent = "🔄 Checking...";

      try {
        await chrome.runtime.sendMessage({ action: "checkJobsNow" });
        showSuccess("Job check triggered! Check logs below for details.");

        // Refresh logs after check
        setTimeout(() => {
          loadNotificationLogs();
          loadNotificationSettings();
          checkJobsButton.disabled = false;
          checkJobsButton.textContent = "🔍 Check for Jobs Now";
        }, 3000);
      } catch (error) {
        showError("Failed to trigger job check");
        checkJobsButton.disabled = false;
        checkJobsButton.textContent = "🔍 Check for Jobs Now";
      }
    });
  }

  // Clear Logs button
  const clearLogsButton = document.getElementById("clearNotificationLogs");
  if (clearLogsButton) {
    clearLogsButton.addEventListener("click", async () => {
      try {
        await chrome.runtime.sendMessage({ action: "clearNotificationLogs" });
        loadNotificationLogs();
        showSuccess("Notification logs cleared");
      } catch (error) {
        showError("Failed to clear logs");
      }
    });
  }

  // Load logs initially
  loadNotificationLogs();
}

/**
 * Load and display notification logs
 */
async function loadNotificationLogs() {
  try {
    let logs = [];
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getNotificationLogs",
      });
      if (response && Array.isArray(response.logs)) {
        logs = response.logs;
      }
    } catch (e) {}

    // Direct storage fallback (if SW message fails)
    if (!logs.length) {
      const result = await chrome.storage.local.get(["notification_logs"]);
      logs = result.notification_logs || [];
    }

    const container = document.getElementById("notificationLogs");
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div style="color: #9ca3af; text-align: center; padding: 20px;">
          No logs yet. Click <strong>Check for Jobs Now</strong> to run a check,
          or wait for the scheduled alarm. Make sure you have at least one saved search.
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map((log) => formatLogEntry(log)).join("");
  } catch (error) {
    console.error("Error loading notification logs:", error);
    const container = document.getElementById("notificationLogs");
    if (container) {
      container.innerHTML =
        '<div style="color:#b91c1c;text-align:center;padding:20px;">Could not load logs. Reload the extension and try again.</div>';
    }
  }
}

/**
 * Format a single log entry
 */
function formatLogEntry(log) {
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  const icon = icons[log.status] || icons.info;
  const timestamp = new Date(log.timestamp).toLocaleString();

  let detailsHtml = "";
  if (log.details && Object.keys(log.details).length > 0) {
    const detailsText = Object.entries(log.details)
      .map(([key, value]) => {
        if (typeof value === "object") {
          return `${key}: ${JSON.stringify(value, null, 2)}`;
        }
        return `${key}: ${value}`;
      })
      .join("\n");

    detailsHtml = `<div class="log-details">${escapeHtml(detailsText)}</div>`;
  }

  return `
    <div class="log-entry ${log.status}">
      <div class="log-icon">${icon}</div>
      <div class="log-content">
        <div class="log-timestamp">${timestamp}</div>
        <div class="log-message">${escapeHtml(log.message)}</div>
        ${detailsHtml}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * CASPER AI ASSISTANT SETTINGS
 */

/**
 * Load Casper settings
 */
async function loadCasperSettings() {
  try {
    const result = await chrome.storage.local.get([
      "casper_enabled",
      "casper_theme",
      "casper_show_post_buttons",
      "casper_settings",
    ]);

    // Load enabled status (default: false - opt-in)
    const enabledCheckbox = document.getElementById("casperEnabled");
    if (enabledCheckbox) {
      enabledCheckbox.checked = result.casper_enabled === true;
    }

    // Load show post buttons (default: true)
    const showPostButtonsCheckbox = document.getElementById(
      "casperShowPostButtons"
    );
    if (showPostButtonsCheckbox) {
      showPostButtonsCheckbox.checked =
        result.casper_show_post_buttons !== false;
    }

    // Load theme (default: light)
    const themeSelect = document.getElementById("casperTheme");
    if (themeSelect) {
      themeSelect.value = result.casper_theme || "light";
    }

    // Load settings (max chats, auto-delete)
    const settings = result.casper_settings || {
      maxChats: 50,
      autoDeleteDays: 30,
    };

    const maxChatsSelect = document.getElementById("casperMaxChats");
    if (maxChatsSelect) {
      maxChatsSelect.value = settings.maxChats;
    }

    const autoDeleteSelect = document.getElementById("casperAutoDelete");
    if (autoDeleteSelect) {
      autoDeleteSelect.value = settings.autoDeleteDays;
    }

    // Load storage stats
    await loadCasperStats();
  } catch (error) {
    console.error("Error loading Casper settings:", error);
  }
}

/**
 * Save Casper settings
 */
async function saveCasperSettings() {
  try {
    const enabled = document.getElementById("casperEnabled")?.checked || false;
    const showPostButtons =
      document.getElementById("casperShowPostButtons")?.checked !== false;
    const theme = document.getElementById("casperTheme")?.value || "light";
    const maxChats = document.getElementById("casperMaxChats")?.value || "50";
    const autoDeleteDays =
      document.getElementById("casperAutoDelete")?.value || "30";

    const settings = {
      maxChats: maxChats,
      autoDeleteDays: autoDeleteDays,
    };

    await chrome.storage.local.set({
      casper_enabled: enabled,
      casper_show_post_buttons: showPostButtons,
      casper_theme: theme,
      casper_settings: settings,
    });

    console.log("Casper settings saved");
  } catch (error) {
    console.error("Error saving Casper settings:", error);
  }
}

/**
 * Load Casper storage stats
 */
async function loadCasperStats() {
  try {
    const result = await chrome.storage.local.get(["casper_chats"]);
    const chats = result.casper_chats || [];

    const chatCount = chats.length;
    const dataString = JSON.stringify(chats);
    const bytes = new Blob([dataString]).size;
    const kb = (bytes / 1024).toFixed(2);

    // Update UI
    const chatCountEl = document.getElementById("casperChatCount");
    const storageSizeEl = document.getElementById("casperStorageSize");

    if (chatCountEl) {
      chatCountEl.textContent = chatCount;
    }

    if (storageSizeEl) {
      storageSizeEl.textContent = `${kb} KB`;
    }
  } catch (error) {
    console.error("Error loading Casper stats:", error);
  }
}

/**
 * Delete all Casper chats
 */
async function deleteCasperChats() {
  if (
    !confirm(
      "Are you sure you want to delete ALL chat history? This cannot be undone."
    )
  ) {
    return;
  }

  try {
    await chrome.storage.local.set({ casper_chats: [] });
    await loadCasperStats();
    showSuccess("All Casper chats deleted");
  } catch (error) {
    console.error("Error deleting Casper chats:", error);
    showError("Failed to delete chats");
  }
}

/**
 * Setup Casper event listeners
 */
function setupCasperListeners() {
  const enabledCheckbox = document.getElementById("casperEnabled");
  const showPostButtonsCheckbox = document.getElementById(
    "casperShowPostButtons"
  );
  const themeSelect = document.getElementById("casperTheme");
  const maxChatsSelect = document.getElementById("casperMaxChats");
  const autoDeleteSelect = document.getElementById("casperAutoDelete");
  const refreshBtn = document.getElementById("casperRefreshStats");
  const deleteBtn = document.getElementById("casperDeleteAll");

  if (enabledCheckbox) {
    enabledCheckbox.addEventListener("change", saveCasperSettings);
  }

  if (showPostButtonsCheckbox) {
    showPostButtonsCheckbox.addEventListener("change", saveCasperSettings);
  }

  if (themeSelect) {
    themeSelect.addEventListener("change", saveCasperSettings);
  }

  if (maxChatsSelect) {
    maxChatsSelect.addEventListener("change", saveCasperSettings);
  }

  if (autoDeleteSelect) {
    autoDeleteSelect.addEventListener("change", saveCasperSettings);
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", loadCasperStats);
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", deleteCasperChats);
  }
}
