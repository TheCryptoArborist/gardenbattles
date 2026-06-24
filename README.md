# NFTree / Garden Battles

Unified source handoff for the NFTree landing/mint surface and the recovered Garden Battles game source.

## Repository Layout

- `apps/nftree-mint/` - current NFTree landing, shop, wallet header, TradePort listings API, and sale-pool API used for `https://nftree.net`.
- `apps/garden-battles/` - recovered Garden Battles source from `TreeNft-main.zip`, including frontend, server, scripts, and Sui Move packages.
- `contracts/garden-battles/` - convenience copy of the primary Garden Battles Sui Move package from `apps/garden-battles/sui_contract/`.
- `docs/` - operator notes and migration handoffs.

## Netlify Status

The root `netlify.toml` is intentionally pointed at `apps/nftree-mint` so a Git-connected deploy preserves the current NFTree landing/mint surface first.

Garden Battles source is present, but `/battle` still needs a build/routing integration pass before the Netlify site should rely on this repo for the live game route.

## Current Production Target

- Production URL: `https://nftree.net`
- Netlify project: `treenft`
- Netlify site ID: `4d62f7a3-d5c0-4808-a01e-d00b6e232d88`

## Immediate Next Steps

1. Verify the mint app from `apps/nftree-mint`.
2. Verify the recovered Garden Battles app from `apps/garden-battles`.
3. Decide whether `/battle` should be built into the mint app, copied into the mint public output, or served by a unified router build.
4. Recreate Netlify environment variables manually before switching production deploy source.
5. Only then point the `treenft` Netlify project at this repository.
