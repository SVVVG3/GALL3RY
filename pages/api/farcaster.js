// Next.js API route for proxying Farcaster API requests
// Using lightweight fetch instead of axios for better reliability

/**
 * API handler to proxy requests to Farcaster's API
 */
export default async function handler(req, res) {
  // Get endpoint and method from query params
  const { endpoint } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }
  
  // Farcaster API endpoint
  const FARCASTER_API_URL = 'https://api.warpcast.com/v2';
  const apiUrl = `${FARCASTER_API_URL}/${endpoint}`;
  
  try {
    // Log request for debugging
    console.log('Proxying request to Farcaster API:', {
      method: req.method,
      url: apiUrl,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
    });
    
    // Get API key from environment variable
    const apiKey = process.env.FARCASTER_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ FARCASTER_API_KEY not set in environment variables');
    }
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add API key if available
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    // Prepare request options
    const fetchOptions = {
      method: req.method,
      headers: headers,
      // Set reasonable timeout
      signal: AbortSignal.timeout(15000) // 15 second timeout
    };
    
    // Add body for POST/PUT/PATCH methods
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    // Make request to Farcaster API using native fetch
    const response = await fetch(apiUrl, fetchOptions);
    
    // Get response as text first to avoid JSON parsing errors
    const responseText = await response.text();
    
    // Log response status for debugging
    console.log(`Farcaster API responded with status: ${response.status}`);
    
    // Parse response text to JSON if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      // If we can't parse JSON, return the text as is in an error object
      return res.status(response.status).json({
        error: 'Invalid JSON response from Farcaster API',
        rawResponse: responseText.substring(0, 1000) // Limit size of response
      });
    }
    
    // If the response was not ok, return error with details
    if (!response.ok) {
      console.error(`Farcaster API error (${response.status}):`, responseData);
      return res.status(response.status).json({
        error: 'Farcaster API error',
        details: responseData
      });
    }
    
    // Send response back to client
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Error proxying to Farcaster API:', error);
    
    // Handle different types of errors
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Request to Farcaster API timed out'
      });
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(502).json({
        error: 'Bad gateway',
        message: 'Could not connect to Farcaster API'
      });
    }
    
    // For other types of errors
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  }
} 