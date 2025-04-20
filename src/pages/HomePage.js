import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import { NFTProvider } from '../contexts/NFTContext';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import { sdk } from '@farcaster/frame-sdk';
import DiagnosticPanel from '../components/DiagnosticPanel';
import { usePrivy } from '@privy-io/react-auth';
import PrivyFarcasterButton from '../components/PrivyFarcasterButton';

// Debug mode constant
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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const { isAuthenticated, profile } = useAuth();
  const { loadProfileNFTs } = useProfile();
  const [sdkAvailable, setSdkAvailable] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  
  // Import Privy hooks instead of custom auth
  const { user, authenticated, ready } = usePrivy();
  
  useEffect(() => {
    const checkEnvironment = async () => {
      const inMiniApp = await isMiniAppEnvironment();
      setIsMiniApp(inMiniApp);
      setSdkAvailable(typeof sdk !== 'undefined');
    };
    
    checkEnvironment();
  }, []);
  
  useEffect(() => {
    if (authenticated && user?.farcaster?.fid) {
      console.log('Privy user authenticated with FID:', user.farcaster.fid);
    }
  }, [authenticated, user]);
  
  const renderUserData = () => {
    if (!authenticated || !user?.farcaster) {
      return <p>Not signed in with Farcaster</p>;
    }
    
    const { farcaster } = user;
    
    return (
      <div className="user-info">
        {farcaster.pfp && (
          <img 
            src={farcaster.pfp} 
            alt={`${farcaster.displayName || farcaster.username}'s profile`}
            className="user-avatar"
          />
        )}
        <div className="user-details">
          <h3>{farcaster.displayName || farcaster.username}</h3>
          <p>@{farcaster.username}</p>
          <p className="user-fid">FID: {farcaster.fid}</p>
        </div>
      </div>
    );
  };
  
  return (
    <div className="home-page">
      <h1>Welcome to GALL3RY</h1>
      <p>Your decentralized NFT collection manager</p>
      
      <div className="app-container">
        {isMiniApp && (
          <div className="auth-container">
            <h2>Mini App Authentication</h2>
            {/* Privy authentication is handled automatically at the app level */}
            {renderUserData()}
          </div>
        )}
        
        {!isMiniApp && (
          <div className="auth-container">
            <h2>Web Authentication</h2>
            <PrivyFarcasterButton 
              buttonText="Sign in with Farcaster"
            />
            {renderUserData()}
          </div>
        )}
        
        <div className="nft-section">
          <h2>Your NFT Collection</h2>
          {authenticated && user?.farcaster ? (
            <NFTProvider>
              <FarcasterUserSearch 
                defaultFid={user.farcaster.fid} 
                defaultUsername={user.farcaster.username} 
              />
            </NFTProvider>
          ) : (
            <p>Sign in to view your NFT collection</p>
          )}
        </div>
      </div>
      
      {DEBUG_MODE && (
        <>
          <button 
            onClick={() => setShowDiagnostics(true)}
            className="diagnostic-button"
          >
            Show Diagnostics
          </button>
          
          {showDiagnostics && (
            <DiagnosticViewer onClose={() => setShowDiagnostics(false)} />
          )}
        </>
      )}
    </div>
  );
};

export default HomePage; 