import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { useAuth } from '../contexts/AuthContext';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

/**
 * MiniAppAuthHandler - Handles silent authentication in Mini App environment
 * 
 * This component automatically signs in the user when in a Mini App environment
 * where the user is already authenticated in their Farcaster client (like Warpcast)
 */
const MiniAppAuthHandler = () => {
  const { login, isAuthenticated, profile, setAuthenticating } = useAuth();
  const [authAttempted, setAuthAttempted] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    // Only attempt auto-login once when the component mounts
    // and only if the user is not already authenticated
    if (!authAttempted && !isAuthenticated) {
      const attemptSilentSignIn = async () => {
        try {
          console.log("MiniAppAuthHandler: Attempting silent sign-in...");
          setIsAuthenticating(true);
          
          // Use the SDK's signIn method which should work silently in Warpcast
          const signInResult = await sdk.actions.signIn();
          
          console.log("MiniAppAuthHandler: Raw sign-in result:", signInResult);
          
          if (signInResult && (signInResult.success || signInResult.message)) {
            console.log("MiniAppAuthHandler: Silent sign-in successful", signInResult);
            
            // Try multiple ways to extract FID from the response
            let fid = null;
            
            // Option 1: Direct data access
            if (signInResult.data?.fid) {
              fid = signInResult.data.fid;
            } 
            // Option 2: Parse from message
            else if (signInResult.message) {
              const fidMatch = signInResult.message.match(/(?:fid|FID):\s*(\d+)/i);
              if (fidMatch && fidMatch[1]) {
                fid = parseInt(fidMatch[1], 10);
              }
            }
            
            if (fid) {
              // Process the result to get the user info
              const userData = {
                fid: fid,
                username: signInResult.data?.username || `user${fid}`,
                displayName: signInResult.data?.displayName || `User ${fid}`,
                pfp: signInResult.data?.pfp?.url || null,
                verifications: signInResult.data?.verifications || [],
                token: signInResult.signature || '',
                // Include the raw data for debugging
                _rawAuthResult: signInResult
              };
              
              console.log("MiniAppAuthHandler: Extracted user data:", userData);
              
              // Update the auth context
              login(userData);
              return;
            }
            
            console.warn("MiniAppAuthHandler: Could not extract FID from sign-in result");
          } else {
            console.warn("MiniAppAuthHandler: Silent sign-in failed", signInResult?.error || "No valid result");
          }
        } catch (error) {
          console.error("MiniAppAuthHandler: Error during silent sign-in", error);
        } finally {
          setIsAuthenticating(false);
          setAuthAttempted(true);
        }
      };
      
      attemptSilentSignIn();
    }
  }, [isAuthenticated, login, authAttempted, setIsAuthenticating]);

  // This is a silent authentication component, so it doesn't render anything visible
  return null;
};

export default MiniAppAuthHandler; 