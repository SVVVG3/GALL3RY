/**
 * Cache utility with expiration support
 * Wraps localStorage with additional functionality for expiration and fallback to memory
 */

import safeStorage from './storage';

// Memory fallback cache for when localStorage fails
const memoryCache = new Map();

/**
 * LocalStorage wrapper with expiration support
 */
export const localStorageCache = {
  /**
   * Set an item in the cache with expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to store (will be JSON stringified)
   * @param {number} [expirationMinutes=60] - Expiration time in minutes
   * @returns {Promise<boolean>} - Success status
   */
  setItem: async (key, value, expirationMinutes = 60) => {
    try {
      // Create cache item with expiration
      const cacheItem = {
        value,
        expiration: Date.now() + (expirationMinutes * 60 * 1000)
      };
      
      // Store in localStorage
      const success = safeStorage.setItem(
        `cache_${key}`,
        JSON.stringify(cacheItem)
      );
      
      // Fallback to memory if localStorage failed
      if (!success) {
        memoryCache.set(key, cacheItem);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting cache for key ${key}:`, error);
      // Fallback to memory
      memoryCache.set(key, {
        value,
        expiration: Date.now() + (expirationMinutes * 60 * 1000)
      });
      return false;
    }
  },
  
  /**
   * Get an item from the cache, returns null if expired or not found
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} - The cached value or null if not found/expired
   */
  getItem: async (key) => {
    try {
      // Try localStorage first
      const cachedData = safeStorage.getItem(`cache_${key}`);
      let cacheItem;
      
      if (cachedData) {
        try {
          cacheItem = JSON.parse(cachedData);
        } catch (parseError) {
          console.warn(`Error parsing cache for key ${key}:`, parseError);
          safeStorage.removeItem(`cache_${key}`);
          return null;
        }
      } else if (memoryCache.has(key)) {
        // If not in localStorage, try memory cache
        cacheItem = memoryCache.get(key);
      } else {
        // Not found in either cache
        return null;
      }
      
      // Check expiration
      if (cacheItem && cacheItem.expiration > Date.now()) {
        return cacheItem.value;
      } else {
        // Expired, remove from both caches
        safeStorage.removeItem(`cache_${key}`);
        memoryCache.delete(key);
        return null;
      }
    } catch (error) {
      console.error(`Error getting cache for key ${key}:`, error);
      
      // Try memory cache as last resort
      const memoryItem = memoryCache.get(key);
      if (memoryItem && memoryItem.expiration > Date.now()) {
        return memoryItem.value;
      }
      
      return null;
    }
  },
  
  /**
   * Remove an item from the cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} - Success status
   */
  removeItem: async (key) => {
    try {
      safeStorage.removeItem(`cache_${key}`);
      memoryCache.delete(key);
      return true;
    } catch (error) {
      console.error(`Error removing cache for key ${key}:`, error);
      memoryCache.delete(key);
      return false;
    }
  },
  
  /**
   * Clear all cache items
   * @returns {Promise<boolean>} - Success status
   */
  clear: async () => {
    try {
      // Get all keys from storage
      const allKeys = safeStorage.getAllKeys();
      
      // Find and remove all cache keys
      allKeys.forEach(fullKey => {
        if (fullKey.startsWith('cache_')) {
          safeStorage.removeItem(fullKey);
        }
      });
      
      // Clear memory cache
      memoryCache.clear();
      
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      memoryCache.clear();
      return false;
    }
  }
};

export default localStorageCache; 