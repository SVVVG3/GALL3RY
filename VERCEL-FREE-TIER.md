# Deploying to Vercel (Free Tier)

This guide explains how to deploy GALL3RY on Vercel's free Hobby tier, which has a limit of 12 serverless functions.

## Understanding the Limitation

Vercel's free tier has a limit of 12 serverless functions per project. In a Node.js project, every JavaScript file in the `/api` directory is treated as a separate serverless function.

## Our Solution

To work within this limitation, we've consolidated all API endpoints into a single Express application in `api/index.js`. This approach:

1. Keeps us under the 12-function limit
2. Maintains the same API routes and functionality
3. Uses Express routing to handle all endpoints

## API Structure

All API routes are now handled by the main `api/index.js` file, which:

- Processes all requests with path-based routing
- Maintains the same URL structure (`/api/health`, `/api/db-status`, etc.)
- Routes requests internally using Express

## Deployment Steps

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Use the following settings:
   - Framework Preset: Create React App
   - Build Command: npm run vercel-build
   - Output Directory: build
   - Install Command: npm install

## Testing After Deployment

After deployment, test the following endpoints to verify functionality:

- `https://your-domain.vercel.app/api/health`
- `https://your-domain.vercel.app/api/db-status`

## Upgrading

If you need more than 12 serverless functions or want to keep them separate, consider:

1. Upgrading to Vercel's Pro plan
2. Using a different hosting provider like Netlify, AWS, or DigitalOcean

## Important Notes

- The `.vercel/` directory should be added to your `.gitignore` file
- Local development still works the same way with `npm run dev`
- The API behaves the same way as before from the client's perspective 