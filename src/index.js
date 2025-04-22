// Global error handlers to debug blank screen issues
if (typeof window !== 'undefined') {
  console.log('Initializing global error handlers');
  
  window.addEventListener('error', function(event) {
    console.error('GLOBAL ERROR:', event.error);
    
    // Display error on screen for debugging
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.padding = '20px';
    errorDiv.style.backgroundColor = 'red';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.maxWidth = '80%';
    errorDiv.style.maxHeight = '80%';
    errorDiv.style.overflow = 'auto';
    errorDiv.innerHTML = `<strong>Error:</strong> ${event.error?.message || 'Unknown error'}<br/><pre>${event.error?.stack || 'No stack trace'}</pre>`;
    document.body.appendChild(errorDiv);
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    // Check if this is a Chrome extension communication error
    const isExtensionError = 
      event.reason?.message?.includes('chrome.runtime.sendMessage()') || 
      event.reason?.toString().includes('chrome.runtime.sendMessage()');
    
    // Log the error but only show UI for non-extension errors
    if (isExtensionError) {
      console.warn('Chrome extension communication error (safely ignored):', event.reason);
      // Prevent default handling of the event to avoid UI errors
      event.preventDefault();
      return;
    }
    
    console.error('UNHANDLED PROMISE REJECTION:', event.reason);
    
    // Display error on screen for debugging
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.right = '0';
    errorDiv.style.padding = '20px';
    errorDiv.style.backgroundColor = 'orange';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.maxWidth = '80%';
    errorDiv.style.maxHeight = '80%';
    errorDiv.style.overflow = 'auto';
    errorDiv.innerHTML = `<strong>Promise Error:</strong> ${event.reason?.message || String(event.reason)}<br/><pre>${event.reason?.stack || 'No stack trace'}</pre>`;
    document.body.appendChild(errorDiv);
  });
  
  // Add crypto polyfill if needed
  if (!window.crypto) {
    console.warn('Crypto API not found, adding polyfill');
    window.crypto = { 
      getRandomValues: function(buffer) {
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = Math.floor(Math.random() * 256);
        }
        return buffer;
      }
    };
  }
  
  console.log('Browser environment:', {
    userAgent: navigator.userAgent,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    hasCrypto: !!window.crypto,
    hasGetRandomValues: !!(window.crypto && window.crypto.getRandomValues)
  });
}

// Import polyfill first
import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { Provider as ReduxProvider } from 'react-redux';
import store from './redux/store';

// Error Boundary Component to catch errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("App crashed with error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          margin: '20px', 
          borderRadius: '8px',
          backgroundColor: '#fff', 
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#8b5cf6' }}>Something went wrong</h1>
          <p>We're sorry, but the app encountered an error.</p>
          <p>Try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              backgroundColor: '#8b5cf6',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '20px',
              border: 'none',
              margin: '15px 0',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
          <details style={{ marginTop: '20px', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Error details</summary>
            <pre style={{ 
              background: '#f9fafb', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '0.8em'
            }}>
              {this.state.error && this.state.error.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

// Create a root
const root = ReactDOM.createRoot(document.getElementById('root'));

// Wrap everything in a try-catch as an extra precaution
try {
  // Render the app with error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ReduxProvider store={store}>
          <AuthProvider>
            <ProfileProvider>
              <WalletProvider>
                <App />
              </WalletProvider>
            </ProfileProvider>
          </AuthProvider>
        </ReduxProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error("Critical error during render:", error);
  // Fallback rendering if the main render fails
  root.render(
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Failed to load application</h1>
      <p>There was a critical error loading the application. Please try again later.</p>
      <button onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
