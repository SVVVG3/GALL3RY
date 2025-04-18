// Mock implementation of collection-friends API
// Returns fake data for testing without calling external APIs

// CORS headers helper
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Handler function
module.exports = async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get request parameters
  const { contractAddress, fid, limit = 50 } = req.query;
  
  console.log(`[Collection Friends Mock] Request for contract=${contractAddress}, fid=${fid}, limit=${limit}`);
  
  // Validate required parameters
  if (!contractAddress) {
    return res.status(400).json({ 
      error: 'Missing parameter', 
      message: 'contractAddress is required' 
    });
  }
  
  if (!fid) {
    return res.status(400).json({ 
      error: 'Missing parameter', 
      message: 'fid (Farcaster ID) is required' 
    });
  }
  
  // Generate random number of friends (0-10)
  const numFriends = Math.floor(Math.random() * 11);
  
  console.log(`[Collection Friends Mock] Generating ${numFriends} mock friends`);
  
  // Create mock friends data
  const mockFriends = Array.from({ length: numFriends }, (_, i) => ({
    fid: Math.floor(Math.random() * 1000000),
    username: `user${i + 1}`,
    displayName: `User ${i + 1}`,
    pfpUrl: `https://picsum.photos/seed/${i + 1}/200/200`,
    address: `0x${Math.random().toString(16).substring(2, 42)}`
  }));
  
  // Create response object
  const response = {
    contractAddress,
    friends: mockFriends.slice(0, parseInt(limit, 10)),
    totalFriends: mockFriends.length,
    hasMore: mockFriends.length > parseInt(limit, 10),
    mock: true
  };
  
  // Added small delay to simulate processing time
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Return response
  return res.status(200).json(response);
}; 