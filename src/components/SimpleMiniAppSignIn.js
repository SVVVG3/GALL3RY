import React, { useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';

// Generates a simple random nonce
const generateSimpleNonce = () => {
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
const SimpleMiniAppSignIn = ({ onSuccess }) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  
  const handleSignIn = async () => {
    setStatus('signing-in');
    setError(null);
    
    try {
      // Check if SDK is available and initialized
      if (!sdk) {
        throw new Error("SDK not available");
      }
      
      console.log("SDK object exists:", !!sdk);
      
      // Verify that the required SDK methods exist
      const hasSignIn = sdk.actions && typeof sdk.actions.signIn === 'function';
      console.log("SDK has signIn method:", hasSignIn);
      
      if (!hasSignIn) {
        throw new Error("SDK signIn method not available");
      }
      
      // Following the docs exactly
      // 1. Generate a nonce - just a random string for auth
      const nonce = generateSimpleNonce();
      
      // 2. Call signIn exactly as described in the docs
      console.log("Calling sdk.actions.signIn with nonce...");
      const result = await sdk.actions.signIn({ nonce });
      console.log("Sign-in call completed");
      
      // 3. Check that we got a result
      if (!result) {
        throw new Error('No result returned from signIn');
      }
      
      // 4. For demo purposes only - use mock data to avoid storage issues
      const mockUserData = {
        fid: 12345,
        username: "test_user",
        displayName: "Test User",
        pfp: { url: null },
        hasVerified: true
      };
      
      console.log("Using mock user data for testing");
      setStatus('success');
      if (onSuccess) onSuccess(mockUserData);
      
      // 5. Let's still try to get user info for debugging purposes only
      console.log("Attempting to check context (for debugging only)");
      
      try {
        // Check context without direct property access
        const hasFid = safeGetProperty(sdk, 'context.user.fid', false);
        const hasUsername = safeGetProperty(sdk, 'context.user.username', false);
        
        console.log("Context check (no direct access):", { hasFid, hasUsername });
        
        // Try getContext if available (just for diagnosis)
        if (typeof sdk.getContext === 'function') {
          console.log("getContext method exists, will try it");
          try {
            const contextResult = await sdk.getContext();
            console.log("getContext call succeeded:", !!contextResult);
          } catch (contextError) {
            console.log("getContext call failed:", contextError.message);
          }
        } else {
          console.log("getContext method does not exist");
        }
      } catch (debugError) {
        console.log("Debug context check failed:", debugError.message);
      }
      
    } catch (err) {
      console.error("Sign in error:", err.message || String(err));
      setError(err.message || String(err));
      setStatus('error');
    }
  };
  
  return (
    <div style={{ marginTop: '20px' }}>
      <button
        onClick={handleSignIn}
        disabled={status === 'signing-in'}
        style={{
          backgroundColor: status === 'error' ? '#ff5555' : '#ff6b6b',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          border: 'none',
          fontWeight: 600,
          cursor: status === 'signing-in' ? 'not-allowed' : 'pointer'
        }}
      >
        {status === 'signing-in' ? 'Signing In...' : 'Simple Sign In Test'}
      </button>
      
      {status === 'error' && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          {error}
        </div>
      )}
      
      {status === 'success' && (
        <div style={{ color: 'green', marginTop: '10px' }}>
          Sign in successful!
        </div>
      )}
    </div>
  );
};

export default SimpleMiniAppSignIn; 