// Next.js API route for proxying Zapper GraphQL requests
import axios from 'axios';

// Zapper API endpoint
const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';

/**
 * API handler to proxy requests to Zapper's GraphQL API
 * This prevents CORS issues and keeps API keys private
 */
export default async function handler(req, res) {
  // Only allow POST method for GraphQL requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Log request for debugging (optional)
    console.log('Proxying request to Zapper API:', {
      url: ZAPPER_API_URL,
      bodyLength: req.body ? JSON.stringify(req.body).length : 0,
    });

    // Get API key from environment variable
    const apiKey = process.env.ZAPPER_API_KEY;
    
    if (!apiKey) {
      console.warn('ZAPPER_API_KEY not set in environment variables');
    }

    // Make request to Zapper API
    const response = await axios.post(
      ZAPPER_API_URL,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': apiKey ? `Basic ${apiKey}` : undefined
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // Send response back to client
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    // Check if it's an axios error with response
    if (error.response) {
      // Return the status code and data from the Zapper API
      return res.status(error.response.status).json({
        error: 'Zapper API error',
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