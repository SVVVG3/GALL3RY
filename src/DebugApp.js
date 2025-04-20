import React, { useState, useEffect } from 'react';
import DebugWrapper from './components/DebugWrapper';

/**
 * A simplified Application component for debugging
 * This is used to diagnose rendering issues
 */
const DebugApp = () => {
  const [sdkInitialized, setSdkInitialized] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const [error, setError] = useState(null);
  
  // Test SDK initialization
  useEffect(() => {
    try {
      console.log('Debug App is mounting');
      
      if (typeof window !== 'undefined' && window.sdk) {
        console.log('SDK found in window');
        
        // Check if SDK is initialized
        if (typeof window.sdk.init === 'function' && !window.sdk.initialized) {
          console.log('Attempting to initialize SDK');
          try {
            window.sdk.init();
            setSdkInitialized(true);
            console.log('SDK initialized successfully');
          } catch (initError) {
            console.error('Failed to initialize SDK:', initError);
            setError(`SDK init error: ${initError.message}`);
          }
        } else if (window.sdk.initialized) {
          console.log('SDK already initialized');
          setSdkInitialized(true);
        } else {
          console.log('SDK init method not found');
          setError('SDK init method not available');
        }
      } else {
        console.log('SDK not found in window');
        setError('SDK not available');
      }
      
      // Increment render count
      setRenderCount(prev => prev + 1);
    } catch (e) {
      console.error('Error in debug app effect:', e);
      setError(`Error in debug app: ${e.message}`);
    }
  }, []);

  return (
    <DebugWrapper>
      <div style={{ 
        padding: '20px', 
        margin: '20px', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <h1 style={{ color: '#8b5cf6' }}>GALL3RY Debug Mode</h1>
        <p>This is a simplified version of the app to diagnose rendering issues.</p>
        
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
          <h2>Render Status</h2>
          <p>Render count: {renderCount}</p>
          <p>SDK initialized: {sdkInitialized ? 'Yes' : 'No'}</p>
          {error && (
            <div style={{ color: 'red', padding: '10px', backgroundColor: '#ffebee', borderRadius: '4px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
          <h2>SDK Context Test</h2>
          <button 
            onClick={async () => {
              try {
                if (window.sdk && typeof window.sdk.getContext === 'function') {
                  const context = await window.sdk.getContext();
                  alert(`Context: ${JSON.stringify(context, null, 2)}`);
                } else {
                  alert('SDK getContext method not available');
                }
              } catch (e) {
                alert(`Error getting context: ${e.message}`);
              }
            }}
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Test SDK Context
          </button>
        </div>
        
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '4px' }}>
          <h2>Controls</h2>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              backgroundColor: '#4caf50',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            Go to Main App
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#2196f3',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </DebugWrapper>
  );
};

export default DebugApp; 