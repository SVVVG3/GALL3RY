import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import '../styles/FarcasterUserSearch.css';
import farcasterService from '../services/farcasterService';

/**
 * A completely standalone component for farcaster username suggestions
 */
const FarcasterSuggestions = ({ suggestions, onSelect, visible, loading }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      const container = document.createElement('div');
      container.id = 'suggestion-portal';
      document.body.appendChild(container);
      setPortalContainer(container);

      return () => {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      };
    }
  }, [isMobile]);

  if (!visible) return null;

  const suggestionsContent = (
    <div className="farcaster-suggestions">
      {loading ? (
        <div className="suggestion-item loading">Loading...</div>
      ) : suggestions.length === 0 ? (
        <div className="suggestion-item no-results">No users found</div>
      ) : (
        suggestions.map((user) => (
          <div
            key={user.fid}
            className="suggestion-item"
            onClick={() => onSelect(user)}
          >
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.username}
                className="suggestion-avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/assets/placeholder-profile.png';
                }}
              />
            ) : (
              <div className="suggestion-avatar-placeholder">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="suggestion-user-info">
              <span className="suggestion-display-name">
                {user.displayName || user.username}
              </span>
              <span className="suggestion-username">@{user.username}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return isMobile && portalContainer
    ? ReactDOM.createPortal(suggestionsContent, portalContainer)
    : suggestionsContent;
};

export default FarcasterSuggestions; 