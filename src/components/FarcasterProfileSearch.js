import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import { API_URL } from '../config';

/**
 * Component for searching and displaying Farcaster profile information
 */
const FarcasterProfileSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['farcasterProfile', debouncedSearchTerm],
    queryFn: async () => {
      // Only use the Zapper API for Farcaster profile data
      const response = await fetch(`${API_URL}/api/zapper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetFarcasterProfile($username: String!) {
              farcasterProfile(username: $username) {
                username
                fid
                metadata {
                  displayName
                  bio
                  avatarUrl
                  followerCount
                  followingCount
                }
                custodyAddress
                connectedAddresses
              }
            }
          `,
          variables: {
            username: debouncedSearchTerm
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Farcaster profile');
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message || 'Error fetching profile');
      }

      return result.data?.farcasterProfile;
    },
    enabled: debouncedSearchTerm.length > 0,
  });

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    refetch();
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Farcaster Profile Search</h2>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Enter Farcaster username..."
            className="flex-1 p-2 border rounded"
          />
          <button 
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading profile...</p>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-300 p-4 rounded text-red-700">
          <h3 className="font-bold">Error</h3>
          <p>{error.message}</p>
        </div>
      )}

      {profile && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center space-x-4 mb-4">
            {profile.metadata?.avatarUrl && (
              <img 
                src={profile.metadata.avatarUrl} 
                alt={profile.username} 
                className="w-20 h-20 rounded-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://via.placeholder.com/80?text=No+Image';
                }}
              />
            )}
            <div>
              <h3 className="text-xl font-bold">{profile.metadata?.displayName || profile.username}</h3>
              <p className="text-gray-500">@{profile.username}</p>
              <p className="text-sm text-gray-600">FID: {profile.fid}</p>
            </div>
          </div>

          {profile.metadata?.bio && (
            <div className="mb-4">
              <h4 className="font-bold mb-1">Bio</h4>
              <p className="text-gray-700">{profile.metadata.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="font-bold">{profile.metadata?.followerCount || 0}</p>
              <p className="text-sm text-gray-600">Followers</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded">
              <p className="font-bold">{profile.metadata?.followingCount || 0}</p>
              <p className="text-sm text-gray-600">Following</p>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-bold mb-1">Custody Address</h4>
            <code className="block p-2 bg-gray-100 rounded overflow-x-auto text-sm">
              {profile.custodyAddress}
            </code>
          </div>

          {profile.connectedAddresses && profile.connectedAddresses.length > 0 && (
            <div>
              <h4 className="font-bold mb-1">Connected Addresses</h4>
              <div className="space-y-2">
                {profile.connectedAddresses.map((address, index) => (
                  <code 
                    key={index} 
                    className="block p-2 bg-gray-100 rounded overflow-x-auto text-sm"
                  >
                    {address}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FarcasterProfileSearch; 