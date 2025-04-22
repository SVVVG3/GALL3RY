import { configureStore } from '@reduxjs/toolkit';
import nftFiltersReducer from './nftFiltersSlice';

/**
 * Redux store configuration
 */
export const store = configureStore({
  reducer: {
    nftFilters: nftFiltersReducer,
    // Add more reducers here as needed
  }
});

export default store; 