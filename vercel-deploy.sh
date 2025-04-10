#!/bin/bash

# Exit on error
set -e

echo "🚀 Preparing for Vercel deployment..."

# Create .vercel directory if it doesn't exist
mkdir -p .vercel

# Create project.json if it doesn't exist or update it
echo '{"projectId":"prj_6JygmhAuMC5qy0Lc1dmEhoZaC9ay","orgId":"team_7RzLvqtZVZoztS22ys79qi1u"}' > .vercel/project.json

# Check for environment variables
if [ ! -f .env ]; then
  echo "❌ No .env file found. Creating from example..."
  cp .env.example .env
  echo "⚠️ Please edit .env with your actual values before deploying."
  exit 1
fi

# Add all environment variables to Vercel
echo "📋 Setting up environment variables in Vercel..."
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip empty lines and comments
  if [[ -z "$line" || "$line" == \#* ]]; then
    continue
  fi
  
  # Extract key and value
  key=$(echo "$line" | cut -d= -f1)
  value=$(echo "$line" | cut -d= -f2-)
  
  echo "Setting $key..."
  vercel env add "$key" production <<< "$value"
done < vercel-env-setup.txt

echo "✅ Environment variables set up!"

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment completed!" 