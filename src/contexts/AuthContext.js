import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfile } from '@farcaster/auth-kit';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  const farcasterAuth = useProfile();
  
  // Log Farcaster Auth profile data for debugging
  if (farcasterAuth.isAuthenticated && farcasterAuth.profile) {
    console.log('Farcaster Auth Profile:', farcasterAuth.profile);
    console.log('Profile picture data:', {
      pfp: farcasterAuth.profile?.pfp,
      pfpUrl: farcasterAuth.profile?.pfp?.url
    });
  }
  
  // Get the correct avatar URL with consistent handling
  const getAvatarUrl = () => {
    if (!farcasterAuth.isAuthenticated || !farcasterAuth.profile) return 'https://i.pravatar.cc/150?u=demo_user';
    
    // First try pfp.url which is typically provided by Farcaster
    if (farcasterAuth.profile.pfp?.url) return farcasterAuth.profile.pfp.url;
    
    // Next try the pfp itself which might be a string URL
    if (typeof farcasterAuth.profile.pfp === 'string') return farcasterAuth.profile.pfp;
    
    // Finally fall back to the avatar placeholder
    return 'https://i.pravatar.cc/150?u=demo_user';
  };
  
  // Merge our context with Farcaster Auth Kit data for backward compatibility
  return {
    ...context,
    isAuthenticated: farcasterAuth.isAuthenticated,
    profile: farcasterAuth.isAuthenticated ? {
      fid: farcasterAuth.profile?.fid,
      username: farcasterAuth.profile?.username,
      displayName: farcasterAuth.profile?.displayName,
      // Using consistent avatar URL handling
      avatarUrl: getAvatarUrl(),
      connectedAddresses: [], // We'll get these from user profile data later
    } : null,
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
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_profile');
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 