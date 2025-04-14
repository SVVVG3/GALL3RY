require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const config = require('./src/config');
const folderController = require('./src/server/folderController');
const zapperHandler = require('./api/zapper');
const neynarHandler = require('./api/neynar');
const alchemyHandler = require('./api/alchemy');
const net = require('net');
const axios = require('axios');

const app = express();
const BASE_PORT = process.env.PORT || 3001;

// Function to find an available port
const findAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      // Port is in use, try the next one
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nft-gallery', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Authentication middleware (simple version)
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // In a real app, we'd validate the token here
    // This is a simplified version for development
    req.user = { userId: '123456789012345678901234' }; // Placeholder user ID
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// API Routes
const apiRouter = express.Router();

// Public endpoints (no auth required)
apiRouter.get('/users/:fid/folders/public', folderController.getPublicFoldersByUser);
apiRouter.get('/folders/featured', folderController.getFeaturedFolders);

// Add Zapper and Neynar API handlers
apiRouter.post('/zapper', zapperHandler);
apiRouter.get('/neynar', neynarHandler);
apiRouter.get('/alchemy', alchemyHandler);

// Protected endpoints (auth required)
apiRouter.get('/folders', authMiddleware, folderController.getUserFolders);
apiRouter.post('/folders', authMiddleware, folderController.createFolder);
apiRouter.get('/folders/:folderId', authMiddleware, folderController.getFolder);
apiRouter.put('/folders/:folderId', authMiddleware, folderController.updateFolder);
apiRouter.delete('/folders/:folderId', authMiddleware, folderController.deleteFolder);
apiRouter.post('/folders/:folderId/nfts', authMiddleware, folderController.addNftToFolder);
apiRouter.delete('/folders/:folderId/nfts/:nftId', authMiddleware, folderController.removeNftFromFolder);
apiRouter.patch('/folders/:folderId/visibility', authMiddleware, folderController.toggleFolderVisibility);

// Mount API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Start server with available port
findAvailablePort(BASE_PORT).then(port => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`API base URL: http://localhost:${port}/api`);
    
    // Update the config with the new port
    if (!process.env.REACT_APP_API_URL) {
      config.apiUrl = `http://localhost:${port}/api`;
    }
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // In production, you might want to use a logging service here
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  // In production, you might want to use a logging service here
});

app.post('/api/alchemy/batch-nfts', async (req, res) => {
  try {
    const { addresses, network, options } = req.body;
    
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses provided' });
    }
    
    // Use Alchemy SDK to fetch NFTs
    const baseURL = network === 'base' 
      ? `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_BASE_API_KEY}`
      : `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_ETH_API_KEY}`;
    
    const endpoint = '/getNFTsForOwners';
    
    // Prepare the request
    const pageSize = options?.pageSize || 24;
    const excludeSpam = options?.excludeSpam !== false;
    const withMetadata = options?.withMetadata !== false;
    const pageKey = options?.pageKey || null;
    
    const requestBody = {
      owners: addresses,
      pageSize,
      excludeSpam,
      withMetadata
    };
    
    if (pageKey) {
      requestBody.pageKey = pageKey;
    }
    
    // Make the request to Alchemy
    const response = await axios.post(`${baseURL}${endpoint}`, requestBody, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    // Process the response
    const nfts = [];
    
    if (response.data.ownerAddresses) {
      for (const owner of response.data.ownerAddresses) {
        if (owner.nfts && Array.isArray(owner.nfts)) {
          nfts.push(...owner.nfts);
        }
      }
    }
    
    return res.json({
      nfts: nfts,
      pageKey: response.data.pageKey || null,
      totalCount: response.data.totalCount || nfts.length
    });
  } catch (error) {
    console.error('Error in batch NFTs endpoint:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch NFTs' });
  }
}); 