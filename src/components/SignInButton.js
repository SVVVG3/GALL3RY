import React, { useState, useEffect, useCallback, Suspense } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

// We won't dynamically import the Farcaster components to avoid initialization issues
import { SignInButton as FarcasterSignInButton, useProfile } from '@farcaster/auth-kit';

// Import Mini App utilities
import { isMiniAppEnvironment, handleMiniAppAuthentication } from '../utils/miniAppUtils';

// Check for browser environment
const isBrowser = typeof window !== 'undefined' && 
                 window.document !== undefined;

// Add a small CSS block for mobile-specific styles
const mobileStyles = `
  @media (max-width: 768px) {
    .user-profile-dropdown {
      display: flex !important;
    }
    .user-profile-button {
      display: flex !important;
      align-items: center !important;
    }
    .profile-username {
      display: block !important;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dropdown-arrow {
      display: inline-block !important;
      margin-left: 4px !important;
    }
  }
`;

// Generate a secure nonce for authentication
const generateNonce = () => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Enhanced SignInButton Component
 * With error handling and safe localStorage access
 * Supports both web and Mini App authentication methods
 */
const SignInButton = ({ onSuccess, redirectPath }) => {
  const { isAuthenticated, logout, profile, login } = useAuth();
  // Direct access to Farcaster auth kit for sign-in events
  const farcasterProfile = useProfile();
  
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  
  // Check if running in Mini App environment
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
  }, []);
  
  // Add direct console logging of Farcaster profile data
  useEffect(() => {
    if (farcasterProfile.isAuthenticated && farcasterProfile.profile) {
      console.log('Raw Farcaster Profile in SignInButton:', farcasterProfile.profile);
      console.log('Profile picture fields:', {
        pfp: farcasterProfile.profile?.pfp,
        pfpType: typeof farcasterProfile.profile?.pfp,
        pfpUrl: typeof farcasterProfile.profile?.pfp === 'object' ? farcasterProfile.profile?.pfp?.url : farcasterProfile.profile?.pfp,
        avatarUrl: profile?.avatarUrl
      });
    }
  }, [farcasterProfile.isAuthenticated, farcasterProfile.profile, profile]);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // Auto-redirect to profile page after sign-in
  useEffect(() => {
    if (isAuthenticated && profile && profile.username && !redirected) {
      console.log('User authenticated, redirecting to profile page:', profile.username);
      setRedirected(true);
      navigate(`/user/${profile.username}`);
    }
    
    // Reset redirected state if user logs out
    if (!isAuthenticated) {
      setRedirected(false);
    }
  }, [isAuthenticated, profile, navigate, redirected]);
  
  // Handle sign out with extra error protection
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check browser environment before trying to sign out
      if (!isBrowser) {
        throw new Error("Cannot sign out in non-browser environment");
      }
      
      await logout();
      
      // Call success callback if provided
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error);
    } finally {
      setIsLoading(false);
      setDropdownOpen(false);
      // Reset redirect flag
      setRedirected(false);
    }
  };

  // Handle Mini App Sign In
  const handleMiniAppSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate a secure nonce
      const nonce = generateNonce();
      
      // Use the Mini App SDK to initiate sign in
      const authResult = await handleMiniAppAuthentication(nonce);
      
      if (authResult) {
        console.log('Mini App authentication successful:', authResult);
        
        // Process the authentication result
        // We'll need to handle this on the server side in a production app
        // For now, we'll simulate a successful login with the authResult
        
        // Extract user info from the message
        const messageLines = authResult.message.split('\n');
        const fidLine = messageLines.find(line => line.includes('FID:'));
        const fid = fidLine ? parseInt(fidLine.split(':')[1].trim()) : null;
        
        if (fid) {
          // Fetch user info from your API using the FID
          // For now, simulating with a simple login
          await login({ fid });
          
          // Call success callback if provided
          if (onSuccess && typeof onSuccess === 'function') {
            onSuccess();
          }
        } else {
          throw new Error('Could not extract FID from authentication result');
        }
      } else {
        throw new Error('Authentication in Mini App environment failed');
      }
    } catch (error) {
      console.error('Error signing in via Mini App:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (dropdownOpen) {
      const handleClickOutside = (event) => {
        if (!event.target.closest('.user-profile-dropdown')) {
          setDropdownOpen(false);
        }
      };
      
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [dropdownOpen]);
  
  // If there's an error
  if (error) {
    return (
      <button 
        className="btn btn-error"
        onClick={() => setError(null)}
        title={error.message}
      >
        Error
      </button>
    );
  }
  
  // If loading
  if (isLoading) {
    return (
      <button 
        className="btn btn-primary"
        disabled
      >
        <span className="loading-indicator">Loading...</span>
      </button>
    );
  }
  
  // If authenticated, show user profile with dropdown
  if (isAuthenticated && profile) {
    console.log('Rendering authenticated user profile:', {
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      _rawProfile: profile._rawProfile,
      isLoggedIn: isAuthenticated
    });
    
    return (
      <>
        {/* Add style tag with mobile-specific styles */}
        <style>{mobileStyles}</style>
        <div className="user-profile-dropdown">
          <div 
            className="user-profile-button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className="profile-username">@{profile.username}</span>
            <svg 
              className={`dropdown-arrow ${dropdownOpen ? 'open' : ''}`} 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          
          {dropdownOpen && (
            <div className="dropdown-menu">
              <Link 
                to={`/user/${profile.username}`} 
                className="dropdown-item"
                onClick={() => setDropdownOpen(false)}
              >
                My Profile
              </Link>
              <button 
                onClick={handleSignOut}
                className="dropdown-item sign-out"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </>
    );
  }
  
  // If in Mini App environment, show Mini App sign in button
  if (isInMiniApp) {
    return (
      <button 
        className="btn btn-primary mini-app-sign-in-button"
        onClick={handleMiniAppSignIn}
      >
        Sign in with Farcaster
      </button>
    );
  }
  
  // Default for unauthenticated web app - use Farcaster Auth Kit
  return (
    <FarcasterSignInButton />
  );
};

// Fallback button shown when the real one fails
const FallbackSignInButton = () => (
  <button className="btn btn-primary">
    Sign in
  </button>
);

// Simple error boundary for the sign-in button
class ErrorBoundaryWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Sign-in button error:", error);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackSignInButton />;
    }

    return this.props.children;
  }
}

export default SignInButton; 