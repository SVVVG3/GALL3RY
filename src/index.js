import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';

// Create a root
const root = createRoot(document.getElementById('root'));

// Render the app
root.render(
  <React.StrictMode>
    <AuthProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </AuthProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
