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
  const [profileError, setProfileError] = useState(null);
  const [nftError, setNftError] = useState(null);
  const [selectedNft, setSelectedNft] = useState(null);
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Reset errors when search query changes
  useEffect(() => {
    if (searchQuery && error) {
      setError(null);
      setProfileError(null);
      setNftError(null);
    }
  }, [searchQuery]);

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setProfileError(null);
    setNftError(null);
    setUserProfile(null);
    setUserNfts([]);
    setSearchAttempted(true);
    
    try {
      // Fetch the user profile using the Zapper API
      const profile = await zapperService.getFarcasterProfile(searchQuery.trim());
      
      if (!profile) {
        setProfileError(`No user found with username or FID: ${searchQuery.trim()}`);
        return;
      }
      
      setUserProfile(profile);
      
      // If the profile has connected wallets, fetch NFTs for those wallets
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        setIsLoadingNfts(true);
        
        try {
          const nfts = await zapperService.getNftsForAddresses(profile.connectedAddresses);
          if (nfts && Array.isArray(nfts.nfts)) {
            setUserNfts(nfts.nfts);
          } else {
            setUserNfts([]);
            setNftError('Received unexpected NFT data format');
          }
        } catch (nftErr) {
          console.error('Error fetching NFTs:', nftErr);
          setNftError(`Couldn't load NFTs: ${nftErr.message || 'Unknown error'}`);
          setUserNfts([]);
        } finally {
          setIsLoadingNfts(false);
        }
      } else {
        console.log('No connected wallets found for this user');
      }
    } catch (err) {
      console.error('Error searching for Farcaster user:', err);
      setProfileError(err.message || 'Failed to fetch user data. Please try again.');
      setError(`Search failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle NFT click to show details
  const handleNftClick = (nft) => {
    setSelectedNft(selectedNft === nft ? null : nft);
  };

  // Handle image error with fallback
  const handleImageError = (e, fallbackUrl = 'https://via.placeholder.com/80x80?text=No+Image') => {
    e.target.src = fallbackUrl;
    e.target.onerror = null; // Prevent infinite error loop
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
          aria-label="Farcaster username or FID"
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
          aria-label={isSearching ? "Searching..." : "Search"}
        >
          {isSearching ? (
            <div className="search-spinner"></div>
          ) : (
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

      {searchAttempted && !userProfile && !isSearching && !error && profileError && (
        <div className="error-message">
          <p>{profileError}</p>
        </div>
      )}

      {userProfile && (
        <div className="user-profile">
          <div className="profile-header">
            {userProfile.avatarUrl ? (
              <img 
                src={userProfile.avatarUrl} 
                alt={`${userProfile.displayName || userProfile.username}'s avatar`}
                className="profile-avatar"
                onError={(e) => handleImageError(e)}
                loading="lazy"
              />
            ) : (
              <div className="profile-avatar-placeholder">
                {(userProfile.displayName || userProfile.username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="profile-info">
              <h2>{userProfile.displayName || userProfile.username || `User #${userProfile.fid}`}</h2>
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
                      aria-label={`View wallet ${address} on Etherscan`}
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
          
          {nftError && (
            <div className="nft-error-message">
              <p>{nftError}</p>
            </div>
          )}
          
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
              aria-label="Close NFT details"
            >
              &times;
            </button>
            <div className="nft-detail-image">
              <img 
                src={selectedNft.imageUrl || selectedNft.image || selectedNft.metadata?.image || 'https://via.placeholder.com/400?text=No+Image'} 
                alt={selectedNft.name || 'NFT'} 
                onError={(e) => handleImageError(e, 'https://via.placeholder.com/400x400?text=No+Image')}
                loading="lazy"
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
                <p><strong>Contract:</strong> {selectedNft.contract_address || selectedNft.contractAddress || 'Unknown'}</p>
                <p><strong>Collection:</strong> {selectedNft.collection?.name || selectedNft.contract_name || 'Unknown'}</p>
                {selectedNft.estimatedValueEth && (
                  <p><strong>Estimated Value:</strong> {selectedNft.estimatedValueEth} ETH</p>
                )}
              </div>
              
              {selectedNft.contract_address && (
                <div className="nft-links">
                  <a 
                    href={`https://etherscan.io/token/${selectedNft.contract_address}?a=${selectedNft.token_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="etherscan-link"
                  >
                    View on Etherscan
                  </a>
                  {selectedNft.opensea_url && (
                    <a 
                      href={selectedNft.opensea_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opensea-link"
                    >
                      View on OpenSea
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 