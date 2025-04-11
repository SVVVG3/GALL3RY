import axios from 'axios';

// Server base URL - Use relative URL for deployed app and absolute for development
const SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '';

// Get Alchemy API keys from environment variables
const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY;

/**
 * Service for interacting with the Zapper API and Alchemy API for NFT data
 */
const zapperService = {
  /**
   * Make a GraphQL request to the Zapper API via our server proxy
   */
  async makeGraphQLRequest(query, variables) {
    try {
      console.log(`Sending GraphQL request to ${SERVER_URL}/api/zapper`);
      
      // Use fetch API instead of axios for better compatibility with mobile browsers
      const response = await fetch(`${SERVER_URL}/api/zapper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        // No explicit timeout - rely on browser's default
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('GraphQL response contains errors:', responseData.errors);
        throw new Error(`GraphQL Errors: ${JSON.stringify(responseData.errors)}`);
      }

      return responseData.data;
    } catch (error) {
      console.error('Error making Zapper GraphQL request:', error.message);
      
      // Simplified error handling for better error messages on mobile
      if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error('Request timed out. The server might be busy, please try again.');
      }
      
      // Rethrow with clearer message
      throw new Error(`Failed to load data: ${error.message}`);
    }
  },

  /**
   * Get NFT image from Alchemy API as fallback
   */
  async getAlchemyNFTImage(contractAddress, tokenId, network = 'ethereum') {
    try {
      // Guard against invalid inputs
      if (!contractAddress || !tokenId) {
        console.warn('Missing contract address or token ID for Alchemy API call');
        return null;
      }
      
      // Define network-specific API keys and base URLs
      const networkConfigs = {
        ethereum: {
          apiKey: process.env.REACT_APP_ALCHEMY_ETH_API_KEY || process.env.ALCHEMY_ETH_API_KEY,
          baseUrl: 'https://eth-mainnet.g.alchemy.com/nft/v2/'
        },
        polygon: {
          apiKey: process.env.REACT_APP_ALCHEMY_POLYGON_API_KEY || process.env.ALCHEMY_POLYGON_API_KEY,
          baseUrl: 'https://polygon-mainnet.g.alchemy.com/nft/v2/'
        },
        optimism: {
          apiKey: process.env.REACT_APP_ALCHEMY_OPTIMISM_API_KEY || process.env.ALCHEMY_OPTIMISM_API_KEY,
          baseUrl: 'https://opt-mainnet.g.alchemy.com/nft/v2/'
        },
        arbitrum: {
          apiKey: process.env.REACT_APP_ALCHEMY_ARBITRUM_API_KEY || process.env.ALCHEMY_ARBITRUM_API_KEY,
          baseUrl: 'https://arb-mainnet.g.alchemy.com/nft/v2/'
        },
        base: {
          apiKey: process.env.REACT_APP_ALCHEMY_BASE_API_KEY || process.env.ALCHEMY_BASE_API_KEY,
          baseUrl: 'https://base-mainnet.g.alchemy.com/nft/v2/'
        }
      };
      
      // Default to Ethereum if network not supported
      const networkKey = network.toLowerCase();
      const config = networkConfigs[networkKey] || networkConfigs.ethereum;
      
      // Check if we have an API key for this network
      if (!config.apiKey) {
        console.warn(`No Alchemy API key found for network: ${network}`);
        return null;
      }
      
      // Construct the API URL
      const url = `${config.baseUrl}${config.apiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=false`;
      
      console.log(`Fetching NFT image from Alchemy for ${contractAddress}:${tokenId} on ${network}`);
      
      // Make the API request
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`Alchemy API error (${response.status}): ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      // Extract the image URL with fallback options
      let imageUrl = null;
      
      // Try different image sources in order of preference
      if (data.media && Array.isArray(data.media)) {
        // Look for high-res images first
        const highResImage = data.media.find(m => 
          m.gateway && 
          m.gateway.includes('https') && 
          !m.gateway.includes('placeholder'));
          
        if (highResImage?.gateway) {
          imageUrl = highResImage.gateway;
        }
        // If no high-res, try raw URLs
        else if (data.media[0]?.raw) {
          imageUrl = data.media[0].raw;
        }
        // Last resort, try any gateway
        else if (data.media[0]?.gateway) {
          imageUrl = data.media[0].gateway;
        }
      }
      
      // If still no image, try the top-level image field
      if (!imageUrl && data.metadata && data.metadata.image) {
        imageUrl = this.processImageUrl(data.metadata.image);
      }
      
      // Final fallback to tokenUri thumbnail
      if (!imageUrl && data.tokenUri && data.tokenUri.gateway) {
        imageUrl = data.tokenUri.gateway;
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error fetching NFT image from Alchemy:', error.message);
      return null;
    }
  },
  
  /**
   * Process and fix IPFS image URLs
   */
  processImageUrl(url) {
    if (!url) return null;
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return url.replace('ar://', 'https://arweave.net/');
    }
    
    return url;
  },

  /**
   * Get Farcaster user profile by username or FID
   */
  async getFarcasterProfile(usernameOrFid) {
    try {
      if (!usernameOrFid) {
        throw new Error('Username or FID is required');
      }
      
      // Clean up username input
      const cleanUsername = usernameOrFid.trim().replace('@', '');
      
      console.log(`Fetching Farcaster profile for ${cleanUsername}`);
      
      // Use the official Zapper GraphQL API
      const zapperQuery = `
        query FarcasterProfile($username: String, $fid: Int) {
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
      
      const isUsername = isNaN(parseInt(cleanUsername));
      const variables = isUsername 
        ? { username: cleanUsername }
        : { fid: parseInt(cleanUsername) };
      
      console.log(`Sending query with variables:`, JSON.stringify(variables));
      
      // Use our abstracted method which has better error handling
      const data = await this.makeGraphQLRequest(zapperQuery, variables);
      
      if (!data?.farcasterProfile) {
        console.warn(`No Farcaster profile found for ${cleanUsername}`);
        throw new Error(`Could not find Farcaster profile for ${cleanUsername}`);
      }
      
      console.log(`Found Farcaster user: ${data.farcasterProfile.username} (FID: ${data.farcasterProfile.fid})`);
      console.log(`Found ${data.farcasterProfile.connectedAddresses?.length || 0} connected addresses`);
      
      // Get the best avatar URL
      let avatarUrl = data.farcasterProfile.metadata?.imageUrl || '';
      
      // Log the original avatar URL for debugging
      console.log(`Original avatar URL: ${avatarUrl}`);
      
      // If it's a Warpcast URL, make sure it doesn't have a small size parameter
      if (avatarUrl && avatarUrl.includes('warpcast.com') && avatarUrl.includes('size=')) {
        // Remove size parameter to get full-size image
        avatarUrl = avatarUrl.replace(/([?&])size=\d+/, '$1size=600');
        console.log(`Updated avatar URL: ${avatarUrl}`);
      }
      
      // Return profile with normalized field names
      return {
        fid: data.farcasterProfile.fid,
        username: data.farcasterProfile.username,
        displayName: data.farcasterProfile.metadata?.displayName || '',
        description: data.farcasterProfile.metadata?.description || '',
        avatarUrl: avatarUrl,
        warpcastUrl: data.farcasterProfile.metadata?.warpcast?.url || '',
        custodyAddress: data.farcasterProfile.custodyAddress,
        connectedAddresses: data.farcasterProfile.connectedAddresses || []
      };
    } catch (error) {
      console.error('Error fetching Farcaster profile:', error);
      throw new Error(`Failed to find Farcaster profile: ${error.message}`);
    }
  },

  /**
   * Get NFTs for a list of addresses using the Zapper GraphQL API
   */
  async getNftsForAddresses(addresses, options = {}) {
    try {
      if (!addresses || addresses.length === 0) {
        console.warn('No addresses provided to getNftsForAddresses');
        return { nfts: [] };
      }
      
      // Filter out invalid addresses
      addresses = addresses.filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x'));
      
      if (addresses.length === 0) {
        console.warn('No valid addresses remaining after filtering');
        return { nfts: [] };
      }
      
      console.log(`Fetching NFTs for ${addresses.length} addresses:`, addresses);
      
      // Use a simpler, more reliable query structure
      const zapperQuery = `
        query NFTs($addresses: [String!]!, $limit: Int) {
          nfts(
            ownerAddresses: $addresses,
            limit: $limit
          ) {
            items {
              token {
                id
                tokenId
                name
                symbol
                contractAddress
                networkId
                collection {
                  id
                  name
                  floorPrice {
                    value
                    symbol
                  }
                  imageUrl
                }
              }
              estimatedValue {
                value
                token {
                  symbol
                }
              }
              collection {
                id
                name
                floorPrice {
                  value
                  symbol
                }
                imageUrl
              }
              imageUrl
              tokenId
              name
              metadata {
                name
                description
                image
                tokenId
              }
            }
          }
        }
      `;
      
      const variables = {
        addresses,
        limit: options.limit || 100
      };
      
      // Add a retry mechanism
      let retries = 0;
      const maxRetries = 3;
      let lastError = null;
      
      while (retries < maxRetries) {
        try {
          const data = await this.makeGraphQLRequest(zapperQuery, variables);
          
          if (!data || !data.nfts || !data.nfts.items) {
            console.warn('Unexpected response format from Zapper API:', data);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            continue;
          }
          
          // Process and enhance the NFT data
          const nfts = data.nfts.items.map(nft => {
            // Create a normalized NFT object that combines data from all possible sources
            const normalizedNft = {
              ...nft,
              id: nft.token?.id || nft.id,
              tokenId: nft.tokenId || nft.token?.tokenId,
              name: nft.name || nft.token?.name || nft.metadata?.name || `#${nft.tokenId || nft.token?.tokenId}`,
              collection: nft.collection || nft.token?.collection,
              imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl
            };
            
            // Add network information if available
            if (nft.token?.networkId) {
              normalizedNft.networkId = nft.token.networkId;
              
              // Map network ID to network name
              const networkMap = {
                1: 'ethereum',
                10: 'optimism',
                137: 'polygon',
                42161: 'arbitrum',
                8453: 'base'
              };
              
              normalizedNft.network = networkMap[nft.token.networkId] || 'ethereum';
            }
            
            return normalizedNft;
          });
          
          console.log(`Successfully fetched ${nfts.length} NFTs`);
          
          // Filter out NFTs with no images for better display
          const nftsWithImages = nfts.filter(nft => nft.imageUrl);
          console.log(`${nftsWithImages.length} NFTs have images`);
          
          // Sort by name for consistent display
          nftsWithImages.sort((a, b) => {
            // Sort by collection name first
            const collectionA = a.collection?.name || '';
            const collectionB = b.collection?.name || '';
            
            if (collectionA !== collectionB) {
              return collectionA.localeCompare(collectionB);
            }
            
            // Then by token name/id
            return a.name.localeCompare(b.name);
          });
          
          return { nfts: nftsWithImages };
        } catch (error) {
          console.error(`Attempt ${retries + 1} failed:`, error.message);
          lastError = error;
          retries++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retries));
        }
      }
      
      // If we've exhausted all retries, throw the last error
      if (lastError) {
        throw lastError;
      }
      
      return { nfts: [] };
    } catch (error) {
      console.error('Error fetching NFTs from Zapper:', error.message);
      
      // Return a more friendly error message
      throw new Error(`Failed to load NFTs: ${error.message}. Please try again later.`);
    }
  },

  /**
   * Get NFT collections for a set of wallet addresses
   */
  async getNftCollectionsForAddresses(addresses, options = {}) {
    const { first = 50, after = null } = options;

    const query = `
      query GetNFTCollections($owners: [Address!]!, $first: Int, $after: String) {
        nftCollections(
          owners: $owners
          first: $first
          after: $after
        ) {
          edges {
            node {
              id
              name
              floorPriceEth
              tokenCount
              cardImageUrl
            }
            cursor
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
      first,
      after
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      if (data && data.nftCollections && data.nftCollections.edges) {
        const pageInfo = data.nftCollections.pageInfo || { hasNextPage: false, endCursor: null };
        
        // Map and clean the collection data
        const collections = data.nftCollections.edges
          .map(edge => {
            const collection = edge.node;
            if (!collection) return null;
            
            return {
              id: collection.id,
              name: collection.name || 'Unknown Collection',
              floorPriceEth: collection.floorPriceEth,
              tokenCount: collection.tokenCount || 0,
              imageUrl: collection.cardImageUrl,
              cursor: edge.cursor
            };
          })
          .filter(collection => collection !== null);
        
        return {
          collections,
          pageInfo
        };
      }
      return { collections: [], pageInfo: { hasNextPage: false, endCursor: null } };
    } catch (error) {
      console.error('Error fetching NFT collections:', error.message);
      throw error;
    }
  },

  /**
   * Get NFTs for a specific address
   */
  async getNFTsForUser(addresses, options = {}) {
    const query = `
      query getNFTsForUser($addresses: [Address!]!, $networks: [Network!], $first: Int!) {
        nftUsersTokens(
          owners: $addresses
          networks: $networks
          first: $first
        ) {
          edges {
            node {
              token {
                id
                tokenId
                name
                estimatedValue {
                  value
                  currency
                }
                collection {
                  name
                  address
                  imageUrl
                }
                media {
                  url
                  type
                  format
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      addresses,
      networks: options.networks || ['ETHEREUM_MAINNET'],
      first: options.first || 100
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      
      // Transform the response to match our NftCard component expectations
      return data.nftUsersTokens.edges.map(edge => ({
        id: edge.node.token.id,
        name: edge.node.token.name,
        token_id: edge.node.token.tokenId,
        estimatedValue: {
          value: edge.node.token.estimatedValue?.value,
          currency: edge.node.token.estimatedValue?.currency
        },
        collection: {
          name: edge.node.token.collection.name,
          address: edge.node.token.collection.address,
          imageUrl: edge.node.token.collection.imageUrl
        },
        imageUrl: edge.node.token.media?.[0]?.url || edge.node.token.collection.imageUrl
      }));
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      throw error;
    }
  },
};

export default zapperService; 