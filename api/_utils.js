// Utility functions for serverless API endpoints
const mongoose = require('mongoose');
const axios = require('axios');
const NodeCache = require('node-cache');

// Initialize cache
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 1000 // Maximum number of keys to store
});

// Cache keys
const CACHE_KEYS = {
  FARCASTER_PROFILE: (username) => `farcaster_profile_${username}`,
  NFT_DATA: (addresses) => `nft_data_${addresses.sort().join('_')}`,
  NFT_IMAGE: (contract, tokenId) => `nft_image_${contract}_${tokenId}`
};

// Connect to MongoDB
let dbConnection = null;
const connectToMongoDB = async () => {
  if (dbConnection) return dbConnection;
  
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log('Attempting to connect to MongoDB...');
    
    dbConnection = await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('MongoDB connected successfully');
    return dbConnection;
  } catch (err) {
    console.error('MongoDB connection failed:', err);
    throw err;
  }
};

// Authentication middleware
const verifyAuth = async (req) => {
  // In development, we can disable auth for testing
  if (process.env.DISABLE_AUTH === 'true') {
    return { userId: process.env.DEFAULT_USER_ID || '1234' };
  }
  
  // Check for Authorization header
  const fid = req.headers.authorization;
  if (!fid) {
    throw new Error('Authorization header is required');
  }
  
  // In a real app, we would verify the token
  // For simplicity, we'll just use the FID directly
  return { userId: fid };
};

// Cors headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

// Helper to handle OPTIONS requests for CORS
const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).send(corsHeaders);
    return true;
  }
  return false;
};

module.exports = {
  cache,
  CACHE_KEYS,
  connectToMongoDB,
  verifyAuth,
  corsHeaders,
  handleOptions
}; 