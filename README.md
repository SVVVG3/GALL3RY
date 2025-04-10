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
git clone https://github.com/your-username/nft-gallery.git
cd nft-gallery
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

### Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

## License

MIT License

## Credits

Created by [Your Name](https://github.com/your-username)
