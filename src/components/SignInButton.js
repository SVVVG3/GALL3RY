import React, { useState, useEffect, Suspense } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

// We won't dynamically import the Farcaster components to avoid initialization issues
import { SignInButton as FarcasterSignInButton } from '@farcaster/auth-kit';

// Check for browser environment
const isBrowser = typeof window !== 'undefined' && 
                 window.document !== undefined;

/**
 * Enhanced SignInButton Component
 * With error handling and safe localStorage access
 */
const SignInButton = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Use our AuthContext instead of direct Farcaster auth
  const { isAuthenticated, logout, profile } = useAuth();
  
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
            src={profile.avatarUrl || "/placeholder.png"} 
            alt={profile.username || "User"} 
            className="profile-avatar"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholder.png";
            }}
          />
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
    );
  }
  
  // If not authenticated, use the Farcaster auth button directly
  return (
    <ErrorBoundaryWrapper>
      <FarcasterSignInButton onSuccess={onSuccess} />
    </ErrorBoundaryWrapper>
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