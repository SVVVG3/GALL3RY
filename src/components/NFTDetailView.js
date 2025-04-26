import React, { useState, useEffect } from 'react';
import { FaCopy, FaExternalLinkAlt, FaEthereum } from 'react-icons/fa';
import { formatAddress } from '../utils/formatters';
import { getReliableIpfsUrl } from '../services/proxyService';

const NFTDetailView = ({ nft }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [imageUrl, setImageUrl] = useState('');
  const [copiedField, setCopiedField] = useState(null);
  
  // Reset state when NFT changes
  useEffect(() => {
    if (nft) {
      setMediaLoaded(false);
      setMediaError(false);
      
      // Find best image URL and set media type
      const findBestImageUrl = () => {
        // Check various potential image sources
        const possibleSources = [
          nft.image,
          nft.image_url,
          nft.image_preview_url,
          nft.animation_url,
          nft.metadata?.image,
          nft.media?.[0]?.gateway
        ];
        
        // Find first non-empty string URL
        const bestUrl = possibleSources.find(source => 
          typeof source === 'string' && source.trim() !== ''
        );
        
        if (bestUrl) {
          const url = getReliableIpfsUrl(bestUrl);
          setImageUrl(url);
          
          // Determine media type based on URL
          if (url.match(/\.(mp4|webm|mov)($|\?)/i) || url.includes('video/')) {
            setMediaType('video');
          } else if (url.match(/\.(mp3|wav|ogg)($|\?)/i) || url.includes('audio/')) {
            setMediaType('audio');
          } else if (url.match(/\.svg($|\?)/i) || url.includes('image/svg+xml')) {
            setMediaType('svg');
          } else {
            setMediaType('image');
          }
        } else {
          setMediaError(true);
        }
      };
      
      findBestImageUrl();
    }
  }, [nft]);
  
  // Copy text to clipboard and show temporary "Copied" message
  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  // Create permalink to NFT
  const createPermalink = () => {
    if (!nft || !nft.asset_contract?.address || !nft.token_id) return '#';
    return `/nft/${nft.asset_contract.address}/${nft.token_id}`;
  };
  
  // Handle media loading events
  const handleMediaLoad = () => {
    setMediaLoaded(true);
  };
  
  const handleMediaError = () => {
    setMediaError(true);
  };
  
  // Render the NFT media based on type
  const renderMedia = () => {
    if (mediaError) {
      return <div className="nft-modal-media-placeholder">Media not available</div>;
    }
    
    if (!imageUrl) {
      return <div className="nft-modal-media-placeholder">Loading...</div>;
    }
    
    switch (mediaType) {
      case 'video':
        return (
          <video
            src={imageUrl}
            className="nft-modal-media-content"
            controls
            autoPlay
            loop
            muted
            onLoadedData={handleMediaLoad}
            onError={handleMediaError}
          />
        );
        
      case 'audio':
        return (
          <div className="nft-modal-media-with-audio">
            <div className="nft-modal-audio-placeholder">
              <FaEthereum size={80} color="rgba(255,255,255,0.2)" />
            </div>
            <audio
              src={imageUrl}
              className="nft-modal-audio"
              controls
              autoPlay
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
            />
          </div>
        );
        
      case 'svg':
        return (
          <object
            data={imageUrl}
            type="image/svg+xml"
            className="nft-modal-media-content"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
          >
            SVG not supported
          </object>
        );
        
      case 'image':
      default:
        return (
          <img
            src={imageUrl}
            alt={nft?.name || 'NFT'}
            className="nft-modal-media-content"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
          />
        );
    }
  };
  
  // Render NFT traits/attributes if present
  const renderTraits = () => {
    const traits = nft?.traits || nft?.attributes || [];
    
    if (!traits || traits.length === 0) {
      return <p>No traits found for this NFT.</p>;
    }
    
    return (
      <div className="nft-modal-traits">
        {traits.map((trait, index) => (
          <div key={index} className="nft-trait">
            <div className="trait-type">{trait.trait_type}</div>
            <div className="trait-value">{trait.value}</div>
            {trait.rarity_percentage && (
              <div className="trait-rarity">
                {(trait.rarity_percentage * 100).toFixed(2)}% have this trait
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  
  if (!nft) return null;

  return (
    <div className="nft-modal-grid">
      {/* Left side - NFT Media */}
      <div className="nft-modal-media">
        {renderMedia()}
      </div>
      
      {/* Right side - NFT Info */}
      <div className="nft-modal-info">
        <h1 className="nft-modal-title">{nft.name || `#${nft.token_id}`}</h1>
        
        {nft.collection?.name && (
          <div className="nft-modal-collection">{nft.collection.name}</div>
        )}
        
        {/* Tabs for different information sections */}
        <div className="nft-modal-tabs">
          <button 
            className={`nft-modal-tab ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          
          <button 
            className={`nft-modal-tab ${activeTab === 'properties' ? 'active' : ''}`}
            onClick={() => setActiveTab('properties')}
          >
            Properties
          </button>
          
          {nft.description && (
            <button 
              className={`nft-modal-tab ${activeTab === 'description' ? 'active' : ''}`}
              onClick={() => setActiveTab('description')}
            >
              Description
            </button>
          )}
        </div>
        
        {/* Tab content */}
        <div className="nft-modal-tab-content">
          {activeTab === 'details' && (
            <>
              <div className="nft-modal-data-grid">
                {nft.token_id && (
                  <div className="nft-modal-data-item">
                    <div className="data-label">Token ID</div>
                    <div className="data-value-with-copy">
                      <span className="data-value">{nft.token_id}</span>
                      <button 
                        className="copy-button" 
                        onClick={() => copyToClipboard(nft.token_id, 'token_id')}
                        aria-label="Copy token ID"
                      >
                        {copiedField === 'token_id' ? 'Copied!' : <FaCopy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                
                {nft.asset_contract?.address && (
                  <div className="nft-modal-data-item">
                    <div className="data-label">Contract</div>
                    <div className="data-value-with-copy">
                      <span className="data-value">{formatAddress(nft.asset_contract.address)}</span>
                      <button 
                        className="copy-button" 
                        onClick={() => copyToClipboard(nft.asset_contract.address, 'contract')}
                        aria-label="Copy contract address"
                      >
                        {copiedField === 'contract' ? 'Copied!' : <FaCopy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                
                {nft.owner?.address && (
                  <div className="nft-modal-data-item">
                    <div className="data-label">Owner</div>
                    <div className="data-value-with-copy">
                      <span className="data-value">{formatAddress(nft.owner.address)}</span>
                      <button 
                        className="copy-button" 
                        onClick={() => copyToClipboard(nft.owner.address, 'owner')}
                        aria-label="Copy owner address"
                      >
                        {copiedField === 'owner' ? 'Copied!' : <FaCopy size={14} />}
                      </button>
                    </div>
                  </div>
                )}
                
                {nft.token_standard && (
                  <div className="nft-modal-data-item">
                    <div className="data-label">Standard</div>
                    <div className="data-value">{nft.token_standard}</div>
                  </div>
                )}
                
                {nft.last_sale?.payment_token?.eth_price && (
                  <div className="nft-modal-data-item">
                    <div className="data-label">Last Sale</div>
                    <div className="data-value">
                      {nft.last_sale.payment_token.eth_price} ETH
                    </div>
                  </div>
                )}
              </div>
              
              <a href={createPermalink()} className="nft-modal-permalink">
                <FaExternalLinkAlt size={14} /> Permalink
              </a>
            </>
          )}
          
          {activeTab === 'properties' && renderTraits()}
          
          {activeTab === 'description' && nft.description && (
            <div className="nft-modal-description">
              {nft.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NFTDetailView; 