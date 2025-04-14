import React from 'react';
import '../styles/NFTGrid.css';

/**
 * Simple grid component to display NFTs
 */
const NFTGrid = ({ nfts = [] }) => {
  // Log what's being received by the grid
  console.log(`NFTGrid rendering with ${nfts?.length || 0} NFTs:`, 
    nfts?.length > 0 ? nfts[0] : 'No NFTs');

  // Handle broken/missing images
  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = '/assets/placeholder-nft.svg';
  };

  // Get the best available image URL from the NFT
  const getImageUrl = (nft) => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    // Directly use imageUrl if already provided by our processing functions
    if (nft.imageUrl) {
      console.log(`Using preprocessed imageUrl: ${nft.imageUrl}`);
      return nft.imageUrl;
    }
    
    // Check the Alchemy v3 image format
    if (nft.image) {
      if (typeof nft.image === 'string') {
        console.log(`Using string image URL: ${nft.image}`);
        return nft.image;
      } else if (nft.image.gateway) {
        console.log(`Using image.gateway: ${nft.image.gateway}`);
        return nft.image.gateway;
      } else if (nft.image.url) {
        console.log(`Using image.url: ${nft.image.url}`);
        return nft.image.url;
      }
    }
    
    // Check various paths where image URL might be found
    if (nft.media && nft.media.length > 0) {
      const mediaItem = nft.media[0];
      if (mediaItem.gateway) {
        console.log(`Using media[0].gateway: ${mediaItem.gateway}`);
        return mediaItem.gateway;
      } else if (mediaItem.raw) {
        console.log(`Using media[0].raw: ${mediaItem.raw}`);
        return mediaItem.raw;
      } else if (mediaItem.uri) {
        console.log(`Using media[0].uri: ${mediaItem.uri}`);
        return mediaItem.uri;
      }
    }
    
    if (nft.rawImageUrl) {
      console.log(`Using rawImageUrl: ${nft.rawImageUrl}`);
      return nft.rawImageUrl;
    }

    // Legacy formats
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
    
    // Check metadata
    if (nft.metadata && nft.metadata.image) {
      console.log(`Using metadata.image: ${nft.metadata.image}`);
      return nft.metadata.image;
    }
    
    // Fix IPFS URLs if needed
    if (nft.tokenUri && nft.tokenUri.gateway) {
      console.log(`Using tokenUri.gateway: ${nft.tokenUri.gateway}`);
      return nft.tokenUri.gateway;
    }
    
    console.log(`No image found for NFT: ${nft.id || nft.tokenId}, using placeholder`);
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
        nfts.map((nft, index) => {
          // Get image URL with logging
          const imageUrl = getImageUrl(nft);
          console.log(`Rendering NFT ${index}: ${nft.name || nft.id} with image: ${imageUrl}`);
          
          return (
            <div key={`${nft.id || nft.tokenId || index}`} className="nft-item">
              <div className="nft-card">
                <div className="nft-image">
                  <img 
                    src={imageUrl}
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
          );
        })
      ) : (
        <div className="no-nfts-message">
          <p>No NFTs to display</p>
        </div>
      )}
    </div>
  );
};

export default NFTGrid; 