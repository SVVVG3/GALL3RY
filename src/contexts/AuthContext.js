import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useProfile } from '@farcaster/auth-kit';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import { usePrivy } from '@privy-io/react-auth';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Helper function to get the profile image URL from Farcaster profile data
 * This follows the data structure outlined in the Farcaster Auth Kit documentation
 */
const getProfileImageUrl = (profile) => {
  if (!profile) return null;
  
  // Debug log the profile data structure
  console.log('Processing profile image data:', {
    pfpType: typeof profile.pfp,
    hasPfpUrl: profile.pfp && typeof profile.pfp === 'object' && !!profile.pfp.url,
    pfpDirectValue: typeof profile.pfp === 'string' ? profile.pfp : null,
    hasMetadata: !!profile.metadata,
    metadataImageUrl: profile.metadata?.imageUrl
  });

  // Handle pfp field from Auth Kit
  if (profile.pfp) {
    // pfp can be an object with a url property
    if (typeof profile.pfp === 'object' && profile.pfp.url) {
      return profile.pfp.url;
    }
    // pfp can be a direct string URL
    if (typeof profile.pfp === 'string') {
      return profile.pfp;
    }
  }
  
  // Try metadata.avatar or metadata.imageUrl
  if (profile.metadata) {
    if (profile.metadata.avatar) return profile.metadata.avatar;
    if (profile.metadata.imageUrl) return profile.metadata.imageUrl;
  }
  
  // Use Warpcast URL as fallback if we have a username
  if (profile.username) {
    return `https://warpcast.com/${profile.username}/pfp`;
  }
  
  // Last resort fallback
  return 'https://warpcast.com/~/icon-512.png';
};

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context with Privy
export const useAuth = () => {
  const context = useContext(AuthContext);
  const { user, authenticated, ready } = usePrivy();
  
  // Get Farcaster user information from Privy
  const farcasterUser = useMemo(() => {
    if (!authenticated || !user?.farcaster) {
      return null;
    }
    
    return {
      fid: user.farcaster.fid,
      username: user.farcaster.username,
      displayName: user.farcaster.displayName || user.farcaster.username,
      avatarUrl: user.farcaster.pfp,
      connectedAddresses: [],
      // Extra fields for compatibility with old code
      _rawProfile: user.farcaster
    };
  }, [authenticated, user]);
  
  // Create a unified API that's compatible with your existing code
  return {
    ...context,
    isAuthenticated: authenticated,
    profile: farcasterUser,
    loading: !ready || context.loading
  };
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Let Privy handle the authentication, just provide loading state
  const value = {
    loading,
    error,
    
    // Any additional functions needed for your app
    login: async () => {
      // This is a compatibility function for your existing code
      // Privy should handle login automatically
      console.log('Using Privy for login instead of AuthContext');
    }
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 