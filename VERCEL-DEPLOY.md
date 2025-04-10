# Deploying GALL3RY to Vercel

Follow these steps to successfully deploy the GALL3RY NFT app to Vercel:

## 1. Connect your repository

1. Log in to your Vercel account
2. Click on "Add New" > "Project" 
3. Import your GitHub repository
4. Select the GALL3RY repository

## 2. Configure project

In the configuration screen:

1. **Framework Preset**: Select "Create React App"
2. **Build Command**: `npm run vercel-build`
3. **Output Directory**: `build`

## 3. Environment Variables

Add the following environment variables exactly as shown in your `vercel-env-setup.txt` file:

```
REACT_APP_ALCHEMY_ETH_API_KEY=-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak
REACT_APP_ALCHEMY_BASE_API_KEY=-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak
REACT_APP_ZAPPER_API_KEY=0b615d5f-ef05-42fb-95d3-a5e180d316cf
ZAPPER_API_KEY=0b615d5f-ef05-42fb-95d3-a5e180d316cf
REACT_APP_NEYNAR_API_KEY=04502D2A-A2F1-4682-8035-91C77FEEACE3
REACT_APP_FARCASTER_DOMAIN=gall3ry.vercel.app
REACT_APP_FARCASTER_SIWE_URI=https://gall3ry.vercel.app/login
REACT_APP_OPTIMISM_RPC_URL=https://mainnet.optimism.io
MONGODB_URI=mongodb+srv://svvvg3x:MIsfHKAkx2TVJGyR@gall3ry.jiju7vt.mongodb.net/?retryWrites=true&w=majority&appName=GALL3RY
```

**Important**: After the first deployment, update the domain variables if necessary:
- If using a custom domain, update `REACT_APP_FARCASTER_DOMAIN` and `REACT_APP_FARCASTER_SIWE_URI` with your domain
- If using Vercel's domain, update with the actual deployment URL (e.g., `gall3ry-xyz.vercel.app`)

## 4. Deploy

Click "Deploy" and wait for the build to complete.

## Troubleshooting

If you encounter issues:

1. **Build Errors**: Check the build logs in Vercel
2. **Connection Errors**: Verify MongoDB connection string
3. **API Errors**: Check API keys and ensure they are correctly set
4. **CORS Issues**: Verify your domain settings in the Farcaster configuration

## Redeployment

After making changes to your code:
1. Push changes to your repository
2. Vercel will automatically redeploy
3. To trigger a manual redeploy, go to your project in Vercel and click "Redeploy" 