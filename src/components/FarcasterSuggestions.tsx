import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import '../styles/FarcasterUserSearch.css';

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
      document.body.appendChild(container);
      setPortalContainer(container);

      return () => {
        document.body.removeChild(container);
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
            <img
              src={user.pfp}
              alt={user.username}
              className="suggestion-avatar"
            />
            <div className="suggestion-info">
              <div className="suggestion-display-name">{user.displayName}</div>
              <div className="suggestion-username">@{user.username}</div>
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