#!/bin/bash

# Script to set up Vercel environment variables using Vercel CLI
# You need to have Vercel CLI installed: npm i -g vercel

# Login to Vercel (if not already logged in)
echo "Logging in to Vercel..."
vercel login

# Link to the project (if not already linked)
echo "Linking to Vercel project..."
vercel link

# Set environment variables from vercel-env-setup.txt
echo "Setting environment variables..."

# MongoDB
vercel env add MONGODB_URI mongodb+srv://svvvg3x:MIsfHKAkx2TVJGyR@gall3ry.jiju7vt.mongodb.net/?retryWrites=true&w=majority&appName=GALL3RY

# Alchemy API keys
vercel env add REACT_APP_ALCHEMY_ETH_API_KEY -DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak
vercel env add REACT_APP_ALCHEMY_BASE_API_KEY -DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak

# Zapper API keys
vercel env add REACT_APP_ZAPPER_API_KEY 0b615d5f-ef05-42fb-95d3-a5e180d316cf
vercel env add ZAPPER_API_KEY 0b615d5f-ef05-42fb-95d3-a5e180d316cf

# Neynar API key
vercel env add REACT_APP_NEYNAR_API_KEY 04502D2A-A2F1-4682-8035-91C77FEEACE3

# Farcaster Auth configuration
vercel env add REACT_APP_FARCASTER_DOMAIN gall3ry.vercel.app
vercel env add REACT_APP_FARCASTER_SIWE_URI https://gall3ry.vercel.app/login
vercel env add REACT_APP_OPTIMISM_RPC_URL https://mainnet.optimism.io

echo "Environment variables have been set."
echo "Now, deploy your project with: vercel --prod" 