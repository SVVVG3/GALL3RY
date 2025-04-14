#!/bin/bash

# Script to deploy to Vercel with environment variable verification

echo "Preparing to deploy to Vercel..."

# Check for Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Verify required environment variables exist in .env
required_vars=("ALCHEMY_API_KEY" "ZAPPER_API_KEY")
missing_vars=0

for var in "${required_vars[@]}"; do
  if ! grep -q "^$var=" .env; then
    echo "❌ Missing required variable in .env: $var"
    missing_vars=$((missing_vars+1))
  else
    value=$(grep "^$var=" .env | cut -d '=' -f2)
    # Print first 4 and last 4 characters of the API key for verification
    masked_value="${value:0:4}...${value: -4}"
    echo "✅ Found $var: $masked_value"
  fi
done

if [ $missing_vars -ne 0 ]; then
  echo "Please add the missing environment variables to your .env file and try again."
  exit 1
fi

# Verify webpack config has vm-browserify
if ! grep -q "vm-browserify" config-overrides.js; then
  echo "❌ vm-browserify not found in config-overrides.js"
  echo "Please add 'vm': require.resolve('vm-browserify') to your fallbacks in config-overrides.js"
  exit 1
else
  echo "✅ vm-browserify configured correctly"
fi

# Run build to test locally first
echo "Running a test build..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix the errors and try again."
  exit 1
fi

echo "✅ Build successful!"

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod

echo "Deployment process completed!" 