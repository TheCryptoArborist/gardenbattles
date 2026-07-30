# Fifth Move Phase 1D Moonbags Evidence

Phase 1D is read-only evidence acquisition and detector preparation. Fifth Move remains inactive. No Move contracts, package IDs, queue IDs, transaction paths, or battle mechanics were changed.

## Product Rules Preserved

- NFTree ownership grants Garden Battles access only.
- Liquid TREE does not qualify for Fifth Move.
- Qualifying sources are SuiDex V2 underlying TREE, SuiDex V3 underlying TREE, and active Moonbags TREE staking principal.
- Token Lock positions, project treasury locks, liquid TREE, and claimable rewards are excluded.
- Threshold remains exactly `1,000,000 TREE`, or `1,000,000,000,000` raw units.

## Moonbags Contract Evidence

Moonbags public frontend constants identify the current transaction package and shared staking configuration used for Token Staking:

| Identifier | Value |
| --- | --- |
| Current transaction package | `0x9bc9ddc5cd0220ef810489c73e770f8587a8aa09cad064a0d8e0d1ad903a9e0f` |
| Type-origin package | `0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6` |
| Module | `moonbags_stake` |
| Stake function | `stake` |
| Unstake function | `unstake` |
| Reward claim function | `claim_staking_pool` |
| Shared configuration | `0x245161e22ea04614628b56da68fe0474fff8c3c631292c2ee1a0bd669db57959` |
| Canonical TREE staking pool | `0x65b92741de03a6889da61c17bccb6f1e27d3d2455b4701948d8571eab8744ece` |
| TREE coin type | `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE` |

The canonical TREE pool object type is:

```text
0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6::moonbags_stake::StakingPool<0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>
```

The pool exposes:

- `staking_token.balance`: current TREE principal vault.
- `total_supply`: current total staked TREE principal.
- `sui_token.balance`, `reward_index`, and `pending_initial_rewards`: reward accounting, excluded from Fifth Move qualification.

## User Stake Model

Moonbags TREE staking accounts are dynamic object fields under the TREE staking pool, keyed by wallet address.

The verified account type is:

```text
0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6::moonbags_stake::StakingAccount
```

Verified fields:

| Field | Meaning | Fifth Move handling |
| --- | --- | --- |
| `staker` | Wallet owner/beneficiary | Must match queried wallet |
| `balance` | Active staked TREE principal | Counted |
| `earned` | SUI rewards pending/accounted | Excluded |
| `reward_index` | Reward accounting index | Excluded |
| `unstake_deadline` | Staking timing state | Evidence only |

Missing wallet-keyed dynamic field means the provider can return verified zero after the pool shape is verified.

## Public Transaction Evidence

Read-only transaction inspection verified the lifecycle:

- `moonbags_stake::stake<TREE>` creates or mutates a `StakingAccount` and emits `StakeEvent`.
- `moonbags_stake::unstake<TREE>` reduces or deletes a `StakingAccount` and emits `UnstakeEvent`.
- `moonbags_stake::claim_staking_pool<TREE>` emits `ClaimStakingPoolEvent` and handles SUI rewards without changing TREE principal.

Public fixture examples used for model verification:

| Purpose | Digest |
| --- | --- |
| Active TREE staking account mutation | `AFUEFa9wG2KwxN59id4ZNhbkLhqfxxhCpDVR23snDBUm` |
| Reward claim excluding principal | `2tLvYaSLkbP6Kyk745qaKpg6bYJG4QRKFH3sboRMf7N8` |
| Unstake / zero-principal account | `FDLmkE4RAiQEREBhRmh6UqbU2P28LRFYMp4VSoqeGvBf` |

## Fixture Wallet Result

Fixture wallet:

```text
0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6
```

Latest read-only runtime query:

| Source | Status | TREE |
| --- | --- | ---: |
| SuiDex V2 | `qualified-data` | `570,382.046976` |
| SuiDex V3 | `qualified-data` | `82,792,871.605275` |
| Moonbags staking | `verified-zero` | `0` |
| Total verified | `qualified` | `83,363,253.652251` |

The fixture remains qualified through verified SuiDex sources. Its Moonbags TREE staking source is verified zero, not unavailable.

## Runtime Detector

The server-side Moonbags provider is enabled as `moonbags-staking`.

Runtime behavior:

- Verify canonical TREE staking pool object and TREE generic type.
- Read the wallet-keyed dynamic field from the canonical pool.
- Require `StakingAccount.staker` to match the requested wallet.
- Count `StakingAccount.balance` only.
- Exclude rewards and Token Lock data.
- Return `verified-zero` when the dynamic field is missing after a successful pool read.
- Return `unavailable` for RPC failures, pool shape mismatches, account shape mismatches, owner mismatches, or parsing errors.

The provider does not run event-history scans per API request.

## Census

Fresh NFTree holder export:

- Snapshot: `2026-07-30T03:21:30.552Z`
- Holder-owned NFTrees: `92`
- Unique owner wallets: `29`
- Unresolved kiosk/object ownership: `67`

Moonbags-enabled census:

| Metric | Count |
| --- | ---: |
| Wallets checked | 29 |
| Qualified at 1,000,000 TREE | 4 |
| Fully verified not-qualified | 25 |
| Verification-incomplete | 0 |
| Unavailable | 0 |
| Qualified through V2 farm | 3 |
| Qualified through V3 | 4 |
| Qualified through Moonbags | 0 |
| Qualified through combined sources | 3 |

Threshold distribution:

| Threshold | Wallets at or above |
| --- | ---: |
| 500,000 TREE | 4 |
| 1,000,000 TREE | 4 |
| 2,500,000 TREE | 4 |
| 5,000,000 TREE | 4 |

No individual wallet balances are published in the census summary.
