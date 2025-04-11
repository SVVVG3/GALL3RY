const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues and protect API keys
 */
const handler = async (req, res) => {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY;
    if (!apiKey) {
      console.error('[ZAPPER] Missing API key');
      return res.status(500).json({ 
        error: 'Configuration error',
        message: 'Zapper API key is missing'
      });
    }

    // Parse request body
    const requestBody = req.body || {};
    let { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'GraphQL query is required' 
      });
    }

    // Log query type for debugging
    const queryType = query.includes('farcasterProfile') ? 'PROFILE' 
      : query.includes('nfts(') ? 'NFTS_QUERY_NEW' 
      : query.includes('nftUsersTokens') ? 'NFTS_QUERY_OLD' 
      : 'OTHER';
    
    console.log(`[ZAPPER] Processing ${queryType} query`);

    // Transform deprecated queries to match current schema
    if (queryType === 'NFTS_QUERY_OLD') {
      console.log('[ZAPPER] Transforming deprecated nftUsersTokens query to use current schema');
      
      const ownerAddresses = variables.owners || [];
      const limit = variables.first || 50;
      
      // Use the correct schema from agents.txt
      query = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            after: $after
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                description
                mediasV2 {
                  ... on Image {
                    url
                    originalUri
                    original
                  }
                  ... on Animation {
                    url
                    originalUri
                    original
                  }
                }
                collection {
                  id
                  name
                  floorPriceEth
                  cardImageUrl
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
      
      // Keep original variables but ensure they match required format
      variables = {
        owners: ownerAddresses,
        first: limit,
        after: variables.after || null,
        withOverrides: true
      };
      
      console.log('[ZAPPER] Query transformed using current schema');
    } else if (queryType === 'NFTS_QUERY_NEW') {
      // We're using the new 'nfts' query which isn't in the schema
      // So transform it to use nftUsersTokens instead
      console.log('[ZAPPER] Converting nfts query to use nftUsersTokens schema');
      
      const addresses = variables.addresses || [];
      const limit = variables.limit || 50;
      
      // Use the correct schema from agents.txt
      query = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                description
                mediasV2 {
                  ... on Image {
                    url
                    originalUri
                    original
                  }
                  ... on Animation {
                    url
                    originalUri
                    original
                  }
                }
                collection {
                  id
                  name
                  floorPriceEth
                  cardImageUrl
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
      
      // Convert variables to match the required format
      variables = {
        owners: addresses,
        first: limit,
        withOverrides: true
      };
      
      console.log('[ZAPPER] Query converted to use nftUsersTokens schema');
    }

    // Simple cache check
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('[ZAPPER] Cache hit');
      return res.status(200).json(cachedData);
    }

    console.log(`[ZAPPER] Making request to Zapper API: ${variables.owners ? variables.owners.length : 0} addresses`);
    
    // Make the request to Zapper API
    try {
      const zapperResponse = await axios({
        url: 'https://public.zapper.xyz/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapper-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'gall3ry/2.1'
        },
        data: { query, variables },
        timeout: 15000
      });

      // Handle successful response
      console.log(`[ZAPPER] Request successful`);
      
      // Check for GraphQL errors
      if (zapperResponse.data.errors) {
        const errorMessages = zapperResponse.data.errors.map(e => e.message).join('; ');
        console.error(`[ZAPPER] GraphQL errors: ${errorMessages}`);
        
        return res.status(400).json({
          error: 'GraphQL errors',
          message: errorMessages,
          details: zapperResponse.data.errors
        });
      }
      
      // Cache the response with a shorter TTL for large responses
      const responseSize = JSON.stringify(zapperResponse.data).length;
      const ttl = responseSize > 1000000 ? 60 : 300; // 1 minute for large responses, 5 minutes for smaller ones
      cache.set(cacheKey, zapperResponse.data, ttl);
      
      // If we used nftUsersTokens but the client expected nfts format, transform the response
      if (queryType === 'NFTS_QUERY_NEW' && zapperResponse.data.data?.nftUsersTokens) {
        // Client expected nfts query but we used nftUsersTokens
        // We need to transform the response to match what the client expects
        console.log('[ZAPPER] Transforming nftUsersTokens response to nfts format');
        
        const nftUsersTokens = zapperResponse.data.data.nftUsersTokens;
        const edges = nftUsersTokens.edges || [];
        
        // Create a compatible response
        const nftsResponse = {
          data: {
            nfts: {
              items: edges.map(edge => {
                const node = edge.node;
                if (!node) return null;
                
                // Try to find a media URL
                let imageUrl = null;
                if (node.mediasV2 && node.mediasV2.length > 0) {
                  for (const media of node.mediasV2) {
                    if (!media) continue;
                    if (media.original) { imageUrl = media.original; break; }
                    if (media.originalUri) { imageUrl = media.originalUri; break; }
                    if (media.url) { imageUrl = media.url; break; }
                  }
                }
                
                // Collection image as fallback
                if (!imageUrl && node.collection?.cardImageUrl) {
                  imageUrl = node.collection.cardImageUrl;
                }
                
                // Process potential IPFS URLs for better compatibility
                if (imageUrl && imageUrl.startsWith('ipfs://')) {
                  imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
                }
                
                // Process potential Arweave URLs for better compatibility
                if (imageUrl && imageUrl.startsWith('ar://')) {
                  imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
                }
                
                // Build a compatible object structure
                return {
                  id: node.id,
                  tokenId: node.tokenId,
                  name: node.name || `NFT #${node.tokenId}`,
                  collection: {
                    id: node.collection?.id,
                    name: node.collection?.name || 'Unknown Collection',
                    floorPrice: {
                      value: node.collection?.floorPriceEth || 0,
                      symbol: 'ETH'
                    },
                    imageUrl: node.collection?.cardImageUrl
                  },
                  token: {
                    id: node.id,
                    tokenId: node.tokenId,
                    name: node.name || `NFT #${node.tokenId}`,
                    contractAddress: node.collection?.id ? node.collection.id.split(':')[1] : null,
                    networkId: node.collection?.id ? (node.collection.id.includes('ethereum') ? 1 : 
                                 node.collection.id.includes('polygon') ? 137 : 
                                 node.collection.id.includes('optimism') ? 10 : 
                                 node.collection.id.includes('arbitrum') ? 42161 : 
                                 node.collection.id.includes('base') ? 8453 : 1) : 1
                  },
                  imageUrl: imageUrl,
                  // Include raw mediasV2 data to let frontend handle all possible formats
                  mediasV2: node.mediasV2,
                  metadata: {
                    name: node.name,
                    description: node.description,
                    image: imageUrl
                  },
                  estimatedValue: {
                    value: node.collection?.floorPriceEth || 0,
                    token: {
                      symbol: 'ETH'
                    }
                  }
                };
              }).filter(Boolean)
            }
          }
        };
        
        // Cache and return the transformed response
        cache.set(`transformed_${cacheKey}`, nftsResponse, ttl);
        return res.status(200).json(nftsResponse);
      }
      
      // Return the original response
      return res.status(200).json(zapperResponse.data);
      
    } catch (apiError) {
      console.error(`[ZAPPER] API request failed: ${apiError.message}`);
      
      // Enhanced error handling with response inspection
      if (apiError.response) {
        const statusCode = apiError.response.status;
        const responseData = apiError.response.data;
        
        console.error(`[ZAPPER] Status: ${statusCode}, Data:`, responseData);
        
        return res.status(statusCode).json({
          error: 'Zapper API error',
          status: statusCode,
          message: apiError.message,
          details: responseData
        });
      }
      
      if (apiError.code === 'ECONNABORTED') {
        return res.status(504).json({
          error: 'Timeout',
          message: 'Zapper API request timed out'
        });
      }
      
      return res.status(502).json({
        error: 'API error',
        message: apiError.message
      });
    }
  } catch (error) {
    console.error(`[ZAPPER] Server error: ${error.message}`);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = handler; 