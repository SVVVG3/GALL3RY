import React, { createContext, useContext, useState, useEffect } from 'react';
import { useProfile } from '@farcaster/auth-kit';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  const farcasterAuth = useProfile();
  
  // Merge our context with Farcaster Auth Kit data for backward compatibility
  return {
    ...context,
    isAuthenticated: farcasterAuth.isAuthenticated,
    profile: farcasterAuth.isAuthenticated ? {
      fid: farcasterAuth.profile?.fid,
      username: farcasterAuth.profile?.username,
      displayName: farcasterAuth.profile?.displayName,
      // Using the avatar from Farcaster with proper fallback
      avatarUrl: farcasterAuth.profile?.pfp?.url || farcasterAuth.profile?.pfp || 'https://i.pravatar.cc/150?u=demo_user',
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