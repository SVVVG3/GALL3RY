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

// Check for direct Warpcast mobile environment
const isWarpcastMobile = () => {
  return typeof window !== 'undefined' && 
    (window.navigator.userAgent.includes('Warpcast') || 
     typeof window.__WARPCAST__ !== 'undefined' ||
     (typeof window.webkit !== 'undefined' && 
      /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)));
};

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
  const [isInWarpcastMobile, setIsInWarpcastMobile] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [redirected, setRedirected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  
  // Check if running in Mini App environment
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
    setIsInWarpcastMobile(isWarpcastMobile());
    
    // If we're in Warpcast mobile, prioritize context-based auth immediately
    if (isWarpcastMobile() && !isAuthenticated) {
      console.log("SignInButton: Detected Warpcast mobile, attempting immediate context auth");
      (async () => {
        try {
          setIsLoading(true);
          const context = await sdk.getContext();
          
          if (context && context.user && context.user.fid) {
            const userData = {
              fid: context.user.fid,
              username: context.user.username || `user${context.user.fid}`,
              displayName: context.user.displayName || `User ${context.user.fid}`,
              pfp: context.user.pfpUrl || null,
              token: 'context-auth' // Special marker to indicate auth from context
            };
            
            console.log("SignInButton: Auto-login from Warpcast context:", userData);
            await login(userData);
          }
        } catch (error) {
          console.warn("SignInButton: Error in initial context check:", error);
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [isAuthenticated, login]);
  
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
        
        // First, try to get context - might already have user info on mobile
        let userData = null;
        
        try {
          const context = await sdk.getContext();
          console.log('Mini App context:', context);
          
          // If we have user info in the context, use that directly
          if (context && context.user && context.user.fid) {
            userData = {
              fid: context.user.fid,
              username: context.user.username || `user${context.user.fid}`,
              displayName: context.user.displayName || `User ${context.user.fid}`,
              pfp: context.user.pfpUrl || null,
              token: 'context-auth' // Mark this as context-based auth
            };
            
            console.log('User already authenticated in Warpcast, using context data:', userData);
            await login(userData);
            
            if (onSuccess && typeof onSuccess === 'function') {
              onSuccess(userData);
            }
            
            return;
          }
        } catch (contextError) {
          console.warn('Error getting Mini App context:', contextError);
        }
        
        // If we couldn't get user data from context, try the sign-in method
        console.log('No user data in context, attempting sign-in with nonce:', nonce);
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
            userData = {
              fid,
              username: authResult.data?.username || `user${fid}`,
              displayName: authResult.data?.displayName || `User ${fid}`,
              token: authResult.signature,
              message: authResult.message
            };
            
            // Login with this user info
            await login(userData);
            
            // Call success callback if provided
            if (onSuccess && typeof onSuccess === 'function') {
              onSuccess(userData);
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
      
      // Make sure splash screen is dismissed regardless of auth result
      try {
        if (sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
        }
      } catch (e) {
        console.warn('Error dismissing splash screen after sign-in attempt:', e);
      }
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
  
  // If in Mini App environment, use the Mini App SignInButton
  if (isInMiniApp) {
    // Special case for Warpcast Mobile - show a more specific button
    if (isInWarpcastMobile) {
      return (
        <button 
          className="btn btn-primary sign-in-button warpcast-mobile-signin"
          onClick={handleMiniAppSignIn}
          disabled={isLoading}
        >
          {isLoading ? 'Signing In...' : 'Sign In with Warpcast'}
        </button>
      );
    }
    
    return (
      <button 
        className="btn btn-primary sign-in-button mini-app-signin"
        onClick={handleMiniAppSignIn}
        disabled={isLoading}
      >
        {isLoading ? 'Signing In...' : 'Sign In with Farcaster'}
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