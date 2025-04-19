import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@farcaster/frame-sdk';
// Remove Next.js router import and use useNavigate from react-router-dom instead
// import { useRouter } from 'next/router';
import { cn } from '../utils/cn';
import Avatar from './Avatar';
import styled from 'styled-components';
import { FiArrowRight } from 'react-icons/fi';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import { signInWithFarcaster } from '../utils/authUtils';
import { useProfile } from '../contexts/ProfileContext';

// We won't dynamically import the Farcaster components to avoid initialization issues
import { SignInButton as FarcasterSignInButton, useProfile as FarcasterUseProfile } from '@farcaster/auth-kit';

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
const SignInButton = ({ onSuccess, onError, label, className, buttonStyle, showLabel = true, miniAppMode = 'auto', fullWidth, children, ...props }) => {
  const [authError, setAuthError] = useState(null);
  const { isAuthenticated, user, loading, login } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  
  // Additional state for the mini app environment
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [miniAppAuthInProgress, setMiniAppAuthInProgress] = useState(false);
  
  useEffect(() => {
    // Check if we're in a mini app environment
    const isInMiniApp = isMiniAppEnvironment();
    setIsMiniApp(isInMiniApp);
    
    // Listen for mini app authentication events
    const handleMiniAppAuth = (event) => {
      console.log('Received miniAppAuthenticated event with data:', event.detail);
      
      if (event.detail) {
        // Get user info from the event detail
        const userInfo = event.detail;
        
        // Make sure we have the username in the event detail
        if (userInfo.username || userInfo.fid) {
          // Ensure username exists, use fid as fallback
          const username = userInfo.username || `user${userInfo.fid}`;
          console.log('Mini app authentication successful with username:', username);
          
          // Update the local state if needed
          
          // Call onSuccess callback if provided
          if (typeof onSuccess === 'function') {
            onSuccess({
              fid: userInfo.fid,
              username: username,
              displayName: userInfo.displayName || username,
              pfp: userInfo.pfp
            });
          }
        } else {
          console.error('Mini app authentication event missing username and fid!', event.detail);
          setAuthError('Failed to get username from authentication');
          
          // Call onError callback if provided
          if (typeof onError === 'function') {
            onError(new Error('Authentication missing username'));
          }
        }
      }
    };
    
    window.addEventListener('miniAppAuthenticated', handleMiniAppAuth);
    
    // Clean up event listener
    return () => {
      window.removeEventListener('miniAppAuthenticated', handleMiniAppAuth);
    };
  }, [onSuccess, onError]);
  
  // Auto-authenticate in mini app environment if desired
  useEffect(() => {
    const autoAuth = async () => {
      if (isMiniApp && (miniAppMode === 'auto' || miniAppMode === true) && !isAuthenticated && !miniAppAuthInProgress) {
        try {
          setMiniAppAuthInProgress(true);
          console.log('Auto-initiating mini app authentication');
          await directMiniAppSignIn();
        } catch (error) {
          console.error('Error during auto mini app authentication:', error);
          setAuthError('Error during authentication');
        } finally {
          setMiniAppAuthInProgress(false);
        }
      }
    };
    
    autoAuth();
  }, [isMiniApp, miniAppMode, isAuthenticated, miniAppAuthInProgress]);

  // Create a global function to update auth state (used by miniAppUtils)
  useEffect(() => {
    if (!isMiniApp) return; // Only needed in Mini App environment
    
    window.updateAuthState = ({ user, isAuthenticated }) => {
      // This will be called from miniAppUtils.js when auth happens
      console.log('SignInButton: updateAuthState called with', { user, isAuthenticated });
      
      if (!user || !user.fid) {
        console.error('SignInButton: updateAuthState called with invalid user data', user);
        return;
      }
      
      // Ensure username exists
      const username = user.username || `user${user.fid}`;
      
      // Store user info in localStorage for persistence
      const userInfo = {
        fid: user.fid,
        username: username,
        displayName: user.displayName || username,
        pfp: user.pfp || { url: null }
      };
      
      // Store in both localStorage keys for consistency
      try {
        localStorage.setItem('farcaster_user', JSON.stringify(userInfo));
        localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
      } catch (e) {
        console.error('Error storing user info in localStorage:', e);
      }
      
      // Dispatch an event that our context will pick up
      const event = new CustomEvent('miniAppAuthenticated', {
        detail: userInfo
      });
      window.dispatchEvent(event);
    };
    
    return () => {
      window.updateAuthState = undefined;
    };
  }, [isMiniApp]);

  // Create an inline SVG for the Farcaster logo to ensure it always renders
  const FarcasterLogoSvg = () => (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      style={{ marginRight: '6px' }}
    >
      <path 
        d="M16 0C7.163 0 0 7.163 0 16C0 24.837 7.163 32 16 32C24.837 32 32 24.837 32 16C32 7.163 24.837 0 16 0ZM10.24 6.4H21.76V12.8C21.76 14.256 21.183 15.652 20.154 16.681C19.126 17.709 17.73 18.286 16.274 18.286H10.24V6.4ZM6.4 25.6V6.4H8.96V19.525C8.96 19.871 9.097 20.203 9.342 20.448C9.588 20.692 9.92 20.829 10.266 20.829H16.274C18.314 20.829 20.27 20.036 21.712 18.595C23.153 17.153 23.946 15.197 23.946 13.157V6.4H25.6V25.6H23.04V22.4H8.96V25.6H6.4Z" 
        fill="currentColor"
      />
    </svg>
  );

  // Direct implementation of sign-in using the SDK
  const directMiniAppSignIn = async () => {
    console.log("Starting direct Mini App sign-in flow");
    
    try {
      // Check if SDK is defined
      if (!sdk) {
        console.error("SDK is undefined in directMiniAppSignIn");
        setAuthError("SDK not available");
        return { success: false, error: "SDK not available" };
      }
      
      console.log("SDK status:", {
        defined: !!sdk,
        hasContext: sdk && !!sdk.context,
        hasActions: sdk && !!sdk.actions,
        hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function'
      });
      
      // STEP 1: First try to get user from sdk.context directly
      if (sdk.context && sdk.context.user && sdk.context.user.fid) {
        console.log("Found user in sdk.context:", {
          hasFid: !!sdk.context.user.fid,
          hasUsername: !!sdk.context.user.username
        });
        
        try {
          // Create a clean object with primitive values
          const userData = {
            fid: Number(sdk.context.user.fid),
            username: sdk.context.user.username || `user${sdk.context.user.fid}`,
            displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
            pfp: { url: sdk.context.user.pfpUrl || null }
          };
          
          console.log("Created user data from context:", userData);
          
          // Store as JSON in localStorage
          localStorage.setItem('farcaster_user', JSON.stringify(userData));
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          
          // Update auth context
          if (typeof login === 'function') {
            await login(userData);
          }
          
          // Dispatch event
          const event = new CustomEvent('miniAppAuthenticated', {
            detail: {
              fid: userData.fid,
              username: userData.username,
              displayName: userData.displayName,
              pfp: userData.pfp
            }
          });
          window.dispatchEvent(event);
          console.log("Dispatched authentication event");
          
          if (typeof onSuccess === 'function') {
            onSuccess(userData);
          }
          
          return { success: true, user: userData };
        } catch (error) {
          console.error("Error processing context:", error);
        }
      } else {
        console.log("No user found in sdk.context, will try sign-in");
      }
      
      // STEP 2: If no context, try sign-in
      if (!sdk.actions || typeof sdk.actions.signIn !== 'function') {
        console.error("SignIn action not available");
        setAuthError("SignIn action not available");
        return { success: false, error: "SignIn action not available" };
      }
      
      // Generate nonce for authentication
      const nonce = generateNonce();
      console.log("Generated nonce:", nonce);
      
      try {
        console.log("Calling sdk.actions.signIn()");
        const signInResult = await sdk.actions.signIn({ nonce });
        console.log("Sign-in result:", signInResult);
        
        // After sign-in, check context again
        let userData = null;
        
        // Try to get user info from context after sign-in
        if (sdk.context && sdk.context.user && sdk.context.user.fid) {
          userData = {
            fid: Number(sdk.context.user.fid),
            username: sdk.context.user.username || `user${sdk.context.user.fid}`,
            displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
            pfp: { url: sdk.context.user.pfpUrl || null }
          };
          console.log("Got user data from context after sign-in:", userData);
        }
        // If no context, try to extract from sign-in result
        else if (signInResult && signInResult.message) {
          try {
            // Attempt to parse message for user info
            const message = typeof signInResult.message === 'string' 
              ? JSON.parse(signInResult.message) 
              : signInResult.message;
            
            if (message && message.fid) {
              userData = {
                fid: Number(message.fid),
                username: message.username || `user${message.fid}`,
                displayName: message.displayName || message.username || `User ${message.fid}`,
                pfp: { url: message.pfpUrl || null }
              };
              console.log("Extracted user data from sign-in result:", userData);
            }
          } catch (parseError) {
            console.error("Error parsing sign-in result:", parseError);
          }
        }
        
        if (userData) {
          // Store user info
          localStorage.setItem('farcaster_user', JSON.stringify(userData));
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          
          // Update auth context
          if (typeof login === 'function') {
            await login(userData);
          }
          
          // Dispatch event
          const event = new CustomEvent('miniAppAuthenticated', {
            detail: {
              fid: userData.fid,
              username: userData.username,
              displayName: userData.displayName,
              pfp: userData.pfp
            }
          });
          window.dispatchEvent(event);
          
          if (typeof onSuccess === 'function') {
            onSuccess(userData);
          }
          
          return { success: true, user: userData };
        }
        
        console.error("Couldn't get user info after sign-in");
        setAuthError("Couldn't get user info");
        return { success: false, error: "No user info after sign-in" };
      } catch (error) {
        console.error("Sign-in error:", error);
        
        if (error.name === 'RejectedByUser') {
          console.log("User rejected sign-in");
          setAuthError("Sign-in was cancelled");
          return { success: false, error: "User rejected sign-in", rejected: true };
        }
        
        setAuthError(`Authentication failed: ${error.message || "Unknown error"}`);
        return { success: false, error: error.message || "Unknown error" };
      }
    } catch (error) {
      console.error("Overall error in directMiniAppSignIn:", error);
      setAuthError(`Authentication error: ${error.message || "Unknown error"}`);
      return { success: false, error: error.message || "Unknown error" };
    }
  };

  const handleSignIn = async () => {
    console.log("SignInButton: handleSignIn called");
    try {
      setAuthError(null);

      if (isMiniApp) {
        console.log("SignInButton: Detected Mini App environment, authenticating...");
        try {
          // Use direct SDK implementation
          const result = await directMiniAppSignIn();
          console.log("SignInButton: Authentication result:", result);
          
          if (result.success) {
            console.log("SignInButton: Successfully authenticated");
            return;
          } else {
            if (result.rejected) {
              console.log("SignInButton: User rejected authentication");
              setAuthError("Authentication was cancelled");
            } else {
              console.error("SignInButton: Authentication failed:", result.error);
              setAuthError(`Authentication failed: ${result.error}`);
            }
          }
        } catch (miniAppError) {
          console.error("SignInButton: Mini App authentication failed:", miniAppError);
          setAuthError(`Authentication failed: ${miniAppError.message || 'Unknown error'}`);
          return;
        }
      } else {
        console.log('SignInButton: Using web authentication flow');
        await signInWithFarcaster(props.callbackPath || '/');
      }
    } catch (e) {
      console.error("SignInButton: Authentication error:", e);
      setAuthError(`Authentication failed: ${e?.message || "Unknown error"}`);
    }
  };

  // If authenticated, show the user profile
  if (isAuthenticated && user) {
    return (
      <div className="flex items-center">
        <button
          onClick={() => navigate(`/${user.username}`)}
          className={cn(
            "flex items-center gap-2 rounded-md text-sm font-medium",
            className
          )}
          {...props}
        >
          <div className="flex items-center gap-2">
            <Avatar
              src={user.pfp?.url || ""}
              alt={user.displayName || user.username}
              size="sm"
            />
            <div className="flex-col items-start hidden sm:flex">
              <span className="text-sm font-medium">
                {user.displayName || user.username}
              </span>
            </div>
          </div>
        </button>
      </div>
    );
  }

  // In Mini App environment, use our custom button
  if (isMiniApp) {
    console.log("SignInButton: Rendering Mini App sign-in button");
    return (
      <button
        onClick={handleSignIn}
        disabled={loading}
        className={`sign-in-button ${className || ''}`}
        style={{
          backgroundColor: '#8864FB',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: '600',
          fontSize: '16px',
          cursor: loading ? 'not-allowed' : 'pointer',
          width: fullWidth ? '100%' : 'auto',
          ...buttonStyle
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <FarcasterLogoSvg />
          {loading ? "Signing In..." : "Sign in"}
        </span>
        {authError && <div style={{ color: 'red', marginTop: 8, fontSize: 12 }}>{authError}</div>}
        {children}
      </button>
    );
  }

  // For web environment, use the standard Farcaster Auth Kit button
  return (
    <div ref={buttonRef} className={className}>
      <FarcasterSignInButton />
      {loading && <span>Signing in...</span>}
    </div>
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