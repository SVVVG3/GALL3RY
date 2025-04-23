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
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
  }

  // Store the API key
  apiKey = null;

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
        ? '/api/alchemy-proxy'
        : 'http://localhost:3000/api/alchemy-proxy';
        
      baseUrl = `${baseUrl}/${chainId}`;
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
   * Gets NFTs for a specific owner
   * @param {string} owner - The owner address
   * @param {Object} options - Query options
   * @param {string} chain - The blockchain network
   * @returns {Promise<Array>} - The NFTs
   */
  async getNftsForOwner(owner, options = {}, chain = 'eth') {
    try {
      // Create a cache key based on owner address, options and chain
      const optionsStr = JSON.stringify(options);
      const cacheKey = `owner_nfts_${owner.toLowerCase()}_${optionsStr}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for owner ${owner} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('owner', owner);
      
      if (options.pageSize) {
        queryParams.append('pageSize', options.pageSize);
      }
      
      if (options.pageKey) {
        queryParams.append('pageKey', options.pageKey);
      }
      
      // Handle filter options properly - convert boolean flags to filter arrays
      const excludeFilters = [];
      if (options.excludeSpam === true) {
        excludeFilters.push('SPAM');
      }
      if (options.excludeAirdrops === true) {
        excludeFilters.push('AIRDROP');
      }
      
      // Only add excludeFilters param if we have filters to exclude
      if (excludeFilters.length > 0) {
        // Each filter should be passed separately as an array element
        for (const filter of excludeFilters) {
          queryParams.append('excludeFilters[]', filter);
        }
      }
      
      // Legacy support for direct excludeFilters array
      if (Array.isArray(options.excludeFilters) && options.excludeFilters.length > 0) {
        for (const filter of options.excludeFilters) {
          queryParams.append('excludeFilters[]', filter);
        }
      }
      
      if (options.includeFilters) {
        if (Array.isArray(options.includeFilters)) {
          for (const filter of options.includeFilters) {
            queryParams.append('includeFilters[]', filter);
          }
        }
      }
      
      if (options.tokenAddresses) {
        for (const addr of options.tokenAddresses) {
          queryParams.append('contractAddresses[]', addr);
        }
      }
      
      if (options.withMetadata !== undefined) {
        queryParams.append('withMetadata', options.withMetadata);
      }
      
      // Get base URL for the chain
      const baseUrl = await this.getAlchemyUrl(chain);
      // Build the complete URL with the endpoint and query params
      const url = `${baseUrl}/getNFTsForOwner?${queryParams.toString()}`;
      
      console.log(`Fetching NFTs from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch NFTs: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFTs for owner ${owner} on ${chain}:`, error);
      return { ownedNfts: [] };
    }
  }
  
  /**
   * Fetch NFTs across multiple chains and combine the results
   */
  async fetchNftsAcrossChains(ownerAddress, options = {}) {
    // Make sure API key is initialized
    await this.initApiKey();
    
    // Get the chains to fetch from
    const chains = options.chains || SUPPORTED_CHAINS.map(c => c.id);
    const pageSize = options.pageSize || 100;
    const fetchAll = options.fetchAll !== false; // Default to true
    
    try {
      console.log(`Fetching NFTs across ${chains.length} chains for ${ownerAddress}${fetchAll ? ' (all pages)' : ''}`);
      
      // Make parallel requests to all chains
      const results = await Promise.allSettled(
        chains.map(chainId => {
          // Setup options for this request
          const fetchOptions = {
            pageSize,
            withMetadata: true,
            fetchAll
          };
          
          // Create excludeFilters array for Alchemy API
          const excludeFilters = [];
          
          // Only add filters if they are explicitly set to true
          if (options.excludeSpam === true) {
            excludeFilters.push('SPAM');
          }
          
          if (options.excludeAirdrops === true) {
            excludeFilters.push('AIRDROP');
          }
          
          // Only add the excludeFilters array if there are filters to exclude
          if (excludeFilters.length > 0) {
            fetchOptions.excludeFilters = excludeFilters;
          }
          
          return this.getNftsForOwner(ownerAddress, fetchOptions, chainId);
        })
      );
      
      // Combine results from successful requests
      let allNfts = [];
      let totalErrors = 0;
      let totalCount = 0;
      
      results.forEach((result, index) => {
        const chainId = chains[index];
        
        if (result.status === 'fulfilled') {
          const nfts = result.value.ownedNfts || [];
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
    
    // Extract token ID - normalize to string
    const tokenId = String(
      (nft.tokenId) || 
      (nft.token_id) || 
      ''
    ).trim();
    
    // Extract network - normalize to lowercase
    const network = (
      (nft.network) || 
      (nft.chain) ||
      'eth'
    ).toLowerCase();
    
    // Create a consistent unique ID - independent of wallet
    return `${network}:${contractAddress}:${tokenId}`;
  }
  
  /**
   * Fetch NFTs for multiple wallet addresses with optional deduplication
   * @param {string[]} addresses - Array of wallet addresses
   * @param {Object} options - Options for filtering and pagination
   * @returns {Promise<Object>} - NFTs and metadata
   */
  async fetchNftsForMultipleAddresses(addresses, options = {}) {
    // Make sure API key is initialized
    await this.initApiKey();

    console.log(`Fetching NFTs for ${addresses.length} addresses across ${options.chains?.length || 'all'} chains`);
    
    // Filter for valid addresses
    const validAddresses = addresses.filter(addr => this.isValidAddress(addr));
    
    if (validAddresses.length === 0) {
      console.log('No valid addresses provided');
      return { nfts: [], totalCount: 0 };
    }

    // Determine which chains to fetch from based on options
    const chainsToFetch = options.chains || ['eth'];
    
    console.log(`Fetching NFTs for ${validAddresses.length} addresses across ${chainsToFetch.length} chains using standard Alchemy endpoints`);
    
    // Use a map to ensure uniqueness based on contract+tokenId+chainId
    const uniqueNftsMap = new Map();
    const totalErrors = [];
    
    // Create an object to count NFTs per wallet for debugging
    const walletsNftCount = {};
    
    // Process each chain
    for (const chain of chainsToFetch) {
      console.log(`Processing chain: ${chain}`);
      
      // Process each wallet address for this chain
      for (const address of validAddresses) {
        try {
          // Setup options for this request
          const fetchOptions = {
            pageSize: 100,
            withMetadata: true,
            fetchAll: options.fetchAll === true
          };
          
          // Create excludeFilters array for Alchemy API
          const excludeFilters = [];
          
          // Only add filters if they are explicitly set to true
          if (options.excludeSpam === true) {
            excludeFilters.push('SPAM');
          }
          
          if (options.excludeAirdrops === true) {
            excludeFilters.push('AIRDROP');
          }
          
          // Add the excludeFilters array if there are filters to exclude
          if (excludeFilters.length > 0) {
            fetchOptions.excludeFilters = excludeFilters;
          }
          
          console.log(`Fetching NFTs for wallet ${address} on chain ${chain} with filters: ${excludeFilters.join(', ') || 'none'}`);
          
          // Get NFTs for this wallet on this chain
          const result = await this.getNftsForOwner(address, fetchOptions, chain);
          
          if (result.error) {
            console.warn(`Error fetching NFTs for ${address} on ${chain}: ${result.error}`);
            totalErrors.push({ address, chain, error: result.error });
            continue;
          }
          
          // Process each NFT and add to the unique map
          const nfts = result.ownedNfts || [];
          
          if (nfts.length > 0) {
            console.log(`Found ${nfts.length} NFTs for wallet ${address} on chain ${chain}`);
            
            if (!walletsNftCount[address]) {
              walletsNftCount[address] = {total: 0, added: 0, chains: {}};
            }
            
            walletsNftCount[address].total += nfts.length;
            walletsNftCount[address].chains[chain] = nfts.length;
            
            for (const nft of nfts) {
              // Create a more robust unique ID for this NFT that doesn't depend on wallet
              // This is crucial for deduplication across wallets
              const contractAddress = nft.contract?.address?.toLowerCase() || '';
              const tokenId = nft.tokenId || '';
              
              if (!contractAddress || !tokenId) {
                continue; // Skip NFTs without proper identifiers
              }
              
              // Create a unique ID for this NFT including chain info but NOT wallet info
              const uniqueId = `${chain}:${contractAddress}:${tokenId}`;
              
              // If this NFT hasn't been seen before, add it to the map
              if (!uniqueNftsMap.has(uniqueId)) {
                // Ensure the NFT has chain information
                nft.chain = chain;
                
                // Some NFTs might not have an image URL, add a placeholder or process as needed
                if (!nft.image && nft.media && nft.media.length > 0 && nft.media[0].gateway) {
                  nft.image = {
                    cachedUrl: nft.media[0].gateway,
                    originalUrl: nft.media[0].gateway,
                    pngUrl: nft.media[0].gateway,
                    thumbnailUrl: nft.media[0].gateway
                  };
                }
                
                uniqueNftsMap.set(uniqueId, nft);
                walletsNftCount[address].added++;
              }
            }
          } else {
            console.log(`No NFTs found for wallet ${address} on chain ${chain}`);
          }
          
        } catch (error) {
          console.error(`Error processing ${address} on ${chain}:`, error);
          totalErrors.push({ address, chain, error: error.message });
        }
      }
    }
    
    // Convert the map values to an array
    const uniqueNfts = Array.from(uniqueNftsMap.values());
    
    // Log per-wallet statistics
    for (const [address, counts] of Object.entries(walletsNftCount)) {
      console.log(`Wallet ${address} has ${counts.added} unique NFTs across all chains (found ${counts.total} total including duplicates)`);
    }
    
    console.log(`Found ${uniqueNfts.length} unique NFTs across all wallets after deduplication`);
    
    return {
      nfts: uniqueNfts,
      totalCount: uniqueNfts.length,
      addressesQueried: validAddresses.length,
      chainsQueried: chainsToFetch,
      errors: totalErrors
    };
  }
  
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
   * Get wallet addresses that own NFTs from a specified contract
   * Updated to match the Alchemy NFT API v3 documentation
   * 
   * @param {string} contractAddress - The NFT contract address
   * @param {string} [network='eth'] - Blockchain network (eth, polygon, etc.)
   * @returns {Promise<string[]>} Array of wallet addresses
   */
  async getOwnersForContract(contractAddress, network = 'eth') {
    // Make sure API key is initialized
    await this.initApiKey();

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
          
          if (!this.apiKey) {
            console.error('Missing Alchemy API key for direct API call');
            throw new Error('Alchemy API key not available');
          }
          
          // Map the network to the appropriate endpoint prefix
          // Get the base API URL using our helper
          const baseUrl = await this.getAlchemyUrl(network, 'nft');
          
          // Build the direct API URL as per the docs
          const directUrl = `${baseUrl}/getOwnersForContract`;
          
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
      if (options.withMetadata) url += `&withMetadata=true`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch NFTs for contract: ${error}`);
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
      return { nfts: [], pageKey: null };
    }
  }

  /**
   * Gets all owners for a NFT
   * @param {string} contractAddress - The contract address
   * @param {string} tokenId - The token ID
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @returns {Promise<Array>} - The owners
   */
  async getOwnersForNft(contractAddress, tokenId, chainId = 'eth') {
    try {
      // Create a cache key based on contract address, token ID, and chain ID
      const cacheKey = `nft_owners_${contractAddress.toLowerCase()}_${tokenId}_${chainId.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached owners for NFT ${contractAddress}:${tokenId} on ${chainId}`);
        return cachedResponse.data;
      }
      
      const baseUrl = await this.getAlchemyUrl(chainId);
      const url = `${baseUrl}/getOwnersForNft?contractAddress=${contractAddress}&tokenId=${tokenId}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch owners for NFT: ${error}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data: data.owners,
        timestamp: Date.now()
      });
      
      return data.owners;
    } catch (error) {
      console.error(`Error fetching owners for NFT ${contractAddress}:${tokenId} on ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Gets all NFTs for an owner across all supported chains
   * @param {string} owner - The wallet address
   * @param {object} options - Additional options
   * @returns {Promise<Object>} - NFTs grouped by chain
   */
  async getAllNftsForOwner(owner, options = {}) {
    try {
      // Create a cache key based on owner address and serialized options
      const serializedOptions = JSON.stringify(options);
      const cacheKey = `all_owner_nfts_${owner.toLowerCase()}_${serializedOptions}`;
      
      // Check if we have a valid cached response for all chains
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for owner ${owner} across all chains`);
        return cachedResponse.data;
      }
      
      // Get NFTs from all chains concurrently
      const supportedChains = ['eth', 'polygon', 'opt', 'arb', 'base'];
      const results = await Promise.allSettled(
        supportedChains.map(chain => this.getNftsForOwner(owner, options, chain))
      );
      
      // Process results
      const nftsByChain = {};
      results.forEach((result, index) => {
        const chain = supportedChains[index];
        if (result.status === 'fulfilled') {
          nftsByChain[chain] = result.value.ownedNfts || [];
        } else {
          console.error(`Failed to fetch NFTs on ${chain}:`, result.reason);
          nftsByChain[chain] = [];
        }
      });
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data: nftsByChain,
        timestamp: Date.now()
      });
      
      return nftsByChain;
    } catch (error) {
      console.error('Error fetching NFTs across chains:', error);
      return {};
    }
  }

  /**
   * Gets metadata for a specific token
   * @param {string} contractAddress - The contract address
   * @param {string} tokenId - The token ID
   * @param {string} chain - The blockchain network
   * @returns {Promise<Object>} - Token metadata
   */
  async getTokenMetadata(contractAddress, tokenId, chain = 'eth') {
    try {
      // Create a cache key based on contract address, token ID and chain
      const cacheKey = `token_metadata_${contractAddress.toLowerCase()}_${tokenId}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached metadata for token ${contractAddress}:${tokenId} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getTokenMetadata', `tokenId=${tokenId}`);
      console.log(`Fetching token metadata from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch token metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching token metadata for ${contractAddress}:${tokenId} on ${chain}:`, error);
      return null;
    }
  }

  /**
   * Gets tokens for a specific owner
   * @param {string} owner - The owner address
   * @param {string} chain - The blockchain network
   * @returns {Promise<Array>} - The tokens
   */
  async getTokensForOwner(owner, chain = 'eth') {
    try {
      // Create a cache key based on owner address and chain
      const cacheKey = `owner_tokens_${owner.toLowerCase()}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached tokens for owner ${owner} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getTokenBalances', `owner=${owner}`);
      console.log(`Fetching tokens from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tokens: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching tokens for owner ${owner} on ${chain}:`, error);
      return { tokens: [] };
    }
  }
}

/**
 * Get asset transfers for addresses to track NFT ownership history
 * Uses Alchemy's getAssetTransfers endpoint to get NFT transfer history
 */

// Create an instance of the AlchemyService class
const alchemyService = new AlchemyService();

AlchemyService.prototype.getAssetTransfers = async function(addresses, options = {}) {
  // Make sure API key is initialized
  await this.initApiKey();
  
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
};

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export const fetchAssetTransfers = (addresses, options) =>
  alchemyService.getAssetTransfers(addresses, options);

export const createConsistentUniqueId = (nft) =>
  alchemyService.createConsistentUniqueId(nft);

export default alchemyService; 