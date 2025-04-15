/**
 * Client-side application configuration settings
 */
const dotenv = require('dotenv');

// Load environment variables from .env file if available
try {
  dotenv.config();
} catch (error) {
  console.warn('Failed to load .env file:', error.message);
}

// Default configuration values with fallbacks
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
  },

  // API keys (will be properly hidden in production builds)
  // NOTE: Client-side API keys are NEVER used for Alchemy - we always use the server proxy
  // which uses the server's environment variables instead
  ALCHEMY_API_KEY: null, // Disabled to force proxy usage
  ALCHEMY_BASE_URL: null, // Disabled to force proxy usage
  
  // Server configuration
  PORT: process.env.PORT || 3003,
  
  // MongoDB connection
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/gall3ry',
  
  // API Proxies - Always use absolute URLs to avoid path issues
  API_BASE_URL: process.env.API_BASE_URL || '/api',
  ALCHEMY_PROXY_URL: process.env.REACT_APP_API_URL 
    ? `${process.env.REACT_APP_API_URL}/alchemy` 
    : '/api/alchemy',
  OPENSEA_PROXY_URL: '/api/opensea',
  ZAPPER_PROXY_URL: process.env.REACT_APP_ZAPPER_PROXY_URL || '/api/zapper',
  
  // NFT Configuration
  DEFAULT_CHAIN: process.env.DEFAULT_CHAIN || 'eth',
  NFT_SERVICES: process.env.NFT_SERVICES 
    ? process.env.NFT_SERVICES.split(',') 
    : ['directAlchemy'], // Only use the directAlchemy service

  // Feature flags
  ENABLE_CACHING: process.env.ENABLE_CACHING !== 'false',
  ENABLE_LOGGING: process.env.ENABLE_LOGGING !== 'false',
  
  // Environment detection
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
  IS_VERCEL: !!process.env.VERCEL,

  // New configuration options
  NEYNAR_PROXY_URL: process.env.REACT_APP_NEYNAR_PROXY_URL || '/api/neynar',
  ZAPPER_API_KEY: process.env.REACT_APP_ZAPPER_API_KEY,
  NEYNAR_API_KEY: process.env.REACT_APP_NEYNAR_API_KEY,
  OPTIMISM_RPC_URL: process.env.REACT_APP_OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  FARCASTER_DOMAIN: process.env.REACT_APP_FARCASTER_DOMAIN || 'gall3ry.vercel.app',
  FARCASTER_SIWE_URI: process.env.REACT_APP_FARCASTER_SIWE_URI || 'https://gall3ry.vercel.app/login',
};

// Debug logging for proxy URLs
console.log('Config initialized with proxy URLs:', {
  alchemyProxy: config.ALCHEMY_PROXY_URL,
  zapperProxy: config.ZAPPER_PROXY_URL
});

// Ensure API paths are properly formatted for Vercel deployments
if (config.IS_VERCEL) {
  // Handle Vercel-specific configuration
  console.log('Running in Vercel environment, configuring API paths');
  
  // In Vercel, ensure we're always using relative API paths
  if (!config.ALCHEMY_PROXY_URL.startsWith('/api/')) {
    config.ALCHEMY_PROXY_URL = '/api/alchemy';
  }
  
  // Force directAlchemy as the NFT service in production
  config.NFT_SERVICES = ['directAlchemy'];
}

// Export all config values
module.exports = config;