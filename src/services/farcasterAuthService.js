import { useSignIn, useProfile } from '@farcaster/auth-kit';

/**
 * Service for handling Farcaster authentication
 */
const farcasterAuthService = {
  /**
   * Get AuthKit configuration from environment variables
   */
  getConfig: () => ({
    rpcUrl: process.env.REACT_APP_OPTIMISM_RPC_URL,
    domain: process.env.REACT_APP_FARCASTER_DOMAIN,
    siweUri: process.env.REACT_APP_FARCASTER_SIWE_URI,
  }),

  /**
   * Get the useSignIn hook
   */
  useSignInHook: () => {
    const signInHook = useSignIn();
    return {
      signIn: signInHook.signIn,
      signOut: signInHook.signOut,
      status: signInHook.status,
      isSuccess: signInHook.isSuccess,
      isError: signInHook.isError,
      error: signInHook.error,
      data: signInHook.data,
    };
  },

  /**
   * Get the useProfile hook
   */
  useProfileHook: () => {
    const profileHook = useProfile();
    return {
      isAuthenticated: profileHook.isAuthenticated,
      profile: profileHook.profile || {},
    };
  },

  // NOTE: These functions cannot directly use React hooks outside of components
  // Use useProfileHook() instead to access isAuthenticated and profile data
  isAuthenticated: null,
  getCurrentUser: null,
};

export default farcasterAuthService; 