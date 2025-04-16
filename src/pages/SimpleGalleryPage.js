import React from 'react';
import { NFTProvider } from '../contexts/NFTContext';
import NFTGallery from '../components/NFTGallery';
import '../styles/Page.css';

/**
 * Simple Gallery Page
 * Wrapper component that provides the page structure for the NFT Gallery
 */
const SimpleGalleryPage = () => {
  return (
    <div className="page-container">
      <div className="page-content">
        <NFTProvider>
          <NFTGallery />
        </NFTProvider>
      </div>
    </div>
  );
};

export default SimpleGalleryPage; 