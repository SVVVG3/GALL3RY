import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchNftsForAddresses } from '../services/alchemyService';

// Create context
const NFTContext = createContext();

// Custom hook for using the NFT context
export const useNFT = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFT must be used within a NFTProvider');
  }
  return context;
};

// NFT Provider Component with simplified architecture
export const NFTProvider = ({ children }) => {
  // State variables
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedWallets, setSelectedWallets] = useState([]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  
  // Reset state
  const resetState = useCallback(() => {
    setNfts([]);
    setError(null);
  }, []);
  
  // Fetch NFTs for multiple addresses with multi-chain support
  const fetchAllNFTsForWallets = useCallback(async (addresses, options = {}) => {
    if (!addresses || addresses.length === 0) {
      console.warn('No wallet addresses provided to fetchAllNFTsForWallets');
      return { nfts: [], error: 'No wallet addresses provided' };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setSelectedWallets(addresses);
      
      console.log(`Fetching NFTs for ${addresses.length} wallets across multiple chains`);
      
      // Normalize addresses to lowercase
      const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
      
      // Use the new multi-chain implementation with enhanced filtering
      const result = await fetchNftsForAddresses(normalizedAddresses, {
        ...options,
        excludeSpam: options.excludeSpam !== false, // Default to true unless explicitly set to false
        excludeAirdrops: true // Always filter out airdrops
      });
      
      console.log(`Fetched ${result.nfts?.length || 0} NFTs total`);
      
      if (result.error) {
        setError(result.error);
      }
      
      // Set NFTs to state and return the result
      setNfts(result.nfts || []);
      
      return {
        nfts: result.nfts || [],
        totalCount: result.totalCount || 0,
        error: result.error
      };
    } catch (err) {
      console.error('Error in fetchAllNFTsForWallets:', err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Filter NFTs by search query
  const getFilteredNFTs = useCallback(() => {
    if (!nfts.length) return [];
    
    if (!searchQuery) return nfts;
    
    const query = searchQuery.toLowerCase();
    return nfts.filter(nft => {
      // Get NFT title the same way as NFTGrid does
      const title = nft.name || nft.title || `#${nft.tokenId || '0'}`;
      
      // Get collection name the same way as NFTGrid does
      let collection = '';
      if (nft.collection && nft.collection.name) {
        collection = nft.collection.name;
      } else if (nft.contract) {
        collection = nft.contract.name || 
          (nft.contract.openSeaMetadata?.collectionName) || 
          (nft.contract.address ? `${nft.contract.address.slice(0, 6)}...${nft.contract.address.slice(-4)}` : '');
      } else if (nft.contractAddress) {
        collection = `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`;
      }
      
      return (
        title.toLowerCase().includes(query) ||
        collection.toLowerCase().includes(query) ||
        (nft.description && nft.description.toLowerCase().includes(query))
      );
    });
  }, [nfts, searchQuery]);
  
  // Context value
  const value = {
    nfts: getFilteredNFTs(),
    isLoading,
    error,
    searchQuery,
    selectedWallets,
    setSearchQuery,
    setSelectedWallets,
    resetState,
    
    // Main function to fetch NFTs for wallets
    fetchAllNFTsForWallets
  };
  
  return (
    <NFTContext.Provider value={value}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 