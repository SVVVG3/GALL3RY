import React from 'react';

/**
 * Farcaster Profile component
 * Displays a Farcaster user's profile information
 */
const FarcasterProfile = ({ profile }) => {
  if (!profile) {
    return (
      <div className="bg-gray-50 p-4 rounded text-center">
        <p className="text-gray-400">Not signed in with Farcaster</p>
      </div>
    );
  }
  
  const { 
    fid, 
    username, 
    displayName, 
    pfp, 
    custodyAddress
  } = profile;
  
  // Get the profile image URL
  const pfpUrl = pfp?.url || profile.metadata?.imageUrl || null;
  
  // Format ETH address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  return (
    <div className="flex items-center space-x-3">
      <div>
        {pfpUrl ? (
          <img 
            src={pfpUrl} 
            alt={`${displayName || username}'s profile`} 
            className="w-12 h-12 rounded-full object-cover border border-gray-100"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg font-medium">
            {username.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      
      <div>
        <h2 className="text-lg font-medium">{displayName || username}</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">@{username}</span>
          {custodyAddress && (
            <span className="text-xs text-gray-400">
              {formatAddress(custodyAddress)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FarcasterProfile; 