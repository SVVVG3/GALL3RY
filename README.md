# NFT Gallery App

A modern web application for managing and displaying NFT collections, with Farcaster authentication.

## Features

- Connect with Farcaster authentication
- View NFTs from connected wallets
- Create and manage collections of NFTs
- Share public collections with others
- Responsive design for all devices

## Tech Stack

- **Frontend**: React, Tailwind CSS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: MongoDB
- **Authentication**: Farcaster Auth
- **APIs**: Alchemy, Zapper, Neynar

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- MongoDB connection string
- API keys for Alchemy, Zapper, and Neynar

### Local Development

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd nft-gallery
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the `.env.example` file to `.env` and fill in your API keys and MongoDB connection string.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment to GitHub and Vercel

### GitHub Setup

1. Create a new GitHub repository.

2. Initialize Git and push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

### Vercel Deployment

1. Sign up or log in to [Vercel](https://vercel.com/).

2. Import your GitHub repository.

3. Configure the project:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `build`

4. Add environment variables:
   - `MONGODB_URI`: Your MongoDB connection string
   - `ZAPPER_API_KEY`: Your Zapper API key
   - `REACT_APP_ZAPPER_API_KEY`: Same as above
   - `REACT_APP_ALCHEMY_ETH_API_KEY`: Your Alchemy Ethereum API key
   - `REACT_APP_ALCHEMY_BASE_API_KEY`: Your Alchemy Base API key
   - `REACT_APP_NEYNAR_API_KEY`: Your Neynar API key
   - `REACT_APP_FARCASTER_DOMAIN`: Your domain (e.g., `nft-gallery.app`)
   - `REACT_APP_FARCASTER_SIWE_URI`: Your login URI (e.g., `https://nft-gallery.app/login`)
   - `REACT_APP_OPTIMISM_RPC_URL`: Optimism RPC URL (`https://mainnet.optimism.io`)

5. Click "Deploy" and wait for the build to complete.

## Project Structure

```
nft-gallery/
├── api/                   # Vercel serverless functions
│   ├── folders/           # Folder management endpoints
│   ├── models/            # MongoDB models
│   └── _utils.js          # Shared utility functions
├── public/                # Static files
├── src/
│   ├── components/        # React components
│   ├── contexts/          # React contexts
│   ├── models/            # Data models
│   ├── services/          # API service functions
│   ├── utils/             # Utility functions
│   ├── hooks/             # Custom React hooks
│   ├── App.js             # Main App component
│   └── index.js           # Entry point
├── .env                   # Environment variables (for development)
├── .env.example           # Example environment variables
├── .gitignore             # Git ignore file
├── vercel.json            # Vercel configuration
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
└── README.md              # Project documentation
```

## License

MIT
# GALL3RY - NFT Gallery App
