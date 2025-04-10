import React from 'react';

/**
 * NftCard component for displaying a single NFT
 * @param {Object} nft - The NFT object to display
 * @param {Function} onClick - Function to call when the card is clicked
 */
const NftCard = ({ nft, onClick }) => {
  if (!nft) return null;

  // Handle different NFT data structures
  const name = nft.name || nft.metadata?.name || nft.token_id || 'Unnamed NFT';
  const image = nft.image || nft.metadata?.image || 'https://via.placeholder.com/300x300?text=No+Image';
  const collection = nft.collection?.name || nft.contract_name || 'Unknown Collection';

  return (
    <div className="nft-card" onClick={onClick}>
      <div className="nft-image-container">
        <img 
          src={image} 
          alt={name} 
          className="nft-image"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/300x300?text=Error+Loading';
          }}
        />
      </div>
      <div className="nft-details">
        <h3 className="nft-name">{name}</h3>
        <p className="nft-collection">{collection}</p>
      </div>
    </div>
  );
};

export default NftCard; 