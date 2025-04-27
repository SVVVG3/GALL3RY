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
  const [chainFilter, setChainFilter] = useState('all'); // Default to show all chains
  
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
  
  // Filter NFTs based on search query and chain
  const getFilteredNFTs = useCallback(() => {
    if (!nfts.length) return [];
    
    // First apply chain filter if applicable
    let filteredByChain = nfts;
    if (chainFilter !== 'all') {
      filteredByChain = nfts.filter(nft => {
        // Try different property paths to find chain information
        const chainValues = [];
        
        // Check various properties where chain info might be stored
        if (nft.chain) chainValues.push(nft.chain.toLowerCase());
        if (nft.network) chainValues.push(nft.network.toLowerCase());
        if (nft.chainId) chainValues.push(nft.chainId.toLowerCase());
        
        // Check uniqueId for chain info - format: "chain:address:tokenId"
        if (nft.uniqueId && nft.uniqueId.includes(':')) {
          const parts = nft.uniqueId.split(':');
          if (parts.length > 2 && parts[0]) {
            chainValues.push(parts[0].toLowerCase());
          }
        }
        
        // Check contractAddress for chain info - format: "chain:address"
        const contractAddress = nft.contractAddress || nft.contract?.address;
        if (contractAddress && typeof contractAddress === 'string' && contractAddress.includes(':')) {
          const parts = contractAddress.split(':');
          if (parts.length > 1 && parts[0]) {
            chainValues.push(parts[0].toLowerCase());
          }
        }
        
        // Special case for polygon/matic
        if (chainFilter === 'polygon' && chainValues.includes('matic')) return true;
        if (chainFilter === 'matic' && chainValues.includes('polygon')) return true;
        
        // Special case for eth/ethereum
        if (chainFilter === 'eth' && chainValues.includes('ethereum')) return true;
        if (chainFilter === 'ethereum' && chainValues.includes('eth')) return true;
        
        // Special case for arb/arbitrum
        if (chainFilter === 'arb' && chainValues.includes('arbitrum')) return true;
        if (chainFilter === 'arbitrum' && chainValues.includes('arb')) return true;
        
        // Special case for opt/optimism
        if (chainFilter === 'opt' && chainValues.includes('optimism')) return true;
        if (chainFilter === 'optimism' && chainValues.includes('opt')) return true;
        
        // Check if any of the chain values match the filter
        return chainValues.includes(chainFilter.toLowerCase());
      });
      
      console.log(`Filtered by chain "${chainFilter}": ${filteredByChain.length} of ${nfts.length} NFTs`);
    }
    
    // Then apply search query filter
    if (!searchQuery) return filteredByChain;
    
    const query = searchQuery.toLowerCase();
    return filteredByChain.filter(nft => {
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
  }, [nfts, searchQuery, chainFilter]);
  
  // Get all unique chains from NFTs
  const getUniqueChains = useCallback(() => {
    if (!nfts.length) return [];
    
    const chains = new Set();
    
    // Add default common chains as fallback
    const defaultChains = ['eth', 'polygon', 'base', 'arb', 'opt', 'zora'];
    defaultChains.forEach(chain => chains.add(chain));
    
    // Then extract from NFTs
    nfts.forEach(nft => {
      // Try different property paths to find chain information
      const chainFromChain = nft.chain?.toLowerCase();
      const chainFromNetwork = nft.network?.toLowerCase();
      const chainFromChainId = nft.chainId?.toLowerCase();
      
      // Add any non-empty chain values
      if (chainFromChain) chains.add(chainFromChain);
      if (chainFromNetwork) chains.add(chainFromNetwork);
      if (chainFromChainId) chains.add(chainFromChainId);
      
      // Look for chain in contractAddress if it contains a colon (format: "chain:address")
      const contractAddress = nft.contractAddress || nft.contract?.address;
      if (contractAddress && contractAddress.includes(':')) {
        const parts = contractAddress.split(':');
        if (parts.length > 1 && parts[0]) {
          chains.add(parts[0].toLowerCase());
        }
      }
      
      // If we have a uniqueId property containing chain info (format: "chain:address:tokenId")
      if (nft.uniqueId && nft.uniqueId.includes(':')) {
        const parts = nft.uniqueId.split(':');
        if (parts.length > 2 && parts[0]) {
          chains.add(parts[0].toLowerCase());
        }
      }
    });
    
    // Convert to array and sort
    return Array.from(chains).sort();
  }, [nfts]);
  
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
        
        // Sort by value
        if (sortBy === 'value') {
          // Get floor prices, with fallbacks
          const valueA = safeNumber(
            a.collection?.floorPrice?.value || 
            a.floorPrice?.value || 
            a.collection?.floorPrice?.valueUsd || 
            a.floorPrice?.valueUsd || 
            0
          );
          const valueB = safeNumber(
            b.collection?.floorPrice?.value || 
            b.floorPrice?.value ||
            b.collection?.floorPrice?.valueUsd || 
            b.floorPrice?.valueUsd || 
            0
          );
          
          return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        // Sort by recent (timestamps)
        if (sortBy === 'recent') {
          // Try to get timestamps, with fallbacks
          const timeA = a.transferTimestamp || a.lastActivityTimestamp || a.acquiredAt || 0;
          const timeB = b.transferTimestamp || b.lastActivityTimestamp || b.acquiredAt || 0;
          
          // If both values are valid dates
          if (timeA && timeB) {
            const dateA = new Date(timeA);
            const dateB = new Date(timeB);
            return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          }
          
          // If values aren't valid dates, fall back to token IDs
          const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
          const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
          return sortOrder === 'asc' ? idA - idB : idB - idA;
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
    setChainFilter('all');
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
    setSortOrder,
    chainFilter,
    setChainFilter,
    getUniqueChains
  };
  
  return (
    <NFTContext.Provider value={value}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 