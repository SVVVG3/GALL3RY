import React from 'react';
import NftCard from './NftCard';
import styled from 'styled-components';

/**
 * NftGrid component for displaying a grid of NFTs
 * @param {Array} nfts - Array of NFT objects to display
 * @param {Function} onNftClick - Function to call when an NFT is clicked
 * @param {boolean} loading - Whether the NFTs are loading
 * @param {string} emptyMessage - Message to display when there are no NFTs
 */
const NftGrid = ({ nfts = [], onNftClick, loading = false, emptyMessage = 'No NFTs found' }) => {
  if (loading) {
    return (
      <LoadingContainer>
        <LoadingSpinner />
        <p>Loading NFTs...</p>
      </LoadingContainer>
    );
  }

  // Enhanced validation for nfts array
  if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
    console.warn('NftGrid received invalid NFT data:', nfts);
    return (
      <EmptyStateContainer>
        <p>{emptyMessage}</p>
      </EmptyStateContainer>
    );
  }

  // Filter out any null or undefined nfts to prevent rendering errors
  const validNfts = nfts.filter(nft => nft !== null && nft !== undefined);
  
  if (validNfts.length === 0) {
    console.warn('NftGrid filtered out all invalid NFTs from array');
    return (
      <EmptyStateContainer>
        <p>{emptyMessage}</p>
      </EmptyStateContainer>
    );
  }

  return (
    <GridContainer>
      {validNfts.map((nft, index) => (
        <NftCard 
          key={`${nft.collection?.address || 'unknown'}-${nft.tokenId || index}-${index}`}
          nft={nft}
          onClick={onNftClick}
          disabled={false}
        />
      ))}
    </GridContainer>
  );
};

// Styled components
const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
  margin: 1.5rem 0;
  
  @media (max-width: 1200px) {
    grid-template-columns: repeat(3, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: repeat(1, 1fr);
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 0;
  color: #666;
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #3498db;
  animation: spin 1s ease-in-out infinite;
  margin-bottom: 1rem;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const EmptyStateContainer = styled.div`
  text-align: center;
  padding: 3rem 0;
  color: #666;
  font-size: 1.1rem;
`;

export default NftGrid; 