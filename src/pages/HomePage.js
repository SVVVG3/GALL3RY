import React, { useState } from 'react';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import '../styles/HomePage.css';
import { NFTProvider } from '../contexts/NFTContext';

/**
 * Simple HomePage Component with minimal dependencies
 */
const HomePage = () => {
  const [nftsDisplayed, setNftsDisplayed] = useState(false);

  // Callback to track when NFTs are being displayed
  const handleNFTsDisplayChange = (isDisplaying) => {
    setNftsDisplayed(isDisplaying);
  };

  return (
    <div className="home-container home-container-compact">
      <div className={`search-section ${nftsDisplayed ? 'nfts-displayed' : ''}`}>
        <NFTProvider>
          <FarcasterUserSearch onNFTsDisplayChange={handleNFTsDisplayChange} />
        </NFTProvider>
      </div>
    </div>
  );
};

export default HomePage; 