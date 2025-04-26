import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NFTCollectionGrid from '../components/NFTCollectionGrid';
import { fetchCollectionNFTs } from '../services/nftService';
import '../styles/nft-unified.css';

const CollectionPage = () => {
  const { collectionSlug } = useParams();
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collectionInfo, setCollectionInfo] = useState(null);
  
  useEffect(() => {
    const loadCollection = async () => {
      if (!collectionSlug) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const { assets, collectionData } = await fetchCollectionNFTs(collectionSlug);
        
        setNfts(assets);
        setCollectionInfo(collectionData);
      } catch (err) {
        console.error('Error loading collection:', err);
        setError('Failed to load collection. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCollection();
  }, [collectionSlug]);
  
  if (error) {
    return (
      <div className="collection-error">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }
  
  return (
    <div className="collection-page">
      {collectionInfo && (
        <div className="collection-header">
          {collectionInfo.banner_image_url && (
            <div 
              className="collection-banner"
              style={{ backgroundImage: `url(${collectionInfo.banner_image_url})` }}
            />
          )}
          
          <div className="collection-info">
            {collectionInfo.image_url && (
              <img
                src={collectionInfo.image_url}
                alt={collectionInfo.name}
                className="collection-image"
              />
            )}
            
            <div className="collection-details">
              <h1 className="collection-name">{collectionInfo.name}</h1>
              
              {collectionInfo.description && (
                <p className="collection-description">{collectionInfo.description}</p>
              )}
              
              <div className="collection-stats">
                <div className="stat-item">
                  <div className="stat-value">{collectionInfo.stats?.total_supply || '?'}</div>
                  <div className="stat-label">Items</div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-value">{collectionInfo.stats?.num_owners || '?'}</div>
                  <div className="stat-label">Owners</div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-value">{collectionInfo.stats?.floor_price?.toFixed(2) || '?'}</div>
                  <div className="stat-label">Floor Price</div>
                </div>
                
                <div className="stat-item">
                  <div className="stat-value">{collectionInfo.stats?.total_volume?.toFixed(0) || '?'}</div>
                  <div className="stat-label">Volume</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="collection-grid-container">
        <NFTCollectionGrid 
          nfts={nfts} 
          isLoading={isLoading}
          emptyMessage={`No NFTs found in collection ${collectionSlug}`}
        />
      </div>
    </div>
  );
};

export default CollectionPage; 