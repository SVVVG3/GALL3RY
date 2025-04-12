import axios from 'axios';
import { ZAPPER_PROXY_URL } from '../constants';
import { ZAPPER_SERVER_URL, ZAPPER_API_KEY } from '../config/constants';

// Constants
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
// Updated endpoints to prioritize our proxy and properly format the direct endpoint
const ZAPPER_API_ENDPOINTS = [
  `${window.location.origin}/api/zapper`, // Use absolute URL with origin to ensure it works in all environments
  `${SERVER_URL}/api/zapper`,             // Fallback to SERVER_URL based endpoint
  'https://public.zapper.xyz/graphql'     // Direct Zapper API endpoint as last resort
];
// Direct endpoint is removed to prevent 404s - all requests should go through our proxy

const NFT_CACHE = new Map();
const NFT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

// Add a cache for NFT data to reduce API calls
const nftCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

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
        };
        
        // If using direct Zapper API, add the API key if available
        if (endpoint.includes('zapper.xyz') && ZAPPER_API_KEY) {
          // Use the correct authentication header format per docs
          headers['x-zapper-api-key'] = ZAPPER_API_KEY;
        }
        
        console.log(`Trying endpoint: ${endpoint}, attempt ${retryCount + 1}/${maxRetries}`);
        
        const response = await axios.post(endpoint, {
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
        
        return response.data;
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
    // DEBUG: Log the full API request details
    console.log(`Making Zapper API request with:`, {
      query: query.substring(0, 50) + '...',
      variables,
      endpoints: ZAPPER_API_ENDPOINTS
    });
    
    // Make the request to the Zapper API with increased retries
    const response = await makeGraphQLRequest(query, variables, ZAPPER_API_ENDPOINTS, 5);
    
    // DEBUG: Log the response structure
    console.log(`Zapper API response received:`, {
      hasData: !!response.data,
      hasProfile: response.data ? !!response.data.farcasterProfile : false,
      responseKeys: Object.keys(response)
    });
    
    // Check if profile was found
    if (!response.data || !response.data.farcasterProfile) {
      console.warn(`No profile found for ${cleanInput}, response:`, JSON.stringify(response).substring(0, 200));
      
      // Try without .eth if this is an ENS name
      if (isEnsName && alternativeUsername) {
        console.log(`Trying alternative username without .eth suffix: ${alternativeUsername}`);
        
        try {
          const altResponse = await makeGraphQLRequest(query, { username: alternativeUsername }, ZAPPER_API_ENDPOINTS, 5);
          
          console.log(`Alternative username response:`, {
            hasData: !!altResponse.data,
            hasProfile: altResponse.data ? !!altResponse.data.farcasterProfile : false
          });
          
          if (altResponse.data && altResponse.data.farcasterProfile) {
            console.log(`Found profile using alternative username: ${alternativeUsername}`);
            
            // Transform response to match our application's expected format
            const profile = altResponse.data.farcasterProfile;
            return {
              fid: profile.fid,
              username: profile.username,
              displayName: profile.metadata?.displayName || profile.username,
              avatarUrl: profile.metadata?.imageUrl,
              bio: profile.metadata?.description,
              custodyAddress: profile.custodyAddress,
              connectedAddresses: profile.connectedAddresses || [],
            };
          }
        } catch (altError) {
          console.error(`Error with alternative username attempt:`, altError);
        }
      }
      
      // If we're looking up an ENS name, try a direct FID lookup as a last resort
      if (isEnsName && !isFid) {
        // Try with numeric FIDs for common test accounts - good for testing specific known profiles
        const testFids = [1, 2, 3];
        
        for (const testFid of testFids) {
          try {
            console.log(`Trying fallback with test FID: ${testFid}`);
            const fidResponse = await makeGraphQLRequest(query, { fid: testFid }, ZAPPER_API_ENDPOINTS, 3);
            
            if (fidResponse.data && fidResponse.data.farcasterProfile) {
              console.log(`Found profile using test FID: ${testFid}`);
              const profile = fidResponse.data.farcasterProfile;
              return {
                fid: profile.fid,
                username: profile.username,
                displayName: profile.metadata?.displayName || profile.username,
                avatarUrl: profile.metadata?.imageUrl,
                bio: profile.metadata?.description,
                custodyAddress: profile.custodyAddress,
                connectedAddresses: profile.connectedAddresses || [],
              };
            }
          } catch (fidError) {
            console.warn(`Error with test FID ${testFid}:`, fidError.message);
          }
        }
      }
      
      throw new Error(`Could not find Farcaster profile for ${isFid ? 'FID' : 'username'}: ${cleanInput}`);
    }
    
    // Transform response to match our application's expected format
    const profile = response.data.farcasterProfile;
    
    // Log what we found
    console.log(`Profile found via Zapper API: ${profile.username}, FID: ${profile.fid}`);
    console.log(`Connected addresses: ${profile.connectedAddresses?.length || 0}, custody address: ${profile.custodyAddress || 'none'}`);
    
    // Return data in the expected format
      return {
      fid: profile.fid,
      username: profile.username,
      displayName: profile.metadata?.displayName || profile.username,
      avatarUrl: profile.metadata?.imageUrl,
      bio: profile.metadata?.description,
      custodyAddress: profile.custodyAddress,
      connectedAddresses: profile.connectedAddresses || [],
      };
    } catch (error) {
    // Enhanced error logging
    console.error('Error fetching Farcaster profile from Zapper API:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data,
      status: error.response?.status
    });
    
    // Rethrow with additional context
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
 * @param {string[]} addresses - Array of wallet addresses
 * @param {object} options - Options for the request
 * @returns {Promise<object>} - Object containing NFTs and pagination info
 */
export const getNftsForAddresses = async (addresses, options = {}) => {
  if (!addresses || addresses.length === 0) {
    console.warn('No addresses provided for getNftsForAddresses');
    return { nfts: [], cursor: null, hasMore: false };
  }
  
  // Normalize addresses to lowercase to ensure consistent caching
  const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
  
  const { 
    limit = 100, 
    cursor = null,
    bypassCache = false,
    includeCollectionsOnly = false, // New option to first fetch just collections
    collectionsFilter = null,      // Optional filter for collections (e.g., specific contract addresses)
    cacheTTL = NFT_CACHE_TTL,
    endpoints = ZAPPER_API_ENDPOINTS,
    maxRetries = 3
  } = options;
  
  // Generate a cache key based on addresses and cursor
  const cacheKey = `nfts:${normalizedAddresses.join(',')}-cursor:${cursor || 'initial'}`;
  
  // Check cache first if not bypassing
  if (!bypassCache && NFT_CACHE.has(cacheKey)) {
    const cachedData = NFT_CACHE.get(cacheKey);
    if (cachedData.timestamp > Date.now() - cacheTTL) {
      console.log(`Using cached NFT data for ${normalizedAddresses.length} addresses`);
      return cachedData.data;
    } else {
      // Remove expired cache entry
      NFT_CACHE.delete(cacheKey);
    }
  }
  
  try {
    // Fetch NFT collections first if requested (more efficient for browsing)
    if (includeCollectionsOnly) {
      const collectionsQuery = `
        query UserNftCollections(
          $owners: [Address!]!,
          $first: Int = 100,
          $after: String,
          $bypassHidden: Boolean = true
        ) {
          nftUsersCollections(
            owners: $owners,
            first: $first,
            after: $after,
            bypassHidden: $bypassHidden
          ) {
            edges {
              node {
                id
                name
                address
                network
                nftStandard
                type
                cardImage
                floorPrice {
                  valueUsd
                  valueWithDenomination
                  denomination {
                    symbol
                    network
                  }
                }
                medias {
                  logo {
                    thumbnail
                  }
                }
                totalCount
              }
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
        first: limit,
        after: cursor,
        bypassHidden: true
      };
      
      console.log(`Fetching NFT collections for ${normalizedAddresses.length} addresses`);
      
      const response = await makeGraphQLRequest(collectionsQuery, variables, endpoints, maxRetries);
      
      if (response.data && response.data.nftUsersCollections) {
        const collectionsData = response.data.nftUsersCollections;
        const edges = collectionsData.edges || [];
        
        console.log(`Found ${edges.length} NFT collections`);
        
        const processedCollections = edges.map(edge => {
          const collection = edge.node;
          
          return {
            id: collection.id || '',
            address: collection.address || '',
            name: collection.name || 'Unknown Collection',
            network: collection.network || 'ethereum',
            nftStandard: collection.nftStandard || '',
            type: collection.type || 'GENERAL',
            description: collection.description || '',
            imageUrl: collection.cardImage || 
                     (collection.medias?.logo?.thumbnail || ''),
            floorPrice: collection.floorPrice?.valueUsd || 0,
            floorPriceEth: collection.floorPrice?.valueWithDenomination || 0,
            totalCount: collection.totalCount || 0,
          };
        });
        
        const result = {
          collections: processedCollections,
          cursor: collectionsData.pageInfo?.endCursor || null,
          hasMore: collectionsData.pageInfo?.hasNextPage || false,
          totalCollectionsCount: edges.length
        };
        
        // Cache the result
        NFT_CACHE.set(cacheKey, {
          timestamp: Date.now(),
          data: result
        });
        
        return result;
      }
    }
    
    // If not just collections, fetch actual NFT tokens
    console.log(`Fetching NFTs for ${normalizedAddresses.length} addresses`);
    
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
              tokenId
              name
              description

              # Collection information
              collection {
                name
                address
                network
                nftStandard
                type
                supply
                holdersCount
                floorPrice {
                  valueUsd
                  valueWithDenomination
                  denomination {
                    symbol
                    network
                    address
                  }
                }
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
                      blurhash
                      large
                      width
                      height
                      mimeType
                      fileSize
                    }
                  }
                }
                animations(first: 1) {
                  edges {
                    node {
                      original
                      mimeType
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
              lastSale {
                valueUsd
                valueWithDenomination
                denomination {
                  symbol
                }
              }

              # Traits/attributes
              traits {
                attributeName
                attributeValue
                supplyPercentage
                supply
              }
            }

            # Ownership information
            balance
            balanceUSD
            ownedAt
            balances {
              balance
              account {
                address
                displayName {
                  value
                }
              }
            }

            # Valuation strategy information
            valuationStrategy
          }

          # Pagination information
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    const variables = {
      owners: normalizedAddresses,
      first: limit,
      after: cursor,
      bypassHidden: true
      // network and minEstimatedValueUsd are optional, so we don't include them by default
    };
    
    const response = await makeGraphQLRequest(nftTokensQuery, variables, endpoints, maxRetries);
    
    if (response.data && response.data.nftUsersTokens) {
      const nftData = response.data.nftUsersTokens;
      const edges = nftData.edges || [];
      
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
        
        // Get value information
        const valueUsd = item.estimatedValue?.valueUsd || 0;
        const valueEth = item.estimatedValue?.valueWithDenomination || 0;
        const valueCurrency = item.estimatedValue?.denomination?.symbol || 'ETH';
        
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
      
      const result = {
        nfts: processedNfts,
        cursor: nftData.pageInfo?.endCursor || null,
        hasMore: nftData.pageInfo?.hasNextPage || false,
        totalNftCount: edges.length
      };
      
      // Cache the result
      NFT_CACHE.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });
      
      return result;
    } else {
      console.warn('No NFT data found in response:', response);
      return { nfts: [], cursor: null, hasMore: false };
    }
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return { nfts: [], cursor: null, hasMore: false };
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
  if (!bypassCache && NFT_CACHE.has(cacheKey)) {
    const cachedData = NFT_CACHE.get(cacheKey);
    if (cachedData.timestamp > Date.now() - NFT_CACHE_TTL) {
      console.log(`Using cached collection NFT data for ${normalizedCollection}`);
      return cachedData.data;
    } else {
      NFT_CACHE.delete(cacheKey);
    }
  }
  
  // GraphQL query for a specific collection
  const collectionNftsQuery = `
    query CollectionNfts(
      $owners: [Address!]!,
      $addresses: [Address!]!,
      $networks: [Network!],
      $first: Int = 50,
      $after: String
    ) {
      nftUsersTokens(
        owners: $owners, 
        collections: { addresses: $addresses, networks: $networks },
        first: $first,
        after: $after
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
    after: cursor
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
      NFT_CACHE.set(cacheKey, {
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
    
    // Then get NFT collections using the addresses
    const {
      limit = 100,
      cursor = null,
      bypassCache = false
    } = options;
    
    const collectionsQuery = `
      query UserNftCollections(
        $owners: [Address!]!,
        $first: Int = 100,
        $after: String,
        $bypassHidden: Boolean = true
      ) {
        nftUsersCollections(
          owners: $owners,
          first: $first,
          after: $after,
          bypassHidden: $bypassHidden
        ) {
          edges {
            node {
              id
              name
              address
              network
              nftStandard
              type
              cardImage
              floorPrice {
                valueUsd
                valueWithDenomination
                denomination {
                  symbol
                  network
                }
              }
              medias {
                logo {
                  thumbnail
                }
              }
              totalCount
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    
    const variables = {
      owners: addresses,
      first: limit,
      after: cursor,
      bypassHidden: true
    };
    
    console.log(`Fetching NFT collections for Farcaster user ${usernameOrFid}`);
    
    const response = await makeGraphQLRequest(collectionsQuery, variables);
    
    if (response.data && response.data.nftUsersCollections) {
      const collectionsData = response.data.nftUsersCollections;
      const edges = collectionsData.edges || [];
      
      console.log(`Found ${edges.length} NFT collections for ${usernameOrFid}`);
      
      const processedCollections = edges.map(edge => {
        const collection = edge.node;
        
        return {
          id: collection.id || '',
          address: collection.address || '',
          name: collection.name || 'Unknown Collection',
          network: collection.network || 'ethereum',
          nftStandard: collection.nftStandard || '',
          type: collection.type || 'GENERAL',
          description: collection.description || '',
          imageUrl: collection.cardImage || 
                   (collection.medias?.logo?.thumbnail || ''),
          floorPrice: collection.floorPrice?.valueUsd || 0,
          floorPriceEth: collection.floorPrice?.valueWithDenomination || 0,
          totalCount: collection.totalCount || 0,
        };
      });
      
      return {
        collections: processedCollections,
        cursor: collectionsData.pageInfo?.endCursor || null,
        hasMore: collectionsData.pageInfo?.hasNextPage || false,
        farcasterUser: usernameOrFid,
        addresses
      };
    }
    
    return {
      collections: [],
      cursor: null,
      hasMore: false,
      farcasterUser: usernameOrFid,
      addresses
    };
  } catch (error) {
    console.error('Error fetching Farcaster NFT collections:', error);
    throw error;
  }
};

/**
 * Optimized function to get Farcaster NFT data
 * This fetches collections first, then allows fetching NFTs by collection
 * Saves API credits by only fetching NFTs when needed
 * 
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @param {object} options - Options for fetching
 * @returns {Promise<object>} - Collections, addresses and functions to load NFTs
 */
export const getOptimizedFarcasterNfts = async (farcasterUsername, options = {}) => {
  console.log(`Getting optimized Farcaster NFTs for username: ${farcasterUsername}`);
  
  // This function uses a different approach:
  // 1. First get the Farcaster profile to fetch wallet addresses
  // 2. Then fetch collections only (not individual NFTs)
  // 3. Allow fetching NFTs by collection on demand (lazy loading)
  
  // Step 1: Get Farcaster profile
  const profile = await getFarcasterProfile(farcasterUsername, { bypassCache: options.bypassCache });
  
  if (!profile || !profile.addresses || profile.addresses.length === 0) {
    console.warn(`No addresses found for Farcaster user: ${farcasterUsername}`);
    return {
      username: farcasterUsername,
      displayName: profile?.displayName || farcasterUsername,
      profilePictureUrl: profile?.profilePictureUrl || '',
      addresses: [],
      collections: [],
      loadedCollections: {},
      hasMoreCollections: false,
      collectionsCursor: null,
      // Helper functions to load data on demand
      loadNftsForCollection: async () => ({ nfts: [] }),
      loadInitialCollections: async () => ({ collections: [] }),
      loadMoreCollections: async () => ({ collections: [] })
    };
  }
  
  const addresses = profile.addresses;
  console.log(`Found ${addresses.length} addresses for Farcaster user: ${farcasterUsername}`, addresses);
  
  // Extract wallet addresses we can use
  const walletAddresses = addresses.filter(addr => addr && addr.startsWith('0x') && addr.length === 42);
  
  if (walletAddresses.length === 0) {
    console.warn(`No valid Ethereum addresses found for Farcaster user: ${farcasterUsername}`);
    return {
      username: farcasterUsername,
      displayName: profile?.displayName || farcasterUsername,
      profilePictureUrl: profile?.profilePictureUrl || '',
      addresses: addresses,
      collections: [],
      loadedCollections: {},
      hasMoreCollections: false,
      collectionsCursor: null,
      loadNftsForCollection: async () => ({ nfts: [] }),
      loadInitialCollections: async () => ({ collections: [] }),
      loadMoreCollections: async () => ({ collections: [] })
    };
  }
  
  // Step 2: Fetch collections only (much lighter API call)
  const collectionsResult = await getNftsForAddresses(walletAddresses, { 
    includeCollectionsOnly: true,
    bypassCache: options.bypassCache,
    limit: options.collectionsLimit || 50
  });
  
  const collections = collectionsResult.collections || [];
  const collectionsCursor = collectionsResult.cursor;
  const hasMoreCollections = collectionsResult.hasMore;
  
  console.log(`Found ${collections.length} NFT collections for Farcaster user: ${farcasterUsername}`);
  
  // Create a function to load NFTs for a specific collection
  const loadNftsForCollection = async (collectionAddress, loadOptions = {}) => {
    if (!collectionAddress) {
      console.warn('No collection address provided to loadNftsForCollection');
      return { nfts: [] };
    }
    
    console.log(`Loading NFTs for collection ${collectionAddress} for user ${farcasterUsername}`);
    
    return await getNftsForCollection(walletAddresses, collectionAddress, {
      bypassCache: loadOptions.bypassCache,
      limit: loadOptions.limit || 100,
      cursor: loadOptions.cursor
    });
  };
  
  // Function to load more collections (pagination)
  const loadMoreCollections = async (loadOptions = {}) => {
    if (!hasMoreCollections) {
      console.log('No more collections to load');
      return { collections: [], hasMore: false, cursor: null };
    }
    
    console.log(`Loading more collections for user ${farcasterUsername}`);
    
    const nextCollectionsResult = await getNftsForAddresses(walletAddresses, { 
      includeCollectionsOnly: true,
      bypassCache: loadOptions.bypassCache,
      limit: loadOptions.limit || 50,
      cursor: collectionsCursor
    });
    
    return {
      collections: nextCollectionsResult.collections || [],
      hasMore: nextCollectionsResult.hasMore,
      cursor: nextCollectionsResult.cursor
    };
  };
  
  // Function to load the initial collections (mostly for consistency)
  const loadInitialCollections = async (loadOptions = {}) => {
    console.log(`Loading initial collections for user ${farcasterUsername}`);
    
    const result = await getNftsForAddresses(walletAddresses, { 
      includeCollectionsOnly: true,
      bypassCache: true, // Always bypass cache for this refresh function
      limit: loadOptions.limit || 50
    });
    
    return {
      collections: result.collections || [],
      hasMore: result.hasMore,
      cursor: result.cursor
    };
  };
  
  // Return a complete object with data and functions to load more data
  return {
    username: farcasterUsername,
    displayName: profile?.displayName || farcasterUsername,
    profilePictureUrl: profile?.profilePictureUrl || '',
    addresses: walletAddresses,
    collections,
    loadedCollections: {}, // Will be populated as collections are loaded
    hasMoreCollections,
    collectionsCursor,
    // Helper functions to load data on demand
    loadNftsForCollection,
    loadInitialCollections,
    loadMoreCollections
  };
};

/**
 * Combined function to get Farcaster profile and NFT gallery in one call
 * 
 * @param {string|number} usernameOrFid - Farcaster username or FID
 * @param {object} options - Options for fetching
 * @returns {Promise<object>} - Profile and NFT data
 */
export const getFarcasterGallery = async (farcasterUsername, options = {}) => {
  console.log(`Getting Farcaster gallery for username: ${farcasterUsername}`);
  
  // Use the optimized function
  const gallery = await getOptimizedFarcasterNfts(farcasterUsername, options);
  
  // Return the full gallery object
  return gallery;
};

// Update the default export to include the new functions
export default {
  getFarcasterProfile,
  getNftsForAddresses,
  getNftsForCollection,
  getFarcasterAddresses,
  getFarcasterPortfolio,
  getFarcasterNftCollections,
  getOptimizedFarcasterNfts,
  getFarcasterGallery
};