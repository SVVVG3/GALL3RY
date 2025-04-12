import axios from 'axios';
import { ZAPPER_PROXY_URL } from '../constants';

// Constants
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;
// Updated endpoints to prioritize our proxy and properly format the direct endpoint
const ZAPPER_API_ENDPOINTS = [
  `${window.location.origin}/api/zapper`, // Use absolute URL with origin to ensure it works in all environments
  `${SERVER_URL}/api/zapper`              // Fallback to SERVER_URL based endpoint
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
        if (endpoint.includes('api.zapper.xyz') && ZAPPER_API_KEY) {
          headers['Authorization'] = `Basic ${ZAPPER_API_KEY}`;
        }
        
        console.log(`Trying endpoint: ${endpoint}, attempt ${retryCount + 1}/${maxRetries}`);
        
        const response = await axios.post(endpoint, {
          query,
          variables,
        }, { headers });
        
        // Check if response has errors
        if (response.data.errors) {
          throw new Error(response.data.errors[0]?.message || 'GraphQL error');
        }
        
        return response.data;
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
    // Make the request to the Zapper API
    const response = await makeGraphQLRequest(query, variables);
    
    // Check if profile was found
    if (!response.data || !response.data.farcasterProfile) {
      // If using ENS name and first attempt failed, try the alternative (without .eth)
      if (isEnsName && alternativeUsername) {
        console.log(`Trying alternative username: ${alternativeUsername}`);
        
        const altResponse = await makeGraphQLRequest(query, { username: alternativeUsername });
        
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
    console.error('Error fetching Farcaster profile from Zapper API:', error);
    throw error;
  }
};

/**
 * Get NFTs for multiple addresses
 * @param {string[]} addresses - Array of wallet addresses
 * @param {object} options - Options for the request
 * @returns {Promise<object>} - Object containing NFTs and pagination info
 */
export const getNftsForAddresses = async (addresses, options = {}) => {
  if (!addresses || addresses.length === 0) {
    console.warn('No addresses provided for getNftsForAddresses');
    return { nfts: [], cursor: null, hasMore: false };
  }
  
  const { 
    limit = 100, 
    cursor = null, 
    prioritizeSpeed = true, 
    includeValue = true,
    includeMetadata = true,
    endpoints = ZAPPER_API_ENDPOINTS,
    maxRetries = 3
  } = options;
  
  // Use different query formats based on what endpoint we're using
  // This is to support both Zapper's direct API and potentially different proxy implementations
  
  // NFT query - updated to be compatible with Zapper API v2
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

  // Alternative query format for portfolioV2 endpoint
  const portfolioV2Query = `
    query getPortfolioNfts($addresses: [Address!]!, $limit: Int!, $cursor: String) {
      portfolioV2(addresses: $addresses) {
        nftBalances {
          totalCount
          nfts(first: $limit, after: $cursor) {
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
      }
    }
  `;

  const allNfts = [];
  let lastCursor = null;
  let hasMoreResults = false;
  
  // Limit the number of addresses processed if prioritizeSpeed is true
  const addressesToProcess = prioritizeSpeed ? addresses.slice(0, 5) : addresses;
  
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
              name: item.name,
              description: item.description,
              imageUrl: item.imageUrl,
              imageUrlThumbnail: item.imageUrlThumbnail,
              collection: {
                id: item.collection.id,
                name: item.collection.name,
                address: item.collection.address,
                network: item.collection.network,
                imageUrl: item.collection.imageUrl,
                floorPrice: item.collection.floorPrice,
                nftsCount: item.collection.nftsCount,
              },
              estimatedValue: {
                amount: item.estimatedValue.amount,
                currency: item.estimatedValue.currency,
              },
              lastSalePrice: {
                amount: item.lastSalePrice.amount,
                currency: item.lastSalePrice.currency,
              },
              network: item.network,
              attributes: item.attributes.map(attr => ({
                trait_type: attr.trait_type,
                value: attr.value,
              })),
              marketplaceUrls: item.marketplaceUrls.map(url => ({
                name: url.name,
                url: url.url,
              })),
            }));
            
            allNfts.push(...nfts);
            
            if (response.data.nfts.pageInfo.hasNextPage) {
              currentCursor = response.data.nfts.pageInfo.endCursor;
            } else {
              hasNextPage = false;
            }
          }
        } catch (error) {
          console.error('Error fetching NFTs from Zapper API:', error);
          throw error;
        }
      } catch (error) {
        console.error('Error fetching NFTs:', error);
        throw error;
      }
    }
    
    if (fetchedCount < maxToFetch) {
      hasNextPage = false;
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
  };
};
