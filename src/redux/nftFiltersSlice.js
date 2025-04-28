import { createSlice } from '@reduxjs/toolkit';

/**
 * Redux slice for managing NFT filtering and sorting state
 */
const nftFiltersSlice = createSlice({
  name: 'nftFilters',
  initialState: {
    searchTerm: '',
    sortOption: 'recent',     // Default to recent sorting
    sortDirection: 'desc',    // Default sort direction
    nftList: [],               // List of NFTs to be filtered
    filters: {
      collections: [],         // Collections to filter by
      traits: {},              // Traits to filter by
    }
  },
  reducers: {
    // Set the search term for filtering NFTs
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    
    // Set the sort option for NFTs
    setSortOption: (state, action) => {
      state.sortOption = action.payload;
    },
    
    // Set the sort direction (asc/desc)
    setSortDirection: (state, action) => {
      state.sortDirection = action.payload;
    },
    
    // Set the list of NFTs to be filtered
    setNftList: (state, action) => {
      state.nftList = action.payload || [];
    },
    
    // Set collection filters
    setCollectionFilters: (state, action) => {
      state.filters.collections = action.payload;
    },
    
    // Set trait filters
    setTraitFilters: (state, action) => {
      state.filters.traits = action.payload;
    },
    
    // Clear all filters
    clearFilters: (state) => {
      state.searchTerm = '';
      state.filters.collections = [];
      state.filters.traits = {};
    }
  }
});

// Export actions
export const {
  setSearchTerm,
  setSortOption,
  setSortDirection,
  setNftList,
  setCollectionFilters,
  setTraitFilters,
  clearFilters
} = nftFiltersSlice.actions;

// Export reducer
export default nftFiltersSlice.reducer; 