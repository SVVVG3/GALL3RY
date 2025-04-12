// Simple NFT lookup API endpoint
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get address from query params or body
  let addresses = [];
  if (req.method === 'GET') {
    // For GET, use query parameters
    const { address, addresses: addressesStr } = req.query;
    
    if (address) {
      addresses.push(address);
    }
    
    if (addressesStr) {
      try {
        // Try to parse as JSON array
        const parsed = JSON.parse(addressesStr);
        if (Array.isArray(parsed)) {
          addresses = [...addresses, ...parsed];
        }
      } catch (e) {
        // If not JSON, try comma-separated string
        addresses = [...addresses, ...addressesStr.split(',')];
      }
    }
  } else {
    // For POST, use request body
    const { address, addresses: addressesArray } = req.body || {};
    
    if (address) {
      addresses.push(address);
    }
    
    if (Array.isArray(addressesArray)) {
      addresses = [...addresses, ...addressesArray];
    }
  }
  
  // Remove duplicates and empty values
  addresses = [...new Set(addresses.filter(Boolean))];
  
  if (addresses.length === 0) {
    return res.status(400).json({ error: 'Missing address parameter' });
  }

  try {
    console.log(`Looking up NFTs for ${addresses.length} addresses:`, addresses);
    
    // Get Zapper API key
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    // Build GraphQL query for NFTs
    const query = `
      query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String) {
        nftUsersTokens(owners: $owners, first: $first, after: $after) {
          edges {
            node {
              id
              tokenId
              name
              collection {
                id
                name
                address
                network
                floorPrice {
                  valueUsd
                }
              }
              mediasV3 {
                images(first: 1) {
                  edges {
                    node {
                      original
                      large
                      thumbnail
                    }
                  }
                }
              }
              estimatedValue {
                valueUsd
                valueWithDenomination
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    // Variables for the query
    const variables = {
      owners: addresses,
      first: 50,
      after: null
    };
    
    // Make request to Zapper API
    const response = await fetch('https://api.zapper.xyz/v2/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiKey ? { 'Authorization': `Basic ${apiKey}` } : {})
      },
      body: JSON.stringify({
        query,
        variables
      })
    });
    
    // Get response as text first
    const responseText = await response.text();
    
    // Parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return res.status(500).json({
        error: 'Invalid JSON response from Zapper API',
        responsePreview: responseText.substring(0, 500)
      });
    }
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(500).json({
        error: 'GraphQL errors',
        details: data.errors
      });
    }
    
    // Extract NFTs from response
    const nftData = data.data?.nftUsersTokens;
    if (!nftData) {
      return res.status(500).json({
        error: 'Invalid response format',
        data
      });
    }
    
    // Process NFTs into a more usable format
    const nfts = nftData.edges.map(edge => {
      const nft = edge.node;
      
      // Extract image URL
      let imageUrl = null;
      if (nft.mediasV3?.images?.edges?.length > 0) {
        const image = nft.mediasV3.images.edges[0].node;
        imageUrl = image.large || image.original || image.thumbnail;
      }
      
      return {
        id: nft.id,
        tokenId: nft.tokenId,
        name: nft.name || `#${nft.tokenId}`,
        imageUrl,
        collection: nft.collection ? {
          id: nft.collection.id,
          name: nft.collection.name,
          address: nft.collection.address,
          network: nft.collection.network,
          floorPrice: nft.collection.floorPrice?.valueUsd
        } : null,
        estimatedValue: nft.estimatedValue?.valueUsd,
        estimatedValueFormatted: nft.estimatedValue?.valueWithDenomination
      };
    });
    
    // Return response with NFTs and pagination info
    return res.status(200).json({
      nfts,
      pagination: {
        hasMore: nftData.pageInfo.hasNextPage,
        endCursor: nftData.pageInfo.endCursor
      }
    });
    
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred'
    });
  }
}; 