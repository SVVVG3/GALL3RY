// Consolidated API handler for Vercel deployment
const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// DB status endpoint (simplified)
app.get('/db-status', (req, res) => {
  res.status(200).json({ 
    status: 'Database check bypassed for testing',
    message: 'Database connection disabled during core functionality testing'
  });
});

// Add additional endpoints as needed
app.get('/neynar', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Neynar API endpoint placeholder'
  });
});

app.post('/zapper', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Zapper API endpoint placeholder'
  });
});

// Catch-all route for unmatched API endpoints
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested API endpoint does not exist'
  });
});

// Vercel serverless function handler
module.exports = (req, res) => {
  // Get the path from the URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  // Remove any '/api' prefix that Vercel might add
  req.url = url.pathname.replace(/^\/api/, '');
  if (req.url === '') req.url = '/';
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Process the request with Express
  return app(req, res);
}; 