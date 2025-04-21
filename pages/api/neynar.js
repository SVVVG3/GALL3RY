import axios from 'axios';

// API handler for proxying requests to Neynar API
export default async function handler(req, res) {
  try {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get params from the query
    const { endpoint, ...params } = req.query;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    // Get API key from environment variables
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    
    if (!NEYNAR_API_KEY) {
      return res.status(500).json({ error: 'Neynar API key not configured' });
    }

    console.log(`Proxying request to Neynar API: ${endpoint} with params:`, params);

    // Construct the Neynar API URL
    const baseUrl = 'https://api.neynar.com/v2/farcaster';
    const apiUrl = `${baseUrl}/${endpoint}`;

    // Make the request to Neynar API
    const response = await axios.get(apiUrl, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      params,
      timeout: 10000 // 10 second timeout
    });

    console.log(`Neynar API response status: ${response.status}`);
    
    // Return the response as-is from Neynar
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying request to Neynar API:', error);
    
    // Return appropriate error response
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { error: error.message || 'Unknown error' };
    
    return res.status(status).json(errorData);
  }
} 