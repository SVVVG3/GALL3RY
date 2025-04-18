// This file bridges between local Express server and Vercel serverless functions
// It helps ensure consistent behavior between local development and Vercel deployment

const allInOne = require('./all-in-one.js');

// This is the conventional Express router for use in server.js
const express = require('express');
const router = express.Router();

// Redirect collection-friends requests to the all-in-one handler with action=collectionFriends
router.get('/collection-friends', (req, res) => {
  // Get the original query parameters
  const { contractAddress, fid, network, limit } = req.query;
  
  // Create a new URL with action=collectionFriends parameter
  // This modifies the request to be compatible with all-in-one.js format
  req.url = `/api/all-in-one?action=collectionFriends&contractAddress=${contractAddress}&fid=${fid}${network ? `&network=${network}` : ''}${limit ? `&limit=${limit}` : ''}`;
  
  console.log(`Redirecting collection-friends request to all-in-one: ${req.url}`);
  
  // Pass the modified request to the all-in-one handler
  return allInOne(req, res);
});

// Debug route for collection-friends with more detailed error reporting
router.get('/collection-friends-debug', async (req, res) => {
  try {
    // Get the original query parameters
    const { contractAddress, fid, network, limit } = req.query;
    
    if (!contractAddress) {
      return res.status(400).json({ error: 'Missing contractAddress parameter' });
    }
    
    if (!fid) {
      return res.status(400).json({ error: 'Missing fid parameter' });
    }
    
    console.log(`Debug route: Processing collection-friends for contract=${contractAddress}, fid=${fid}`);
    
    // Create a new URL with action=collectionFriends parameter
    req.url = `/api/all-in-one?action=collectionFriends&contractAddress=${contractAddress}&fid=${fid}${network ? `&network=${network}` : ''}${limit ? `&limit=${limit}` : ''}`;
    
    // Wrap the all-in-one handler in a try-catch for better error reporting
    try {
      return await allInOne(req, res);
    } catch (error) {
      console.error('Error in collection-friends-debug:', error);
      return res.status(500).json({
        error: 'Internal server error in debug route',
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
  } catch (outerError) {
    console.error('Unexpected error in debug route wrapper:', outerError);
    return res.status(500).json({
      error: 'Fatal error in debug route',
      message: outerError.message,
      stack: outerError.stack
    });
  }
});

// Also allow direct access to the all-in-one.js handler
router.all('/all-in-one', allInOne);

// Health check endpoint
router.get('/health', (req, res) => {
  return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export the router for server.js
module.exports = router; 