import React, { useState } from 'react';

/**
 * NftCard component for displaying a single NFT
 * @param {Object} nft - The NFT object to display
 * @param {Function} onClick - Function to call when the card is clicked
 */
const NftCard = ({ nft, onClick }) => {
  const [imageError, setImageError] = useState(false);
  
  if (!nft) return null;

  // Handle different NFT data structures
  const name = nft.name || nft.metadata?.name || nft.token_id || 'Unnamed NFT';
  const collection = nft.collection?.name || nft.contract_name || 'Unknown Collection';
  
  // Look for image in multiple possible locations
  const image = !imageError 
    ? (nft.imageUrl || nft.image || nft.metadata?.image || null)
    : null;

  // Show image loading state or error state
  const handleImageError = (e) => {
    console.error(`Failed to load image for NFT: ${name}`, e);
    setImageError(true);
    e.target.src = 'https://via.placeholder.com/300x300?text=Error+Loading';
  };

  return (
    <div className="nft-card" onClick={onClick}>
      <div className="nft-image-container">
        {image ? (
          <img 
            src={image} 
            alt={name} 
            className="nft-image"
            onError={handleImageError}
          />
        ) : (
          <div className="nft-image-placeholder">
            <span>{name.substring(0, 1).toUpperCase()}</span>
            <span className="placeholder-text">No Image</span>
          </div>
        )}
      </div>
      <div className="nft-details">
        <h3 className="nft-name">{name}</h3>
        <p className="nft-collection">{collection}</p>
      </div>
    </div>
  );
};

export default NftCard; 