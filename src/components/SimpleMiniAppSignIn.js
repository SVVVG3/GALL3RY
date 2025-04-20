import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/frame-sdk';

// Generates a simple random nonce
const generateSimpleNonce = () => {
  try {
    // First attempt to use crypto API (most secure)
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('Crypto API failed, using fallback nonce generation:', e);
  }
  
  // Fallback to Math.random if crypto API is not available
  return Math.random().toString(36).substring(2, 10) + 
         Math.random().toString(36).substring(2, 10);
};

// Safely extract primitive values from potentially complex objects
// This is critical for handling Symbol.toPrimitive errors
const safeExtractUserData = (userObj) => {
  if (!userObj) return null;
  
  try {
    // Create a new plain object with only primitive values
    // Use explicit conversion to primitive types to avoid Symbol.toPrimitive errors
    const fid = userObj.fid !== undefined ? Number(String(userObj.fid)) : null;
    let username = null;
    let displayName = null;
    let pfpUrl = null;
    
    // Safely extract username
    try {
      username = userObj.username !== undefined ? String(userObj.username) : null;
    } catch (e) {
      console.warn('Error extracting username:', e);
      username = `user_${fid || 'unknown'}`;
    }
    
    // Safely extract displayName
    try {
      displayName = userObj.displayName !== undefined ? String(userObj.displayName) : 
                  (username ? username : null);
    } catch (e) {
      console.warn('Error extracting displayName:', e);
      displayName = username || `User ${fid || 'Unknown'}`;
    }
    
    // Safely extract pfpUrl
    try {
      pfpUrl = userObj.pfpUrl !== undefined ? String(userObj.pfpUrl) : null;
    } catch (e) {
      console.warn('Error extracting pfpUrl:', e);
      pfpUrl = null;
    }
    
    return {
      fid: fid,
      username: username,
      displayName: displayName,
      pfp: {
        url: pfpUrl
      }
    };
  } catch (e) {
    console.error('Error extracting user data:', e);
    
    // Create minimal fallback if error occurs
    return {
      fid: typeof userObj.fid === 'number' ? userObj.fid : null,
      username: `user_${typeof userObj.fid === 'number' ? userObj.fid : 'unknown'}`,
      displayName: `User ${typeof userObj.fid === 'number' ? userObj.fid : 'Unknown'}`,
      pfp: { url: null }
    };
  }
};

// Wrapper function to log context retrieval attempts
const safeGetContext = async () => {
  if (!sdk) {
    console.warn("SDK not available for getContext");
    return null;
  }
  
  try {
    // First try the method
    if (typeof sdk.getContext === 'function') {
      console.log("Calling sdk.getContext() method");
      try {
        const context = await sdk.getContext();
        console.log("Context received:", context ? "Yes" : "No");
        return context;
      } catch (e) {
        console.warn("Error calling sdk.getContext():", e.message);
      }
    }
    
    // Then try the property
    if (sdk.context) {
      console.log("Accessing sdk.context property");
      return sdk.context;
    }
    
    return null;
  } catch (e) {
    console.error("Error in safeGetContext:", e);
    return null;
  }
};

// Simplified Mini App Sign In button 
const SimpleMiniAppSignIn = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  
  // On mount, check if user is already authenticated
  useEffect(() => {
    // Check if user data exists in localStorage
    try {
      const storedUserData = localStorage.getItem('miniAppUserInfo');
      if (storedUserData) {
        const userData = JSON.parse(storedUserData);
        if (userData && userData.fid) {
          console.log("Found stored user data, verifying with SDK...");
          
          // Verify with SDK context
          safeGetContext().then(context => {
            if (context && context.user && context.user.fid) {
              console.log("SDK context confirms user is authenticated");
              setStatus('success');
              if (onSuccess) onSuccess(userData);
            }
          }).catch(e => {
            console.warn("Error verifying stored user data:", e);
            // We don't set error here, just log the issue
          });
        }
      }
    } catch (e) {
      console.warn("Error checking stored user data:", e);
    }
  }, [onSuccess]);
  
  const handleSignIn = async () => {
    setStatus('signing-in');
    setError(null);
    
    console.log("SimpleMiniAppSignIn: Sign-in initiated");
    
    try {
      // Check if SDK is available and initialized
      if (!sdk) {
        const noSdkError = new Error("SDK not available");
        console.error("SimpleMiniAppSignIn: SDK not available");
        setError(noSdkError.message);
        setStatus('error');
        if (onError) onError(noSdkError);
        return;
      }
      
      console.log("SimpleMiniAppSignIn: SDK object exists:", !!sdk);
      
      // Verify that the required SDK methods exist
      const hasSignIn = sdk.actions && typeof sdk.actions.signIn === 'function';
      console.log("SimpleMiniAppSignIn: SDK has signIn method:", hasSignIn);
      
      if (!hasSignIn) {
        const noSignInError = new Error("SDK signIn method not available");
        console.error("SimpleMiniAppSignIn: SDK signIn method not available");
        setError(noSignInError.message);
        setStatus('error');
        if (onError) onError(noSignInError);
        return;
      }
      
      // First, check if user is already in context
      let userData = null;
      
      // Use safe context getter
      console.log("SimpleMiniAppSignIn: Checking for user context");
      const context = await safeGetContext();
      
      if (context && context.user && context.user.fid) {
        console.log("SimpleMiniAppSignIn: User found in context");
        // Safely extract user data with primitive values only
        userData = safeExtractUserData(context.user);
        console.log("SimpleMiniAppSignIn: Retrieved user from context:", userData?.username);
      }
      
      // If we still don't have user data, try the sign-in flow
      if (!userData) {
        console.log("SimpleMiniAppSignIn: No user data found in context, proceeding with sign-in");
        // Generate a nonce for authentication
        const nonce = generateSimpleNonce();
        console.log("SimpleMiniAppSignIn: Generated nonce:", nonce);
        
        // Set timeout to prevent hanging UI
        const signInTimeout = setTimeout(() => {
          if (status === 'signing-in') {
            console.warn("SimpleMiniAppSignIn: Sign-in operation timed out");
            setError("Sign-in operation timed out");
            setStatus('error');
            if (onError) onError(new Error("Sign-in operation timed out"));
          }
        }, 15000); // 15 second timeout
        
        try {
          // Call signIn with the nonce as described in Farcaster docs
          console.log("SimpleMiniAppSignIn: Calling sdk.actions.signIn with nonce");
          const result = await sdk.actions.signIn({ nonce });
          
          // Clear timeout since operation completed
          clearTimeout(signInTimeout);
          
          console.log("SimpleMiniAppSignIn: Sign-in call completed");
          
          // After sign-in, try to get context again
          const newContext = await safeGetContext();
          
          if (newContext && newContext.user && newContext.user.fid) {
            // Safely extract user data with primitive values only
            userData = safeExtractUserData(newContext.user);
            console.log("SimpleMiniAppSignIn: Retrieved user after sign-in:", userData?.username);
          }
          
          // Try to extract from result if still no user data
          if (!userData && result) {
            console.log("SimpleMiniAppSignIn: Attempting to extract user data from result");
            try {
              if (result.user) {
                userData = safeExtractUserData(result.user);
                console.log("SimpleMiniAppSignIn: Extracted user data from result.user");
              } else if (result.message && typeof result.message === 'string') {
                // Try to extract FID from message if available
                const fidMatch = result.message.match(/fid:(\d+)/);
                if (fidMatch && fidMatch[1]) {
                  const fid = Number(fidMatch[1]);
                  userData = {
                    fid: fid,
                    username: `user_${fid}`,
                    displayName: `User ${fid}`,
                    pfp: { url: null }
                  };
                  console.log("SimpleMiniAppSignIn: Created basic user data from message FID");
                }
              }
            } catch (parseError) {
              console.warn("SimpleMiniAppSignIn: Error parsing result:", parseError.message);
            }
          }
        } catch (signInError) {
          // Clear timeout since operation completed with error
          clearTimeout(signInTimeout);
          
          console.error("SimpleMiniAppSignIn: Sign in error:", signInError.message || String(signInError));
          setError(signInError.message || String(signInError));
          setStatus('error');
          if (onError) onError(signInError);
          return;
        }
      }
      
      // If we have user data, store it and notify
      if (userData && userData.fid) {
        console.log("SimpleMiniAppSignIn: Successfully retrieved user data:", JSON.stringify(userData));
        
        // Store in localStorage for persistence
        try {
          localStorage.setItem('farcaster_user', JSON.stringify(userData));
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        } catch (storageError) {
          console.error('SimpleMiniAppSignIn: Failed to store user data:', storageError.message);
        }
        
        // Dispatch event for other components
        try {
          const authEvent = new CustomEvent('miniAppAuthenticated', { detail: userData });
          window.dispatchEvent(authEvent);
        } catch (eventError) {
          console.error('SimpleMiniAppSignIn: Failed to dispatch event:', eventError.message);
        }
        
        setStatus('success');
        if (onSuccess) onSuccess(userData);
      } else {
        // No user data found after all attempts
        const noUserError = new Error('Could not retrieve user information after sign-in');
        console.error("SimpleMiniAppSignIn: No user data after all attempts");
        setError(noUserError.message);
        setStatus('error');
        if (onError) onError(noUserError);
      }
    } catch (err) {
      console.error("SimpleMiniAppSignIn: Unexpected error:", err.message || String(err));
      setError(err.message || String(err));
      setStatus('error');
      if (onError) onError(err);
    }
  };
  
  return (
    <div style={{ marginTop: '20px' }}>
      <button
        onClick={handleSignIn}
        disabled={status === 'signing-in'}
        style={{
          backgroundColor: status === 'error' ? '#ff5555' : '#8b5cf6',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: 600,
          cursor: status === 'signing-in' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {status === 'signing-in' ? 'Signing In...' : 'Sign In with Farcaster'}
      </button>
      
      {status === 'error' && error && (
        <div style={{ color: '#e53e3e', marginTop: '10px', fontSize: '14px' }}>
          {error}
        </div>
      )}
      
      {status === 'success' && (
        <div style={{ color: '#38a169', marginTop: '10px', fontSize: '14px' }}>
          Sign in successful!
        </div>
      )}
    </div>
  );
};

export default SimpleMiniAppSignIn; 