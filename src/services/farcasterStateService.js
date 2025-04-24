import store from '../redux/store';
import { 
  fetchFollowingStart, 
  fetchFollowingSuccess, 
  fetchFollowingFailure,
  setProfile,
  setProfileLoading,
  setProfileError
} from '../redux/farcasterSlice';
import { fetchAllFollowing } from './farcasterService';
import farcasterService from './farcasterService';

// Cache TTL in milliseconds (15 minutes)
const CACHE_TTL = 15 * 60 * 1000;

/**
 * Service for managing Farcaster state in Redux
 */
const farcasterStateService = {
  /**
   * Get the current user's Farcaster following list
   * Will fetch from API if not already in state or if force refresh is requested
   * 
   * @param {Object} options - Options for fetching
   * @param {number} options.fid - Farcaster ID to fetch following for
   * @param {boolean} options.forceRefresh - Whether to force a refresh from API
   * @param {function} options.onComplete - Callback when fetch is complete (optional)
   * @returns {Promise<Array>} - Array of following users
   */
  getFollowing: async ({ fid, forceRefresh = false, onComplete }) => {
    if (!fid) {
      console.error('FID is required to fetch following list');
      return [];
    }

    const state = store.getState().farcaster.following;
    
    // If we already have following data for this FID and it's not stale, return it
    if (
      !forceRefresh && 
      state.users.length > 0 && 
      state.fid === fid &&
      state.lastFetched && 
      (Date.now() - state.lastFetched < CACHE_TTL)
    ) {
      console.log(`Using cached following list for FID ${fid} from Redux store`);
      if (onComplete) onComplete(state.users);
      return state.users;
    }

    // Start the fetch process
    store.dispatch(fetchFollowingStart(fid));

    try {
      console.log(`Fetching following list for FID ${fid} from API`);
      const result = await fetchAllFollowing(fid);
      
      if (!result || !result.users) {
        const errorMsg = 'Failed to fetch following list: Invalid response format';
        console.error(errorMsg);
        store.dispatch(fetchFollowingFailure(errorMsg));
        if (onComplete) onComplete([]);
        return [];
      }

      console.log(`Fetched ${result.users.length} following users for FID ${fid}`);
      store.dispatch(fetchFollowingSuccess(result));
      
      if (onComplete) onComplete(result.users);
      return result.users;
    } catch (error) {
      console.error(`Error fetching following list for FID ${fid}:`, error);
      store.dispatch(fetchFollowingFailure(error.message));
      if (onComplete) onComplete([]);
      return [];
    }
  },

  /**
   * Get a Farcaster profile
   * 
   * @param {Object} options - Options for fetching
   * @param {number|string} options.fid - Farcaster ID 
   * @param {string} options.username - Farcaster username (alternative to FID)
   * @param {boolean} options.forceRefresh - Whether to force refresh from API
   * @returns {Promise<Object|null>} - The profile data or null if not found
   */
  getProfile: async ({ fid, username, forceRefresh = false }) => {
    if (!fid && !username) {
      console.error('Either FID or username is required to fetch profile');
      store.dispatch(setProfileError('Missing FID or username'));
      return null;
    }

    store.dispatch(setProfileLoading(true));

    try {
      let profile;
      if (fid) {
        profile = await farcasterService.getProfile({ fid });
      } else {
        profile = await farcasterService.getProfile({ username });
      }

      if (!profile) {
        store.dispatch(setProfileError('Profile not found'));
        return null;
      }

      store.dispatch(setProfile(profile));
      return profile;
    } catch (error) {
      console.error('Error fetching Farcaster profile:', error);
      store.dispatch(setProfileError(error.message));
      return null;
    }
  }
};

export default farcasterStateService; 