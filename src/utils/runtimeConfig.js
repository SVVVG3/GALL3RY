/**
 * Runtime Configuration Utility
 * 
 * This utility loads configuration values that can be changed at runtime
 * without requiring a rebuild of the application.
 */

let cachedConfig = null;

/**
 * Load runtime configuration from the runtime-config.json file
 * Falls back to environment variables if the file is not available
 */
export async function loadRuntimeConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    // Try to fetch the runtime config file
    const response = await fetch('/runtime-config.json');
    if (!response.ok) {
      throw new Error(`Failed to load runtime config: ${response.status}`);
    }

    cachedConfig = await response.json();
    console.log('Loaded runtime config from file');
  } catch (error) {
    console.warn('Could not load runtime config, falling back to env vars:', error);
    
    // Fallback to environment variables
    cachedConfig = {
      apiUrl: process.env.REACT_APP_API_URL || '/api',
      zapperApiKey: process.env.REACT_APP_ZAPPER_API_KEY,
      alchemyApiKey: process.env.REACT_APP_ALCHEMY_API_KEY,
      buildTime: null
    };
  }

  return cachedConfig;
}

/**
 * Get the API base URL for the current environment
 */
export async function getApiBaseUrl() {
  const config = await loadRuntimeConfig();
  return config.apiUrl || '/api';
}

/**
 * Get the Zapper API Key
 */
export async function getZapperApiKey() {
  const config = await loadRuntimeConfig();
  return config.zapperApiKey;
}

/**
 * Get the Alchemy API Key
 */
export async function getAlchemyApiKey() {
  const config = await loadRuntimeConfig();
  return config.alchemyApiKey;
}

export default {
  loadRuntimeConfig,
  getApiBaseUrl,
  getZapperApiKey,
  getAlchemyApiKey
}; 