#!/bin/bash

# Script to clear Vercel caches before deployment
# This script requires the Vercel CLI to be installed

echo "Clearing Vercel build cache..."

# Login to Vercel (if not already logged in)
vercel login

# Get project info
vercel link

# Clear build cache
vercel deploy --no-wait --clear-cache

echo "Build cache cleared! Now run a fresh deployment with:"
echo "vercel deploy --prod" 