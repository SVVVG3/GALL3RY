import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

/**
 * NFT Detail page component for viewing a specific NFT
 */
const NFTDetailPage = () => {
  const { contractAddress, tokenId } = useParams();
  const [loading, setLoading] = useState(true);
  const [nft, setNft] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchNftDetails = async () => {
      try {
        setLoading(true);
        
        // For now, just use the contract address and token ID as placeholders
        // In a real implementation, you would fetch the NFT details from the API
        setNft({
          contractAddress,
          tokenId,
          name: `NFT #${tokenId}`,
          description: 'This is a placeholder description for this NFT.',
          imageUrl: 'https://via.placeholder.com/400',
          collection: {
            name: 'Sample Collection',
          },
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching NFT details:', err);
        setError('Failed to load NFT details');
        setLoading(false);
      }
    };
    
    if (contractAddress && tokenId) {
      fetchNftDetails();
    }
  }, [contractAddress, tokenId]);
  
  if (loading) {
    return <div className="loading">Loading NFT details...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  if (!nft) {
    return <div className="not-found">NFT not found</div>;
  }
  
  return (
    <div className="nft-detail-page">
      <div className="nft-image-container">
        <img src={nft.imageUrl} alt={nft.name} className="nft-image" />
      </div>
      
      <div className="nft-info">
        <h1>{nft.name}</h1>
        <p className="collection-name">{nft.collection.name}</p>
        
        <div className="nft-description">
          <h2>Description</h2>
          <p>{nft.description}</p>
        </div>
        
        <div className="nft-details">
          <h2>Details</h2>
          <p><strong>Contract Address:</strong> {contractAddress}</p>
          <p><strong>Token ID:</strong> {tokenId}</p>
        </div>
        
        <div className="back-link">
          <Link to="/">Back to Gallery</Link>
        </div>
      </div>
    </div>
  );
};

export default NFTDetailPage; 