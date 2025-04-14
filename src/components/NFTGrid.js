import React, { useState } from 'react';
import '../styles/NFTGrid.css';

/**
 * Simple grid component to display NFTs with enhanced media handling
 */
const NFTGrid = ({ nfts = [] }) => {
  // Track which NFTs have failed to load for better fallback handling
  const [failedImages, setFailedImages] = useState({});
  const [mediaStatus, setMediaStatus] = useState({});

  // Handle broken/missing images with better fallback strategy
  const handleImageError = (e) => {
    const img = e.target;
    const nftId = img.getAttribute('data-nftid');
    const currentSrc = img.src;
    console.log(`❌ Image failed to load for NFT ${nftId}:`, currentSrc);
    
    setMediaStatus(prev => ({
      ...prev,
      [nftId]: { 
        ...prev[nftId],
        failedUrls: [...(prev[nftId]?.failedUrls || []), currentSrc] 
      }
    }));
    
    // Try proxy if not already proxied
    if (!currentSrc.includes('/api/image-proxy') && 
        !currentSrc.includes('/assets/placeholder-nft.svg')) {
      console.log(`🔄 Trying proxy for NFT ${nftId}`);
      const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(currentSrc)}`;
      img.src = proxiedUrl;
      return;
    }
    
    // If proxy also failed or we've already tried, fall back to placeholder
    console.log(`🔄 Falling back to placeholder for NFT ${nftId}`);
    img.onerror = null; // Prevent infinite loop
    img.src = '/assets/placeholder-nft.svg';
    
    // Mark this NFT as having completely failed images
    setFailedImages(prev => ({
      ...prev,
      [nftId]: true
    }));
  };

  // Handle successful image loads for tracking
  const handleImageSuccess = (e) => {
    const img = e.target;
    const nftId = img.getAttribute('data-nftid');
    console.log(`✅ Image loaded successfully for NFT ${nftId}:`, img.src);
    
    setMediaStatus(prev => ({
      ...prev,
      [nftId]: { 
        ...prev[nftId],
        loaded: true,
        workingUrl: img.src
      }
    }));
  };
  
  // Determine content type based on URL and metadata
  const getContentType = (nft, url = '') => {
    if (!url) return 'image';
    
    // Check for video file extensions
    if (url.match(/\.(mp4|webm|ogv|mov)($|\?)/i)) return 'video';
    
    // Check for video MIME types in metadata
    if (nft.media && Array.isArray(nft.media)) {
      const videoMedia = nft.media.find(m => 
        m?.format?.includes('video') || 
        m?.mimeType?.includes('video')
      );
      if (videoMedia) return 'video';
    }
    
    // Check for SVG content
    if (url.match(/\.svg($|\?)/i) || url.includes('data:image/svg+xml')) return 'svg';
    
    // Default to image
    return 'image';
  };

  // Get the best available image URL with enhanced logic for Alchemy v3 API
  const getMediaUrl = (nft) => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    const urlCandidates = [];
    
    // Debug: Log the image structure to diagnose rendering issues
    console.log(`Processing NFT media for ${nft.name || nft.tokenId}:`, {
      hasImage: !!nft.image,
      imageType: nft.image ? typeof nft.image : 'none',
      mediaCount: nft.media ? nft.media.length : 0
    });
    
    // Handle Alchemy v3 API structure first - most reliable source
    if (nft.image) {
      if (typeof nft.image === 'object') {
        // Process object structure: Alchemy v3 API 
        if (nft.image.cachedUrl) urlCandidates.push(nft.image.cachedUrl);
        if (nft.image.thumbnailUrl) urlCandidates.push(nft.image.thumbnailUrl);
        if (nft.image.pngUrl) urlCandidates.push(nft.image.pngUrl);
        if (nft.image.originalUrl) urlCandidates.push(nft.image.originalUrl);
        if (nft.image.gateway) urlCandidates.push(nft.image.gateway);
      } else if (typeof nft.image === 'string') {
        // Direct image URL
        urlCandidates.push(nft.image);
      }
    }
    
    // Check media array for videos or additional formats - Alchemy v3 specific
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      nft.media.forEach(mediaItem => {
        if (!mediaItem) return;
        
        // Traverse all potential media URLs
        if (mediaItem.gateway) urlCandidates.push(mediaItem.gateway);
        if (mediaItem.thumbnailUrl) urlCandidates.push(mediaItem.thumbnailUrl);
        if (mediaItem.cachedUrl) urlCandidates.push(mediaItem.cachedUrl);
        if (mediaItem.raw) urlCandidates.push(mediaItem.raw);
        if (mediaItem.uri) urlCandidates.push(mediaItem.uri);
      });
    }
    
    // Check raw metadata which often contains the original URLs
    if (nft.raw && nft.raw.metadata) {
      if (nft.raw.metadata.image) urlCandidates.push(nft.raw.metadata.image);
      if (nft.raw.metadata.animation_url) urlCandidates.push(nft.raw.metadata.animation_url);
      if (nft.raw.metadata.image_url) urlCandidates.push(nft.raw.metadata.image_url);
    }
    
    // Add other potential sources
    if (nft.imageUrl) urlCandidates.push(nft.imageUrl);
    if (nft.rawImageUrl) urlCandidates.push(nft.rawImageUrl);
    
    // Metadata image URLs
    if (nft.metadata) {
      if (nft.metadata.image) urlCandidates.push(nft.metadata.image);
      if (nft.metadata.image_url) urlCandidates.push(nft.metadata.image_url);
      if (nft.metadata.animation_url) urlCandidates.push(nft.metadata.animation_url);
    }
    
    // OpenSea or collection data
    if (nft.contract && nft.contract.openSea && nft.contract.openSea.imageUrl) {
      urlCandidates.push(nft.contract.openSea.imageUrl);
    }
    
    if (nft.contractMetadata?.openSea?.imageUrl) {
      urlCandidates.push(nft.contractMetadata.openSea.imageUrl);
    }
    
    // Filter out null/undefined and deduplicate
    const uniqueUrls = [...new Set(urlCandidates.filter(url => url))];
    
    if (uniqueUrls.length === 0) {
      console.log(`No image URLs found for NFT: ${nft.name || nft.tokenId}`);
      return '/assets/placeholder-nft.svg';
    }
    
    // Get the first URL and process it to fix common issues
    let selectedUrl = uniqueUrls[0];
    
    // Fix IPFS URLs - try Cloudflare gateway
    if (selectedUrl.startsWith('ipfs://')) {
      selectedUrl = selectedUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    
    // Fix Arweave URLs
    if (selectedUrl.startsWith('ar://')) {
      selectedUrl = selectedUrl.replace('ar://', 'https://arweave.net/');
    }
    
    // Fix HTTP URLs - Try HTTPS version to avoid mixed content issues
    if (selectedUrl.startsWith('http://')) {
      selectedUrl = selectedUrl.replace('http://', 'https://');
    }
    
    console.log(`Selected media URL for ${nft.name || nft.tokenId}: ${selectedUrl}`);
    return selectedUrl;
  };

  // Get the NFT name with fallbacks
  const getNftName = (nft) => {
    if (!nft) return 'Unknown NFT';
    
    if (nft.name) return nft.name;
    if (nft.title) return nft.title;
    if (nft.metadata && nft.metadata.name) return nft.metadata.name;
    
    // Show token ID if we can't find a name
    if (nft.tokenId) return `Token #${nft.tokenId}`;
    
    return 'Unnamed NFT';
  };

  // Get collection name with fallbacks
  const getCollectionName = (nft) => {
    if (!nft) return 'Unknown Collection';
    
    // Try different paths where collection name might be found
    if (nft.collection && nft.collection.name) return nft.collection.name;
    if (nft.contract && nft.contract.name) return nft.contract.name;
    if (nft.contractMetadata && nft.contractMetadata.name) return nft.contractMetadata.name;
    
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
          const nftId = nft.id || nft.tokenId || index;
          const mediaUrl = getMediaUrl(nft);
          const contentType = getContentType(nft, mediaUrl);
          
          return (
            <div key={nftId} className="nft-item">
              <div className="nft-card">
                <div className="nft-image">
                  {contentType === 'video' ? (
                    // Video content renderer
                    <video 
                      src={mediaUrl}
                      alt={getNftName(nft)}
                      poster="/assets/video-placeholder.svg"
                      controls
                      muted
                      loop
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        backgroundColor: '#f0f0f0'
                      }}
                      data-nftid={nftId}
                      onError={handleImageError}
                      onLoadedData={handleImageSuccess}
                      crossOrigin="anonymous"
                    />
                  ) : contentType === 'svg' ? (
                    // SVG renderer - special handling
                    <object
                      data={mediaUrl}
                      type="image/svg+xml"
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        objectFit: 'contain',
                        backgroundColor: '#f0f0f0'
                      }}
                    >
                      {/* Fallback if SVG fails */}
                      <img 
                        src="/assets/placeholder-nft.svg"
                        alt={getNftName(nft)}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain'
                        }}
                        data-nftid={nftId}
                      />
                    </object>
                  ) : (
                    // Regular image renderer
                    <img 
                      src={mediaUrl}
                      alt={getNftName(nft)}
                      onError={handleImageError}
                      onLoad={handleImageSuccess}
                      data-nftid={nftId}
                      loading="lazy"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        objectPosition: 'center',
                        backgroundColor: '#f0f0f0'
                      }}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                    />
                  )}
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