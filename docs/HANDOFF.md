# NFTree / Garden Battles Handoff

## Source Inputs

- Current NFTree landing/mint local source: `nftree_landing`
- Recovered Garden Battles archive: `TreeNft-main.zip`
- Target GitHub repo: `TheCryptoArborist/gardenbattles`

## Why This Repo Is Combined

NFTree minting and Garden Battles are intended to share the same public Netlify site/domain. Two separate Git deploy sources should not both own the same subdomain because a deploy from one can overwrite or route-break the other.

This repo keeps the two surfaces separate in code while putting them under one deployment source.

## Current Mint/Landing App

Path: `apps/nftree-mint`

Known routes:

- `/`
- `/mint`
- `/api/nftree-listings`
- `/api/nftree-sale-pools`

The app currently preserves the NFTree landing/shop behavior. Netlify config at the repository root points here first to avoid breaking the live mint surface.

## Recovered Garden Battles App

Path: `apps/garden-battles`

Contains:

- React/Vite frontend
- Express/Socket.IO server
- Sui Move packages
- NFT admin/mint scripts
- Attached assets and recovered notes

Primary Move package copy:

- `contracts/garden-battles`
- `apps/garden-battles/sui_contract`

## Required Before Production Switch

- Recreate Netlify environment variables manually. Secret values do not transfer through GitHub.
- Confirm `apps/nftree-mint` build and API functions.
- Confirm Garden Battles build and runtime path.
- Integrate `/battle` routing intentionally.
- Verify contract/package/config IDs used by the frontend before production.

## Do Not Include

- Private keys
- Seed phrases
- Telegram bot tokens
- Netlify auth tokens
- Sui private keys
- Any `.env` files with secret values
