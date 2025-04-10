const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * NFT Schema - embedded in folders
 */
const NFTSchema = new Schema({
  tokenId: {
    type: String,
    required: true
  },
  contractAddress: {
    type: String,
    required: true
  },
  name: String,
  description: String,
  imageUrl: String,
  collection: {
    name: String,
    imageUrl: String
  },
  metadata: Schema.Types.Mixed,
  chain: {
    type: String,
    enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base', 'zora'],
    default: 'ethereum'
  }
}, { timestamps: true });

/**
 * Folder Schema
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
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  nfts: [NFTSchema],
  customCover: {
    imageUrl: String,
    showTitle: {
      type: Boolean,
      default: true
    }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for NFT count
FolderSchema.virtual('nftCount').get(function() {
  return this.nfts ? this.nfts.length : 0;
});

// Middleware to increment view count
FolderSchema.methods.incrementViewCount = async function() {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

// Index for faster queries
FolderSchema.index({ ownerId: 1, updatedAt: -1 });
FolderSchema.index({ isPublic: 1, viewCount: -1 });

module.exports = mongoose.model('Folder', FolderSchema); 