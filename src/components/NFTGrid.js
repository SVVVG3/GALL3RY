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
    const img = e.target;
    const nftId = img.getAttribute('data-nftid');
    console.log(`Image failed to load for NFT ${nftId}:`, img.src);
    
    // If the image URL is IPFS or similar, try alternative gateways
    if (img.src.includes('ipfs')) {
      // Try alternative gateways if the current one failed
      const currentGateway = new URL(img.src).hostname;
      console.log(`IPFS image failed from gateway ${currentGateway}, trying alternatives`);
      
      // List of alternative IPFS gateways
      const ipfsGateways = [
        'https://cloudflare-ipfs.com/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://gateway.pinata.cloud/ipfs/'
      ];
      
      // Get the CID from the URL
      const matches = img.src.match(/ipfs\/([a-zA-Z0-9]+)/);
      if (matches && matches[1]) {
        const cid = matches[1];
        
        // Try a different gateway that hasn't been used yet
        for (const gateway of ipfsGateways) {
          if (!img.src.includes(gateway)) {
            console.log(`Trying alternative IPFS gateway: ${gateway} for CID ${cid}`);
            img.src = `${gateway}${cid}`;
            return; // Try this gateway first
          }
        }
      }
    }
    
    // If we've tried all gateways or it's not an IPFS URL, use placeholder
    console.log(`Falling back to placeholder for NFT ${nftId}`);
    img.onerror = null; // Prevent infinite loop
    img.src = '/assets/placeholder-nft.svg';
  };

  // Get the best available image URL from the NFT
  const getImageUrl = (nft) => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    // Log the NFT data for debugging
    console.log(`Processing image for NFT: ${nft.id || nft.tokenId}, raw data:`, {
      hasImage: !!nft.image,
      imageType: nft.image ? typeof nft.image : 'none',
      imageGateway: nft.image?.gateway,
      cachedUrl: nft.image?.cachedUrl,
      pngUrl: nft.image?.pngUrl,
      thumbnailUrl: nft.image?.thumbnailUrl,
      hasImageUrl: !!nft.imageUrl,
      rawImageUrl: nft.rawImageUrl,
      hasMedia: !!nft.media,
      mediaCount: Array.isArray(nft.media) ? nft.media.length : 'not array',
      hasMetadata: !!nft.metadata,
      metadataImage: !!nft.metadata?.image
    });
    
    // Helper function to fix IPFS URLs
    const fixIpfsUrl = (url) => {
      if (!url) return null;
      
      // Fix IPFS URLs
      if (url.startsWith('ipfs://')) {
        return url.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
      }
      
      // Fix Arweave URLs
      if (url.startsWith('ar://')) {
        return url.replace('ar://', 'https://arweave.net/');
      }
      
      return url;
    };
    
    // 1. Best case: Use provided imageUrl from NFTContext processing
    if (nft.imageUrl && nft.imageUrl !== '/assets/placeholder-nft.svg') {
      console.log(`Using processed imageUrl: ${nft.imageUrl}`);
      return nft.imageUrl;
    }
    
    // 2. Try rawImageUrl as backup
    if (nft.rawImageUrl && nft.rawImageUrl !== '/assets/placeholder-nft.svg') {
      console.log(`Using rawImageUrl: ${nft.rawImageUrl}`);
      return nft.rawImageUrl;
    }
    
    // 3. Try Alchemy V3 image format
    if (nft.image) {
      // Try various image URL properties from Alchemy v3 format
      if (nft.image.gateway) {
        console.log(`Using image.gateway: ${nft.image.gateway}`);
        return nft.image.gateway;
      }
      
      if (nft.image.thumbnailUrl) {
        console.log(`Using image.thumbnailUrl: ${nft.image.thumbnailUrl}`);
        return nft.image.thumbnailUrl;
      }
      
      if (nft.image.cachedUrl) {
        console.log(`Using image.cachedUrl: ${nft.image.cachedUrl}`);
        return nft.image.cachedUrl;
      }
      
      if (nft.image.pngUrl) {
        console.log(`Using image.pngUrl: ${nft.image.pngUrl}`);
        return nft.image.pngUrl;
      }
      
      if (typeof nft.image === 'string') {
        const fixedUrl = fixIpfsUrl(nft.image);
        console.log(`Using string image URL: ${fixedUrl}`);
        return fixedUrl;
      }
    }
    
    // 4. Try media array
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      // Try to find first media item with valid image URL
      for (const mediaItem of nft.media) {
        if (!mediaItem) continue;
        
        if (mediaItem.gateway) {
          console.log(`Using media item gateway: ${mediaItem.gateway}`);
          return mediaItem.gateway;
        }

        if (mediaItem.thumbnailUrl) {
          console.log(`Using media item thumbnailUrl: ${mediaItem.thumbnailUrl}`);
          return mediaItem.thumbnailUrl;
        }
        
        if (mediaItem.cachedUrl) {
          console.log(`Using media item cachedUrl: ${mediaItem.cachedUrl}`);
          return mediaItem.cachedUrl;
        }
        
        if (mediaItem.raw) {
          const fixedUrl = fixIpfsUrl(mediaItem.raw);
          console.log(`Using media item raw: ${fixedUrl}`);
          return fixedUrl;
        }
        
        if (mediaItem.thumbnail) {
          console.log(`Using media item thumbnail: ${mediaItem.thumbnail}`);
          return mediaItem.thumbnail;
        }
        
        if (mediaItem.uri) {
          const fixedUrl = fixIpfsUrl(mediaItem.uri);
          console.log(`Using media item uri: ${fixedUrl}`);
          return fixedUrl;
        }
      }
    }
    
    // 5. Try metadata
    if (nft.metadata) {
      if (nft.metadata.image) {
        const fixedUrl = fixIpfsUrl(nft.metadata.image);
        console.log(`Using metadata.image: ${fixedUrl}`);
        return fixedUrl;
      }
      
      if (nft.metadata.image_url) {
        const fixedUrl = fixIpfsUrl(nft.metadata.image_url);
        console.log(`Using metadata.image_url: ${fixedUrl}`);
        return fixedUrl;
      }
    }
    
    // 6. Try tokenUri
    if (nft.tokenUri) {
      if (nft.tokenUri.gateway) {
        console.log(`Using tokenUri.gateway: ${nft.tokenUri.gateway}`);
        return nft.tokenUri.gateway;
      }
    }
    
    // 7. Last resort - contract metadata
    if (nft.contractMetadata?.openSea?.imageUrl) {
      console.log(`Using contractMetadata.openSea.imageUrl: ${nft.contractMetadata.openSea.imageUrl}`);
      return nft.contractMetadata.openSea.imageUrl;
    }
    
    // No image found - use placeholder
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
          console.log(`Rendering NFT ${index}: ${getNftName(nft) || nft.id} with image: ${imageUrl}`);
          
          return (
            <div key={`${nft.id || nft.tokenId || index}`} className="nft-item">
              <div className="nft-card">
                <div className="nft-image">
                  <img 
                    src={imageUrl}
                    alt={getNftName(nft)}
                    onError={handleImageError}
                    data-nftid={nft.id || nft.tokenId || index}
                    loading="lazy"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
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