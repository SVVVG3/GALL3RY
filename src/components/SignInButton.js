import React, { useState, useEffect, useCallback, Suspense } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@farcaster/frame-sdk';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // Check if running in Mini App environment
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
  }, []);
  
  // Auto-redirect to profile page after sign-in
  useEffect(() => {
    if (isAuthenticated && profile && profile.username && !redirected) {
      console.log('User authenticated, profile available:', profile);
      setRedirected(true);
      
      // If in a Mini App, we might want to skip redirection or handle it differently
      if (!isInMiniApp) {
        navigate(`/user/${profile.username}`);
      }
    }
    
    // Reset redirected state if user logs out
    if (!isAuthenticated) {
      setRedirected(false);
    }
  }, [isAuthenticated, profile, navigate, redirected, isInMiniApp]);
  
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

  // Handle Mini App Sign In - using direct SDK access
  const handleMiniAppSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Generate a secure nonce
      const nonce = generateNonce();
      
      // Use the SDK directly to avoid any issues
      if (sdk.actions && typeof sdk.actions.signIn === 'function') {
        console.log('Using Farcaster Frame SDK for sign-in');
        const authResult = await sdk.actions.signIn({ nonce });
        console.log('Mini App direct auth result:', authResult);
        
        // Process the authentication result
        if (authResult) {
          // Try to extract FID from the message
          let fid = null;
          
          // Check for FID in data first
          if (authResult.data?.fid) {
            fid = authResult.data.fid;
          }
          // Fall back to parsing from message
          else if (authResult.message) {
            const fidMatch = authResult.message.match(/(?:fid|FID):\s*(\d+)/i);
            fid = fidMatch ? parseInt(fidMatch[1], 10) : null;
          }
          
          if (fid) {
            console.log('Extracted FID from auth result:', fid);
            // Create user info with FID
            const userInfo = {
              fid,
              username: authResult.data?.username || `user${fid}`,
              displayName: authResult.data?.displayName || `User ${fid}`,
              token: authResult.signature,
              message: authResult.message
            };
            
            // Login with this user info
            await login(userInfo);
            
            // Call success callback if provided
            if (onSuccess && typeof onSuccess === 'function') {
              onSuccess(userInfo);
            }
            
            return;
          }
        }
        
        throw new Error('Could not extract user info from authentication result');
      } else {
        throw new Error('Sign-in function not available in this environment');
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
    return (
      <div className="user-profile-dropdown">
        <div 
          className="user-profile-button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <img 
            src={profile.avatarUrl || profile.pfp || 'https://warpcast.com/~/icon-512.png'} 
            alt={profile.username}
            className="profile-avatar" 
            style={{width: '32px', height: '32px', borderRadius: '50%', marginRight: '8px'}}
          />
          <span className="profile-username">@{profile.username}</span>
        </div>
        
        {dropdownOpen && (
          <div className="dropdown-menu">
            <Link 
              to={`/user/${profile.username}`} 
              className="dropdown-item"
              onClick={() => setDropdownOpen(false)}
            >
              My Gallery
            </Link>
            <button 
              className="dropdown-item sign-out"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Not authenticated - show sign in button
  // Use different button for Mini App vs Web
  if (isInMiniApp) {
    return (
      <button
        onClick={handleMiniAppSignIn}
        className="btn btn-primary signin-button"
        disabled={isLoading}
      >
        Sign In with Farcaster
      </button>
    );
  }
  
  // For web, use the Farcaster Auth Kit button
  return <FarcasterSignInButton />;
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