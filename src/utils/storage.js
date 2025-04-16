/**
 * Safe storage utilities that handle environments where localStorage is not available
 * (like iframes with 3rd party cookies blocked, incognito mode, etc.)
 */

// Global flag to track storage availability - checked only once
let storageAvailable = null;

// In-memory fallback when localStorage is not available
const memoryStorage = new Map();

// Check if localStorage is available
export const isStorageAvailable = () => {
  // Return cached result if we've already done the check
  if (storageAvailable !== null) {
    return storageAvailable;
  }

  try {
    // Check for localStorage existence first
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn('localStorage is not available in this environment');
      storageAvailable = false;
      return false;
    }

    // Try a test operation
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    
    // If we got here, storage is available
    storageAvailable = true;
    return true;
  } catch (error) {
    console.warn('localStorage access failed:', error.message);
    storageAvailable = false;
    return false;
  }
};

// Safe localStorage.getItem with fallback
export const getItem = (key) => {
  try {
    if (isStorageAvailable()) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) || null;
  } catch (error) {
    console.warn(`Error reading from storage (key: ${key}):`, error);
    return memoryStorage.get(key) || null;
  }
};

// Safe localStorage.setItem with fallback
export const setItem = (key, value) => {
  try {
    if (isStorageAvailable()) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
    return true;
  } catch (error) {
    console.warn(`Error writing to storage (key: ${key}):`, error);
    memoryStorage.set(key, value);
    return false;
  }
};

// Safe localStorage.removeItem with fallback
export const removeItem = (key) => {
  try {
    if (isStorageAvailable()) {
      window.localStorage.removeItem(key);
    }
    memoryStorage.delete(key);
    return true;
  } catch (error) {
    console.warn(`Error removing from storage (key: ${key}):`, error);
    memoryStorage.delete(key);
    return false;
  }
};

// Safe localStorage.clear with fallback
export const clear = () => {
  try {
    if (isStorageAvailable()) {
      window.localStorage.clear();
    }
    memoryStorage.clear();
    return true;
  } catch (error) {
    console.warn('Error clearing storage:', error);
    memoryStorage.clear();
    return false;
  }
};

// Get all keys
export const getAllKeys = () => {
  try {
    if (isStorageAvailable()) {
      return Object.keys(window.localStorage);
    }
    return Array.from(memoryStorage.keys());
  } catch (error) {
    console.warn('Error getting storage keys:', error);
    return Array.from(memoryStorage.keys());
  }
};

// Export default object with all methods
export default {
  isStorageAvailable,
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys
}; 