import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@farcaster/frame-sdk';
// Remove Next.js router import and use useNavigate from react-router-dom instead
// import { useRouter } from 'next/router';
import { cn } from '../utils/cn';
import Avatar from './Avatar';

// We won't dynamically import the Farcaster components to avoid initialization issues
import { SignInButton as FarcasterSignInButton, useProfile } from '@farcaster/auth-kit';

// Import Mini App utilities
import { isMiniAppEnvironment, handleMiniAppAuthentication, useIsMiniApp } from '../utils/miniAppUtils';

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
const SignInButton = ({ className, fullWidth, loading, size = "md", children, ...props }) => {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const farcasterProfile = useProfile();
  const navigate = useNavigate();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isMiniApp = useIsMiniApp();
  const buttonRef = useRef(null);

  // Listen for miniAppAuthenticated event
  useEffect(() => {
    if (!isMiniApp) return; // Only apply in Mini App environment
    
    const handleMiniAppAuth = (event) => {
      console.log("Mini App authentication detected", event.detail);
      // Force refresh component when Mini App auth happens
      if (event.detail && event.detail.userInfo) {
        setIsSigningIn(false);
      }
    };
    
    window.addEventListener('miniAppAuthenticated', handleMiniAppAuth);
    
    // Check if we have user info in localStorage from Mini App
    const storedUserInfo = localStorage.getItem('miniAppUserInfo');
    if (storedUserInfo && !isAuthenticated && !user) {
      try {
        const parsedUserInfo = JSON.parse(storedUserInfo);
        if (parsedUserInfo && parsedUserInfo.fid) {
          if (window.updateAuthState) {
            window.updateAuthState({
              user: parsedUserInfo,
              isAuthenticated: true
            });
          }
        }
      } catch (e) {
        console.error("Error parsing stored Mini App user info", e);
      }
    }
    
    return () => {
      window.removeEventListener('miniAppAuthenticated', handleMiniAppAuth);
    };
  }, [isAuthenticated, user, isMiniApp]);

  // Create a global function to update auth state (used by miniAppUtils)
  useEffect(() => {
    if (!isMiniApp) return; // Only needed in Mini App environment
    
    window.updateAuthState = ({ user, isAuthenticated }) => {
      // This will be called from miniAppUtils.js when auth happens
      if (signIn && typeof signIn.update === 'function') {
        signIn.update({ user, isAuthenticated });
      }
    };
    
    return () => {
      window.updateAuthState = undefined;
    };
  }, [signIn, isMiniApp]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    
    try {
      if (isMiniApp) {
        await handleMiniAppAuthentication();
      } else {
        // Use the normal sign-in method for web environment
        // This invokes the FarcasterSignInButton's functionality
        if (buttonRef.current) {
          // Find and click the auth-kit button
          const authKitButton = buttonRef.current.querySelector('.fc-authkit-signin-button');
          if (authKitButton) {
            authKitButton.click();
          } else {
            console.error("Could not find Farcaster auth-kit button");
            // Fallback to direct signIn if available
            if (signIn) await signIn();
          }
        }
      }
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
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
    return (
      <button
        onClick={handleSignIn}
        disabled={isSigningIn || loading}
        className={cn(
          "flex items-center justify-center gap-2 rounded-md auth-kit-style",
          "bg-[#9272F2] text-white px-4 py-2 font-medium hover:bg-[#7C5CD6] transition-all",
          "border border-[#9272F2] text-sm",
          {
            "w-full": fullWidth,
            "opacity-50 cursor-not-allowed": isSigningIn || loading,
          },
          className
        )}
        {...props}
      >
        <img
          src="/assets/farcaster-logo.svg"
          className="h-4 w-auto"
          alt="Farcaster"
          onError={(e) => {
            // Fallback to inline SVG if the image fails to load
            e.target.outerHTML = `<svg width="16" height="16" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="h-4 w-auto">
              <path d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z" fill="#472A91"/>
              <path d="M26.2558 10.41C24.1707 10.41 22.4921 11.4257 21.4302 13.4571H21.3385V10.6997H15.8496V29.7183H21.5219V20.2169C21.5219 18.6323 22.5837 17.5249 24.079 17.5249C25.5742 17.5249 26.5444 18.6323 26.5444 20.2169V29.7183H32.2167V19.4778C32.2167 13.9212 30.0399 10.41 26.2558 10.41Z" fill="white"/>
              <path d="M8.41913 29.7183H14.0914V10.6997H8.41913V29.7183Z" fill="white"/>
            </svg>`;
          }}
        />
        {isSigningIn || loading ? "Signing In..." : "Sign in"}
        {children}
      </button>
    );
  }

  // For web environment, use the standard Farcaster Auth Kit button
  return (
    <div ref={buttonRef} className={className}>
      <FarcasterSignInButton />
      {isSigningIn && <span>Signing in...</span>}
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