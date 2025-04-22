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
  
  // Get input position if available
  let dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    width: '100%',
    zIndex: 100000,
    marginTop: '2px',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
    maxHeight: '300px',
    overflowY: 'auto'
  };
  
  if (inputRef?.current) {
    const rect = inputRef.current.getBoundingClientRect();
    console.log('FarcasterSuggestions: Input rect', rect);
  }
  
  return (
    <div 
      ref={containerRef}
      className="farcaster-suggestions"
      style={dropdownStyle}
    >
      <div style={{ padding: "4px 0" }}>
        {suggestions.map((user) => (
          <div 
            key={user.fid}
            onClick={() => handleSelect(user.username)}
            style={{
              padding: "10px 15px",
              display: "flex",
              alignItems: "center", 
              borderBottom: "1px solid #f3f4f6",
              cursor: "pointer",
              backgroundColor: "#ffffff",
              transition: "background-color 0.2s",
              fontSize: "14px"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f9fafb"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
          >
            {user.imageUrl ? (
              <img 
                src={user.imageUrl} 
                alt=""
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  marginRight: "12px",
                  border: "1px solid #e5e7eb",
                  objectFit: "cover",
                  flexShrink: 0
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/placeholder-profile.png';
                }}
              />
            ) : (
              <div style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                marginRight: "12px",
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold",
                color: "#6b7280",
                flexShrink: 0
              }}>
                {user.username ? user.username[0].toUpperCase() : '?'}
              </div>
            )}
            <div className="suggestion-user-info">
              <span 
                style={{
                  fontWeight: "600",
                  fontSize: "14px",
                  color: "#111827",
                  display: "block",
                  lineHeight: "1.2",
                  marginBottom: "2px"
                }}
              >
                {user.displayName || user.username}
              </span>
              <span 
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  display: "block",
                  lineHeight: "1.2"
                }}
              >
                @{user.username}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FarcasterSuggestions; 