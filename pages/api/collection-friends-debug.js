/**
 * Collection Friends DEBUG API Endpoint
 * This is a debugging version of the collection-friends API that provides detailed logs
 */

import axios from 'axios';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const debugLog = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    request: {
      method: req.method,
      url: req.url,
      query: req.query,
      headers: {
        // Only log relevant headers
        accept: req.headers.accept,
        'user-agent': req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer
      }
    },
    steps: [],
    envVars: {
      // Check what environment variables are available (without revealing values)
      hasNeynarApiKey: !!process.env.NEYNAR_API_KEY,
      hasAlchemyApiKey: !!process.env.ALCHEMY_API_KEY,
      nodeEnv: process.env.NODE_ENV
    }
  };

  try {
    // Get parameters from request
    const { 
      contractAddress, 
      fid, 
      network = 'eth',
      limit = 50
    } = req.query;

    // Add step log
    debugLog.steps.push({
      step: "1-params-check",
      status: "success",
      params: { contractAddress, fid, network, limit }
    });

    if (!contractAddress) {
      debugLog.steps.push({
        step: "1a-missing-contract",
        status: "error",
        message: "Missing contractAddress parameter"
      });
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'contractAddress is required',
        debug: debugLog
      });
    }

    if (!fid) {
      debugLog.steps.push({
        step: "1b-missing-fid",
        status: "error",
        message: "Missing FID parameter"
      });
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'fid (Farcaster ID) is required',
        debug: debugLog
      });
    }

    // Get Neynar API key
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
    
    debugLog.steps.push({
      step: "2-api-keys",
      status: "success",
      usingDefaultNeynarKey: NEYNAR_API_KEY === 'NEYNAR_API_DOCS'
    });

    // STEP 1: Get the list of users the Farcaster user follows (using Neynar API)
    // Build Neynar API URL for following list - try both formats to see which works
    const neynarUrlV1 = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=10`;
    const neynarUrlV2 = `https://api.neynar.com/v2/farcaster/following?viewerFid=${fid}&limit=10`;
    
    debugLog.steps.push({
      step: "3-prepare-neynar-request",
      status: "success",
      urlsToTry: [neynarUrlV1, neynarUrlV2]
    });

    // Try with both API key header formats
    let followingResponse = null;
    let successfulHeader = "";
    let successfulUrl = "";
    let error = null;

    // First try x-api-key header with viewerFid parameter
    try {
      followingResponse = await axios.get(neynarUrlV2, {
        headers: {
          'Accept': 'application/json',
          'x-api-key': NEYNAR_API_KEY
        },
        timeout: 8000
      });
      successfulHeader = "x-api-key";
      successfulUrl = neynarUrlV2;
      debugLog.steps.push({
        step: "4a-neynar-request",
        status: "success",
        urlUsed: neynarUrlV2,
        headerUsed: "x-api-key"
      });
    } catch (err) {
      error = err;
      debugLog.steps.push({
        step: "4a-neynar-request",
        status: "error",
        urlUsed: neynarUrlV2,
        headerUsed: "x-api-key",
        errorCode: err.code || 'unknown',
        errorMessage: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data
      });

      // Try with api_key header with fid parameter
      try {
        followingResponse = await axios.get(neynarUrlV1, {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          },
          timeout: 8000
        });
        successfulHeader = "api_key";
        successfulUrl = neynarUrlV1;
        error = null;
        debugLog.steps.push({
          step: "4b-neynar-request",
          status: "success",
          urlUsed: neynarUrlV1,
          headerUsed: "api_key"
        });
      } catch (err2) {
        debugLog.steps.push({
          step: "4b-neynar-request",
          status: "error",
          urlUsed: neynarUrlV1,
          headerUsed: "api_key",
          errorCode: err2.code || 'unknown',
          errorMessage: err2.message,
          responseStatus: err2.response?.status,
          responseData: err2.response?.data
        });

        // Try with x-api-key header and fid parameter
        try {
          followingResponse = await axios.get(neynarUrlV1, {
            headers: {
              'Accept': 'application/json',
              'x-api-key': NEYNAR_API_KEY
            },
            timeout: 8000
          });
          successfulHeader = "x-api-key";
          successfulUrl = neynarUrlV1;
          error = null;
          debugLog.steps.push({
            step: "4c-neynar-request",
            status: "success",
            urlUsed: neynarUrlV1,
            headerUsed: "x-api-key"
          });
        } catch (err3) {
          debugLog.steps.push({
            step: "4c-neynar-request",
            status: "error",
            urlUsed: neynarUrlV1,
            headerUsed: "x-api-key",
            errorCode: err3.code || 'unknown',
            errorMessage: err3.message,
            responseStatus: err3.response?.status,
            responseData: err3.response?.data
          });
          // All attempts failed
          error = err3;
        }
      }
    }

    // If we still have an error, return it
    if (error) {
      debugLog.outcome = "error-fetching-following";
      return res.status(500).json({
        error: 'Neynar API error',
        message: 'Failed to fetch following list from Neynar API',
        debug: debugLog
      });
    }

    // Parse the response structure
    debugLog.steps.push({
      step: "5-parse-response",
      status: "success",
      dataKeys: Object.keys(followingResponse.data)
    });

    // Check if we have users in the response
    let followingList = [];
    
    if (followingResponse.data.users) {
      // Format 1: { users: [{ object: "follower", user: {...} }] }
      if (followingResponse.data.users[0]?.object === "follower") {
        followingList = followingResponse.data.users.map(follower => follower.user);
        debugLog.steps.push({
          step: "6a-extract-users",
          status: "success",
          format: "follower.user",
          count: followingList.length
        });
      } else {
        // Format 2: { users: [{...user objects...}] }
        followingList = followingResponse.data.users;
        debugLog.steps.push({
          step: "6b-extract-users",
          status: "success",
          format: "direct-users",
          count: followingList.length
        });
      }
    } else if (followingResponse.data.result?.users) {
      // Format 3: { result: { users: [...] } }
      followingList = followingResponse.data.result.users;
      debugLog.steps.push({
        step: "6c-extract-users",
        status: "success",
        format: "result.users",
        count: followingList.length
      });
    } else {
      debugLog.steps.push({
        step: "6d-extract-users",
        status: "error",
        message: "Could not find users in response",
        responseStructure: JSON.stringify(followingResponse.data).substring(0, 500) // Truncate for readability
      });
      return res.status(500).json({
        error: 'Parsing error',
        message: 'Could not find users in Neynar API response',
        debug: debugLog
      });
    }

    // We found some following users, let's check the first one to understand structure
    if (followingList.length > 0) {
      const firstUser = followingList[0];
      debugLog.steps.push({
        step: "7-user-structure",
        status: "success",
        firstUserKeys: Object.keys(firstUser),
        hasCustodyAddress: !!firstUser.custody_address,
        hasVerifiedAddresses: !!firstUser.verified_addresses
      });
    } else {
      debugLog.steps.push({
        step: "7-user-structure",
        status: "warning",
        message: "User is not following anyone"
      });
    }

    // Success! We've determined the correct API format
    debugLog.steps.push({
      step: "8-final",
      status: "success",
      message: "Successfully retrieved following list",
      workingUrl: successfulUrl,
      workingHeader: successfulHeader,
      followingCount: followingList.length
    });

    debugLog.outcome = "success";
    
    // Return a successful response with our debug information
    return res.status(200).json({
      success: true,
      message: "Debug endpoint successfully tested Neynar API",
      followingCount: followingList.length,
      workingConfiguration: {
        url: successfulUrl,
        header: successfulHeader
      },
      debug: debugLog
    });

  } catch (error) {
    // Catch any unexpected errors
    debugLog.steps.push({
      step: "error",
      status: "error",
      message: error.message,
      stack: error.stack
    });
    
    debugLog.outcome = "unexpected-error";
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message || 'An unexpected error occurred',
      debug: debugLog
    });
  }
} 