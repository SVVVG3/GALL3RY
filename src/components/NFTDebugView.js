import React, { useState } from 'react';
import '../styles/nft-unified.css';

/**
 * Helper function to safely extract an image URL from various possible locations
 */
const extractImageUrl = (nft) => {
  // Check in different locations
  const sources = [
    // Media objects (Alchemy format)
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
    nft?.media?.[0]?.uri,
    nft?.media?.[0]?.url,
    
    // Direct images
    typeof nft?.image === 'string' ? nft.image : null,
    nft?.image?.cachedUrl,
    nft?.image?.uri,
    nft?.image?.url,
    
    // Image URL objects
    typeof nft?.imageUrl === 'string' ? nft.imageUrl : null,
    nft?.imageUrl?.cachedUrl,
    
    // Raw metadata
    typeof nft?.rawMetadata?.image === 'string' ? nft.rawMetadata.image : null,
    typeof nft?.rawMetadata?.image === 'object' ? nft.rawMetadata.image.url || nft.rawMetadata.image.uri : null,
    
    // Metadata image
    typeof nft?.metadata?.image === 'string' ? nft.metadata.image : null
  ];
  
  // Find first valid URL
  return sources.find(url => url) || 'No image URL found';
};

/**
 * Debug view component for NFT data
 * Displays raw NFT data for debugging purposes
 */
const NFTDebugView = ({ nfts, isLoading }) => {
  const [expandedNft, setExpandedNft] = useState(null);
  
  // Toggle expanded view for a specific NFT
  const toggleExpand = (index) => {
    if (expandedNft === index) {
      setExpandedNft(null);
    } else {
      setExpandedNft(index);
    }
  };
  
  // Log full NFT data to console
  const logNftData = (nft) => {
    console.log('Full NFT data:', nft);
  };
  
  if (isLoading) {
    return (
      <div className="nft-loading">
        <div className="loading-spinner"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }
  
  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-empty">
        <p>No NFTs to display</p>
      </div>
    );
  }
  
  // For debugging, show a table of sample NFT data
  return (
    <div style={{ padding: '20px' }}>
      <h2>NFT Debug View - {nfts.length} NFTs found</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>First 5 NFTs</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Collection</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Image URL</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Contract</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Type</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {nfts.slice(0, 5).map((nft, index) => {
              // Extract key data for debugging
              const name = nft?.name || nft?.title || nft?.rawMetadata?.name || `#${nft?.tokenId || nft?.token_id || ''}`;
              const collection = nft?.collectionName || nft?.collection?.name || nft?.contract?.name || nft?.contractMetadata?.name || nft?.contractName || '-';
              const imageUrl = extractImageUrl(nft);
              const contractAddress = nft?.contract?.address || nft?.contractAddress || '-';
              
              // Determine media type
              let mediaType = 'unknown';
              if (typeof imageUrl === 'string') {
                if (imageUrl.match(/\.(mp4|webm|mov)($|\?)/i)) {
                  mediaType = 'video';
                } else if (imageUrl.match(/\.(mp3|wav|ogg)($|\?)/i)) {
                  mediaType = 'audio';
                } else {
                  mediaType = 'image';
                }
              }
              
              return (
                <React.Fragment key={`nft-debug-${index}`}>
                  <tr>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{name}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{collection}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {imageUrl}
                    </td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{contractAddress}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{mediaType}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                      <button 
                        onClick={() => toggleExpand(index)}
                        style={{ marginRight: '8px', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        {expandedNft === index ? 'Hide Details' : 'Show Details'}
                      </button>
                      <button 
                        onClick={() => logNftData(nft)}
                        style={{ padding: '4px 8px', cursor: 'pointer' }}
                      >
                        Log to Console
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded view */}
                  {expandedNft === index && (
                    <tr>
                      <td colSpan="6" style={{ border: '1px solid #ddd', padding: '8px', backgroundColor: '#f9f9f9' }}>
                        <h4>Detailed Image Data:</h4>
                        <ul style={{ margin: 0, padding: '0 0 0 20px' }}>
                          <li>nft.image (raw): {JSON.stringify(nft.image)}</li>
                          <li>nft.imageUrl (raw): {JSON.stringify(nft.imageUrl)}</li>
                          <li>nft.media[0]?.gateway: {nft.media?.[0]?.gateway || 'undefined'}</li>
                          <li>nft.media[0]?.raw: {nft.media?.[0]?.raw || 'undefined'}</li>
                          <li>nft.rawMetadata?.image: {typeof nft.rawMetadata?.image === 'string' 
                              ? nft.rawMetadata.image 
                              : JSON.stringify(nft.rawMetadata?.image || 'undefined')}</li>
                        </ul>
                        <div style={{ marginTop: '10px' }}>
                          <h4>Preview:</h4>
                          {mediaType === 'image' && (
                            <img 
                              src={imageUrl} 
                              alt={name} 
                              style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #ddd' }}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          {mediaType === 'video' && (
                            <video 
                              src={imageUrl} 
                              controls 
                              style={{ maxWidth: '200px', maxHeight: '200px', border: '1px solid #ddd' }}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          {mediaType === 'unknown' && (
                            <div>Cannot preview this media type</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <button 
        onClick={() => console.log('All NFTs:', nfts)}
        style={{ padding: '10px 16px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Log Full NFT Data to Console
      </button>
    </div>
  );
};

export default NFTDebugView; 