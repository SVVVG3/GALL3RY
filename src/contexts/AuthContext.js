import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing auth on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedProfile = localStorage.getItem('auth_profile');
    
    if (storedToken && storedProfile) {
      setToken(storedToken);
      setProfile(JSON.parse(storedProfile));
      setIsAuthenticated(true);
    }
    
    setLoading(false);
  }, []);

  // Login function - in a real app, this would authenticate with a server
  const login = async (farcasterCredentials) => {
    try {
      // This is a mock login for demo purposes
      // In a real app, you would validate credentials with a server
      
      // For demo, we'll create a mock profile
      const mockProfile = {
        fid: '123456',
        username: 'demo_user',
        displayName: 'Demo User',
        avatarUrl: 'https://i.pravatar.cc/150?u=demo_user',
        connectedAddresses: ['0x1234...5678'],
      };
      
      // Generate a mock token
      const mockToken = 'mock_token_' + Math.random().toString(36).substring(2);
      
      // Save to state
      setProfile(mockProfile);
      setToken(mockToken);
      setIsAuthenticated(true);
      
      // Save to localStorage for persistence
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('auth_profile', JSON.stringify(mockProfile));
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error };
    }
  };

  // Logout function
  const logout = () => {
    setProfile(null);
    setToken(null);
    setIsAuthenticated(false);
    
    // Remove from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_profile');
  };

  // Values to share in context
  const value = {
    isAuthenticated,
    profile,
    token,
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 