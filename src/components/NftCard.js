import React from 'react';
import '../styles/NFTCard.css';

/**
 * NFTCard component renders a single NFT
 */
const NftCard = ({ nft, onClick }) => {
  // Handle broken/missing images
  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = '/assets/placeholder-nft.svg';
  };

  // Get the best available image URL from the NFT
  const getImageUrl = () => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    // Check various paths where image URL might be found
    if (nft.media && nft.media.gateway) {
      return nft.media.gateway;
    }
    
    if (nft.image) {
      return nft.image;
    }
    
    if (nft.imageUrl) {
      return nft.imageUrl;
    }
    
    if (nft.metadata && nft.metadata.image) {
      return nft.metadata.image;
    }
    
    // Return placeholder if no valid image URL is found
    return '/assets/placeholder-nft.svg';
  };

  // Get the NFT name with fallbacks
  const getNftName = () => {
    if (!nft) return 'Unknown NFT';
    
    if (nft.name) {
      return nft.name;
    }
    
    if (nft.title) {
      return nft.title;
    }
    
    if (nft.metadata && nft.metadata.name) {
      return nft.metadata.name;
    }
    
    // Show token ID if we can't find a name
    if (nft.tokenId) {
      return `Token #${nft.tokenId}`;
    }
    
    return 'Unnamed NFT';
  };

  // Get collection name with fallbacks
  const getCollectionName = () => {
    if (!nft) return 'Unknown Collection';
    
    // Try different paths where collection name might be found
    if (nft.collection && nft.collection.name) {
      return nft.collection.name;
    }
    
    if (nft.contract && nft.contract.name) {
      return nft.contract.name;
    }
    
    if (nft.contractMetadata && nft.contractMetadata.name) {
      return nft.contractMetadata.name;
    }
    
    // Show contract address as fallback
    if (nft.contractAddress) {
      return `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`;
    }
    
    if (nft.contract && nft.contract.address) {
      return `${nft.contract.address.slice(0, 6)}...${nft.contract.address.slice(-4)}`;
    }
    
    return 'Unknown Collection';
  };

  return (
    <div className="nft-card" onClick={() => onClick && onClick(nft)}>
      <div className="nft-image">
        <img 
          src={getImageUrl()}
          alt={getNftName()}
          onError={handleImageError}
        />
      </div>
      <div className="nft-info">
        <h3 className="nft-name">{getNftName()}</h3>
        <p className="nft-collection">{getCollectionName()}</p>
      </div>
    </div>
  );
};

export default NftCard; 
