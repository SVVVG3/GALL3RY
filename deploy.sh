#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting deployment..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Create deployment directory if it doesn't exist
echo "📁 Creating deployment directory..."
sudo mkdir -p /var/www/nft-gallery

# Copy files to deployment directory
echo "📋 Copying files..."
sudo cp -r build/* /var/www/nft-gallery/
sudo cp server.js /var/www/nft-gallery/
sudo cp package.json /var/www/nft-gallery/
sudo cp .env /var/www/nft-gallery/

# Install production dependencies
echo "📥 Installing production dependencies..."
cd /var/www/nft-gallery
npm install --production

# Restart the server using PM2
echo "🔄 Restarting server..."
pm2 restart nft-gallery || pm2 start server.js --name nft-gallery

echo "✅ Deployment complete!" 