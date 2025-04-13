/**
 * Application constants
 */

// API endpoints
const ZAPPER_PROXY_URL = '/api/zapper';

// Cache configuration
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

// Default page sizes
const NFT_PAGE_SIZE = 24; // Matching Zapper's default exactly to ensure compatibility

// Export all constants
module.exports = {
  ZAPPER_PROXY_URL,
  CACHE_EXPIRATION_TIME,
  NFT_PAGE_SIZE
}; 