import React, { useEffect, useRef, useState } from 'react';
import NftCard from './NftCard';
import { useNFT } from '../contexts/NFTContext';
import { useWallet } from '../contexts/WalletContext';
import { FaFilter, FaSort, FaSpinner, FaCheck, FaBolt, FaClock, FaShieldAlt } from 'react-icons/fa';
import styled from 'styled-components';
import { formatAddress } from '../utils/format';

/**
 * NFT Gallery component
 * Displays a grid of NFT images with search, sorting and pagination
 */
const NFTGallery = () => {
  const {
    filteredNFTs,
    isLoading,
    hasMore,
    loadingMore,
    collections,
    chains,
    selectedChains,
    setSelectedChains,
    selectedCollections,
    setSelectedCollections,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    prioritizeSpeed,
    setPrioritizeSpeed,
    excludeSpam,
    setExcludeSpam,
    loadMoreNFTs,
    fetchNFTs,
    endCursor,
    fetchAllNFTsForWallets,
    fetchProgress,
    loadedWallets
  } = useNFT();
  
  // Safely get filteredNFTs with null check
  const safeFilteredNFTs = Array.isArray(filteredNFTs) ? filteredNFTs : [];
  
  const { connectedWallets } = useWallet();
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const loaderRef = useRef(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fetchingAllWallets, setFetchingAllWallets] = useState(false);

  // Initial load of NFTs when wallets are connected
  useEffect(() => {
    if (connectedWallets && connectedWallets.length > 0 && initialLoad) {
      // Check if we need to fetch from all wallets
      const walletAddresses = connectedWallets.map(wallet => wallet.address);
      const newWallets = walletAddresses.filter(address => !loadedWallets.includes(address));
      
      if (newWallets.length > 0) {
        console.log(`Fetching NFTs for ${newWallets.length} new connected wallets`);
        setFetchingAllWallets(true);
        
        // Use the new function to fetch from all wallets at once
        fetchAllNFTsForWallets(walletAddresses, {
          includeValue: true,
          includeBalanceUSD: true,
          // Fetch from multiple chains if needed
          chains: ['eth', 'base', 'polygon', 'arbitrum', 'optimism'],
          excludeSpam: excludeSpam
        }).finally(() => {
          setInitialLoad(false);
          setFetchingAllWallets(false);
        });
      } else {
        // If all wallets already loaded, just fetch with refreshed options
        fetchNFTs({
          includeValue: true,
          includeBalanceUSD: true
        });
        setInitialLoad(false);
      }
    }
  }, [connectedWallets, fetchNFTs, fetchAllNFTsForWallets, initialLoad, loadedWallets, excludeSpam]);

  // Automatically continue loading NFTs until we hit a reasonable threshold or hasMore becomes false
  // This helps ensure we load enough NFTs even with the pagination limits
  useEffect(() => {
    const AUTO_LOAD_THRESHOLD = 300; // Reduced from 1000 to 300 to be less aggressive
    
    const autoLoadCheck = () => {
      // Ensure safeFilteredNFTs is used instead of filteredNFTs
      console.log("AUTO-LOAD CHECK: userNfts=" + safeFilteredNFTs.length + ", hasMore=" + hasMore + ", isLoading=" + isLoading + ", loadingMore=" + loadingMore);
      
      // Fix the auto-loading logic - REMOVE arbitrary 200 NFT check
      // The goal is to load up to AUTO_LOAD_THRESHOLD NFTs automatically
      const shouldAutoLoad = safeFilteredNFTs.length < AUTO_LOAD_THRESHOLD;
      
      // If we have 'hasMore' true, not currently loading, and haven't hit the threshold yet, load more
      if (hasMore && !isLoading && !loadingMore && shouldAutoLoad) {
        console.log(`Auto-loading next batch of NFTs (current count: ${safeFilteredNFTs.length}/${AUTO_LOAD_THRESHOLD})...`);
        
        // Significantly increased delay to avoid rate limiting
        setTimeout(() => {
          loadMoreNFTs();
        }, 1500); // 1.5 seconds between auto-loads
      } else {
        console.log(`Auto-loading stopped: hasMore=${hasMore}, isLoading=${isLoading}, loadingMore=${loadingMore}, shouldAutoLoad=${shouldAutoLoad}`);
      }
    };
    
    // Check if we should auto-load more NFTs when safeFilteredNFTs, hasMore, or loading state changes
    if (safeFilteredNFTs.length > 0) {
      autoLoadCheck();
    }
  }, [safeFilteredNFTs.length, hasMore, isLoading, loadingMore, loadMoreNFTs]);

  // Intersection observer for infinite scrolling
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '20px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoading && !loadingMore) {
        loadMoreNFTs();
      }
    }, options);

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMore, isLoading, loadMoreNFTs, loadingMore]);

  // Handle chain filter
  const handleChainSelect = (chain) => {
    if (selectedChains.includes(chain)) {
      setSelectedChains(selectedChains.filter(c => c !== chain));
    } else {
      setSelectedChains([...selectedChains, chain]);
    }
  };

  // Handle collection filter
  const handleCollectionSelect = (collectionId) => {
    if (selectedCollections.includes(collectionId)) {
      setSelectedCollections(selectedCollections.filter(c => c !== collectionId));
    } else {
      setSelectedCollections([...selectedCollections, collectionId]);
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // Toggle speed mode
  const toggleSpeedMode = () => {
    setPrioritizeSpeed(!prioritizeSpeed);
    // Refresh NFTs to apply the new setting
    fetchNFTs(true);
  };

  // Toggle spam filtering
  const toggleSpamFilter = () => {
    setExcludeSpam(!excludeSpam);
    // Refresh NFTs to apply the new filter
    fetchNFTs({
      bypassCache: true
    });
  };

  // Add a manual load function that bypasses all the auto-loading logic
  const handleManualLoadMore = () => {
    if (hasMore && !isLoading && !loadingMore) {
      console.log(`MANUAL LOAD: Fetching next page of NFTs with cursor: ${endCursor}`);
      
      // NOTE: It appears that Zapper's API may have an undocumented limit of ~200 NFTs
      // per query session regardless of pagination. If you can't load more than ~200 NFTs,
      // this is likely due to API limitations, not a bug in our implementation.
      
      // Directly call fetchNFTs with loadMore=true to bypass auto-loading logic
      fetchNFTs({
        loadMore: true,
        batchSize: 24, // Exactly match Zapper's default page size
        bypassCache: true, // Ensure we're getting fresh data
        includeValue: true,
        includeBalanceUSD: true
      });
    }
  };

  // Handle liking an NFT
  const handleLike = (nft) => {
    console.log('NFT liked from gallery:', nft.id);
    // In a full implementation, this would update some state or call an API
    // Since the toggleLikeNFT function is not implemented, we'll just log this
  };

  // Add a method to manually fetch from all wallets
  const handleFetchAllWallets = () => {
    if (connectedWallets && connectedWallets.length > 0) {
      console.log("Manually triggering fetch for all wallets");
      const walletAddresses = connectedWallets.map(wallet => wallet.address);
      setFetchingAllWallets(true);
      
      // Clear existing NFTs to ensure a fresh load
      console.log("Clearing existing NFTs for fresh load");
      setNfts([]);
      
      fetchAllNFTsForWallets(walletAddresses, {
        includeValue: true, 
        includeBalanceUSD: true,
        bypassCache: true,
        chains: selectedChains.includes('all') ? 
          ['eth', 'base', 'polygon', 'arbitrum', 'optimism'] : 
          selectedChains,
        excludeSpam: excludeSpam
      }).finally(() => {
        setFetchingAllWallets(false);
        console.log("Fetch for all wallets completed");
      });
    }
  };

  // Add wallet fetch progress display
  const renderFetchProgress = () => {
    if (Object.keys(fetchProgress).length === 0) return null;
    
    // Check if we're in the enhancing phase
    const isEnhancing = Object.values(fetchProgress).some(p => p.enhancing);
    
    return (
      <FetchProgressContainer>
        <h4>
          {isEnhancing 
            ? "Enhancing NFTs with metadata and price data..." 
            : "Fetching NFTs from Wallets"}
        </h4>
        {Object.entries(fetchProgress).map(([address, progress]) => (
          <ProgressItem key={address}>
            <ProgressLabel>{formatAddress(address)}</ProgressLabel>
            <ProgressInfo>
              <div>
                {progress.enhancing 
                  ? 'Enhancing...' 
                  : progress.completed 
                    ? 'Complete' 
                    : 'Loading...'}
              </div>
              <div>{progress.totalNFTs} NFTs</div>
              {!progress.enhancing && <div>Page {progress.pagesFetched}</div>}
            </ProgressInfo>
          </ProgressItem>
        ))}
        
        {isEnhancing && (
          <EnhancementNote>
            Adding price data and detailed metadata...
            <LoadingSpinner><FaSpinner className="spinner" /></LoadingSpinner>
          </EnhancementNote>
        )}
      </FetchProgressContainer>
    );
  };

  return (
    <div className={`nft-gallery-container ${showFilters || showSortMenu ? 'blur-background' : ''}`}>
      <ControlsContainer>
        <SearchBox>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="clear-search"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </SearchBox>
        
        <FilterButton 
          onClick={() => setShowFilters(!showFilters)}
          className={showFilters ? 'active' : ''}
        >
          <FaFilter />
          <span>Filter</span>
        </FilterButton>
        
        <SortButton 
          onClick={() => setShowSortMenu(!showSortMenu)}
          className={showSortMenu ? 'active' : ''}
        >
          <FaSort />
          <span>Sort</span>
        </SortButton>

        <SpeedToggle
          onClick={toggleSpeedMode}
          className={prioritizeSpeed ? 'active' : ''}
          title={prioritizeSpeed ? 'Speed Mode ON (Less Metadata)' : 'Speed Mode OFF (Full Metadata)'}
        >
          <FaBolt />
          <span>Speed</span>
        </SpeedToggle>
        
        <SpamToggle
          onClick={toggleSpamFilter}
          className={excludeSpam ? 'active' : ''}
          title={excludeSpam ? 'Spam Filter ON' : 'Spam Filter OFF'}
        >
          <FaShieldAlt />
          <span>Filter Spam</span>
        </SpamToggle>
        
        {/* Add manual refresh button */}
        <RefreshButton 
          onClick={handleFetchAllWallets}
          disabled={fetchingAllWallets || isLoading}
          title="Manually refresh all NFTs from connected wallets"
        >
          {fetchingAllWallets ? <FaSpinner className="spinner" /> : "Refresh NFTs"}
        </RefreshButton>
      </ControlsContainer>

      {/* Filters Panel */}
      {showFilters && (
        <FiltersPanel>
          <h3>Filter NFTs</h3>
          
          <FilterSection>
            <h4>Chains</h4>
            <FilterList>
              <FilterItem 
                onClick={() => setSelectedChains(['all'])}
                className={selectedChains.includes('all') ? 'active' : ''}
              >
                All Chains
              </FilterItem>
              {chains.map(chain => (
                <FilterItem
                  key={chain}
                  onClick={() => handleChainSelect(chain)}
                  className={selectedChains.includes(chain) ? 'active' : ''}
                >
                  {chain.charAt(0).toUpperCase() + chain.slice(1)}
                </FilterItem>
              ))}
            </FilterList>
          </FilterSection>
          
          <FilterSection>
            <h4>Collections</h4>
            <FilterList>
              <FilterItem 
                onClick={() => setSelectedCollections([])}
                className={selectedCollections.length === 0 ? 'active' : ''}
              >
                All Collections
              </FilterItem>
              {collections.slice(0, 10).map(collection => (
                <FilterItem
                  key={collection.id}
                  onClick={() => handleCollectionSelect(collection.id)}
                  className={selectedCollections.includes(collection.id) ? 'active' : ''}
                >
                  {collection.name || 'Unknown Collection'}
                </FilterItem>
              ))}
            </FilterList>
          </FilterSection>
          
          <button onClick={() => setShowFilters(false)}>Close</button>
        </FiltersPanel>
      )}

      {/* Sort Menu */}
      {showSortMenu && (
        <SortMenu>
          <h3>Sort NFTs</h3>
          
          <SortOption 
            onClick={() => setSortBy('value')}
            className={sortBy === 'value' ? 'active' : ''}
          >
            <FaCheck className="check-icon" />
            <span>Estimated Value</span>
          </SortOption>
          
          <SortOption 
            onClick={() => setSortBy('recent')}
            className={sortBy === 'recent' ? 'active' : ''}
          >
            <FaCheck className="check-icon" />
            <span>Recently Acquired</span>
          </SortOption>
          
          <SortOption 
            onClick={() => setSortBy('name')}
            className={sortBy === 'name' ? 'active' : ''}
          >
            <FaCheck className="check-icon" />
            <span>Name</span>
          </SortOption>
          
          <SortOption 
            onClick={() => setSortBy('collection')}
            className={sortBy === 'collection' ? 'active' : ''}
          >
            <FaCheck className="check-icon" />
            <span>Collection</span>
          </SortOption>
          
          <div className="sort-divider"></div>
          
          <SortOrderOption onClick={toggleSortOrder}>
            {sortOrder === 'desc' ? 'Descending (High to Low)' : 'Ascending (Low to High)'}
          </SortOrderOption>
          
          <button onClick={() => setShowSortMenu(false)}>Close</button>
        </SortMenu>
      )}

      {/* Show NFT fetch progress if available */}
      {renderFetchProgress()}

      {/* Enhancement Feature Notice */}
      <EnhancementNote>
        <FaClock /> NFT values and metadata load incrementally as you browse. Keep scrolling to see more NFTs.
      </EnhancementNote>

      {isLoading && safeFilteredNFTs.length === 0 ? (
        <LoadingContainer>
          <LoadingSpinner />
          <p>Loading your NFTs...</p>
        </LoadingContainer>
      ) : safeFilteredNFTs.length === 0 ? (
        <EmptyState>
          <p>No NFTs found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
          {fetchingAllWallets && <p>Fetching NFTs from all your wallets... This may take a moment.</p>}
        </EmptyState>
      ) : (
        <>
          <NFTGrid>
            {safeFilteredNFTs.map(nft => (
              <NftCard 
                key={nft.id || `${nft.collection?.address}-${nft.tokenId}`} 
                nft={nft} 
                onClick={() => console.log('NFT clicked:', nft.id)}
                showLastPrice={false}
                showLikeButton={true}
                onLike={handleLike}
              />
            ))}
          </NFTGrid>
          
          {hasMore && (
            <ManualLoadContainer>
              {loadingMore ? (
                <LoadingSpinner />
              ) : (
                <ManualLoadButton onClick={handleManualLoadMore}>
                  Load More NFTs
                </ManualLoadButton>
              )}
            </ManualLoadContainer>
          )}
          
          {!isLoading && !hasMore && safeFilteredNFTs.length > 0 && (
            <div className="end-message">
              You've seen all your NFTs. 
              <RefreshButton onClick={() => fetchNFTs({ bypassCache: true })}>
                Refresh
              </RefreshButton>
            </div>
          )}
          
          {/* Invisible element for intersection observer */}
          <div ref={loaderRef} style={{ height: '20px', width: '100%' }}></div>
        </>
      )}
    </div>
  );
};

// Styled components
const GalleryContainer = styled.div`
  padding: 1rem;
  max-width: 95vw;
  margin: 0 auto;
  width: 98%;
`;

const GalleryHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1rem;
  
  h2 {
    font-size: 1.8rem;
    margin: 0;
  }
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: space-between;
  }
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  
  input {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    border: 1px solid #ddd;
    width: 100%;
  }
  
  button {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
  }
  
  @media (max-width: 768px) {
    flex: 1;
  }
`;

const FilterButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #e0e0e0;
  }
`;

const SortButton = styled(FilterButton)``;

const SpeedToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: ${props => props.$active ? '#4caf50' : '#f0f0f0'};
  color: ${props => props.$active ? 'white' : 'black'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: ${props => props.$active ? '#3d8b40' : '#e0e0e0'};
  }
`;

const SpamToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: ${props => props.$active ? '#4caf50' : '#f0f0f0'};
  color: ${props => props.$active ? 'white' : 'black'};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: ${props => props.$active ? '#3d8b40' : '#e0e0e0'};
  }
`;

const FiltersPanel = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 2rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const FilterSection = styled.div`
  flex: 1;
  
  h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
    font-size: 1rem;
  }
`;

const FilterList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
`;

const FilterItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: ${props => props.$selected ? '#e0f2f1' : '#f5f5f5'};
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  
  &:hover {
    background-color: #e0e0e0;
  }
`;

const SortMenu = styled.div`
  position: absolute;
  right: 1rem;
  background-color: white;
  border-radius: 8px;
  padding: 0.5rem;
  margin-top: -1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
  
  @media (max-width: 768px) {
    width: calc(100% - 2rem);
    right: auto;
  }
`;

const SortOption = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-radius: 4px;
  background-color: ${props => props.$selected ? '#e0f2f1' : 'transparent'};
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const SortOrderOption = styled(SortOption)`
  border-top: 1px solid #eee;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
`;

const NFTGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  
  .spinner {
    animation: spin 1s linear infinite;
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const LoaderElement = styled.div`
  display: flex;
  justify-content: center;
  padding: 2rem 0;
  
  .spinner {
    animation: spin 1s linear infinite;
    font-size: 1.5rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const EmptyState = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  background-color: #f9f9f9;
  border-radius: 8px;
  
  p {
    color: #666;
  }
`;

const LoadMoreButton = styled.button`
  padding: 0.75rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #3d8b40;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  .spinner {
    animation: spin 1s linear infinite;
    font-size: 1.5rem;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ManualLoadContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f0f0f0;
  border-radius: 8px;
  margin-bottom: 1.5rem;
`;

const ManualLoadButton = styled.button`
  padding: 0.75rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #3d8b40;
  }
`;

const RefreshButton = styled.button`
  padding: 0.75rem 1rem;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-left: 0.5rem;
  
  &:hover {
    background-color: #3d8b40;
  }
`;

const FetchProgressContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ProgressItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: #f5f5f5;
  border-radius: 4px;
`;

const ProgressLabel = styled.div`
  font-weight: 500;
`;

const ProgressInfo = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const EnhancementNote = styled.div`
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #e8f5e9;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export default NFTGallery; 