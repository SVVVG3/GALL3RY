// Next.js API route for proxying Zapper GraphQL requests
// Using lightweight fetch instead of axios for better reliability

/**
 * API handler to proxy requests to Zapper's GraphQL API
 * This prevents CORS issues and keeps API keys private
 */
export default async function handler(req, res) {
  // Only allow POST method for GraphQL requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Zapper API endpoint
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
  try {
    // Get API key from environment variable
    const apiKey = process.env.ZAPPER_API_KEY;
    
    // Log detailed request info for debugging
    console.log('Proxying request to Zapper API:', {
      method: 'POST',
      url: ZAPPER_API_URL,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      hasApiKey: !!apiKey
    });
    
    if (!apiKey) {
      console.warn('⚠️ ZAPPER_API_KEY not set in environment variables');
    }

    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add API key if available
    if (apiKey) {
      headers['Authorization'] = `Basic ${apiKey}`;
    }
    
    // Make request to Zapper API using native fetch
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body),
      // Set reasonable timeout
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });
    
    // Get response as text first to avoid JSON parsing errors
    const responseText = await response.text();
    
    // Log response status for debugging
    console.log(`Zapper API responded with status: ${response.status}`);
    
    // Parse response text to JSON if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      // If we can't parse JSON, return the text as is in an error object
      return res.status(response.status).json({
        error: 'Invalid JSON response from Zapper API',
        rawResponse: responseText.substring(0, 1000) // Limit size of response
      });
    }
    
    // If the response was not ok, return error with details
    if (!response.ok) {
      console.error(`Zapper API error (${response.status}):`, responseData);
      return res.status(response.status).json({
        error: 'Zapper API error',
        details: responseData
      });
    }
    
    // Send response back to client
    return res.status(response.status).json(responseData);
    
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    // Handle different types of errors
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'Request to Zapper API timed out'
      });
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(502).json({
        error: 'Bad gateway',
        message: 'Could not connect to Zapper API'
      });
    }
    
    // For other types of errors
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error occurred'
    });
  }
} 