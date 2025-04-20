import React, { useState, useEffect } from 'react';

/**
 * Debug Wrapper Component
 * Wraps the application and provides debugging information
 */
const DebugWrapper = ({ children }) => {
  const [showDebug, setShowDebug] = useState(false);
  const [sdkStatus, setSdkStatus] = useState({});
  const [envInfo, setEnvInfo] = useState({});

  useEffect(() => {
    // Collect environment info on mount
    if (typeof window !== 'undefined') {
      setEnvInfo({
        url: window.location.href,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        devicePixelRatio: window.devicePixelRatio,
        localStorage: typeof localStorage !== 'undefined',
        sessionStorage: typeof sessionStorage !== 'undefined'
      });

      // Check for SDK status
      if (window.sdk) {
        setSdkStatus({
          defined: true,
          initialized: !!window.sdk.initialized,
          hasActions: !!(window.sdk.actions),
          hasContext: !!(window.sdk.context),
          hasGetContext: typeof window.sdk.getContext === 'function'
        });
      } else {
        setSdkStatus({ defined: false });
      }

      // Add keyboard shortcut to toggle debug panel
      const handleKeyDown = (e) => {
        // Ctrl+Shift+D to toggle debug panel
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
          e.preventDefault();
          setShowDebug(prev => !prev);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  // If not showing debug, just render children
  if (!showDebug) {
    return (
      <>
        {children}
        <div 
          style={{
            position: 'fixed',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '10px',
            cursor: 'pointer',
            zIndex: 9999
          }}
          onClick={() => setShowDebug(true)}
        >
          Debug Mode
        </div>
      </>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          padding: '15px',
          backgroundColor: '#282c34',
          color: '#fff',
          zIndex: 9999,
          fontFamily: 'monospace',
          fontSize: '12px',
          overflowY: 'auto',
          maxHeight: '80vh'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h2 style={{ margin: 0 }}>Debug Information</h2>
          <button
            style={{
              backgroundColor: '#61dafb',
              border: 'none',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer'
            }}
            onClick={() => setShowDebug(false)}
          >
            Close
          </button>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ marginBottom: '5px' }}>Environment</h3>
          <pre>{JSON.stringify(envInfo, null, 2)}</pre>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ marginBottom: '5px' }}>SDK Status</h3>
          <pre>{JSON.stringify(sdkStatus, null, 2)}</pre>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ marginBottom: '5px' }}>Local Storage</h3>
          <pre>
            {typeof localStorage !== 'undefined' 
              ? JSON.stringify(Object.keys(localStorage).reduce((acc, key) => {
                  try {
                    acc[key] = JSON.parse(localStorage.getItem(key));
                  } catch(e) {
                    acc[key] = localStorage.getItem(key);
                  }
                  return acc;
                }, {}), null, 2)
              : 'localStorage not available'}
          </pre>
        </div>
        
        <button
          style={{
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            margin: '5px',
            cursor: 'pointer'
          }}
          onClick={() => {
            if (typeof localStorage !== 'undefined') {
              localStorage.clear();
              alert('LocalStorage cleared');
              window.location.reload();
            }
          }}
        >
          Clear Storage & Reload
        </button>
        
        <button
          style={{
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            margin: '5px',
            cursor: 'pointer'
          }}
          onClick={() => window.location.reload()}
        >
          Reload Page
        </button>
      </div>
      
      <div style={{ marginTop: showDebug ? '300px' : 0 }}>
        {children}
      </div>
    </div>
  );
};

export default DebugWrapper; 