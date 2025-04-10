import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthKitProvider, useProfile } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';

// Create Auth context
const AuthContext = createContext(null);

// Farcaster AuthKit configuration
const authKitConfig = {
  domain: window.location.host,
  siweUri: `${window.location.origin}/login`,
  rpcUrl: 'https://mainnet.optimism.io', // Optimism RPC URL for Farcaster
};

// Provider component for Farcaster authentication
export const AuthProvider = ({ children }) => {
  return (
    <AuthKitProvider config={authKitConfig}>
      <AuthContextProvider>{children}</AuthContextProvider>
    </AuthKitProvider>
  );
};

// Internal provider that uses the Farcaster hooks
const AuthContextProvider = ({ children }) => {
  const { isAuthenticated, profile, logout } = useProfile();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // When profile state changes, we're no longer loading
    setLoading(false);
  }, [profile, isAuthenticated]);

  // Values to be provided to consumers of this context
  const authContextValue = {
    isAuthenticated,
    loading,
    profile,
    logout,
    // Add any custom auth methods here
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider; 