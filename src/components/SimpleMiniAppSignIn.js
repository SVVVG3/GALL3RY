import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { safeExtractUserData, safeGetPrimitive } from '../utils/miniAppUtils';

// Debug mode - synced with HomePage
const DEBUG_MODE = true;

// Helper function to generate a simple nonce
const generateSimpleNonce = () => {
  const random = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  return random;
};

// Helper function to safely get context from SDK
const safeGetContext = async () => {
  try {
    if (!sdk) {
      console.log('SDK not available for context check');
      return null;
    }
    
    // Try to get context via getContext method
    if (typeof sdk.getContext === 'function') {
      try {
        // We don't access properties directly - just check if the method returns something
        const hasContext = await sdk.getContext();
        
        // Instead of directly accessing potentially problematic properties,
        // just return a simplified object indicating authentication
        if (hasContext) {
          return {
            authenticated: true,
            timestamp: new Date().toISOString()
          };
        }
        return null;
      } catch (e) {
        console.warn('Error getting context via getContext():', e.message);
      }
    }
    
    // Fallback to check if context exists without accessing properties
    if (sdk.context) {
      return {
        authenticated: true,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  } catch (e) {
    console.error('Error in safeGetContext:', e);
    return null;
  }
};

// Log debug info to remote server API endpoint
const logDebugInfo = async (event, data = {}) => {
  if (!DEBUG_MODE) return;
  
  try {
    await fetch('/api/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        type: data.error ? 'error' : 'info',
        message: data.message || event,
        error: data.error,
        data: data.data || null,
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          sdkStatus: {
            defined: !!sdk,
            hasActions: sdk && !!sdk.actions,
            hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
            hasGetContext: sdk && typeof sdk.getContext === 'function'
          }
        }
      })
    });
  } catch (e) {
    console.warn('Error logging debug info:', e);
  }
};

// Debug component that shows SDK status
const DebugPanel = ({ sdkStatus, authAttempts, lastError }) => {
  if (!DEBUG_MODE) return null;
  
  return (
    <div style={{
      fontSize: '10px',
      padding: '8px',
      margin: '8px 0',
      border: '1px solid #ccc',
      borderRadius: '4px',
      backgroundColor: '#f9f9f9'
    }}>
      <div><strong>SDK Status:</strong> {sdkStatus.defined ? '✅' : '❌'}</div>
      {sdkStatus.defined && (
        <>
          <div>- Has Actions: {sdkStatus.hasActions ? '✅' : '❌'}</div>
          <div>- Has Sign In: {sdkStatus.hasSignIn ? '✅' : '❌'}</div>
          <div>- Has Context: {sdkStatus.hasContext ? '✅' : '❌'}</div>
        </>
      )}
      <div><strong>Auth Attempts:</strong> {authAttempts}</div>
      {lastError && (
        <div style={{ color: 'red' }}>
          <strong>Last Error:</strong> {lastError}
        </div>
      )}
    </div>
  );
};

// Main component
const SimpleMiniAppSignIn = ({ onSuccess, onError, buttonText = "Sign in with Farcaster" }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState(null);
  const [sdkStatus, setSdkStatus] = useState({
    defined: false,
    hasActions: false,
    hasSignIn: false,
    hasContext: false
  });
  const [authAttempts, setAuthAttempts] = useState(0);
  
  // Check SDK on mount
  useEffect(() => {
    checkSdkStatus();
    
    // Try to automatically authenticate with context on mount
    logDebugInfo('COMPONENT_MOUNTED');
    
    // Check if we can automatically authenticate using context
    safeGetContext().then(context => {
      console.log('Initial context check:', context ? 'Found' : 'Not found');
      logDebugInfo('INITIAL_CONTEXT_CHECK', { data: context ? 'Context found' : 'No context' });
      
      if (context && context.authenticated) {
        console.log('User already authenticated via context');
        logDebugInfo('USER_AUTHENTICATED_FROM_CONTEXT');
        
        // Create simple user data
        const userData = {
          authenticated: true,
          timestamp: context.timestamp
        };
        
        // Store in sessionStorage
        sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        
        // Notify of success
        if (onSuccess) {
          onSuccess(userData);
        }
      }
    }).catch(e => {
      console.error('Error in auto-authentication:', e);
      logDebugInfo('AUTO_AUTH_ERROR', { error: e.message });
    });
  }, [onSuccess]);
  
  // Regularly check SDK status
  useEffect(() => {
    const intervalId = setInterval(checkSdkStatus, 5000);
    return () => clearInterval(intervalId);
  }, []);
  
  // Function to check SDK status
  const checkSdkStatus = () => {
    try {
      const status = {
        defined: !!sdk,
        hasActions: sdk && !!sdk.actions,
        hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
        hasContext: sdk && (typeof sdk.getContext === 'function' || !!sdk.context)
      };
      
      setSdkStatus(status);
    } catch (e) {
      console.error('Error checking SDK status:', e);
    }
  };
  
  // Handle sign-in
  const handleSignIn = async () => {
    console.log('Sign-in button clicked');
    logDebugInfo('SIGN_IN_INITIATED');
    
    // Increment auth attempts counter
    setAuthAttempts(prev => prev + 1);
    
    // Reset errors
    setError(null);
    
    // Check if SDK is available
    if (!sdk) {
      const errorMsg = 'SDK not available';
      console.error(errorMsg);
      setError(errorMsg);
      if (onError) onError(new Error(errorMsg));
      logDebugInfo('SIGN_IN_ERROR', { error: errorMsg });
      return;
    }
    
    try {
      setIsSigningIn(true);
      
      // Try to get context first
      console.log('Checking for context before sign-in');
      const existingContext = await safeGetContext();
      
      if (existingContext && existingContext.authenticated) {
        console.log('User already authenticated via context');
        logDebugInfo('USER_AUTHENTICATED_FROM_CONTEXT');
        
        const userData = {
          authenticated: true,
          timestamp: existingContext.timestamp || new Date().toISOString()
        };
        
        // Store in sessionStorage
        sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        // Clear signing in state
        setIsSigningIn(false);
        // Notify of success
        if (onSuccess) {
          onSuccess(userData);
        }
        return;
      }
      
      // Generate a nonce
      const nonce = generateSimpleNonce();
      console.log('Generated nonce:', nonce);
      logDebugInfo('NONCE_GENERATED', { data: { nonce } });
      
      // Create a timeout to handle stuck auth state
      let timeoutId = setTimeout(() => {
        if (isSigningIn) {
          console.warn('Sign-in operation taking too long, may be stuck...');
          logDebugInfo('SIGN_IN_TIMEOUT_WARNING', { message: 'Sign-in taking too long' });
        }
      }, 5000);
      
      // Attempt to sign in - IMPORTANT: Don't try to access properties of the result directly
      const signInResult = await sdk.actions.signIn({
        nonce,
        timeout: 30000, // 30 second timeout
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      console.log('Sign-in completed');
      logDebugInfo('SIGN_IN_COMPLETED');
      
      // If we get here, we have a successful sign-in
      if (signInResult) {
        console.log('Sign-in successful');
        
        // Create a simplified user object
        const userData = {
          authenticated: true,
          timestamp: new Date().toISOString()
        };
        
        // Store in sessionStorage
        sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        // Notify of success
        if (onSuccess) {
          onSuccess(userData);
        }
      } else {
        // Handle failure case
        const errorMsg = 'Sign-in failed without specific error';
        console.error(errorMsg);
        logDebugInfo('SIGN_IN_FAILED', { error: errorMsg });
        
        setError(errorMsg);
        if (onError) onError(new Error(errorMsg));
      }
    } catch (e) {
      // Handle any exceptions
      console.error('Error during sign-in process:', e);
      logDebugInfo('SIGN_IN_EXCEPTION', { error: e.message });
      
      setError(e.message);
      if (onError) onError(e);
    } finally {
      // Always reset signing in state
      setIsSigningIn(false);
    }
  };
  
  return (
    <div>
      <button
        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out"
        onClick={handleSignIn}
        disabled={isSigningIn}
      >
        {isSigningIn ? "Signing in..." : buttonText}
      </button>
      
      {error && (
        <div className="mt-2 text-sm text-red-600">
          Error: {error}
        </div>
      )}
      
      <DebugPanel
        sdkStatus={sdkStatus}
        authAttempts={authAttempts}
        lastError={error}
      />
    </div>
  );
};

export default SimpleMiniAppSignIn; 