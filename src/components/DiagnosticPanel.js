import React, { useState, useEffect } from 'react';
import { sdk } from '@farcaster/frame-sdk';

// Helper function to safely get the SDK status
const getSdkStatus = () => {
  try {
    return {
      defined: !!sdk,
      hasActions: sdk && !!sdk.actions,
      hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
      hasGetContext: sdk && typeof sdk.getContext === 'function',
      hasContext: sdk && !!sdk.context,
      hasSplashScreen: sdk && typeof sdk.hideSplashScreen === 'function'
    };
  } catch (e) {
    console.error("Error getting SDK status:", e);
    return {
      defined: false,
      error: e.message
    };
  }
};

// Helper to get stored auth data
const getStoredAuthData = () => {
  try {
    const miniAppUserInfo = sessionStorage.getItem('miniAppUserInfo');
    const miniAppAuthToken = sessionStorage.getItem('miniAppAuthToken');
    
    return {
      hasToken: !!miniAppAuthToken,
      hasUserInfo: !!miniAppUserInfo,
      userData: miniAppUserInfo ? JSON.parse(miniAppUserInfo) : null
    };
  } catch (e) {
    console.error("Error getting stored auth data:", e);
    return {
      hasToken: false,
      hasUserInfo: false,
      error: e.message
    };
  }
};

const DiagnosticPanel = () => {
  const [sdkStatus, setSdkStatus] = useState({});
  const [authData, setAuthData] = useState({});
  const [userAgent, setUserAgent] = useState('');
  const [eventLog, setEventLog] = useState([]);
  const [collapsed, setCollapsed] = useState({
    sdk: false,
    auth: false,
    environment: false,
    events: false
  });
  const [imageRequests, setImageRequests] = useState([]);

  // Log an event to the panel
  const logEvent = (event) => {
    const timestamp = new Date().toISOString().split('T')[1].substring(0, 8);
    setEventLog(prev => [`${timestamp} - ${event}`, ...prev.slice(0, 19)]);
  };

  // Update the diagnostic data
  useEffect(() => {
    // Set initial values
    setSdkStatus(getSdkStatus());
    setAuthData(getStoredAuthData());
    setUserAgent(navigator.userAgent);
    
    // Log initial state
    logEvent("DiagnosticPanel initialized");
    
    // Check if SDK context is available
    const checkSdkContext = async () => {
      try {
        if (sdk && typeof sdk.getContext === 'function') {
          logEvent("Checking SDK context");
          const context = await sdk.getContext();
          if (context) {
            logEvent(`SDK context available: User FID: ${context.user?.fid || 'N/A'}`);
          } else {
            logEvent("SDK context not available");
          }
        }
      } catch (e) {
        logEvent(`SDK context error: ${e.message}`);
      }
    };
    
    checkSdkContext();
    
    // Listen for auth events
    const handleAuthEvent = (e) => {
      logEvent(`Auth event received: User FID: ${e.detail?.fid || 'N/A'}`);
      setAuthData(getStoredAuthData());
    };
    
    window.addEventListener('miniAppAuthenticated', handleAuthEvent);
    
    // Update status periodically
    const intervalId = setInterval(() => {
      setSdkStatus(getSdkStatus());
      setAuthData(getStoredAuthData());
    }, 5000);
    
    return () => {
      window.removeEventListener('miniAppAuthenticated', handleAuthEvent);
      clearInterval(intervalId);
    };
  }, []);
  
  // Manual attempt to get context
  const handleGetContext = async () => {
    try {
      logEvent("Manual request: Getting SDK context");
      if (!sdk) {
        logEvent("SDK not available");
        return;
      }
      
      if (typeof sdk.getContext === 'function') {
        const context = await sdk.getContext();
        if (context) {
          logEvent(`Context received: ${JSON.stringify(context).substring(0, 100)}...`);
        } else {
          logEvent("No context available from sdk.getContext()");
        }
      } else {
        logEvent("sdk.getContext not available as a function");
      }
      
      // Also check sdk.context property
      if (sdk.context) {
        logEvent(`sdk.context property: ${JSON.stringify(sdk.context).substring(0, 100)}...`);
      } else {
        logEvent("sdk.context property not available");
      }
      
      // Refresh SDK status
      setSdkStatus(getSdkStatus());
    } catch (e) {
      logEvent(`Error getting context: ${e.message}`);
    }
  };
  
  // Clear stored auth data
  const handleClearAuth = () => {
    try {
      sessionStorage.removeItem('miniAppAuthToken');
      sessionStorage.removeItem('miniAppUserInfo');
      logEvent("Cleared stored auth data");
      setAuthData(getStoredAuthData());
    } catch (e) {
      logEvent(`Error clearing auth: ${e.message}`);
    }
  };
  
  // Section toggle helper
  const toggleSection = (section) => {
    setCollapsed(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Monitor network requests for images
  useEffect(() => {
    // Create a performance observer to monitor resource timing
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Filter for image requests to our proxy endpoint
          if (entry.name.includes('/api/image-proxy') || 
              entry.initiatorType === 'img') {
            setImageRequests(prev => {
              // Only add if not already in the list (using URL as key)
              if (!prev.some(req => req.url === entry.name)) {
                return [...prev, {
                  url: entry.name,
                  status: 'unknown',
                  duration: Math.round(entry.duration),
                  timestamp: Date.now()
                }].slice(-10); // Keep only most recent 10
              }
              return prev;
            });
          }
        });
      });
      
      observer.observe({entryTypes: ['resource']});
      
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div style={{
      width: '100%',
      maxWidth: '500px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #ddd',
      borderRadius: '8px',
      fontSize: '12px',
      margin: '20px auto',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      textAlign: 'left'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px',
        borderBottom: '1px solid #ddd',
        paddingBottom: '8px'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px' }}>Farcaster Mini App Diagnostics</h3>
      </div>
      
      {/* SDK Status Section */}
      <div style={{ marginBottom: '12px' }}>
        <div 
          onClick={() => toggleSection('sdk')}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span>SDK Status {sdkStatus.defined ? '✅' : '❌'}</span>
          <span>{collapsed.sdk ? '▼' : '▲'}</span>
        </div>
        
        {!collapsed.sdk && (
          <div style={{ marginLeft: '10px', marginTop: '5px' }}>
            {Object.entries(sdkStatus).map(([key, value]) => (
              <div key={key} style={{ marginBottom: '2px' }}>
                • {key}: <span style={{ color: value ? '#38a169' : '#e53e3e' }}>{String(value)}</span>
              </div>
            ))}
            <button 
              onClick={handleGetContext} 
              style={{
                marginTop: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#edf2f7',
                border: '1px solid #cbd5e0',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Get SDK Context
            </button>
          </div>
        )}
      </div>
      
      {/* Auth Data Section */}
      <div style={{ marginBottom: '12px' }}>
        <div 
          onClick={() => toggleSection('auth')}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span>Authentication {authData.hasToken ? '✅' : '❌'}</span>
          <span>{collapsed.auth ? '▼' : '▲'}</span>
        </div>
        
        {!collapsed.auth && (
          <div style={{ marginLeft: '10px', marginTop: '5px' }}>
            <div>• Has Token: <span style={{ color: authData.hasToken ? '#38a169' : '#e53e3e' }}>{String(authData.hasToken)}</span></div>
            <div>• Has User Info: <span style={{ color: authData.hasUserInfo ? '#38a169' : '#e53e3e' }}>{String(authData.hasUserInfo)}</span></div>
            
            {authData.userData && (
              <div style={{ margin: '5px 0' }}>
                <div>• FID: {authData.userData.fid || 'N/A'}</div>
                <div>• Username: {authData.userData.username || 'N/A'}</div>
                <div>• Display Name: {authData.userData.displayName || 'N/A'}</div>
              </div>
            )}
            
            {authData.error && (
              <div style={{ color: '#e53e3e' }}>• Error: {authData.error}</div>
            )}
            
            <button 
              onClick={handleClearAuth} 
              style={{
                marginTop: '5px',
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#fed7d7',
                border: '1px solid #feb2b2',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Auth Data
            </button>
          </div>
        )}
      </div>
      
      {/* Environment Section */}
      <div style={{ marginBottom: '12px' }}>
        <div 
          onClick={() => toggleSection('environment')}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span>Environment</span>
          <span>{collapsed.environment ? '▼' : '▲'}</span>
        </div>
        
        {!collapsed.environment && (
          <div style={{ marginLeft: '10px', marginTop: '5px' }}>
            <div style={{ wordBreak: 'break-all' }}>• User Agent: {userAgent}</div>
            <div>• Hostname: {window.location.hostname}</div>
            <div>• Path: {window.location.pathname}</div>
            <div>• localStorage available: {typeof localStorage !== 'undefined' ? 'Yes' : 'No'}</div>
            <div>• sessionStorage available: {typeof sessionStorage !== 'undefined' ? 'Yes' : 'No'}</div>
          </div>
        )}
      </div>
      
      {/* Event Log Section */}
      <div style={{ marginBottom: '12px' }}>
        <div 
          onClick={() => toggleSection('events')}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          <span>Event Log ({eventLog.length})</span>
          <span>{collapsed.events ? '▼' : '▲'}</span>
        </div>
        
        {!collapsed.events && (
          <div style={{ 
            marginLeft: '10px', 
            marginTop: '5px', 
            maxHeight: '100px', 
            overflowY: 'auto',
            border: '1px solid #edf2f7',
            padding: '5px',
            borderRadius: '4px'
          }}>
            {eventLog.length > 0 ? (
              eventLog.map((event, i) => (
                <div key={i} style={{ fontSize: '11px', marginBottom: '3px' }}>
                  {event}
                </div>
              ))
            ) : (
              <div style={{ fontStyle: 'italic', color: '#718096' }}>No events logged yet</div>
            )}
          </div>
        )}
      </div>

      <div className="diagnostic-section">
        <h3>Recent Image Requests</h3>
        {imageRequests.length === 0 ? (
          <p>No image requests detected</p>
        ) : (
          <ul className="diagnostic-list">
            {imageRequests.map((req, index) => (
              <li key={index} className="diagnostic-item">
                <div className="diagnostic-url">{req.url.substring(0, 80)}...</div>
                <div className="diagnostic-details">
                  <span>{req.duration}ms</span>
                  <span>{new Date(req.timestamp).toLocaleTimeString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DiagnosticPanel; 