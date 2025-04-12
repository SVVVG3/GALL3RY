// Next.js API route for proxying Farcaster API requests
import axios from 'axios';

// Farcaster API endpoint
const FARCASTER_API_URL = 'https://api.warpcast.com/v2';

/**
 * API handler to proxy requests to Farcaster's API
 */
export default async function handler(req, res) {
  // Get endpoint and method from query params
  const { endpoint } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }
  
  const apiUrl = `${FARCASTER_API_URL}/${endpoint}`;
  
  try {
    // Log request for debugging
    console.log('Proxying request to Farcaster API:', {
      url: apiUrl,
      method: req.method,
      bodyLength: req.body ? JSON.stringify(req.body).length : 0,
    });
    
    // Get API key from environment variable
    const apiKey = process.env.FARCASTER_API_KEY;
    
    // Configure request options
    const options = {
      method: req.method,
      url: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    };
    
    // Add API key if available
    if (apiKey) {
      options.headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      console.warn('FARCASTER_API_KEY not set in environment variables');
    }
    
    // Add body for POST/PUT/PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      options.data = req.body;
    }
    
    // Add query params for GET requests
    if (req.method === 'GET' && req.query) {
      // Remove the endpoint param as it's used for routing
      const { endpoint, ...queryParams } = req.query;
      options.params = queryParams;
    }
    
    // Make request to Farcaster API
    const response = await axios(options);
    
    // Send response back to client
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error proxying to Farcaster API:', error);
    
    // Check if it's an axios error with response
    if (error.response) {
      // Return the status code and data from the Farcaster API
      return res.status(error.response.status).json({
        error: 'Farcaster API error',
        details: error.response.data
      });
    }
    
    // For other types of errors
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
} 