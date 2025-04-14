// Simple API endpoint for Vercel
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// Handle database status without connecting
app.get('/db-status', (req, res) => {
  res.status(200).json({ 
    status: 'Database check bypassed for testing',
    message: 'Database connection disabled during core functionality testing'
  });
});

// Export the Express app as the handler for Vercel
module.exports = (req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Process the request with Express
  return app(req, res);
}; 