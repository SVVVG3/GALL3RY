// Database status check endpoint as a dedicated serverless function
const { connectToMongoDB, corsHeaders } = require('./_utils');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).set(corsHeaders).end();
    return;
  }
  
  try {
    // Try to connect to MongoDB
    await connectToMongoDB();
    res.status(200).json({ 
      status: 'Database connected', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ 
      status: 'Database connection failed', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 