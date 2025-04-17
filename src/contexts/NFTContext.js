import React, { createContext, useContext, useState, useCallback } from 'react';
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
      
      // Fetch transfer data to enhance NFTs with accurate transfer timestamps
      console.log('Fetching transfer history for better "Recent" sorting...');
      let transferData = { transfers: [], transferMap: {} };
      
      try {
        transferData = await fetchAssetTransfers(normalizedAddresses, {
          debug: true, // Enable diagnostic data
          category: ['ERC721', 'ERC1155'] // Explicitly specify NFT categories
        });
        
        // Log detailed transfer data for debugging
        console.log(`Transfer data received from API:`, {
          dataAvailable: !!transferData,
          transferCount: transferData?.transfers?.length || 0,
          mapEntries: transferData?.transferMap ? Object.keys(transferData.transferMap).length : 0,
          diagnosticInfo: transferData?.diagnostic,
          firstFewKeys: transferData?.transferMap ? Object.keys(transferData.transferMap).slice(0, 5) : []
        });
      } catch (transferError) {
        console.error('Error fetching transfer data:', transferError);
        // Don't fail the entire request if transfers fail - just continue with the NFTs we have
      }
      
      // Enhance NFTs with transfer timestamps if transfer data is available
      let enhancedNfts = result.nfts || [];
      let transfersApplied = 0;
      
      if (transferData.transferMap && Object.keys(transferData.transferMap).length > 0) {
        console.log(`Enhancing NFTs with transfer timestamps from ${Object.keys(transferData.transferMap).length} records`);
        
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
            
            // Log details about this NFT and the timestamp being applied
            if (transfersApplied <= 3) {
              console.log(`Transfer timestamp applied: NFT ${nft.name || 'Unnamed'}, contract: ${contractAddress}, tokenId: ${tokenId}, timestamp: ${timestamp}`);
            }
            
            return {
              ...nft,
              transferTimestamp: timestamp
            };
          }
          
          return nft;
        });
        
        console.log(`Successfully applied ${transfersApplied} transfer timestamps out of ${enhancedNfts.length} NFTs`);
        
        // Log a few sample NFTs for debugging
        if (enhancedNfts.length > 0) {
          const samples = enhancedNfts.slice(0, 2);
          console.log("Sample NFTs with transfer data:", samples.map(nft => ({
            name: nft.name || nft.title,
            contractAddress: nft.contract?.address,
            tokenId: nft.tokenId,
            hasTransferTimestamp: !!nft.transferTimestamp,
            transferTimestamp: nft.transferTimestamp
          })));
        }
      } else {
        console.log('No transfer data available for enhancing NFTs');
      }
      
      if (result.error) {
        setError(result.error);
      }
      
      // Set enhanced NFTs to state
      setNfts(enhancedNfts);
      
      return {
        nfts: enhancedNfts,
        totalCount: result.totalCount || enhancedNfts.length,
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