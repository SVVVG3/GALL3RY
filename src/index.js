// Import polyfill first
import './polyfills';

import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';

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
const root = createRoot(document.getElementById('root'));

// Wrap everything in a try-catch as an extra precaution
try {
  // Render the app with error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthProvider>
          <WalletProvider>
            <App />
          </WalletProvider>
        </AuthProvider>
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
