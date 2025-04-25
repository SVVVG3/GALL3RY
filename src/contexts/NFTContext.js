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
        excludeAirdrops: true
      });
      
      if (result.error) {
        setError(result.error);
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
      console.error('Error fetching NFTs:', err);
      setError(err.message || 'Failed to fetch NFTs');
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
  
  // Clear all NFTs and reset state
  const clearNFTs = useCallback(() => {
    setNfts([]);
    setError(null);
    setSearchQuery('');
  }, []);
  
  // Context value
  const value = {
    nfts: getFilteredNFTs(),
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    fetchNFTs,
    clearNFTs
  };
  
  return (
    <NFTContext.Provider value={value}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 