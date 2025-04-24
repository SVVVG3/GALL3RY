import { createSlice } from '@reduxjs/toolkit';

/**
 * Redux slice for managing Farcaster-related state
 */
const farcasterSlice = createSlice({
  name: 'farcaster',
  initialState: {
    following: {
      users: [],              // List of users the current user follows
      lastFetched: null,      // Timestamp of last fetch
      isFetching: false,      // Whether a fetch is in progress
      error: null,            // Any error that occurred during fetch
      fid: null               // FID that this following list belongs to
    },
    profile: {
      data: null,             // Current user's Farcaster profile
      lastFetched: null,      // Timestamp of last fetch
      isFetching: false,      // Whether a fetch is in progress
      error: null             // Any error that occurred during fetch
    }
  },
  reducers: {
    // Start loading the following list
    fetchFollowingStart: (state, action) => {
      state.following.isFetching = true;
      state.following.error = null;
      if (action.payload) {
        state.following.fid = action.payload;
      }
    },

    // Successfully fetched following list
    fetchFollowingSuccess: (state, action) => {
      state.following.isFetching = false;
      state.following.users = action.payload.users || [];
      state.following.lastFetched = Date.now();
      state.following.error = null;
    },

    // Failed to fetch following list
    fetchFollowingFailure: (state, action) => {
      state.following.isFetching = false;
      state.following.error = action.payload;
    },

    // Clear following list
    clearFollowing: (state) => {
      state.following.users = [];
      state.following.lastFetched = null;
      state.following.fid = null;
    },

    // Set user profile
    setProfile: (state, action) => {
      state.profile.data = action.payload;
      state.profile.lastFetched = Date.now();
      state.profile.error = null;
    },

    // Set profile loading state
    setProfileLoading: (state, action) => {
      state.profile.isFetching = action.payload;
    },

    // Set profile error
    setProfileError: (state, action) => {
      state.profile.error = action.payload;
      state.profile.isFetching = false;
    }
  }
});

// Export actions
export const {
  fetchFollowingStart,
  fetchFollowingSuccess,
  fetchFollowingFailure,
  clearFollowing,
  setProfile,
  setProfileLoading,
  setProfileError
} = farcasterSlice.actions;

// Export selectors
export const selectFollowing = (state) => state.farcaster.following;
export const selectProfile = (state) => state.farcaster.profile;

// Export reducer
export default farcasterSlice.reducer; 