import React from 'react';
import { SignInButton } from '@farcaster/auth-kit';
import farcasterAuthService from '../services/farcasterAuthService';
import { isMiniAppEnvironment, handleMiniAppAuthentication } from '../utils/miniAppUtils';

/**
 * Farcaster Sign-In Button component
 * Renders a button that allows users to sign in with their Farcaster wallet
 * Now supports both standard and Mini App environments as a fallback
 */
const FarcasterSignInButton = ({ onSuccess, className, style }) => {
  const { useSignInHook } = farcasterAuthService;
  const { status } = useSignInHook();
  
  // Handle successful sign-in
  const handleSuccess = (profile) => {
    console.log('⭐ Sign-in success with profile:', profile);
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(profile);
    }
  };
  
  // Check if we're in a Mini App environment
  const isInMiniApp = isMiniAppEnvironment();
  
  // Generate a nonce for auth
  const generateNonce = () => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  
  // Handle manual Mini App auth as a backup option
  const handleManualMiniAppAuth = async () => {
    try {
      console.log('🔐 Manual Mini App authentication attempt');
      const nonce = generateNonce();
      const result = await handleMiniAppAuthentication(nonce);
      console.log('📱 Manual Mini App auth result:', result);
      // The auth result will be handled by the parent component
      if (result) {
        handleSuccess({
          fid: 'miniapp-user', // This will be properly set by the auth context
          username: 'miniapp-user',
          message: result.message,
          signature: result.signature
        });
      }
    } catch (error) {
      console.error('❌ Manual Mini App auth error:', error);
    }
  };
  
  return (
    <div className={className} style={{
      ...style,
      position: 'relative',
      zIndex: 10,
      cursor: 'pointer'
    }}>
      {/* Always show the sign-in button, even in Mini App mode as a fallback */}
      <SignInButton 
        onSuccess={handleSuccess} 
        text={isInMiniApp ? "Manual Sign In" : undefined} 
      />
      
      {isInMiniApp && (
        <button 
          onClick={handleManualMiniAppAuth} 
          className="manual-signin-button"
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#8B5CF6',
            color: 'white',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Native Sign In
        </button>
      )}
      
      {status === 'loading' && <div>Loading...</div>}
      {status === 'error' && <div>Error signing in. Please try again.</div>}
    </div>
  );
};

export default FarcasterSignInButton; 