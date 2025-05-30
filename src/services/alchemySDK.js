/**
 * Direct Alchemy SDK Integration
 * Based on official documentation at https://docs.alchemy.com/reference/nfts-by-owner
 */

import { Alchemy, Network } from 'alchemy-sdk';
import axios from 'axios';

// Never use direct API key from client - always use the proxy
// This environment variable should be completely ignored in production
const apiKey = 'unused-client-side-key';

// Define the base URL for the proxy endpoint
const PROXY_URL = '/alchemy';

// Configure the Alchemy SDK with improved reliability settings
const config = {
  apiKey: apiKey,
  network: Network.ETH_MAINNET,
  maxRetries: 3,            // Retry failed requests
  requestTimeout: 15000,    // 15 second timeout to avoid hanging
  batchRequests: false      // Disable batch requests for more reliable operation
};

// Create a single Alchemy instance
const alchemy = new Alchemy(config);

/**
 * Improved NFT fetching using the proxy endpoint instead of direct API calls
 * This ensures we use the server's API key and not expose any keys client-side
 */
const fetchNFTsViaProxy = async (address, options = {}) => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    
    // Define chains to fetch from
    const chains = options.chains || ['eth', 'polygon', 'arbitrum', 'optimism', 'base'];
    let allNfts = [];
    
    // For each chain, fetch NFTs and process pagination
    for (const chain of chains) {
      console.log(`Fetching NFTs for ${address} on ${chain}`);
      let pageKey = null;
      let hasMore = true;
      
      // Continue fetching pages until no more NFTs
      while (hasMore) {
        // Use the proxy endpoint
        const response = await axios.get(PROXY_URL, {
          params: {
            endpoint: 'getnftsforowner',
            chain: chain,
            owner: address,
            pageSize: options.pageSize || 100,
            pageKey: pageKey,
            withMetadata: true,
            includeMedia: true
          }
        });
        
        // Process the response
        const data = response.data;
        
        // Add chain identifier to each NFT
        const nftsWithChain = (data.ownedNfts || []).map(nft => ({
          ...nft,
          chain: chain
        }));
        
        // Add NFTs to our collection
        allNfts = [...allNfts, ...nftsWithChain];
        console.log(`Fetched ${nftsWithChain.length} NFTs for ${address} on ${chain}. Total: ${allNfts.length}`);
        
        // Check if there are more pages
        pageKey = data.pageKey;
        hasMore = !!pageKey && options.fetchAllPages !== false;
        
        // Safety limit - don't fetch more than 5 pages per chain
        if (allNfts.length > 500 && options.fetchAllPages !== true) {
          console.log(`Reached safety limit of 500 NFTs on ${chain}. Use options.fetchAllPages=true to override.`);
          hasMore = false;
        }
      }
    }
    
    // Return consolidated results
    return {
      nfts: allNfts,
      totalCount: allNfts.length,
      hasMore: false // All pages have been fetched
    };
  } catch (error) {
    console.error('Error fetching NFTs via proxy:', error);
    throw error;
  }
};

/**
 * Fetch NFTs for a wallet address using the Alchemy SDK
 * @param {string} owner - Owner wallet address
 * @param {object} options - Additional options
 * @returns {Promise<object>} NFT data directly from Alchemy
 */
export const getNFTsForOwner = async (owner, options = {}) => {
  if (!owner) {
    throw new Error('Owner address is required');
  }

  try {
    console.log(`Fetching NFTs for ${owner} via proxy endpoint`);
    
    // Always use the proxy endpoint instead of direct Alchemy API calls
    return fetchNFTsViaProxy(owner, options);
  } catch (error) {
    console.error(`Error fetching NFTs for ${owner}:`, error);
    throw error;
  }
};

/**
 * Fetch NFTs for multiple wallet addresses in parallel
 * @param {Array<string>} addresses - Array of wallet addresses
 * @param {object} options - Additional options
 * @returns {Promise<object>} Combined NFT data
 */
export const getNFTsForMultipleOwners = async (addresses, options = {}) => {
  if (!addresses || addresses.length === 0) {
    return { nfts: [], pageKey: null, totalCount: 0, hasMore: false };
  }

  try {
    console.log(`Fetching NFTs for ${addresses.length} addresses via proxy endpoint`);
    
    // Make API calls in parallel for better performance
    const requests = addresses.map(address => 
      fetchNFTsViaProxy(address, options)
        .then(result => ({
          ...result,
          // Add owner address to each NFT for filtering later
          nfts: result.nfts.map(nft => ({
            ...nft,
            ownerAddress: address,
          })),
        }))
        .catch(error => {
          console.error(`Error fetching NFTs for ${address}:`, error);
          return { nfts: [], pageKey: null, totalCount: 0, hasMore: false };
        })
    );
    
    // Wait for all requests to complete
    const results = await Promise.all(requests);
    
    // Combine all NFTs into a single array
    const allNfts = results.flatMap(result => result.nfts);
    
    // Calculate total count across all wallets
    const totalCount = results.reduce((sum, result) => sum + result.totalCount, 0);
    
    // Check if any wallet has more pages
    const hasMore = results.some(result => result.hasMore);
    
    console.log(`Successfully fetched ${allNfts.length} NFTs for ${addresses.length} addresses`);
    
    return {
      nfts: allNfts,
      pageKey: null, // No combined pageKey for multiple wallets
      totalCount,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching NFTs for multiple addresses:', error);
    throw error;
  }
};

// Export both the Alchemy SDK instance and our custom methods
export default {
  // Alchemy SDK instance - only used for methods not requiring direct API access
  alchemy,
  
  // Custom methods
  fetchNFTsViaProxy,
  
  // Alchemy NFT API methods
  getNftsForOwner: async (owner, options = {}) => {
    // Always use the proxy endpoint instead of direct Alchemy API
    return fetchNFTsViaProxy(owner, options);
  },
  
  // Add getNFTsForMultipleOwners to the exported object
  getNFTsForMultipleOwners,
  
  // Additional methods can be added here
}; 