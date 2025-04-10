const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * User Schema
 * Stores user information from Farcaster authentication
 */
const UserSchema = new Schema({
  username: {
    type: String,
    trim: true
  },
  displayName: String,
  bio: String,
  farcasterFid: {
    type: Number,
    required: true,
    unique: true
  },
  pfpUrl: String,
  custodyAddress: {
    type: String,
    lowercase: true
  },
  connectedAddresses: [{
    type: String,
    lowercase: true
  }],
  lastLogin: Date,
  isAdmin: {
    type: Boolean,
    default: false
  },
  settings: {
    defaultFolderPrivacy: {
      type: Boolean,
      default: false
    },
    enableEmailNotifications: {
      type: Boolean,
      default: true
    },
    enableSocialFeatures: {
      type: Boolean,
      default: true
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for folder count
UserSchema.virtual('folderCount', {
  ref: 'Folder',
  localField: '_id',
  foreignField: 'ownerId',
  count: true
});

// Virtual for public folder count
UserSchema.virtual('publicFolderCount', {
  ref: 'Folder',
  localField: '_id',
  foreignField: 'ownerId',
  count: true,
  match: { isPublic: true }
});

// Index for faster queries
UserSchema.index({ farcasterFid: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ custodyAddress: 1 });
UserSchema.index({ connectedAddresses: 1 });

// Method to find or create a user based on Farcaster profile
UserSchema.statics.findOrCreateFromFarcaster = async function(profile) {
  if (!profile || !profile.fid) {
    throw new Error('Invalid Farcaster profile');
  }
  
  try {
    // Try to find existing user
    let user = await this.findOne({ farcasterFid: profile.fid });
    
    if (!user) {
      // Create new user if not found
      user = new this({
        farcasterFid: profile.fid,
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        pfpUrl: profile.pfp,
        custodyAddress: profile.custodyAddress ? profile.custodyAddress.toLowerCase() : null,
        connectedAddresses: profile.connectedAddresses ? 
          profile.connectedAddresses.map(addr => addr.toLowerCase()) : 
          []
      });
    } else {
      // Update existing user with latest profile info
      user.username = profile.username || user.username;
      user.displayName = profile.displayName || user.displayName;
      user.bio = profile.bio || user.bio;
      user.pfpUrl = profile.pfp || user.pfpUrl;
      user.custodyAddress = profile.custodyAddress ? 
        profile.custodyAddress.toLowerCase() : 
        user.custodyAddress;
        
      // Update connected addresses if provided
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        const lowerAddresses = profile.connectedAddresses.map(addr => addr.toLowerCase());
        
        // Add new addresses without duplicates
        user.connectedAddresses = [
          ...new Set([
            ...user.connectedAddresses,
            ...lowerAddresses
          ])
        ];
      }
    }
    
    user.lastLogin = new Date();
    await user.save();
    
    return user;
  } catch (error) {
    console.error('Error finding or creating user:', error);
    throw error;
  }
};

module.exports = mongoose.model('User', UserSchema); 