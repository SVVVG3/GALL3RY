// Simple health check endpoint for Vercel
module.exports = (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Return health status
  res.status(200).json({ 
    status: 'ok', 
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}; 