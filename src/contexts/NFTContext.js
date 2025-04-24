import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchNftsForAddresses, fetchAssetTransfers } from '../services/alchemyService';

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
  
  // Request cache to avoid duplicate API calls
  const [requestCache, setRequestCache] = useState({});
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sort states
  const [sortBy, setSortBy] = useState('name'); // Options: 'recent', 'name', 'collection', 'value'
  const [sortOrder, setSortOrder] = useState('asc'); // Options: 'asc', 'desc'
  
  // Reset state
  const resetState = useCallback(() => {
    setNfts([]);
    setError(null);
  }, []);
  
  // Generate cache key for requests
  const generateCacheKey = useCallback((addresses, options) => {
    // Sort addresses for consistent key regardless of order
    const sortedAddresses = [...addresses].sort().join(',');
    const optionsStr = JSON.stringify(options || {});
    return `${sortedAddresses}:${optionsStr}`;
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
      
      // Check cache first
      const cacheKey = generateCacheKey(addresses, options);
      const cachedResult = requestCache[cacheKey];
      
      if (cachedResult && !options.bypassCache) {
        console.log(`Using cached NFT data for ${addresses.length} wallets`);
        setNfts(cachedResult.nfts);
        return cachedResult;
      }
      
      console.log(`Fetching NFTs for ${addresses.length} wallets across multiple chains`);
      
      // Normalize addresses to lowercase
      const normalizedAddresses = addresses.map(addr => addr.toLowerCase());
      
      // Use the new multi-chain implementation with enhanced filtering
      const result = await fetchNftsForAddresses(normalizedAddresses, {
        ...options,
        excludeSpam: options.excludeSpam !== false, // Default to true unless explicitly set to false
        excludeAirdrops: true, // Always filter out airdrops
        fetchAll: options.fetchAll !== false // Default to true unless explicitly set to false
      });
      
      console.log(`Fetched ${result.nfts?.length || 0} NFTs total`);
      
      // Fetch transfer data to enhance NFTs with accurate transfer timestamps
      console.log('Fetching transfer history for better "Recent" sorting...');
      let transferData = { transfers: [], transferMap: {} };
      
      try {
        transferData = await fetchAssetTransfers(normalizedAddresses, {
          debug: true, // Enable diagnostic data
          category: ['ERC721', 'ERC1155'] // Explicitly specify NFT categories
        });
        
        console.log(`Transfer data received: ${transferData?.transfers?.length || 0} transfers`);
      } catch (transferError) {
        console.error('Error fetching transfer data:', transferError);
        // Don't fail the entire request if transfers fail - just continue with the NFTs we have
      }
      
      // Enhance NFTs with transfer timestamps if transfer data is available
      let enhancedNfts = result.nfts || [];
      let transfersApplied = 0;
      
      if (transferData.transferMap && Object.keys(transferData.transferMap).length > 0) {
        console.log(`Enhancing NFTs with transfer timestamps`);
        
        enhancedNfts = enhancedNfts.map(nft => {
          // Create the key for the transfer map
          const contractAddress = nft.contract?.address || nft.contractAddress;
          const tokenId = nft.tokenId || nft.token_id;
          
          if (!contractAddress || !tokenId) return nft;
          
          const key = `${contractAddress.toLowerCase()}-${tokenId}`;
          const transferTimestamp = transferData.transferMap[key];
          
          // Add the timestamp if found
          if (transferTimestamp) {
            transfersApplied++;
            
            // Use ISO string for consistent date handling
            const timestamp = new Date(transferTimestamp).toISOString();
            
            return {
              ...nft,
              transferTimestamp: timestamp
            };
          }
          
          return nft;
        });
        
        console.log(`Applied ${transfersApplied} transfer timestamps`);
      }
      
      // Remove duplicate NFTs (same contract/tokenId across different wallets)
      const nftMap = new Map();
      enhancedNfts.forEach(nft => {
        const contractAddress = nft.contract?.address || nft.contractAddress;
        const tokenId = nft.tokenId || nft.token_id;
        
        if (contractAddress && tokenId) {
          const key = `${contractAddress.toLowerCase()}-${tokenId}`;
          // Only keep the first instance of each NFT
          if (!nftMap.has(key)) {
            nftMap.set(key, nft);
          }
        }
      });
      
      const uniqueNfts = Array.from(nftMap.values());
      console.log(`After deduplication: ${uniqueNfts.length} unique NFTs (removed ${enhancedNfts.length - uniqueNfts.length} duplicates)`);
      
      if (result.error) {
        setError(result.error);
      }
      
      // Set enhanced NFTs to state
      setNfts(uniqueNfts);
      
      // Cache the result
      const finalResult = {
        nfts: uniqueNfts,
        totalCount: uniqueNfts.length,
        error: result.error
      };
      
      setRequestCache(prev => ({
        ...prev,
        [cacheKey]: finalResult
      }));
      
      return finalResult;
    } catch (err) {
      console.error('Error in fetchAllNFTsForWallets:', err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [generateCacheKey, requestCache]);
  
  // Filter NFTs by search query
  const getFilteredNFTs = useCallback(() => {
    if (!nfts.length) return [];
    
    // First filter by search query
    let filteredNfts = nfts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredNfts = nfts.filter(nft => {
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
    }
    
    // Then sort the filtered NFTs
    return getSortedNFTs(filteredNfts);
  }, [nfts, searchQuery, sortBy, sortOrder]);
  
  // Sort NFTs based on sortBy and sortOrder
  const getSortedNFTs = useCallback((nftsToSort) => {
    if (!nftsToSort || nftsToSort.length === 0) return [];
    
    const nftsCopy = [...nftsToSort];
    
    switch (sortBy) {
      case 'name':
        return nftsCopy.sort((a, b) => {
          // Enhanced name extraction with more fallbacks and cleaning
          const nameA = (a.name || a.title || a.metadata?.name || `#${a.tokenId || a.token_id || '0'}`).toLowerCase();
          const nameB = (b.name || b.title || b.metadata?.name || `#${b.tokenId || b.token_id || '0'}`).toLowerCase();
          
          // Helper function to determine if a character is a letter
          const isLetter = (char) => /[a-z]/i.test(char);
          
          // Check if names start with letters
          const aStartsWithLetter = nameA.length > 0 && isLetter(nameA[0]);
          const bStartsWithLetter = nameB.length > 0 && isLetter(nameB[0]);
          
          // If one starts with letter and other doesn't, letter comes first
          // Numbers and symbols should come AFTER all letters (after Z)
          if (aStartsWithLetter && !bStartsWithLetter) {
            return sortOrder === 'asc' ? -1 : 1; // A-Z first
          }
          if (!aStartsWithLetter && bStartsWithLetter) {
            return sortOrder === 'asc' ? 1 : -1; // Numbers/symbols after Z
          }
          
          // If both start with letters or both start with non-letters,
          // use standard comparison with numeric collation
          return sortOrder === 'asc' 
            ? nameA.localeCompare(nameB, undefined, { numeric: true }) 
            : nameB.localeCompare(nameA, undefined, { numeric: true });
        });
        
      case 'value':
        return nftsCopy.sort((a, b) => {
          // Enhanced value extraction with more fallbacks
          const valueA = a.collection?.floorPrice?.valueUsd || 
                        a.floorPrice?.valueUsd || 
                        a.collection?.floorPrice?.value || 
                        a.floorPrice?.value || 
                        (a.contractMetadata?.openSea?.floorPrice || 0) ||
                        (a.contract?.openSeaMetadata?.floorPrice || 0) ||
                        0;
                        
          const valueB = b.collection?.floorPrice?.valueUsd || 
                        b.floorPrice?.valueUsd ||
                        b.collection?.floorPrice?.value || 
                        b.floorPrice?.value || 
                        (b.contractMetadata?.openSea?.floorPrice || 0) ||
                        (b.contract?.openSeaMetadata?.floorPrice || 0) ||
                        0;
          
          // Convert to numbers to ensure proper comparison
          const numA = parseFloat(valueA) || 0;
          const numB = parseFloat(valueB) || 0;
          
          return sortOrder === 'asc' 
            ? numA - numB 
            : numB - numA;
        });
        
      case 'recent':
        return nftsCopy.sort((a, b) => {
          // Prioritize transferTimestamp which comes from Alchemy's getAssetTransfers
          const timeA = a.transferTimestamp || 
                       a.lastActivityTimestamp || 
                       a.acquiredAt || 
                       a.lastTransferTimestamp || 
                       a.mintedAt ||
                       a.timeLastUpdated ||
                       a.createdAt;
                       
          const timeB = b.transferTimestamp || 
                       b.lastActivityTimestamp || 
                       b.acquiredAt || 
                       b.lastTransferTimestamp || 
                       b.mintedAt ||
                       b.timeLastUpdated ||
                       b.createdAt;
          
          // If both have timestamps, compare them as dates
          if (timeA && timeB) {
            try {
              const dateA = new Date(timeA);
              const dateB = new Date(timeB);
              return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            } catch (e) {
              console.warn('Error comparing dates:', e);
            }
          }
          
          // If one has timestamp and other doesn't, prioritize the one with timestamp
          if (timeA && !timeB) return sortOrder === 'asc' ? -1 : 1;
          if (!timeA && timeB) return sortOrder === 'asc' ? 1 : -1;
          
          // If neither has a timestamp or date comparison failed, fall back to token ID
          const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
          const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
          
          return sortOrder === 'asc' ? idA - idB : idB - idA;
        });
        
      case 'collection':
      default:
        return nftsCopy.sort((a, b) => {
          // Enhanced collection name extraction with more fallbacks
          const collA = (a.collection?.name || 
                       a.collectionName || 
                       a.contract?.name || 
                       a.contractMetadata?.name ||
                       '').toLowerCase();
                       
          const collB = (b.collection?.name || 
                       b.collectionName || 
                       b.contract?.name || 
                       b.contractMetadata?.name ||
                       '').toLowerCase();
          
          // Helper function to determine if a character is a letter
          const isLetter = (char) => /[a-z]/i.test(char);
          
          // Check if collection names start with letters
          const aStartsWithLetter = collA.length > 0 && isLetter(collA[0]);
          const bStartsWithLetter = collB.length > 0 && isLetter(collB[0]);
          
          // Empty collections (with '') should always be sorted last
          if (collA === '' && collB !== '') {
            return sortOrder === 'asc' ? 1 : -1; // Empty collections last
          }
          if (collA !== '' && collB === '') {
            return sortOrder === 'asc' ? -1 : 1; // Empty collections last
          }
          
          // If same collection, sort by token ID
          if (collA === collB) {
            const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
            const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
            
            return sortOrder === 'asc' ? idA - idB : idB - idA;
          }
          
          // If one starts with letter and other doesn't, letter comes first
          // Numbers and symbols should come AFTER all letters (after Z)
          if (aStartsWithLetter && !bStartsWithLetter) {
            return sortOrder === 'asc' ? -1 : 1; // A-Z first
          }
          if (!aStartsWithLetter && bStartsWithLetter) {
            return sortOrder === 'asc' ? 1 : -1; // Numbers/symbols after Z
          }
          
          // Normal comparison for collections that both start with letters or both with non-letters
          return sortOrder === 'asc' 
            ? collA.localeCompare(collB, undefined, { numeric: true }) 
            : collB.localeCompare(collA, undefined, { numeric: true });
        });
    }
  }, [sortBy, sortOrder]);
  
  // Context value
  const value = {
    nfts: getFilteredNFTs(),
    allNfts: nfts,
    isLoading,
    error,
    searchQuery,
    selectedWallets,
    sortBy,
    sortOrder,
    setSearchQuery,
    setSelectedWallets,
    setSortBy,
    setSortOrder,
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