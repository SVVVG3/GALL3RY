import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/FarcasterUserSearch.css';
import { getFarcasterSuggestions } from '../services/farcasterService';

/**
 * A completely standalone component for farcaster username suggestions
 */
const FarcasterSuggestions = ({ 
  inputValue, 
  onSelectSuggestion, 
  inputRef 
}) => {
  // Component state
  const [suggestions, setSuggestions] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  
  // Update isMobile state on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Fetch suggestions when input value changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.trim().length < 1) {
        setSuggestions([]);
        return;
      }
      
      try {
        const results = await getFarcasterSuggestions(inputValue);
        setSuggestions(results);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
    };
    
    // Use debounce to avoid too many API calls
    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [inputValue]);
  
  // Handle selection
  const handleSuggestionClick = (username) => {
    onSelectSuggestion(username);
    setSuggestions([]);
  };
  
  const SuggestionsList = () => {
    if (suggestions.length === 0) return null;

    return (
      <div className="farcaster-suggestions">
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.fid || index}
            className="suggestion-item"
            onClick={() => handleSuggestionClick(suggestion.username)}
          >
            {suggestion.pfp ? (
              <img
                src={suggestion.pfp}
                alt={suggestion.username}
                className="suggestion-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/placeholder-profile.png';
                }}
              />
            ) : (
              <div className="suggestion-avatar-placeholder">
                {suggestion.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="suggestion-user-info">
              <span className="suggestion-display-name">
                {suggestion.displayName || suggestion.username}
              </span>
              <span className="suggestion-username">@{suggestion.username}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  // If on mobile, render using a portal
  if (isMobile && suggestions.length > 0) {
    return ReactDOM.createPortal(
      <SuggestionsList />,
      document.body
    );
  }
  
  // On desktop, render normally
  return <SuggestionsList />;
};

export default FarcasterSuggestions; 