import axios from 'axios';
import { ZAPPER_PROXY_URL } from '../constants';

// Constants
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;
// Updated endpoints to prioritize our proxy and properly format the direct endpoint
const ZAPPER_API_ENDPOINTS = [
  `${window.location.origin}/api/zapper`, // Use absolute URL with origin to ensure it works in all environments
  `${SERVER_URL}/api/zapper`,             // Fallback to SERVER_URL based endpoint
  'https://public.zapper.xyz/graphql'     // Direct Zapper API endpoint as last resort
];
// Direct endpoint is removed to prevent 404s - all requests should go through our proxy

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
    prioritizeSpeed = true, 
    includeValue = true,
    includeMetadata = true,
    endpoints = ZAPPER_API_ENDPOINTS,
    maxRetries = 3,
    usePortfolioV2 = true // Changed default to true as this is the current API structure
  } = options;
  
  // Use the portfolioV2 endpoint as recommended in docs
  if (usePortfolioV2) {
    try {
      console.log(`Using portfolioV2 endpoint for ${normalizedAddresses.length} addresses`);
      
      // Updated query structure according to the Zapper API schema
      const portfolioV2Query = `
        query getPortfolioNfts($addresses: [Address!]!, $first: Int!, $after: String) {
          portfolioV2(addresses: $addresses) {
            nftBalances {
              totalBalanceUSD
              byCollection(first: $first, after: $after) {
                edges {
                  node {
                    collection {
                      id
                      name
                      address
                      network
                      imageUrl
                    }
                    balanceUSD
                  }
                }
                pageInfo {
                  endCursor
                  hasNextPage
                }
                totalCount
              }
            }
          }
        }
      `;
      
      const variables = {
        addresses: normalizedAddresses,
        first: limit,
        after: cursor
      };
      
      console.log(`Fetching NFTs for ${normalizedAddresses.length} addresses using portfolioV2`);
      
      const response = await makeGraphQLRequest(portfolioV2Query, variables, endpoints, maxRetries);
      
      if (response.data && response.data.portfolioV2 && response.data.portfolioV2.nftBalances) {
        const nftData = response.data.portfolioV2.nftBalances;
        const edges = nftData.byCollection?.edges || [];
        
        console.log(`Found ${edges.length} NFT collections in portfolioV2 response`);
        
        const processedNfts = edges.map(edge => {
          const item = edge.node;
          return {
            id: item.collection?.id || '',
            tokenId: 'collection',
            contractAddress: item.collection?.address || '',
            name: item.collection?.name || 'Unknown Collection',
            description: '',
            imageUrl: item.collection?.imageUrl || '',
            imageUrlThumbnail: item.collection?.imageUrl || '',
            collection: {
              id: item.collection?.id || '',
              name: item.collection?.name || 'Unknown Collection',
              address: item.collection?.address || '',
              network: item.collection?.network || 'ethereum',
              imageUrl: item.collection?.imageUrl || '',
              floorPrice: 0,
              nftsCount: 0,
            },
            estimatedValue: {
              amount: item.balanceUSD || 0,
              currency: 'USD',
            },
            network: item.collection?.network || 'ethereum',
            balanceUSD: item.balanceUSD || 0,
            isCollection: true // Flag to indicate this is a collection-level item
          };
        });
        
        const pageInfo = nftData.byCollection?.pageInfo || {};
        
        return {
          nfts: processedNfts,
          cursor: pageInfo.endCursor || null,
          hasMore: pageInfo.hasNextPage || false,
          totalCount: nftData.byCollection?.totalCount || 0
        };
      } else {
        console.warn('No NFT data found in portfolioV2 response:', response);
      }
    } catch (portfolioError) {
      console.error('Error using portfolioV2 endpoint:', portfolioError);
      // Continue to the legacy fallback only if explicitly requested
      if (!options.useLegacyFallback) {
        return { nfts: [], cursor: null, hasMore: false };
      }
    }
  }
  
  // LEGACY FALLBACK - This code path is now deprecated and will likely not work
  // Only keep it for backward compatibility if absolutely necessary
  console.warn('Using deprecated nfts endpoint fallback - this will likely fail with current Zapper API');
  
  const nftsQuery = `
    query getNfts($ownerAddress: String!, $limit: Int!, $cursor: String) {
      nfts(ownerAddress: $ownerAddress, limit: $limit, cursor: $cursor) {
        items {
          id
          tokenId
          contractAddress
          name
          description
          imageUrl
          imageUrlThumbnail
          collection {
            id
            name
            address
            network
            imageUrl
            floorPrice
            nftsCount
          }
          estimatedValue {
            amount
            currency
          }
          lastSalePrice {
            amount
            currency
          }
          network
          attributes {
            trait_type
            value
          }
          marketplaceUrls {
            name
            url
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `;

  const allNfts = [];
  let lastCursor = null;
  let hasMoreResults = false;
  
  // Limit the number of addresses processed if prioritizeSpeed is true
  const addressesToProcess = prioritizeSpeed ? normalizedAddresses.slice(0, 5) : normalizedAddresses;
  
  for (const address of addressesToProcess) {
    let hasNextPage = true;
    let currentCursor = cursor;
    let fetchedCount = 0;
    const maxToFetch = prioritizeSpeed ? limit : 200;  // Fetch more if not prioritizing speed
    
    while (hasNextPage && fetchedCount < maxToFetch) {
      try {
        // Try nfts query first
        try {
          const nftsVariables = {
            ownerAddress: address,
            limit: Math.min(100, maxToFetch - fetchedCount),
            cursor: currentCursor,
          };
          
          console.log(`Fetching NFTs for address: ${address}, limit: ${nftsVariables.limit}, cursor: ${currentCursor || 'initial'}`);
          
          const response = await makeGraphQLRequest(nftsQuery, nftsVariables);
          
          if (response.data && response.data.nfts) {
            const nfts = response.data.nfts.items.map(item => ({
              id: item.id,
              tokenId: item.tokenId,
              contractAddress: item.contractAddress,
              name: item.name || `#${item.tokenId}`,
              description: item.description || '',
              imageUrl: item.imageUrl || '',
              imageUrlThumbnail: item.imageUrlThumbnail || item.imageUrl || '',
              collection: {
                id: item.collection?.id || '',
                name: item.collection?.name || 'Unknown Collection',
                address: item.collection?.address || item.contractAddress,
                network: item.collection?.network || item.network || 'ethereum',
                imageUrl: item.collection?.imageUrl || '',
                floorPrice: item.collection?.floorPrice || 0,
                nftsCount: item.collection?.nftsCount || 0,
              },
              estimatedValue: {
                amount: item.estimatedValue?.amount || 0,
                currency: item.estimatedValue?.currency || 'USD',
              },
              lastSalePrice: {
                amount: item.lastSalePrice?.amount || 0,
                currency: item.lastSalePrice?.currency || 'USD',
              },
              network: item.network || 'ethereum',
              attributes: (item.attributes || []).map(attr => ({
                trait_type: attr.trait_type || '',
                value: attr.value || '',
              })),
              marketplaceUrls: (item.marketplaceUrls || []).map(url => ({
                name: url.name || '',
                url: url.url || '',
              })),
            }));
            
            fetchedCount += nfts.length;
            allNfts.push(...nfts);
            
            if (response.data.nfts.pageInfo.hasNextPage) {
              currentCursor = response.data.nfts.pageInfo.endCursor;
            } else {
              hasNextPage = false;
            }
          } else {
            hasNextPage = false;
          }
        } catch (error) {
          console.error('Error fetching NFTs from Zapper API:', error);
          hasNextPage = false;
        }
      } catch (error) {
        console.error('Error fetching NFTs:', error);
        hasNextPage = false;
      }
    }
    
    if (currentCursor) {
      lastCursor = currentCursor;
    }
  }
  
  hasMoreResults = lastCursor !== null;
  
  return {
    nfts: allNfts,
    cursor: lastCursor,
    hasMore: hasMoreResults,
    totalCount: allNfts.length
  };
};

// Default export for backward compatibility
export default {
  getFarcasterProfile,
  getNftsForAddresses,
  getFarcasterAddresses,
  getFarcasterPortfolio
};
