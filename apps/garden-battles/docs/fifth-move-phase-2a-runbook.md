# Fifth Move Phase 2A Prototype Runbook

This checkpoint prepares a local, contract-enforced Fifth Move prototype. It does not publish a package, create mainnet queue objects, deploy frontend/backend changes, or activate Fifth Move in production.

## Current Prototype Scope

- Qualification threshold: `1,000,000,000,000` raw TREE.
- Qualifying sources: SuiDex V2 direct LP, SuiDex V2 farmed LP, SuiDex V3 positions, Moonbags TREE staking.
- Eligibility proof: short-lived Ed25519 signature over canonical BCS payload bytes.
- Feature object: new shared `FifthMoveConfig`, initialized disabled until explicitly configured.
- Queue path: new `MatchmakingQueueV3` and `PendingV3`.
- Battle path: new `PvpBattleV3` and `RankedBotBattleV2`.
- Existing legacy, PvP V2, refund, recovery, payout, leaderboard, and bot behavior remain available.

## Signature Model

- Algorithm: Ed25519.
- Move verifier: `sui::ed25519::ed25519_verify`.
- Public key encoding: raw 32-byte Ed25519 public key as `vector<u8>`.
- Signature encoding: raw 64-byte Ed25519 signature as `vector<u8>`.
- Message bytes: BCS serialization of `FifthMoveAttestationPayload`.
- Signer: dedicated eligibility signer, not the Garden Battles admin wallet.

## Canonical Payload

`FifthMoveAttestationPayload` is BCS-serialized with these fields, in order:

1. `version: u8`
2. `domain: vector<u8>`
3. `network: vector<u8>`
4. `fifth_move_config_id: address`
5. `wallet: address`
6. `qualified: bool`
7. `verified_underlying_tree_raw: u64`
8. `threshold_raw: u64`
9. `source_bitmap: u8`
10. `config_version: u64`
11. `issued_at_ms: u64`
12. `expires_at_ms: u64`

Domain: `GARDEN_BATTLES_FIFTH_MOVE_V1`

Network: `sui:mainnet`

Source bitmap:

- bit 0: SuiDex V2 direct
- bit 1: SuiDex V2 farm
- bit 2: SuiDex V3
- bit 3: Moonbags TREE staking

The Move verifier compares `fifth_move_config_id` to the actual shared `FifthMoveConfig` object in the transaction. A proof generated for one config object must not verify against another config object, even with the same signer and version.

Test golden vector:

- config ID: `0xd726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3`
- wallet: `0x000000000000000000000000000000000000000000000000000000000000000b`
- public key: `79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664`
- BCS hex: `011c47415244454e5f424154544c45535f46494654485f4d4f56455f56310b7375693a6d61696e6e6574d726ecf6f7036ee3557cd6c7b93a49b231070e8eecada9cfa157e40e3f02e5d3000000000000000000000000000000000000000000000000000000000000000b010010a5d4e80000000010a5d4e800000005020000000000000040420f00000000000017110000000000`
- signature hex: `83ec65cad41fc466a573eb7202e7e4e7d6e8d4199e54407d4835df6181e7ec75b3bc1300555dcc4c7b129a7882e7eebe16b5d4d8e4201ff417714ce552206f0e`

## Package Upgrade Placeholder

Do not execute during this checkpoint.

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\sui_contract"
sui client upgrade --upgrade-capability <UPGRADE_CAP_ID> --gas-budget <BUDGET> .
```

After upgrade, record:

- upgraded package ID: `<FUTURE_PACKAGE_ID>`
- package version: `<FUTURE_PACKAGE_VERSION>`
- upgrade transaction digest: `<UPGRADE_DIGEST>`

## FifthMoveConfig Initialization

Do not execute during this checkpoint.

Create the shared config after the package upgrade, using the dedicated signer public key:

The backend expects `FIFTH_MOVE_ATTESTATION_PRIVATE_KEY` to be a dedicated
Ed25519 Sui private key string. The on-chain config stores only the matching raw
32-byte Ed25519 public key as `vector<u8>`. Do not reuse or store the Garden
Battles admin key as the attestation key.

If the public key comes from `sui keytool list`, convert its
`public_key_base64` field into the required vector with:

```powershell
npm.cmd exec -- tsx scripts/fifth-move-public-key-vector.ts --public-key-base64 "<PUBLIC_KEY_BASE64>"
```

```powershell
sui client call `
  --package <FUTURE_PACKAGE_ID> `
  --module fifth_move `
  --function init_fifth_move_config `
  --type-args 0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE `
  --args <DEDICATED_SIGNER_PUBLIC_KEY_BYTES_VECTOR> <MAX_ATTESTATION_AGE_MS> `
  --gas-budget <BUDGET>
```

The config starts with `enabled = false`. Enable it only after backend signing, frontend routing, and smoke tests are ready.

## V3 Queue Creation

Do not execute during this checkpoint.

Create separate shared queues after the upgraded package and config are confirmed:

```powershell
sui client call `
  --package <FUTURE_PACKAGE_ID> `
  --module matchmaking `
  --function create_queue_v3 `
  --args 50 `
  --gas-budget <BUDGET>

sui client call `
  --package <FUTURE_PACKAGE_ID> `
  --module matchmaking `
  --function create_queue_v3 `
  --args 75 `
  --gas-budget <BUDGET>
```

Capture the two shared object IDs from transaction object changes:

- `MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>`
- `MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>`

## Backend Configuration

Set these only after the package upgrade and queue creation are complete:

```text
BATTLE_PACKAGE_ID=<FUTURE_PACKAGE_ID>
PVP_BATTLE_V3_EVENT_PACKAGE_ID=<FUTURE_PACKAGE_ID>
RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID=<FUTURE_PACKAGE_ID>
FIFTH_MOVE_ATTESTATION_PRIVATE_KEY=<DEDICATED_ED25519_PRIVATE_KEY>
FIFTH_MOVE_ATTESTATION_KEY_ID=<SIGNER_KEY_ID>
FIFTH_MOVE_CONFIG_ID=<FIFTH_MOVE_CONFIG_OBJECT_ID>
FIFTH_MOVE_ATTESTATION_TTL_MS=180000
FIFTH_MOVE_ATTESTATION_RATE_LIMIT_MS=5000
FIFTH_MOVE_CONFIG_CACHE_MS=30000
FIFTH_MOVE_CONFIG_READ_TIMEOUT_MS=5000
MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>
MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>
```

Never store the Garden Battles admin seed phrase as the attestation key.
The backend reads `FifthMoveConfig` before signing and treats the on-chain object as authoritative for enabled status, utility coin, threshold, config version, signer public key, and maximum attestation age. Environment variables must not override those production values.

## Frontend Configuration

Set these only after the corresponding shared objects exist:

```text
VITE_BATTLE_PACKAGE_ID=<FUTURE_PACKAGE_ID>
VITE_FIFTH_MOVE_CONFIG_ID=<FIFTH_MOVE_CONFIG_OBJECT_ID>
VITE_MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>
VITE_MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>
```

If V3 queue IDs are unset, the frontend continues using existing V2 50/75 queues.

## Smoke Tests

1. Start Practice Mode and confirm no eligibility proof request is made.
2. Start Single Player without Fifth Move config and confirm the old `create_bot_battle` path still works.
3. With local config enabled, qualified wallet receives an attestation and creates a five-move ranked bot battle.
4. Unqualified or verification-unavailable wallet creates a standard four-move ranked bot battle.
5. Join V3 50 queue with no proof and confirm a four-move entitlement snapshot.
6. Join V3 50 queue with proof and confirm a five-move entitlement snapshot.
7. Match 4/4, 5/4, 4/5, and 5/5 combinations.
8. Confirm refunds use `cancel_queue_v3`.
9. Confirm V2 and legacy refunds still work.
10. Confirm PvpBattleV3 and RankedBotBattleV2 events are ingested without affecting rank scoring.

## Rollback

- Do not deploy frontend with unset or incorrect V3 queue IDs.
- If launch fails before users enter V3 queues, unset V3 queue IDs and keep V2 queues active.
- If users have active V3 queue entries or battles, keep access to V3 queues and battle objects until refunds/results settle.
- Disable Fifth Move by setting `FifthMoveConfig.enabled = false`.
- Preserve legacy and V2 queue recovery paths.
- Do not remove backend event recognition for already-created V3 objects.

## Blockers Before Mainnet Upgrade

- Generate and store a dedicated Ed25519 eligibility signer securely.
- Decide operational owner/admin for `FifthMoveConfig`.
- Create and record mainnet V3 50/75 queue IDs after package upgrade.
- Configure Railway and frontend with matching package/config/queue IDs.
- Run full local and smoke validation against the upgraded package.
