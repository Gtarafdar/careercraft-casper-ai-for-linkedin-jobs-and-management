/**
 * Saved Content Storage Layer
 * Uses IndexedDB for local storage of saved LinkedIn items
 */

class SavedContentStorage {
  constructor() {
    this.dbName = "LinkedInSavedContent";
    this.dbVersion = 1;
    this.storeName = "savedItems";
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error("SavedContentStorage: Failed to open database");
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("SavedContentStorage: Database initialized");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const objectStore = db.createObjectStore(this.storeName, {
            keyPath: "id",
          });

          // Create indexes for efficient querying
          objectStore.createIndex("category", "category", { unique: false });
          objectStore.createIndex("type", "type", { unique: false });
          objectStore.createIndex("dateAdded", "dateAdded", { unique: false });
          objectStore.createIndex("url", "url", { unique: false });

          console.log("SavedContentStorage: Object store created");
        }
      };
    });
  }

  /**
   * Save multiple items to storage
   */
  async saveItems(items) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);

      let successCount = 0;
      let errorCount = 0;

      items.forEach((item) => {
        const request = objectStore.put(item);

        request.onsuccess = () => {
          successCount++;
        };

        request.onerror = () => {
          errorCount++;
          console.error("SavedContentStorage: Error saving item:", item.id);
        };
      });

      transaction.oncomplete = () => {
        console.log(
          `SavedContentStorage: Saved ${successCount} items, ${errorCount} errors`
        );
        resolve({ success: successCount, errors: errorCount });
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Get all saved items
   */
  async getAllItems() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get items by category
   */
  async getItemsByCategory(category) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readonly");
      const objectStore = transaction.objectStore(this.storeName);
      const index = objectStore.index("category");
      const request = index.getAll(category);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Search items by keyword
   */
  async searchItems(keyword) {
    const allItems = await this.getAllItems();
    const lowerKeyword = keyword.toLowerCase();

    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerKeyword) ||
        item.content.toLowerCase().includes(lowerKeyword) ||
        item.author.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * Update item category
   */
  async updateItemCategory(itemId, newCategory) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.get(itemId);

      request.onsuccess = () => {
        const item = request.result;
        if (item) {
          item.category = newCategory;
          item.lastModified = new Date().toISOString();

          const updateRequest = objectStore.put(item);

          updateRequest.onsuccess = () => {
            resolve(item);
          };

          updateRequest.onerror = () => {
            reject(updateRequest.error);
          };
        } else {
          reject(new Error("Item not found"));
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete item
   */
  async deleteItem(itemId) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.delete(itemId);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete multiple items
   */
  async deleteItems(itemIds) {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);

      let successCount = 0;

      itemIds.forEach((itemId) => {
        const request = objectStore.delete(itemId);
        request.onsuccess = () => {
          successCount++;
        };
      });

      transaction.oncomplete = () => {
        resolve(successCount);
      };

      transaction.onerror = () => {
        reject(transaction.error);
      };
    });
  }

  /**
   * Clear all saved items
   */
  async clearAll() {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], "readwrite");
      const objectStore = transaction.objectStore(this.storeName);
      const request = objectStore.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get statistics
   */
  async getStats() {
    const items = await this.getAllItems();

    const stats = {
      total: items.length,
      byCategory: {},
      byType: {},
      oldest: null,
      newest: null,
    };

    items.forEach((item) => {
      // Count by category
      stats.byCategory[item.category] =
        (stats.byCategory[item.category] || 0) + 1;

      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      // Track dates
      const itemDate = new Date(item.dateAdded);
      if (!stats.oldest || itemDate < new Date(stats.oldest)) {
        stats.oldest = item.dateAdded;
      }
      if (!stats.newest || itemDate > new Date(stats.newest)) {
        stats.newest = item.dateAdded;
      }
    });

    return stats;
  }

  /**
   * Export all data as JSON
   */
  async exportData() {
    const items = await this.getAllItems();
    const stats = await this.getStats();

    return {
      exportDate: new Date().toISOString(),
      stats: stats,
      items: items,
    };
  }

  /**
   * Import data from JSON
   */
  async importData(data) {
    if (!data.items || !Array.isArray(data.items)) {
      throw new Error("Invalid import data format");
    }

    return await this.saveItems(data.items);
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = SavedContentStorage;
}
