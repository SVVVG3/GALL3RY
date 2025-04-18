const express = require('express');
const router = express.Router();

// Import the all-in-one.js file
const allInOne = require('./all-in-one.js');

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

// Export the router
module.exports = router; 