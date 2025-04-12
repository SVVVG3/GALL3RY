/**
 * Zapper API configuration constants
 */

// Zapper API endpoints
export const ZAPPER_SERVER_URL = 'https://api.zapper.fi/v2';

// API Key (will be read from environment variables)
export const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;

// Default network for API requests
export const DEFAULT_NETWORK = 'ethereum';

// Maximum number of items to fetch in a single request
export const DEFAULT_LIMIT = 100;

export default {
  ZAPPER_SERVER_URL,
  ZAPPER_API_KEY,
  DEFAULT_NETWORK,
  DEFAULT_LIMIT
}; 