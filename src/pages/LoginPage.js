import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/app.css';

const LoginPage = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  
  const handleLoginWithFarcaster = async () => {
    try {
      // We're using our mock login for this demo
      const result = await login();
      
      if (result.success) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };
  
  return (
    <div className="login-container">
      <h2>Sign In to GALL3RY</h2>
      <p>Connect with your Farcaster account to manage your NFT collections.</p>
      
      <div className="login-options">
        <button 
          className="login-option login-option-farcaster"
          onClick={handleLoginWithFarcaster}
        >
          <span>Sign in with Farcaster</span>
        </button>
        
        <div className="separator">
          <span>or continue with</span>
        </div>
        
        <button className="login-option" disabled>
          <span>Wallet Connect (Coming Soon)</span>
        </button>
      </div>
      
      <div className="login-info">
        <p>This is a demo app. No actual authentication occurs.</p>
      </div>
    </div>
  );
};

export default LoginPage; 