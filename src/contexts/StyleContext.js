import React, { createContext, useContext, useState, useEffect } from 'react';

// Create a context for style settings
const StyleContext = createContext();

// Custom hook for accessing the style context
export const useStyle = () => useContext(StyleContext);

/**
 * StyleProvider - Context provider for application styling
 * 
 * Provides:
 * - useUnifiedCSS: Whether to use the new unified CSS or legacy CSS files
 * - toggleUnifiedCSS: Function to toggle between unified and legacy CSS
 */
export const StyleProvider = ({ children }) => {
  // Check local storage for saved preference, default to true (unified CSS)
  const [useUnifiedCSS, setUseUnifiedCSS] = useState(() => {
    const saved = localStorage.getItem('useUnifiedCSS');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Persist preference to local storage when it changes
  useEffect(() => {
    localStorage.setItem('useUnifiedCSS', JSON.stringify(useUnifiedCSS));
    
    // Dynamically load the appropriate CSS file
    const existingLink = document.getElementById('dynamic-css-link');
    if (existingLink) {
      existingLink.remove();
    }
    
    const link = document.createElement('link');
    link.id = 'dynamic-css-link';
    link.rel = 'stylesheet';
    link.href = useUnifiedCSS ? '/styles/nft-unified.css' : '/styles/nft-components.css';
    document.head.appendChild(link);
  }, [useUnifiedCSS]);

  // Function to toggle between unified and legacy CSS
  const toggleUnifiedCSS = () => {
    setUseUnifiedCSS(prev => !prev);
  };

  // Value to be provided by the context
  const contextValue = {
    useUnifiedCSS,
    toggleUnifiedCSS,
  };

  return (
    <StyleContext.Provider value={contextValue}>
      {children}
    </StyleContext.Provider>
  );
};

export default StyleContext; 