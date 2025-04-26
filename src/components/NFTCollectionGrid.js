import React, { useState } from 'react';
import NftCard from './NftCard';
import NFTModal from './NFTModal';
import '../styles/nft-unified.css';

const NFTCollectionGrid = ({ nfts, isLoading, emptyMessage = "No NFTs found" }) => {
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Handle opening the modal with the selected NFT
  const handleNFTClick = (nft) => {
    setSelectedNFT(nft);
    setIsModalOpen(true);
  };
  
  // Handle closing the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  if (isLoading) {
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
    <div>
      <div className="nft-grid">
        {nfts.map((nft) => (
          <NftCard 
            key={`${nft.asset_contract?.address}-${nft.token_id}`} 
            nft={nft} 
            onClick={handleNFTClick}
          />
        ))}
      </div>
      
      <NFTModal 
        nft={selectedNFT}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
};

export default NFTCollectionGrid; 