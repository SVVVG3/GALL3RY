import React from 'react';
import '../styles/NFTGrid.css';
import NFTCard from './NftCard.js'; // Explicit extension to ensure correct file is loaded

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
  
  if (isLoading && (!nfts || nfts.length === 0)) {
    return (
      <div className="nft-grid-loader">
        <div className="loader"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p className="nft-grid-no-results">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="nft-grid-container">
      <div className="nft-grid">
        {nfts.map((nft, index) => {
          // Ensure collection_name is set on the nft object if not already present
          if (!nft.collection_name) {
            nft.collection_name = getCollectionName(nft);
          }
          
          // Debug the NFT data being passed to NFTCard
          const nftKey = getNftKey(nft) || index;
          console.log(`Rendering NFT ${nftKey}`, nft);
          
          return (
            <NFTCard 
              key={nftKey} 
              nft={nft}
            />
          );
        })}
      </div>
    </div>
  );
};

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
  
  const contract = getContractAddress(nft);
  const tokenId = getTokenId(nft);
  return `${contract}-${tokenId}`;
};

export default NFTGrid; 