import React from 'react';
import { SimpleNFTProvider } from '../contexts/SimpleNFTContext';
import SimpleNFTGallery from '../components/SimpleNFTGallery';

/**
 * SimpleGalleryPage - A minimal page that directly uses the new simplified NFT components
 * This avoids modifying the existing app structure while letting us test the new approach
 */
const SimpleGalleryPage = () => {
  return (
    <div className="simple-gallery-page">
      <SimpleNFTProvider>
        <SimpleNFTGallery />
      </SimpleNFTProvider>
    </div>
  );
};

export default SimpleGalleryPage; 