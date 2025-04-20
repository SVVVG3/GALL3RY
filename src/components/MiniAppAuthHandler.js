import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { handleMiniAppAuthentication, isMiniAppEnvironment } from '../utils/miniAppUtils';
import { useAuth } from '../contexts/AuthContext';

/**
 * Component that handles automatic authentication in Mini App environments.
 * This component doesn't render anything visible but manages the authentication flow.
 */
const MiniAppAuthHandler = () => {
  const { isAuthenticated } = useAuth();
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);

  // Attempt to authenticate on mount
  useEffect(() => {
    const attemptAuth = async () => {
      if (!isAuthenticated && !hasAttemptedAuth) {
        console.log('MiniAppAuthHandler: Attempting automatic authentication');
        
        // First check if we're actually in a Mini App environment
        if (!isMiniAppEnvironment()) {
          console.log('MiniAppAuthHandler: Not in a Mini App environment');
          setHasAttemptedAuth(true);
          return;
        }
        
        try {
          // Use the simplified authentication approach
          const authResult = await handleMiniAppAuthentication();
          
          console.log('MiniAppAuthHandler: Authentication result:', 
            authResult.success ? 'SUCCESS' : 'FAILED', 
            authResult.error || '');
            
          // No need to handle the result here - the auth handler
          // dispatches events and stores data in localStorage
        } catch (error) {
          console.error('MiniAppAuthHandler: Authentication error:', error);
        } finally {
          setHasAttemptedAuth(true);
        }
      }
    };

    attemptAuth();
  }, [isAuthenticated, hasAttemptedAuth]);

  // This component doesn't render anything
  return null;
};

export default MiniAppAuthHandler; 