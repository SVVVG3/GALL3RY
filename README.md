# GALL3RY - NFT Collection Manager

A web application for creating, organizing, and sharing NFT collections with Farcaster social integration.

## Features

- **NFT Discovery**: Browse and search for NFTs across different blockchains
- **Folder Management**: Create private or public folders to organize your NFT collections
- **Farcaster Integration**: Login with Farcaster and share your collections
- **Public Galleries**: Discover featured collections from other users
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React, Tailwind CSS
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Authentication**: Farcaster Auth Kit
- **NFT Data**: Zapper API

## Farcaster Mini App Integration

GALL3RY is fully integrated as a Farcaster Mini App, allowing users to:

- **Sign in with Farcaster**: Authenticate using their Farcaster identity
- **View NFT Collections**: Explore NFT collections within the Warpcast mobile app
- **Search Users**: Find and view other users' collections without leaving Warpcast
- **Share Discoveries**: Easily share interesting NFTs to their Farcaster feed

The integration uses the `@farcaster/frame-sdk` to handle authentication, user context, and app lifecycle events.

## Component Inventory

This project follows standardized naming conventions for components. Here are the key components:

### Core Components

- **NFTGrid**: Displays a grid of NFTs with images and metadata. Handles loading states and supports various NFT data formats.
- **NFTCard**: Individual NFT card display with image and metadata (used within NFTGrid).
- **NFTGallery**: Main gallery container component that enables adding wallet addresses and searching NFTs.

### Contexts

- **NFTContext**: Provides NFT data fetching and management for NFT gallery functionality.
- **AuthContext**: Handles user authentication state.
- **WalletContext**: Manages connected wallet information.

### Utility Functions

- **getImageUrl**: Extracts and processes image URLs from NFT data.
- **getCORSProxyUrl**: Handles CORS issues with certain image sources.
- **getContractAddress/getTokenId**: Extract standardized data from various NFT formats.

## Getting Started

### Prerequisites

- Node.js v16+
- MongoDB instance (local or Atlas)

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# API Keys
REACT_APP_ZAPPER_API_KEY=your_zapper_api_key
REACT_APP_NEYNAR_API_KEY=your_neynar_api_key

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>

# API Configuration
REACT_APP_API_URL=http://localhost:3001/api
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/SVVVG3/GALL3RY.git
cd gall3ry
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

This will start both the React frontend on port 3000 and the Express backend on port 3001.

## Folder Service

The folder service provides functionality to create and manage NFT collections:

- Get user folders
- Create new folders
- Update folder details
- Add/remove NFTs to folders
- Toggle folder visibility (public/private)
- Browse public and featured folders

## API Endpoints

### Public Endpoints

- `GET /api/users/:fid/folders/public` - Get public folders for a specific user
- `GET /api/folders/featured` - Get featured public folders

### Protected Endpoints (Authentication Required)

- `GET /api/folders` - Get all folders for the authenticated user
- `POST /api/folders` - Create a new folder
- `GET /api/folders/:folderId` - Get details of a specific folder
- `PUT /api/folders/:folderId` - Update a folder
- `DELETE /api/folders/:folderId` - Delete a folder
- `POST /api/folders/:folderId/nfts` - Add an NFT to a folder
- `DELETE /api/folders/:folderId/nfts/:nftId` - Remove an NFT from a folder
- `PATCH /api/folders/:folderId/visibility` - Toggle folder visibility

## Deployment

### Vercel (Recommended Production Deployment)

This project is optimized for deployment on Vercel's serverless platform:

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure environment variables in the Vercel dashboard:
   - `ALCHEMY_API_KEY`: Your Alchemy API key
   - `NEYNAR_API_KEY`: Your Neynar API key
   - `ZAPPER_API_KEY`: Your Zapper API key (if applicable)
4. Deploy from the Vercel dashboard

The project structure is specifically designed for Vercel, with API routes in the `/api` directory that automatically become serverless functions.

### Local Development

To run the project locally:

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your API keys:
```
ALCHEMY_API_KEY=your_alchemy_api_key
NEYNAR_API_KEY=your_neynar_api_key
ZAPPER_API_KEY=your_zapper_api_key
```

3. Start the development server:
```bash
npm run dev
```

This uses a custom start script that:
- Patches the server.js file for local compatibility
- Starts the Express server
- Sets up a dynamic port if 3001 is already in use
- Generates a runtime config for the frontend

#### Module Compatibility

The project uses a hybrid module system:
- The `/api` directory is designed for Vercel's serverless functions
- A local bridge file (`vercel-local-bridge.js`) connects these API modules to the Express server
- The patch script handles any compatibility issues automatically

## License

MIT License

## Credits

Created by [SVVVG3](https://github.com/SVVVG3)

## Troubleshooting

### Using the farcasterService

When working with the farcasterService, you can import functions in two ways:

1. Default import (object style):
```javascript
import farcasterService from '../services/farcasterService';

// Usage:
const addresses = await farcasterService.fetchAddressesForFid(fid);
const following = await farcasterService.getUserFollowing(fid);
```

2. Named imports (direct function import):
```javascript
import { fetchAddressesForFid, getUserFollowing } from '../services/farcasterService';

// Usage:
const addresses = await fetchAddressesForFid(fid);
const following = await getUserFollowing(fid);
```

Make sure you're using one of these approaches consistently to avoid "undefined is not a function" errors.
