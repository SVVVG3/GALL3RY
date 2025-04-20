import React, { useState } from 'react';
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

// Safely access SDK property with explicit type conversion
const safeGetProperty = (obj, path, defaultVal = null) => {
  if (!obj) return defaultVal;
  
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === undefined || result === null) return defaultVal;
      
      // Using hasOwnProperty to check if the property exists
      // This avoids triggering Symbol.toPrimitive
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        return defaultVal;
      }
      
      result = result[key];
    }
    
    return result;
  } catch (e) {
    console.error(`Error accessing property ${path}:`, e.message);
    return defaultVal;
  }
};

// Simplified Mini App Sign In button 
const SimpleMiniAppSignIn = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  
  const handleSignIn = async () => {
    setStatus('signing-in');
    setError(null);
    
    try {
      // Check if SDK is available and initialized
      if (!sdk) {
        const noSdkError = new Error("SDK not available");
        setError(noSdkError.message);
        setStatus('error');
        if (onError) onError(noSdkError);
        return;
      }
      
      console.log("SDK object exists:", !!sdk);
      
      // Verify that the required SDK methods exist
      const hasSignIn = sdk.actions && typeof sdk.actions.signIn === 'function';
      console.log("SDK has signIn method:", hasSignIn);
      
      if (!hasSignIn) {
        const noSignInError = new Error("SDK signIn method not available");
        setError(noSignInError.message);
        setStatus('error');
        if (onError) onError(noSignInError);
        return;
      }
      
      // First, check if user is already in context
      let userData = null;
      
      // Try to get context directly first
      if (typeof sdk.getContext === 'function') {
        try {
          const context = await sdk.getContext();
          if (context && context.user && context.user.fid) {
            userData = {
              fid: Number(context.user.fid),
              username: String(context.user.username || ''),
              displayName: String(context.user.displayName || context.user.username || ''),
              pfp: {
                url: String(context.user.pfpUrl || '')
              },
              hasVerified: true
            };
            console.log("Retrieved user from getContext:", userData.username);
          }
        } catch (contextError) {
          console.log("Could not get context:", contextError.message);
        }
      }
      
      // If no user found in context, fall back to sdk.context
      if (!userData && sdk.context && sdk.context.user && sdk.context.user.fid) {
        userData = {
          fid: Number(sdk.context.user.fid),
          username: String(sdk.context.user.username || ''),
          displayName: String(sdk.context.user.displayName || sdk.context.user.username || ''),
          pfp: {
            url: String(sdk.context.user.pfpUrl || '')
          },
          hasVerified: true
        };
        console.log("Retrieved user from sdk.context:", userData.username);
      }
      
      // If we still don't have user data, try the sign-in flow
      if (!userData) {
        // Generate a nonce for authentication
        const nonce = generateSimpleNonce();
        console.log("Calling sdk.actions.signIn with nonce...");
        
        // Call signIn as described in docs
        const result = await sdk.actions.signIn({ nonce });
        console.log("Sign-in call completed, result:", !!result);
        
        // Check result
        if (!result) {
          const noResultError = new Error('No result returned from signIn');
          setError(noResultError.message);
          setStatus('error');
          if (onError) onError(noResultError);
          return;
        }
        
        // After sign-in, try to get context again
        if (typeof sdk.getContext === 'function') {
          try {
            const context = await sdk.getContext();
            if (context && context.user && context.user.fid) {
              userData = {
                fid: Number(context.user.fid),
                username: String(context.user.username || ''),
                displayName: String(context.user.displayName || context.user.username || ''),
                pfp: {
                  url: String(context.user.pfpUrl || '')
                },
                hasVerified: true
              };
              console.log("Retrieved user after sign-in:", userData.username);
            }
          } catch (contextError) {
            console.log("Could not get context after sign-in:", contextError.message);
          }
        }
        
        // If still no user data, check sdk.context again
        if (!userData && sdk.context && sdk.context.user && sdk.context.user.fid) {
          userData = {
            fid: Number(sdk.context.user.fid),
            username: String(sdk.context.user.username || ''),
            displayName: String(sdk.context.user.displayName || sdk.context.user.username || ''),
            pfp: {
              url: String(sdk.context.user.pfpUrl || '')
            },
            hasVerified: true
          };
          console.log("Retrieved user from sdk.context after sign-in:", userData.username);
        }
        
        // If we still don't have user data, try to extract it from the message
        if (!userData && result && result.message) {
          try {
            // The message includes a string with user data in the format: "fid:123..."
            const fidMatch = result.message.match(/fid:(\d+)/);
            if (fidMatch && fidMatch[1]) {
              const fid = fidMatch[1];
              console.log("Extracted FID from message:", fid);
              userData = {
                fid: fid,
                username: `user${fid}`,
                displayName: `User ${fid}`,
                pfp: { url: null },
                hasVerified: true
              };
              console.log("Created basic user data from message FID");
            }
          } catch (parseError) {
            console.warn("Error parsing message for user data:", parseError);
          }
        }
      }
      
      // If we have user data, store it and notify
      if (userData && userData.fid) {
        // Store in localStorage for persistence
        try {
          localStorage.setItem('farcaster_user', JSON.stringify(userData));
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        } catch (storageError) {
          console.error('Failed to store user data:', storageError.message);
        }
        
        // Dispatch event for other components
        try {
          const authEvent = new CustomEvent('miniAppAuthenticated', { detail: userData });
          window.dispatchEvent(authEvent);
        } catch (eventError) {
          console.error('Failed to dispatch event:', eventError.message);
        }
        
        setStatus('success');
        if (onSuccess) onSuccess(userData);
      } else {
        // No user data found after all attempts
        const noUserError = new Error('Could not retrieve user information after sign-in');
        setError(noUserError.message);
        setStatus('error');
        if (onError) onError(noUserError);
      }
    } catch (err) {
      console.error("Sign in error:", err.message || String(err));
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