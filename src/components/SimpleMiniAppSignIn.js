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

// Function to verify sign-in with server
const verifySignInWithServer = async (signInResult, nonce) => {
  try {
    console.log("Sending sign-in result to server for verification", { 
      message: signInResult.message,
      signature: signInResult.signature,
      nonce
    });
    
    // Adjust the URL based on your API endpoint
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
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Error parsing verification response:", parseError);
      throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 100)}`);
    }
    
    if (!response.ok) {
      console.error(`Verification failed: ${response.status}`, data);
      throw new Error(`Verification failed: ${data.error || response.status}`);
    }
    
    console.log("Server verification response:", data);
    
    // Return the user data from server - server should extract FID and user data
    // from the verified message and return it along with an auth token
    return data;
  } catch (error) {
    console.error("Server verification failed:", error);
    throw error;
  }
};

// Simplified Mini App Sign In button 
const SimpleMiniAppSignIn = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  
  // On mount, check if user is already authenticated
  useEffect(() => {
    // Get auth token from sessionStorage (intentionally not localStorage)
    try {
      const authToken = sessionStorage.getItem('miniAppAuthToken');
      if (authToken) {
        console.log("Found auth token, checking if still valid...");
        
        // Verify token with server or check if we have context that matches
        safeGetContext().then(context => {
          if (context && context.user && context.user.fid) {
            console.log("SDK context confirms user is authenticated");
            // Get the user data from session storage
            const miniAppUserInfo = sessionStorage.getItem('miniAppUserInfo');
            if (miniAppUserInfo) {
              try {
                const userData = JSON.parse(miniAppUserInfo);
                setStatus('success');
                if (onSuccess) onSuccess(userData);
              } catch (e) {
                console.warn("Error parsing stored user data:", e);
              }
            }
          } else {
            // No context found, clear session storage
            console.log("No user context found, clearing stored auth");
            sessionStorage.removeItem('miniAppAuthToken');
            sessionStorage.removeItem('miniAppUserInfo');
          }
        }).catch(e => {
          console.warn("Error verifying stored auth data:", e);
        });
      }
    } catch (e) {
      console.warn("Error checking stored auth data:", e);
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
      
      // Check current hostname for domain debugging
      const currentHostname = window.location.hostname;
      console.log("Current hostname for verification:", currentHostname);
      
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
        const signInResult = await sdk.actions.signIn({ nonce });
        
        // Clear timeout since operation completed
        clearTimeout(signInTimeout);
        
        console.log("SimpleMiniAppSignIn: Sign-in call completed", signInResult);
        
        if (!signInResult || !signInResult.message || !signInResult.signature) {
          const invalidResultError = new Error("Invalid sign-in result returned from SDK");
          console.error("SimpleMiniAppSignIn: Invalid result:", signInResult);
          setError(invalidResultError.message);
          setStatus('error');
          if (onError) onError(invalidResultError);
          return;
        }
        
        // Send the sign-in result to the server for verification
        try {
          const verificationResult = await verifySignInWithServer(signInResult, nonce);
          
          if (!verificationResult || !verificationResult.userData || !verificationResult.token) {
            const invalidVerificationError = new Error("Invalid verification result from server");
            console.error("SimpleMiniAppSignIn: Invalid verification result:", verificationResult);
            setError(invalidVerificationError.message);
            setStatus('error');
            if (onError) onError(invalidVerificationError);
            return;
          }
          
          // Store the authentication token in sessionStorage (not localStorage)
          // This ensures if the user closes the tab or logs out of Farcaster, they're logged out of the app too
          sessionStorage.setItem('miniAppAuthToken', verificationResult.token);
          sessionStorage.setItem('miniAppUserInfo', JSON.stringify(verificationResult.userData));
          
          // Dispatch event for other components
          try {
            const authEvent = new CustomEvent('miniAppAuthenticated', { 
              detail: verificationResult.userData
            });
            window.dispatchEvent(authEvent);
          } catch (eventError) {
            console.error('SimpleMiniAppSignIn: Failed to dispatch event:', eventError.message);
          }
          
          setStatus('success');
          if (onSuccess) onSuccess(verificationResult.userData);
        } catch (verificationError) {
          console.error("SimpleMiniAppSignIn: Verification error:", verificationError);
          setError(verificationError.message || "Server verification failed");
          setStatus('error');
          if (onError) onError(verificationError);
        }
      } catch (signInError) {
        // Clear timeout since operation completed with error
        clearTimeout(signInTimeout);
        
        // Special handling for user rejection
        if (signInError.message && signInError.message.includes('rejected')) {
          console.log("SimpleMiniAppSignIn: User rejected sign-in request");
          setError("Sign-in request was rejected");
          setStatus('error');
          if (onError) onError(signInError);
          return;
        }
        
        console.error("SimpleMiniAppSignIn: Sign in error:", signInError.message || String(signInError));
        setError(signInError.message || String(signInError));
        setStatus('error');
        if (onError) onError(signInError);
        return;
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
        <div style={{ 
          color: '#e53e3e', 
          marginTop: '10px', 
          fontSize: '14px',
          padding: '10px',
          backgroundColor: '#FED7D7',
          borderRadius: '6px',
          border: '1px solid #FC8181',
          fontWeight: '500',
          textAlign: 'left'
        }}>
          <strong>Error:</strong> {error}
          <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
            Please try reloading the app or using a different Farcaster client.
          </div>
        </div>
      )}
      
      {status === 'success' && (
        <div style={{ 
          color: '#38a169', 
          marginTop: '10px', 
          fontSize: '14px',
          padding: '10px',
          backgroundColor: '#C6F6D5',
          borderRadius: '6px',
          border: '1px solid #9AE6B4',
          fontWeight: '500'
        }}>
          Sign in successful!
        </div>
      )}
    </div>
  );
};

export default SimpleMiniAppSignIn; 