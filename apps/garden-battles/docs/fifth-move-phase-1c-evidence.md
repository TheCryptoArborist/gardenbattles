# Fifth Move Phase 1C Evidence Report

Phase 1C is read-only evidence acquisition. Fifth Move remains inactive. No Move contracts, package IDs, queue IDs, transaction paths, or runtime provider qualification states were changed.

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

Providers that remain unverified were retained as `unavailable`.

| Metric | Count |
| --- | ---: |
| Wallets checked | 29 |
| Qualified at 1,000,000 TREE | 0 |
| Not-qualified with every source verified | 0 |
| Verification-incomplete | 1 |
| Unavailable | 28 |
| Qualified through V2 direct LP | 0 |
| Wallets with any direct V2 LP source data | 1 |
| Qualified through V2 farm | 0 |
| Qualified through V3 | 0 |
| Qualified through Moonbags | 0 |
| Qualified through combined sources | 0 |
| Median verified underlying TREE raw | 0 |

Threshold distribution:

| Threshold | Wallets at or above |
| --- | ---: |
| 500,000 TREE | 0 |
| 1,000,000 TREE | 0 |
| 2,500,000 TREE | 0 |
| 5,000,000 TREE | 0 |

## Evidence Matrix

| Provider | Identifier | Value | Source | Verification Method | Verified Object / Transaction | Confidence | Runtime Detector Ready | Remaining Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SuiDex V2 direct LP | Pool ID | `0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc` | Existing app config / Sui object | Read-only `getObject`, type `pair::Pair<SUI,TREE>` | Pool object | High | Yes | None for direct wallet LP |
| SuiDex V2 direct LP | LP coin type | `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, TREE>` | V2 pool field/type | Read-only pool fields and wallet `getCoins` | Pool object and wallet coin objects | High | Yes | None for direct wallet LP |
| SuiDex V2 farm | Farm object / receipt type | Unknown | No public fixture supplied/found | Not verified | None | Low | No | Need real TREE V2 farm transaction or receipt/account object |
| SuiDex V3 | Pool ID | `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf` | Existing app config / Sui object | Read-only `getObject`, type `pool::Pool<SUI,TREE>`, TREE is `type_y` | Pool object | High for pool only | No | Need real owned TREE V3 position object or add-liquidity transaction |
| SuiDex V3 | Position object type | Unknown | No public fixture supplied/found | Not verified | None | Low | No | Need owner, pool field, liquidity, tick bounds, closed/zero representation |
| Moonbags staking | Package / pool / stake type | Unknown | No public fixture supplied/found | Not verified | None | Low | No | Need real active TREE stake object or transaction relationship |
| NFTree holder census | Holder discovery | Sui GraphQL object query by canonical NFTree type | TreeDrop snapshot logic | GraphQL object type query plus owner-chain resolution | Snapshot output `nftree-holder-wallets-20260715180235` | Medium | Yes for census input | 67 unresolved object/shared owner entries and total-accounting mismatch need follow-up |

## Provider Diagnostics

Diagnostic scripts exist for real public fixtures:

```powershell
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v2-farm.ts --wallet <wallet> --digest <tx_digest> --receipt-object-id <object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v3-position.ts --wallet <wallet> --digest <tx_digest> --object-id <position_object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-moonbags-tree-stake.ts --wallet <wallet> --digest <tx_digest> --stake-object-id <object_id>
```

No V2 farm, V3 position, or Moonbags stake public fixture was supplied in this checkpoint, so those diagnostics were not run against provider positions.

## Remaining Evidence Required

- SuiDex V2 farm package ID, farm object ID, and receipt/account object fields.
- Real SuiDex V3 TREE position object or add-liquidity transaction.
- Moonbags TREE staking package/pool/stake object or staking transaction.
- Follow-up for unresolved shared/object-owned NFTree entries and historical total accounting mismatch.
