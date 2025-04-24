import React, { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import farcasterStateService from '../services/farcasterStateService';
import { useSelector } from 'react-redux';
import { selectFollowing } from '../redux/farcasterSlice';

/**
 * Component that loads Farcaster data automatically when user logs in
 * This is designed to be mounted once at the application level
 */
const FarcasterDataLoader = () => {
  const { authenticated, user } = usePrivy();
  const followingState = useSelector(selectFollowing);
  
  // Load Farcaster following when user is authenticated
  useEffect(() => {
    if (authenticated && user?.farcaster?.fid) {
      const fid = user.farcaster.fid;
      
      // Check if we need to fetch or refresh following data
      const needsFollowingData = (
        // No following data in Redux
        !followingState.users.length ||
        // Data is for a different FID
        followingState.fid !== fid ||
        // Data is stale (older than 60 minutes)
        (followingState.lastFetched && 
         Date.now() - followingState.lastFetched > 60 * 60 * 1000)
      );
      
      if (needsFollowingData && !followingState.isFetching) {
        console.log(`🔄 FarcasterDataLoader: Loading following data for FID ${fid}`);
        
        // Fetch following data
        farcasterStateService.getFollowing({ 
          fid,
          onComplete: (users) => {
            console.log(`✅ FarcasterDataLoader: Loaded ${users.length} following users for FID ${fid}`);
          }
        });
      } else {
        console.log(`✓ FarcasterDataLoader: Following data already loaded or being fetched`);
      }
    }
  }, [authenticated, user, followingState]);
  
  // This component doesn't render anything
  return null;
};

export default FarcasterDataLoader; 