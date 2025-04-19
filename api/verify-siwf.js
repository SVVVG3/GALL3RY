// Verify Sign In With Farcaster (SIWF) credentials
const { verifySignInMessage } = require('@farcaster/auth-kit/server');

// Environment variables (ideally these would be in your .env file)
const FARCASTER_DOMAIN = process.env.FARCASTER_DOMAIN || 'gall3ry.vercel.app';

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
    // Parse request body
    const { message, signature } = req.body;
    
    if (!message || !signature) {
      console.error('Missing required parameters: message or signature');
      return res.status(400).json({ error: 'Missing required parameters: message or signature' });
    }
    
    // Log the received message and signature (truncated for security)
    console.log(`Verifying message: ${message?.substring(0, 50)}... (truncated)`);
    console.log(`With signature: ${signature?.substring(0, 20)}... (truncated)`);
    
    // Verify the message and signature
    const verifyResult = await verifySignInMessage({
      message,
      signature,
      domain: FARCASTER_DOMAIN, // This should match the domain in your Mini App configuration
    });
    
    if (!verifyResult.success) {
      console.error('Verification failed:', verifyResult.error);
      return res.status(401).json({ error: `Verification failed: ${verifyResult.error}` });
    }
    
    const { fid, username, displayName, pfpUrl } = verifyResult.data;
    
    // Create user data object
    const userData = {
      fid,
      username,
      displayName: displayName || username,
      pfp: { url: pfpUrl || null }
    };
    
    console.log(`Successfully verified user: ${username} (FID: ${fid})`);
    
    // Return the verified user data
    return res.status(200).json(userData);
  } catch (error) {
    console.error('Error verifying SIWF credentials:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}; 