/**
 * Direct Alchemy SDK Integration
 * Based on official documentation at https://docs.alchemy.com/reference/nfts-by-owner
 */

import { Alchemy, Network } from 'alchemy-sdk';

// Get the API key from environment variables
const apiKey = process.env.REACT_APP_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY;

// Configure the Alchemy SDK
const config = {
  apiKey: apiKey,
  network: Network.ETH_MAINNET,
};

// Create a single Alchemy instance
const alchemy = new Alchemy(config);

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
    console.log(`Fetching NFTs for ${owner} using Alchemy SDK`);
    
    // Set default options
    const fetchOptions = {
      pageSize: options.pageSize || 100,
      pageKey: options.pageKey || undefined,
      excludeFilters: ['SPAM'],
      omitMetadata: false, // Always include metadata
    };
    
    // Make the API call using the SDK
    const nftsData = await alchemy.nft.getNftsForOwner(owner, fetchOptions);
    
    console.log(`Successfully fetched ${nftsData.ownedNfts.length} NFTs for ${owner}`);
    
    return {
      nfts: nftsData.ownedNfts,
      pageKey: nftsData.pageKey,
      totalCount: nftsData.totalCount,
      hasMore: !!nftsData.pageKey,
    };
  } catch (error) {
    console.error('Error fetching NFTs from Alchemy:', error);
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
    console.log(`Fetching NFTs for ${addresses.length} addresses using Alchemy SDK`);
    
    // Make API calls in parallel for better performance
    const requests = addresses.map(address => 
      getNFTsForOwner(address, options)
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

export default {
  getNFTsForOwner,
  getNFTsForMultipleOwners
}; 