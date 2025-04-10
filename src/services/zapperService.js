import axios from 'axios';

// Server base URL - Use relative URL for deployed app and absolute for development
const SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '';

// Get Alchemy API keys from environment variables
const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY;

/**
 * Service for interacting with the Zapper API, Neynar API, and Alchemy API for NFT data
 */
const zapperService = {
  /**
   * Make a GraphQL request to the Zapper API via our server proxy
   */
  async makeGraphQLRequest(query, variables) {
    try {
      console.log(`Sending GraphQL request to ${SERVER_URL}/api/zapper`);
      const response = await axios({
        url: `${SERVER_URL}/api/zapper`,
        method: 'post',
        data: {
          query,
          variables,
        },
        timeout: 10000, // 10 second timeout to prevent hanging
      });

      if (response.data.errors) {
        console.error('GraphQL response contains errors:', response.data.errors);
        throw new Error(`GraphQL Errors: ${JSON.stringify(response.data.errors)}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('Error making Zapper GraphQL request:', error.message);
      
      // Enhance error handling for common connection issues
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`Cannot connect to API server: ${SERVER_URL}. The server might be down or not running.`);
      }
      
      if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        throw new Error(`Connection to API server timed out. Please check if the server is running.`);
      }
      
      if (error.response) {
        console.error('Response error data:', error.response.data);
        console.error('Response error status:', error.response.status);
        
        if (error.response.status === 404) {
          throw new Error(`API endpoint not found (404). Please check if the server is running correctly.`);
        }
        
        if (error.response.status === 500) {
          throw new Error(`Server error (500). The API server encountered an internal error.`);
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response received:', error.request);
        throw new Error('No response from API server. Please check your connection or if the server is running.');
      }
      
      // Rethrow with clearer message
      throw error;
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
   * Get a Farcaster user's profile from Neynar API
   */
  async getFarcasterProfileFromNeynar(usernameOrFid) {
    try {
      const isUsername = isNaN(parseInt(usernameOrFid));
      const apiKey = process.env.REACT_APP_NEYNAR_API_KEY;
      
      if (!apiKey) {
        console.error('Neynar API key is missing');
        throw new Error('Neynar API key is missing');
      }
      
      console.log(`Fetching Farcaster profile for ${isUsername ? 'username' : 'FID'}: ${usernameOrFid} via Neynar API`);
      
      let url;
      if (isUsername) {
        url = `https://api.neynar.com/v2/farcaster/user/search?q=${usernameOrFid}&limit=1`;
      } else {
        url = `https://api.neynar.com/v2/farcaster/user?fid=${usernameOrFid}`;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api_key': apiKey
        }
      });
      
      if (!response.ok) {
        throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      let user;
      
      if (isUsername) {
        if (!data.users || data.users.length === 0) {
          throw new Error(`No user found with username: ${usernameOrFid}`);
        }
        user = data.users[0];
      } else {
        if (!data.user) {
          throw new Error(`No user found with FID: ${usernameOrFid}`);
        }
        user = data.user;
      }
      
      console.log(`Found Farcaster user: ${user.username} (FID: ${user.fid})`);
      
      // Get connected addresses
      console.log(`Fetching connected addresses for FID: ${user.fid}`);
      const addressesResponse = await fetch(`https://api.neynar.com/v2/farcaster/user/addresses?fid=${user.fid}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api_key': apiKey
        }
      });
      
      let connectedAddresses = [];
      if (addressesResponse.ok) {
        const addressesData = await addressesResponse.json();
        if (addressesData.verified_addresses) {
          connectedAddresses = addressesData.verified_addresses
            .filter(addr => addr.eth_address)
            .map(addr => addr.eth_address);
          console.log(`Found ${connectedAddresses.length} connected addresses`);
        }
      }
      
      return {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        bio: user.profile?.bio?.text || '',
        avatarUrl: user.pfp?.url || '',
        connectedAddresses
      };
    } catch (error) {
      console.error('Error fetching Farcaster profile from Neynar:', error);
      throw error;
    }
  },

  /**
   * Get Farcaster user profile - prioritizes Neynar API for reliability
   */
  async getFarcasterProfile(usernameOrFid) {
    try {
      // Use Neynar API as primary source
      try {
        return await this.getFarcasterProfileFromNeynar(usernameOrFid);
      } catch (neynarError) {
        console.warn('Neynar API failed:', neynarError);
        // Fall through to Zapper fallback
      }
      
      // Fall back to Zapper API if Neynar fails
      console.log(`Falling back to Zapper API for ${usernameOrFid}`);
      const zapperQuery = `
        query FarcasterProfile($username: String, $fid: Int) {
          farcasterProfile(username: $username, fid: $fid) {
            fid
            username
            displayName
            avatar
            bio
            connectedAddresses
          }
        }
      `;
      
      const isUsername = isNaN(parseInt(usernameOrFid));
      const variables = isUsername 
        ? { username: usernameOrFid }
        : { fid: parseInt(usernameOrFid) };
        
      const data = await this.makeGraphQLRequest(zapperQuery, variables);
      
      if (data?.farcasterProfile) {
        return {
          ...data.farcasterProfile,
          avatarUrl: data.farcasterProfile.avatar // Normalize the field name
        };
      }
      
      throw new Error(`Could not find Farcaster profile for ${usernameOrFid}`);
    } catch (error) {
      console.error('Error fetching Farcaster profile:', error);
      throw error;
    }
  },

  /**
   * Get NFTs for a set of wallet addresses
   */
  async getNftsForAddresses(addresses, options = {}) {
    try {
      const { first = 100, after = null } = options;
      
      if (!addresses || addresses.length === 0) {
        throw new Error('At least one wallet address is required');
      }

      console.log(`Fetching NFTs for addresses: ${addresses.join(', ')}`);

      // Updated query to match the current Zapper API schema
      const query = `
      query GetNFTs($owners: [Address!]!, $first: Int, $after: String) {
        nftUsersTokens(
          owners: $owners
          first: $first
          after: $after
          withOverrides: true
        ) {
          edges {
            node {
              id
              name
              tokenId
              description
              mediasV2 {
                ... on Image {
                  url
                  originalUri
                }
                ... on Animation {
                  url
                  originalUri
                }
              }
              collection {
                id
                name
                floorPriceEth
                cardImageUrl
              }
              estimatedValue {
                valueUsd
              }
              estimatedValueEth
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

      const data = await this.makeGraphQLRequest(query, { owners: addresses, first, after });
      
      // Early return if no data
      if (!data || !data.nftUsersTokens || !data.nftUsersTokens.edges) {
        console.warn('No NFT data returned from Zapper API');
        return {
          nfts: [],
          pageInfo: { hasNextPage: false, endCursor: null }
        };
      }
      
      console.log(`Zapper API returned ${data.nftUsersTokens.edges.length} NFT results`);
      
      // Extract the pagination info
      const pageInfo = data.nftUsersTokens.pageInfo || { hasNextPage: false, endCursor: null };
      
      // Helper function to get the best image URL from mediaV2 array
      const getBestImageUrl = (medias) => {
        if (!medias || !Array.isArray(medias) || medias.length === 0) return null;
        
        // Try to find a media item with a valid URL
        for (const media of medias) {
          if (!media) continue;
          
          // Prefer original URI if available
          if (media.originalUri && media.originalUri.startsWith('http')) {
            return media.originalUri;
          }
          
          // Fall back to regular URL
          if (media.url && media.url.startsWith('http')) {
            return media.url;
          }
        }
        
        return null;
      };
      
      // Process and map the NFTs to a clean structure
      const processedNfts = await Promise.all(
        data.nftUsersTokens.edges.map(async (edge) => {
          const nft = edge.node;
          
          if (!nft || !nft.id) return null;
          
          // Get the best image URL from mediasV2
          let imageUrl = getBestImageUrl(nft.mediasV2);
          
          // If no valid image found from Zapper's mediasV2, try getting it from Alchemy
          if (!imageUrl) {
            try {
              // Extract contract address from the NFT ID or another field
              // Zapper NFT IDs typically follow the format TmZ0VG9rZW4tMjc1Njg2MjMzLTk4NQ==
              // where after decoding the second part is the contract-specific identifier
              const idParts = nft.id.split('-');
              const contractIdentifier = idParts.length > 1 ? idParts[1] : null;
              
              if (contractIdentifier && nft.tokenId) {
                console.log(`No Zapper image for NFT ${nft.id}, trying Alchemy fallback`);
                const alchemyImage = await this.getAlchemyNFTImage(
                  contractIdentifier, 
                  nft.tokenId, 
                  'ethereum' // Default to Ethereum as we don't have network info anymore
                );
                
                if (alchemyImage) {
                  imageUrl = alchemyImage;
                  console.log(`Found Alchemy image for NFT ${nft.id}`);
                }
              }
            } catch (error) {
              console.warn('Error getting Alchemy image:', error.message);
            }
          }
          
          // Use collection image as fallback if still no image
          if (!imageUrl && nft.collection?.cardImageUrl) {
            imageUrl = nft.collection.cardImageUrl;
          }
          
          // Return a clean NFT object structure
          return {
            id: nft.id,
            name: nft.name || 'Unnamed NFT',
            tokenId: nft.tokenId,
            description: nft.description,
            imageUrl: imageUrl,
            collection: nft.collection ? {
              id: nft.collection.id,
              name: nft.collection.name || 'Unknown Collection',
              floorPriceEth: nft.collection.floorPriceEth,
              imageUrl: nft.collection.cardImageUrl
            } : null,
            estimatedValueEth: nft.estimatedValueEth,
            estimatedValueUsd: nft.estimatedValue?.valueUsd || (nft.estimatedValueEth ? nft.estimatedValueEth * 3000 : null),
            cursor: edge.cursor
          };
        })
      );
      
      const filteredNfts = processedNfts.filter(nft => nft !== null);
      console.log(`Successfully processed ${filteredNfts.length} valid NFTs out of ${processedNfts.length} total`);
      
      // Filter out null values and return the processed NFTs
      return {
        nfts: filteredNfts,
        pageInfo
      };
    } catch (error) {
      console.error('Error fetching NFTs:', error.message);
      return {
        nfts: [],
        pageInfo: { hasNextPage: false, endCursor: null }
      };
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
};

export default zapperService; 