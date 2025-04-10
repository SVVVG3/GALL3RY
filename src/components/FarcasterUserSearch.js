import React, { useState, useEffect } from 'react';
import zapperService from '../services/zapperService';
import NftGrid from './NFTGrid';

/**
 * Component for searching Farcaster users and displaying their NFTs
 */
const FarcasterUserSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [error, setError] = useState(null);
  const [selectedNft, setSelectedNft] = useState(null);

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setUserProfile(null);
    setUserNfts([]);
    
    try {
      // First fetch the user profile
      const profile = await zapperService.getFarcasterProfile(searchQuery.trim());
      setUserProfile(profile);
      
      // If the profile has connected wallets, fetch NFTs for those wallets
      if (profile && profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        const nfts = await zapperService.getNftsForAddresses(profile.connectedAddresses);
        setUserNfts(nfts || []);
      }
    } catch (err) {
      console.error('Error searching for Farcaster user:', err);
      setError(err.message || 'Failed to fetch user data. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle NFT click to show details
  const handleNftClick = (nft) => {
    setSelectedNft(selectedNft === nft ? null : nft);
  };

  return (
    <div className="farcaster-user-search">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Farcaster username or FID..."
          className="search-input"
          disabled={isSearching}
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {userProfile && (
        <div className="user-profile">
          <div className="profile-header">
            {userProfile.avatarUrl && (
              <img 
                src={userProfile.avatarUrl} 
                alt={`${userProfile.displayName || userProfile.username}'s avatar`}
                className="profile-avatar"
              />
            )}
            <div className="profile-info">
              <h2>{userProfile.displayName || userProfile.username}</h2>
              {userProfile.username && <p className="username">@{userProfile.username}</p>}
              {userProfile.bio && <p className="bio">{userProfile.bio}</p>}
              <p className="fid">FID: {userProfile.fid}</p>
            </div>
          </div>

          {userProfile.connectedAddresses && userProfile.connectedAddresses.length > 0 && (
            <div className="connected-wallets">
              <h3>Connected Wallets</h3>
              <ul className="wallet-list">
                {userProfile.connectedAddresses.map((address, index) => (
                  <li key={index} className="wallet-address">
                    {address.substring(0, 6)}...{address.substring(address.length - 4)}
                    <a 
                      href={`https://etherscan.io/address/${address}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="wallet-link"
                    >
                      View on Etherscan
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {userProfile && (
        <div className="user-nfts">
          <h3>NFTs {userNfts.length > 0 ? `(${userNfts.length})` : ''}</h3>
          <NftGrid 
            nfts={userNfts}
            loading={isSearching}
            emptyMessage="No NFTs found for this user"
            onNftClick={handleNftClick}
          />
        </div>
      )}

      {selectedNft && (
        <div className="nft-detail-modal">
          <div className="nft-detail-content">
            <button 
              className="close-button"
              onClick={() => setSelectedNft(null)}
            >
              &times;
            </button>
            <div className="nft-detail-image">
              <img 
                src={selectedNft.image || selectedNft.metadata?.image || 'https://via.placeholder.com/400?text=No+Image'} 
                alt={selectedNft.name || 'NFT'} 
              />
            </div>
            <div className="nft-detail-info">
              <h3>{selectedNft.name || selectedNft.metadata?.name || 'Unnamed NFT'}</h3>
              <p className="collection-name">{selectedNft.collection?.name || selectedNft.contract_name || 'Unknown Collection'}</p>
              {selectedNft.description && (
                <p className="nft-description">{selectedNft.description}</p>
              )}
              <div className="nft-properties">
                <p><strong>Token ID:</strong> {selectedNft.token_id}</p>
                <p><strong>Contract:</strong> {selectedNft.contract_address}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 