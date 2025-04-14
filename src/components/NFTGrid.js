import React from 'react';
import '../styles/NFTGrid.css';

/**
 * Simple grid component to display NFTs
 */
const NftGrid = ({ nfts = [] }) => {
  // Handle broken/missing images
  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = '/assets/placeholder-nft.svg';
  };

  // Get the best available image URL from the NFT
  const getImageUrl = (nft) => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    // Check various paths where image URL might be found
    if (nft.media && nft.media.gateway) {
      return nft.media.gateway;
    }
    
    if (nft.mediasV3?.images?.edges?.[0]?.node?.thumbnail) {
      return nft.mediasV3.images.edges[0].node.thumbnail;
    }
    
    if (nft.mediasV3?.images?.edges?.[0]?.node?.original) {
      return nft.mediasV3.images.edges[0].node.original;
    }
    
    if (nft.media && nft.media.thumbnail) {
      return nft.media.thumbnail;
    }
    
    if (nft.media && nft.media.url) {
      return nft.media.url;
    }
    
    // If we have image data but no proper URL structure
    if (typeof nft.image === 'string' && nft.image.startsWith('http')) {
      return nft.image;
    }
    
    // Return placeholder if no valid image URL is found
    return '/assets/placeholder-nft.svg';
  };

  // Get the NFT name with fallbacks
  const getNftName = (nft) => {
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
  const getCollectionName = (nft) => {
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
    <div className="nft-grid">
      {nfts.length > 0 ? (
        nfts.map((nft, index) => (
          <div key={`${nft.id || nft.tokenId || index}`} className="nft-item">
            <div className="nft-card">
              <div className="nft-image">
                <img 
                  src={getImageUrl(nft)}
                  alt={getNftName(nft)}
                  onError={handleImageError}
                />
              </div>
              <div className="nft-info">
                <h3 className="nft-name">{getNftName(nft)}</h3>
                <p className="nft-collection">{getCollectionName(nft)}</p>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="no-nfts-message">
          <p>No NFTs to display</p>
        </div>
      )}
    </div>
  );
};

export default NftGrid; 