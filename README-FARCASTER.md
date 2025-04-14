# Farcaster Profile Integration

This document explains how to set up and troubleshoot the Farcaster profile integration in GALL3RY.

## API Integration

GALL3RY primarily uses the Zapper GraphQL API for Farcaster profile lookups:

```graphql
query GetFarcasterProfile($username: String) {
  farcasterProfile(username: $username) {
    username
    fid
    metadata {
      displayName
      description
      imageUrl
      warpcast
    }
    custodyAddress
    connectedAddresses
  }
}
```

However, if the Zapper API fails, we fall back to using Neynar API through our proxy endpoint.

## Required Environment Variables

1. **For Zapper API:**
   ```
   REACT_APP_ZAPPER_API_KEY=zapper-gallery
   ```
   
2. **For Neynar API fallback:**
   ```
   NEYNAR_API_KEY=your_neynar_api_key
   ```
   Get a free API key from [Neynar](https://neynar.com).

## Troubleshooting

If you encounter issues with Farcaster profile lookups, try the following:

1. **Test the API connectivity:**
   
   Run the test script:
   ```bash
   node test-zapper.js <username>
   ```
   
   This will test both Zapper and Neynar endpoints and show detailed error information.

2. **Check Common Issues:**
   
   - **Unauthorized errors:** Make sure your API keys are valid and properly set in environment variables.
   - **404 errors:** The Zapper API endpoint might have changed. Update the endpoint URLs.
   - **Empty response:** The username might not exist or the API service might be down.

3. **API Fallback Strategy:**
   
   GALL3RY tries the following endpoints in order:
   1. Your app's proxy endpoint (`/api/zapper`)
   2. Zapper direct endpoints
   3. Neynar-based proxy fallback (`/api/farcaster-profile`)

## Update Procedures

If Zapper's API changes in the future:

1. Update the GraphQL query in `src/services/zapperService.js`
2. Update the API endpoint URLs if needed
3. Test with the provided test script

## Manual Profile Lookup

You can manually look up profiles on:
- [Warpcast](https://warpcast.com/{username})
- [Neynar Explorer](https://explorer.neynar.com) 