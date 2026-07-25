/**
 * Saved Items Dashboard Script
 * Manages the UI for browsing and organizing saved LinkedIn content
 */

class SavedItemsDashboard {
  constructor() {
    this.storage = new SavedContentStorage();
    this.allItems = [];
    this.filteredItems = [];
    this.selectedItems = new Set();
    this.currentCategory = "all";
    this.currentSort = "newest";
    this.init();
  }

  async init() {
    console.log("SavedItemsDashboard: Initializing...");

    // Initialize storage
    await this.storage.init();

    // Load items
    await this.loadItems();

    // Setup event listeners
    this.setupEventListeners();

    // Render initial view
    this.render();
  }

  async loadItems() {
    try {
      this.allItems = await this.storage.getAllItems();
      this.filteredItems = [...this.allItems];
      console.log(`Loaded ${this.allItems.length} items`);
    } catch (error) {
      console.error("Error loading items:", error);
      this.allItems = [];
      this.filteredItems = [];
    }
  }

  setupEventListeners() {
    // Sync button
    document
      .getElementById("syncBtn")
      .addEventListener("click", () => this.syncFromLinkedIn());

    // Export button
    document
      .getElementById("exportBtn")
      .addEventListener("click", () => this.exportData());

    // Search input
    document
      .getElementById("searchInput")
      .addEventListener("input", (e) => this.handleSearch(e.target.value));

    // Sort select
    document
      .getElementById("sortSelect")
      .addEventListener("change", (e) => this.handleSort(e.target.value));

    // Category tabs
    document.querySelectorAll(".category-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const category = e.currentTarget.dataset.category;
        this.handleCategoryChange(category);
      });
    });

    // Stat cards (clickable)
    document.querySelectorAll(".stat-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        const category = e.currentTarget.dataset.category;
        this.handleCategoryChange(category);
      });
    });

    // Bulk actions
    document
      .getElementById("deselectAllBtn")
      .addEventListener("click", () => this.deselectAll());

    document
      .getElementById("deleteSelectedBtn")
      .addEventListener("click", () => this.deleteSelected());
  }

  async syncFromLinkedIn() {
    const syncBtn = document.getElementById("syncBtn");
    syncBtn.disabled = true;
    syncBtn.textContent = "🔄 Syncing...";

    try {
      // Open LinkedIn saved items page in new tab
      const tab = await chrome.tabs.create({
        url: "https://www.linkedin.com/my-items/saved-posts/",
        active: false,
      });

      // Inject content script and extract
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/saved-content-extractor.js"],
      });

      // Execute extraction
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          const extractor = new SavedContentExtractor();
          const items = await extractor.extractAllSavedItems();
          return items;
        },
      });

      const extractedItems = results[0].result;

      if (extractedItems && extractedItems.length > 0) {
        // Save to storage
        await this.storage.saveItems(extractedItems);

        // Reload items
        await this.loadItems();
        this.render();

        alert(`✅ Successfully synced ${extractedItems.length} items!`);
      } else {
        alert("⚠️ No items found. Make sure you're on the saved posts page.");
      }

      // Close the tab
      await chrome.tabs.remove(tab.id);
    } catch (error) {
      console.error("Sync error:", error);
      alert("❌ Error syncing items: " + error.message);
    } finally {
      syncBtn.disabled = false;
      syncBtn.textContent = "🔄 Sync from LinkedIn";
    }
  }

  async exportData() {
    try {
      const data = await this.storage.exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `linkedin-saved-items-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);
      alert("✅ Data exported successfully!");
    } catch (error) {
      console.error("Export error:", error);
      alert("❌ Error exporting data: " + error.message);
    }
  }

  handleSearch(keyword) {
    if (!keyword.trim()) {
      this.filteredItems = [...this.allItems];
    } else {
      const lowerKeyword = keyword.toLowerCase();
      this.filteredItems = this.allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerKeyword) ||
          item.content.toLowerCase().includes(lowerKeyword) ||
          item.author.toLowerCase().includes(lowerKeyword)
      );
    }

    this.applyFilters();
    this.render();
  }

  handleSort(sortType) {
    this.currentSort = sortType;
    this.sortItems();
    this.render();
  }

  sortItems() {
    switch (this.currentSort) {
      case "newest":
        this.filteredItems.sort(
          (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
        );
        break;
      case "oldest":
        this.filteredItems.sort(
          (a, b) => new Date(a.dateAdded) - new Date(b.dateAdded)
        );
        break;
      case "type":
        this.filteredItems.sort((a, b) => a.type.localeCompare(b.type));
        break;
    }
  }

  handleCategoryChange(category) {
    this.currentCategory = category;

    // Update active tab
    document.querySelectorAll(".category-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    document
      .querySelector(`[data-category="${category}"]`)
      ?.classList.add("active");

    // Update active stat card
    document.querySelectorAll(".stat-card").forEach((card) => {
      card.classList.remove("active");
    });
    document
      .querySelector(`.stat-card[data-category="${category}"]`)
      ?.classList.add("active");

    this.applyFilters();
    this.render();
  }

  applyFilters() {
    let filtered = [...this.allItems];

    // Apply category filter
    if (this.currentCategory !== "all") {
      filtered = filtered.filter(
        (item) => item.category === this.currentCategory
      );
    }

    // Apply search if present
    const searchValue = document.getElementById("searchInput").value;
    if (searchValue.trim()) {
      const lowerKeyword = searchValue.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(lowerKeyword) ||
          item.content.toLowerCase().includes(lowerKeyword) ||
          item.author.toLowerCase().includes(lowerKeyword)
      );
    }

    this.filteredItems = filtered;
    this.sortItems();
  }

  render() {
    this.renderStats();
    this.renderContent();
    this.updateBulkActionsBar();
  }

  renderStats() {
    const stats = {
      total: this.allItems.length,
      posts: 0,
      links: 0,
      visuals: 0,
      videos: 0,
    };

    this.allItems.forEach((item) => {
      if (stats.hasOwnProperty(item.category)) {
        stats[item.category]++;
      }
    });

    // Update stat numbers
    document.getElementById("statTotal").textContent = stats.total;
    document.getElementById("statPosts").textContent = stats.posts;
    document.getElementById("statLinks").textContent = stats.links;
    document.getElementById("statVisuals").textContent = stats.visuals;
    document.getElementById("statVideos").textContent = stats.videos;

    // Update category counts
    document.getElementById("countAll").textContent = stats.total;
    document.getElementById("countPosts").textContent = stats.posts;
    document.getElementById("countLinks").textContent = stats.links;
    document.getElementById("countVisuals").textContent = stats.visuals;
    document.getElementById("countVideos").textContent = stats.videos;
  }

  renderContent() {
    const container = document.getElementById("contentContainer");

    if (this.filteredItems.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>No items found</h3>
          <p>Click "Sync from LinkedIn" to import your saved content</p>
        </div>
      `;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "content-grid";

    this.filteredItems.forEach((item) => {
      const card = this.createCard(item);
      grid.appendChild(card);
    });

    container.innerHTML = "";
    container.appendChild(grid);
  }

  createCard(item) {
    const card = document.createElement("div");
    card.className = "content-card";
    card.dataset.itemId = item.id;

    if (this.selectedItems.has(item.id)) {
      card.classList.add("selected");
    }

    // Determine type class
    const typeClass = `type-${item.type}`;

    // Format date
    const date = new Date(item.dateAdded);
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    card.innerHTML = `
      <div class="card-thumbnail">
        ${
          item.thumbnail
            ? `<img src="${item.thumbnail}" alt="Thumbnail" />`
            : `<div class="placeholder">${this.getTypeIcon(item.type)}</div>`
        }
      </div>
      <div class="card-actions">
        <button class="action-btn" data-action="open" title="Open">🔗</button>
        <button class="action-btn" data-action="delete" title="Delete">🗑️</button>
      </div>
      <div class="card-content">
        <span class="card-type ${typeClass}">${item.type}</span>
        <div class="card-title">${this.escapeHtml(item.title)}</div>
        <div class="card-meta">
          <span class="card-author">${this.escapeHtml(item.author)}</span>
          <span class="card-date">${formattedDate}</span>
        </div>
      </div>
    `;

    // Add click handlers
    card.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("action-btn") ||
        e.target.closest(".action-btn")
      ) {
        return; // Let action buttons handle their own clicks
      }
      this.toggleSelection(item.id);
    });

    // Action buttons
    const openBtn = card.querySelector('[data-action="open"]');
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (item.url) {
        window.open(item.url, "_blank");
      }
    });

    const deleteBtn = card.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Delete this item?")) {
        await this.storage.deleteItem(item.id);
        await this.loadItems();
        this.applyFilters();
        this.render();
      }
    });

    return card;
  }

  getTypeIcon(type) {
    const icons = {
      post: "📝",
      article: "📄",
      link: "🔗",
      image: "🖼️",
      carousel: "📸",
      video: "🎥",
      document: "📄",
    };
    return icons[type] || "📌";
  }

  toggleSelection(itemId) {
    const card = document.querySelector(`[data-item-id="${itemId}"]`);

    if (this.selectedItems.has(itemId)) {
      this.selectedItems.delete(itemId);
      card?.classList.remove("selected");
    } else {
      this.selectedItems.add(itemId);
      card?.classList.add("selected");
    }

    this.updateBulkActionsBar();
  }

  deselectAll() {
    this.selectedItems.clear();
    document.querySelectorAll(".content-card.selected").forEach((card) => {
      card.classList.remove("selected");
    });
    this.updateBulkActionsBar();
  }

  async deleteSelected() {
    if (this.selectedItems.size === 0) return;

    if (!confirm(`Delete ${this.selectedItems.size} selected items?`)) {
      return;
    }

    const itemIds = Array.from(this.selectedItems);
    await this.storage.deleteItems(itemIds);

    this.selectedItems.clear();
    await this.loadItems();
    this.applyFilters();
    this.render();
  }

  updateBulkActionsBar() {
    const bar = document.getElementById("bulkActionsBar");
    const count = document.getElementById("selectedCount");

    count.textContent = this.selectedItems.size;

    if (this.selectedItems.size > 0) {
      bar.classList.add("visible");
    } else {
      bar.classList.remove("visible");
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize dashboard when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new SavedItemsDashboard();
});
