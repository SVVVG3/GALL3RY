/**
 * Safe storage utilities that handle environments where localStorage is not available
 * (like iframes with 3rd party cookies blocked, incognito mode, etc.)
 */

// Check if localStorage is available
export const isStorageAvailable = () => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

// In-memory fallback when localStorage is not available
const memoryStorage = new Map();

// Safe localStorage.getItem with fallback
export const getItem = (key) => {
  try {
    if (isStorageAvailable()) {
      return localStorage.getItem(key);
    }
    return memoryStorage.get(key) || null;
  } catch (error) {
    console.warn('Error accessing storage:', error);
    return memoryStorage.get(key) || null;
  }
};

// Safe localStorage.setItem with fallback
export const setItem = (key, value) => {
  try {
    if (isStorageAvailable()) {
      localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
    return true;
  } catch (error) {
    console.warn('Error setting storage:', error);
    memoryStorage.set(key, value);
    return false;
  }
};

// Safe localStorage.removeItem with fallback
export const removeItem = (key) => {
  try {
    if (isStorageAvailable()) {
      localStorage.removeItem(key);
    }
    memoryStorage.delete(key);
    return true;
  } catch (error) {
    console.warn('Error removing from storage:', error);
    memoryStorage.delete(key);
    return false;
  }
};

// Safe localStorage.clear with fallback
export const clear = () => {
  try {
    if (isStorageAvailable()) {
      localStorage.clear();
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
      return Object.keys(localStorage);
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