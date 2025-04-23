import React from 'react';
import '../styles/NFTGrid.css';
import NFTCard from './NftCard.js'; // Explicit extension to ensure correct file is loaded
import VercelNFTCard from './VercelNFTCard.js'; // Import Vercel-optimized component
import { createConsistentUniqueId } from '../services/alchemyService';

/**
 * NFT Grid component 
 * Primary component for displaying NFTs in a grid layout
 * 
 * Features:
 * - Displays a grid of NFT cards with images and metadata
 * - Handles loading states and empty states
 * - Supports various NFT data formats from different sources
 * - Automatically extracts collection names and other metadata
 * 
 * @param {Object[]} nfts - Array of NFT objects to display
 * @param {boolean} isLoading - Whether NFTs are currently being loaded
 * @param {string} emptyMessage - Optional custom message to show when no NFTs are found
 * @returns {JSX.Element} The rendered NFT grid component
 */
const NFTGrid = ({ nfts = [], isLoading = false, emptyMessage = "No NFTs found" }) => {
  console.log(`NFTGrid rendering ${nfts.length} NFTs, isLoading: ${isLoading}`);
  
  // Deduplicate NFTs by uniqueId or contract+tokenId+network for safety
  const uniqueNfts = removeDuplicateNfts(nfts);
  
  // Determine if we're in production (Vercel) or development
  const isProduction = process.env.NODE_ENV === 'production' || 
                       window.location.hostname.includes('vercel.app');
  
  // Choose the appropriate NFT card component based on environment
  const CardComponent = isProduction ? VercelNFTCard : NFTCard;
  
  if (isLoading && (!uniqueNfts || uniqueNfts.length === 0)) {
    return (
      <div className="nft-grid-loader">
        <div className="loader"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!uniqueNfts || uniqueNfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p className="nft-grid-no-results">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="nft-grid-container">
      <div className="nft-grid">
        {uniqueNfts.map((nft, index) => {
          // Create a copy of the NFT object to avoid modifying non-extensible objects
          const nftCopy = {...nft};
          
          // Ensure collection_name is set on the copy of the nft object
          if (!nftCopy.collection_name) {
            nftCopy.collection_name = getCollectionName(nft);
          }
          
          // Use uniqueId if available, otherwise generate a key
          const nftKey = nft.uniqueId || getNftKey(nft) || `nft-${index}`;
          
          return (
            <CardComponent 
              key={nftKey} 
              nft={nftCopy}
            />
          );
        })}
      </div>
    </div>
  );
};

// Function to remove duplicate NFTs
function removeDuplicateNfts(nfts) {
  if (!nfts || nfts.length === 0) return [];
  
  const uniqueMap = new Map();
  const duplicatesFound = [];
  
  nfts.forEach(nft => {
    // Skip invalid NFTs
    if (!nft) return;
    
    // Get a unique key for this NFT using the consistent ID function
    // Prioritize existing uniqueId to avoid regenerating it
    const key = nft.uniqueId || createConsistentUniqueId(nft);
    
    if (!uniqueMap.has(key)) {
      // If this is a new uniqueId, store the NFT and ensure it has the uniqueId
      const nftWithId = {...nft, uniqueId: key};
      uniqueMap.set(key, nftWithId);
    } else {
      // Track duplicates for logging
      duplicatesFound.push({
        key,
        name: nft.name || nft.title || `Token #${nft.tokenId || nft.token_id}`,
        collection: nft.collection?.name || nft.contract?.name || 'Unknown Collection'
      });
    }
  });
  
  const uniqueNfts = [...uniqueMap.values()];
  
  // Log if duplicates were found and removed with details
  if (uniqueNfts.length < nfts.length) {
    console.log(`Removed ${nfts.length - uniqueNfts.length} duplicate NFTs in NFTGrid`);
    
    // Log a sample of duplicates for debugging
    if (duplicatesFound.length > 0) {
      console.log(`Sample of removed duplicates:`, 
        duplicatesFound.slice(0, Math.min(5, duplicatesFound.length))
      );
    }
  }
  
  return uniqueNfts;
}

// Utility functions to handle NFT data
const getCollectionName = (nft) => {
  if (!nft) return '';
  
  // Try various possible collection name locations in NFT metadata
  if (nft.contract && nft.contract.name) {
    return nft.contract.name;
  }
  
  if (nft.collection && nft.collection.name) {
    return nft.collection.name;
  }
  
  if (nft.contractMetadata && nft.contractMetadata.name) {
    return nft.contractMetadata.name;
  }
  
  if (nft.contract_name) {
    return nft.contract_name;
  }
  
  if (nft.contractName) {
    return nft.contractName;
  }
  
  return '';
};

const getContractAddress = (nft) => {
  if (!nft) return '';

  // Try to get contract address from various possible locations
  if (nft.contract && nft.contract.address) {
    return nft.contract.address;
  }
  
  if (nft.contractAddress) {
    return nft.contractAddress;
  }
  
  if (nft.id && nft.id.contractAddress) {
    return nft.id.contractAddress;
  }
  
  if (nft.token_address) {
    return nft.token_address;
  }
  
  if (nft.contract && nft.contract.id) {
    return nft.contract.id;
  }
  
  if (nft.address) {
    return nft.address;
  }
  
  // If we can't find a contract address, return an empty string
  return '';
};

const getTokenId = (nft) => {
  if (!nft) return '';
  
  if (nft.tokenId) {
    return nft.tokenId;
  }
  
  if (nft.id && nft.id.tokenId) {
    return nft.id.tokenId;
  }
  
  if (nft.token_id) {
    return nft.token_id;
  }
  
  return '';
};

const getNftKey = (nft) => {
  if (!nft) return '';
  
  return createConsistentUniqueId(nft);
};

export default NFTGrid; 