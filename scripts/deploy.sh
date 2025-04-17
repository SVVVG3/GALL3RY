#!/bin/bash

# Script to prepare and deploy the application to Vercel

echo "🚀 Preparing to deploy to Vercel..."

# Ensure we have the required dependencies
echo "📦 Checking dependencies..."
npm install --no-fund --no-audit

# Validate environment variables
echo "🔑 Validating environment variables..."
if [ ! -f .env ]; then
  echo "⚠️ No .env file found"
  exit 1
fi

# Source environment variables for local validation
source .env

# Check for required API keys
if [ -z "$ZAPPER_API_KEY" ]; then
  echo "❌ ZAPPER_API_KEY is missing in .env file"
  exit 1
fi

if [ -z "$ALCHEMY_API_KEY" ]; then
  echo "❌ ALCHEMY_API_KEY is missing in .env file"
  exit 1
fi

echo "✅ Environment variables validated"

# Create production environment file
echo "📝 Creating production environment file..."
cat > .env.production << EOL
# API Keys for NFT Services
ALCHEMY_API_KEY=$ALCHEMY_API_KEY
REACT_APP_ALCHEMY_API_KEY=$ALCHEMY_API_KEY

# Zapper API key (for Farcaster profiles)
ZAPPER_API_KEY=$ZAPPER_API_KEY
REACT_APP_ZAPPER_API_KEY=$ZAPPER_API_KEY

# API Configuration for production
REACT_APP_API_URL=https://gall3ry.vercel.app/api
EOL

echo "✅ Production environment file created"

# Run a local build to check for issues
echo "🔨 Running a test build..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix the issues before deploying."
  exit 1
fi

echo "✅ Test build successful"

# Commit changes if git is available
if command -v git &> /dev/null; then
  echo "📊 Committing changes..."
  git add .env.production vercel.json scripts/
  git commit -m "Prepare for Vercel deployment" || true
fi

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
if command -v vercel &> /dev/null; then
  vercel --prod
else
  echo "⚠️ Vercel CLI not found. Please install it with 'npm i -g vercel' or deploy manually."
  echo "To deploy manually:"
  echo "1. Push your changes to your Git repository"
  echo "2. Connect your Git repository to Vercel"
  echo "3. Deploy from the Vercel dashboard"
fi

echo "✅ Deployment process complete" 