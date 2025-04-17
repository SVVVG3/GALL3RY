import axios from 'axios';
import { getApiBaseUrl } from '../utils/runtimeConfig';
// Completely remove any imports from NFTContext

// Define constants locally rather than importing them
// This helps break potential circular dependencies
const ZAPPER_API_URL = process.env.REACT_APP_ZAPPER_API_URL || 'https://public.zapper.xyz/graphql';

// NOTE: We no longer store API keys client-side for security reasons
// API keys are now managed server-side only
// Server-side proxy endpoints will handle authentication

// Initialize the SERVER_URL with a default value
// Will be updated dynamically when getServerUrl() is called
let SERVER_URL = '';
let ZAPPER_API_ENDPOINTS = [];

// Single cache for all API responses
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// Create a custom axios instance specifically for Zapper API calls
const zapperAxios = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // Don't set User-Agent to avoid CSP issues
  }
});

// Constants
// Use window.location.origin to ensure this works in both development and production
// Updated endpoints to prioritize our proxy and properly format the direct endpoint
const DEFAULT_ENDPOINTS = [
  '/api/zapper' // Default relative URL - all requests go through our proxy now
];

// Initialize endpoints after we've loaded the API base URL
async function initializeEndpoints() {
  try {
    const baseUrl = await getApiBaseUrl();
    
    // Only update if SERVER_URL has changed or is not yet set
    if (!SERVER_URL || SERVER_URL !== baseUrl) {
      SERVER_URL = baseUrl;
      console.log(`Initialized SERVER_URL: ${SERVER_URL}`);
      
      // Updated endpoints to only use our proxy endpoint
      // This ensures API keys are kept server-side only
      ZAPPER_API_ENDPOINTS = [
        `${SERVER_URL}/zapper` // Use absolute URL (either localhost or production)
      ];
      
      console.log('Initialized endpoints:', ZAPPER_API_ENDPOINTS);
      
      // Also update the other endpoints
      await updateApiEndpoints();
    }
  } catch (error) {
    console.error('Failed to initialize endpoints:', error);
    // Fallback to default values
    SERVER_URL = '/api';
    ZAPPER_API_ENDPOINTS = DEFAULT_ENDPOINTS;
  }
}

// Call initialization immediately
initializeEndpoints();

// Use the unified cache for NFT data instead of separate caches
// const NFT_CACHE = new Map();
// const NFT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// // Add a cache for NFT data to reduce API calls
// const nftCache = new Map();
// const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Define constants for API URLs that will be set during initialization
let ZAPPER_ENDPOINT = '/api/zapper';
let FARCASTER_PROFILE_ENDPOINT = '/api/farcaster-profile';

// Update these endpoints when we initialize
async function updateApiEndpoints() {
  try {
    const baseUrl = await getApiBaseUrl();
    
    // Only update if SERVER_URL is different from the current baseUrl
    if (SERVER_URL !== baseUrl) {
      SERVER_URL = baseUrl;
    }
    
    ZAPPER_ENDPOINT = `${baseUrl}/zapper`;
    FARCASTER_PROFILE_ENDPOINT = `${baseUrl}/farcaster-profile`;
    console.log(`API endpoints updated: 
      ZAPPER_ENDPOINT: ${ZAPPER_ENDPOINT}
      FARCASTER_PROFILE_ENDPOINT: ${FARCASTER_PROFILE_ENDPOINT}
    `);
  } catch (error) {
    console.error('Failed to update API endpoints:', error);
  }
}

// Call both initialization functions
Promise.all([initializeEndpoints()])
  .then(() => console.log('Zapper service fully initialized'))
  .catch(error => console.error('Error initializing zapper service:', error));

// Reinitialize service periodically
setInterval(() => {
  console.log('Refreshing API endpoints configuration...');
  initializeEndpoints()
    .then(() => console.log('API endpoints refreshed'))
    .catch(err => console.error('Failed to refresh API endpoints:', err));
}, 60000); // Check every minute

/**
 * Make a GraphQL request to the Zapper API with fallback endpoints
 * @param {string} query - GraphQL query
 * @param {object} variables - Query variables
 * @param {array} endpoints - API endpoints to try in order
 * @param {number} maxRetries - Maximum number of retries per endpoint
 * @returns {Promise<object>} - API response
 */
const makeGraphQLRequest = async (query, variables = {}, endpoints = null, maxRetries = 3) => {
  // Use dynamic endpoints if not explicitly provided
  const endpointsToUse = endpoints || ZAPPER_API_ENDPOINTS;
  if (!endpointsToUse || endpointsToUse.length === 0) {
    console.warn('No endpoints available, falling back to default');
    endpointsToUse = DEFAULT_ENDPOINTS;
  }
  
  let lastError = null;
  
  // Try each endpoint
  for (const endpoint of endpointsToUse) {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          // Don't set User-Agent in browser environment as it will cause errors
        };
        
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
        
        // Enhanced response logging for easier debugging
        console.log('Response status:', response.status);
        console.log('Response shape:', {
          hasData: !!response.data,
          hasErrors: !!(response.data && response.data.errors),
          dataKeys: response.data ? Object.keys(response.data) : [],
          data: response.data ? (
            typeof response.data.data === 'object' ? 
              Object.keys(response.data.data || {}) : 
              (response.data.data ? 'primitive value' : 'null')
          ) : 'no data'
        });
        
        // Check if response has errors
        if (response.data.errors) {
          const errorMsg = response.data.errors[0]?.message || 'GraphQL error';
          console.error('GraphQL errors:', response.data.errors);
          throw new Error(errorMsg);
        }
        
        // Return either response.data.data (standard GraphQL format) or response.data (direct format)
        // This handles different API formats that might be returned
        return response.data.data || response.data;
    } catch (error) {
        lastError = error;
        
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
  
  // NEW FIX: Remove .eth suffix for Farcaster API calls
  // Farcaster doesn't support .eth in usernames directly
  if (cleanInput.endsWith('.eth')) {
    console.log(`Input contains .eth suffix, removing for Farcaster API compatibility`);
    cleanInput = cleanInput.replace(/\.eth$/, '');
  }
  
  // Determine if input is a FID (number) or username (string)
  const isFid = !isNaN(Number(cleanInput)) && cleanInput.indexOf('.') === -1;
  
  console.log(`Fetching Farcaster profile for ${isFid ? 'FID' : 'username'}: ${cleanInput}`);
  
  let errors = [];
  
  try {
    // First try the dedicated GET endpoint
    try {
      console.log(`Trying dedicated endpoint: ${FARCASTER_PROFILE_ENDPOINT}`);
      
      const params = isFid 
        ? { fid: parseInt(cleanInput, 10) }
        : { username: cleanInput };
        
      const response = await zapperAxios.get(FARCASTER_PROFILE_ENDPOINT, { params });
      
      if (response.data) {
        console.log('Found Farcaster profile via dedicated endpoint:', response.data);
        return response.data;
      }
    } catch (dedicatedEndpointError) {
      console.error('Dedicated endpoint failed:', dedicatedEndpointError.message);
      errors.push(`Dedicated endpoint: ${dedicatedEndpointError.message}`);
      
      // Check if this is an API key issue
      if (dedicatedEndpointError.response?.status === 403 || 
          dedicatedEndpointError.message.includes('ERR_BAD_REQUEST')) {
        console.error('API authorization issue detected. Please check your Zapper API key');
      }
      // Continue to try the GraphQL endpoint
    }
    
    // If dedicated endpoint fails, try the GraphQL endpoint
    try {
      console.log(`Trying GraphQL endpoint: ${ZAPPER_ENDPOINT}`);
      
      // GraphQL query based on Zapper API documentation
      const query = `
        query GetFarcasterProfile(${isFid ? '$fid: Int' : '$username: String'}) {
          farcasterProfile(${isFid ? 'fid: $fid' : 'username: $username'}) {
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
      
      // Build variables based on input type
      const variables = isFid 
        ? { fid: parseInt(cleanInput, 10) }
        : { username: cleanInput };
      
      const graphqlResponse = await zapperAxios.post(
        ZAPPER_ENDPOINT,
        { query, variables },
        { 
          headers: {
            'Content-Type': 'application/json'
            // API keys are now handled server-side only
          }
        }
      );
      
      // Check for GraphQL errors
      if (graphqlResponse.data?.errors) {
        console.error('GraphQL errors:', graphqlResponse.data.errors);
        throw new Error(graphqlResponse.data.errors[0]?.message || 'GraphQL error');
      }
      
      // Find profile data in the response
      const profileData = graphqlResponse.data?.data?.farcasterProfile;
      
      if (profileData) {
        console.log('Found Farcaster profile via GraphQL endpoint:', profileData);
        return profileData;
      }
      throw new Error('No profile data in GraphQL response');
    } catch (graphqlError) {
      console.error('GraphQL endpoint failed:', graphqlError.message);
      errors.push(`GraphQL endpoint: ${graphqlError.message}`);
      // Continue to try Neynar API
    }
    
    // If both Zapper endpoints fail, try Neynar API as a last resort
    if (!isFid) { // Neynar search endpoint works only with usernames
      try {
        console.log('Trying Neynar API as last resort');
        const response = await axios({
          method: 'get',
          url: `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(cleanInput)}&limit=1`,
          headers: {
            'accept': 'application/json'
          },
          timeout: 5000
        });
        
        if (response.data && response.data.users && response.data.users.length > 0) {
          // Look for exact match first
          const exactMatch = response.data.users.find(
            user => user.username.toLowerCase() === cleanInput.toLowerCase()
          );
          
          const userData = exactMatch || response.data.users[0];
          
          // Convert Neynar response to our format
          const profileData = {
            username: userData.username,
            fid: userData.fid,
            metadata: {
              displayName: userData.display_name,
              imageUrl: userData.pfp_url,
              description: userData.profile?.bio?.text
            },
            custodyAddress: userData.custody_address,
            connectedAddresses: userData.connected_addresses || []
          };
          
          console.log('Found Farcaster profile via Neynar API:', profileData);
          return profileData;
        }
        throw new Error('No profile found in Neynar response');
      } catch (neynarError) {
        console.error('Neynar API failed:', neynarError.message);
        errors.push(`Neynar API: ${neynarError.message}`);
      }
    }
    
    // If we get here, all attempts failed
    throw new Error(`Farcaster profile not found for ${isFid ? 'FID' : 'username'}: ${cleanInput}. All API attempts failed.`);
  } catch (error) {
    console.error('Error in getFarcasterProfile:', error.message);
    console.error('All errors:', errors);
    throw new Error(`Failed to find Farcaster profile for ${cleanInput}: ${error.message}`);
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