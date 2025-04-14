# GALL3RY API Documentation

## API Structure

GALL3RY uses a consolidated API approach to stay within Vercel's free tier limitations while providing all necessary functionality.

### Endpoints

The API includes two main endpoints:

1. **`/api/zapper`** - Used exclusively for Farcaster profile data and connected wallets
   - Accepts POST requests with GraphQL queries
   - Filters for Farcaster profile requests only
   - Returns profile data and connected wallet addresses

2. **`/api/alchemy`** - Used for all NFT data
   - Supports multiple endpoints through a query parameter: `?endpoint=endpointName`
   - Available endpoints: `getNFTsForOwner`, `getNFTMetadata`, `getNFTMetadataBatch`
   - Supports both GET and POST requests
   - Enhanced with optimized parameters for complete metadata

### Implementation Details

- **Single Serverless Function**: All API functionality is contained in `api/index.js` to avoid exceeding Vercel's function limits
- **Separation of Concerns**: Zapper is used only for Farcaster data, Alchemy only for NFT data
- **Error Handling**: Comprehensive error handling for API keys, request validation, and service errors

## Usage Examples

### Fetching a Farcaster Profile

```javascript
const fetchFarcasterProfile = async (username) => {
  const query = `
    query GetFarcasterProfile($username: String!) {
      farcasterProfile(username: $username) {
        username
        fid
        metadata {
          displayName
          description
          imageUrl
        }
        custodyAddress
        connectedAddresses
      }
    }
  `;

  const response = await fetch('/api/zapper', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { username }
    })
  });
  
  return await response.json();
};
```

### Fetching NFTs for a Wallet

```javascript
const fetchNFTs = async (walletAddress) => {
  const response = await fetch(`/api/alchemy?endpoint=getNFTsForOwner&owner=${walletAddress}`);
  return await response.json();
};
```

## Environment Variables

The API requires the following environment variables:

- `ZAPPER_API_KEY` - API key for Zapper
- `ALCHEMY_API_KEY` - API key for Alchemy

## Notes on Changes

We've consolidated the API for several reasons:

1. To stay within Vercel's free tier limit of 12 serverless functions
2. To eliminate redundant code for fetching NFT data from multiple sources
3. To clarify the roles of each service: Zapper for Farcaster data, Alchemy for NFT data

This approach maintains all functionality while simplifying the codebase and deployment. 