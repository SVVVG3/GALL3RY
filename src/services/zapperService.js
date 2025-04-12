import axios from 'axios';
import { ZAPPER_PROXY_URL } from '../constants';

// Constants
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : '';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY;
const ZAPPER_API_ENDPOINTS = [
  `${SERVER_URL}/api/zapper`,
  'https://api.zapper.xyz/v2/graphql'
];

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

  // Determine if input is a FID (number) or username (string)
  const isFid = !isNaN(Number(usernameOrFid));
  
  // Construct the query variables based on input type
  const variables = isFid 
    ? { fid: parseInt(usernameOrFid, 10) }
    : { username: usernameOrFid.toString() };
  
  console.log(`Fetching Farcaster profile for ${isFid ? 'FID' : 'username'}: ${usernameOrFid}`);
  
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
    const response = await makeGraphQLRequest(query, variables);
    
    // Check if profile was found
    if (!response.data || !response.data.farcasterProfile) {
      throw new Error(`Could not find Farcaster profile for ${isFid ? 'FID' : 'username'}: ${usernameOrFid}`);
    }
    
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
  const { 
    limit = 100, 
    cursor = null, 
    prioritizeSpeed = true, 
    includeValue = true,
    includeMetadata = true,
    endpoints = ZAPPER_API_ENDPOINTS,
    maxRetries = 3
  } = options;
  
  // Enhanced query with more fields
  const query = `
    query GetNfts($address: String!, $limit: Int!, $cursor: String) {
      nfts(ownerAddress: $address, limit: $limit, cursor: $cursor) {
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
  const addressesToProcess = prioritizeSpeed ? addresses.slice(0, 3) : addresses;
  
  for (const address of addressesToProcess) {
    let hasNextPage = true;
    let currentCursor = cursor;
    let fetchedCount = 0;
    const maxToFetch = prioritizeSpeed ? limit : 200;  // Fetch more if not prioritizing speed
    
    while (hasNextPage && fetchedCount < maxToFetch) {
      try {
        const variables = {
          address,
          limit: Math.min(100, maxToFetch - fetchedCount),  // Zapper API max per page is 100
          cursor: currentCursor,
        };
        
        console.log(`Fetching NFTs for ${address}, page cursor: ${currentCursor || 'initial'}`);
        const response = await makeGraphQLRequest(query, variables, endpoints, maxRetries);
        
        if (!response.data?.nfts?.items) {
          console.warn(`No NFTs found for address ${address}`);
          break;
        }
        
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
      } catch (error) {
        console.error(`Error fetching NFTs for address ${address}:`, error);
        break;
      }
    }
  }
  
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