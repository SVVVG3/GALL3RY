import React from 'react';

/**
 * NFT Debug View Component
 * 
 * A simple component to display raw NFT data for debugging purposes
 */
const NFTDebugView = ({ nfts = [], isLoading = false }) => {
  if (isLoading) {
    return <div>Loading NFTs...</div>;
  }
  
  if (!nfts || nfts.length === 0) {
    return <div>No NFTs to display</div>;
  }
  
  return (
    <div style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>NFT Debug Information</h3>
      <div>Total NFTs: {nfts.length}</div>
      
      <div style={{ marginTop: '10px' }}>
        <h4>Sample NFT Data (first item):</h4>
        <div style={{ 
          backgroundColor: '#fff', 
          padding: '10px', 
          border: '1px solid #ddd', 
          borderRadius: '4px',
          maxHeight: '300px',
          overflow: 'auto',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          <pre>{JSON.stringify(nfts[0], null, 2)}</pre>
        </div>
      </div>
      
      <div style={{ marginTop: '10px' }}>
        <h4>Available NFT Properties (first 5 items):</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Index</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Collection</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Image URL</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Contract</th>
            </tr>
          </thead>
          <tbody>
            {nfts.slice(0, 5).map((nft, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{index}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{nft.name || nft.title || `#${nft.tokenId || nft.token_id || ''}`}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {nft.collection?.name || nft.contract?.name || nft.contractMetadata?.name || ''}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {(nft.image || 
                    nft.imageUrl || 
                    nft.media?.[0]?.gateway || 
                    nft.rawMetadata?.image || 
                    ''
                  ).substring(0, 30)}...
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {(nft.contractAddress || nft.contract?.address || '').substring(0, 10)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => console.log('Full NFT data:', nfts)}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#0070f3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Log Full NFT Data to Console
        </button>
      </div>
    </div>
  );
};

export default NFTDebugView; 