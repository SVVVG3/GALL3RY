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

// NFT Provider Component
export const NFTProvider = ({ children }) => {
  // State variables
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('collection'); // Default sort by collection
  const [sortOrder, setSortOrder] = useState('asc'); // Default ascending order
  
  // Fetch NFTs for wallet addresses
  const fetchNFTs = useCallback(async (addresses) => {
    if (!addresses || addresses.length === 0) {
      setNfts([]);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Normalize addresses to lowercase
      const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
      
      const result = await fetchNftsForAddresses(normalizedAddresses, {
        excludeSpam: true,
        excludeAirdrops: false, // Include airdrops to increase NFT visibility
        useAdvancedSpamFilter: true, // Enable our advanced spam filtering
        aggressiveSpamFiltering: true // Use aggressive filtering mode
      });
      
      if (result.error) {
        setError(result.error);
        setNfts([]); // Clear NFTs on error to avoid showing stale data
        return;
      }
      
      // Deduplicate NFTs (same contract/tokenId across different wallets)
      const uniqueNftsMap = new Map();
      
      result.nfts.forEach(nft => {
        const contractAddress = nft.contract?.address || nft.contractAddress;
        const tokenId = nft.tokenId || nft.token_id;
        
        if (contractAddress && tokenId) {
          const key = `${contractAddress.toLowerCase()}-${tokenId}`;
          
          // Only keep the first instance of each NFT
          if (!uniqueNftsMap.has(key)) {
            uniqueNftsMap.set(key, nft);
          }
        }
      });
      
      const uniqueNfts = Array.from(uniqueNftsMap.values());
      setNfts(uniqueNfts);
      
    } catch (err) {
      setError('Failed to fetch NFTs. Please try again.');
      setNfts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Filter NFTs based on search query
  const getFilteredNFTs = useCallback(() => {
    if (!nfts.length) return [];
    if (!searchQuery) return nfts;
    
    const query = searchQuery.toLowerCase();
    return nfts.filter(nft => {
      // Get name
      const name = nft.name || nft.title || `#${nft.tokenId || nft.token_id || ''}`;
      
      // Get collection name
      let collection = '';
      if (nft.collection?.name) {
        collection = nft.collection.name;
      } else if (nft.contract?.name) {
        collection = nft.contract.name;
      } else if (nft.contractMetadata?.name) {
        collection = nft.contractMetadata.name;
      }
      
      return (
        name.toLowerCase().includes(query) ||
        collection.toLowerCase().includes(query)
      );
    });
  }, [nfts, searchQuery]);
  
  // Get sorted and filtered NFTs
  const getSortedAndFilteredNFTs = useCallback(() => {
    // First filter NFTs
    const filteredNfts = getFilteredNFTs();
    
    // If no NFTs, return empty array
    if (!filteredNfts.length) return [];
    
    // Clone the array to avoid mutating the original
    const sortedNfts = [...filteredNfts];
    
    try {
      // Sort based on sortBy and sortOrder
      return sortedNfts.sort((a, b) => {
        // Helper function to get safely get string values
        const safeString = (value) => 
          typeof value === 'string' ? value.toLowerCase() : '';
          
        // Helper function to safely get number values
        const safeNumber = (value) => 
          typeof value === 'number' ? value : 
          typeof value === 'string' ? parseFloat(value) || 0 : 0;
      
        // Sort by name
        if (sortBy === 'name') {
          // Get names, with fallbacks
          const nameA = safeString(a.name || a.title || `#${a.tokenId || a.token_id || ''}`);
          const nameB = safeString(b.name || b.title || `#${b.tokenId || b.token_id || ''}`);
          
          const result = nameA.localeCompare(nameB, undefined, { numeric: true });
          return sortOrder === 'asc' ? result : -result;
        }
        
        // Sort by collection
        if (sortBy === 'collection') {
          // Get collections, with fallbacks
          const collectionA = safeString(
            a.collection?.name || a.contract?.name || a.contractMetadata?.name || ''
          );
          const collectionB = safeString(
            b.collection?.name || b.contract?.name || b.contractMetadata?.name || ''
          );
          
          const result = collectionA.localeCompare(collectionB, undefined, { numeric: true });
          return sortOrder === 'asc' ? result : -result;
        }
        
        // Default to no sorting (return original order)
        return 0;
      });
    } catch (err) {
      // If sorting fails, return unsorted
      return filteredNfts;
    }
  }, [getFilteredNFTs, sortBy, sortOrder]);
  
  // Clear all NFTs and reset state
  const clearNFTs = useCallback(() => {
    setNfts([]);
    setError(null);
    setSearchQuery('');
  }, []);
  
  // Context value
  const value = {
    nfts: getSortedAndFilteredNFTs(),
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    fetchNFTs,
    clearNFTs,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder
  };
  
  return (
    <NFTContext.Provider value={value}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 