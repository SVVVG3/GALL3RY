import axios from 'axios';
import { getApiBaseUrl } from '../utils/runtimeConfig';

// Base URL for Alchemy API requests
const getBaseUrl = () => {
  // Use the runtime config URL or fallback to environment variable
  // This helps work correctly with the dynamic port in development
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.apiUrl) {
    return `${window.__RUNTIME_CONFIG__.apiUrl}/alchemy`;
  }
  
  // Production fallback
  if (process.env.NODE_ENV === 'production') {
    return `${window.location.origin}/api/alchemy`;
  }
  
  // Development fallback (note: the actual port may change, but this will be overridden by runtime config)
  return 'http://localhost:3001/api/alchemy';
};

// Initialize the SERVER_URL with a default value
// Will be updated dynamically when initializeEndpoints() is called
let SERVER_URL = '';
let ALCHEMY_ENDPOINT = '';

// Initialize endpoints after we've loaded the API base URL
async function initializeEndpoints() {
  try {
    const baseUrl = await getApiBaseUrl();
    
    // Only update if SERVER_URL has changed or is not yet set
    if (!SERVER_URL || SERVER_URL !== baseUrl) {
      SERVER_URL = baseUrl;
      console.log(`Initialized Alchemy SERVER_URL: ${SERVER_URL}`);
      
      ALCHEMY_ENDPOINT = `${SERVER_URL}/alchemy`;
      console.log(`Alchemy API endpoint initialized: ${ALCHEMY_ENDPOINT}`);
    }
  } catch (error) {
    console.error('Failed to initialize Alchemy endpoints:', error);
    // Fallback to default values
    SERVER_URL = '/api';
    ALCHEMY_ENDPOINT = `${SERVER_URL}/alchemy`;
  }
}

// Call initialization immediately
initializeEndpoints();

// Reinitialize service periodically
setInterval(() => {
  console.log('Refreshing Alchemy API endpoints configuration...');
  initializeEndpoints()
    .then(() => console.log('Alchemy API endpoints refreshed'))
    .catch(err => console.error('Failed to refresh Alchemy API endpoints:', err));
}, 60000); // Check every minute

// Define all supported chains
const SUPPORTED_CHAINS = [
  { id: 'eth', name: 'Ethereum', network: 'ethereum' },
  { id: 'polygon', name: 'Polygon', network: 'polygon' },
  { id: 'opt', name: 'Optimism', network: 'optimism' },
  { id: 'arb', name: 'Arbitrum', network: 'arbitrum' },
  { id: 'base', name: 'Base', network: 'base' }
];

/**
 * Service for interacting with Alchemy NFT APIs
 * Updated to follow Alchemy NFT API v3 documentation
 */
const alchemyService = {
  /**
   * Helper to convert network name to chain ID
   */
  getChainId(network) {
    const chain = SUPPORTED_CHAINS.find(c => 
      c.network.toLowerCase() === network.toLowerCase() || 
      c.id.toLowerCase() === network.toLowerCase()
    );
    return chain ? chain.id : 'eth';
  },
  
  /**
   * Get NFTs owned by an address
   * Updated to use Alchemy's network-specific endpoints correctly
   */
  async getNftsForOwner(ownerAddress, options = {}) {
    const { 
      network = 'ethereum', 
      pageKey, 
      pageSize = 100,
      excludeSpam = true,
      excludeAirdrops = true,
      fetchAll = true  // Option to fetch all pages
    } = options;
    
    const chainId = this.getChainId(network);
    
    try {
      // Build filter array based on options
      const filters = [];
      if (excludeSpam) filters.push('SPAM');
      if (excludeAirdrops) filters.push('AIRDROPS');
      
      // If fetchAll is true, we'll collect all pages of NFTs
      let allNfts = [];
      let currentPageKey = pageKey;
      let totalFetched = 0;
      let hasMorePages = true;
      
      // Loop to fetch all pages if fetchAll is true
      while (hasMorePages) {
        // Build the correct URL for the specific network
        // For example, eth-mainnet, polygon-mainnet, etc.
        const networkPrefix = 
          chainId === 'eth' ? 'eth-mainnet' : 
          chainId === 'polygon' ? 'polygon-mainnet' : 
          chainId === 'opt' ? 'opt-mainnet' : 
          chainId === 'arb' ? 'arb-mainnet' : 
          chainId === 'base' ? 'base-mainnet' : 'eth-mainnet';
        
        // Create params according to the Alchemy API documentation
        const params = {
          endpoint: 'getNFTsForOwner',
          owner: ownerAddress,
          pageSize,
          withMetadata: true,
          pageKey: currentPageKey || undefined,
          excludeFilters: filters.length > 0 ? filters : undefined,
          chain: chainId // This should be used by our backend to route to the correct endpoint
        };
        
        console.log(`Fetching NFTs for ${ownerAddress} on ${chainId}${currentPageKey ? ' (continuation page)' : ''} with filters: ${filters.join(', ')}`);
        
        // Make the request to Alchemy's NFT API
        const response = await axios.get(ALCHEMY_ENDPOINT, { params });
        
        // Process NFTs from this page
        const nftsFromPage = (response.data?.ownedNfts || []).map(nft => ({
          ...nft,
          network: chainId,
          ownerAddress,
          // Add uniqueId for consistency
          uniqueId: this.createConsistentUniqueId({
            ...nft,
            network: chainId,
            contract: { ...nft.contract },
            tokenId: nft.tokenId
          })
        }));
        
        // Add to our collection
        allNfts = [...allNfts, ...nftsFromPage];
        totalFetched += nftsFromPage.length;
        
        // Log progress
        console.log(`Received ${nftsFromPage.length} NFTs from Alchemy on ${chainId}${currentPageKey ? ' (continuation page)' : ''}, total: ${totalFetched}`);
        
        // Update pageKey for next iteration
        currentPageKey = response.data?.pageKey;
        
        // Determine if we should continue pagination
        hasMorePages = fetchAll && !!currentPageKey;
        
        // Safety check - don't loop infinitely
        if (totalFetched >= 1000) {
          console.warn(`Reached safety limit of 1000 NFTs for ${ownerAddress} on ${chainId}, stopping pagination`);
          hasMorePages = false;
        }
        
        // If we're not fetching all pages, break after first request
        if (!fetchAll) {
          break;
        }
      }
      
      return {
        nfts: allNfts,
        pageKey: currentPageKey,
        totalCount: totalFetched,
        hasMore: !!currentPageKey
      };
    } catch (error) {
      console.error(`Error fetching NFTs on ${chainId} for ${ownerAddress}:`, error.message);
      
      // Return empty result on failure for this chain
      return {
        nfts: [],
        pageKey: null,
        totalCount: 0,
        hasMore: false,
        error: error.message
      };
    }
  },
  
  /**
   * Fetch NFTs across multiple chains and combine the results
   */
  async fetchNftsAcrossChains(ownerAddress, options = {}) {
    // Get the chains to fetch from
    const chains = options.chains || SUPPORTED_CHAINS.map(c => c.id);
    const pageSize = options.pageSize || 100;
    const fetchAll = options.fetchAll !== false; // Default to true
    
    try {
      console.log(`Fetching NFTs across ${chains.length} chains for ${ownerAddress}${fetchAll ? ' (all pages)' : ''}`);
      
      // Make parallel requests to all chains
      const results = await Promise.allSettled(
        chains.map(chainId => 
          this.getNftsForOwner(ownerAddress, {
            network: chainId,
            pageSize,
            excludeSpam: options.excludeSpam !== false,
            excludeAirdrops: options.excludeAirdrops !== false,
            fetchAll: fetchAll
          })
        )
      );
      
      // Combine results from successful requests
      let allNfts = [];
      let totalErrors = 0;
      let totalCount = 0;
      
      results.forEach((result, index) => {
        const chainId = chains[index];
        
        if (result.status === 'fulfilled') {
          const nfts = result.value.nfts || [];
          totalCount += nfts.length;
          
          // Tag each NFT with its chain if not already tagged
          allNfts = [
            ...allNfts,
            ...nfts.map(nft => ({
              ...nft,
              network: nft.network || chainId
            }))
          ];
          
          console.log(`Added ${nfts.length} NFTs from ${chainId}`);
        } else {
          totalErrors++;
          console.error(`Failed to fetch NFTs from ${chainId}:`, result.reason);
        }
      });
      
      console.log(`Total: ${allNfts.length} NFTs found across ${chains.length - totalErrors}/${chains.length} chains`);
      
      return {
        nfts: allNfts,
        totalCount,
        hasMore: false, // We don't handle pagination across chains in this implementation
        chainsWithErrors: totalErrors > 0
      };
    } catch (error) {
      console.error('Error in fetchNftsAcrossChains:', error.message);
      // Even if there's an overall error, return any NFTs we might have fetched
      // instead of returning an empty array which would break the UI
      return {
        nfts: [],
        totalCount: 0,
        hasMore: false,
        error: error.message
      };
    }
  },
  
  /**
   * Creates a consistent unique identifier for NFTs across the application
   * @param {Object} nft - The NFT object 
   * @returns {string} A unique identifier string
   */
  createConsistentUniqueId(nft) {
    if (!nft) return '';
    
    // Extract contract address - normalize to lowercase
    const contractAddress = (
      (nft.contract?.address) || 
      (nft.contractAddress) || 
      ''
    ).toLowerCase();
    
    // Extract token ID - normalize to string
    const tokenId = String(
      (nft.tokenId) || 
      (nft.token_id) || 
      ''
    ).trim();
    
    // Extract network - normalize to lowercase
    const network = (
      (nft.network) || 
      'eth'
    ).toLowerCase();
    
    // Create a consistent unique ID
    return `${contractAddress}-${tokenId}-${network}`;
  },
  
  /**
   * Fetch NFTs for multiple addresses across multiple chains
   * Following Alchemy's recommended approach by using proper network-specific endpoints
   */
  async fetchNftsForMultipleAddresses(addresses, options = {}) {
    if (!addresses || addresses.length === 0) {
      console.warn('No addresses provided to fetchNftsForMultipleAddresses');
      return { nfts: [], totalCount: 0 };
    }
    
    try {
      // Filter out any invalid addresses to prevent errors
      const validAddresses = addresses.filter(addr => 
        addr && typeof addr === 'string' && addr.length > 0 && addr.startsWith('0x')
      ).map(addr => addr.toLowerCase());
      
      if (validAddresses.length === 0) {
        console.warn('No valid ETH addresses found after filtering');
        return { nfts: [], totalCount: 0, info: 'No valid addresses to query' };
      }
      
      // Get the chains to fetch from (with proper Alchemy network identifiers)
      const chains = options.chains || ['eth', 'polygon', 'opt', 'arb', 'base'];
      console.log(`Fetching NFTs for ${validAddresses.length} addresses across ${chains.length} chains using standard Alchemy endpoints`);
      
      // Track all unique NFTs by their uniqueId
      const uniqueNftsMap = new Map();
      
      // Process each chain separately with the appropriate network endpoint
      for (const chainId of chains) {
        console.log(`Processing chain: ${chainId}`);
        
        // For each address, fetch NFTs from this specific chain
        for (const address of validAddresses) {
          try {
            // Make sure we're using proper parameter names according to Alchemy docs
            const params = {
              endpoint: 'getNFTsForOwner',
              owner: address,
              chain: chainId,
              withMetadata: true,
              pageSize: options.pageSize || 100,
              // Use Alchemy's filter parameter for spam and airdrops
              excludeFilters: []
            };
            
            if (options.excludeSpam !== false) params.excludeFilters.push('SPAM');
            if (options.excludeAirdrops !== false) params.excludeFilters.push('AIRDROPS');
            
            console.log(`Fetching NFTs for wallet ${address} on chain ${chainId} with filters: ${params.excludeFilters.join(', ')}`);
            
            // Ensure the ALCHEMY_ENDPOINT uses proper chain identification
            // Make a proper request to Alchemy's NFT API with the correct network
            const response = await axios.get(ALCHEMY_ENDPOINT, { params });
            
            if (response.data && response.data.ownedNfts && response.data.ownedNfts.length > 0) {
              console.log(`Found ${response.data.ownedNfts.length} NFTs for wallet ${address} on chain ${chainId}`);
              
              // Process each NFT, adding uniqueId and chain information
              response.data.ownedNfts.forEach(nft => {
                if (!nft || !nft.contract || !nft.tokenId) return;
                
                // Create a proper uniqueId that includes the chain
                const uniqueId = this.createConsistentUniqueId({
                  ...nft,
                  network: chainId,
                  contract: {
                    ...nft.contract,
                    address: nft.contract?.address
                  },
                  tokenId: nft.tokenId
                });
                
                // Only add if not already in our map
                if (!uniqueNftsMap.has(uniqueId)) {
                  uniqueNftsMap.set(uniqueId, {
                    ...nft,
                    uniqueId,
                    ownerWallet: address,
                    network: chainId // Ensure network is set correctly
                  });
                }
              });
            } else {
              console.log(`No NFTs found for wallet ${address} on chain ${chainId}`);
            }
          } catch (error) {
            console.error(`Error fetching NFTs for address ${address} on chain ${chainId}:`, error.message);
          }
        }
      }
      
      // Create the final array from our map of unique NFTs
      const allNfts = Array.from(uniqueNftsMap.values());
      
      // Count NFTs per wallet for logging
      const walletToNftCount = {};
      allNfts.forEach(nft => {
        const wallet = nft.ownerWallet;
        walletToNftCount[wallet] = (walletToNftCount[wallet] || 0) + 1;
      });
      
      // Log per-wallet counts
      for (const [wallet, count] of Object.entries(walletToNftCount)) {
        console.log(`Wallet ${wallet} has ${count} unique NFTs across all chains`);
      }
      
      console.log(`Found ${allNfts.length} unique NFTs across all wallets after deduplication`);
      
      // Enrich NFT data with image URLs if they're missing
      const enrichWithImageUrls = (nfts) => {
        return nfts.map(nft => {
          // Skip invalid NFTs to prevent errors
          if (!nft) return nft;
          
          // If we already have image data, return as is
          if (nft.image || nft.image_url || 
             (nft.media && nft.media.length > 0) || 
             nft.animation_url || 
             (nft.metadata && (nft.metadata.image || nft.metadata.image_url))) {
            return nft;
          }
          
          // Try to add image URL based on contract address and token ID
          if (nft.contract && nft.contract.address && nft.tokenId) {
            const imageUrl = `https://nft-cdn.alchemy.com/eth-mainnet/${nft.contract.address}/${nft.tokenId}`;
            nft.image_url = imageUrl;
            
            // Add media array if it doesn't exist
            if (!nft.media) {
              nft.media = [{
                raw: imageUrl,
                gateway: imageUrl
              }];
            }
          }
          
          return nft;
        });
      };
      
      // Add this call before returning the NFTs
      if (allNfts.length > 0) {
        const enrichedNfts = enrichWithImageUrls(allNfts);
        return {
          nfts: enrichedNfts,
          totalCount: enrichedNfts.length,
          addressesQueried: validAddresses.length
        };
      }
      
      return {
        nfts: allNfts,
        totalCount: allNfts.length,
        addressesQueried: validAddresses.length
      };
    } catch (error) {
      console.error('Error in fetchNftsForMultipleAddresses:', error);
      
      // Even on error, try to return any partial results we might have gathered
      return { 
        nfts: [], 
        totalCount: 0, 
        error: error.message,
        errorDetails: {
          name: error.name,
          stack: error.stack?.substring(0, 200)
        }
      };
    }
  },
  
  /**
   * Helper function to determine if a collection exists on a specific chain
   * This is a simplified version - in production, you'd want to maintain a database
   * of known collections per chain or query an API
   */
  isCollectionOnChain(contractAddress, chainId) {
    if (!contractAddress || !chainId) return false;
    
    // Convert to lowercase for comparisons
    contractAddress = contractAddress.toLowerCase();
    
    // Known collections per chain
    const chainCollections = {
      'base': [
        '0x7d5861cfe1c74aaa0999b7e2651bf2ebd2a62d89', // Base Pups
        '0xbce3781ae7ca1a5e050bd9c4c77369867ebc307e'  // Base Bored Apes
      ],
      'opt': [
        '0x7a11f4cc9343b3a966dd5e094ee21e556a012ea4', // Optimism Quests
        '0x3b8aa8ef34afddeeb2d8f4b608cb7703af0e7db9'  // Optisaurs
      ],
      'arb': [
        '0xd2a077ec359d94e0a0b7e84435eacb40a67a817c', // Smol Brains
        '0x8ffb9b504d497e4000967391e70d542b8cc6748a'  // Arbitrum Planet
      ],
      'polygon': [
        '0x2953399124f0cbb46d2cbacd8a89cf0599974963', // OpenSea Polygon
        '0x5ce9fa5cd001f133a5422b1c283196e4574e1c73'  // Lens Protocol
      ]
    };
    
    // Check if the contract address is in the list for this chain
    return chainCollections[chainId]?.includes(contractAddress) || false;
  },
  
  /**
   * Get metadata for a specific NFT
   * Updated for Alchemy NFT API v3
   */
  async getNftMetadata(contractAddress, tokenId, options = {}) {
    const { network = 'ethereum' } = options;
    
    try {
      const params = {
        endpoint: 'getNFTMetadata',
        contractAddress,
        tokenId,
        refreshCache: options.refreshCache || false,
        tokenType: options.tokenType || null,
        chain: network
      };
      
      const response = await axios.get(ALCHEMY_ENDPOINT, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFT metadata from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get the best quality image URL for an NFT
   */
  async getNftImageUrl(contractAddress, tokenId, options = {}) {
    try {
      const metadata = await this.getNftMetadata(contractAddress, tokenId, options);
      
      // Try to get the best quality image available from v3 API response format
      if (metadata.media && metadata.media.length > 0) {
        // Return the highest resolution image
        const gatewayUrl = metadata.media[0].gateway;
        if (gatewayUrl) return gatewayUrl;
        
        const rawUrl = metadata.media[0].raw;
        if (rawUrl) return rawUrl;
      }
      
      // Fallback to metadata image
      if (metadata.metadata && metadata.metadata.image) {
        return metadata.metadata.image;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting NFT image URL:', error.message);
      return null;
    }
  },
  
  /**
   * Get a collection's NFTs
   * Updated for Alchemy NFT API v3
   */
  async getNftsForCollection(contractAddress, options = {}) {
    const { network = 'ethereum', pageKey, pageSize = 100 } = options;
    
    try {
      const params = {
        endpoint: 'getNFTsForCollection',
        contractAddress,
        withMetadata: true,
        pageSize,
        startToken: pageKey || null,
        tokenUriTimeoutInMs: options.tokenUriTimeoutInMs || 10000,
        chain: network
      };
      
      const response = await axios.get(ALCHEMY_ENDPOINT, { params });
      
      return {
        nfts: response.data?.nfts || [],
        pageKey: response.data?.nextToken || null,
        totalCount: response.data?.nfts?.length || 0,
        hasMore: !!response.data?.nextToken
      };
    } catch (error) {
      console.error('Error fetching NFTs for collection from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get wallet addresses that own NFTs from a specified contract
   * Updated to match the Alchemy NFT API v3 documentation
   * 
   * @param {string} contractAddress - The NFT contract address
   * @param {string} [network='eth'] - Blockchain network (eth, polygon, etc.)
   * @returns {Promise<string[]>} Array of wallet addresses
   */
  async getOwnersForContract(contractAddress, network = 'eth') {
    try {
      if (!contractAddress) {
        console.error('Contract address is missing or empty');
        throw new Error('Contract address is required');
      }

      console.log(`Fetching owners for contract ${contractAddress} on ${network}`);
      console.log('DEBUG - getOwnersForContract call details:', {
        contractAddress,
        contractAddressType: typeof contractAddress,
        contractAddressLength: contractAddress?.length,
        network,
        alchemyEndpoint: ALCHEMY_ENDPOINT,
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString()
      });

      // Initialize endpoints if needed
      await initializeEndpoints();
      
      console.log(`After initialization, using ALCHEMY_ENDPOINT: ${ALCHEMY_ENDPOINT}`);

      let response;
      
      // First try with our proxy API
      try {
        // Build the API request params for our proxy
        const params = {
          endpoint: 'getOwnersForContract',
          contractAddress,
          network
        };
        
        console.log('Making proxy Alchemy API request with params:', params);

        // Make the API request with a longer timeout
        response = await axios.get(ALCHEMY_ENDPOINT, {
          params,
          timeout: 20000 // 20 seconds - increased from 15 seconds
        });
        
        console.log('Proxy API responded with status:', response.status);
      } catch (proxyError) {
        console.error(`❌ Proxy API failed for getOwnersForContract for ${contractAddress}:`, proxyError.message);
        
        // Try direct Alchemy API as a fallback
        try {
          console.log('Attempting direct Alchemy API call for getOwnersForContract');
          const ALCHEMY_API_KEY = process.env.REACT_APP_ALCHEMY_API_KEY || '';
          
          if (!ALCHEMY_API_KEY) {
            console.error('Missing Alchemy API key for direct API call');
            throw new Error('Alchemy API key not available');
          }
          
          // Format network for direct API
          const networkPrefix = network === 'eth' ? 'eth-mainnet' : 
                               network === 'polygon' ? 'polygon-mainnet' : 
                               network === 'opt' ? 'opt-mainnet' : 
                               network === 'arb' ? 'arb-mainnet' : 
                               network === 'base' ? 'base-mainnet' : 'eth-mainnet';
          
          // Build the direct API URL as per the docs
          const directUrl = `https://${networkPrefix}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getOwnersForContract`;
          
          console.log(`Direct API call to Alchemy URL: ${directUrl}`);
          
          response = await axios.get(directUrl, {
            params: {
              contractAddress,
              withTokenBalances: false // Don't need token balances, just owners
            },
            timeout: 20000
          });
          
          console.log('Direct Alchemy API responded with status:', response.status);
          // Log full response structure for debugging
          console.log('Response structure from direct API:', {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            ownersCount: response.data?.owners?.length || 0
          });
        } catch (directApiError) {
          console.error('❌ Direct Alchemy API call failed:', directApiError.message);
          if (directApiError.response) {
            console.error('Error response data:', directApiError.response.data);
            console.error('Error response status:', directApiError.response.status);
          }
          throw directApiError;
        }
      }

      // Log full response for debugging
      console.log('Alchemy API response structure:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasOwners: Array.isArray(response.data?.owners),
        ownersCount: response.data?.owners?.length || 0
      });

      // Extract owners from the response according to the API documentation
      const owners = response.data?.owners || [];

      console.log(`Found ${owners.length} owners for contract ${contractAddress}`);
      
      if (owners.length > 0) {
        console.log('Sample of owner addresses:', owners.slice(0, 5));
      } else {
        console.warn(`No owners found for contract ${contractAddress}. This could be an issue with the contract address or API.`);
      }
      
      // Convert all addresses to lowercase for consistency
      return owners.map(owner => owner.toLowerCase());
    } catch (error) {
      // Enhanced error logging with network-specific information
      console.error(`Error fetching owners for contract ${contractAddress} on ${network}:`, error.message);
      console.error('Error details:', {
        network,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data || error.message,
        stack: error.stack?.substring(0, 200)
      });
      
      // Network-specific error handling
      if (network === 'base') {
        console.warn(`Base network may be experiencing issues. Returning empty result for ${contractAddress}.`);
        // For Base network specifically, log more diagnostics but don't break the app
        if (error.code === 'ECONNABORTED') {
          console.warn('Request to Base network timed out. This is a common issue that will be handled gracefully.');
        }
      }
      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused. API server might be down or unreachable.');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.error('Request timed out. API server might be overloaded or unreachable.');
      } else if (error.response?.status === 404) {
        console.error('API endpoint not found. Check the API URL configuration.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Authentication error. Check API key.');
      } else if (error.response?.status === 500) {
        console.error('Server error. The API server encountered an error processing the request.');
      }
      
      // Always return an empty array instead of failing completely
      return [];
    }
  },
};

/**
 * Get asset transfers for addresses to track NFT ownership history
 * Uses Alchemy's getAssetTransfers endpoint to get NFT transfer history
 */
async function getAssetTransfers(addresses, options = {}) {
  if (!addresses || addresses.length === 0) {
    console.warn('No addresses provided to getAssetTransfers');
    return { transfers: [], transferMap: {} };
  }
  
  try {
    // Get the chains to fetch from (defaulting to ETH only for transfers to reduce API calls)
    const chain = options.chain || 'eth';
    
    // Clean and validate addresses
    const validAddresses = addresses
      .filter(addr => addr && typeof addr === 'string')
      .map(addr => addr.toLowerCase().trim());
    
    if (validAddresses.length === 0) {
      console.warn('No valid addresses after formatting');
      return { transfers: [], transferMap: {} };
    }
    
    console.log(`Fetching NFT transfers for ${validAddresses.length} addresses on ${chain}`);
    
    // Build the params for the Alchemy API call
    const params = {
      endpoint: 'getAssetTransfers',
      chain,
      addresses: validAddresses.join(','),
      order: options.order || 'desc',
      debug: options.debug === true ? 'true' : undefined,
      category: ['ERC721', 'ERC1155'] // Explicitly specify NFT categories
    };
    
    console.log(`Fetching transfers with params:`, {
      endpoint: params.endpoint,
      chain: params.chain,
      addressCount: validAddresses.length,
      order: params.order,
      debug: params.debug
    });
    
    // Call our backend API which will handle the RPC call
    const response = await axios.get(ALCHEMY_ENDPOINT, { params });
    
    // Check if we got a valid response
    if (!response.data) {
      console.warn('Empty response from getAssetTransfers API');
      return { transfers: [], transferMap: {} };
    }
    
    // Check if we have the transferMap
    if (!response.data.transferMap) {
      console.warn('Response missing transferMap:', response.data);
      return { 
        transfers: response.data.transfers || [], 
        transferMap: {},
        diagnostic: response.data.diagnostic || { error: 'Missing transferMap in response' }
      };
    }
    
    console.log(`Got transfer data with ${response.data.count || 0} entries, ${Object.keys(response.data.transferMap).length} mapped items`);
    
    return {
      transfers: response.data.transfers || [],
      transferMap: response.data.transferMap || {},
      processedCount: response.data.processedCount,
      diagnostic: response.data.diagnostic
    };
  } catch (error) {
    console.error('Error fetching asset transfers:', error);
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    console.error('Error details:', errorDetails);
    
    return { 
      transfers: [], 
      transferMap: {},
      error: error.message,
      diagnostic: { error: error.message, stack: error.stack, details: errorDetails }
    };
  }
}

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export const fetchAssetTransfers = (addresses, options) =>
  getAssetTransfers(addresses, options);

export const createConsistentUniqueId = (nft) =>
  alchemyService.createConsistentUniqueId(nft);

export default alchemyService; 