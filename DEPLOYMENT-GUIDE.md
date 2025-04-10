# Step-by-Step Vercel Deployment Guide for GALL3RY

This guide provides detailed instructions for deploying the GALL3RY NFT application to Vercel, with special attention to common issues and their solutions.

## Prerequisites

- Vercel account (create one at [vercel.com](https://vercel.com) if you don't have one)
- GitHub repository with your GALL3RY code
- MongoDB Atlas account with a cluster set up

## Step 1: Prepare Your Code

Before deployment, ensure your codebase is properly configured:

1. Make sure your updated `vercel.json` is in the root directory:
   ```json
   {
     "version": 2,
     "public": true,
     "framework": "create-react-app",
     "buildCommand": "npm run vercel-build",
     "outputDirectory": "build",
     "routes": [
       { "src": "/api/(.*)", "dest": "/api/$1" },
       { "src": "/(.*\\.(js|json|css|ico|png|jpg|svg))", "dest": "/$1" },
       { "src": "/(.*)", "dest": "/index.html" }
     ]
   }
   ```

2. Verify your `package.json` includes the correct build script:
   ```json
   "scripts": {
     "vercel-build": "CI=false DISABLE_ESLINT_PLUGIN=true react-scripts build"
   }
   ```

3. Push all changes to your GitHub repository.

## Step 2: Import Your Project to Vercel

1. Go to [vercel.com](https://vercel.com) and log in.
2. Click "Add New" > "Project".
3. Choose "Import Git Repository" and select your GitHub account.
4. Find and select your GALL3RY repository.
5. If you don't see it, click "Configure GitHub App" to grant Vercel access to your repositories.

## Step 3: Configure Deployment Settings

In the configuration screen:

1. **Framework Preset**: Select "Create React App" from the dropdown.
2. **Root Directory**: Leave as `.` (default).
3. **Build Command**: Should automatically be set to `npm run vercel-build` from your vercel.json.
4. **Output Directory**: Should automatically be set to `build` from your vercel.json.
5. **Development Command**: Set to `npm run dev` (optional).

## Step 4: Set Environment Variables

This is CRITICAL! Click "Environment Variables" and add the following:

```
MONGODB_URI=mongodb+srv://svvvg3x:MIsfHKAkx2TVJGyR@gall3ry.jiju7vt.mongodb.net/?retryWrites=true&w=majority&appName=GALL3RY
REACT_APP_ALCHEMY_ETH_API_KEY=-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak
REACT_APP_ALCHEMY_BASE_API_KEY=-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak
REACT_APP_ZAPPER_API_KEY=0b615d5f-ef05-42fb-95d3-a5e180d316cf
ZAPPER_API_KEY=0b615d5f-ef05-42fb-95d3-a5e180d316cf
REACT_APP_NEYNAR_API_KEY=04502D2A-A2F1-4682-8035-91C77FEEACE3
REACT_APP_FARCASTER_DOMAIN=gall3ry.vercel.app
REACT_APP_FARCASTER_SIWE_URI=https://gall3ry.vercel.app/login
REACT_APP_OPTIMISM_RPC_URL=https://mainnet.optimism.io
```

**Important:** For Farcaster domain variables, use your expected Vercel deployment domain (this can be updated later).

## Step 5: Deploy

1. Click the "Deploy" button.
2. Wait for the build and deployment to complete (this may take a few minutes).
3. Once completed, Vercel will provide a deployment URL.

## Step 6: Update Farcaster Domain Variables

After deployment, you need to update the Farcaster domain variables:

1. Go to your project settings in Vercel.
2. Click on "Environment Variables".
3. Update these two variables with your actual deployment URL:
   - `REACT_APP_FARCASTER_DOMAIN`: Your Vercel domain (e.g., `your-project.vercel.app`)
   - `REACT_APP_FARCASTER_SIWE_URI`: `https://your-project.vercel.app/login`
4. Click "Save".
5. Go to "Deployments" tab and click "Redeploy" on your latest deployment.

## Troubleshooting Common Issues

### Issue 1: API Routes Not Working

**Symptom**: Front-end loads but API calls return 404 errors.
**Fix**: 
1. Check your `vercel.json` routes configuration.
2. Ensure your API functions are in the correct `/api` directory structure.
3. Check serverless function logs in the Vercel dashboard.

### Issue 2: MongoDB Connection Errors

**Symptom**: API calls fail with database connection errors.
**Fix**:
1. Verify your MongoDB connection string in Environment Variables.
2. Make sure your MongoDB Atlas IP allow list includes Vercel's IPs (or set to allow access from anywhere for testing).
3. Check if your MongoDB user has correct permissions.

### Issue 3: Build Fails

**Symptom**: Deployment fails during the build step.
**Fix**:
1. Check build logs in Vercel for specific errors.
2. Common issues include:
   - Missing dependencies: Ensure all dependencies are in package.json
   - Linting errors: Our `CI=false DISABLE_ESLINT_PLUGIN=true` flags should help
   - Path issues: Check for case-sensitivity in import paths

### Issue 4: Environment Variables Not Working

**Symptom**: App deploys but can't connect to APIs or services.
**Fix**:
1. Remember that changes to environment variables require a redeployment.
2. Verify that all variables are correctly set in Vercel's Environment Variables panel.
3. Check if your React app is accessing variables using the correct prefix (`REACT_APP_`).

## Viewing Deployment Logs

To debug deployment issues:

1. Go to your project in the Vercel dashboard.
2. Click on the latest deployment.
3. Click on "View Build Logs" or "Functions Logs" to see detailed information.
4. For API function logs, you can also go to "Settings" > "Functions" > "Logs".

## Need Additional Help?

If you continue to have deployment issues:

1. Check for specific error messages in the Vercel dashboard logs.
2. Use the built-in Vercel troubleshooting tools under "Settings" > "Troubleshooting".
3. Try deploying a simplified version of your app to isolate the issue.

---

Following this guide should help you successfully deploy your GALL3RY app to Vercel. If you encounter persistent issues, check the Vercel documentation or contact Vercel support. 