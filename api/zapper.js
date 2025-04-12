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
      : query.includes('portfolioV2') ? 'PORTFOLIO'
      : query.includes('nftUsersTokens') ? 'NFT_USERS_TOKENS'
      : query.includes('nfts(') ? 'NFTS_QUERY_NEW' 
      : 'OTHER';
    
    // Enhanced logging for debugging
    console.log(`[ZAPPER] Processing ${queryType} query:`, {
      queryPreview: query.substring(0, 100) + '...',
      variablesKeys: Object.keys(variables || {}),
      addresses: variables?.addresses ? `${variables.addresses.length} addresses` : 'none',
      owners: variables?.owners ? `${variables.owners.length} owners` : 'none',
      collectionIds: variables?.collectionIds || 'none',
      collectionAddress: variables?.collectionAddress || 'none'
    });

    // Transform deprecated or invalid queries to match current schema
    if (queryType === 'NFT_USERS_TOKENS') {
      // This query is already in the correct format according to the schema
      // Just make sure the parameters are correctly formatted
      console.log('[ZAPPER] Validating nftUsersTokens query');
      
      // Ensure we have owners array
      if (!variables.owners || !Array.isArray(variables.owners)) {
        return res.status(400).json({
          error: 'Invalid parameters',
          message: 'owners parameter must be an array of addresses'
        });
      }
      
      // Ensure collectionIds is correctly formatted if present
      if (variables.collectionIds && !Array.isArray(variables.collectionIds)) {
        variables.collectionIds = [variables.collectionIds];
      }
      
      // Add default first parameter if missing, but don't override if provided
      if (!variables.first) {
        variables.first = 100;
      } else if (typeof variables.first === 'string') {
        // Convert string to number if needed
        variables.first = parseInt(variables.first, 10);
      }
      
      // Add default withOverrides parameter
      variables.withOverrides = true;
      
      console.log('[ZAPPER] Query validated and parameters normalized with batch size:', variables.first);
    } else if (queryType === 'PORTFOLIO') {
      console.log('[ZAPPER] Processing portfolio query for current schema');
      
      // Check if it's an outdated portfolio query
      if (query.includes('nftBalances(first:') || query.includes('pageInfo') || 
          (query.includes('nftBalances') && query.includes('nfts '))) {
        
        console.log('[ZAPPER] Transforming outdated portfolioV2 query to match current schema');
        
        // Use the updated schema
        query = query
          .replace('nftBalances(first: $first)', 'nftBalances')
          .replace('nftBalances(first: $first, after: $after)', 'nftBalances(skip: $skip)')
          .replace(/pageInfo\s*{\s*hasNextPage\s*endCursor\s*}/g, 'pageCount\ntotalCount')
          .replace(/nfts\s*{/g, 'items {\nnft {');
        
        // Add closing bracket for nft object if needed
        if (query.includes('items {\nnft {') && !query.includes('}\n}')) {
          query = query.replace(/}\s*}\s*}\s*}/g, '}\n}\n}\n}\n}');
        }
        
        console.log('[ZAPPER] Transformed query:', query.substring(0, 200) + '...');
      }
    } else if (queryType === 'NFTS_QUERY_OLD') {
      console.log('[ZAPPER] Transforming deprecated nftUsersTokens query to use current schema');
      
      const ownerAddresses = variables.owners || [];
      const limit = variables.first || 50;
      
      // Use the correct schema
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
                estimatedValue {
                  valueWithDenomination
                  denomination {
                    symbol
                  }
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
      // So transform it to use portfolioV2 instead
      console.log('[ZAPPER] Converting nfts query to use portfolioV2 schema');
      
      const addresses = variables.addresses || [];
      
      // Use the correct schema that works with the current Zapper API
      query = `
        query GetNFTs($addresses: [Address!]!) {
          portfolioV2(addresses: $addresses) {
            nftBalances {
              items {
                nft {
                  id
                  name
                  imageUrl
                  tokenId
                  collection {
                    name
                    address
                    imageUrl
                    floorPrice
                    network
                  }
                  estimatedValue {
                    valueWithDenomination
                    denomination {
                      symbol
                    }
                  }
                  metadata {
                    name
                    description
                    image
                  }
                }
              }
              pageCount
              totalCount
            }
          }
        }
      `;
      
      // Convert variables to match the required format
      variables = {
        addresses: addresses
      };
      
      console.log('[ZAPPER] Query converted to use portfolioV2 schema');
    }

    // Simple cache check with a more specific key for detailed variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ 
      query, 
      type: queryType,
      vars: JSON.stringify(variables).substring(0, 100) 
    })).toString('base64')}`;
    
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('[ZAPPER] Cache hit');
      return res.status(200).json(cachedData);
    }

    // For debugging: log the full request being sent to Zapper
    console.log('[ZAPPER] Full request to Zapper API:', {
      query: query.substring(0, 500) + (query.length > 500 ? '...' : ''),
      variables: JSON.stringify(variables).substring(0, 500) + 
                (JSON.stringify(variables).length > 500 ? '...' : '')
    });
    
    // Make the request to Zapper API with better error handling
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
      console.log(`[ZAPPER] Request successful, status: ${zapperResponse.status}`);
      
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
      
      // Process the response data: deduplicate NFTs and normalize values
      let processedData = zapperResponse.data;
      
      // Deduplicate NFTs based on unique token IDs
      if (queryType === 'NFT_USERS_TOKENS' && processedData.data?.nftUsersTokens?.edges) {
        processedData = deduplicateNfts(processedData);
      } else if (queryType === 'PORTFOLIO' && processedData.data?.portfolioV2?.nftBalances?.items) {
        processedData = deduplicatePortfolioNfts(processedData);
      } else if (queryType === 'NFTS_QUERY_NEW' && processedData.data?.portfolioV2?.nftBalances?.items) {
        processedData = deduplicatePortfolioNfts(processedData);
      }
      
      // Cache the response with a shorter TTL for large responses
      const responseSize = JSON.stringify(processedData).length;
      const ttl = responseSize > 1000000 ? 60 : 300; // 1 minute for large responses, 5 minutes for smaller ones
      cache.set(cacheKey, processedData, ttl);
      
      return res.status(200).json(processedData);
    } catch (error) {
      // Handle request errors with detailed information
      console.error('[ZAPPER] Zapper API request failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Return a detailed error response
      return res.status(error.response?.status || 500).json({
        error: 'Zapper API error',
        status: error.response?.status || 500,
        message: error.message,
        details: error.response?.data || {}
      });
    }
  } catch (error) {
    // Handle overall handler errors
    console.error('[ZAPPER] Handler error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Deduplicate NFTs based on their unique token identifiers
 * This prevents the same NFT from appearing multiple times in the results
 */
const deduplicateNfts = (data) => {
  if (!data.data?.nftUsersTokens?.edges) return data;
  
  console.log('[ZAPPER] Deduplicating NFTs, original count:', data.data.nftUsersTokens.edges.length);
  
  const uniqueNfts = new Map();
  const dedupedEdges = [];
  
  // Process each NFT
  data.data.nftUsersTokens.edges.forEach(edge => {
    if (!edge.node) return;
    
    // Create a unique key for each NFT based on collection address and token ID
    const nft = edge.node;
    const collectionAddr = nft.collection?.address || '';
    const tokenId = nft.tokenId || '';
    const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
    
    // Only add if we haven't seen this NFT before
    if (!uniqueNfts.has(uniqueKey)) {
      uniqueNfts.set(uniqueKey, true);
      dedupedEdges.push(edge);
    }
  });
  
  console.log('[ZAPPER] After deduplication:', dedupedEdges.length);
  
  // Update the response data with deduplicated NFTs
  data.data.nftUsersTokens.edges = dedupedEdges;
  return data;
};

/**
 * Deduplicate NFTs in portfolio response format
 */
const deduplicatePortfolioNfts = (data) => {
  if (!data.data?.portfolioV2?.nftBalances?.items) return data;
  
  console.log('[ZAPPER] Deduplicating portfolio NFTs, original count:', data.data.portfolioV2.nftBalances.items.length);
  
  const uniqueNfts = new Map();
  const dedupedItems = [];
  
  // Process each NFT item
  data.data.portfolioV2.nftBalances.items.forEach(item => {
    if (!item.nft) return;
    
    // Create a unique key for each NFT based on collection address and token ID
    const nft = item.nft;
    const collectionAddr = nft.collection?.address || '';
    const tokenId = nft.tokenId || '';
    const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
    
    // Only add if we haven't seen this NFT before
    if (!uniqueNfts.has(uniqueKey)) {
      uniqueNfts.set(uniqueKey, true);
      dedupedItems.push(item);
    }
  });
  
  console.log('[ZAPPER] After portfolio deduplication:', dedupedItems.length);
  
  // Update the response data with deduplicated NFTs
  data.data.portfolioV2.nftBalances.items = dedupedItems;
  return data;
};

module.exports = handler; 