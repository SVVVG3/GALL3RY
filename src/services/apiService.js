import axios from 'axios';

/**
 * Simple API service for fetching NFT data
 */
const apiService = {
  /**
   * Base API URL for external services
   */
  baseURL: 'https://api.alchemy.com/v2',
  
  /**
   * Get API key from environment variables
   */
  getAlchemyKey() {
    return process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
  },
  
  /**
   * Fetch NFTs for a given wallet address
   */
  async getNftsForOwner(walletAddress) {
    try {
      const apiKey = this.getAlchemyKey();
      const url = `${this.baseURL}/${apiKey}/getNFTs?owner=${walletAddress}`;
      
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      throw error;
    }
  },
  
  /**
   * Fetch popular NFT collections (mock data for now)
   */
  async getPopularCollections() {
    // Mock data for now
    return [
      {
        id: 'azuki',
        name: 'Azuki',
        description: 'A collection of 10,000 avatars',
        imageUrl: 'https://i.seadn.io/gae/H8jOCJuQokNqGBpkBN5wk1oZwO7LM8bNnrHCaekV2nKjnCqw6UB5oaH8XyNeBDj6bA_n1mjejzhFQUP3O1NfjFLHr3FOaeHcTOOT?auto=format&w=256'
      },
      {
        id: 'bayc',
        name: 'Bored Ape Yacht Club',
        description: 'A collection of 10,000 ape NFTs',
        imageUrl: 'https://i.seadn.io/gae/Ju9CkWtV-1Okvf45wo8UctR-M9He2PjILP0oOvxE89AyiPPGtrR3gysu1Zgy0hjd2xKIgjJJtWIc0ybj4Vd7wv8t3pxDGHoJBzDB?auto=format&w=256'
      },
      {
        id: 'cryptopunks',
        name: 'CryptoPunks',
        description: 'A collection of 10,000 pixel art characters',
        imageUrl: 'https://i.seadn.io/gae/BdxvLseXcfl57BiuQcQYdJ64v-aI8din7WPk0Pgo3qQFhAUH-B6i-dCqqc_mCkRIzULmwzwecnohLhrcH8A9mpWIZqA7ygc52Sr81hE?auto=format&w=256'
      }
    ];
  }
};

export default apiService; 