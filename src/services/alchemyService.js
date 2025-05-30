import axios from 'axios';
import { getApiBaseUrl, getAlchemyApiKey } from '../utils/runtimeConfig';

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
class AlchemyService {
  constructor() {
    this.apiKey = null;
    this.requestCache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes cache TTL (increased from 5 minutes)
  }

  // Store the API key
  apiKey = null;

  /**
   * Get cached response based on cache key
   * @param {string} cacheKey - The cache key
   * @returns {Promise<Object|null>} - Cached data or null if not found/expired
   */
  async getCachedResponse(cacheKey) {
    const cachedResponse = this.requestCache.get(cacheKey);
    if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
      return cachedResponse.data;
    }
    return null;
  }

  /**
   * Set cached response
   * @param {string} cacheKey - The cache key 
   * @param {Object} data - The data to cache
   * @param {number} customTTL - Optional custom TTL in milliseconds
   */
  async setCachedResponse(cacheKey, data, customTTL = null) {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: customTTL || this.cacheTTL
    });
    
    // Cleanup the cache if it's getting too large
    this.cleanupCacheIfNeeded();
    
    return data;
  }
  
  /**
   * Cleans up the cache if it exceeds a certain size
   */
  cleanupCacheIfNeeded() {
    // Only cleanup if we have more than 100 items in cache
    if (this.requestCache.size > 100) {
      console.log(`Cache cleanup triggered, current size: ${this.requestCache.size}`);
      const now = Date.now();
      const keysToDelete = [];
      
      // Find expired entries
      for (const [key, entry] of this.requestCache.entries()) {
        const ttl = entry.ttl || this.cacheTTL;
        if (now - entry.timestamp > ttl) {
          keysToDelete.push(key);
        }
      }
      
      // Delete expired entries
      keysToDelete.forEach(key => this.requestCache.delete(key));
      console.log(`Cache cleanup completed, removed ${keysToDelete.length} items, new size: ${this.requestCache.size}`);
    }
  }
  
  /**
   * Creates an optimized cache key for NFT requests
   * @param {string} owner - The wallet address
   * @param {Object} options - Query options 
   * @param {string} chain - The blockchain chain
   * @returns {string} - The cache key
   */
  createNftCacheKey(owner, options = {}, chain = 'eth') {
    // Extract only the essential options that affect the result
    const essentialOptions = {
      withMetadata: options.withMetadata !== false,
      pageSize: options.pageSize || '100',
      excludeSpam: options.excludeSpam === true,
      excludeAirdrops: options.excludeAirdrops === true,
      pageKey: options.pageKey || null
    };
    
    // Create a short hash of the options
    const optionsStr = JSON.stringify(essentialOptions);
    const optionsHash = this.simpleHash(optionsStr);
    
    // Return a compact cache key
    return `nfts_${owner.slice(0, 8)}_${chain}_${optionsHash}`;
  }
  
  /**
   * Creates a simple hash string from an input string
   * @param {string} str - Input string to hash
   * @returns {string} - Hash string
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Initialize the API key
  async initApiKey() {
    if (!this.apiKey) {
      this.apiKey = await getAlchemyApiKey();
      if (!this.apiKey) {
        // Fallback to environment variable directly as a last resort
        this.apiKey = process.env.REACT_APP_ALCHEMY_API_KEY;
        console.warn('Using fallback Alchemy API key from environment variables');
      }
      console.log(`Alchemy API key initialized: ${this.apiKey ? 'Successfully' : 'Failed'}`);
    }
    return this.apiKey;
  }

  /**
   * Get the Alchemy URL for the specified chain
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @param {string} endpoint - Optional endpoint name to append to the URL
   * @param {string} queryParams - Optional query parameters
   * @returns {Promise<string>} - The Alchemy URL
   */
  async getAlchemyUrl(chainId = 'eth', endpoint = '', queryParams = '') {
    await this.initApiKey();
    
    // Always use the server proxy - never expose API key client-side
    let baseUrl;
    if (typeof window !== 'undefined') {
      // Client-side (browser) - always use proxy
      baseUrl = process.env.NODE_ENV === 'production'
        ? '/api/alchemy'
        : 'http://localhost:3000/api/alchemy';
        
      // Always include the network/chain parameter
      let networkParam = chainId ? `?network=${chainId}` : '';
      if (networkParam && queryParams) {
        // If we already have query params, use & instead of ?
        networkParam = networkParam.replace('?', '&');
      }
      
      // Add the network to the query string
      if (queryParams && !queryParams.includes('network=')) {
        queryParams += networkParam;
      } else if (!queryParams) {
        queryParams = networkParam.replace('&', '?');
      }
    } else {
      // Server-side - construct direct URL (API key not exposed to client)
      const network = this.getNetworkFromChainId(chainId);
      baseUrl = `https://${network}.g.alchemy.com/nft/v3/${this.apiKey}`;
    }
    
    // Return just the base URL if no endpoint is provided
    if (!endpoint) {
      return baseUrl;
    }
    
    // Construct the URL with the endpoint and query params if provided
    let url = `${baseUrl}/${endpoint}`;
    if (queryParams) {
      // If query params already has a ? at the beginning, remove it
      if (queryParams.startsWith('?')) {
        queryParams = queryParams.substring(1);
      }
      url += `?${queryParams}`;
    }
    
    return url;
  }

  /**
   * Determines the network name based on chainId
   * @param {string} chainId - The chain ID ('eth', 'polygon', etc.)
   * @returns {string} - The network name for Alchemy URL
   */
  getNetworkFromChainId(chainId) {
    switch (chainId.toLowerCase()) {
      case 'eth':
        return 'eth-mainnet';
      case 'polygon':
        return 'polygon-mainnet';
      case 'opt':
        return 'opt-mainnet';
      case 'arb':
        return 'arb-mainnet';
      case 'base':
        return 'base-mainnet';
      default:
        return 'eth-mainnet';
    }
  }

  /**
   * Helper to convert network name to chain ID
   */
  getChainId(network) {
    const chain = SUPPORTED_CHAINS.find(c => 
      c.network.toLowerCase() === network.toLowerCase() || 
      c.id.toLowerCase() === network.toLowerCase()
    );
    return chain ? chain.id : 'eth';
  }
  
  /**
   * Validates if a string is a valid Ethereum address
   * @param {string} address - The address to validate
   * @returns {boolean} - Whether the address is valid
   */
  isValidAddress(address) {
    return typeof address === 'string' && 
           address.startsWith('0x') && 
           address.length === 42 && 
           /^0x[0-9a-fA-F]{40}$/.test(address);
  }
  
  /**
   * Fetches all NFTs for a specific owner address
   * @param {string} owner - The owner address
   * @param {Object} options - Query options
   * @param {string} chain - The chain to query
   * @returns {Promise<Object>} - NFTs owned by the address
   */
  async getNftsForOwner(owner, options = {}, chain = 'eth') {
    try {
      // Build a cache key
      const cacheKey = this.createNftCacheKey(owner, options, chain);
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached NFTs for ${owner.slice(0, 8)}... on ${chain}`);
        return cachedResponse;
      }
      
      console.log(`Cache miss for NFTs fetch: ${owner.slice(0, 8)}... on ${chain}`);
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        endpoint: 'getNFTsForOwner',
        network: chain, // IMPORTANT: Use 'network' param for consistent handling
        owner,
        withMetadata: options.withMetadata !== false ? 'true' : 'false',
        pageSize: options.pageSize || '100',
        withFloorPrice: options.withFloorPrice !== false ? 'true' : 'false'
      });

      // Add orderBy parameter to sort by transfer time for supported networks
      // This is only supported on Ethereum Mainnet and Polygon Mainnet
      if ((chain === 'eth' || chain === 'ethereum' || chain === 'polygon') && options.orderBy !== false) {
        queryParams.append('orderBy', 'transferTime');
        console.log(`Using orderBy=transferTime for ${chain} to show newest NFTs first`);
      }

      // REMOVED ALL SPAM FILTER PARAMETERS
      // No longer setting excludeSpam, excludeAirdrops, or excludeFilters
      // This should resolve issues with fetching NFTs

      // Add pageKey if provided
      if (options.pageKey) {
        queryParams.append('pageKey', options.pageKey);
      }

      const url = `${ALCHEMY_ENDPOINT}?${queryParams.toString()}`;
      
      console.log(`Fetching NFTs for ${owner} on ${chain} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
        
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch NFTs on ${chain}:`, errorText);
        throw new Error(`Failed to fetch NFTs on ${chain}: ${errorText}`);
      }

      const data = await response.json();
      
      // Log filtering metadata if available
      if (data.filteringApplied) {
        console.log(`Server applied filtering: spamConfidenceLevel=${data.filteringApplied.spamConfidenceLevel}, excludeFilters=[${data.filteringApplied.excludeFilters.join(',')}] on ${data.filteringApplied.network}`);
      }
      
      // Verify chain info is included in the response; if not, add it
      if (data.ownedNfts) {
        data.ownedNfts = data.ownedNfts.map(nft => {
          if (!nft.chain && !nft.network) {
            return {
              ...nft,
              chain,
              network: chain,
              chainId: chain
            };
          }
          return nft;
        });
      }
      
      // Handle pagination if fetchAll is true
      if (options.fetchAll && data.pageKey) {
        console.log(`Found more NFTs, fetching next page with key: ${data.pageKey.substring(0, 20)}...`);
        
        const nextPageOptions = {
          ...options,
          pageKey: data.pageKey
        };
        
        const nextPageResults = await this.getNftsForOwner(owner, nextPageOptions, chain);
        
        // Combine results
        if (nextPageResults && nextPageResults.ownedNfts) {
          console.log(`Adding ${nextPageResults.ownedNfts.length} more NFTs from next page`);
          
          data.ownedNfts = [
            ...data.ownedNfts,
            ...(nextPageResults.ownedNfts || [])
          ];
          
          // If we got more pages, make sure we don't include the pageKey in final result
          delete data.pageKey;
        }
      }

      // Determine appropriate TTL based on size
      // - Large collections (>10 NFTs) get longer TTL since they're expensive to fetch
      // - Small collections get shorter TTL since they might change more frequently
      let customTTL = null;
      if (data.ownedNfts?.length > 10) {
        // 2 hours for larger collections
        customTTL = 2 * 60 * 60 * 1000;
      }

      // Cache the response
      await this.setCachedResponse(cacheKey, data, customTTL);
      
      console.log(`Completed fetch for ${owner} on ${chain}, got ${data.ownedNfts?.length || 0} total NFTs`);
      
      // Try to add logging about filtered spam if that metadata exists
      if (data && data.filteringApplied) {
        console.log(`Spam filtering was active: spamConfidenceLevel=${data.filteringApplied.spamConfidenceLevel}, filtered out potentially harmful NFTs`);
      }
      
      return data;
    } catch (error) {
      console.error(`Error in getNftsForOwner for ${chain}:`, error);
      return { error: error.message, ownedNfts: [] };
    }
  }
  
  /**
   * Fetches NFTs across all chains for an owner
   * @param {string} owner - The owner address
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - NFTs organized by chain
   */
  async fetchNftsAcrossChains(owner, options = {}) {
    try {
      if (!owner) {
        console.log('fetchNftsAcrossChains: No wallet address provided');
        return { error: 'No wallet address provided', ownedNfts: [] };
      }
      
      this.initApiKey();
      
      if (!this.apiKey) {
        console.error('No API key available for Alchemy requests');
        return { error: 'API key configuration error', ownedNfts: [] };
      }

      // Define the supported chains from the SUPPORTED_CHAINS constant
      this.supportedChains = ['eth', 'polygon', 'opt', 'arb', 'base'];
      
      // Determine chains to fetch
      const chainFilter = options.chains || this.supportedChains;
      const chainsToFetch = Array.isArray(chainFilter) 
        ? this.supportedChains.filter(chain => chainFilter.includes(chain))
        : this.supportedChains;
      
      console.log(`Fetching NFTs across ${chainsToFetch.length} chains for ${owner}: ${chainsToFetch.join(', ')}`);
      
      // Set up fetch options - include metadata and pagination settings
      const fetchOptions = {
        ...options,
        withMetadata: options.withMetadata !== false,
        pageSize: options.pageSize || '100',
        fetchAll: options.fetchAll !== false,
        withFloorPrice: options.withFloorPrice !== false
      };
      
      // REMOVED ALL SPAM FILTER PARAMETERS
      // No longer setting excludeSpam, excludeAirdrops, or excludeFilters
      // This should resolve issues with fetching NFTs

      // Create an array of promises, one for each chain
      const chainPromises = chainsToFetch.map(chain => 
        this.getNftsForOwner(owner, fetchOptions, chain)
          .catch(error => {
            console.error(`Error fetching NFTs on ${chain}:`, error);
            return { 
              error: `Error on ${chain}: ${error.message}`,
              ownedNfts: [] 
            };
          })
      );
      
      // Wait for all chain queries to complete
      const results = await Promise.all(chainPromises);
      
      // Combine the results
      const combinedData = {
        owner,
        chains: {},
        totalCount: 0,
        ownedNfts: []
      };
      
      // Process each chain's results
      for (let i = 0; i < chainsToFetch.length; i++) {
        const chain = chainsToFetch[i];
        const chainResult = results[i] || { ownedNfts: [] };
        
        // Add chain-specific data to the result
        combinedData.chains[chain] = {
          count: chainResult.ownedNfts?.length || 0,
          pageKey: chainResult.pageKey || null,
          error: chainResult.error || null
        };
        
        // Add NFTs to the combined array
        if (chainResult.ownedNfts && chainResult.ownedNfts.length > 0) {
          // Apply our advanced spam filtering if requested
          let nftsToAdd = chainResult.ownedNfts;
          
          // Use advanced spam filtering if not disabled
          if (options.useAdvancedSpamFilter !== false) {
            try {
              const utils = await import('../utils/nftUtils');
              nftsToAdd = await utils.advancedSpamFilter(
                nftsToAdd, 
                this, 
                chain,
                options.aggressiveSpamFiltering !== false
              );
            } catch (filterError) {
              console.error(`Error applying advanced spam filtering for ${chain}:`, filterError);
            }
          }
          
          // Add the filtered NFTs to the combined array
          combinedData.ownedNfts.push(...nftsToAdd);
          combinedData.totalCount += nftsToAdd.length;
        }
      }
      
      // Sort by chain priority if required
      if (options.sortByChainPriority) {
        // ... existing sorting code (keep as is)
      }
      
      console.log(`Combined NFTs from ${chainsToFetch.length} chains. Total: ${combinedData.totalCount}`);
      return combinedData;
    } catch (error) {
      console.error('Error in fetchNftsAcrossChains:', error);
      return { error: error.message, ownedNfts: [] };
    }
  }
  
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
    
    // Extract token ID - normalize to string and remove leading zeros
    const tokenId = String(
      (nft.tokenId) || 
      (nft.token_id) || 
      ''
    ).trim();
    
    // Extract network - normalize to lowercase
    const network = (
      (nft.network) || 
      (nft.chain) ||
      (nft.chainId) ||
      'eth'
    ).toLowerCase();
    
    // Create a consistent unique ID - independent of wallet
    // This ensures the same NFT owned by different wallets is considered the same
    return `${network}:${contractAddress}:${tokenId}`;
  }
  
  /**
   * Fetches NFTs for multiple wallet addresses
   * @param {string[]} addresses - Array of wallet addresses
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Unique NFTs from all wallets
   */
  async fetchNftsForMultipleAddresses(addresses, options = {}) {
    try {
    // Filter valid addresses
      const validAddresses = (addresses || [])
        .filter(address => address && typeof address === 'string' && address.trim() !== '')
        .map(address => address.toLowerCase());
      
    if (validAddresses.length === 0) {
        console.log('No valid addresses provided for fetchNftsForMultipleAddresses');
        return { uniqueNfts: [], errors: ['No valid addresses provided'] };
      }
      
      console.log(`Fetching NFTs for ${validAddresses.length} wallet addresses`);
      
      // Define the supported chains if not already defined
      if (!this.supportedChains) {
        this.supportedChains = ['eth', 'polygon', 'opt', 'arb', 'base'];
      }
      
      // Set up fetch options with defaults
          const fetchOptions = {
        ...options,
        withMetadata: options.withMetadata !== false,
        pageSize: options.pageSize || '100'
      };
      
      // Properly handle filter options
      if (options.excludeSpam === true) {
        fetchOptions.excludeSpam = true;
      }
      
      if (options.excludeAirdrops === true) {
        fetchOptions.excludeAirdrops = true;
      }
      
      // Handle excludeFilters if provided
      if (options.excludeFilters && Array.isArray(options.excludeFilters)) {
        fetchOptions.excludeFilters = [...options.excludeFilters];
      }
      
      // Determine chains to fetch from
      const chainsToFetch = options.chains || this.supportedChains;
      console.log(`Fetching across chains: ${chainsToFetch.join(', ')}`);
      
      // Create parallel fetch tasks for all addresses and chains
      const fetchTasks = [];
      
      validAddresses.forEach(address => {
        chainsToFetch.forEach(chain => {
          fetchTasks.push({
            address,
            chain,
            task: () => this.getNftsForOwner(address, fetchOptions, chain)
              .catch(error => {
                console.error(`Error fetching NFTs for ${address} on ${chain}:`, error);
                return { 
                  error: `Error on ${chain}: ${error.message}`,
                  ownedNfts: [] 
                };
              })
          });
        });
      });
      
      console.log(`Created ${fetchTasks.length} parallel fetch tasks`);
      
      // Execute all fetch tasks in parallel
      const taskResults = await Promise.allSettled(
        fetchTasks.map(task => task.task())
      );
      
      // Track unique NFTs and errors
      const uniqueNftsMap = new Map();
      const walletNftCount = {};
      const errors = [];
      
      // Process results and deduplicate NFTs
      taskResults.forEach((result, index) => {
        const { address, chain } = fetchTasks[index];
        
        // Initialize count for this wallet if not exists
        if (!walletNftCount[address]) {
          walletNftCount[address] = 0;
        }
        
        if (result.status === 'fulfilled') {
          const data = result.value;
          const nfts = data.ownedNfts || [];
          
          if (data.error) {
            errors.push(data.error);
          }
          
          // Count NFTs for this wallet and add unique ones to the map
          if (nfts.length > 0) {
            walletNftCount[address] += nfts.length;
            
            nfts.forEach(nft => {
              // Use our consistent unique ID function for better deduplication
              const uniqueId = this.createConsistentUniqueId({
                ...nft,
                chain
              });
              
              if (!uniqueNftsMap.has(uniqueId)) {
                // Add chain and ownership information to the NFT
                uniqueNftsMap.set(uniqueId, {
                  ...nft,
                  chain,
                  chainId: chain,
                  network: chain,
                  ownerAddress: address,
                  uniqueId // Add the uniqueId to the NFT object for future reference
                });
              }
            });
            }
          } else {
          errors.push(`Error fetching for ${address} on ${chain}: ${result.reason}`);
        }
      });
      
      // Log counts per wallet
      Object.entries(walletNftCount).forEach(([wallet, count]) => {
        if (count > 0) {
          console.log(`Found ${count} NFTs for wallet ${wallet}`);
        }
      });
      
      // Convert the Map to an array for the final result
    const uniqueNfts = Array.from(uniqueNftsMap.values());
      console.log(`Found ${uniqueNfts.length} unique NFTs across all wallets`);
      
      return {
        uniqueNfts,
        totalFound: uniqueNfts.length,
        walletNftCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error in fetchNftsForMultipleAddresses:', error);
    return {
        uniqueNfts: [], 
        error: error.message 
      };
    }
  }
  
  /**
   * Helper function to determine if a collection exists on a specific chain
   * This helps detect the correct chain when it's not explicitly provided
   */
  isCollectionOnChain(contractAddress, chainId) {
    if (!contractAddress || !chainId) return false;
    
    // Convert to lowercase for comparisons
    contractAddress = contractAddress.toLowerCase();
    
    // Known collections per chain - significantly expanded list of popular contracts
    const chainCollections = {
      'base': [
        '0x7d5861cfe1c74aaa0999b7e2651bf2ebd2a62d89', // Base Pups
        '0xbce3781ae7ca1a5e050bd9c4c77369867ebc307e',  // Base Bored Apes
        '0xc11f09103c575a4e898eb9a1c7bb4486b06546ce', // Contract from user's example
        '0x1d137bf688c242c0dd6e33ff531d2baeedc38f11', // BaseDrip
        '0xaa099c8a8c3a294af189ad9ce17ec303119e81af', // Martian Premier League
        '0xd9e43563cf6b25a44a572f99e073d4e7a5c3aaee', // Base Core Collective
        '0xbd2019982628d26cc49455d5f8fd986a02433b9f', // Base Apes
        '0x3bf2022d79728c3b6df817d801c57fadc5f5b3c8'  // Base Dogs
      ],
      'opt': [
        '0x7a11f4cc9343b3a966dd5e094ee21e556a012ea4', // Optimism Quests
        '0x3b8aa8ef34afddeeb2d8f4b608cb7703af0e7db9',  // Optisaurs
        '0x0c4dc135c1958e4997080c68169dc28de69e3bf2', // OptiPunks
        '0xb8ff619fb85b35bb033eef65c919c0bbfcc36c75', // Optimism Dragons
        '0x6c8884fd83754f5d7f09a3a1c2534dbc01d3760c'  // Optimism Rabbits
      ],
      'arb': [
        '0xd2a077ec359d94e0a0b7e84435eacb40a67a817c', // Smol Brains
        '0x8ffb9b504d497e4000967391e70d542b8cc6748a',  // Arbitrum Planet
        '0x537b9af55ecd42fd99f5adbcdb735c77eb10d379', // Smol Bodies
        '0x4de95c1e202102e22e473716f3e61f92d5409c39', // WAGNI
        '0xe11d4fdb1c141cd93f8ddc0575441eccc3cd5e19'  // Arbitrum Gems
      ],
      'polygon': [
        '0x2953399124f0cbb46d2cbacd8a89cf0599974963', // OpenSea Polygon
        '0x5ce9fa5cd001f133a5422b1c283196e4574e1c73',  // Lens Protocol
        '0x631998e91476da5b870d741192fc5cbc55f5a52e', // Aavegotchi
        '0xec0a873cddf8e428e456b4d5106b66c4a2dedcad', // Polygon Unicorns
        '0xf6ccf2c3a2dbb734a4ab7734c9e691ae0f1fbc5e'  // Polygon Punks
      ],
      'zora': [
        '0xd4307e0acd12cf46fd6cf93bc264f5d5d1598792', // Nouns Zora
        '0xa15eb8b7ed241bc1d19c9efef2e17fc0d2b573c8', // Zorbs
        '0x28a6ee202af7de7e1bf2853fdd544319b343298b', // Zorbs V2
        '0x38f4908de1951ef09f55995697709e8054a738f5', // Fewocious Zora
        '0x4352c5ab9e8eb63e81b8eae956bc3509a2a62481'  // Zora Explorers
      ]
    };
    
    // Check if the contract address is in the list for this chain
    return chainCollections[chainId]?.includes(contractAddress) || false;
  }
  
  /**
   * Get metadata for a specific NFT
   * @param {string} contractAddress - The contract address of the NFT
   * @param {string} tokenId - The token ID of the NFT
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @returns {Promise<Object>} - The NFT metadata
   */
  async getNftMetadata(contractAddress, tokenId, chainId = 'eth') {
    try {
      // Create a cache key
      const cacheKey = `metadata_${contractAddress.toLowerCase()}_${tokenId}_${chainId.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached metadata for ${contractAddress} token ${tokenId} on ${chainId}`);
        return cachedResponse.data;
      }
      
      const baseUrl = await this.getAlchemyUrl(chainId);
      const url = `${baseUrl}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`;
      
      console.log(`Fetching metadata for ${contractAddress} token ${tokenId} on ${chainId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch NFT metadata: ${error}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFT metadata for ${contractAddress} token ${tokenId} on ${chainId}:`, error);
      return null;
    }
  }
  
  /**
   * Get the best quality image URL for an NFT
   */
  async getNftImageUrl(contractAddress, tokenId, options = {}) {
    // Make sure API key is initialized
    await this.initApiKey();

    try {
      // Create a cache key for the image URL
      const chainId = options.chainId || 'eth';
      const cacheKey = `image_url_${contractAddress.toLowerCase()}_${tokenId}_${chainId.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached image URL for ${contractAddress} token ${tokenId} on ${chainId}`);
        return cachedResponse;
      }
      
      const metadata = await this.getNftMetadata(contractAddress, tokenId, chainId);
      
      let imageUrl = null;
      
      // Try to get the best quality image available from v3 API response format
      if (metadata && metadata.media && metadata.media.length > 0) {
        // Return the highest resolution image
        const gatewayUrl = metadata.media[0].gateway;
        if (gatewayUrl) imageUrl = gatewayUrl;
        
        if (!imageUrl) {
        const rawUrl = metadata.media[0].raw;
          if (rawUrl) imageUrl = rawUrl;
        }
      }
      
      // Fallback to metadata image
      if (!imageUrl && metadata && metadata.metadata && metadata.metadata.image) {
        imageUrl = metadata.metadata.image;
      }
      
      // Cache the result if we found an image URL
      if (imageUrl) {
        await this.setCachedResponse(cacheKey, imageUrl);
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error getting NFT image URL:', error.message);
      return null;
    }
  }
  
  /**
   * Gets NFTs for a specific collection
   * @param {string} contractAddress - The contract address
   * @param {Object} options - Additional options for the request
   * @param {string} chain - The blockchain network
   * @returns {Promise<Object>} - The NFTs data
   */
  async getNftsForCollection(contractAddress, options = {}, chain = 'eth') {
    try {
      // Create a cache key based on contract address, options and chain
      const cacheKey = `nfts_collection_${contractAddress.toLowerCase()}_${chain}_${JSON.stringify(options)}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for collection ${contractAddress} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build query parameters
      let queryParams = `contractAddress=${contractAddress}`;
      
      // Add options to query
      if (options.startToken) queryParams += `&startToken=${options.startToken}`;
      if (options.withMetadata !== undefined) queryParams += `&withMetadata=${options.withMetadata}`;
      if (options.limit) queryParams += `&limit=${options.limit}`;
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getNFTsForCollection', queryParams);
      console.log(`Fetching collection NFTs from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch collection NFTs: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFTs for collection ${contractAddress} on ${chain}:`, error);
      return { nfts: [] };
    }
  }
  
  /**
   * Gets all owners for a specific contract
   * @param {string} contractAddress - The contract address
   * @param {string} network - The blockchain network (eth, polygon, opt, arb, base, etc)
   * @returns {Promise<string[]>} - Array of owner addresses
   */
  async getOwnersForContract(contractAddress, network = 'eth') {
    // Make sure API key is initialized
    await this.initApiKey();

    try {
      if (!contractAddress) {
        console.error('Contract address is missing or empty');
        throw new Error('Contract address is required');
      }

      // Process contract address to extract network if in format 'network:address'
      let resolvedNetwork = network;
      let resolvedContractAddress = contractAddress;
      
      // Check if contract address includes network prefix like "base:0x123..."
      if (contractAddress.includes(':')) {
        const parts = contractAddress.split(':');
        if (parts.length >= 2) {
          const possibleNetwork = parts[0].toLowerCase();
          const possibleAddress = parts[1];
          
          // Verify if it's a valid network and address format
          if (possibleAddress && possibleAddress.startsWith('0x') && possibleAddress.length >= 42) {
            resolvedContractAddress = possibleAddress;
            // Only update network if it's a recognized network
            const validNetworks = ['eth', 'ethereum', 'polygon', 'opt', 'optimism', 'arb', 'arbitrum', 'base', 'zora'];
            if (validNetworks.includes(possibleNetwork)) {
              resolvedNetwork = possibleNetwork;
              console.log(`Extracted network ${resolvedNetwork} from contract address ${contractAddress}`);
            }
          }
        }
      }
      
      // If we're still on 'eth' network, check if this contract is actually on another chain
      // by looking it up in our known collections database
      if (resolvedNetwork === 'eth') {
        const normalizedAddress = resolvedContractAddress.toLowerCase();
        
        // Check each chain for this contract address
        const chains = ['base', 'polygon', 'opt', 'arb', 'zora'];
        for (const chain of chains) {
          if (this.isCollectionOnChain(normalizedAddress, chain)) {
            console.log(`Auto-detected network ${chain} for contract ${normalizedAddress} from known collections database`);
            resolvedNetwork = chain;
            break;
          }
        }
      }
      
      // Normalize network names to Alchemy's expected format values
      const networkMapping = {
        'ethereum': 'eth',
        'optimism': 'opt',
        'arbitrum': 'arb',
        'polygon': 'polygon',
        'base': 'base',
        'zora': 'zora'
      };
      
      // Apply mapping if the network is in our mapping
      const standardizedNetwork = networkMapping[resolvedNetwork.toLowerCase()] || resolvedNetwork;
      
      // Map network to the correct URL format per Alchemy docs
      const networkUrlMapping = {
        'eth': 'eth-mainnet',
        'polygon': 'polygon-mainnet',
        'opt': 'opt-mainnet',
        'arb': 'arb-mainnet',
        'base': 'base-mainnet',
        'zora': 'zora-mainnet'
      };
      
      const networkUrlBase = networkUrlMapping[standardizedNetwork] || 'eth-mainnet';
      
      console.log(`Fetching owners for contract ${resolvedContractAddress} on ${standardizedNetwork} (URL base: ${networkUrlBase})`);
      
      // Create a cache key based on contract address and network
      const cacheKey = `owners_${resolvedContractAddress.toLowerCase()}_${standardizedNetwork.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached owners for contract ${resolvedContractAddress} on ${standardizedNetwork} (${cachedResponse.length} owners)`);
        return cachedResponse;
      }

      console.log(`DEBUG - getOwnersForContract call details:`, {
        originalContractAddress: contractAddress,
        resolvedContractAddress,
        originalNetwork: network,
        resolvedNetwork: standardizedNetwork,
        networkUrlBase,
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
          network: standardizedNetwork,
          contractAddress: resolvedContractAddress.toLowerCase()  // Ensure address is lowercase
        };
        
        console.log('Making proxy Alchemy API request with params:', params);

        // Make the API request with a longer timeout
        response = await axios.get(ALCHEMY_ENDPOINT, {
          params,
          timeout: 20000 // 20 seconds
        });
        
        console.log('Proxy API responded with status:', response.status);
      } catch (proxyError) {
        console.error(`❌ Proxy API failed for getOwnersForContract for ${resolvedContractAddress} on ${standardizedNetwork}:`, proxyError.message);
        
        // Try direct Alchemy API as a fallback
        try {
          console.log('Attempting direct Alchemy API call for getOwnersForContract');
          
          if (!this.apiKey) {
            console.error('Missing Alchemy API key for direct API call');
            throw new Error('Alchemy API key not available');
          }
          
          // Construct the URL according to Alchemy docs
          const directUrl = `https://${networkUrlBase}.g.alchemy.com/nft/v3/${this.apiKey}/getOwnersForContract`;
          
          console.log(`Direct API call to Alchemy URL: ${directUrl} for network ${standardizedNetwork}`);
          
          // Make the direct API call
          response = await axios.get(directUrl, {
            params: {
              contractAddress: resolvedContractAddress.toLowerCase(),
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
          console.error(`❌ Direct Alchemy API call failed on ${standardizedNetwork}:`, directApiError.message);
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
        ownersCount: response.data?.owners?.length || 0,
        network: standardizedNetwork
      });

      // Extract owners from the response according to the API documentation
      const owners = response.data?.owners || [];

      console.log(`Found ${owners.length} owners for contract ${resolvedContractAddress} on ${standardizedNetwork}`);
      
      // Convert all addresses to lowercase for consistency and filter out invalid addresses
      const normalizedOwners = owners
        .map(owner => {
          // Handle different response formats
          if (typeof owner === 'string') {
            return owner.toLowerCase();
          } else if (owner.ownerAddress) {
            return owner.ownerAddress.toLowerCase();
          }
          return null;
        })
        .filter(address => address && address.startsWith('0x'));
      
      // Cache the results
      if (normalizedOwners.length > 0) {
        await this.setCachedResponse(cacheKey, normalizedOwners);
      }
      
      return normalizedOwners;
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
      
      // Always return an empty array instead of failing completely
      return [];
    }
  }
  
  /**
   * Gets metadata for a specific contract
   * @param {string} contractAddress - The contract address
   * @param {string} chain - The blockchain network
   * @returns {Promise<Object>} - The contract metadata
   */
  async getContractMetadata(contractAddress, chain = 'eth') {
    try {
      // Create a cache key based on contract address and chain
      const cacheKey = `contract_metadata_${contractAddress.toLowerCase()}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached contract metadata for ${contractAddress} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build query parameters
      const queryParams = `contractAddress=${contractAddress}`;
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getContractMetadata', queryParams);
      console.log(`Fetching contract metadata from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching contract metadata for ${contractAddress} on ${chain}:`, error);
      return {};
    }
  }

  /**
   * Gets all NFTs for a contract address
   * @param {string} contractAddress - The contract address to get NFTs for
   * @param {object} options - Additional options for the API call
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @returns {Promise<{ nfts: Array, pageKey: string }>} - The NFTs and a page key for pagination
   */
  async getNftsForContract(contractAddress, options = {}, chainId = 'eth') {
    try {
      // Create a cache key based on contract address, chain ID and options
      const serializedOptions = JSON.stringify(options);
      const cacheKey = `contract_nfts_${contractAddress.toLowerCase()}_${chainId.toLowerCase()}_${serializedOptions}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for contract ${contractAddress} on ${chainId}`);
        return cachedResponse.data;
      }
      
      const baseUrl = await this.getAlchemyUrl(chainId);
      let url = `${baseUrl}/getNFTsForContract?contractAddress=${contractAddress}`;
      
      // Add optional parameters
      if (options.pageKey) url += `&pageKey=${options.pageKey}`;
      if (options.pageSize) url += `&pageSize=${options.pageSize}`;
      if (options.withMetadata !== undefined) url += `&withMetadata=${options.withMetadata}`;
      
      console.log(`Fetching NFTs for contract ${contractAddress} on ${chainId} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch NFTs for contract ${contractAddress} on ${chainId}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFTs for contract ${contractAddress} on ${chainId}:`, error);
      return { nfts: [], pageKey: '' };
    }
  }

  /**
   * Simplified method to fetch NFTs for Farcaster users
   * Uses the well-tested getNftsForOwner method for each combination
   * @param {string[]} addresses - Array of wallet addresses
   * @param {object} options - Options for the API request
   * @returns {Promise<Object>} - Object containing NFTs and other metadata
   */
  async fetchNftsForFarcaster(addresses, options = {}) {
    try {
      // Filter valid addresses
      const validAddresses = (addresses || [])
        .filter(address => address && typeof address === 'string' && address.trim() !== '')
        .map(address => address.toLowerCase().trim());
    
      if (validAddresses.length === 0) {
        console.log('No valid addresses provided');
        return { nfts: [], errors: ['No valid addresses provided'] };
      }
      
      console.log(`Fetching NFTs for ${validAddresses.length} wallet addresses using direct method`);
      
      // Prioritize ETH and Base chains first, then fetch the rest
      const primaryChains = ['eth', 'base'];
      const secondaryChains = ['polygon', 'opt', 'arb'];
      
      console.log(`Prioritizing ${primaryChains.join(', ')} chains first, then ${secondaryChains.join(', ')}`);
      
      // Set up fetch options - include only what Alchemy API supports
      const fetchOptions = {
        withMetadata: true,
        pageSize: options.pageSize || '100',
        fetchAll: true, // CRITICAL: Enable pagination to get all NFTs
        withFloorPrice: true // Enable floor price data for sorting by value
      };
      
      // TEMPORARILY REMOVED ALL FILTER OPTIONS TO FIX 400 BAD REQUEST ERRORS
      // fetchOptions.excludeSpam = true;
      // fetchOptions.excludeAirdrops = true;
      
      console.log(`Fetch options: ${JSON.stringify(fetchOptions)}`);
      
      // Implement progressive loading with state updates
      const allNfts = [];
      const walletNftCounts = {};
      const errors = [];
      
      // Initialize wallet NFT counts
      validAddresses.forEach(addr => {
        walletNftCounts[addr] = 0;
      });
      
      // Create a callback function for state updates during fetch process
      const updateCallback = options.updateCallback || (() => {});
      
      // Track the total count for progress updates
      let totalFetchedCount = 0;
      
      // Function to fetch NFTs for a single address on a specific chain
      const fetchSingleAddressChain = async (address, chain) => {
        try {
          console.log(`Fetching NFTs for ${address} on ${chain} with pagination enabled`);
          const result = await this.getNftsForOwner(address, fetchOptions, chain);
          
          if (result.error) {
            console.error(`Error fetching NFTs for ${address} on ${chain}: ${result.error}`);
            errors.push(`${chain}: ${result.error}`);
            return [];
          }
          
          if (result.ownedNfts && Array.isArray(result.ownedNfts)) {
            const count = result.ownedNfts.length;
            console.log(`Found ${count} NFTs for ${address} on ${chain}`);
            
            // Add wallet and chain info to each NFT
            const nftsWithInfo = result.ownedNfts.map(nft => {
              // Create a consistent unique ID right when we process each NFT
              const uniqueId = this.createConsistentUniqueId({
                ...nft,
                chain,
                chainId: chain
              });
              
              return {
                ...nft,
                chain: chain,
                chainId: chain,
                network: chain,
                ownerAddress: address,
                uniqueId // Add uniqueId directly to NFT object
              };
            });
            
            // Track count for this wallet
            walletNftCounts[address] = (walletNftCounts[address] || 0) + nftsWithInfo.length;
            totalFetchedCount += nftsWithInfo.length;
            
            return nftsWithInfo;
          }
          return [];
        } catch (error) {
          console.error(`Error fetching NFTs for ${address} on ${chain}:`, error);
          errors.push(`${chain}: ${error.message}`);
          return [];
        }
      };

      // Step 1: Fetch primary chains (ETH and Base) in parallel for all addresses
      const primaryPromises = [];
      
      // Create a promise for each address and primary chain combination
      for (const address of validAddresses) {
        for (const chain of primaryChains) {
          primaryPromises.push(fetchSingleAddressChain(address, chain));
        }
      }
      
      // Execute primary chain fetches in parallel
      console.log(`Executing ${primaryPromises.length} parallel requests for primary chains`);
      const primaryResults = await Promise.all(primaryPromises);
      
      // Combine primary results
      const primaryNfts = primaryResults.flat();
      console.log(`Found ${primaryNfts.length} NFTs from primary chains (eth, base)`);
      
      // Add primary NFTs to allNfts
      allNfts.push(...primaryNfts);
      
      // Update state with primary results
      updateCallback({
        nfts: [...allNfts], // Clone to ensure we're not passing a reference
        totalFound: allNfts.length,
        inProgress: true, // Signal that more NFTs are coming
        walletNftCounts: {...walletNftCounts},
        errors: errors.length > 0 ? [...errors] : undefined
      });
      
      // Step 2: Fetch secondary chains in parallel
      const secondaryPromises = [];
      
      // Create a promise for each address and secondary chain combination
      for (const address of validAddresses) {
        for (const chain of secondaryChains) {
          secondaryPromises.push(fetchSingleAddressChain(address, chain));
        }
      }
      
      // Execute secondary chain fetches in parallel
      console.log(`Executing ${secondaryPromises.length} parallel requests for secondary chains`);
      const secondaryResults = await Promise.all(secondaryPromises);
      
      // Combine secondary results
      const secondaryNfts = secondaryResults.flat();
      console.log(`Found ${secondaryNfts.length} NFTs from secondary chains (polygon, opt, arb)`);
      
      // Add secondary NFTs to allNfts
      allNfts.push(...secondaryNfts);
      
      // Deduplicate NFTs based on uniqueId
      const uniqueNftsMap = new Map();
      allNfts.forEach(nft => {
        if (nft.uniqueId && !uniqueNftsMap.has(nft.uniqueId)) {
          uniqueNftsMap.set(nft.uniqueId, nft);
        }
      });
      
      const uniqueNfts = Array.from(uniqueNftsMap.values());
      console.log(`Found ${uniqueNfts.length} unique NFTs across all wallets (removed ${allNfts.length - uniqueNfts.length} duplicates)`);
      
      // For each address, log the count of NFTs found
      Object.keys(walletNftCounts).forEach(addr => {
        console.log(`Found ${walletNftCounts[addr]} NFTs for wallet ${addr}`);
      });
      
      return { 
        nfts: uniqueNfts,
        totalFound: uniqueNfts.length,
        walletNftCounts,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in fetchNftsForFarcaster:', error);
      return { 
        nfts: [],
        error: error.message,
        errors: [error.message]
      };
    }
  }

  /**
   * Fetches asset transfers for a given address or list of addresses
   * @param {string|string[]} addresses - The address(es) to get transfers for
   * @param {Object} options - Additional options for the request
   * @returns {Promise<Object>} - The transfers data
   */
  async getAssetTransfers(addresses, options = {}) {
    try {
      // Make sure API key is initialized
      await this.initApiKey();

      // Handle single address or array of addresses
      const addressList = Array.isArray(addresses) ? addresses : [addresses];
      const validAddresses = addressList.filter(addr => this.isValidAddress(addr));
      
      if (validAddresses.length === 0) {
        console.error('No valid addresses provided for getAssetTransfers');
        return { transfers: [] };
      }
      
      // Create a cache key based on addresses and options
      const addressKey = validAddresses.sort().join(',').toLowerCase();
      const optionsKey = JSON.stringify(options);
      const cacheKey = `asset_transfers_${addressKey}_${optionsKey}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached asset transfers for ${validAddresses.length} addresses`);
        return cachedResponse;
      }
      
      // Determine chain/network to use
      const chainId = options.chainId || options.chain || 'eth';
      console.log(`Fetching asset transfers on ${chainId} for ${validAddresses.length} addresses`);
      
      // Log all parameters
      console.log('getAssetTransfers parameters:', {
        addresses: validAddresses,
        chainId,
        options
      });
      
      // Build the request payload
      const params = {
        fromBlock: options.fromBlock || '0x0',
        toBlock: options.toBlock || 'latest',
        withMetadata: options.withMetadata !== false,
        excludeZeroValue: options.excludeZeroValue !== false,
        maxCount: options.maxCount || '0x3e8', // Default to 1000 in hex
        category: options.category || ['erc721', 'erc1155'] // Default to NFTs only
      };
      
      // Add address filters - API expects lowercase addresses
      if (options.fromAddress || options.toAddress) {
        if (options.fromAddress) {
          params.fromAddress = options.fromAddress.toLowerCase();
        }
        if (options.toAddress) {
          params.toAddress = options.toAddress.toLowerCase();
        }
      } else {
        // Use addresses as both from and to if no specific direction is requested
        params.toAddress = validAddresses.map(addr => addr.toLowerCase());
        params.fromAddress = validAddresses.map(addr => addr.toLowerCase());
      }
      
      // Try using the built-in URL helper
      try {
        // Build URL - this requires the JSON-RPC format
        const baseUrl = await this.getAlchemyUrl(chainId);
        
        // Create the JSON-RPC payload
        const payload = {
          id: 1,
          jsonrpc: "2.0",
          method: "alchemy_getAssetTransfers",
          params: [params]
        };
        
        console.log(`Making direct API request for asset transfers to: ${baseUrl}`);
        
        // Make POST request with JSON payload
        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const data = await response.json();
        
        // Check for error in the response
        if (data.error) {
          throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
        }
        
        // Extract the result from the JSON-RPC response
        const result = data.result || {};
        
        // Format the response in a consistent way
        const formattedResponse = {
          transfers: result.transfers || [],
          pageKey: result.pageKey,
          totalCount: result.transfers?.length || 0
        };
        
        // Cache the results if we have transfers
        if (formattedResponse.transfers.length > 0) {
          await this.setCachedResponse(cacheKey, formattedResponse);
        }
        
        console.log(`Found ${formattedResponse.totalCount} transfers for ${validAddresses.length} addresses`);
        return formattedResponse;
      } catch (error) {
        console.error('Error in getAssetTransfers:', error.message);
        return { transfers: [], error: error.message };
      }
    } catch (error) {
      console.error('Top-level error in getAssetTransfers:', error);
      return { transfers: [], error: error.message };
    }
  }

  /**
   * Simplified method to fetch NFTs for multiple addresses
   * This is a lightweight version of fetchNftsForMultipleAddresses with fewer options
   * @param {string[]} addresses - Array of wallet addresses
   * @param {object} options - Simple options for the API request
   * @returns {Promise<Object>} - Object containing NFTs and other metadata
   */
  async fetchNftsSimple(addresses, options = {}) {
    try {
      // Filter valid addresses
      const validAddresses = (addresses || [])
        .filter(address => this.isValidAddress(address))
        .map(address => address.toLowerCase());
      
      if (validAddresses.length === 0) {
        console.log('No valid addresses provided for fetchNftsSimple');
        return { nfts: [] };
      }
      
      console.log(`[fetchNftsSimple] Fetching NFTs for ${validAddresses.length} addresses`);
      
      // Determine chains to fetch from - default to just Ethereum for simplicity
      const chainsToFetch = options.chains || ['eth'];
      
      // Build simplified options for the underlying method
      const fetchOptions = {
        withMetadata: true,
        pageSize: options.pageSize || '100',
        excludeSpam: options.excludeSpam !== false
      };
      
      // Create fetch tasks for each address
      const fetchPromises = validAddresses.map(address => 
        this.fetchNftsAcrossChains(address, {
          ...fetchOptions,
          chains: chainsToFetch
        })
      );
      
      // Execute all fetch tasks in parallel
      const results = await Promise.allSettled(fetchPromises);
      
      // Combine and deduplicate results
      const uniqueNftsMap = new Map();
      const errors = [];
      let totalCount = 0;
      
      results.forEach((result, index) => {
        const address = validAddresses[index];
        
        if (result.status === 'fulfilled') {
          const data = result.value;
          const nfts = data.ownedNfts || [];
          totalCount += nfts.length;
          
          if (data.error) {
            errors.push(`${address}: ${data.error}`);
          }
          
          // Add ownership information and deduplicate
          nfts.forEach(nft => {
            const uniqueId = this.createConsistentUniqueId({
              ...nft,
              chain: nft.chain || nft.chainId || 'eth'
            });
            
            if (!uniqueNftsMap.has(uniqueId)) {
              uniqueNftsMap.set(uniqueId, {
                ...nft,
                ownerAddress: address,
                uniqueId
              });
            }
          });
        } else {
          errors.push(`Error fetching for ${address}: ${result.reason}`);
        }
      });
      
      // Convert the Map to an array
      const uniqueNfts = Array.from(uniqueNftsMap.values());
      
      console.log(`[fetchNftsSimple] Found ${uniqueNfts.length} unique NFTs from ${totalCount} total`);
    
    return { 
        nfts: uniqueNfts,
        totalFound: uniqueNfts.length,
        totalProcessed: totalCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in fetchNftsSimple:', error);
      return { nfts: [], error: error.message };
    }
  }

  /**
   * Checks if a specific contract is marked as spam by Alchemy
   * @param {string} contractAddress - The contract address to check
   * @param {string} network - The network to check on (eth, polygon, etc.)
   * @returns {Promise<boolean>} - True if contract is spam, false otherwise
   */
  async isSpamContract(contractAddress, network = 'eth') {
    try {
      this.initApiKey();
      
      if (!contractAddress || !this.isValidAddress(contractAddress)) {
        console.error('Invalid contract address for isSpamContract check');
        return false;
      }
      
      // Build cache key
      const cacheKey = `spam_check_${contractAddress.toLowerCase()}_${network}`;
      
      // Check cache first
      const cachedResult = await this.getCachedResponse(cacheKey);
      if (cachedResult !== null) {
        return cachedResult.isSpam;
      }
      
      // Build the query URL
      const queryParams = new URLSearchParams({
        endpoint: 'isSpamContract',
        network,
        contractAddress
      });
      
      const url = `${ALCHEMY_ENDPOINT}?${queryParams.toString()}`;
      
      console.log(`Checking if contract ${contractAddress} is spam on ${network}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error checking spam status:', await response.text());
        return false;
      }
      
      const data = await response.json();
      
      // Cache the result for a long time since spam status doesn't change often
      await this.setCachedResponse(cacheKey, { isSpam: data.isSpamContract }, 7 * 24 * 60 * 60 * 1000); // 1 week
      
      return data.isSpamContract;
    } catch (error) {
      console.error('Error checking if contract is spam:', error);
      return false;
    }
  }

  /**
   * Gets a list of all spam contracts from Alchemy
   * @param {string} network - The network to check (eth, polygon, etc.)
   * @returns {Promise<string[]>} - Array of spam contract addresses
   */
  async getSpamContracts(network = 'eth') {
    try {
      this.initApiKey();
      
      // Build cache key - we want to cache this for a while since it doesn't change often
      const cacheKey = `spam_contracts_${network}`;
      
      // Check cache first
      const cachedResult = await this.getCachedResponse(cacheKey);
      if (cachedResult !== null) {
        return cachedResult.contracts;
      }
      
      // Build the query URL
      const queryParams = new URLSearchParams({
        endpoint: 'getSpamContracts',
        network
      });
      
      const url = `${ALCHEMY_ENDPOINT}?${queryParams.toString()}`;
      
      console.log(`Fetching spam contracts for ${network}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Error fetching spam contracts:', await response.text());
        return [];
      }
      
      const data = await response.json();
      
      if (!data.contractAddresses || !Array.isArray(data.contractAddresses)) {
        console.error('Invalid response from getSpamContracts:', data);
        return [];
      }
      
      // Cache the result for a day
      await this.setCachedResponse(cacheKey, { contracts: data.contractAddresses }, 24 * 60 * 60 * 1000);
      
      console.log(`Fetched ${data.contractAddresses.length} spam contracts for ${network}`);
      return data.contractAddresses;
    } catch (error) {
      console.error('Error getting spam contracts:', error);
      return [];
    }
  }
}

// Create an instance of the AlchemyService class
const alchemyService = new AlchemyService();

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export const createConsistentUniqueId = (nft) =>
  alchemyService.createConsistentUniqueId(nft);

export const fetchAssetTransfers = (addresses, options) =>
  alchemyService.getAssetTransfers(addresses, options);

export const fetchNftsSimple = (addresses, options) =>
  alchemyService.fetchNftsSimple(addresses, options);

export const fetchNftsForFarcaster = (addresses, options) =>
  alchemyService.fetchNftsForFarcaster(addresses, options);

export default alchemyService; 