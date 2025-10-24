# Sui NFT Battle Garden

A blockchain-based NFT battle game built on the Sui network where players battle their Sapling NFTs in strategic turn-based combat.

## Project Overview

**Purpose:** Enable Sapling NFT holders to engage in 1v1 battles where their NFTs grow from seed to full tree as they gain Growth points.

**Tech Stack:**
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS with custom green (#00ff00) theme
- **Blockchain:** Sui mainnet with @mysten/sui.js, @mysten/dapp-kit
- **Routing:** Wouter for SPA client-side routing
- **Deployment:** Netlify (configured)

## Recent Changes

**2025-10-24:** Fixed critical bugs and image loading
- **FIXED**: Copied all assets from `public/assets/` to `client/public/assets/` for Vite compatibility
- **FIXED**: NFT scanning infinite loop by replacing `isJoining` state with `hasScanned` flag
- **FIXED**: All images now loading (backgrounds, logos, NFT evolution stages)
- **VERIFIED**: Wallet configured with `preferredWallets={['Sui Wallet']}` to prioritize Sui Wallet
- **VERIFIED**: All scrolling content visible on both Home and Battle pages
- Added hover effects (scale 1.05) to NFT cards for visual feedback

**2025-01-24:** Complete implementation with exact design matching
- Fixed Battle page to match exact screenshot layout (red-bordered NFT cards with dark gradient backgrounds)
- Fixed Home page with navigation to Arboretum (TREE token site)
- Audited and verified Sui Move smart contract - APPROVED FOR DEPLOYMENT
- Implemented proper @mysten/dapp-kit wallet integration
- Removed all emoji usage and replaced with proper lucide-react icons
- Added NFT auto-detection and auto-join battle queue functionality

## Project Architecture

### Frontend Structure
```
client/src/
├── components/
│   ├── Header.tsx           # Navigation with wallet connect button
│   ├── Footer.tsx           # Footer with sponsor link
│   ├── BattleDialog.tsx     # Modal dialog for messages
│   └── WaitingOverlay.tsx   # Opponent waiting screen
├── pages/
│   ├── Home.tsx            # Landing page with navigation and info
│   ├── Battle.tsx          # Battle arena with NFT cards
│   └── not-found.tsx       # 404 page
├── hooks/
│   └── useSuiWallet.tsx    # Sui wallet integration hook
├── lib/
│   ├── sui-config.ts       # Blockchain configuration
│   └── queryClient.ts      # React Query setup
└── App.tsx                 # Main app with routing and providers
```

### Key Features

1. **Sui Wallet Integration**
   - @mysten/dapp-kit with ConnectButton
   - useSignAndExecuteTransaction for transaction signing
   - Detects Sapling NFTs in user wallets and kiosks
   - Auto-joins battle queue when NFT detected

2. **Battle System**
   - Matchmaking queue with 3 SUI entry fee
   - Real-time battle state updates via WebSocket events
   - Turn-based ability system with 30 unique moves
   - Dynamic NFT visualization (4 growth stages)
   - Winner receives 5 SUI

3. **NFT Growth Visualization**
   - Seed (0-25 Growth): `/assets/seed.jpg`
   - Sapling (26-50 Growth): `/assets/sapling.jpg`
   - Mature Sapling (51-75 Growth): `/assets/sapling2.jpg`
   - Full Tree (76-100 Growth): `/assets/full_tree.jpg`

### Design System

**Color Palette:**
- Primary Green: #00ff00 (borders, glows, primary actions)
- Secondary Green: #00cc00 (hover states)
- Accent Cyan: #00ffcc (info text)
- Red: #ff0000 (player card borders)
- Dark Red: #8B0000 (opponent card borders)
- Dark Background: rgba(0, 50, 0, 0.5) (panels)
- Black: #000 (base background)

**Typography:**
- Font Family: 'Orbitron' (Google Fonts)
- Weights: 400 (regular), 700 (bold)

**NFT Card Design:**
- Red gradient bordered frames (4px solid border)
- Dark inner panel with nested image
- Green health bars with glow effect
- Trophy icon for winners (lucide-react)

### Sui Blockchain Configuration

**Network:** Sui Mainnet
**RPC:** https://fullnode.mainnet.sui.io:443

**Smart Contract:**
- Package ID: `0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80`
- Module: `battle_garden`
- Config ID: `0x06c2b903bf9f805d8882e686d504a09593740deb2bc1a39eb67378e44089c749`
- Matchmaking Queue: `0x33bdce1ff2ba8a655e3601975f59808a1bcf4b3259bc9e7bbea79e91a50c37b4`
- Sapling NFT Type: `0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80::battle_garden::SaplingNFT`

**Battle Mechanics:**
- Entry Fee: 3 SUI (3,000,000,000 MIST)
- Winner Reward: 5 SUI
- Treasury Share: 1 SUI
- Target Growth: 100 points to win

**Contract Status:**  
✅ **AUDITED AND APPROVED FOR DEPLOYMENT**  
See `sui_contract/CONTRACT_AUDIT.md` for full audit report

### Routes

- `/` - Landing page with navigation to Arboretum and battle info
- `/battle` - Battle arena for active gameplay

### Assets

All game assets located in `public/assets/`:
- Background images: background4.jpg, background1.jpg, backgrounda.jpg
- NFT growth stages: seed.jpg, sapling.jpg, sapling2.jpg, full_tree.jpg
- Logo: tree.jpg (circular logo)

### Deployment

**Platform:** Netlify
**Build Command:** `npm run build`
**Publish Directory:** `dist/public`
**Node Version:** 20

Configuration files:
- `netlify.toml` - Netlify build settings and headers
- `public/_redirects` - SPA routing redirects
- `DEPLOYMENT.md` - Comprehensive deployment guide
- `sui_contract/` - Smart contract source and audit report

### Development

**Start Development Server:**
```bash
npm run dev
```

**Build for Production:**
```bash
npm run build
```

**Type Checking:**
```bash
npm run check
```

**Deploy Smart Contract:**
```bash
cd sui_contract
sui move build
sui client publish --gas-budget 100000000
```

### User Preferences

No specific user preferences have been set yet.

### Technical Decisions

1. **Single Page Application:** Uses wouter for client-side routing
2. **Real-time Updates:** WebSocket event subscription for live battle state
3. **Wallet Integration:** @mysten/dapp-kit for modern wallet standard support
4. **Asset Strategy:** All assets in public folder for Netlify CDN optimization
5. **Green Theme:** Exact color matching (#00ff00) for brand consistency
6. **Responsive Design:** Mobile-first approach with breakpoints
7. **No Emojis:** All icons from lucide-react library
8. **NFT Card Design:** Red gradient borders matching original screenshots

### Testing Notes

The application requires a Sui wallet extension to be installed in the browser. Users must have:
- A Sui wallet extension (Sui Wallet, Suiet, etc.)
- At least 3 SUI for battle entry fees
- A Sapling NFT from the deployed contract

### Known Limitations

1. NFT scanning requires actual Sapling NFTs from the specific contract
2. Battle queue requires at least 2 players to be online simultaneously
3. Wallet connection requires browser extension (no mobile wallet support yet)

### Contract Audit Summary

✅ **Security:** All access controls, economic safeguards, and fund safety mechanisms verified
✅ **Game Logic:** Battle mechanics, move generation, and win conditions working correctly
✅ **Code Quality:** Proper error handling, type safety, and gas optimization
✅ **Economics:** Balanced model verified (6 SUI in, 5 SUI to winner, 1 SUI to treasury)

See `sui_contract/CONTRACT_AUDIT.md` for complete audit report.

### Future Enhancements (Phase 2 - Q4 2025)

- The Arboretum expansion
- Dynamic NFT utility system
- Enhanced battle mechanics
- Leaderboard and ranking system
- Tournament mode
