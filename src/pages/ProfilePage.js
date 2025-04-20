import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { NFTProvider } from '../contexts/NFTContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';

/**
 * Profile page component for viewing a user's profile and NFT collection
 */
const ProfilePage = () => {
  const { fid } = useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // For now, just use the FID as a placeholder
        // In a real implementation, you would fetch the user's profile from the API
        setProfile({
          fid,
          username: `user${fid}`,
          displayName: `User ${fid}`,
        });
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Failed to load profile');
        setLoading(false);
      }
    };
    
    if (fid) {
      fetchProfile();
    }
  }, [fid]);
  
  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  if (!profile) {
    return <div className="not-found">Profile not found</div>;
  }
  
  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>{profile.displayName}</h1>
        <p>@{profile.username}</p>
        <p>FID: {profile.fid}</p>
      </div>
      
      <div className="profile-content">
        <h2>NFT Collection</h2>
        <NFTProvider>
          <FarcasterUserSearch defaultFid={fid} />
        </NFTProvider>
      </div>
    </div>
  );
};

export default ProfilePage; 