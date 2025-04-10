const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');
const mongoose = require('mongoose');

// Import models
const Folder = require('./src/models/Folder');

// Load environment variables
if (fs.existsSync('.env')) {
  dotenv.config();
}

// API Keys from environment
const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY;
const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY;
const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY;

// Development flags
const DISABLE_AUTH = process.env.DISABLE_AUTH || 'true'; // Disable auth by default for development
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || '1234'; // Default user ID for development

// Use a local MongoDB URI if the cloud one is not available or fails
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nft-gallery';

// In-memory fallback for MongoDB in case connection fails
// Set to true by default; will be set to false if MongoDB connection is successful
let useInMemoryDb = true;
const inMemoryFolders = [];

// Initialize some test folders if we're using in-memory storage
const initializeInMemoryFolders = () => {
  if (inMemoryFolders.length > 0) {
    console.log('In-memory folders already initialized:', inMemoryFolders.length);
    return;
  }

  console.log('Initializing in-memory folders');
  // Create a few test folders with unique IDs
  for (let i = 1; i <= 3; i++) {
    const folderId = new mongoose.Types.ObjectId();
    inMemoryFolders.push({
      _id: folderId,
      id: folderId.toString(),
      name: `Test Folder ${i}`,
      description: `This is test folder ${i}`,
      userId: '1234', // Default test user ID
      isPublic: i === 1, // Make the first folder public
      nfts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  console.log('Created test folders:', inMemoryFolders.map(f => ({ id: f.id, name: f.name })));
};

// Connect to MongoDB with robust error handling
const connectToMongoDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB at:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Hide credentials in logs
    
    // Set a short timeout for MongoDB connection
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000, // Timeout after 3 seconds
      connectTimeoutMS: 3000,       // Connection timeout
      socketTimeoutMS: 3000,        // Socket timeout
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('MongoDB connected successfully');
    useInMemoryDb = false;
    
    // Set up event listeners for connection issues
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error after initial connection:', err);
      console.log('Switching to in-memory database fallback due to connection error');
      useInMemoryDb = true;
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Switching to in-memory database fallback');
      useInMemoryDb = true;
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected. Switching back to MongoDB');
      useInMemoryDb = false;
    });
    
  } catch (err) {
    console.error('MongoDB connection failed with error:', err);
    console.log('Using in-memory database as fallback');
    useInMemoryDb = true;
    
    // Log more detailed error info
    if (err.name === 'MongooseServerSelectionError') {
      console.error('  - Could not select a MongoDB server. Check your connection string and network.');
    } else if (err.name === 'MongooseTimeoutError') {
      console.error('  - Connection timed out. Check your network or MongoDB server status.');
    } else if (err.code === 'ENOTFOUND') {
      console.error('  - Host not found. Check your MongoDB connection string.');
    }
    
    // Initialize some test folders in memory for development
    if (inMemoryFolders.length === 0) {
      console.log('Initializing test folders in memory');
      const testFolderId = new mongoose.Types.ObjectId();
      inMemoryFolders.push({
        _id: testFolderId,
        id: testFolderId.toString(),
        name: 'Test Folder',
        description: 'This is a test folder created in memory',
        userId: '1234', // Default test user ID
        isPublic: true,
        nfts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log('Created test folder:', inMemoryFolders[0]);
    }
  }
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS to allow requests from the React app
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());

// Try to connect to MongoDB (but already assume in-memory as fallback)
connectToMongoDB().catch(err => {
  console.error("Failed to connect to MongoDB:", err);
  console.log("Using in-memory database");
  useInMemoryDb = true;
});

// Initialize in-memory folders
initializeInMemoryFolders();

// Confirm the database mode
console.log(`Database mode: ${useInMemoryDb ? 'In-memory (local)' : 'MongoDB (cloud)'}`);

// Log each request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Zapper API endpoint
const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';

// Neynar API endpoint
const NEYNAR_API_URL = 'https://api.neynar.com/v2';

// Configure cache with TTLs
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 1000 // Maximum number of keys to store
});

// Cache keys
const CACHE_KEYS = {
  FARCASTER_PROFILE: (username) => `farcaster_profile_${username}`,
  NFT_DATA: (addresses) => `nft_data_${addresses.sort().join('_')}`,
  NFT_IMAGE: (contract, tokenId) => `nft_image_${contract}_${tokenId}`
};

// Rate limiting configuration
const RATE_LIMITS = {
  NEYNAR: {
    requestsPerMinute: 50,
    windowMs: 60 * 1000
  },
  ZAPPER: {
    requestsPerMinute: 100,
    windowMs: 60 * 1000
  },
  ALCHEMY: {
    requestsPerMinute: 200,
    windowMs: 60 * 1000
  }
};

// Authentication middleware for folder endpoints
const authMiddleware = async (req, res, next) => {
  try {
    // Skip auth if disabled for development
    if (DISABLE_AUTH === 'true') {
      console.log('Auth disabled for development, using default user ID:', DEFAULT_USER_ID);
      req.userId = DEFAULT_USER_ID;
      return next();
    }
    
    // Get FID from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    // Extract FID from token
    const fid = authHeader.split(' ')[1];
    if (!fid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Attach FID to request object
    req.userId = fid;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }
};

// Rate limiting middleware
const rateLimit = (limit, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    const windowStart = now - windowMs;
    
    // Remove old requests
    while (userRequests.length > 0 && userRequests[0] < windowStart) {
      userRequests.shift();
    }
    
    if (userRequests.length >= limit) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
      });
    }
    
    userRequests.push(now);
    next();
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    services: {
      zapper: ZAPPER_API_KEY ? 'configured' : 'missing-key',
      alchemy: ALCHEMY_ETH_API_KEY ? 'configured' : 'missing-key',
      neynar: NEYNAR_API_KEY ? 'configured' : 'missing-key',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    } 
  });
});

// Update Neynar search endpoint with caching and rate limiting
app.get('/api/neynar/search', 
  rateLimit(RATE_LIMITS.NEYNAR.requestsPerMinute, RATE_LIMITS.NEYNAR.windowMs),
  async (req, res) => {
    try {
      const { q: username } = req.query;
      
      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      if (!NEYNAR_API_KEY) {
        return res.status(500).json({ error: 'Neynar API key not configured' });
      }

      console.log('Searching for username:', username);

      // Check cache first
      const cacheKey = CACHE_KEYS.FARCASTER_PROFILE(username);
      const cachedProfile = cache.get(cacheKey);
      if (cachedProfile) {
        console.log('Returning cached profile for:', username);
        return res.json(cachedProfile);
      }

      // First try to get user by username
      console.log('Fetching user from Neynar API...');
      const userResponse = await axios.get(`${NEYNAR_API_URL}/farcaster/user/search`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          viewer_fid: 1,
          q: username
        }
      });

      console.log('Neynar API Response:', JSON.stringify(userResponse.data, null, 2));

      if (userResponse.data.result && userResponse.data.result.users && userResponse.data.result.users.length > 0) {
        const user = userResponse.data.result.users[0];
        console.log('Found user:', user);
        
        // Get connected addresses
        console.log('Fetching user verifications...');
        const addressesResponse = await axios.get(`${NEYNAR_API_URL}/farcaster/user/bulk`, {
          headers: {
            'accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          },
          params: {
            fids: [user.fid]
          }
        });

        console.log('User details response:', JSON.stringify(addressesResponse.data, null, 2));

        const userDetails = addressesResponse.data.users[0];

        const response = {
          data: {
            farcasterProfile: {
              fid: userDetails.fid,
              username: userDetails.username,
              metadata: {
                displayName: userDetails.display_name,
                imageUrl: userDetails.pfp_url
              },
              custodyAddress: userDetails.custody_address,
              connectedAddresses: userDetails.verifications || []
            }
          }
        };

        // Cache the response
        cache.set(cacheKey, response, 300); // Cache for 5 minutes
        console.log('Returning profile:', JSON.stringify(response, null, 2));
        return res.json(response);
      }

      console.log('No user found for:', username);
      return res.json({ data: { farcasterProfile: null } });
    } catch (error) {
      console.error('Neynar API Error:', error.message);
      if (error.response) {
        console.error('Neynar API Response:', error.response.data);
        return res.status(error.response.status).json(error.response.data);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Neynar API endpoint
app.post('/api/neynar/profile',
  rateLimit(RATE_LIMITS.NEYNAR.requestsPerMinute, RATE_LIMITS.NEYNAR.windowMs),
  async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ error: 'Username is required' });
      }

      if (!NEYNAR_API_KEY) {
        return res.status(500).json({ error: 'Neynar API key not configured' });
      }

      // Generate cache key based on username
      const cacheKey = `neynar_profile_${username}`;
      const cachedResponse = cache.get(cacheKey);
      
      if (cachedResponse) {
        console.log('Returning cached Neynar profile response');
        return res.json(cachedResponse);
      }

      console.log(`Fetching Farcaster profile for ${username} from Neynar API`);
      
      // Search for user by username
      const response = await axios.get(`${NEYNAR_API_URL}/farcaster/user/search`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          viewer_fid: 1,
          q: username
        }
      });

      if (!response.data.result?.users?.length) {
        console.log(`No Farcaster profile found for ${username}`);
        return res.status(404).json({ error: `Profile not found for "${username}"` });
      }
      
      const user = response.data.result.users[0];
      console.log(`Found Farcaster profile for ${username}:`, user.username);
      
      // Fetch connected addresses for the user
      const verificationResponse = await axios.get(`${NEYNAR_API_URL}/farcaster/user/verify`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          fid: user.fid
        }
      });

      // Process and format the verification data
      const verifications = verificationResponse.data.result?.verifications || [];
      const addresses = verifications.map(v => v.address);
      
      // Add custody address if not already included
      if (user.custody_address && !addresses.includes(user.custody_address)) {
        addresses.push(user.custody_address);
      }
      
      console.log(`Found ${addresses.length} verified addresses for ${username}:`, addresses);

      // Transform to the response format similar to what zapperService expects
      const formattedResponse = {
        data: {
          profile: {
            fid: user.fid,
            username: user.username,
            displayName: user.display_name,
            bio: user.profile?.bio || "",
            imageUrl: user.pfp_url,
            custodyAddress: user.custody_address,
            connectedAddresses: addresses
          }
        }
      };

      // Cache the response
      cache.set(cacheKey, formattedResponse, 300); // Cache for 5 minutes
      
      return res.json(formattedResponse);
    } catch (error) {
      console.error('Neynar API Error:', error.message);
      if (error.response) {
        console.error('Neynar API Response:', error.response.data);
        return res.status(error.response.status).json(error.response.data);
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Zapper API endpoint with caching and rate limiting
app.post('/api/zapper',
  rateLimit(RATE_LIMITS.ZAPPER.requestsPerMinute, RATE_LIMITS.ZAPPER.windowMs),
  async (req, res) => {
    try {
      const { query, variables } = req.body;

      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      if (!ZAPPER_API_KEY) {
        return res.status(500).json({ error: 'Zapper API key not configured' });
      }

      // Generate cache key based on query and variables
      const cacheKey = `zapper_${query}_${JSON.stringify(variables || {})}`;
      const cachedResponse = cache.get(cacheKey);
      
      if (cachedResponse) {
        console.log('Returning cached Zapper API response');
        return res.json(cachedResponse);
      }

      console.log('Zapper API Request:', {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        variables
      });
      
      console.log('Using Zapper API Key:', ZAPPER_API_KEY.substring(0, 6) + '...');

      const response = await axios.post(ZAPPER_API_URL, 
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-zapper-api-key': ZAPPER_API_KEY
          }
        }
      );

      console.log('Zapper API Response Status:', response.status);
      
      if (response.data && response.data.errors) {
        console.log('Zapper API error:', response.data.errors);
        return res.status(400).json(response.data);
      }
      
      // Log a sample of the response data
      if (response.data && response.data.data) {
        const dataKeys = Object.keys(response.data.data);
        if (dataKeys.length > 0) {
          const firstKey = dataKeys[0];
          const sample = response.data.data[firstKey];
          console.log('Zapper API Response Data sample:', 
            JSON.stringify(sample).substring(0, 200) + '...');
        }
      }

      // Cache successful responses
      if (response.data && !response.data.errors) {
        cache.set(cacheKey, response.data, 300); // Cache for 5 minutes
      }

      res.json(response.data);
    } catch (error) {
      console.error('Zapper API error:', error.response?.data || error.message);
      if (error.response) {
        console.log('Zapper API Response Status:', error.response.status);
        console.log('Zapper API Response Headers:', error.response.headers);
      }
      res.status(error.response?.status || 500).json({
        error: 'Failed to fetch data from Zapper API',
        details: error.response?.data || error.message
      });
    }
  }
);

// Alchemy API endpoint for NFT metadata
app.get('/api/alchemy/nft', async (req, res) => {
  try {
    const { contractAddress, tokenId, network = 'ethereum' } = req.query;
    
    console.log('Alchemy API Request:', { contractAddress, tokenId, network });
    
    const apiKey = network.toLowerCase() === 'base' ? ALCHEMY_BASE_API_KEY : ALCHEMY_ETH_API_KEY;
    const networkPath = network.toLowerCase() === 'base' ? 'base-mainnet' : 'eth-mainnet';
    
    const url = `https://${networkPath}.g.alchemy.com/v2/${apiKey}/getNFTMetadata`;
    
    const response = await axios.get(url, {
      params: {
        contractAddress,
        tokenId,
        tokenType: 'ERC721',
      },
    });
    
    console.log('Alchemy API Response Status:', response.status);
    
    res.json(response.data);
  } catch (error) {
    console.error('Alchemy API Error:', error.message);
    if (error.response) {
      console.error('Alchemy API Response Error:', error.response.data);
    }
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data || 'No additional details'
    });
  }
});

// === FOLDER MANAGEMENT ENDPOINTS ===

// Get all folders for the authenticated user
app.get('/api/folders', authMiddleware, async (req, res) => {
  try {
    console.log('Getting all folders for user:', req.userId);
    
    // In development, we can disable auth for testing
    const authDisabled = process.env.DISABLE_AUTH === 'true';
    
    let folders = [];
    
    if (useInMemoryDb) {
      // Debug info about available folders
      console.log('All in-memory folders:', inMemoryFolders.map(f => 
        ({ id: f.id, name: f.name, userId: f.userId, nftCount: f.nfts?.length || 0 })
      ));
      
      // Filter in-memory folders by userId (or return all if auth is disabled)
      folders = authDisabled
        ? inMemoryFolders
        : inMemoryFolders.filter(folder => folder.userId === req.userId);
        
      console.log(`Found ${folders.length} in-memory folders for user ${req.userId}`);
    } else {
      try {
        // Get folders from MongoDB
        folders = await Folder.find({ userId: req.userId });
        console.log(`Found ${folders.length} MongoDB folders for user ${req.userId}`);
        
        // Add string id for consistency with in-memory implementation
        folders = folders.map(folder => {
          const folderObj = folder.toObject();
          folderObj.id = folder._id.toString();
          return folderObj;
        });
      } catch (err) {
        console.error('MongoDB error when fetching folders:', err.message);
        
        // Fallback to in-memory if MongoDB fails
        useInMemoryDb = true;
        folders = inMemoryFolders.filter(folder => folder.userId === req.userId);
        console.log(`Fallback: Found ${folders.length} in-memory folders for user ${req.userId}`);
      }
    }
    
    // If no folders were found, return an empty array
    if (!folders || folders.length === 0) {
      console.log('No folders found for user:', req.userId);
    }
    
    res.json(folders || []);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Failed to fetch folders', details: error.message });
  }
});

// Get public folders for a specific user
app.get('/api/folders/public/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // First, get the user's FID from their username
    const cacheKey = CACHE_KEYS.FARCASTER_PROFILE(username);
    let userProfile = cache.get(cacheKey);
    
    if (!userProfile) {
      // Fetch user profile from Neynar
      const userResponse = await axios.get(`${NEYNAR_API_URL}/farcaster/user/search`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          viewer_fid: 1,
          q: username
        }
      });
      
      if (!userResponse.data.result?.users?.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResponse.data.result.users[0];
      userProfile = { data: { farcasterProfile: { fid: user.fid } } };
    }
    
    // Now fetch public folders for this user
    const fid = userProfile.data.farcasterProfile.fid;
    
    if (useInMemoryDb) {
      const folders = inMemoryFolders.filter(folder => 
        folder.userId === fid.toString() && folder.isPublic
      );
      return res.json(folders);
    }
    
    const folders = await Folder.find({ 
      userId: fid.toString(),
      isPublic: true 
    });
    
    res.json(folders);
  } catch (error) {
    console.error('Error fetching public folders:', error);
    
    // Fallback to in-memory database if MongoDB fails
    if (!useInMemoryDb) {
      useInMemoryDb = true;
      const fid = userProfile?.data?.farcasterProfile?.fid;
      if (fid) {
        const folders = inMemoryFolders.filter(folder => 
          folder.userId === fid.toString() && folder.isPublic
        );
        return res.json(folders);
      }
    }
    
    res.status(500).json({ error: 'Failed to fetch public folders' });
  }
});

// Get a specific folder
app.get('/api/folders/:id', authMiddleware, async (req, res) => {
  try {
    const folderId = req.params.id;
    console.log('Getting folder by ID:', folderId, 'User ID:', req.userId);
    
    let folder;
    
    if (useInMemoryDb) {
      // For in-memory DB, check both _id and id fields
      folder = inMemoryFolders.find(f => 
        f._id.toString() === folderId || 
        f.id === folderId
      );
      
      console.log('In-memory folder lookup result:', folder ? 'Found' : 'Not found');
    } else {
      try {
        // For MongoDB, try to find by MongoDB ObjectId
        folder = await Folder.findById(folderId);
        
        if (!folder && mongoose.Types.ObjectId.isValid(folderId)) {
          console.log('Folder not found by ObjectId, trying string match...');
          // If not found and ID is valid ObjectId, try to find by string conversion
          folder = await Folder.findOne({ _id: mongoose.Types.ObjectId(folderId) });
        }
      } catch (err) {
        console.error('MongoDB lookup error:', err.message);
        
        // Fallback to in-memory if MongoDB fails
        console.log('Falling back to in-memory folder lookup');
        folder = inMemoryFolders.find(f => 
          f._id.toString() === folderId || 
          f.id === folderId
        );
      }
    }
    
    if (!folder) {
      console.log('Folder not found with ID:', folderId);
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if the user has permission to access this folder
    const isOwner = folder.userId === req.userId;
    const isPublic = folder.isPublic;
    
    if (!isOwner && !isPublic) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // For MongoDB results, add a string id field for consistency
    if (!useInMemoryDb && folder._id && !folder.id) {
      const folderObj = folder.toObject();
      folderObj.id = folder._id.toString();
      console.log('Returning folder with added ID field:', folderObj.id);
      res.json(folderObj);
    } else {
      console.log('Returning folder:', folder);
      res.json(folder);
    }
  } catch (error) {
    console.error('Error getting folder:', error);
    res.status(500).json({ error: 'Failed to get folder', details: error.message });
  }
});

// Create a folder
app.post('/api/folders', authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    
    console.log('Creating folder:', {
      name,
      description,
      isPublic,
      userId: req.userId
    });
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    if (useInMemoryDb) {
      // Generate unique ID for in-memory folder
      const folderId = new mongoose.Types.ObjectId();
      
      const newFolder = {
        _id: folderId,
        id: folderId.toString(), // Add string ID for consistency
        name,
        description: description || '',
        userId: req.userId,
        isPublic: isPublic || false,
        nfts: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      inMemoryFolders.push(newFolder);
      console.log('Folder created in-memory:', newFolder);
      return res.status(201).json(newFolder);
    } else {
      // Create in MongoDB
      const folder = new Folder({
        name,
        description: description || '',
        userId: req.userId,
        isPublic: isPublic || false
      });
      
      await folder.save();
      
      // Add string id for consistency with in-memory implementation
      const folderObj = folder.toObject();
      folderObj.id = folder._id.toString();
      
      console.log('Folder created in MongoDB:', folderObj);
      res.status(201).json(folderObj);
    }
  } catch (error) {
    console.error('Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder', details: error.message });
  }
});

// Update a folder
app.put('/api/folders/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic } = req.body;
    const folder = await Folder.findById(req.params.id);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Ensure the user owns this folder
    if (folder.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Update fields if provided
    if (name !== undefined) folder.name = name;
    if (description !== undefined) folder.description = description;
    if (isPublic !== undefined) folder.isPublic = Boolean(isPublic);
    
    await folder.save();
    res.json(folder);
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// Delete a folder
app.delete('/api/folders/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Ensure the user owns this folder
    if (folder.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Folder.findByIdAndDelete(req.params.id);
    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

// Add an NFT to a folder
app.post('/api/folders/:id/nfts', authMiddleware, async (req, res) => {
  try {
    const { tokenId, contractAddress, network, name, imageUrl, collectionName, estimatedValueUsd } = req.body;
    const folderId = req.params.id;
    
    console.log('Received add NFT request:', {
      folderId,
      userId: req.userId,
      nftData: req.body
    });
    
    if (!tokenId && !name) {
      return res.status(400).json({ error: 'Either tokenId or name is required' });
    }
    
    let folder = null;
    
    // Print available folders for debugging
    if (useInMemoryDb) {
      console.log('Available in-memory folders:', inMemoryFolders.map(f => ({ 
        id: f.id, 
        _id: f._id ? f._id.toString() : 'undefined', 
        name: f.name,
        userId: f.userId
      })));
    }
    
    console.log('Looking for folder with ID:', folderId, 'User ID:', req.userId);
    
    if (useInMemoryDb) {
      // For in-memory DB, check both _id and id fields
      folder = inMemoryFolders.find(f => 
        (f._id && f._id.toString() === folderId) || 
        (f.id && f.id === folderId)
      );
      
      console.log('In-memory folder lookup result for adding NFT:', folder ? 'Found' : 'Not found');
      
      // If not found, try with different string/object ID formats
      if (!folder) {
        console.log('Folder not found with exact ID match, trying alternative formats');
        folder = inMemoryFolders.find(f => 
          (f._id && f._id.toString() === folderId.toString()) || 
          (f.id && f.id.toString() === folderId.toString())
        );
        
        console.log('Alternative format lookup result:', folder ? 'Found' : 'Not found');
      }
      
      if (!folder) {
        console.log('Folder not found in memory with ID:', folderId);
        console.log('Available folders in memory:', inMemoryFolders.map(f => ({ id: f.id, _id: f._id })));
        return res.status(404).json({ error: 'Folder not found' });
      }
    } else {
      try {
        // For MongoDB, try to find by MongoDB ObjectId
        folder = await Folder.findById(folderId);
        
        if (!folder && mongoose.Types.ObjectId.isValid(folderId)) {
          console.log('Folder not found by ObjectId, trying string match...');
          // If not found and ID is valid ObjectId, try to find by string conversion
          folder = await Folder.findOne({ _id: mongoose.Types.ObjectId(folderId) });
        }
      } catch (err) {
        console.error('MongoDB lookup error when adding NFT:', err.message);
        
        // Fallback to in-memory if MongoDB fails
        console.log('Falling back to in-memory folder lookup for adding NFT');
        folder = inMemoryFolders.find(f => 
          (f._id && f._id.toString() === folderId) || 
          f.id === folderId
        );
        
        if (!folder) {
          console.log('Folder not found in memory with ID:', folderId);
          console.log('Available folders in memory:', inMemoryFolders.map(f => ({ id: f.id, _id: f._id })));
          return res.status(404).json({ error: 'Folder not found' });
        }
      }
    }
    
    if (!folder) {
      console.log('Folder not found with ID when adding NFT:', folderId);
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if the user is authorized (either it's their folder or auth is disabled for dev)
    const authDisabled = process.env.DISABLE_AUTH === 'true';
    if (!authDisabled && folder.userId !== req.userId) {
      console.log('Access denied. Folder user ID:', folder.userId, 'Request user ID:', req.userId);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if NFT already exists in the folder
    const existingNftIndex = folder.nfts.findIndex(
      nft => (nft.tokenId === tokenId && nft.contractAddress === contractAddress) || 
             (nft.name === name && !nft.tokenId && !nft.contractAddress)
    );
    
    if (existingNftIndex !== -1) {
      return res.status(400).json({ error: 'NFT already exists in this folder' });
    }
    
    // Create NFT object with generated ID if needed
    const nftData = {
      _id: new mongoose.Types.ObjectId(),
      id: new mongoose.Types.ObjectId().toString(), // Add string ID for consistency
      tokenId: tokenId || '',
      contractAddress: contractAddress || '',
      network: network || 'ethereum',
      name: name || 'Unnamed NFT',
      imageUrl: imageUrl || '',
      collectionName: collectionName || '',
      estimatedValueUsd: estimatedValueUsd || null,
      addedAt: new Date()
    };
    
    // Add the NFT to the folder
    folder.nfts.push(nftData);
    console.log('Added NFT to folder, new NFT count:', folder.nfts.length);
    
    if (useInMemoryDb) {
      // Just update the in-memory object
      console.log('Added NFT to in-memory folder:', nftData);
      
      // Update the updatedAt field
      folder.updatedAt = new Date();
    } else {
      // Save to MongoDB
      try {
        await folder.save();
        console.log('Added NFT to MongoDB folder:', nftData);
      } catch (saveErr) {
        console.error('Error saving NFT to MongoDB folder:', saveErr);
        
        // Fallback to in-memory if MongoDB save fails
        useInMemoryDb = true;
        
        // Find or create in-memory folder
        let inMemoryFolder = inMemoryFolders.find(f => 
          (f._id && f._id.toString() === folderId) || 
          f.id === folderId
        );
        
        if (!inMemoryFolder) {
          // Create a new in-memory folder if not found
          inMemoryFolder = {
            _id: new mongoose.Types.ObjectId(),
            id: folderId,
            name: folder.name || 'Fallback Folder',
            description: folder.description || '',
            userId: req.userId,
            isPublic: folder.isPublic || false,
            nfts: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          inMemoryFolders.push(inMemoryFolder);
        }
        
        // Add NFT to in-memory folder
        inMemoryFolder.nfts.push(nftData);
        inMemoryFolder.updatedAt = new Date();
        
        folder = inMemoryFolder;
        console.log('Fallback: Added NFT to in-memory folder:', nftData);
      }
    }
    
    // For MongoDB results, add a string id field for consistency in response
    if (!useInMemoryDb && folder._id && !folder.id) {
      const folderObj = folder.toObject();
      folderObj.id = folder._id.toString();
      console.log('Returning folder with added ID field:', folderObj.id);
      res.status(201).json(folderObj);
    } else {
      console.log('Returning updated folder:', folder);
      res.status(201).json(folder);
    }
  } catch (error) {
    console.error('Error adding NFT to folder:', error);
    res.status(500).json({ error: 'Failed to add NFT to folder', details: error.message });
  }
});

// Remove an NFT from a folder
app.delete('/api/folders/:folderId/nfts/:nftId', authMiddleware, async (req, res) => {
  try {
    const { folderId, nftId } = req.params;
    
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Ensure the user owns this folder
    if (folder.userId !== req.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Remove the NFT from the folder
    folder.nfts = folder.nfts.filter(nft => nft._id.toString() !== nftId);
    
    await folder.save();
    res.json(folder);
  } catch (error) {
    console.error('Error removing NFT from folder:', error);
    res.status(500).json({ error: 'Failed to remove NFT from folder' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API Keys Status:`);
  console.log(`- Zapper API Key: ${ZAPPER_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`- Alchemy ETH API Key: ${ALCHEMY_ETH_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`- Alchemy Base API Key: ${ALCHEMY_BASE_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`- Neynar API Key: ${NEYNAR_API_KEY ? 'Configured' : 'Missing'}`);
}); 