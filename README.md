# TreeNft / The Garden Battles

Full setup and usage guide for this repository.

This project combines:

- A Sui Move smart contract package for battle logic
- A React + Vite frontend
- An Express + Socket.IO backend relay/API
- Optional Drizzle schema tooling
- NFT admin/mint scripts

## 1) What Is In This Repo

- `battle-gardenfrontend/`: React app (UI, wallet flow, battle pages)
- `server/`: Express server + Socket.IO + Sui event polling relay
- `shared/`: Shared TypeScript schema/types
- `scripts/`: NFT admin/mint CLI tools
- `sui_contract/`: Main Sui Move package used by the battle app
- `sources/` + top-level `Move.toml`: additional Move package files in repo root

For battle deployment and app integration, use `sui_contract/` as the primary Move package.

## 2) Prerequisites

Install these first:

1. Node.js 20+ (LTS recommended)
2. npm 10+
3. Sui CLI
4. A funded wallet on the target Sui network (testnet or mainnet)

Useful checks:

```bash
node -v
npm -v
sui --version
```

## 3) Install Dependencies

From the repository root:

```bash
npm install
```

Install script-tool dependencies (separate package):

```bash
npm --prefix scripts install
```

## 4) Environment Setup

### Required For Development Server

No required env var for basic local run.

- `PORT` is optional (defaults to `5000`)

### Useful Runtime Vars For Test Deploys

```bash
# Backend battle event source
export SUI_RPC_URL=https://fullnode.testnet.sui.io:443
export BATTLE_PACKAGE_ID=0x...
export BATTLE_MODULE=battle

# Frontend (only needed when frontend is hosted separately from backend)
export VITE_RELAY_URL=https://your-backend-host.example.com
```

### Required For NFT CLI And On-Chain Admin Scripts

Set these in your shell (or your preferred env management flow):

```bash
# Network / RPC
export SUI_NETWORK=testnet
export SUI_RPC_URL=https://fullnode.testnet.sui.io:443

# Signer (use one)
export SUI_PRIVATE_KEY=suiprivkey...
# or
export PRIVATE_KEY=...

# Contract IDs
export PACKAGE_ID=0x...
export COLLECTION_PACKAGE_ID=0x...
export MINT_CAP_ID=0x...
export BATTLE_PACKAGE_ID=0x...
export CONFIG_ID=0x...

# Admin / treasury
export TREASURY_ADDRESS=0x...

# Optional Pinata for metadata upload mode
export PINATA_JWT=...
export PINATA_GATEWAY=ipfs://
```

Notes:

- Runtime server currently uses in-memory storage (`server/storage.ts`), so `DATABASE_URL` is not required for `npm run dev`.
- `DATABASE_URL` is required only when running Drizzle commands such as `npm run db:push`.

## 5) Local Development

Run the app:

```bash
npm run dev
```

Open:

- `http://localhost:5000`

How dev mode works:

- Express server starts on port `5000` (or `PORT`)
- Vite runs in middleware mode inside the server process
- Socket.IO and `/api` endpoints are served by the same backend

Health endpoint:

- `GET /api/health`

## 6) Build And Run Production

Build frontend + server bundle:

```bash
npm run build
```

Start production server:

```bash
npm run start
```

Type-check:

```bash
npm run check
```

## 7) Smart Contract Setup (Sui)

Main contract package is in `sui_contract/`.

### Build

```bash
cd sui_contract
sui move build
```

### Publish

```bash
sui client publish --gas-budget 100000000
```

Save the IDs from publish output:

- `PACKAGE_ID`
- `CONFIG_ID`
- `QUEUE_ID`

### Update App Config After Publish

Update values in:

- `battle-gardenfrontend/src/lib/sui-config.ts`
  - `NETWORK`, `RPC_URL`, `WS_URL`
  - `PACKAGE_ID`, `CONFIG_ID`, `MATCHMAKING_QUEUE_ID`
  - `COLLECTION_PACKAGE_ID`, `COLLECTION_MINT_CONFIG_ID` if relevant
- `server/routes.ts`
  - `SUI_RPC_URL`
  - `PACKAGE_ID`
  - `MODULE` (currently `battle`)

If these values are out of sync, frontend, server relay, and chain events will not line up.

## 8) NFT CLI Workflows

The root package exposes helper commands that run scripts in `scripts/`.

### Show CLI Help

```bash
npm run nft:cli -- help
```

### Prepare Mint Manifest

```bash
npm run nft:prepare -- \
  --mode existing-cid \
  --start 1 \
  --end 100 \
  --name-prefix "Tree Nft #" \
  --description "TreeNft Collection" \
  --image-base-uri ipfs://<CID> \
  --recipient 0x... \
  --price-sui 25 \
  --out ./scripts/manifests/mainnet.json
```

### Mint From Manifest

```bash
npm run nft:mint -- \
  --network mainnet \
  --manifest ./scripts/manifests/mainnet.json \
  --package-id 0x... \
  --mint-cap-id 0x... \
  --batch-size 100 \
  --state-file ./scripts/manifests/mainnet.state.json
```

### Verify Minted Events

```bash
npm run nft:verify -- \
  --network mainnet \
  --manifest ./scripts/manifests/mainnet.json \
  --package-id 0x...
```

### Treasury / Whitelist / Preflight

```bash
npm run nft:set-treasury -- --network mainnet --battle-package-id 0x... --config-id 0x... --treasury-address 0x...
npm run nft:sync-whitelist -- --network mainnet --battle-package-id 0x... --config-id 0x... --collection-type 0x...::collection::Nft
npm run nft:preflight -- --network mainnet --package-id 0x... --mint-cap-id 0x... --battle-package-id 0x... --config-id 0x...
```

## 9) Optional Database Workflow (Drizzle)

If you want to push the schema:

1. Set `DATABASE_URL`
2. Run:

```bash
npm run db:push
```

Schema source: `shared/schema.ts`
Drizzle config: `drizzle.config.ts`

## 10) Common Troubleshooting

### App starts but battle updates do not appear

- Confirm `PACKAGE_ID` and `MODULE` match deployed contract event type
- Confirm both frontend config and server route config were updated
- Confirm RPC URL points to the same network as deployed package

### NFT CLI fails with signer/private key errors

- Set `SUI_PRIVATE_KEY` (or `PRIVATE_KEY`)
- Ensure key format is valid (`suiprivkey...` or supported hex)

### Mint or admin transactions fail

- Run `npm run nft:preflight -- ...` first
- Confirm object IDs exist on selected network
- Ensure signer has enough gas balance

### `npm run db:push` fails

- Set `DATABASE_URL`
- Verify Postgres instance is reachable

### Production start fails with missing build output

- Run `npm run build` before `npm run start`

## 11) Recommended First-Time Setup Checklist

1. Install prerequisites (Node, npm, Sui CLI)
2. Run `npm install` and `npm --prefix scripts install`
3. Run `npm run dev` and verify `http://localhost:5000`
4. Build and publish `sui_contract/` package
5. Update chain IDs in frontend + server config
6. Run NFT preflight before any mainnet action
7. Test battle flow with two wallets on the same network

## 12) Useful Project Commands (Quick Reference)

```bash
# App
npm run dev
npm run build
npm run start
npm run check

# DB
npm run db:push

# NFT Scripts
npm run nft:cli -- help
npm run nft:prepare -- <args>
npm run nft:mint -- <args>
npm run nft:verify -- <args>
npm run nft:set-treasury -- <args>
npm run nft:sync-whitelist -- <args>
npm run nft:preflight -- <args>
```

## 13) Testing Deployment Runbook

### Option A (Recommended): Deploy As One Node Service

This is the simplest setup for testing because frontend + API + Socket.IO stay on the same origin.

1. Deploy Move contract to testnet:

```bash
cd sui_contract
sui move build
sui client publish --gas-budget 100000000
```

2. Copy `PACKAGE_ID`, `CONFIG_ID`, and `QUEUE_ID` from the publish output.
3. Update frontend config in `battle-gardenfrontend/src/lib/sui-config.ts`.
4. Deploy app on Render/Railway/Fly (single service):
  - Build command: `npm install && npm run build`
  - Start command: `npm run start`
  - Node version: `20`
  - Environment variables:
    - `SUI_RPC_URL=https://fullnode.testnet.sui.io:443`
    - `BATTLE_PACKAGE_ID=0x...`
    - `BATTLE_MODULE=battle`
    - `PORT` (usually provided by host)
5. Verify:
  - Open app URL
  - Check `/api/health`
  - Connect two wallets and start a battle

### Option B: Netlify Frontend + Separate Backend

Use this only if you specifically want Netlify for the UI.

1. Deploy backend to Render/Railway/Fly using the same settings from Option A.
2. In Netlify, set build config:
  - Base directory: repository root
  - Build command: `npm run build`
  - Publish directory: `dist/public`
3. In Netlify environment variables, set:

```bash
VITE_RELAY_URL=https://your-backend-host.example.com
```

4. Redeploy Netlify site.
5. Verify browser network calls:
  - Socket connects to `https://your-backend-host.example.com/socket.io`
  - API call goes to `https://your-backend-host.example.com/api/battle/state/:address`

---

If you want, the next iteration can add:

- A copy-paste `.env.example`
- A network-specific deployment matrix (testnet/mainnet values)
- A release checklist for production deploys