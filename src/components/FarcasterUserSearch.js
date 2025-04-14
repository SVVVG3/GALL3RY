import React, { useState, useEffect } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { getFarcasterProfile } from '../services/zapperService';
import NFTGallery from './NFTGallery';
import '../styles/FarcasterUserSearch.css';

/**
 * FarcasterUserSearch component - simplified to avoid circular dependencies
 */
const FarcasterUserSearch = ({ initialUsername }) => {
  const { fetchAllNFTsForWallets, isLoading: isNftLoading } = useNFT();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // User data state
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [walletAddresses, setWalletAddresses] = useState([]);
  
  // UI state
  const [walletsExpanded, setWalletsExpanded] = useState(false);
  
  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      handleSearch({ preventDefault: () => {} });
    }
  }, [initialUsername]);

  // Handle form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setUserNfts([]);
    setWalletAddresses([]);

    try {
      console.log(`Searching for Farcaster user: ${searchQuery}`);
      
      // Try to find the Farcaster profile using Zapper API
      const profile = await getFarcasterProfile(searchQuery);
      
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      console.log('Farcaster profile found:', profile);
      
      // Get wallet addresses
      let addresses = [];
      
      // Add custody address if it exists
      if (profile.custodyAddress) {
        addresses.push(profile.custodyAddress);
      }
      
      // Add connected addresses if they exist
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        addresses = [...addresses, ...profile.connectedAddresses];
      }
      
      // Filter out duplicates
      addresses = [...new Set(addresses)];
      
      setUserProfile(profile);
      setWalletAddresses(addresses);
      
      // Fetch NFTs if we have wallet addresses
      if (addresses.length > 0) {
        const nfts = await fetchAllNFTsForWallets(addresses);
        setUserNfts(nfts || []);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Failed to find user');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <h1>Search Farcaster Users</h1>
        <p>Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
            className="search-input"
            aria-label="Farcaster username"
            disabled={isSearching}
          />
          <button 
            type="submit"
            className="search-button"
            disabled={!searchQuery.trim() || isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {searchError && (
        <div className="error-message">
          <p>{searchError}</p>
        </div>
      )}
      
      {userProfile && (
        <div className="user-profile">
          <div className="profile-info">
            <div className="profile-image">
              {userProfile.metadata?.imageUrl ? (
                <img 
                  src={userProfile.metadata.imageUrl} 
                  alt={`${userProfile.username}'s profile`} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/placeholder-profile.png';
                  }}
                />
              ) : (
                <img src="/assets/placeholder-profile.png" alt="Default profile" />
              )}
            </div>
            <div className="profile-details">
              <h2>@{userProfile.username}</h2>
              <p className="display-name">{userProfile.metadata?.displayName || ''}</p>
              <p className="bio">{userProfile.metadata?.description || ''}</p>
              <div className="fid">
                <span>FID: </span>
                <span>{userProfile.fid}</span>
              </div>
              <div className="wallet-info">
                <button 
                  className="wallet-toggle" 
                  onClick={() => setWalletsExpanded(!walletsExpanded)}
                >
                  {walletsExpanded ? 'Hide Wallets' : 'Show Wallets'} ({walletAddresses.length})
                </button>
                {walletsExpanded && (
                  <ul className="wallet-list">
                    {walletAddresses.map((address, index) => (
                      <li key={index} className="wallet-item">
                        <a 
                          href={`https://etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                        >
                          {address}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          
          <div className="nft-container">
            <div className="nft-header">
              <h2>NFT Collection</h2>
              <p className="nft-count">
                Found {userNfts.length} NFTs for {userProfile.username}
              </p>
            </div>
            
            {/* Use the existing NFTGallery component to display NFTs */}
            {isNftLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              <NFTGallery nfts={userNfts} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 