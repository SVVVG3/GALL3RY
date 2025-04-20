import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/frame-sdk';

// Debug mode - synced with HomePage
const DEBUG_MODE = true;

// Helper function to generate a simple nonce
const generateSimpleNonce = () => {
  const random = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);
  return random;
};

// Helper function to safely extract user data from various sources
const safeExtractUserData = (data) => {
  if (!data) return null;
  
  // Log what we received for debugging
  if (DEBUG_MODE) {
    console.log('Extracting user data from:', typeof data, data);
  }
  
  try {
    // If it's already a user object with expected properties
    if (data.fid) {
      return {
        fid: data.fid,
        username: data.username || `user-${data.fid}`,
        displayName: data.displayName || data.username || `User ${data.fid}`,
        pfp: data.pfp || null
      };
    }
    
    // If it's the context.user format
    if (data.user && data.user.fid) {
      return {
        fid: data.user.fid,
        username: data.user.username || `user-${data.user.fid}`,
        displayName: data.user.displayName || data.user.username || `User ${data.user.fid}`,
        pfp: data.user.pfp || null
      };
    }
    
    // If it's just raw data that might contain user info
    let possibleFid = null;
    
    // Check for common patterns in various formats
    if (typeof data === 'object') {
      // Look for fid in common paths
      possibleFid = data.fid || 
                   (data.user && data.user.fid) || 
                   (data.data && data.data.fid) || 
                   (data.result && data.result.fid) ||
                   (data.response && data.response.fid);
                   
      if (possibleFid) {
        // Determine which path had the fid
        const userDataSource = data.fid ? data :
                             data.user ? data.user :
                             data.data ? data.data :
                             data.result ? data.result :
                             data.response ? data.response : null;
        
        if (userDataSource) {
          return {
            fid: userDataSource.fid,
            username: userDataSource.username || `user-${userDataSource.fid}`,
            displayName: userDataSource.displayName || userDataSource.username || `User ${userDataSource.fid}`,
            pfp: userDataSource.pfp || null
          };
        }
      }
    }
    
    // If we still haven't found a user, check if this is a string that might contain
    // user info encoded in JSON
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return safeExtractUserData(parsed); // recursively try to extract from the parsed data
      } catch {
        // Not JSON, ignore
      }
    }
    
    return null;
  } catch (e) {
    console.error('Error extracting user data:', e);
    return null;
  }
};

// Helper to safely get context from SDK
const safeGetContext = async () => {
  try {
    // Check if SDK is defined
    if (!sdk) {
      console.log('SDK is not defined');
      return null;
    }
    
    // First try the getContext method if available
    if (typeof sdk.getContext === 'function') {
      try {
        console.log('Calling sdk.getContext()');
        const context = await sdk.getContext();
        console.log('Context received:', context);
        return context;
      } catch (e) {
        console.error('Error calling sdk.getContext():', e);
      }
    } else {
      console.log('sdk.getContext is not a function');
    }
    
    // Then try the context property
    if (sdk.context) {
      console.log('Using sdk.context property:', sdk.context);
      return sdk.context;
    }
    
    console.log('No context found in SDK');
    return null;
  } catch (e) {
    console.error("Error in safeGetContext:", e);
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
      console.log('Initial context check:', context);
      logDebugInfo('INITIAL_CONTEXT_CHECK', { data: context });
      
      if (context && context.user && context.user.fid) {
        console.log('User already authenticated via context:', context.user);
        logDebugInfo('USER_AUTHENTICATED_FROM_CONTEXT', { 
          message: `User authenticated from context: ${context.user.username || context.user.fid}`,
          data: context.user
        });
        
        const userData = safeExtractUserData(context);
        if (userData && userData.fid) {
          // Store in sessionStorage
          sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          // Notify of success
          if (onSuccess) {
            onSuccess(userData);
          }
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
    
    // Check if sign-in action is available
    if (!sdk.actions || typeof sdk.actions.signIn !== 'function') {
      const errorMsg = 'Sign-in action not available in SDK';
      console.error(errorMsg);
      setError(errorMsg);
      if (onError) onError(new Error(errorMsg));
      logDebugInfo('SIGN_IN_ERROR', { error: errorMsg });
      return;
    }
    
    try {
      setIsSigningIn(true);
      
      // Generate a nonce
      const nonce = generateSimpleNonce();
      console.log('Generated nonce:', nonce);
      logDebugInfo('NONCE_GENERATED', { data: { nonce } });
      
      // Try to get context first
      console.log('Checking for context before sign-in');
      const existingContext = await safeGetContext();
      
      if (existingContext && existingContext.user && existingContext.user.fid) {
        console.log('User already authenticated via context:', existingContext.user);
        logDebugInfo('USER_AUTHENTICATED_FROM_CONTEXT', { 
          message: `User authenticated from context: ${existingContext.user.username || existingContext.user.fid}`,
          data: existingContext.user
        });
        
        const userData = safeExtractUserData(existingContext);
        if (userData && userData.fid) {
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
      }
      
      // If no context, proceed with sign-in
      console.log('Proceeding with sign-in via SDK');
      
      // Create a timeout to handle stuck auth state
      let timeoutId = setTimeout(() => {
        if (isSigningIn) {
          console.warn('Sign-in operation taking too long, may be stuck...');
          logDebugInfo('SIGN_IN_TIMEOUT_WARNING', { message: 'Sign-in taking too long' });
        }
      }, 5000);
      
      // Attempt to sign in
      const signInResult = await sdk.actions.signIn({
        nonce,
        timeout: 30000, // 30 second timeout
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      console.log('Sign-in result:', signInResult);
      logDebugInfo('SIGN_IN_COMPLETED', { data: signInResult });
      
      // Handle success case
      if (signInResult && signInResult.success) {
        console.log('Sign-in successful:', signInResult);
        
        // Check if we have user data in the result
        const userData = safeExtractUserData(signInResult);
        
        if (userData && userData.fid) {
          console.log('User data extracted from sign-in result:', userData);
          logDebugInfo('USER_DATA_EXTRACTED', { data: userData });
          
          // Store in sessionStorage
          sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          // Notify of success
          if (onSuccess) {
            onSuccess(userData);
          }
        } else {
          // If no user data in result, try to get from context
          console.log('No user data in sign-in result, checking context');
          
          try {
            const context = await safeGetContext();
            console.log('Context after sign-in:', context);
            logDebugInfo('CONTEXT_AFTER_SIGNIN', { data: context });
            
            if (context && context.user && context.user.fid) {
              const userData = safeExtractUserData(context);
              
              if (userData && userData.fid) {
                console.log('User data extracted from context:', userData);
                logDebugInfo('USER_DATA_FROM_CONTEXT', { data: userData });
                
                // Store in sessionStorage
                sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                // Notify of success
                if (onSuccess) {
                  onSuccess(userData);
                }
              } else {
                throw new Error('No user data found in context');
              }
            } else {
              throw new Error('No user data in context after sign-in');
            }
          } catch (e) {
            console.error('Error getting user data after sign-in:', e);
            logDebugInfo('USER_DATA_ERROR', { error: e.message });
            setError('Could not retrieve user data after sign-in: ' + e.message);
            if (onError) onError(e);
          }
        }
      } else {
        // Handle failure case
        const errorMsg = (signInResult && signInResult.error) ? 
          signInResult.error : 'Sign-in failed without specific error';
        console.error('Sign-in failed:', errorMsg);
        logDebugInfo('SIGN_IN_FAILED', { 
          error: errorMsg,
          data: signInResult 
        });
        
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