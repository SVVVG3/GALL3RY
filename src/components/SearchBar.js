import React, { useState } from 'react';

/**
 * Search Bar component
 * Allows searching for Farcaster users
 */
const SearchBar = ({ onSearch, isLoading, placeholder = 'Enter Farcaster username or FID' }) => {
  const [query, setQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    // Call the onSearch callback with the query
    onSearch(query.trim());
  };

  const handleKeyDown = (e) => {
    // Submit on Enter key
    if (e.key === 'Enter' && query.trim()) {
      handleSubmit(e);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="w-full text-center">
      <div style={{ 
        display: 'inline-flex', 
        maxWidth: '100%', 
        margin: '0 auto',
        width: '100%'
      }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex' }}>
          <input
            type="text"
            className="input input-search h-12"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            style={{ 
              width: '100%', 
              textOverflow: 'ellipsis',
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="btn btn-primary h-12 flex-none"
          style={{
            borderTopLeftRadius: 0,
            borderBottomLeftRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            padding: 0
          }}
          aria-label="Search"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchBar; 