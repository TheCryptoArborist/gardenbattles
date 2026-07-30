# Fifth Move Phase 1C Evidence Report

Phase 1C is read-only evidence acquisition. Fifth Move remains inactive. No Move contracts, package IDs, queue IDs, transaction paths, or battle mechanics were changed.

This checkpoint verified the canonical SuiDex V3 TREE position shape and bigint principal math well enough to enable the server-side read-only V3 eligibility provider. A follow-up read-only checkpoint resolved SuiDex V2 farmed LP principal through GraphQL object fields and event history. SuiDex V2 direct LP, SuiDex V2 farmed LP, and SuiDex V3 principal are now supported read-only.

Phase 1D later verified Moonbags TREE staking and enabled principal-only runtime detection. See `apps/garden-battles/docs/fifth-move-phase-1d-moonbags-evidence.md`.

## NFTree Holder Snapshot Logic

The existing TreeDrop holder snapshot logic is in:

- `D:\Finance\Crypto\Repos\nftgiftbag\netlify\functions\nftree-holder-snapshot\index.mts`
- `D:\Finance\Crypto\Repos\nftgiftbag\src\holderSnapshot.ts`

Method:

- Query Sui GraphQL for objects with canonical NFTree type:
  `0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT`
- Resolve `AddressOwner` directly to wallet addresses.
- Resolve `ObjectOwner` chains up to depth 3 to attribute kiosk/object-held NFTrees to wallet owners when possible.
- Treat shared/immutable/unsupported owner shapes as unresolved instead of assigning them to a wallet.
- Collapse duplicate owner wallets into holder groups.
- Exclude the TreeDrop project/admin wallet:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`

The Garden Battles adapter follows the same method in:

`apps/garden-battles/scripts/diagnostics/export-current-nftree-wallets.ts`

Output is local and gitignored under:

`apps/garden-battles/diagnostics-output/`

## Current Snapshot

Run time: `2026-07-15T18:02:35.794Z`

Local files:

- `diagnostics-output/nftree-holder-wallets-20260715180235.json`
- `diagnostics-output/nftree-holder-wallets-20260715180235.csv`

Counts:

| Metric | Count |
| --- | ---: |
| Holder-owned NFTrees | 92 |
| Unique owner wallets | 29 |
| Total resolved NFTrees before project-wallet exclusion | 102 |
| Direct wallet-owned NFTrees | 102 |
| Object/kiosk resolved NFTrees | 0 |
| Project wallet NFTrees excluded | 10 |
| Unresolved object/shared owner NFTrees | 67 |
| Total observed by GraphQL snapshot | 169 |

Unresolved reasons:

- Owner type `Shared` is not supported by the automatic snapshot source.
- Owner chain did not resolve to a direct wallet within max depth.

Historical June 22 comparison values were `87` holder-owned NFTrees, `28` unique owner wallets, `213` sale-pool NFTrees, and `300` total loaded/minted accounting. The current GraphQL method observes 169 objects, so it does not reconcile to the historical total. This difference is reported as evidence to investigate rather than forced into the census.

## Eligibility Census

Input: generated holder wallet CSV from the current snapshot.

Providers that remain unverified were retained as `unavailable`. The census was rerun after enabling the verified SuiDex V3 read-only provider.

| Metric | Count |
| --- | ---: |
| Wallets checked | 29 |
| Qualified at 1,000,000 TREE | 3 |
| Not-qualified with every source verified | 0 |
| Verification-incomplete | 26 |
| Unavailable | 0 |
| Wallets with positive SuiDex V2 source data | 1 |
| Wallets with positive SuiDex V3 source data | 4 |
| Qualified through V2 farm | 0 |
| Qualified through Moonbags | 0 |
| Qualified through combined sources | 0 |
| Median verified underlying TREE raw | 0 |

Threshold distribution:

| Threshold | Wallets at or above |
| --- | ---: |
| 500,000 TREE | 4 |
| 1,000,000 TREE | 3 |
| 2,500,000 TREE | 2 |
| 5,000,000 TREE | 2 |

## Evidence Matrix

| Provider | Identifier | Value | Source | Verification Method | Verified Object / Transaction | Confidence | Runtime Detector Ready | Remaining Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SuiDex V2 direct LP | Pool ID | `0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc` | Existing app config / Sui object | Read-only `getObject`, type `pair::Pair<SUI,TREE>` | Pool object | High | Yes | None for direct wallet LP |
| SuiDex V2 direct LP | LP coin type | `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, TREE>` | V2 pool field/type | Read-only pool fields and wallet `getCoins` | Pool object and wallet coin objects | High | Yes | None for direct wallet LP |
| SuiDex V2 farm | Staking position | `0x698c1e7aae8837b70210bb2d285d13a3d2a25f007ab71cc9fb75c382c324e9ef` | Fixture wallet object | GraphQL object read plus position-affecting transaction history | `farm::StakingPosition<...LPCoin<SUI,TREE>>` | High | Yes | None for principal-only read-only provider |
| SuiDex V2 farm | Current deposited LP principal | `94369282575` LP raw | Staking position `amount`, vault `amount`, vault `balance`, and event reconstruction | Deposits `22882886480 + 71486396095`, withdrawals `0` | Position and vault objects | High | Yes | Rewards excluded |
| SuiDex V2 farm | Fixture farmed underlying TREE | `571,330.672512 TREE` | Current V2 pool reserve/supply and farmed LP principal | `floor(94369282575 * 49293644613355 / 8142055208088)` | V2 pool object | High | Yes | None |
| SuiDex V3 | Pool ID | `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf` | Existing app config / Sui object | Read-only `getObject`, type `pool::Pool<SUI,TREE>`, TREE is `type_y` | Pool object | High | Yes | None for principal-only read-only provider |
| SuiDex V3 | Position object type | `0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position` | Fixture wallet object | Read-only owned object scan and field verification | `0xe68e034a6f2390eaa9caf2dce42b75e48ab6c408a64a722a2f92f8b3a92f31c3` | High | Yes | None for principal-only read-only provider |
| SuiDex V3 | Current pool state | current tick `35660`, sqrt price `109707448322793383515`, tick spacing `60` | Canonical V3 pool object | Read-only pool fields | Pool object | High | Yes | None |
| SuiDex V3 | Fixture position principal | `82,215,822.268196 TREE` | Fixture wallet position | Q64.64 tick math, floor rounding, TREE token Y | Position `0xe68e...31c3` | High | Yes | Fees and rewards excluded by design |
| Moonbags staking | Package / pool / stake type | Unknown | No public fixture supplied/found | Not verified | None | Low | No | Need real active TREE stake object or transaction relationship |
| NFTree holder census | Holder discovery | Sui GraphQL object query by canonical NFTree type | TreeDrop snapshot logic | GraphQL object type query plus owner-chain resolution | Snapshot output `nftree-holder-wallets-20260715180235` | Medium | Yes for census input | 67 unresolved object/shared owner entries and total-accounting mismatch need follow-up |

## Provider Diagnostics

Diagnostic scripts exist for real public fixtures:

```powershell
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v2-farm.ts --wallet <wallet> --digest <tx_digest> --receipt-object-id <object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v3-position.ts --wallet <wallet> --digest <tx_digest> --object-id <position_object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-moonbags-tree-stake.ts --wallet <wallet> --digest <tx_digest> --stake-object-id <object_id>
```

V2 farm and V3 diagnostics were run against the fixture wallet using public object and transaction data. Sanitized outputs are local and gitignored under `diagnostics-output/`. The V3 evidence was sufficient to enable principal-only detection. V2 farm principal was later resolved using Sui GraphQL object fields that expose `StakingPosition.amount` and matching `StakedTokenVault.amount` / `balance`.

## Remaining Evidence Required

- Moonbags TREE staking package/pool/stake object or staking transaction.
- Follow-up for unresolved shared/object-owned NFTree entries and historical total accounting mismatch.
