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
| SuiDex V2 farm ID | `0xc9c6844deb5031e87f14a9869736874327e4f7b9e2aef51c47f4e004c5b1053c` | Fixture wallet transaction/object evidence | GraphQL object read, farm object type, and position history | High | Yes |
| SuiDex V2 farm position type | `0xbfac...::farm::StakingPosition<...LPCoin<SUI,TREE>>` | Fixture wallet owned object | GraphQL object fields expose owner, pool type, amount, and vault ID | High | Yes |
| SuiDex V3 TREE pool | `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf` | Existing Tree Power constants | `getObject` type is `pool::Pool<SUI,TREE>` | High | Yes |
| SuiDex V3 token ordering | TREE is `type_y` / token 1 | V3 pool fields | `type_y.fields.name` equals TREE type without `0x` | High | Yes |
| SuiDex V3 current sqrt price | `sqrt_price` field | V3 pool fields | `getObject` fields | High | Yes |
| SuiDex V3 current tick | `tick_index.fields.bits` | V3 pool fields | `getObject` fields | High | Yes |
| SuiDex V3 tick spacing | `tick_spacing` | V3 pool fields | `getObject` fields | High | Yes |
| SuiDex V3 position type | `0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position` | Fixture wallet object | Owned-object scan verified owner, pool, liquidity, tick bounds, and token Y | High | Yes |
| Moonbags TREE staking current package | `0x9bc9ddc5cd0220ef810489c73e770f8587a8aa09cad064a0d8e0d1ad903a9e0f` | Moonbags frontend / normalized module | Public package and transaction inspection | High | Yes |
| Moonbags TREE staking type origin | `0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6` | Sui object types / normalized module | Pool, account, and event type inspection | High | Yes |
| Moonbags TREE staking pool | `0x65b92741de03a6889da61c17bccb6f1e27d3d2455b4701948d8571eab8744ece` | Moonbags API and Sui object | Verified as `StakingPool<TREE>` | High | Yes |
| Moonbags stake account type | `moonbags_stake::StakingAccount` | Sui dynamic field under TREE pool | Wallet-keyed account field verification | High | Yes |

## SuiDex V2 Underlying TREE

For verified direct-wallet V2 LP:

```text
underlying_tree_raw =
  floor(player_lp_raw * pool_tree_reserve_raw / total_lp_supply_raw)
```

Current implementation counts direct wallet LP coins and verified SuiDex V2 farmed LP principal.

Phase 1B added deterministic farmed-LP candidate math:

- farm ID must match the canonical TREE farm ID
- active, non-withdrawn LP principal only
- unrelated farms, zero deposits, withdrawn receipts, and rewards are excluded
- direct LP and farmed LP aggregate before the V2 pool reserve formula

Runtime farm detection is enabled after resolving the canonical farm and position/vault shape from public GraphQL objects.

The fixture farm position calculation is:

```text
staking position = 0x698c1e7aae8837b70210bb2d285d13a3d2a25f007ab71cc9fb75c382c324e9ef
shared farm = 0xc9c6844deb5031e87f14a9869736874327e4f7b9e2aef51c47f4e004c5b1053c
staked-token vault = 0x19b9a4a24c3cdb69638e1b7f3d1af1c6ea4f66fab45a5de58c220f0f88a792c3
current staked LP principal = 94369282575 LP raw

deposit events:
  22882886480 LP raw
  71486396095 LP raw
withdrawal events:
  0 LP raw

current_staked_lp_raw = 94369282575
pool_tree_reserve_raw = 49293644613355
total_lp_supply_raw = 8142055208088

underlying_tree_raw =
  floor(94369282575 * 49293644613355 / 8142055208088)

underlying_tree_raw = 571330672512
underlying_tree = 571,330.672512 TREE
```

The `RewardClaimed.amount` event in the same latest mutation is VICTORY rewards and is excluded.

## SuiDex V3 Underlying TREE

The repository now includes server-side read-only SuiDex V3 principal detection and pure integer fixture math for concentrated liquidity:

- below range: position represented entirely by token 0
- in range: token 0 and token 1 split by current sqrt price
- above range: position represented entirely by token 1
- TREE token ordering is respected
- zero liquidity and closed positions return zero

Runtime V3 principal detection is enabled on the server after verifying a canonical owned TREE position object. The detector counts principal only and excludes fee/reward fields.

Phase 1B added deterministic V3 position candidate aggregation for verified position fixtures:

- filters positions to the canonical pool
- uses current pool sqrt price and position lower/upper sqrt prices
- counts principal only, not fees or rewards
- closed and zero-liquidity positions contribute zero
- below range, in range, and above range are covered by bigint tests

The live fixture position calculation is:

```text
pool current tick = 35660
pool current sqrt price = 109707448322793383515
position lower tick = 33900
position upper tick = 37620
lower sqrt price = 100464370031846246815
upper sqrt price = 121000398407248309748
liquidity = 164081076071423
TREE token index = 1

underlying_tree_raw =
  floor(liquidity * (current_sqrt_price - lower_sqrt_price) / 2^64)

underlying_tree_raw = 82215822268196
underlying_tree = 82,215,822.268196 TREE
```

This uses bigint Q64.64 arithmetic and deterministic floor rounding. The result is principal only; fees and rewards are not included.

The current server detector requires:

- owned position object type
- owner representation
- liquidity field
- lower/upper tick fields
- closed-position marker
- fee fields versus principal fields
- official SuiDex math or source implementation alignment

## Moonbags TREE Staking

Moonbags TREE staking can be counted read-only after Phase 1D evidence. The verified current transaction package is `0x9bc9ddc5cd0220ef810489c73e770f8587a8aa09cad064a0d8e0d1ad903a9e0f`; type-origin package and event types use `0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6`.

Canonical TREE staking pool:

```text
0x65b92741de03a6889da61c17bccb6f1e27d3d2455b4701948d8571eab8744ece
```

User stake state is represented by a wallet-keyed dynamic object field under that pool. The field value is:

```text
0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6::moonbags_stake::StakingAccount
```

Only `StakingAccount.balance` is counted as active TREE principal. `earned`, `reward_index`, SUI reward vaults, Token Lock objects, project treasury locks, and claimable rewards are excluded.

If the canonical pool read succeeds and no wallet-keyed dynamic field exists, Moonbags returns `verified-zero`. RPC, shape, owner, or parsing failures return `unavailable`.

Phase 1B added deterministic Moonbags candidate filtering for future verified stake fixtures:

- active TREE principal only
- wallet owner and canonical TREE coin type must match
- rewards are ignored
- withdrawn stakes, zero stakes, unrelated tokens, generic Token Lock records, and project treasury locks are excluded

Runtime Moonbags detection is enabled as a principal-only read-only provider. It performs a bounded pool object read and one wallet-keyed dynamic-field read; it does not run unbounded event-history scans per request.

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

- Verify Moonbags active TREE staking object/API.
- Decide whether eligibility will be proven fully on-chain, backend-attested, or pass-based.
- Implement contract changes only after selecting the compatibility-safe queue/pass architecture.
