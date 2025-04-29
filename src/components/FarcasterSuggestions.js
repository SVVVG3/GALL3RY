import React, { useState, useEffect, useRef } from 'react';
import farcasterService from '../services/farcasterService';

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
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  
  // Fetch suggestions when input value changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Only show suggestions when input has at least 2 characters
      if (!inputValue || inputValue.trim().length < 2) {
        setSuggestions([]);
        setIsVisible(false);
        return;
      }
      
      try {
        console.log('FarcasterSuggestions: Fetching suggestions for:', inputValue);
        const users = await farcasterService.searchUsers(inputValue.trim(), 5);
        console.log('FarcasterSuggestions: Found', users.length, 'suggestions');
        
        if (users && users.length > 0) {
          setSuggestions(users);
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } catch (error) {
        console.error('FarcasterSuggestions: Error fetching suggestions', error);
        setIsVisible(false);
      }
    };
    
    // Use debounce to avoid too many API calls
    const timerId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timerId);
  }, [inputValue]);
  
  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target) &&
        inputRef && 
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inputRef]);
  
  // Handle selection
  const handleSelect = (username) => {
    setIsVisible(false);
    onSelectSuggestion(username);
  };
  
  // Don't render anything if not visible or no suggestions
  if (!isVisible || !suggestions.length) {
    return null;
  }
  
  return (
    <div 
      ref={containerRef}
      className="farcaster-suggestions"
    >
      {suggestions.map((user) => (
        <div 
          key={user.fid}
          onClick={() => handleSelect(user.username)}
          className="suggestion-item"
        >
          {user.imageUrl ? (
            <img 
              src={user.imageUrl} 
              alt=""
              className="suggestion-avatar"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/placeholder-profile.png';
              }}
            />
          ) : (
            <div className="suggestion-avatar-placeholder">
              {user.username ? user.username[0].toUpperCase() : '?'}
            </div>
          )}
          <div className="suggestion-user-info">
            <span className="suggestion-display-name">
              {user.displayName || user.username}
            </span>
            <span className="suggestion-username">
              @{user.username}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FarcasterSuggestions; 