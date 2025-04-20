import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

/**
 * Component to display Farcaster user information retrieved from Privy
 */
const PrivyUserInfo = ({ className = '', style = {} }) => {
  const { user, authenticated, ready, logout } = usePrivy();

  if (!ready) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`} style={style}>
        <p className="text-gray-500">Loading user information...</p>
      </div>
    );
  }

  if (!authenticated || !user || !user.farcaster) {
    return (
      <div className={`p-4 bg-gray-100 rounded-lg ${className}`} style={style}>
        <p className="text-gray-500">Not signed in with Farcaster</p>
      </div>
    );
  }

  const { farcaster } = user;

  return (
    <div className={`p-4 bg-white rounded-lg shadow ${className}`} style={style}>
      <div className="flex items-center">
        {farcaster.pfp && (
          <img
            src={farcaster.pfp}
            alt={`${farcaster.displayName || farcaster.username}'s profile`}
            className="w-12 h-12 rounded-full mr-4"
          />
        )}
        <div>
          <h3 className="font-bold text-lg">
            {farcaster.displayName || farcaster.username}
          </h3>
          <p className="text-gray-600">@{farcaster.username}</p>
          <p className="text-gray-500 text-sm">FID: {farcaster.fid}</p>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={logout}
          className="text-red-600 text-sm hover:text-red-800"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default PrivyUserInfo; 