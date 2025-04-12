/**
 * Application constants
 */

// API endpoints
export const ZAPPER_PROXY_URL = process.env.REACT_APP_ZAPPER_PROXY_URL || 'https://api.zapper.xyz/v2/graphql';

// Cache configuration
export const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

// Default page sizes
export const NFT_PAGE_SIZE = 32; 