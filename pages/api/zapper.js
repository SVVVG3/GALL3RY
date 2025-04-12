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

  // Zapper API endpoint - make sure we're using the correct URL
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
  try {
    // Get API key from environment variable
    const apiKey = process.env.ZAPPER_API_KEY;
    
    // Extract query details for logging
    let queryName = 'unknown';
    let variablesSummary = {};
    
    try {
      if (req.body?.query) {
        // Try to extract the operation name from the query string
        const match = req.body.query.match(/query\s+([a-zA-Z0-9_]+)/);
        if (match && match[1]) {
          queryName = match[1];
        }
        
        // Parse important variable keys only
        if (req.body.variables) {
          if (req.body.variables.ownerAddress) {
            variablesSummary.ownerAddress = `${req.body.variables.ownerAddress.substring(0, 8)}...`;
          }
          if (req.body.variables.addresses) {
            variablesSummary.addresses = req.body.variables.addresses.length + ' addresses';
          }
          if (req.body.variables.limit) {
            variablesSummary.limit = req.body.variables.limit;
          }
          if (req.body.variables.cursor) {
            variablesSummary.cursor = 'present';
          }
          if (req.body.variables.username) {
            variablesSummary.username = req.body.variables.username;
          }
          if (req.body.variables.fid) {
            variablesSummary.fid = req.body.variables.fid;
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing GraphQL query details:', parseError);
    }
    
    // Log detailed request info for debugging
    console.log('Proxying request to Zapper API:', {
      method: 'POST',
      url: ZAPPER_API_URL,
      queryName,
      variables: variablesSummary,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      hasApiKey: !!apiKey
    });
    
    if (!apiKey) {
      console.warn('⚠️ ZAPPER_API_KEY not set in environment variables');
    }

    // Prepare headers - IMPORTANT: The Zapper API uses a specific authorization format
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add API key if available - note that Zapper API uses API key in the header
    if (apiKey) {
      // According to Zapper docs, their API key header format is:
      headers['Authorization'] = `Basic ${apiKey}`;
      
      // Some APIs also use x-api-key or x-zapper-api-key - include both for robustness
      headers['x-api-key'] = apiKey;
      headers['x-zapper-api-key'] = apiKey;
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
    
    // Log response status and length for debugging
    console.log(`Zapper API (${queryName}) responded with status: ${response.status}, length: ${responseText.length}`);
    
    // Parse response text to JSON if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      
      // Check if there are GraphQL errors to log them
      if (responseData.errors) {
        console.warn(`GraphQL errors for ${queryName}:`, responseData.errors);
      }
      
      // Check if data is empty
      if (!responseData.data || Object.keys(responseData.data).length === 0) {
        console.warn(`Empty data in response for ${queryName}`);
      } else {
        // Log summary of the response structure
        const dataSummary = {};
        for (const key in responseData.data) {
          if (responseData.data[key]) {
            // Add some summary info based on the query type
            if (key === 'nfts' && responseData.data[key].items) {
              dataSummary.nfts = `${responseData.data[key].items.length} items`;
            } else if (key === 'portfolioV2' && responseData.data[key].nftBalances?.nfts?.edges) {
              dataSummary.portfolioV2 = `${responseData.data[key].nftBalances.nfts.edges.length} NFTs`;
            } else if (key === 'farcasterProfile') {
              const profile = responseData.data[key];
              dataSummary.farcasterProfile = 
                `username: ${profile.username}, ` +
                `custodyAddress: ${profile.custodyAddress || 'none'}, ` +
                `connectedAddresses: ${profile.connectedAddresses?.length || 0}`;
            } else {
              dataSummary[key] = 'present';
            }
          }
        }
        
        console.log(`Response data summary for ${queryName}:`, dataSummary);
      }
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