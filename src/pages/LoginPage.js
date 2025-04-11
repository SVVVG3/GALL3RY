import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SignInButton } from '@farcaster/auth-kit';
import '../styles/app.css';

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  return (
    <div className="login-container">
      <h2>Sign In to GALL3RY</h2>
      <p>Connect with your Farcaster account to manage your NFT collections.</p>
      
      <div className="login-options">
        <div className="farcaster-auth-button">
          <SignInButton />
        </div>
        
        <div className="separator">
          <span>or continue with</span>
        </div>
        
        <button className="login-option" disabled>
          <span>Wallet Connect (Coming Soon)</span>
        </button>
      </div>
      
      <div className="login-info">
        <p>Sign in with your Farcaster account to access all features.</p>
      </div>
    </div>
  );
};

export default LoginPage; 