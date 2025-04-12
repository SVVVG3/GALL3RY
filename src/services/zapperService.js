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
  
  // For ENS names, try both with and without .eth suffix
  let isEnsName = false;
  let alternativeUsername = null;
  
  if (!isFid && cleanInput.toLowerCase().endsWith('.eth')) {
    isEnsName = true;
    // Get the username without .eth
    alternativeUsername = cleanInput.substring(0, cleanInput.length - 4);
    console.log(`Input appears to be ENS name: ${cleanInput}, will also try: ${alternativeUsername}`);
  }
  
  // Construct the query variables based on input type
  const variables = isFid 
    ? { fid: parseInt(cleanInput, 10) }
    : { username: cleanInput };
  
  console.log(`Fetching Farcaster profile for ${isFid ? 'FID' : 'username'}: ${cleanInput}`);
  
  // GraphQL query according to Zapper API docs
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
    // First attempt with original input
    try {
      const response = await makeGraphQLRequest(query, variables);
      
      // Check if profile was found
      if (response.data && response.data.farcasterProfile) {
        const profile = response.data.farcasterProfile;
        
        // Ensure we have consistent field names for our application
        return {
          fid: profile.fid,
          username: profile.username,
          displayName: profile.metadata?.displayName || profile.username,
          avatarUrl: profile.metadata?.imageUrl,
          bio: profile.metadata?.description,
          custodyAddress: profile.custodyAddress,
          connectedAddresses: profile.connectedAddresses || [],
          // Include the full profile for debugging
          _rawProfile: profile
        };
      }
    } catch (firstError) {
      console.log(`First attempt failed: ${firstError.message}`);
    }
    
    // If this is an ENS name and the first attempt failed, try the alternative (without .eth)
    if (isEnsName && alternativeUsername) {
      console.log(`Trying alternative username: ${alternativeUsername}`);
      
      try {
        const altResponse = await makeGraphQLRequest(query, { username: alternativeUsername });
        
        // Check if profile was found with alternative username
        if (altResponse.data && altResponse.data.farcasterProfile) {
          console.log(`Found profile using alternative username: ${alternativeUsername}`);
          const profile = altResponse.data.farcasterProfile;
          
          return {
            fid: profile.fid,
            username: profile.username,
            displayName: profile.metadata?.displayName || profile.username,
            avatarUrl: profile.metadata?.imageUrl,
            bio: profile.metadata?.description,
            custodyAddress: profile.custodyAddress,
            connectedAddresses: profile.connectedAddresses || [],
            _rawProfile: profile
          };
        }
      } catch (secondError) {
        console.log(`Alternative username attempt failed: ${secondError.message}`);
      }
    }
    
    // If we reach this point, try the direct Warpcast API as a fallback
    try {
      console.log(`Trying Warpcast API fallback for: ${cleanInput}`);
      const warpcastResponse = await fetch(`/api/farcaster-user?username=${encodeURIComponent(cleanInput)}`);
      const warpcastData = await warpcastResponse.json();
      
      if (warpcastResponse.ok && warpcastData.profile) {
        console.log('Found profile via Warpcast API fallback');
        return warpcastData.profile;
      }
      
      // If ENS name, try alternative with Warpcast API too
      if (isEnsName && alternativeUsername) {
        const altWarpcastResponse = await fetch(`/api/farcaster-user?username=${encodeURIComponent(alternativeUsername)}`);
        const altWarpcastData = await altWarpcastResponse.json();
        
        if (altWarpcastResponse.ok && altWarpcastData.profile) {
          console.log(`Found profile via Warpcast API with alternative username: ${alternativeUsername}`);
          return altWarpcastData.profile;
        }
      }
    } catch (warpcastError) {
      console.log(`Warpcast API fallback failed: ${warpcastError.message}`);
    }
    
    // If we reach here, all attempts failed
    throw new Error(`Could not find Farcaster profile for ${isFid ? 'FID' : 'username'}: ${cleanInput}`);
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error);
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
          
          console.log(`Fetching NFTs for ${address}, page cursor: ${currentCursor || 'initial'}`);
          const response = await makeGraphQLRequest(nftsQuery, nftsVariables, endpoints, maxRetries);
          
          if (response.data?.nfts?.items) {
            const nftsData = response.data.nfts.items;
            fetchedCount += nftsData.length;
            
            const processedNfts = nftsData.map(nft => ({
              id: nft.id,
              tokenId: nft.tokenId,
              contractAddress: nft.contractAddress,
              name: nft.name || 'Unnamed NFT',
              description: nft.description || '',
              imageUrl: nft.imageUrl || nft.imageUrlThumbnail || '',
              thumbnailUrl: nft.imageUrlThumbnail || nft.imageUrl || '',
              collection: nft.collection ? {
                id: nft.collection.id,
                name: nft.collection.name || 'Unknown Collection',
                address: nft.collection.address,
                network: nft.collection.network,
                imageUrl: nft.collection.imageUrl || '',
                floorPrice: nft.collection.floorPrice || 0,
                nftsCount: nft.collection.nftsCount || 0
              } : null,
              estimatedValue: nft.estimatedValue ? {
                amount: nft.estimatedValue.amount || 0,
                currency: nft.estimatedValue.currency || 'ETH',
              } : null,
              lastSalePrice: nft.lastSalePrice ? {
                amount: nft.lastSalePrice.amount || 0,
                currency: nft.lastSalePrice.currency || 'ETH',
              } : null,
              network: nft.network || 'ethereum',
              attributes: nft.attributes || [],
              marketplaceUrls: nft.marketplaceUrls || [],
              ownerAddress: address,
            }));
            
            allNfts.push(...processedNfts);
            
            const pageInfo = response.data.nfts.pageInfo;
            hasNextPage = pageInfo.hasNextPage;
            currentCursor = pageInfo.endCursor;
            lastCursor = currentCursor;
            
            // If we have hasNextPage=true when we stop fetching, set hasMoreResults to true
            if (hasNextPage && fetchedCount >= maxToFetch) {
              hasMoreResults = true;
            }
            
            continue; // Successfully processed with nfts query
          }
        } catch (nftsError) {
          console.warn(`NFTs query failed for ${address}, trying portfolioV2:`, nftsError.message);
        }
        
        // If nfts query fails, try portfolioV2
        try {
          const portfolioVariables = {
            addresses: [address],
            limit: Math.min(100, maxToFetch - fetchedCount),
            cursor: currentCursor,
          };
          
          console.log(`Trying portfolioV2 query for ${address}`);
          const portfolioResponse = await makeGraphQLRequest(portfolioV2Query, portfolioVariables, endpoints, maxRetries);
          
          if (portfolioResponse.data?.portfolioV2?.nftBalances?.nfts?.edges) {
            const edges = portfolioResponse.data.portfolioV2.nftBalances.nfts.edges;
            fetchedCount += edges.length;
            
            const processedNfts = edges.map(edge => {
              const nft = edge.node;
              return {
                id: nft.id,
                tokenId: nft.tokenId,
                contractAddress: nft.contractAddress,
                name: nft.name || 'Unnamed NFT',
                description: nft.description || '',
                imageUrl: nft.imageUrl || '',
                thumbnailUrl: nft.imageUrl || '',
                collection: nft.collection ? {
                  id: nft.collection.id,
                  name: nft.collection.name || 'Unknown Collection',
                  address: nft.collection.address,
                  network: nft.collection.network,
                  imageUrl: nft.collection.imageUrl || '',
                  floorPrice: nft.collection.floorPrice || 0
                } : null,
                estimatedValue: nft.estimatedValue ? {
                  amount: nft.estimatedValue.amount || 0,
                  currency: nft.estimatedValue.currency || 'ETH',
                } : null,
                network: nft.network || 'ethereum',
                attributes: nft.attributes || [],
                ownerAddress: address,
              };
            });
            
            allNfts.push(...processedNfts);
            
            const pageInfo = portfolioResponse.data.portfolioV2.nftBalances.nfts.pageInfo;
            hasNextPage = pageInfo.hasNextPage;
            currentCursor = pageInfo.endCursor;
            lastCursor = currentCursor;
            
            if (hasNextPage && fetchedCount >= maxToFetch) {
              hasMoreResults = true;
            }
            
            continue; // Successfully processed with portfolioV2 query
          } else {
            throw new Error('No NFT data found in portfolioV2 response');
          }
        } catch (portfolioError) {
          console.warn(`PortfolioV2 query failed for ${address}:`, portfolioError.message);
          console.warn('No NFTs found or API error for address', address);
          break; // Move to next address
        }
      } catch (error) {
        console.error(`Error fetching NFTs for address ${address}:`, error);
        break; // Move to next address
      }
    }
  }
  
  console.log(`Finished fetching NFTs: Found ${allNfts.length} NFTs across ${addressesToProcess.length} addresses`);
  
  return {
    nfts: allNfts,
    cursor: lastCursor,
    hasMore: hasMoreResults,
  };
};

export default {
  getNftsForAddresses,
  getFarcasterProfile
}; 