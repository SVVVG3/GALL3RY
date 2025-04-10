/**
 * Client-side Folder model
 */
class ClientFolder {
  constructor(data = {}) {
    this.id = data._id || data.id || this.generateId();
    this.name = data.name || 'Untitled Folder';
    this.description = data.description || '';
    this.ownerId = data.userId || data.ownerId || '';
    this.isPublic = data.isPublic !== undefined ? data.isPublic : false;
    this.nfts = data.nfts || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Generate a random ID for new folders
   */
  generateId() {
    return 'folder_' + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Add an NFT to the folder
   */
  addNft(nft) {
    // Check if NFT already exists in folder
    const exists = this.nfts.some(
      existingNft => 
        existingNft.tokenId === nft.tokenId && 
        existingNft.contractAddress === nft.contractAddress
    );

    if (!exists) {
      const nftWithId = {
        ...nft,
        _id: nft._id || nft.id || `nft_${Math.random().toString(36).substring(2, 15)}`,
        addedAt: new Date().toISOString()
      };

      this.nfts.push(nftWithId);
      this.updatedAt = new Date().toISOString();
    }

    return this;
  }

  /**
   * Remove an NFT from the folder
   */
  removeNft(nftId) {
    const initialLength = this.nfts.length;
    this.nfts = this.nfts.filter(nft => nft._id !== nftId && nft.id !== nftId);
    
    if (this.nfts.length !== initialLength) {
      this.updatedAt = new Date().toISOString();
    }
    
    return this;
  }

  /**
   * Update folder properties
   */
  update(data) {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    if (data.isPublic !== undefined) this.isPublic = data.isPublic;
    
    this.updatedAt = new Date().toISOString();
    
    return this;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      ownerId: this.ownerId,
      isPublic: this.isPublic,
      nfts: this.nfts,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Create a Folder instance from a plain object
   */
  static fromObject(obj) {
    return new ClientFolder(obj);
  }
}

export default ClientFolder; 