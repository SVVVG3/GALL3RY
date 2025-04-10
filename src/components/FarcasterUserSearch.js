import React, { useState, useEffect } from 'react';
import zapperService from '../services/zapperService';
import NftGrid from './NFTGrid';
import '../styles/FarcasterUserSearch.css';

/**
 * Component for searching Farcaster users and displaying their NFTs
 */
const FarcasterUserSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
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
      console.log(`Searching for Farcaster user: ${searchQuery.trim()}`);
      const profile = await zapperService.getFarcasterProfile(searchQuery.trim());
      setUserProfile(profile);
      
      // If the profile has connected wallets, fetch NFTs for those wallets
      if (profile && profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        setIsLoadingNfts(true);
        console.log(`Fetching NFTs for ${profile.username} with ${profile.connectedAddresses.length} wallets`);
        
        try {
          const nfts = await zapperService.getNftsForAddresses(profile.connectedAddresses);
          setUserNfts(nfts?.nfts || []);
          console.log(`Found ${nfts?.nfts?.length || 0} NFTs`);
        } catch (nftError) {
          console.error('Error fetching NFTs:', nftError);
          setError(`User profile found, but couldn't load NFTs: ${nftError.message}`);
        } finally {
          setIsLoadingNfts(false);
        }
      } else {
        console.log('No connected wallets found for this user');
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
          placeholder="Enter Farcaster username or FID"
          className="search-input"
          disabled={isSearching}
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
        >
          {isSearching ? 'Searching...' : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M20 20L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
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
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/80x80?text=No+Image';
                }}
              />
            )}
            <div className="profile-info">
              <h2>{userProfile.displayName || userProfile.username}</h2>
              {userProfile.username && <p className="username">@{userProfile.username}</p>}
              {userProfile.bio && <p className="bio">{userProfile.bio}</p>}
              <p className="fid">FID: {userProfile.fid}</p>
            </div>
          </div>

          {userProfile.connectedAddresses && userProfile.connectedAddresses.length > 0 ? (
            <div className="connected-wallets">
              <h3>Connected Wallets ({userProfile.connectedAddresses.length})</h3>
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
                      View
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="no-wallets-message">
              <p>No connected wallets found for this user.</p>
            </div>
          )}
        </div>
      )}

      {userProfile && (
        <div className="user-nfts">
          <h3>NFTs {userNfts.length > 0 ? `(${userNfts.length})` : ''}</h3>
          <NftGrid 
            nfts={userNfts}
            loading={isLoadingNfts}
            emptyMessage={
              isLoadingNfts 
                ? "Loading NFTs..." 
                : userProfile.connectedAddresses?.length > 0 
                  ? "No NFTs found for this user" 
                  : "No connected wallets to fetch NFTs from"
            }
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
                src={selectedNft.imageUrl || selectedNft.image || selectedNft.metadata?.image || 'https://via.placeholder.com/400?text=No+Image'} 
                alt={selectedNft.name || 'NFT'} 
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/400x400?text=No+Image';
                }}
              />
            </div>
            <div className="nft-detail-info">
              <h3>{selectedNft.name || selectedNft.metadata?.name || 'Unnamed NFT'}</h3>
              <p className="collection-name">{selectedNft.collection?.name || selectedNft.contract_name || 'Unknown Collection'}</p>
              {selectedNft.description && (
                <p className="nft-description">{selectedNft.description}</p>
              )}
              <div className="nft-properties">
                <p><strong>Token ID:</strong> {selectedNft.tokenId || selectedNft.token_id}</p>
                <p><strong>Collection:</strong> {selectedNft.collection?.name || selectedNft.contract_name || 'Unknown'}</p>
                {selectedNft.estimatedValueEth && (
                  <p><strong>Estimated Value:</strong> {selectedNft.estimatedValueEth} ETH</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 