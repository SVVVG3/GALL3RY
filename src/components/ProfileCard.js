import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function ProfileCard({ profile }) {
  const [showWallets, setShowWallets] = useState(false);
  const { profile: authProfile } = useAuth();
  
  if (!profile) return null;
  
  const {
    username,
    metadata,
    custodyAddress,
    connectedAddresses = [],
    fid
  } = profile;

  const displayName = metadata?.displayName || username;
  const imageUrl = metadata?.imageUrl;
  
  // Check if this is the current user's profile
  const isOwnProfile = authProfile && authProfile.fid === fid;

  // Function to truncate Ethereum addresses
  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Format address for display (with optional view link)
  const formatAddress = (address) => {
    return (
      <div key={address} className={`address-item ${address === custodyAddress ? 'custody-address' : ''}`}>
        <span>{truncateAddress(address)}</span>
        <a href={`https://etherscan.io/address/${address}`} target="_blank" rel="noopener noreferrer">
          View
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
            <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    );
  };

  // Get total number of wallets (connected + custody if different)
  const totalWallets = custodyAddress && !connectedAddresses.includes(custodyAddress) 
    ? connectedAddresses.length + 1 
    : connectedAddresses.length;

  return (
    <div className="profile-container" style={{ padding: '24px', maxWidth: '800px', width: '100%', margin: '0 auto' }}>
      <div className="profile-header" style={{ marginBottom: '32px' }}>
        {/* Profile image */}
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={displayName} 
            className="profile-image" 
            style={{ marginBottom: '20px', width: '140px', height: '140px' }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = `https://via.placeholder.com/140x140/a78bfa/ffffff?text=${displayName?.charAt(0).toUpperCase() || '?'}`;
            }}
          />
        ) : (
          <div className="profile-placeholder" style={{ marginBottom: '20px', width: '140px', height: '140px', fontSize: '3rem' }}>
            {displayName?.charAt(0).toUpperCase() || '?'}
          </div>
        )}
        
        {/* Profile info */}
        <h2 className="profile-name" style={{ fontSize: '2rem', marginBottom: '12px' }}>{displayName}</h2>
        <div className="profile-username" style={{ fontSize: '1.25rem', marginBottom: '16px' }}>
          {!isOwnProfile && `@${username}`}
          <span className="profile-fid" style={{ marginLeft: isOwnProfile ? '0' : '12px' }}>FID: {fid}</span>
        </div>
      </div>
      
      {/* Wallet Dropdown */}
      {totalWallets > 0 && (
        <div className="wallet-dropdown-container" style={{ width: '100%', maxWidth: '640px', marginBottom: '24px' }}>
          <button 
            className="wallet-dropdown-button"
            onClick={() => setShowWallets(!showWallets)}
            aria-expanded={showWallets}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: 'white', 
              border: '1px solid var(--color-gray-300)', 
              borderRadius: 'var(--border-radius-lg)',
              padding: '0.75rem 1rem',
              cursor: 'pointer',
              width: '100%',
              fontWeight: '500'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="wallet-icon">
              <path d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            
            <span>{totalWallets} {totalWallets === 1 ? 'Wallet' : 'Wallets'}</span>
            
            <svg 
              style={{ 
                marginLeft: 'auto', 
                transition: 'transform 0.2s ease',
                transform: showWallets ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M19 9L12 16L5 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {showWallets && (
            <div style={{ 
              marginTop: '0.75rem',
              background: 'white',
              borderRadius: 'var(--border-radius-lg)',
              boxShadow: 'var(--shadow-md)',
              padding: '20px',
              width: '100%'
            }}>
              {/* Connected Addresses */}
              {connectedAddresses?.length > 0 && (
                <div>
                  <h3 style={{ 
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: 'var(--color-gray-700)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12Z" fill="currentColor" />
                      <path d="M12 6C11.4477 6 11 6.44772 11 7V13C11 13.5523 11.4477 14 12 14C12.5523 14 13 13.5523 13 13V7C13 6.44772 12.5523 6 12 6Z" fill="currentColor" />
                      <path d="M13 16H11V18H13V16Z" fill="currentColor" />
                    </svg>
                    Connected Addresses
                  </h3>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}>
                    {connectedAddresses.map(address => (
                      <div key={address} style={{
                        backgroundColor: 'var(--color-gray-50)',
                        padding: '10px 16px',
                        borderRadius: 'var(--border-radius-lg)',
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        color: 'var(--color-gray-700)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <span>{truncateAddress(address)}</span>
                        <a 
                          href={`https://etherscan.io/address/${address}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{
                            color: 'var(--color-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none'
                          }}
                        >
                          View
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Custody Address (if different from connected addresses) */}
              {custodyAddress && !connectedAddresses.includes(custodyAddress) && (
                <div style={{ marginTop: connectedAddresses?.length > 0 ? '20px' : 0 }}>
                  <h3 style={{ 
                    fontSize: '1rem',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: 'var(--color-gray-700)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 11H5M19 11C20.1046 11 21 11.8954 21 13V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V13C3 11.8954 3.89543 11 5 11M19 11V9C19 7.89543 18.1046 7 17 7M5 11V9C5 7.89543 5.89543 7 7 7M7 7V5C7 3.89543 7.89543 3 9 3H15C16.1046 3 17 3.89543 17 5V7M7 7H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Custody Address
                  </h3>
                  <div style={{
                    backgroundColor: '#ebf5ff',
                    borderLeft: '4px solid #3b82f6',
                    padding: '10px 16px',
                    borderRadius: 'var(--border-radius-lg)',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    color: 'var(--color-gray-700)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span>{truncateAddress(custodyAddress)}</span>
                    <a 
                      href={`https://etherscan.io/address/${custodyAddress}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--color-primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none'
                      }}
                    >
                      View
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V14M14 4H20M20 4V10M20 4L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileCard; 