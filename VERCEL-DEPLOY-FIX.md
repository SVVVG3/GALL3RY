# Fixing Vercel Deployment for GALL3RY

This guide provides specific steps to fix deployment issues with the GALL3RY application on Vercel.

## 1. Updated Configuration Files

We've made the following important changes to fix the deployment:

1. **Updated `vercel.json`** - Properly configured the routing for both the frontend and API
2. **Added dedicated API endpoints** - Created specific serverless functions for health and db-status checks
3. **Fixed the API routing** - Corrected route handling in the API functions

## 2. Deploying to Vercel

Follow these steps to deploy with the fixed configuration:

1. Log in to Vercel CLI (if not already logged in):
   ```
   npx vercel login
   ```

2. Link your project (if not already linked):
   ```
   npx vercel link
   ```

3. Set up environment variables:
   ```
   npx vercel env add MONGODB_URI
   npx vercel env add REACT_APP_ALCHEMY_ETH_API_KEY
   npx vercel env add REACT_APP_ALCHEMY_BASE_API_KEY
   npx vercel env add REACT_APP_ZAPPER_API_KEY
   npx vercel env add ZAPPER_API_KEY
   npx vercel env add REACT_APP_NEYNAR_API_KEY
   npx vercel env add REACT_APP_FARCASTER_DOMAIN
   npx vercel env add REACT_APP_FARCASTER_SIWE_URI
   npx vercel env add REACT_APP_OPTIMISM_RPC_URL
   ```

4. Deploy the application:
   ```
   npx vercel --prod
   ```

## 3. Testing the Deployment

After deployment, test the API endpoints:

1. Test the health check endpoint:
   ```
   curl https://your-project.vercel.app/api/health
   ```

2. Test the database status endpoint:
   ```
   curl https://your-project.vercel.app/api/db-status
   ```

3. Test other API endpoints as needed.

## 4. Troubleshooting

If you still encounter issues:

1. **Check Vercel Logs** - Look at the logs in your Vercel dashboard for any errors
2. **Verify Environment Variables** - Make sure all env variables are set correctly
3. **Test Locally** - Use the Vercel CLI to test your deployment locally:
   ```
   npx vercel dev
   ```

4. **Clear Cache** - Try clearing the Vercel build cache:
   ```
   npx vercel --prod --force
   ```

## 5. Important Notes

- The API routes are now available at `/api/[endpoint]` (e.g., `/api/health`)
- Make sure to update your Farcaster domain variables to match your actual Vercel deployment URL
- If using a custom domain, update the configuration accordingly 