# Deploying to Vercel

Since we're facing some challenges with the CLI deployment, here's how to deploy directly from GitHub through the Vercel dashboard:

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import your GitHub repository (https://github.com/SVVVG3/GALL3RY)
4. Configure the project with these settings:
   - **Framework Preset**: Create React App
   - **Build Command**: CI=false npm run build
   - **Output Directory**: build
   - **Install Command**: npm install

5. Add these Environment Variables:
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

6. Click "Deploy"

After deployment:
1. Your app will be available at a URL like `gall3ry.vercel.app`
2. You can add a custom domain in the project settings if needed

## Troubleshooting

If the deployment fails:
1. Check the build logs in Vercel for specific errors
2. You may need to adjust the Build Command to `CI=false npm run build` to ignore warnings during build
3. Make sure all dependencies are correctly specified in package.json
4. If node version issues persist, specify a Node.js version in the Project Settings → Environment Variables: `NODE_VERSION=16.x` 