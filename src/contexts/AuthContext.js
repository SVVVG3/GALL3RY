import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useProfile } from '@farcaster/auth-kit';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

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
  
  // Only log profile details on first authentication or when FID changes
  const profileFid = farcasterAuth.profile?.fid;
  
  // Using useMemo to create a properly formatted profile object that doesn't change unnecessarily
  const formattedProfile = useMemo(() => {
    if (!farcasterAuth.isAuthenticated || !farcasterAuth.profile) {
      // Check if we have manually set profile data (for Mini App auth)
      if (context.miniAppProfile) {
        return context.miniAppProfile;
      }
      return null;
    }
  
    // Only log profile data once when authenticated or when profile changes
    console.log('Farcaster Auth Profile:', farcasterAuth.profile);
    
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
  }, [farcasterAuth.isAuthenticated, farcasterAuth.profile, context.miniAppProfile]);
  
  // Determine if authenticated in any environment (web or Mini App)
  const isAuthenticated = farcasterAuth.isAuthenticated || context.isMiniAppAuthenticated;
  
  // Use Mini App profile if available, otherwise use the regular profile
  const profile = context.miniAppProfile || formattedProfile;
  
  // Merge our context with Farcaster Auth Kit data
  return {
    ...context,
    isAuthenticated,
    profile,
    loading: farcasterAuth.loading || context.loading,
  };
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [miniAppProfile, setMiniAppProfile] = useState(null);
  const [isMiniAppAuthenticated, setIsMiniAppAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if we're in a Mini App environment
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  
  // Create a reference to expose this context for direct imperative updates
  const authContextRef = React.useRef(null);
  
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
    
    // Check if we have stored auth data
    if (isBrowser) {
      try {
        const storedAuth = localStorage.getItem('farcaster_user');
        if (storedAuth) {
          const parsedAuth = JSON.parse(storedAuth);
          // Handle app reload with stored auth data
          if (parsedAuth.fid) {
            fetchUserDataByFid(parsedAuth.fid)
              .then(userData => {
                if (userData) {
                  setMiniAppProfile(userData);
                  setIsMiniAppAuthenticated(true);
                }
              })
              .catch(err => console.warn('Error restoring auth:', err));
          }
        }
      } catch (e) {
        console.warn('Error reading stored auth data:', e);
      }
    }
  }, []);
  
  // Fetch user data from Farcaster API by FID
  const fetchUserDataByFid = async (fid) => {
    try {
      setLoading(true);
      // In a real implementation, you would make an API call to fetch user data
      // For now, we'll simulate a response
      
      // This simulates fetching data from your API
      // In a real app, you would fetch this data from Farcaster's API or your own backend
      const userData = {
        fid,
        username: `user${fid}`, // Simulate username based on FID
        displayName: `User ${fid}`,
        avatarUrl: `https://warpcast.com/~/icon-512.png`, // Default avatar
        // Other profile data...
      };
      
      return userData;
    } catch (error) {
      console.error('Error fetching user data:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Values to share in context (these will be merged with Farcaster Auth Kit in useAuth)
  const value = {
    token,
    miniAppProfile,
    isMiniAppAuthenticated,
    loading,
    error,
    isInMiniApp,
    
    // Login method that works in both environments
    login: async (authData) => {
      try {
        setLoading(true);
        setError(null);
        
        // If we have FID data (from Mini App auth), fetch the complete profile
        if (authData && authData.fid) {
          console.log('Logging in with FID data in AuthContext:', authData.fid);
          
          // Fetch user data based on FID
          const userData = await fetchUserDataByFid(authData.fid);
          
          // Store the profile data
          setMiniAppProfile({
            ...userData,
            // Use FID from auth data
            fid: authData.fid,
            // Use token if provided
            token: authData.token
          });
          setIsMiniAppAuthenticated(true);
          
          // Store token if provided
          if (authData.token) {
            setToken(authData.token);
            if (isBrowser) {
              localStorage.setItem('auth_token', authData.token);
              // Also store minimal user info for persistence
              localStorage.setItem('farcaster_user', JSON.stringify({
                fid: authData.fid,
                timestamp: new Date().toISOString()
              }));
            }
          }
          
          return { success: true, profile: userData };
        }
        
        // Web app login is handled by Farcaster Auth Kit
        return { success: true };
      } catch (err) {
        setError(err);
        return { success: false, error: err };
      } finally {
        setLoading(false);
      }
    },
    
    // Logout method that works in both environments
    logout: () => {
      // Reset all auth state
      setToken(null);
      setMiniAppProfile(null);
      setIsMiniAppAuthenticated(false);
      
      // Clear stored data
      if (isBrowser) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_profile');
        localStorage.removeItem('farcaster_user');
      }
      
      // Note: Farcaster Auth Kit logout is handled by the kit itself
    }
  };

  // Expose the auth context through the ref for direct manipulation
  authContextRef.current = value;

  // Expose auth context on a DOM element for access from outside React
  return (
    <AuthContext.Provider value={value}>
      <div 
        style={{ display: 'none' }} 
        data-auth-context="true" 
        ref={node => {
          if (node) {
            node.__authContext = value;
          }
        }}
      />
      {children}
    </AuthContext.Provider>
  );
}; 