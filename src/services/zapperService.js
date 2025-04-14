import axios from 'axios';
// Completely remove any imports from NFTContext

// Define constants locally rather than importing them
// This helps break potential circular dependencies
const ZAPPER_API_URL = process.env.REACT_APP_ZAPPER_API_URL || 'https://api.zapper.xyz/v2';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;
const FALLBACK_ZAPPER_URL = 'https://api.zapper.fi/v2';

// Single cache for all API responses
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// Create a custom axios instance specifically for Zapper API calls
const zapperAxios = axios.create({
  headers: {
    'Content-Type': 'application/json',
    // Don't set User-Agent in browser environment
    // 'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
  }
});

// Add axios interceptor to ensure proper headers for all requests
axios.interceptors.request.use(
  config => {
    // We should NOT set User-Agent in browser environment
    // if (!config.headers['User-Agent']) {
    //   config.headers['User-Agent'] = 'GALL3RY/1.0 (https://gall3ry.vercel.app)';
    // }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Constants
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
// Updated endpoints to prioritize our proxy and properly format the direct endpoint
const ZAPPER_API_ENDPOINTS = [
  `${window.location.origin}/api/zapper`, // Use absolute URL with origin to ensure it works in all environments
  `${SERVER_URL}/api/zapper`,             // Fallback to SERVER_URL based endpoint
  'https://public.zapper.xyz/graphql'     // Direct Zapper API endpoint as last resort
];
// Direct endpoint is removed to prevent 404s - all requests should go through our proxy

// Use the unified cache for NFT data instead of separate caches
// const NFT_CACHE = new Map();
// const NFT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// // Add a cache for NFT data to reduce API calls
// const nftCache = new Map();
// const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Make a GraphQL request to the Zapper API with fallback endpoints
 * @param {string} query - GraphQL query
 * @param {object} variables - Query variables
 * @param {array} endpoints - API endpoints to try in order
 * @param {number} maxRetries - Maximum number of retries per endpoint
 * @returns {Promise<object>} - API response
 */
const makeGraphQLRequest = async (query, variables = {}, endpoints = ZAPPER_API_ENDPOINTS, maxRetries = 3) => {
  let lastError = null;
  
  // Try each endpoint
  for (const endpoint of endpoints) {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          // Don't set User-Agent in browser environment as it will cause errors
          // 'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
        };
        
        // If using direct Zapper API, add the API key if available
        if (endpoint.includes('zapper.xyz') && ZAPPER_API_KEY) {
          // Use the correct authentication header format per docs
          headers['x-zapper-api-key'] = ZAPPER_API_KEY;
        }
        
        console.log(`Trying endpoint: ${endpoint}, attempt ${retryCount + 1}/${maxRetries}`);
        
        // Use our custom zapperAxios instance with guaranteed User-Agent header
        const response = await zapperAxios.post(endpoint, {
          query,
          variables,
        }, { 
          headers,
          // Add a longer timeout to prevent premature timeouts
          timeout: 15000,
        });
        
        // First check if we have response.data
        if (!response.data) {
          throw new Error('Empty response from server');
        }
        
        // Log response details for debugging
        console.log('Response status:', response.status);
        console.log('Response shape:', {
          hasData: !!response.data,
          hasErrors: !!response.data.errors,
          dataKeys: response.data ? Object.keys(response.data) : [],
        });
        
        // Check if response has errors
        if (response.data.errors) {
          const errorMsg = response.data.errors[0]?.message || 'GraphQL error';
          console.error('GraphQL errors:', response.data.errors);
          throw new Error(errorMsg);
        }
        
        // If we're looking for a specific entity that doesn't exist,
        // handle that case without retrying
        if (response.data.data && 
            variables.username && 
            query.includes('farcasterProfile') && 
            !response.data.data.farcasterProfile) {
          console.log(`Farcaster profile not found for username: ${variables.username}`);
          
          // Create a custom error with a more descriptive message
          const notFoundError = new Error(`Could not find Farcaster profile for username: ${variables.username}`);
          notFoundError.code = 'PROFILE_NOT_FOUND';
          notFoundError.response = response;
          throw notFoundError;
        }
        
        // Return either response.data.data (standard GraphQL format) or response.data (direct format)
        // This handles different API formats that might be returned
        return response.data.data || response.data;
    } catch (error) {
        lastError = error;
        
        // If it's a known "not found" error, don't retry
        if (error.code === 'PROFILE_NOT_FOUND') {
          console.log('Not retrying for not found profile');
          throw error;
        }
        
        retryCount++;
        
        const errorMessage = error.response?.data || error.message;
        console.error(`Request failed for endpoint ${endpoint}, retry ${retryCount}/${maxRetries}:`, errorMessage);
        
        // If we haven't reached max retries, wait before trying again
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }
  
  // If we get here, all endpoints have failed
  console.error('All endpoints failed:', lastError);
  throw lastError;
};

/**
 * Get a Farcaster profile by username or FID
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @returns {Promise<object>} - Farcaster profile data
 */
export const getFarcasterProfile = async (usernameOrFid) => {
  if (!usernameOrFid) {
    throw new Error('Username or FID is required');
  }
      
  // Clean up the username - remove @, trim whitespace
  let cleanInput = usernameOrFid.toString().trim().replace(/^@/, '');
  
  // Determine if input is a FID (number) or username (string)
  const isFid = !isNaN(Number(cleanInput)) && cleanInput.indexOf('.') === -1;
  
  // For ENS names, we'll try both with and without .eth suffix as fallbacks
  let isEnsName = false;
  let alternativeUsername = null;
  
  if (!isFid && cleanInput.toLowerCase().endsWith('.eth')) {
    isEnsName = true;
    // Get the username without .eth
    alternativeUsername = cleanInput.substring(0, cleanInput.length - 4);
    console.log(`Input appears to be ENS name: ${cleanInput}, will also try: ${alternativeUsername}`);
  }
  
  // Construct the query variables based on input type - exactly matching Zapper API docs
  const variables = isFid 
    ? { fid: parseInt(cleanInput, 10) }
    : { username: cleanInput };
  
  console.log(`Fetching Farcaster profile for ${isFid ? 'FID' : 'username'}: ${cleanInput}`);
  
  // GraphQL query - exact match with Zapper API docs
  const query = `
    query GetFarcasterProfile($username: String, $fid: Int) {
      farcasterProfile(username: $username, fid: $fid) {
        username
        fid
        metadata {
          displayName
          description
          imageUrl
          warpcast
        }
        custodyAddress
        connectedAddresses
      }
    }
  `;
  
  try {
    // Log the request for debugging
    console.log('Fetching Farcaster profile for:', { username: variables.username, fid: variables.fid });
    
    const response = await makeGraphQLRequest(query, variables);
    
    // Log response details for debugging
    console.log('Response status:', response.status);
    
    // Check if response has GraphQL errors
    if (response.errors) {
      console.error('GraphQL errors:', response.errors);
      throw new Error(response.errors[0]?.message || 'Error fetching Farcaster profile');
    }
    
    // Check for data existence - data might be directly in response or in response.data
    const data = response.data || response;
    
    // Now check if the profile data is missing
    if (!data || !data.farcasterProfile) {
      console.error('Missing profile data in response:', response);
      throw new Error('Farcaster profile not found');
    }
    
    console.log('Found Farcaster profile:', data.farcasterProfile);
    return data.farcasterProfile;
  } catch (error) {
    console.error('Error in getFarcasterProfile:', error);
    throw error;
  }
};

/**
 * Get all wallet addresses associated with a Farcaster profile (both custody and connected)
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @returns {Promise<string[]>} - Array of all addresses associated with the Farcaster profile
 */
export const getFarcasterAddresses = async (usernameOrFid) => {
  try {
    // First get the Farcaster profile
    const profile = await getFarcasterProfile(usernameOrFid);
    
    if (!profile) {
      throw new Error(`No Farcaster profile found for ${usernameOrFid}`);
    }
    
    // Combine custody address and connected addresses, ensuring no duplicates
    const allAddresses = new Set();
    
    // Add custody address if available
    if (profile.custodyAddress) {
      allAddresses.add(profile.custodyAddress.toLowerCase());
    }
    
    // Add all connected addresses
    if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
      profile.connectedAddresses.forEach(addr => {
        if (addr) allAddresses.add(addr.toLowerCase());
      });
    }
    
    console.log(`Found ${allAddresses.size} unique addresses for Farcaster user ${profile.username} (FID: ${profile.fid})`);
    
    return Array.from(allAddresses);
  } catch (error) {
    console.error('Error fetching Farcaster addresses:', error);
    throw error;
  }
};

/**
 * Get portfolio data for a Farcaster user by username or FID
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @param {object} options - Options for the request
 * @returns {Promise<object>} - Portfolio data for the Farcaster user
 */
export const getFarcasterPortfolio = async (usernameOrFid, options = {}) => {
  // Step 1: Get all addresses associated with the Farcaster profile
  const addresses = await getFarcasterAddresses(usernameOrFid);
  
      if (!addresses || addresses.length === 0) {
    throw new Error(`No addresses found for Farcaster user: ${usernameOrFid}`);
  }
  
  // Step 2: Fetch portfolio data using the portfolioV2 endpoint
  const {
    includeTokens = true,
    includeNfts = true,
    includeApps = false,
    networks = null,
    limit = 100,
    cursor = null
  } = options;
  
  // Build a complete portfolio query based on what data is requested
  let portfolioFragments = [];
  
  if (includeTokens) {
    portfolioFragments.push(`
      tokenBalances {
        totalBalanceUSD
        byToken(first: ${limit}${cursor ? `, after: "${cursor}"` : ''}) {
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
          edges {
            node {
              symbol
              tokenAddress
              balance
              balanceUSD
              price
              imgUrlV2
              name
              network {
                name
              }
            }
          }
        }
      }
    `);
  }
  
  if (includeNfts) {
    portfolioFragments.push(`
      nftBalances {
        totalCount
        nfts(first: ${limit}${cursor ? `, after: "${cursor}"` : ''}) {
          pageInfo {
            endCursor
            hasNextPage
          }
          edges {
            node {
              id
              tokenId
              contractAddress
              name
              description
              imageUrl
              collection {
                id
                name
                address
                network
                imageUrl
                floorPrice
              }
              estimatedValue {
                amount
                currency
              }
              attributes {
                trait_type
                value
              }
              network
            }
          }
        }
      }
    `);
  }
  
  if (includeApps) {
    portfolioFragments.push(`
      appBalances {
        totalCount
        totalBalanceUSD
        apps {
          id
          name
          network {
            name
          }
          balanceUSD
        }
      }
    `);
  }
  
  const portfolioQuery = `
    query getPortfolio($addresses: [Address!]!) {
      portfolioV2(addresses: $addresses) {
        ${portfolioFragments.join('\n')}
      }
    }
  `;
  
  try {
    console.log(`Fetching portfolio data for ${addresses.length} Farcaster addresses:`, addresses);
    
    const response = await makeGraphQLRequest(portfolioQuery, { addresses });
    
    if (!response.data || !response.data.portfolioV2) {
      throw new Error('No portfolio data found');
    }
    
    return {
      portfolio: response.data.portfolioV2,
      addresses,
      farcasterUser: usernameOrFid
    };
  } catch (error) {
    console.error('Error fetching Farcaster portfolio:', error);
    throw error;
  }
};

/**
 * Get NFTs for multiple addresses with improved caching and pagination
 * Supports both direct parameters and options object for backward compatibility
 * @param {string[]} addresses - Array of wallet addresses 
 * @param {number|object} limitOrOptions - Either the limit number or full options object
 * @param {string|null} cursor - Pagination cursor (only used if limitOrOptions is a number)
 * @param {boolean} bypassCache - Whether to bypass cache (only used if limitOrOptions is a number)
 * @returns {Promise<object>} - Object containing NFTs and pagination info
 */
export const getNftsForAddresses = async (addresses, limitOrOptions = 50, cursor = null, bypassCache = false) => {
  if (!addresses || addresses.length === 0) {
    console.warn('No addresses provided for getNftsForAddresses');
    return { items: [], nfts: [], cursor: null, hasMore: false };
  }
  
  // Handle both parameter formats for backward compatibility
  let limit = 50;
  let options = {};
  
  // If second parameter is an object, treat it as options
  if (typeof limitOrOptions === 'object' && limitOrOptions !== null) {
    options = limitOrOptions;
    limit = options.limit || options.batchSize || 50;
    cursor = options.cursor || null;
    bypassCache = options.bypassCache || false;
  } else {
    // Otherwise use the direct parameters
    limit = limitOrOptions || 50;
  }
  
  // Normalize addresses to lowercase to ensure consistent caching
  const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
  
  // Additional options with defaults
  const cacheTTL = options.cacheTTL || CACHE_TTL;
  const endpoints = options.endpoints || ZAPPER_API_ENDPOINTS;
  const maxRetries = options.maxRetries || 3;
  
  // Generate a cache key based on addresses and cursor
  const cacheKey = `nfts:${normalizedAddresses.join(',')}-cursor:${cursor || 'initial'}`;
  
  // Check cache first if not bypassing
  if (!bypassCache && cache.has(cacheKey)) {
    const cachedData = cache.get(cacheKey);
    if (cachedData.timestamp > Date.now() - cacheTTL) {
      console.log(`Using cached NFT data for ${normalizedAddresses.length} addresses`);
      return cachedData.data;
    } else {
      // Remove expired cache entry
      cache.delete(cacheKey);
    }
  }
  
  try {
    // Fetch actual NFT tokens
    console.log(`Fetching NFTs for ${normalizedAddresses.length} addresses with cursor: ${cursor || 'initial'}, limit: ${limit}`);
    
    // Query structure directly from Zapper documentation
    const nftTokensQuery = `
      query UserNftTokens(
        $owners: [Address!]!,
        $network: Network,
        $first: Int = 100,
        $after: String,
        $search: String,
        $minEstimatedValueUsd: Float,
        $bypassHidden: Boolean = true
      ) {
        nftUsersTokens(
          owners: $owners,
          network: $network,
          first: $first,
          after: $after,
          search: $search,
          minEstimatedValueUsd: $minEstimatedValueUsd,
          bypassHidden: $bypassHidden
        ) {
          edges {
            node {
              # Basic token information
              id
              tokenId
              name
              description

              # Collection information
              collection {
                id
                name
                address
                network
                nftStandard
                type
                medias {
                  logo {
                    thumbnail
                  }
                }
              }

              # Media assets
              mediasV3 {
                images(first: 3) {
                  edges {
                    node {
                      original
                      thumbnail
                      large
                    }
                  }
                }
                animations(first: 1) {
                  edges {
                    node {
                      original
                      thumbnail
                      large
                    }
                  }
                }
              }

              # Value and pricing information
              estimatedValue {
                valueUsd
                valueWithDenomination
                denomination {
                  symbol
                  network
                }
              }
            }

            # Ownership information
            balance
            balanceUSD
          }

          # Pagination information
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    // Make sure we're sending correctly formatted owners parameter
    // Zapper requires addresses in the format 0x... (without checksums)
    const variables = {
      owners: normalizedAddresses,
      first: limit,
      after: cursor,
      bypassHidden: true,
      // Include additional options if specified
      ...(options.network && { network: options.network }),
      ...(options.minEstimatedValueUsd && { minEstimatedValueUsd: options.minEstimatedValueUsd }),
      ...(options.search && { search: options.search })
    };
    
    // Log detailed request information for debugging
    console.log(`API Request: cursor=${cursor}, limit=${limit}, addresses=${normalizedAddresses.length}, first address=${normalizedAddresses[0]}`);
    
    const response = await makeGraphQLRequest(nftTokensQuery, variables, endpoints, maxRetries);
    
    if (response.data && response.data.nftUsersTokens) {
      const nftData = response.data.nftUsersTokens;
      const edges = nftData.edges || [];
      const pageInfo = nftData.pageInfo || {};
      
      // Log detailed pagination info
      console.log(`Pagination: hasNextPage=${pageInfo.hasNextPage}, endCursor=${pageInfo.endCursor}`);
      console.log(`Found ${edges.length} NFTs in response`);
      
      const processedNfts = edges.map(edge => {
        const item = edge.node;
        
        // Extract the best image URL from mediasV3
        let imageUrl = '';
        let thumbnailUrl = '';
        let largeUrl = '';
        let blurhash = '';
        let width = 0;
        let height = 0;
        let mimeType = '';
        
        // Try to get image from mediasV3.images first
        if (item.mediasV3?.images?.edges?.length > 0) {
          const imageNode = item.mediasV3.images.edges[0].node;
          imageUrl = imageNode.original || '';
          thumbnailUrl = imageNode.thumbnail || imageUrl;
          largeUrl = imageNode.large || imageUrl;
          blurhash = imageNode.blurhash || '';
          width = imageNode.width || 0;
          height = imageNode.height || 0;
          mimeType = imageNode.mimeType || '';
        }
        
        // Try to get image from mediasV3.animations if no images
        if (!imageUrl && item.mediasV3?.animations?.edges?.length > 0) {
          const animNode = item.mediasV3.animations.edges[0].node;
          imageUrl = animNode.original || '';
          mimeType = animNode.mimeType || '';
        }
        
        // Fallback to collection images
        if (!imageUrl && item.collection?.medias?.logo?.thumbnail) {
          imageUrl = item.collection.medias.logo.thumbnail;
          thumbnailUrl = item.collection.medias.logo.thumbnail;
        }
        
        // Get value information - extract all possible value formats
        const valueUsd = item.estimatedValue?.valueUsd || 0;
        const valueEth = item.estimatedValue?.valueWithDenomination || 0;
        const valueCurrency = item.estimatedValue?.denomination?.symbol || 'ETH';
        
        // Extract any new format estimatedValue properties
        const estimatedValue = {
          valueUsd: valueUsd,
          valueWithDenomination: valueEth,
          amount: item.estimatedValue?.amount || 0,
          currency: item.estimatedValue?.currency || 'ETH',
          denomination: item.estimatedValue?.denomination || { symbol: 'ETH' }
        };
        
        // Get last sale information if available
        const lastSaleUsd = item.lastSale?.valueUsd || 0;
        const lastSaleValue = item.lastSale?.valueWithDenomination || 0;
        const lastSaleCurrency = item.lastSale?.denomination?.symbol || 'ETH';
        
        // Get traits/attributes
        const traits = item.traits || [];
        
        // Get collection information with better null handling
        const collection = {
          name: item.collection?.name || 'Unknown Collection',
          address: item.collection?.address || '',
          network: item.collection?.network || 'ethereum',
          nftStandard: item.collection?.nftStandard || '',
          type: item.collection?.type || 'GENERAL',
          supply: item.collection?.supply || '0',
          holdersCount: item.collection?.holdersCount || '0',
          floorPrice: item.collection?.floorPrice?.valueUsd || 0,
          floorPriceEth: item.collection?.floorPrice?.valueWithDenomination || 0,
          logoUrl: item.collection?.medias?.logo?.thumbnail || ''
        };
        
        // Debug value info for high-value NFTs
        if (valueUsd > 1000) {
          console.log(`High value NFT found: ${item.name || 'Unnamed'} (${item.tokenId}) - $${valueUsd.toFixed(2)} (${valueEth} ${valueCurrency})`);
        }
        
        return {
          id: item.id || `${collection.address}-${item.tokenId}`,
          tokenId: item.tokenId || '',
          name: item.name || `#${item.tokenId}`,
          description: item.description || '',
          collection,
          imageUrl,
          thumbnailUrl,
          largeUrl,
          blurhash,
          width,
          height,
          mimeType,
          valueUsd,
          valueEth,
          valueCurrency,
          estimatedValue, // Added explicit estimatedValue object
          lastSaleUsd,
          lastSaleValue,
          lastSaleCurrency,
          traits,
          balance: edge.balance || 1,
          balanceUSD: edge.balanceUSD || 0,
          ownedAt: edge.ownedAt || null,
          balances: edge.balances || [],
          valuationStrategy: edge.valuationStrategy || 'ESTIMATED_VALUE',
          isNft: true
        };
      });
      
      // Enhanced logging for pagination debugging
      console.log(`Page Results: items=${processedNfts.length}, hasMore=${pageInfo.hasNextPage}, endCursor=${pageInfo.endCursor || 'null'}`);
      
      // Log value data from a sample NFT to debug
      if (processedNfts.length > 0) {
        console.log('Sample NFT Value Data:', {
          name: processedNfts[0].name,
          collection: processedNfts[0].collection?.name,
          valueUsd: processedNfts[0].valueUsd,
          estimatedValue: processedNfts[0].estimatedValue,
          balanceUSD: processedNfts[0].balanceUSD
        });
      }
      
      const result = {
        // Provide both formats for backward compatibility
        items: processedNfts,
        nfts: processedNfts,
        cursor: pageInfo.endCursor || null,
        hasMore: Boolean(pageInfo.hasNextPage), // Ensure it's a boolean
        totalNftCount: edges.length,
        // Include pageInfo for debugging
        pageInfo: {
          hasNextPage: pageInfo.hasNextPage,
          endCursor: pageInfo.endCursor,
          startCursor: pageInfo.startCursor,
          hasPreviousPage: pageInfo.hasPreviousPage
        }
      };
      
      // Cache the result
      cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    } else {
      console.warn('No NFT data found in response:', response);
      return { items: [], nfts: [], cursor: null, hasMore: false };
    }
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return { items: [], nfts: [], cursor: null, hasMore: false };
  }
};

/**
 * Get NFTs for a specific collection with caching
 * @param {string[]} walletAddresses - Wallet addresses to check
 * @param {string} collectionAddress - The NFT collection contract address
 * @param {object} options - Options for the request
 * @returns {Promise<object>} - NFTs in the collection
 */
export const getNftsForCollection = async (walletAddresses, collectionAddress, options = {}) => {
  if (!walletAddresses || walletAddresses.length === 0) {
    throw new Error('At least one wallet address is required');
  }
  
  if (!collectionAddress) {
    throw new Error('Collection address is required');
  }
  
  // Normalize addresses for consistent caching
  const normalizedAddresses = walletAddresses.map(addr => addr.toLowerCase());
  const normalizedCollection = collectionAddress.toLowerCase();
  
  const {
    limit = 50,
    cursor = null,
    bypassCache = false
  } = options;
  
  // Generate cache key for this specific collection query
  const cacheKey = `collection:${normalizedCollection}-owners:${normalizedAddresses.join(',')}-cursor:${cursor || 'initial'}`;
  
  // Check cache first
  if (!bypassCache && cache.has(cacheKey)) {
    const cachedData = cache.get(cacheKey);
    if (cachedData.timestamp > Date.now() - CACHE_TTL) {
      console.log(`Using cached collection NFT data for ${normalizedCollection}`);
      return cachedData.data;
    } else {
      cache.delete(cacheKey);
    }
  }
  
  // GraphQL query for a specific collection
  const collectionNftsQuery = `
    query CollectionNfts(
      $owners: [Address!]!,
      $addresses: [Address!]!,
      $networks: [Network!],
      $first: Int = 50,
      $after: String,
      $bypassHidden: Boolean = true
    ) {
      nftUsersTokens(
        owners: $owners, 
        collections: { addresses: $addresses, networks: $networks },
        first: $first,
        after: $after,
        bypassHidden: $bypassHidden
      ) {
        edges {
          node {
            id
            tokenId
            name
            description
            collection {
              id
              name
              address
              network
              nftStandard
              type
              cardImage
              floorPrice {
                valueUsd
              }
              medias {
                logo {
                  thumbnail
                }
              }
            }
            mediasV3 {
              images(first: 1) {
                edges {
                  node {
                    original
                    thumbnail
                    large
                  }
                }
              }
              animations(first: 1) {
                edges {
                  node {
                    original
                    thumbnail
                    large
                  }
                }
              }
            }
            estimatedValue {
              valueUsd
              valueWithDenomination
              denomination {
                symbol
                network
              }
            }
          }
          balance
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  
  const variables = {
    owners: normalizedAddresses,
    addresses: [normalizedCollection],
    networks: null,  // Auto-detect network
    first: limit,
    after: cursor,
    bypassHidden: true  // Ensure we get all NFTs, not just those passing Zapper's spam filter
  };
  
  try {
    console.log(`Fetching NFTs for collection ${normalizedCollection}`);
    
    const response = await makeGraphQLRequest(collectionNftsQuery, variables);
    
    if (response.data && response.data.nftUsersTokens) {
      const nftData = response.data.nftUsersTokens;
      const edges = nftData.edges || [];
      
      // Process NFTs
      const processedNfts = edges.map(edge => {
        const item = edge.node;
        
        // Extract image URLs
        let imageUrl = '';
        let thumbnailUrl = '';
        let largeUrl = '';
        
        // First try images
        if (item.mediasV3?.images?.edges?.length > 0) {
          const imageNode = item.mediasV3.images.edges[0].node;
          imageUrl = imageNode.original || '';
          thumbnailUrl = imageNode.thumbnail || imageUrl;
          largeUrl = imageNode.large || imageUrl;
        }
        
        // Then try animations
        if (!imageUrl && item.mediasV3?.animations?.edges?.length > 0) {
          const animNode = item.mediasV3.animations.edges[0].node;
          imageUrl = animNode.original || '';
          thumbnailUrl = animNode.thumbnail || imageUrl;
          largeUrl = animNode.large || imageUrl;
        }
        
        // Fallback to collection images
        if (!imageUrl) {
          if (item.collection?.cardImage) {
            imageUrl = item.collection.cardImage;
          } else if (item.collection?.medias?.logo?.thumbnail) {
            imageUrl = item.collection.medias.logo.thumbnail;
          }
        }
        
        return {
          id: item.id || '',
          tokenId: item.tokenId || '',
          name: item.name || `#${item.tokenId}`,
          description: item.description || '',
          collectionName: item.collection?.name || 'Unknown Collection',
          collectionAddress: item.collection?.address || normalizedCollection,
          network: item.collection?.network || 'ethereum',
          imageUrl,
          thumbnailUrl: thumbnailUrl || imageUrl,
          largeImageUrl: largeUrl || imageUrl,
          estimatedValueUsd: item.estimatedValue?.valueUsd || 0,
          valueEth: item.estimatedValue?.valueWithDenomination || 0,
          valueCurrency: item.estimatedValue?.denomination?.symbol || 'ETH',
          balance: edge.balance || 1
        };
      });
      
      const result = {
        nfts: processedNfts,
        collectionName: processedNfts[0]?.collectionName || 'Unknown Collection',
        collectionAddress: normalizedCollection,
        cursor: nftData.pageInfo?.endCursor || null,
        hasMore: nftData.pageInfo?.hasNextPage || false
      };
      
      // Cache the result
      cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    }
    
    return {
      nfts: [],
      collectionName: 'Unknown Collection',
      collectionAddress: normalizedCollection,
      cursor: null,
      hasMore: false
    };
  } catch (error) {
    console.error(`Error fetching NFTs for collection ${normalizedCollection}:`, error);
    throw error;
  }
};

/**
 * Function to get NFT collections for a Farcaster user
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @param {object} options - Options for the request
 * @returns {Promise<object>} - Collection data
 */
export const getFarcasterNftCollections = async (usernameOrFid, options = {}) => {
  try {
    // First get all addresses for the Farcaster user
    const addresses = await getFarcasterAddresses(usernameOrFid);
    
    if (!addresses || addresses.length === 0) {
      throw new Error(`No addresses found for Farcaster user: ${usernameOrFid}`);
    }
    
    // Now get the NFT collections for these addresses
    const collections = await getNftsForCollection(addresses, null, options);
    
    return {
      collections: collections.nfts,
      farcasterUser: usernameOrFid
    };
  } catch (error) {
    console.error('Error fetching Farcaster NFT collections:', error);
    throw error;
  }
};