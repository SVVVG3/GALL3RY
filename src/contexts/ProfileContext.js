import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Create the profile context
const ProfileContext = createContext();

/**
 * Custom hook to use the profile context
 * @returns {Object} The profile context value
 */
export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

/**
 * Provider component that wraps the app and makes profile data available
 * @param {Object} props - The component props
 * @param {React.ReactNode} props.children - The child components
 */
export const ProfileProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [profileData, setProfileData] = useState(null);

  // When auth state changes, update the profile data
  useEffect(() => {
    if (isAuthenticated && user) {
      // Use the user data from auth context as the initial profile data
      setProfileData({
        fid: user.fid,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.pfp?.url || null,
        bio: user.bio || '',
        followers: [],
        following: [],
        // Add any other profile fields needed
      });
    } else {
      // Reset profile data when logged out
      setProfileData(null);
    }
  }, [isAuthenticated, user]);

  /**
   * Fetch a user's profile by username or FID
   * @param {string|number} identifier - Username or FID
   * @returns {Promise<Object>} The profile data
   */
  const fetchProfile = async (identifier) => {
    try {
      setLoading(true);
      setError(null);
      
      // This is a placeholder for actual API fetch implementation
      // In a real app, you would fetch the profile data from your backend
      console.log(`Fetching profile for: ${identifier}`);
      
      // For now, just return a mock profile if the user is viewing their own profile
      if (user && 
          ((typeof identifier === 'string' && identifier === user.username) || 
           (typeof identifier === 'number' && identifier === user.fid))) {
        return profileData;
      }
      
      // Mock profile data for testing
      const mockProfile = {
        fid: typeof identifier === 'number' ? identifier : 12345,
        username: typeof identifier === 'string' ? identifier : `user${identifier}`,
        displayName: typeof identifier === 'string' ? identifier : `User ${identifier}`,
        avatarUrl: null,
        bio: 'This is a mock profile',
        followers: [],
        following: [],
      };
      
      return mockProfile;
    } catch (err) {
      setError(err.message || 'Failed to fetch profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update the current user's profile
   * @param {Object} updates - Profile fields to update
   * @returns {Promise<Object>} The updated profile
   */
  const updateProfile = async (updates) => {
    if (!isAuthenticated) {
      throw new Error('User must be authenticated to update profile');
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // This is a placeholder for actual API update implementation
      console.log('Updating profile with:', updates);
      
      // Update local state with the changes
      const updatedProfile = {
        ...profileData,
        ...updates,
      };
      
      setProfileData(updatedProfile);
      return updatedProfile;
    } catch (err) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Value object that will be provided to consumers
  const value = {
    profile: profileData,
    loading,
    error,
    fetchProfile,
    updateProfile,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export default ProfileContext; 