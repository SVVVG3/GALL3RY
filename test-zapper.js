const axios = require('axios');
require('dotenv').config();

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY;
const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';

async function testZapperAPI() {
  try {
    console.log('Testing Zapper API with key:', ZAPPER_API_KEY ? 'Key exists' : 'No key found');
    
    // Test Farcaster profile query
    const profileQuery = `
      query GetFarcasterProfile($username: String) {
        farcasterProfile(username: $username) {
          fid
          username
          metadata {
            displayName
            imageUrl
          }
          custodyAddress
          connectedAddresses
        }
      }
    `;

    const profileResponse = await axios.post(
      ZAPPER_API_URL, 
      { query: profileQuery, variables: { username: 'vitalik' } },
      { headers: { 'x-zapper-api-key': ZAPPER_API_KEY } }
    );
    
    console.log('Profile Response:', JSON.stringify(profileResponse.data, null, 2));
    
    if (profileResponse.data.data && profileResponse.data.data.farcasterProfile) {
      const profile = profileResponse.data.data.farcasterProfile;
      
      // If we have a custody address, test NFT query
      if (profile.custodyAddress) {
        console.log(`Testing NFT query for address: ${profile.custodyAddress}`);
        
        const nftQuery = `
          query GetNFTs($owners: [Address!]!, $first: Int) {
            nftUsersTokens(
              owners: $owners
              first: $first
              withOverrides: true
            ) {
              edges {
                node {
                  id
                  name
                  tokenId
                  description
                  mediasV2 {
                    ... on Image {
                      url
                    }
                    ... on Animation {
                      url
                    }
                  }
                  collection {
                    id
                    name
                    floorPriceEth
                  }
                  estimatedValueEth
                }
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;
        
        const nftResponse = await axios.post(
          ZAPPER_API_URL, 
          { 
            query: nftQuery, 
            variables: { 
              owners: [profile.custodyAddress], 
              first: 5 
            } 
          },
          { headers: { 'x-zapper-api-key': ZAPPER_API_KEY } }
        );
        
        console.log('NFT Response:', JSON.stringify(nftResponse.data, null, 2));
      }
    }
  } catch (error) {
    console.error('Error testing Zapper API:');
    if (error.response && error.response.data) {
      console.error('API Response Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error);
    }
  }
}

testZapperAPI(); 