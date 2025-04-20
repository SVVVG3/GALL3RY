// Verify Sign In With Farcaster (SIWF) credentials
const { verifySignInMessage } = require('@farcaster/auth-kit/server');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Environment variables (ideally these would be in your .env file)
const FARCASTER_DOMAIN = process.env.FARCASTER_DOMAIN || 'gall3ry.vercel.app';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = '24h'; // Token expires in 24 hours

// Function to generate JWT token for authenticated users
const generateToken = (userData) => {
  return jwt.sign(
    { 
      fid: userData.fid,
      username: userData.username
    }, 
    JWT_SECRET, 
    { expiresIn: TOKEN_EXPIRY }
  );
};

module.exports = async (req, res) => {
  console.log('SIWF verification request received');
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  
  try {
    // Carefully parse request body 
    let body;
    
    try {
      // If req.body is already parsed (e.g., by a framework middleware)
      if (req.body && typeof req.body === 'object') {
        body = req.body;
      } 
      // If we need to parse the request body ourselves (raw body)
      else if (req.body && typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } 
      // If we have no body yet, but might have raw body data
      else if (typeof req.rawBody === 'string') {
        body = JSON.parse(req.rawBody);
      }
      // Fallback to an empty object
      else {
        body = {};
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    
    const { message, signature, nonce } = body;
    
    if (!message || !signature) {
      console.error('Missing required parameters: message or signature');
      return res.status(400).json({ error: 'Missing required parameters: message or signature' });
    }
    
    // Log the received data types
    console.log(`Message type: ${typeof message}, length: ${message?.length || 0}`);
    console.log(`Signature type: ${typeof signature}, length: ${signature?.length || 0}`);
    console.log(`Nonce: ${nonce}`);
    
    // For debugging in Vercel - log the complete objects
    console.log('Message content:', message);
    console.log('Signature:', signature);
    
    // Verify the message and signature
    try {
      // Add debug mode to get more details
      const verifyResult = await verifySignInMessage({
        message,
        signature,
        domain: FARCASTER_DOMAIN, // This should match the domain in your Mini App configuration
        debug: true
      });
      
      console.log('Complete verification result:', JSON.stringify(verifyResult, null, 2));
      
      if (!verifyResult.success) {
        console.error('Verification failed:', verifyResult.error);
        return res.status(401).json({ error: `Verification failed: ${verifyResult.error}` });
      }
      
      // According to the docs, the structure is different based on the version
      // Let's handle both potential structures
      let userData;
      
      if (verifyResult.data && verifyResult.data.userInfo) {
        // New structure
        const { fid, username, displayName, pfpUrl } = verifyResult.data.userInfo;
        userData = {
          fid: String(fid),
          username: username || `user${fid}`,
          displayName: displayName || username || `User ${fid}`,
          pfp: { url: pfpUrl || null }
        };
      } else if (verifyResult.data) {
        // Old structure - direct properties on data
        const { fid, username, displayName, pfpUrl } = verifyResult.data;
        userData = {
          fid: String(fid),
          username: username || `user${fid}`,
          displayName: displayName || username || `User ${fid}`,
          pfp: { url: pfpUrl || null }
        };
      } else {
        // Fallback in case of unexpected structure
        console.error('Unexpected verification result structure:', verifyResult);
        return res.status(500).json({ error: 'Invalid verification result structure' });
      }
      
      console.log(`Successfully verified user: ${userData.username} (FID: ${userData.fid})`);
      
      // Generate a JWT token for the user
      const token = generateToken(userData);
      
      // Return the verified user data and token
      return res.status(200).json({ 
        userData,
        token 
      });
    } catch (verifyError) {
      console.error('Error during verification:', verifyError);
      return res.status(500).json({ error: `Verification error: ${verifyError.message}` });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}; 