const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Schema for NFTs within folders
 */
const FolderNFTSchema = new Schema({
  tokenId: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  network: {
    type: String,
    default: 'ethereum'
  },
  name: String,
  imageUrl: String,
  collectionName: String,
  estimatedValueUsd: Number,
  addedAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Folder schema
 */
const FolderSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  userId: {
    type: String,  // Farcaster FID
    required: true,
    index: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  nfts: [FolderNFTSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
FolderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if the model already exists to prevent errors in serverless functions
module.exports = mongoose.models.Folder || mongoose.model('Folder', FolderSchema); 