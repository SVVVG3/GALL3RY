import React, { createContext, useContext, useState, useCallback } from 'react';
import alchemyService from '../services/alchemySDK';

// Create context
const SimpleNFTContext = createContext();

// Custom hook for using the NFT context
export const useSimpleNFT = () => {
  const context = useContext(SimpleNFTContext);
  if (!context) {
    throw new Error('useSimpleNFT must be used within a SimpleNFTProvider');
  }
  return context;
};

// NFT Provider Component with simplified architecture
export const SimpleNFTProvider = ({ children }) => {
  // State variables
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageKey, setPageKey] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWallets, setSelectedWallets] = useState([]);
  
  // Reset state
  const resetState = useCallback(() => {
    setNfts([]);
    setPageKey(null);
    setHasMore(false);
    setError(null);
  }, []);
  
  // Fetch NFTs for a single address
  const fetchNFTs = useCallback(async (address, options = {}) => {
    if (!address) {
      setError('Wallet address is required');
      return { nfts: [], hasMore: false };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the Alchemy SDK service
      const result = await alchemyService.getNFTsForOwner(address, options);
      
      // Update state
      setNfts(prevNfts => options.pageKey ? [...prevNfts, ...result.nfts] : result.nfts);
      setPageKey(result.pageKey);
      setHasMore(result.hasMore);
      
      return result;
    } catch (err) {
      console.error(`Error fetching NFTs for ${address}:`, err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch NFTs for multiple addresses
  const fetchNFTsForMultipleAddresses = useCallback(async (addresses, options = {}) => {
    if (!addresses || addresses.length === 0) {
      setError('No wallet addresses provided');
      return { nfts: [], hasMore: false };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use the Alchemy SDK service for multiple addresses
      const result = await alchemyService.getNFTsForMultipleOwners(addresses, options);
      
      // Update state
      setNfts(result.nfts);
      setPageKey(null); // No single pageKey for multiple addresses
      setHasMore(result.hasMore);
      
      // Save the selected wallets
      setSelectedWallets(addresses);
      
      return result;
    } catch (err) {
      console.error('Error fetching NFTs for multiple addresses:', err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Load more NFTs
  const loadMoreNFTs = useCallback(async () => {
    if (!pageKey || isLoading || !hasMore || selectedWallets.length !== 1) {
      return;
    }
    
    try {
      await fetchNFTs(selectedWallets[0], { pageKey });
    } catch (err) {
      console.error('Error loading more NFTs:', err);
      setError(err.message || 'Failed to load more NFTs');
    }
  }, [fetchNFTs, pageKey, isLoading, hasMore, selectedWallets]);
  
  // Filter NFTs by search query
  const getFilteredNFTs = useCallback(() => {
    if (!nfts.length) return [];
    
    if (!searchQuery) return nfts;
    
    const query = searchQuery.toLowerCase();
    return nfts.filter(nft => {
      // Get NFT title the same way as SimpleNFTGrid does
      const title = nft.name || nft.title || `#${nft.tokenId || '0'}`;
      
      // Get collection name the same way as SimpleNFTGrid does
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
    pageKey,
    hasMore,
    searchQuery,
    selectedWallets,
    setSearchQuery,
    setSelectedWallets,
    fetchNFTs,
    fetchNFTsForMultipleAddresses,
    loadMoreNFTs,
    resetState,
  };
  
  return (
    <SimpleNFTContext.Provider value={value}>
      {children}
    </SimpleNFTContext.Provider>
  );
};

export default SimpleNFTContext; 