import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import NFTGrid from './components/NFTGrid';
import ProfileCard from './components/ProfileCard';
import LoadingState from './components/LoadingState';
import SignInButton from './components/SignInButton';
import FolderManager from './components/FolderManager';
import PublicFolderManager from './components/PublicFolderManager';
import { useAuth } from './contexts/AuthContext';
import zapperService from './services/zapperService';
import './App.css';

function App() {
  const { isAuthenticated, profile: authProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [displayedNfts, setDisplayedNfts] = useState([]);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('gallery');
  const [sortOption, setSortOption] = useState('default');
  const ITEMS_PER_PAGE = 24; // 4 columns x 6 rows
  
  // When authenticated, fetch the user's NFTs
  useEffect(() => {
    if (isAuthenticated && authProfile && authProfile.fid) {
      fetchUserNfts();
    }
  }, [isAuthenticated, authProfile]);
  
  // Update displayed NFTs when nfts array or page changes (pagination)
  useEffect(() => {
    updateDisplayedNfts();
  }, [nfts, page, sortOption]);
  
  // A separate function to update displayed NFTs based on current state
  const updateDisplayedNfts = () => {
    if (nfts.length === 0) {
      setDisplayedNfts([]);
      return;
    }
    
    // Calculate range for current page
    const end = page * ITEMS_PER_PAGE;
    
    // First get the slice of NFTs for current page
    const nftsToDisplay = nfts.slice(0, end);
    
    // Then apply sorting to that slice
    const sortedNfts = sortNfts(nftsToDisplay, sortOption);
    
    // Update state
    setDisplayedNfts(sortedNfts);
  };
  
  // Function to sort NFTs based on the selected option
  const sortNfts = (nftArray, option) => {
    if (!nftArray || nftArray.length === 0) return [];
    
    const nftsCopy = [...nftArray];
    
    switch (option) {
      case 'name-asc':
        return nftsCopy.sort((a, b) => {
          const nameA = (a.name || a.collection?.name || '').toLowerCase();
          const nameB = (b.name || b.collection?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      case 'name-desc':
        return nftsCopy.sort((a, b) => {
          const nameA = (a.name || a.collection?.name || '').toLowerCase();
          const nameB = (b.name || b.collection?.name || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });
      
      case 'collection':
        return nftsCopy.sort((a, b) => {
          const collectionA = (a.collection?.name || '').toLowerCase();
          const collectionB = (b.collection?.name || '').toLowerCase();
          return collectionA.localeCompare(collectionB);
        });
      
      case 'price-high':
        return nftsCopy.sort((a, b) => {
          const priceA = a.estimatedValueUsd || (a.estimatedValueEth ? a.estimatedValueEth : 0);
          const priceB = b.estimatedValueUsd || (b.estimatedValueEth ? b.estimatedValueEth : 0);
          return priceB - priceA; // Higher first
        });
      
      case 'price-low':
        return nftsCopy.sort((a, b) => {
          const priceA = a.estimatedValueUsd || (a.estimatedValueEth ? a.estimatedValueEth : 0);
          const priceB = b.estimatedValueUsd || (b.estimatedValueEth ? b.estimatedValueEth : 0);
          return priceA - priceB; // Lower first
        });
      
      case 'default':
      default:
        return nftsCopy; // No sorting
    }
  };
  
  // Handle sort option change
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };
  
  // Function to fetch NFTs for the authenticated user
  const fetchUserNfts = async () => {
    if (!authProfile || !authProfile.fid) return;
    
    setLoading(true);
    setError(null);
    // Keep profile if we already have it
    setNfts([]);
    setDisplayedNfts([]);
    setPage(1);
    setActiveTab('gallery');

    try {
      // First try to get the profile
      const profileData = await fetchProfile(authProfile.fid);
      
      if (!profileData) {
        throw new Error(`Unable to load profile for FID: ${authProfile.fid}`);
      }
      
      // Then try to get the NFTs
      await fetchNftsForProfile(profileData);
      
    } catch (err) {
      handleError(err, "Error fetching user NFTs");
    } finally {
      setLoading(false);
    }
  };

  // Function to search for a profile and NFTs
  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSearchQuery(query);
    // Don't clear profile yet
    setNfts([]);
    setDisplayedNfts([]);
    setPage(1);
    setActiveTab('gallery');

    try {
      // First try to get the profile
      const profileData = await fetchProfile(query);
      
      if (!profileData) {
        setProfile(null);
        throw new Error(`Profile not found for "${query}"`);
      }
      
      // Then try to get the NFTs
      await fetchNftsForProfile(profileData);
      
    } catch (err) {
      handleError(err, "Error searching for profile/NFTs");
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to fetch a profile
  const fetchProfile = async (query) => {
    try {
      console.log(`Fetching profile for: ${query}`);
      
      const profileData = await zapperService.getFarcasterProfile(query);
      
      if (profileData) {
        console.log(`Profile found:`, profileData.username || profileData.fid);
        // Set profile immediately when we have it
        setProfile(profileData);
        setSearchQuery(profileData.username || `FID: ${profileData.fid}`);
        return profileData;
      }
      
      console.log(`No profile found for: ${query}`);
      return null;
    } catch (err) {
      console.error('Error in fetchProfile:', err.message);
      // Rethrow to be handled by the caller
      throw new Error(`Unable to fetch profile: ${err.message}`);
    }
  };
  
  // Helper function to fetch NFTs for a profile
  const fetchNftsForProfile = async (profileData) => {
    try {
      // Get addresses associated with the profile
      const addresses = [
        ...(profileData.custodyAddress ? [profileData.custodyAddress] : []),
        ...(profileData.connectedAddresses || [])
      ];
      
      console.log(`Found ${addresses.length} addresses for profile:`, addresses);
      
      if (addresses.length === 0) {
        console.log('No wallet addresses found');
        setNfts([]);
        throw new Error('No wallet addresses found for this profile');
      }
      
      // Fetch NFTs for all addresses
      console.log(`Fetching NFTs for ${addresses.length} addresses...`);
      const nftResponse = await zapperService.getNftsForAddresses(addresses, { limit: 100 });
      
      if (!nftResponse || !nftResponse.nfts || nftResponse.nfts.length === 0) {
        console.log('No NFTs found for the connected addresses');
        setNfts([]);
        return;
      }
      
      console.log(`Found ${nftResponse.nfts.length} NFTs`);
      setNfts(nftResponse.nfts);
      return nftResponse.nfts;
    } catch (err) {
      console.error('Error in fetchNftsForProfile:', err.message);
      // Rethrow to be handled by the caller
      throw new Error(`Unable to fetch NFTs: ${err.message}`);
    }
  };
  
  // Helper function to handle errors consistently
  const handleError = (err, context) => {
    // Extract more detailed error information
    let errorMessage = err.message || 'An unexpected error occurred';
    
    if (err.response && err.response.data) {
      if (err.response.data.errors && err.response.data.errors.length > 0) {
        errorMessage = `API Error: ${err.response.data.errors[0].message}`;
      } else if (err.response.data.error) {
        errorMessage = `API Error: ${err.response.data.error}`;
      }
    }
    
    console.error(`${context}:`, errorMessage);
    
    // If the error is network related, show a different message
    if (err.name === 'NetworkError' || err.message.includes('Network Error') || 
        err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
      errorMessage = 'Unable to connect to API server. Please check your connection or try again later.';
    }
    
    setError(errorMessage);
    setNfts([]);
    setDisplayedNfts([]);
  };

  // Function to load more NFTs
  const loadMoreNfts = () => {
    setPage(prevPage => prevPage + 1);
  };

  // Check if there are more NFTs to load
  const hasMoreNfts = page * ITEMS_PER_PAGE < nfts.length;

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
        <div className="container">
          <div style={{ textAlign: 'center' }}>
            <h1 className="heading-logo" style={{ marginBottom: '2rem' }}>GALL3RY</h1>
            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', gap: '1rem', alignItems: 'center' }}>
              {isAuthenticated && authProfile && (
                <button 
                  onClick={fetchUserNfts}
                  className="profile-link"
                  title="Return to your profile"
                >
                  {authProfile.metadata?.imageUrl && (
                    <img 
                      src={authProfile.metadata.imageUrl} 
                      alt={authProfile.username || 'Profile'} 
                      className="profile-link-avatar"
                    />
                  )}
                  <span>
                    {authProfile.username ? `@${authProfile.username}` : 'My Profile'}
                  </span>
                </button>
              )}
              <SignInButton onSuccess={fetchUserNfts} />
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content area */}
      <main className="container pb-16">
        {/* Search bar - always visible */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '3rem' }}>
          <div style={{ maxWidth: "420px", width: "100%", margin: "0 auto" }}>
            <SearchBar 
              onSearch={handleSearch} 
              isLoading={loading} 
              placeholder="Enter Farcaster username or FID"
            />
          </div>
        </div>
        
        {/* Prompt users to sign in if not authenticated */}
        {!isAuthenticated && !profile && !loading && !error && !hasSearched && (
          <div className="card p-12 mb-12" style={{ textAlign: 'center' }}>
            <p className="text-xl text-gray-600" style={{ margin: '0 auto', maxWidth: '600px' }}>
              Sign in with Farcaster to view your NFTs or search for a Farcaster user
            </p>
          </div>
        )}
        
        {/* Results area */}
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <div className="loading-text">{`Loading NFTs for ${searchQuery}...`}</div>
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-red-500 mb-8">
            {error}
          </div>
        ) : profile ? (
          <div className="card">
            <div className="p-8 px-10 pt-10 pb-12">
              <ProfileCard profile={profile} />
              
              {/* Tab Navigation */}
              <div className="tab-navigation mt-8 mb-6">
                <div className="tab-buttons">
                  <button 
                    className={`tab-button ${activeTab === 'gallery' ? 'active' : ''}`}
                    onClick={() => handleTabChange('gallery')}
                  >
                    Gallery
                  </button>
                  <button 
                    className={`tab-button ${activeTab === 'folders' ? 'active' : ''}`}
                    onClick={() => handleTabChange('folders')}
                  >
                    {isAuthenticated && authProfile && profile.fid === authProfile.fid ? 'My Folders' : 'Folders'}
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'gallery' ? (
                <>
                  {nfts.length > 0 ? (
                    <div className="mt-6">
                      {/* Sorting UI */}
                      <div className="sort-container">
                        <label htmlFor="sort-options" className="sort-label">
                          Sort by:
                        </label>
                        <select
                          id="sort-options"
                          className="sort-select"
                          value={sortOption}
                          onChange={handleSortChange}
                        >
                          <option value="default">Default</option>
                          <option value="name-asc">Name (A-Z)</option>
                          <option value="name-desc">Name (Z-A)</option>
                          <option value="collection">Collection</option>
                          <option value="price-high">Price (High to Low)</option>
                          <option value="price-low">Price (Low to High)</option>
                        </select>
                      </div>
                      <NFTGrid nfts={displayedNfts} />
                      
                      {hasMoreNfts && (
                        <div className="load-more-container">
                          <button 
                            className="btn btn-primary"
                            onClick={loadMoreNfts}
                          >
                            Load More NFTs
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      No NFTs found for this user
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-6">
                  {isAuthenticated && authProfile && profile.fid === authProfile.fid ? (
                    // Show personal folder manager when viewing own profile
                    <FolderManager />
                  ) : (
                    // Show public folder viewer when viewing other profiles
                    <PublicFolderManager 
                      username={profile.username}
                      fid={profile.fid}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        ) : hasSearched ? (
          <div className="card p-8 text-center text-gray-500 mb-8">
            No results found
          </div>
        ) : null}
      </main>
      
      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">GALL3RY</div>
            <div className="footer-copyright">
              vibe coded with 💜 by <a href="https://warpcast.com/svvvg3.eth" target="_blank" rel="noopener noreferrer" className="footer-link">@svvvg3.eth</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
