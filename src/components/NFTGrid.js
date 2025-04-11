import React from 'react';
import NftCard from './NftCard';

/**
 * NftGrid component for displaying a grid of NFTs
 * @param {Array} nfts - Array of NFT objects to display
 * @param {Function} onNftClick - Function to call when an NFT is clicked
 * @param {boolean} loading - Whether the NFTs are loading
 * @param {string} emptyMessage - Message to display when there are no NFTs
 */
const NftGrid = ({ nfts = [], onNftClick, loading = false, emptyMessage = 'No NFTs found' }) => {
  if (loading) {
    return (
      <div className="nft-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
      {nfts.map((nft, index) => (
        <NftCard 
          key={`${nft.collection?.address}-${nft.tokenId}-${index}`}
          nft={nft}
          onClick={() => onNftClick && onNftClick(nft)}
        />
      ))}
    </div>
  );
};

export default NftGrid; 