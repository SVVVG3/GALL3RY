import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfile } from '@farcaster/auth-kit';

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

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  const farcasterAuth = useProfile();
  
  // Log Farcaster Auth profile data for debugging
  if (farcasterAuth.isAuthenticated && farcasterAuth.profile) {
    console.log('Farcaster Auth Profile:', farcasterAuth.profile);
    console.log('Profile picture fields:', {
      pfp: farcasterAuth.profile?.pfp,
      pfpType: typeof farcasterAuth.profile?.pfp,
      pfpUrl: typeof farcasterAuth.profile?.pfp === 'object' ? farcasterAuth.profile?.pfp?.url : farcasterAuth.profile?.pfp,
      username: farcasterAuth.profile?.username,
      fid: farcasterAuth.profile?.fid || 'No fid'
    });
    
    // Store user info in localStorage for persistence
    if (isBrowser) {
      try {
        localStorage.setItem('farcaster_user', JSON.stringify({
          username: farcasterAuth.profile.username,
          fid: farcasterAuth.profile.fid,
          timestamp: new Date().toISOString()
        }));
      } catch (e) {
        console.warn('Failed to save user info to localStorage:', e);
      }
    }
  }
  
  // Create a properly formatted profile object from Farcaster Auth data
  const getFormattedProfile = () => {
    if (!farcasterAuth.isAuthenticated || !farcasterAuth.profile) {
      return null;
    }
    
    return {
      fid: farcasterAuth.profile.fid,
      username: farcasterAuth.profile.username,
      displayName: farcasterAuth.profile.displayName || farcasterAuth.profile.username,
      avatarUrl: getProfileImageUrl(farcasterAuth.profile),
      connectedAddresses: farcasterAuth.profile.verifications || [],
      // Extra fields for search functionality
      custodyAddress: farcasterAuth.profile.custody_address || farcasterAuth.profile.custodyAddress,
      // Include the raw profile for debugging
      _rawProfile: farcasterAuth.profile
    };
  };
  
  // Merge our context with Farcaster Auth Kit data
  return {
    ...context,
    isAuthenticated: farcasterAuth.isAuthenticated,
    profile: getFormattedProfile(),
    loading: farcasterAuth.loading,
  };
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  
  // Values to share in context (these will be merged with Farcaster Auth Kit in useAuth)
  const value = {
    token,
    // These methods will use Farcaster Auth Kit under the hood
    login: async () => {
      // No need to implement actual login logic here as it's handled by Farcaster Auth Kit
      return { success: true };
    },
    logout: () => {
      // No need to implement actual logout logic here as it's handled by Farcaster Auth Kit
      // The local token might still be useful for API calls
      setToken(null);
      if (isBrowser) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_profile');
      }
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 