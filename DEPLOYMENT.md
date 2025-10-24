# Sui NFT Battle Garden - Deployment Guide

## Netlify Deployment

This application is optimized for deployment on Netlify.

### Prerequisites
- Node.js 20.x or higher
- A Netlify account
- Git repository connected to Netlify

### Quick Deploy to Netlify

1. **Connect Your Repository**
   - Log in to Netlify
   - Click "New site from Git"
   - Connect your GitHub/GitLab/Bitbucket repository

2. **Build Settings** (Auto-configured via netlify.toml)
   - Build command: `npm run build`
   - Publish directory: `dist/public`
   - Node version: 20

3. **Deploy**
   - Click "Deploy site"
   - Netlify will automatically build and deploy your application

### Environment Variables

No environment variables are required for the basic deployment. The Sui blockchain configuration is hardcoded for mainnet.

### Custom Domain (Optional)

1. Go to your site settings in Netlify
2. Click "Domain management"
3. Add your custom domain
4. Follow Netlify's DNS configuration instructions

### Asset Optimization

All assets are stored in `/public/assets/` and are automatically copied during the build process:
- NFT growth stage images (seed.jpg, sapling.jpg, sapling2.jpg, full_tree.jpg)
- Background images (background4.jpg, background1.jpg, backgrounda.jpg)
- Logo/branding assets

### SPA Routing

The application uses client-side routing with wouter. The `_redirects` file and netlify.toml configuration ensure all routes are properly handled:
- `/` - Landing page
- `/battle` - Battle arena

### Sui Wallet Integration

Users must have a Sui wallet extension installed (Sui Wallet, Suiet, etc.) to:
- Connect their wallet
- Detect Sapling NFTs
- Join battles and execute transactions

### Build Output

The build process creates:
- Optimized JavaScript bundles with code splitting
- Minified CSS with Tailwind
- Compressed assets
- Static HTML files

### Troubleshooting

**Build fails:**
- Ensure Node.js version is 20.x or higher
- Check that all dependencies are installed: `npm install`
- Verify package-lock.json is committed

**Assets not loading:**
- Verify assets are in `/public/assets/` directory
- Check browser console for 404 errors
- Ensure relative paths start with `/assets/` not `./assets/`

**Wallet won't connect:**
- Ensure user has a Sui wallet extension installed
- Check browser console for wallet-related errors
- Verify the wallet supports Sui mainnet

### Performance

The application is optimized for performance:
- Code splitting for Sui libraries and React vendor packages
- Lazy loading of routes
- Optimized images
- Minimal bundle size with tree shaking

### Security

- Content Security Policy headers configured
- X-Frame-Options set to DENY
- X-Content-Type-Options set to nosniff
- Referrer-Policy configured

For more information, visit [Netlify Documentation](https://docs.netlify.com/)
