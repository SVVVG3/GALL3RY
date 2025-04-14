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
    
    console.log(`Processing image for NFT: ${nft.id || nft.tokenId}, raw data:`, {
      hasImage: !!nft.image,
      imageType: nft.image ? typeof nft.image : 'none',
      hasImageUrl: !!nft.imageUrl,
      hasMedia: !!nft.media,
      mediaCount: nft.media?.length || 0,
      hasMetadata: !!nft.metadata,
      metadataImageExists: !!nft.metadata?.image
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
    
    // 1. Directly use imageUrl if already provided by our processing functions
    if (nft.imageUrl && nft.imageUrl !== '/assets/placeholder-nft.svg') {
      const fixedUrl = fixIpfsUrl(nft.imageUrl);
      console.log(`Using preprocessed imageUrl: ${fixedUrl}`);
      return fixedUrl;
    }
    
    // 2. Check the Alchemy v3 image format
    if (nft.image) {
      if (typeof nft.image === 'string') {
        const fixedUrl = fixIpfsUrl(nft.image);
        console.log(`Using string image URL: ${fixedUrl}`);
        return fixedUrl;
      } else if (nft.image.gateway) {
        console.log(`Using image.gateway: ${nft.image.gateway}`);
        return nft.image.gateway;
      } else if (nft.image.url) {
        console.log(`Using image.url: ${nft.image.url}`);
        return nft.image.url;
      } else if (nft.image.originalUrl) {
        console.log(`Using image.originalUrl: ${nft.image.originalUrl}`);
        return nft.image.originalUrl;
      }
    }
    
    // 3. Check various paths where image URL might be found
    if (nft.media && nft.media.length > 0) {
      const mediaItem = nft.media[0];
      if (mediaItem.gateway) {
        console.log(`Using media[0].gateway: ${mediaItem.gateway}`);
        return mediaItem.gateway;
      } else if (mediaItem.raw) {
        const fixedUrl = fixIpfsUrl(mediaItem.raw);
        console.log(`Using media[0].raw: ${fixedUrl}`);
        return fixedUrl;
      } else if (mediaItem.uri) {
        const fixedUrl = fixIpfsUrl(mediaItem.uri);
        console.log(`Using media[0].uri: ${fixedUrl}`);
        return fixedUrl;
      }
    }
    
    // 4. Check rawImageUrl
    if (nft.rawImageUrl) {
      const fixedUrl = fixIpfsUrl(nft.rawImageUrl);
      console.log(`Using rawImageUrl: ${fixedUrl}`);
      return fixedUrl;
    }

    // 5. Check Legacy formats
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
    
    // 6. Check metadata
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
    
    // 7. Check tokenUri
    if (nft.tokenUri) {
      if (nft.tokenUri.gateway) {
        console.log(`Using tokenUri.gateway: ${nft.tokenUri.gateway}`);
        return nft.tokenUri.gateway;
      }
      if (nft.tokenUri.raw) {
        const fixedUrl = fixIpfsUrl(nft.tokenUri.raw);
        console.log(`Using tokenUri.raw: ${fixedUrl}`);
        return fixedUrl;
      }
    }
    
    // 8. Check contract and collection metadata as last resort
    if (nft.contractMetadata?.openSea?.imageUrl) {
      console.log(`Using contractMetadata.openSea.imageUrl: ${nft.contractMetadata.openSea.imageUrl}`);
      return nft.contractMetadata.openSea.imageUrl;
    }
    
    if (nft.collection?.imageUrl) {
      console.log(`Using collection.imageUrl: ${nft.collection.imageUrl}`);
      return nft.collection.imageUrl;
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