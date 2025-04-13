import React, { useEffect, useRef, useState } from 'react';
import NFTCard from './NFTCard';
import { useNFT } from '../contexts/NFTContext';
import { useWallet } from '../contexts/WalletContext';
import { FaFilter, FaSort, FaSpinner, FaCheck, FaBolt, FaClock } from 'react-icons/fa';
import styled from 'styled-components';

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
    loadMoreNFTs,
    fetchNFTs,
    endCursor
  } = useNFT();
  
  const { connectedWallets } = useWallet();
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const loaderRef = useRef(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Initial load of NFTs when wallets are connected
  useEffect(() => {
    if (connectedWallets && connectedWallets.length > 0 && initialLoad) {
      fetchNFTs();
      setInitialLoad(false);
    }
  }, [connectedWallets, fetchNFTs, initialLoad]);

  // Automatically continue loading NFTs until we hit a reasonable threshold or hasMore becomes false
  // This helps ensure we load enough NFTs even with the pagination limits
  useEffect(() => {
    const AUTO_LOAD_THRESHOLD = 300; // Reduced from 1000 to 300 to be less aggressive
    
    const autoLoadCheck = () => {
      console.log("AUTO-LOAD CHECK: userNfts=" + filteredNFTs.length + ", hasMore=" + hasMore + ", isLoading=" + isLoading + ", loadingMore=" + loadingMore);
      
      // Fix the auto-loading logic - REMOVE arbitrary 200 NFT check
      // The goal is to load up to AUTO_LOAD_THRESHOLD NFTs automatically
      const shouldAutoLoad = filteredNFTs.length < AUTO_LOAD_THRESHOLD;
      
      // If we have 'hasMore' true, not currently loading, and haven't hit the threshold yet, load more
      if (hasMore && !isLoading && !loadingMore && shouldAutoLoad) {
        console.log(`Auto-loading next batch of NFTs (current count: ${filteredNFTs.length}/${AUTO_LOAD_THRESHOLD})...`);
        
        // Significantly increased delay to avoid rate limiting
        setTimeout(() => {
          loadMoreNFTs();
        }, 1500); // 1.5 seconds between auto-loads
      } else {
        console.log(`Auto-loading stopped: hasMore=${hasMore}, isLoading=${isLoading}, loadingMore=${loadingMore}, shouldAutoLoad=${shouldAutoLoad}`);
      }
    };
    
    // Check if we should auto-load more NFTs when filteredNFTs, hasMore, or loading state changes
    if (filteredNFTs.length > 0) {
      autoLoadCheck();
    }
  }, [filteredNFTs.length, hasMore, isLoading, loadingMore, loadMoreNFTs]);

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
        bypassCache: true // Ensure we're getting fresh data
      });
    }
  };

  return (
    <GalleryContainer>
      <GalleryHeader>
        <h2>My NFTs {filteredNFTs.length > 0 && <span>({filteredNFTs.length})</span>}</h2>
        <ControlsContainer>
          <SearchBox
            type="text"
            placeholder="Search NFTs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          
          <FilterButton onClick={() => setShowFilters(!showFilters)}>
            <FaFilter /> Filters
          </FilterButton>
          
          <SortButton onClick={() => setShowSortMenu(!showSortMenu)}>
            <FaSort /> Sort
          </SortButton>
          
          <SpeedToggle $active={prioritizeSpeed} onClick={toggleSpeedMode}>
            {prioritizeSpeed ? <FaBolt /> : <FaClock />}
            {prioritizeSpeed ? 'Speed' : 'Complete'}
          </SpeedToggle>
        </ControlsContainer>
      </GalleryHeader>

      {/* Display NFT count and manual load button if we have NFTs */}
      {filteredNFTs.length > 0 && hasMore && (
        <ManualLoadContainer>
          <p>Showing {filteredNFTs.length} NFTs {hasMore ? "(more available)" : ""}</p>
          {!isLoading && !loadingMore && (
            <ManualLoadButton onClick={handleManualLoadMore}>
              Load Next 24 NFTs
            </ManualLoadButton>
          )}
        </ManualLoadContainer>
      )}

      {showFilters && (
        <FiltersPanel>
          <FilterSection>
            <h3>Chains</h3>
            <FilterList>
              {chains.map(chain => (
                <FilterItem
                  key={chain.id}
                  $selected={selectedChains.includes(chain.id)}
                  onClick={() => handleChainSelect(chain.id)}
                >
                  {chain.name} ({chain.count})
                  {selectedChains.includes(chain.id) && <FaCheck />}
                </FilterItem>
              ))}
            </FilterList>
          </FilterSection>

          <FilterSection>
            <h3>Collections</h3>
            <FilterList>
              {collections.map(collection => (
                <FilterItem
                  key={collection.id}
                  $selected={selectedCollections.includes(collection.id)}
                  onClick={() => handleCollectionSelect(collection.id)}
                >
                  {collection.name} ({collection.count})
                  {selectedCollections.includes(collection.id) && <FaCheck />}
                </FilterItem>
              ))}
            </FilterList>
          </FilterSection>
        </FiltersPanel>
      )}

      {showSortMenu && (
        <SortMenu>
          <SortOption
            $selected={sortBy === 'value' || sortBy === 'estimatedValue'}
            onClick={() => {
              console.log("Setting sort to value");
              setSortBy('value');
              setSortOrder('desc');
            }}
          >
            Value {(sortBy === 'value' || sortBy === 'estimatedValue') && <FaCheck />}
          </SortOption>
          <SortOption
            $selected={sortBy === 'name'}
            onClick={() => setSortBy('name')}
          >
            Name (A-Z) {sortBy === 'name' && <FaCheck />}
          </SortOption>
          <SortOption
            $selected={sortBy === 'collection'}
            onClick={() => setSortBy('collection')}
          >
            Collection {sortBy === 'collection' && <FaCheck />}
          </SortOption>
          <SortOption
            $selected={sortBy === 'acquiredAt' || sortBy === 'recent'}
            onClick={() => setSortBy('recent')}
          >
            Acquisition Date {(sortBy === 'acquiredAt' || sortBy === 'recent') && <FaCheck />}
          </SortOption>
          <SortOrderOption onClick={toggleSortOrder}>
            Order: {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </SortOrderOption>
        </SortMenu>
      )}

      {isLoading && !loadingMore ? (
        <LoadingContainer>
          <FaSpinner className="spinner" />
          <p>Loading your NFTs...</p>
        </LoadingContainer>
      ) : filteredNFTs.length === 0 ? (
        <EmptyState>
          <p>No NFTs found. Connect a wallet or try different filters.</p>
        </EmptyState>
      ) : (
        <NFTGrid>
          {filteredNFTs.map(nft => (
            <NFTCard key={nft.id || `${nft.collection?.address}-${nft.tokenId}`} nft={nft} />
          ))}
        </NFTGrid>
      )}

      {(hasMore || loadingMore) && (
        <LoaderElement ref={loaderRef}>
          {loadingMore ? (
            <LoadingSpinner>
              <FaSpinner className="spinner" /> 
              <span>Loading more NFTs...</span>
            </LoadingSpinner>
          ) : (
            <LoadMoreButton onClick={loadMoreNFTs}>
              Load More NFTs
            </LoadMoreButton>
          )}
        </LoaderElement>
      )}
    </GalleryContainer>
  );
};

// Styled components
const GalleryContainer = styled.div`
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
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

const SearchBox = styled.input`
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  min-width: 200px;
  
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
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1.5rem;
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

export default NFTGallery; 