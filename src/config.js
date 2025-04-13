/**
 * Client-side application configuration settings
 */
const config = {
  // API base URL, defaulting to localhost in development
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
  
  // Authentication settings
  auth: {
    storageKey: 'nft_gallery_auth',
    tokenExpiryDays: 7
  },
  
  // Feature flags
  features: {
    enablePublicFolders: true,
    enableNftMinting: false,
    enableSocialSharing: true
  },
  
  // Default pagination settings
  pagination: {
    itemsPerPage: 12
  }
};

// API endpoints
const ZAPPER_PROXY_URL = process.env.REACT_APP_ZAPPER_PROXY_URL || '/api/zapper';

// Export all config values
module.exports = {
  ...config,
  ZAPPER_PROXY_URL
}; 