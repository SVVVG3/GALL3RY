import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@farcaster/frame-sdk';
import { useRouter } from 'next/router';
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
function SignInButton({ className, fullWidth, loading, size = "md", children, ...props }) {
  const { user, isAuthenticated, signIn, signOut } = useAuth();
  const buttonRef = useRef(null);
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isMiniApp = useIsMiniApp();

  // Listen for miniAppAuthenticated event
  useEffect(() => {
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
  }, [isAuthenticated, user]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    
    try {
      if (isMiniApp) {
        await handleMiniAppAuthentication();
      } else {
        await signIn();
      }
    } catch (error) {
      console.error("Sign in error:", error);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Create a global function to update auth state (used by miniAppUtils)
  useEffect(() => {
    window.updateAuthState = ({ user, isAuthenticated }) => {
      // This will be called from miniAppUtils.js when auth happens
      if (signIn && typeof signIn.update === 'function') {
        signIn.update({ user, isAuthenticated });
      }
    };
    
    return () => {
      window.updateAuthState = undefined;
    };
  }, [signIn]);

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center">
        <button
          onClick={() => router.push(`/${user.username}`)}
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

  return (
    <button
      ref={buttonRef}
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
      />
      {isSigningIn || loading ? (
        "Signing In..."
      ) : (
        isMiniApp ? "Sign in" : "Sign in"
      )}
      {children}
    </button>
  );
}

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