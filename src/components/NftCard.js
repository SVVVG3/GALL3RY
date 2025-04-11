import React from 'react';
import './NFTImage.css';
import './NFTCard.css';
import NFTImage from './NFTImage';

const NFTCard = ({ nft }) => {
  // Format ETH value
  const formatEthValue = (value) => {
    if (!value || value === '0') return '—';
    
    const num = parseFloat(value);
    if (isNaN(num)) return '—';
    
    if (num < 0.01) return '<0.01 ETH';
    return `${num.toFixed(2)} ETH`;
  };

  // Determine network from contract address if not provided
  const determineNetwork = (address) => {
    // Common network prefixes
    if (address && address.startsWith('0x7f5')) return 'optimism';
    if (address && address.startsWith('0x42161')) return 'arbitrum';
    if (address && address.startsWith('0x89')) return 'polygon';
    if (address && address.startsWith('0x2105')) return 'base';
    return 'ethereum'; // Default to ethereum
  };

  const network = nft.network || determineNetwork(nft.contractAddress);

  // Get network color
  const getNetworkColor = (network) => {
    const colors = {
      ethereum: '#627EEA',
      base: '#0052FF',
      optimism: '#FF0420',
      arbitrum: '#2D374B',
      polygon: '#8247E5',
    };
    return colors[network.toLowerCase()] || '#888888';
  };

  // Get blockchain explorer URL
  const getExplorerUrl = (network, address) => {
    const explorers = {
      ethereum: `https://etherscan.io/token/${address}`,
      base: `https://basescan.org/token/${address}`,
      optimism: `https://optimistic.etherscan.io/token/${address}`,
      arbitrum: `https://arbiscan.io/token/${address}`,
      polygon: `https://polygonscan.com/token/${address}`,
    };
    return explorers[network.toLowerCase()] || `https://etherscan.io/token/${address}`;
  };

  return (
    <div className="nft-card">
      <div className="nft-card-image-container">
        <NFTImage nft={nft} height={250} usePlaceholder={true} />
        <div 
          className="nft-card-network-badge"
          style={{ backgroundColor: getNetworkColor(network) }}
        >
          {network.charAt(0).toUpperCase() + network.slice(1)}
        </div>
      </div>

      <div className="nft-card-details">
        <div className="nft-card-title">
          <h3 title={nft.name || `NFT #${nft.tokenId}`}>
            {nft.name || `NFT #${nft.tokenId}`}
          </h3>
          
          <a 
            href={getExplorerUrl(network, nft.contractAddress)} 
            target="_blank"
            rel="noopener noreferrer"
            className="nft-card-explorer-link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>

        <div className="nft-card-collection">
          {nft.collection?.name || 'Unknown Collection'}
        </div>

        <div className="nft-card-token-id">
          ID: {nft.tokenId}
        </div>

        <div className="nft-card-value">
          {formatEthValue(nft.estimatedValue)}
        </div>
      </div>
    </div>
  );
};

export default NFTCard; 