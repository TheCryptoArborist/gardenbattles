# Fifth Move Underlying TREE Design

Phase 1 and Phase 1B are read-only verification and architecture design. Fifth Move is not active, no Move contract changes are included, and no transaction path is created here.

## Locked Product Rules

- NFTree ownership grants Garden Battles access only. It does not qualify Fifth Move.
- Fifth Move qualification requires at least `1,000,000` underlying TREE.
- Qualification is measured in TREE units, never USD.
- Liquid wallet TREE, unclaimed rewards, pending fees, unrelated pools, zero-liquidity positions, closed positions, withdrawn stakes, project treasury locks, and NFTree ownership are excluded.
- A wallet may combine SuiDex V2, SuiDex V3, and Moonbags TREE staking sources.
- Multiple qualifying sources still unlock exactly one additional move.
- Eligibility must be verified before queue entry, then frozen for that queue entry and battle.

## Verified TREE Metadata

Read-only method used: `SuiClient.getCoinMetadata` against Sui mainnet fullnode.

Canonical TREE coin type:

`0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`

Verified metadata:

| Field | Value |
| --- | --- |
| symbol | `Tree` |
| decimals | `6` |
| metadata object | `0xe4dcc3ff58d2069c18b024fb69c925abb95748dbeb16a99258e1d3433c140902` |

Threshold:

`1,000,000 TREE * 10^6 = 1,000,000,000,000 raw TREE`

All qualification math uses `bigint`.

## Identifier Source Table

| Identifier | Value | Source | Verification Method | Confidence | Used Now |
| --- | --- | --- | --- | --- | --- |
| TREE coin type | `0x6c5a...::tree::TREE` | Existing app config and Sui metadata | `getCoinMetadata` returned symbol `Tree`, decimals `6` | High | Yes |
| SuiDex V2 TREE pool | `0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc` | Existing Tree Power constants | `getObject` type is `pair::Pair<SUI,TREE>` | High | Yes |
| SuiDex V2 paired coin | `0x2::sui::SUI` | V2 pool object type | `getObject` type parameters | High | Yes |
| SuiDex V2 LP coin type | `0xbfac...::pair::LPCoin<SUI,TREE>` | V2 pool `lp_supply` type | `getObject` field type | High for direct wallet LP | Yes |
| SuiDex V2 TREE reserve | `reserve1` / `balance1` | V2 pool fields | `getObject` fields | High | Yes |
| SuiDex V2 total LP supply | `total_supply` / `lp_supply.fields.value` | V2 pool fields | `getObject` fields | High | Yes |
| SuiDex V2 farm ID | Unknown | Not found in repo | Needs verified farm object or example staked LP receipt | Low | No |
| SuiDex V2 farm position type | Unknown | Not found in repo | Needs real staked LP position object | Low | No |
| SuiDex V3 TREE pool | `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf` | Existing Tree Power constants | `getObject` type is `pool::Pool<SUI,TREE>` | High | No runtime count yet |
| SuiDex V3 token ordering | TREE is `type_y` / token 1 | V3 pool fields | `type_y.fields.name` equals TREE type without `0x` | High | Design/tests only |
| SuiDex V3 current sqrt price | `sqrt_price` field | V3 pool fields | `getObject` fields | Medium | Design/tests only |
| SuiDex V3 current tick | `tick_index.fields.bits` | V3 pool fields | `getObject` fields | Medium | Design/tests only |
| SuiDex V3 tick spacing | `tick_spacing` | V3 pool fields | `getObject` fields | Medium | Design/tests only |
| SuiDex V3 position type | Unknown | Not found in repo | Needs owned position object example | Low | No |
| Moonbags TREE staking package | Unknown | Not found in repo | Needs on-chain stake object/digest or documented API | Low | No |
| Moonbags TREE staking pool | Unknown | Not found in repo | Needs on-chain pool/registry | Low | No |
| Moonbags stake position type | Unknown | Not found in repo | Needs active TREE stake object | Low | No |

## SuiDex V2 Underlying TREE

For verified direct-wallet V2 LP:

```text
underlying_tree_raw =
  floor(player_lp_raw * pool_tree_reserve_raw / total_lp_supply_raw)
```

Current implementation counts direct wallet LP coins only because that representation is verified from the LP coin type. Farmed LP is intentionally unavailable until the farm ID and receipt shape are verified. A missing or unreadable farm representation is not treated as zero.

Phase 1B added deterministic farmed-LP candidate math:

- farm ID must match the canonical TREE farm ID
- active, non-withdrawn LP principal only
- unrelated farms, zero deposits, withdrawn receipts, and rewards are excluded
- direct LP and farmed LP aggregate before the V2 pool reserve formula

Runtime farm detection remains disabled because the canonical TREE farm object ID and receipt/account object shape have not been verified from public Sui objects.

## SuiDex V3 Underlying TREE

The repository now includes pure integer fixture math for concentrated liquidity:

- below range: position represented entirely by token 0
- in range: token 0 and token 1 split by current sqrt price
- above range: position represented entirely by token 1
- TREE token ordering is respected
- zero liquidity and closed positions return zero

Runtime V3 verification is still unavailable because no canonical owned position object type or closed-position representation has been verified. The live pool is verified, but the wallet position object layout is not.

Phase 1B added deterministic V3 position candidate aggregation for verified position fixtures:

- filters positions to the canonical pool
- uses current pool sqrt price and position lower/upper sqrt prices
- counts principal only, not fees or rewards
- closed and zero-liquidity positions contribute zero
- below range, in range, and above range are covered by bigint tests

Runtime V3 detection remains disabled until a real TREE V3 owned position object or add-liquidity transaction verifies the position type, owner field, pool field, liquidity field, and lower/upper tick or price representation.

Before enabling runtime V3 counting, verify:

- owned position object type
- owner representation
- liquidity field
- lower/upper tick fields
- closed-position marker
- fee fields versus principal fields
- official SuiDex math or source implementation alignment

## Moonbags TREE Staking

Moonbags cannot be counted yet. Needed evidence:

- Moonbags staking package ID
- TREE staking pool or registry object
- active stake position/receipt object type
- owner representation
- active staked principal field
- withdrawn/inactive marker
- evidence that Token Lock and treasury locks are excluded

Until then, Moonbags status remains `unavailable`, not zero.

Phase 1B added deterministic Moonbags candidate filtering for future verified stake fixtures:

- active TREE principal only
- wallet owner and canonical TREE coin type must match
- rewards are ignored
- withdrawn stakes, zero stakes, unrelated tokens, generic Token Lock records, and project treasury locks are excluded

Runtime Moonbags detection remains disabled because no Moonbags TREE staking package ID, pool/registry ID, or stake position/account object shape has been verified from public Sui objects.

## Read-Only Diagnostics

Local diagnostic scripts were added for collecting public evidence before enabling a detector:

```powershell
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v2-farm.ts --wallet <wallet> --digest <tx_digest> --receipt-object-id <object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v3-position.ts --wallet <wallet> --digest <tx_digest> --object-id <position_object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-moonbags-tree-stake.ts --wallet <wallet> --digest <tx_digest> --stake-object-id <object_id>
```

The scripts perform read-only Sui RPC calls and print public object IDs, types, owner fields, Move object fields, transaction object changes, and events. They do not execute transactions and do not print private RPC URLs.

The census helper requires an explicit NFTree owner wallet file:

```powershell
npm.cmd exec -- tsx scripts/diagnostics/tree-power-census.ts --wallet-file <wallets.txt>
```

No authoritative current NFTree owner wallet list is stored in this repo, so the census must be run only after a verified owner list is supplied.

## Source Result Model

```ts
type PositionSourceStatus = "qualified-data" | "verified-zero" | "unavailable";

type FifthMoveSourceResult = {
  source: "suidex-v2" | "suidex-v3" | "moonbags-staking";
  status: PositionSourceStatus;
  underlyingTreeRaw?: bigint;
  underlyingTreeDisplay?: string;
  evidence?: {
    objectIds?: string[];
    poolId?: string;
    positionCount?: number;
  };
  reason?: string;
};
```

API responses serialize raw bigint values as decimal strings.

## Aggregation Rules

- Known verified total greater than or equal to threshold: `qualified`.
- Known verified total below threshold and every source verified: `not-qualified`.
- Known verified total below threshold with at least one unavailable source: `verification-incomplete`.
- All sources unavailable: `unavailable`.
- Liquid TREE and NFTree ownership are ignored.

## Backend Endpoint

Route:

`GET /api/tree-power/eligibility/:address`

Behavior:

- validates a full Sui address
- uses server-side read-only Sui RPC
- verifies TREE metadata before threshold math
- caches per normalized wallet for approximately 60 seconds
- returns source-level status and decimal-string raw values
- does not require wallet signatures or private keys
- does not write to chain
- does not convert provider failures into zero balances

## Frontend Integration

`useFifthMoveEligibility(address)` uses a normalized React Query key:

`["fifth-move-eligibility", normalizedAddress]`

It uses a 60-second stale time and no refetch interval. The Tree Power panel maps the endpoint into the existing conservative display model:

- `qualified` highlights verified source chips and shows verified TREE/threshold.
- `not-qualified` shows verified TREE and remaining TREE only when all providers are verified.
- `verification-incomplete` shows known verified TREE and unavailable sources.
- `unavailable` shows position verification unavailable.

The hand count remains authoritative. Four moves stay `4 / 5`; five moves stay `5 / 5`.

## Compatibility-Safe Contract Architecture Options

### A. New Queue Version With Frozen Pending Entitlement

Create a new queue/battle generation path, for example `MatchmakingQueueV3`, `PendingV3`, and `PvpBattleV3`, where each queue entry stores the player address, entry fee snapshot, target growth, and frozen Fifth Move entitlement.

- Trust assumptions: contract trusts its own stored queue snapshot. Eligibility proof must be supplied through an approved verifier or on-chain proof path.
- Compatibility: safest for existing objects because no existing layouts change.
- New shared objects: queue objects per target, optional `FifthMoveConfig`.
- Queue/refund behavior: same as v2, but refund returns the frozen queue entry deposit.
- Kiosk NFT path: unchanged; NFTree access remains separate from Fifth Move entitlement.
- Backend dependency: only if using backend-issued attestations.
- Replay protection: queue entry consumes proof/pass once or checks nonce/expiry.
- Expiry/freshness: proof/pass can include season or deadline.
- Freeze behavior: first player entitlement stored in `PendingV3`; second player entitlement stored at match creation.
- Migration impact: initialize new queues; leave v2 queues for legacy settling.
- Frontend impact: select v3 queue IDs when Fifth Move launches.
- Test complexity: medium/high, but localized.

### B. Separate Shared Entitlement Registry

Create a shared registry keyed by wallet that stores current Fifth Move entitlement. Existing v2 queues read the registry at battle creation.

- Trust assumptions: registry updater/admin is trusted unless on-chain proofs are implemented.
- Compatibility: can avoid queue layout changes but requires existing functions to read an additional object.
- New shared objects: registry and config.
- Queue/refund behavior: existing v2 queue remains, but function signatures may need additional registry argument.
- Kiosk NFT path: unchanged.
- Backend dependency: likely, if backend updates registry.
- Replay protection: registry write authority and freshness fields required.
- Expiry/freshness: registry entry TTL or season.
- Freeze behavior: battle stores entitlement at creation, or registry is read each use if not frozen. Freezing requires battle layout support.
- Migration impact: risky if existing battle layout cannot store entitlement.
- Frontend impact: extra object arg.
- Test complexity: high.

### C. Verifier-Issued FifthMovePass or Signed Attestation

Backend verifies underlying TREE read-only and issues either an on-chain pass object or a signed eligibility payload consumed at queue entry.

- Trust assumptions: verifier is trusted to compute eligibility correctly.
- Compatibility: good if consumed by a new queue version; risky if bolted onto v2 without storage.
- New shared objects: optional `FifthMoveConfig`, pass registry, nonce registry.
- Queue/refund behavior: same as new queue version if pass consumed at join.
- Kiosk NFT path: unchanged.
- Backend dependency: yes.
- Replay protection: nonce, wallet binding, queue target binding, expiry, and one-time use.
- Expiry/freshness: required.
- Freeze behavior: entitlement copied from pass into queue/battle at join.
- Migration impact: moderate if paired with v3 queue.
- Frontend impact: request eligibility/pass before queue join.
- Test complexity: high due signature/pass lifecycle.

Recommended path: Option A with a `FifthMoveConfig` and verifier/pass support only if fully on-chain source verification is impractical. A new queue/battle version is the cleanest way to freeze entitlement without mutating incompatible live layouts.

## Future Hand Generation Rule

- Nonqualified player: existing four-move hand unchanged.
- Qualified player: exactly five unique moves.
- Fifth move must not duplicate any of the first four.
- Preserve the current legal move pool.
- Do not introduce currently excluded abilities without product approval.
- Multiple sources still produce five moves, not six or more.
- Entitlement freezes at battle creation.

## Future FifthMoveConfig

Do not add fields to existing `Config` or `TreeConfig`. Add a new object:

```text
FifthMoveConfig {
  admin,
  enabled,
  utility_coin,
  min_underlying_tree_raw,
  eligibility_ttl_ms_or_season
}
```

Admin controls:

- initialize
- set threshold
- enable/disable
- transfer admin

Events:

- `FifthMoveThresholdUpdated`
- `FifthMoveEnabledUpdated`
- `FifthMoveAdminTransferred`

Threshold changes apply only to future queue entries and battles.

## Phase 2 Blockers

- Verify SuiDex V2 farm object and receipt shape.
- Verify SuiDex V3 owned position object type and official amount math.
- Verify Moonbags active TREE staking object/API.
- Decide whether eligibility will be proven fully on-chain, backend-attested, or pass-based.
- Implement contract changes only after selecting the compatibility-safe queue/pass architecture.
