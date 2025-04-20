import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import { NFTProvider } from '../contexts/NFTContext';
import SimpleMiniAppSignIn from '../components/SimpleMiniAppSignIn';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import { sdk } from '@farcaster/frame-sdk';
import DiagnosticPanel from '../components/DiagnosticPanel';

// Debug mode constant - sync with SimpleMiniAppSignIn
const DEBUG_MODE = true;

// Diagnostic Viewer Component
const DiagnosticViewer = ({ onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchLogs();
  }, []);
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/diagnostic');
      const data = await response.json();
      setLogs(data.logs || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load logs: ' + err.message);
      setLoading(false);
    }
  };
  
  const clearLogs = async () => {
    try {
      setLoading(true);
      await fetch('/api/diagnostic?clear=true');
      setLogs([]);
      setLoading(false);
    } catch (err) {
      setError('Failed to clear logs: ' + err.message);
      setLoading(false);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: 1000,
      padding: '20px',
      overflowY: 'auto'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '15px',
        borderRadius: '8px',
        maxWidth: '600px',
        margin: '0 auto',
        position: 'relative'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Diagnostic Logs</h2>
          <button onClick={onClose} style={{
            border: 'none',
            background: 'none',
            fontSize: '24px',
            cursor: 'pointer'
          }}>&times;</button>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <button onClick={fetchLogs} style={{
            padding: '8px 12px',
            backgroundColor: '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            marginRight: '10px',
            cursor: 'pointer'
          }}>
            Refresh Logs
          </button>
          
          <button onClick={clearLogs} style={{
            padding: '8px 12px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Clear Logs
          </button>
        </div>
        
        {loading && <div>Loading logs...</div>}
        
        {error && (
          <div style={{
            padding: '10px',
            backgroundColor: '#FED7D7',
            color: '#9B2C2C',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            {error}
          </div>
        )}
        
        {!loading && logs.length === 0 && (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: '#666'
          }}>
            No logs available
          </div>
        )}
        
        <div style={{
          maxHeight: '500px',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          {logs.map((log, index) => (
            <div key={index} style={{
              padding: '10px',
              borderBottom: index < logs.length - 1 ? '1px solid #e2e8f0' : 'none',
              backgroundColor: log.type === 'error' ? '#FED7D7' : 
                              log.type === 'warn' ? '#FEEBC8' : 'white'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '5px'
              }}>
                <strong>{log.event || log.type}</strong>
                <span style={{ fontSize: '11px', color: '#718096' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div>{log.message}</div>
              
              {log.error && (
                <div style={{
                  color: '#e53e3e',
                  marginTop: '5px',
                  fontFamily: 'monospace',
                  fontSize: '11px'
                }}>
                  {log.error}
                </div>
              )}
              
              {log.data && (
                <details style={{ marginTop: '5px', fontSize: '11px' }}>
                  <summary style={{ cursor: 'pointer' }}>Details</summary>
                  <pre style={{
                    marginTop: '5px',
                    padding: '5px',
                    backgroundColor: '#f7fafc',
                    overflowX: 'auto',
                    fontSize: '10px'
                  }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
              
              {log.clientInfo && (
                <details style={{ marginTop: '5px', fontSize: '11px' }}>
                  <summary style={{ cursor: 'pointer' }}>Client Info</summary>
                  <pre style={{
                    marginTop: '5px',
                    padding: '5px',
                    backgroundColor: '#f7fafc',
                    overflowX: 'auto',
                    fontSize: '10px'
                  }}>
                    {JSON.stringify(log.clientInfo, null, 2)}
                  </pre>
                </details>
              )}
              
              {log.sdkInfo && (
                <details style={{ marginTop: '5px', fontSize: '11px' }}>
                  <summary style={{ cursor: 'pointer' }}>SDK Info</summary>
                  <pre style={{
                    marginTop: '5px',
                    padding: '5px',
                    backgroundColor: '#f7fafc',
                    overflowX: 'auto',
                    fontSize: '10px'
                  }}>
                    {JSON.stringify(log.sdkInfo, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Simple HomePage Component with minimal dependencies
 */
const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authStatus, setAuthStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    setIsMiniApp(isMiniAppEnvironment());
    
    // Check SDK status and log for debugging
    if (typeof window !== 'undefined') {
      console.log('HomePage - SDK Status:', {
        sdkDefined: !!sdk,
        hasActions: sdk && !!sdk.actions,
        hasContext: sdk && !!sdk.context,
        hasGetContextMethod: sdk && typeof sdk.getContext === 'function'
      });
      
      // Send initial diagnostic log
      if (DEBUG_MODE) {
        try {
          fetch('/api/diagnostic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'APP_INITIALIZED',
              type: 'info',
              message: 'Homepage component initialized',
              clientInfo: {
                userAgent: navigator.userAgent,
                hostname: window.location.hostname,
                pathname: window.location.pathname,
                isMiniApp: isMiniAppEnvironment(),
                timestamp: new Date().toISOString()
              },
              sdkInfo: {
                defined: !!sdk,
                hasActions: sdk && !!sdk.actions,
                hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
                hasGetContext: sdk && typeof sdk.getContext === 'function',
                hasContext: sdk && !!sdk.context
              }
            })
          }).catch(e => console.warn('Failed to send diagnostic log:', e));
        } catch (e) {
          console.warn('Error sending diagnostic log:', e);
        }
      }
    }
  }, []);

  const handleSignInSuccess = (userData) => {
    console.log('SignIn Success:', userData);
    setAuthStatus('success');
    setAuthError(null);
    
    // Log successful sign-in
    if (DEBUG_MODE) {
      try {
        fetch('/api/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'SIGN_IN_SUCCESS',
            type: 'info',
            message: `User signed in: ${userData.username}`,
            data: {
              fid: userData.fid,
              username: userData.username
            }
          })
        }).catch(e => console.warn('Failed to send diagnostic log:', e));
      } catch (e) {
        console.warn('Error sending diagnostic log:', e);
      }
    }
  };

  const handleSignInError = (error) => {
    console.error('SignIn Error:', error);
    setAuthStatus('error');
    setAuthError(error.message || 'Authentication failed');
    
    // Log sign-in error
    if (DEBUG_MODE) {
      try {
        fetch('/api/diagnostic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'SIGN_IN_ERROR',
            type: 'error',
            message: 'Authentication failed',
            error: error.message || 'Unknown error'
          })
        }).catch(e => console.warn('Failed to send diagnostic log:', e));
      } catch (e) {
        console.warn('Error sending diagnostic log:', e);
      }
    }
    
    // Reset error after 5 seconds
    setTimeout(() => {
      setAuthError(null);
      setAuthStatus('idle');
    }, 5000);
  };

  return (
    <div className="home-page">
      <div className="container mx-auto px-4 py-8">
        {isMiniApp && !isAuthenticated && (
          <div className="mini-app-signin-container mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 text-purple-800">Welcome to the Mini App</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sign in with your Farcaster account to view and share your NFTs
            </p>
            
            <SimpleMiniAppSignIn 
              onSuccess={handleSignInSuccess} 
              onError={handleSignInError}
            />
            
            {authStatus === 'error' && authError && (
              <div className="error-message mt-3 p-2 bg-red-100 text-red-700 rounded">
                {authError}
              </div>
            )}
          </div>
        )}
        
        {isAuthenticated && user && (
          <div className="user-info mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Welcome, {user.displayName || user.username}</h2>
            <p className="text-sm text-gray-600">
              FID: {user.fid} | Username: @{user.username}
            </p>
          </div>
        )}
        
        <NFTProvider>
          <FarcasterUserSearch />
        </NFTProvider>
        
        {/* Always show the diagnostic panel in mini app environment */}
        {isMiniApp && <DiagnosticPanel />}
      </div>
    </div>
  );
};

export default HomePage; 