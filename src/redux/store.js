import { configureStore } from '@reduxjs/toolkit';
import nftFiltersReducer from './nftFiltersSlice';
import farcasterReducer from './farcasterSlice';

/**
 * Redux store configuration
 */
const store = configureStore({
  reducer: {
    nftFilters: nftFiltersReducer,
    farcaster: farcasterReducer,
    // Add more reducers here as needed
  }
});

export default store; 