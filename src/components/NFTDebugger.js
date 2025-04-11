import React, { useState } from 'react';

/**
 * Debugging component to help identify issues with NFT data
 * Can be temporarily added to NFTGrid or NFTCard to inspect data
 */
const NFTDebugger = ({ nft, title = "NFT Data Debugger" }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!nft) return <div>No NFT data to debug</div>;
  
  return (
    <div 
      style={{
        border: '1px solid #f00',
        borderRadius: '4px',
        padding: '8px',
        margin: '8px 0',
        backgroundColor: 'rgba(255, 0, 0, 0.05)',
        fontSize: '12px',
        fontFamily: 'monospace'
      }}
    >
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          cursor: 'pointer',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <span>{title}</span>
        <span>{expanded ? '▼' : '►'}</span>
      </div>
      
      {expanded && (
        <div>
          <div style={{ margin: '8px 0' }}>
            <strong>Required NFT Fields:</strong>
            <ul style={{ listStyleType: 'none', padding: '4px', margin: 0 }}>
              <li style={{ color: nft.id ? 'green' : 'red' }}>
                id: {nft.id || '[MISSING]'}
              </li>
              <li style={{ color: nft.tokenId ? 'green' : 'red' }}>
                tokenId: {nft.tokenId || '[MISSING]'}
              </li>
              <li style={{ color: nft.contractAddress ? 'green' : 'red' }}>
                contractAddress: {nft.contractAddress || '[MISSING]'}
              </li>
              <li style={{ color: nft.network ? 'green' : 'red' }}>
                network: {nft.network || '[MISSING]'}
              </li>
              <li style={{ color: nft.name ? 'green' : 'black' }}>
                name: {nft.name || '[Missing but optional]'}
              </li>
            </ul>
          </div>
          
          <div style={{ margin: '8px 0' }}>
            <strong>Media/Image:</strong>
            <ul style={{ listStyleType: 'none', padding: '4px', margin: 0 }}>
              <li style={{ color: nft.imageUrl ? 'green' : 'orange' }}>
                imageUrl: {nft.imageUrl ? 
                  <a href={nft.imageUrl} target="_blank" rel="noopener noreferrer">
                    {nft.imageUrl.substring(0, 30)}...
                  </a> : 
                  '[MISSING]'
                }
              </li>
              <li style={{ color: nft.media?.[0]?.gateway ? 'green' : 'orange' }}>
                media[0].gateway: {nft.media?.[0]?.gateway ? 
                  <a href={nft.media[0].gateway} target="_blank" rel="noopener noreferrer">
                    {nft.media[0].gateway.substring(0, 30)}...
                  </a> : 
                  '[MISSING]'
                }
              </li>
            </ul>
          </div>
          
          <div style={{ margin: '8px 0' }}>
            <strong>Collection:</strong>
            <ul style={{ listStyleType: 'none', padding: '4px', margin: 0 }}>
              <li style={{ color: nft.collection?.name ? 'green' : 'black' }}>
                collection.name: {nft.collection?.name || '[Missing but optional]'}
              </li>
              <li style={{ color: nft.collection?.address ? 'green' : 'orange' }}>
                collection.address: {nft.collection?.address || '[MISSING]'}
              </li>
            </ul>
          </div>
          
          <div style={{ margin: '8px 0' }}>
            <details>
              <summary>Raw Data</summary>
              <pre 
                style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-all',
                  maxHeight: '200px',
                  overflow: 'auto',
                  background: '#f5f5f5',
                  padding: '4px',
                  fontSize: '10px'
                }}
              >
                {JSON.stringify(nft, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
};

export default NFTDebugger; 