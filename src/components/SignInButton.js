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
import { isMiniAppEnvironment, isMiniAppSdkInitialized } from '../utils/miniAppUtils';
import { signInWithFarcaster } from '../utils/authUtils';
import { useProfile } from '../contexts/ProfileContext';
import debounce from 'lodash.debounce';

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

/**
 * Generate a random nonce for authentication
 * @returns {string} A random string to use as nonce
 */
const generateNonce = () => {
  console.log('Generating nonce for authentication');
  try {
    // First attempt to use crypto API (most secure)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      try {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        const nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        console.log('Generated nonce using window.crypto');
        return nonce;
      } catch (cryptoError) {
        console.warn('Crypto API failed:', cryptoError);
        // Fall through to next method
      }
    }
    
    // Try node crypto if available (for SSR environments)
    if (typeof require === 'function') {
      try {
        const crypto = require('crypto');
        if (crypto && typeof crypto.randomBytes === 'function') {
          const buffer = crypto.randomBytes(16);
          const nonce = Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          console.log('Generated nonce using node crypto');
          return nonce;
        }
      } catch (nodeError) {
        console.warn('Node crypto failed:', nodeError);
        // Fall through to fallback method
      }
    }
  } catch (e) {
    console.warn('Error in primary nonce generation methods:', e);
  }
  
  // Ultimate fallback using Math.random (less secure but always available)
  console.log('Using Math.random fallback for nonce generation');
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random1}-${random2}`;
};

/**
 * Safely get a property from an object avoiding Symbol.toPrimitive errors
 * 
 * @param {Object} obj - The object to access
 * @param {string} propName - The property name to get
 * @param {any} defaultValue - Default value if property doesn't exist
 * @returns {any} The property value or default value
 */
const safeGetProperty = (obj, propName, defaultValue = null) => {
  try {
    // Check if obj is null or undefined
    if (obj == null) {
      return defaultValue;
    }

    // Check if property exists using hasOwnProperty
    // This avoids triggering Symbol.toPrimitive
    if (Object.prototype.hasOwnProperty.call(obj, propName)) {
      const value = obj[propName];
      
      // Handle different value types to prevent Symbol.toPrimitive errors
      if (value === null || value === undefined) {
        return defaultValue;
      }
      
      // For primitive values, return as is
      if (typeof value !== 'object' && typeof value !== 'function') {
        return value;
      }
      
      // For objects, we need to be careful with conversion
      try {
        // Try to convert to string or number safely
        if (typeof value === 'object') {
          // If it has a toString method, try using it
          if (typeof value.toString === 'function') {
            const stringVal = value.toString();
            if (stringVal !== '[object Object]') {
              return stringVal;
            }
          }
          
          // For numeric types, convert to number
          if (!isNaN(Number(value))) {
            return Number(value);
          }
        }
        
        // Just return the value itself if conversion fails
        return value;
      } catch (innerErr) {
        console.warn(`Error converting property ${propName}:`, innerErr);
        return defaultValue;
      }
    }
    
    return defaultValue;
  } catch (err) {
    console.error(`Error accessing property ${propName}:`, err);
    return defaultValue;
  }
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
      // Add additional check for SDK initialization
      if (isMiniApp && 
          (miniAppMode === 'auto' || miniAppMode === true) && 
          !isAuthenticated && 
          !miniAppAuthInProgress && 
          sdk) {  // Check that SDK is available
        try {
          setMiniAppAuthInProgress(true);
          console.log('Auto-initiating mini app authentication');
          await directMiniAppSignIn(login);
        } catch (error) {
          console.error('Error during auto mini app authentication:', error);
          setAuthError('Error during authentication');
        } finally {
          setMiniAppAuthInProgress(false);
        }
      }
    };
    
    // Add a small delay to ensure SDK is initialized
    const timeoutId = setTimeout(() => {
      autoAuth();
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [isMiniApp, miniAppMode, isAuthenticated, miniAppAuthInProgress, login]);

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
      
      try {
        // In Mini App iframe, localStorage access may fail
        // so wrap in try/catch
        if (typeof localStorage !== 'undefined') {
          // Store in both localStorage keys for consistency
          localStorage.setItem('farcaster_user', JSON.stringify(userInfo));
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
        }
      } catch (e) {
        console.warn('Unable to access localStorage:', e.message);
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

  /**
   * Direct authentication for Mini App environments
   */
  const directMiniAppSignIn = async (login) => {
    console.log("Direct Mini App Sign In called");
    
    if (!sdk) {
      console.error("SDK is not defined");
      setAuthError("SDK not initialized. Please reload the app.");
      return false;
    }
    
    try {
      // Ensure SDK is initialized
      if (typeof sdk.init === 'function' && !sdk.initialized) {
        console.log("Initializing SDK");
        try {
          sdk.init();
        } catch (initError) {
          console.warn("SDK initialization error:", initError);
          setAuthError("SDK initialization failed: " + initError.message);
        }
      }
      
      // Use the existing generateNonce function from the outer scope
      const nonce = generateNonce();
      console.log("Generated nonce:", nonce);
      
      // Check if signIn action is available
      if (!sdk.actions || typeof sdk.actions.signIn !== 'function') {
        console.error("SDK signIn action is not available");
        setAuthError("SDK signIn action not available. Please try in a supported Farcaster client.");
        return false;
      }
      
      // Use SDK signIn action as shown in documentation
      console.log("Calling sdk.actions.signIn with nonce:", nonce);
      try {
        const signInResult = await sdk.actions.signIn({ nonce });
        console.log("Sign in result received:", signInResult);
        
        if (!signInResult || !signInResult.message || !signInResult.signature) {
          console.error("Invalid sign-in result received:", signInResult);
          setAuthError("Invalid sign-in result received from SDK");
          return false;
        }
        
        // Send the sign-in result to the server for verification
        try {
          console.log("Sending sign-in result to server for verification");
          const response = await fetch('/api/verify-siwf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: signInResult.message,
              signature: signInResult.signature,
              nonce
            }),
          });
          
          // Get response text first for debugging
          const responseText = await response.text();
          console.log(`Verification response status: ${response.status}, body:`, responseText);
          
          // Try to parse as JSON if possible
          let verificationResult;
          try {
            verificationResult = JSON.parse(responseText);
          } catch (parseError) {
            console.error("Error parsing verification response:", parseError);
            setAuthError(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
            return false;
          }
          
          if (!response.ok) {
            console.error(`Verification failed: ${response.status}`, verificationResult);
            setAuthError(`Verification failed: ${verificationResult.error || response.status}`);
            return false;
          }
          
          console.log("Server verification response:", verificationResult);
          
          if (!verificationResult || !verificationResult.userData || !verificationResult.token) {
            console.error("Invalid verification result from server", verificationResult);
            setAuthError("Server returned incomplete authentication data");
            return false;
          }
          
          const { userData, token } = verificationResult;
          
          // Store the authentication token in sessionStorage (not localStorage)
          // This ensures if the user closes the tab or logs out of Farcaster, they're logged out of the app too
          sessionStorage.setItem('miniAppAuthToken', token);
          sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          
          // Store in localStorage for backwards compatibility with other parts of the app
          // This should eventually be removed in favor of sessionStorage only
          try {
            localStorage.setItem('farcaster_user', JSON.stringify(userData));
            localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          } catch (e) {
            console.warn("Failed to save to localStorage (for backwards compatibility):", e);
          }
          
          // Update auth context
          if (typeof login === 'function') {
            login(userData);
          }
          
          // Dispatch event
          const event = new CustomEvent('miniAppAuthenticated', { detail: userData });
          window.dispatchEvent(event);
          
          return true;
        } catch (verificationError) {
          console.error("Server verification failed:", verificationError);
          setAuthError(`Server verification error: ${verificationError.message}`);
          return false;
        }
      } catch (signInError) {
        // Handle rejection by user
        if (signInError.message && signInError.message.includes('rejected')) {
          console.log("User rejected sign-in request");
          setAuthError("Sign-in request was rejected");
          return false;
        }
        
        console.error("Error during sign-in:", signInError);
        setAuthError(`Sign-in error: ${signInError.message}`);
        return false;
      }
    } catch (error) {
      console.error("Unexpected error in directMiniAppSignIn:", error);
      setAuthError(`Unexpected error: ${error.message}`);
      return false;
    }
  };

  const handleSignIn = async () => {
    console.log("SignInButton: handleSignIn called");
    try {
      setAuthError(null);

      if (isMiniApp) {
        console.log("SignInButton: Detected Mini App environment, authenticating...");
        // Set loading state
        setMiniAppAuthInProgress(true);
        
        // Simply use the directMiniAppSignIn function
        const success = await directMiniAppSignIn(login);
        
        if (!success) {
          setAuthError("Authentication failed");
        }
        
        setMiniAppAuthInProgress(false);
      } else {
        console.log('SignInButton: Using web authentication flow');
        await signInWithFarcaster(props.callbackPath || '/');
      }
    } catch (e) {
      console.error("SignInButton: Authentication error:", e);
      setAuthError(`Authentication failed: ${e?.message || "Unknown error"}`);
      setMiniAppAuthInProgress(false);
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
        onClick={(event) => {
          console.log("SignInButton: Button clicked in Mini App");
          // Explicitly prevent default
          if (event) event.preventDefault();
          // Force handleSignIn with a small delay to ensure SDK is ready
          setTimeout(() => {
            handleSignIn();
          }, 100);
        }}
        disabled={loading || miniAppAuthInProgress}
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
          cursor: loading || miniAppAuthInProgress ? 'not-allowed' : 'pointer',
          width: fullWidth ? '100%' : 'auto',
          // Add a more prominent appearance
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
          ...buttonStyle
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <FarcasterLogoSvg />
          {loading || miniAppAuthInProgress ? "Signing In..." : "Sign in with Farcaster"}
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