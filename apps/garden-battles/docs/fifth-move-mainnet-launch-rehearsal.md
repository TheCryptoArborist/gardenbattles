# Fifth Move Mainnet Launch Rehearsal

This document is a rehearsal and rollout record. The package upgrade to version
8 is complete. It does not authorize FifthMoveConfig creation, V3 queue creation,
Railway change, frontend deployment, Telegram change, or any additional
transaction execution.

Current checkpoint:

- Localnet Phase 2B recovery and settlement harness: `c9316abff`.
- Fifth Move remains inactive on mainnet.
- Mainnet package upgrade to version `8` succeeded at
  `7KqGMHxkTFJNroH2QcXsE44Z5zqHHYHq8Hm934MNgnR2`.
- Existing V2 50/75 PvP queues remain the live production path.
- Legacy 100 Growth queue recovery remains available.

## Safety Rules

- Do not use a production signer private key in local tests.
- Do not use the Garden Battles admin wallet as the Fifth Move attestation signer.
- Do not deploy frontend with V3 queue IDs until the matching V3 objects exist.
- Do not set Railway V3 variables until the upgraded package, `FifthMoveConfig`,
  and V3 queues have been verified on-chain.
- Do not remove V2 or legacy queue recovery while any existing entries or battles
  can still need refund, recovery, settlement, or leaderboard ingestion.
- If any preflight check fails, stop before sending a transaction.

## Last Known Mainnet Context

Reverify all values immediately before execution.

| Item | Value |
| --- | --- |
| Current live package | `0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf` |
| Current live package version | `8` |
| UpgradeCap | `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604` |
| Config object | `0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf` |
| Expected Config admin / upgrade operator | `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4` |
| Legacy queue | `0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d` |
| V2 50 Growth queue | `0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960` |
| V2 75 Growth queue | `0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd` |

## Preflight Order

1. Confirm the branch, commit, and clean tree.
2. Confirm active Sui environment is `mainnet` only when intentionally preparing
   the real upgrade window.
3. Confirm active address is the expected upgrade/admin address.
4. Confirm the active address owns the `UpgradeCap`.
5. Confirm the `UpgradeCap` package field matches the current live package.
6. Confirm the shared `Config` admin matches the active address.
7. Run both Move builds and test suites.
8. Run frontend/backend validation.
9. Confirm the dedicated Fifth Move signer public key is generated and stored
   outside git.
10. Confirm no `.env` file, signer private key, mnemonic, or private RPC URL is
    included in the working tree.

Suggested read-only checks:

```powershell
git status --short --branch
git log -1 --oneline
sui client active-env
sui client active-address
sui client object 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604
sui client object 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf
```

## Current Preflight Snapshot

Recorded on 2026-08-17 after `e51b3d77f`.

- Git branch: `codex/recovered-gardenbattles-20260624`.
- Local branch state: ahead of origin by two commits.
- Sui CLI active environment: `mainnet`.
- Plain Sui CLI active address previously resolved to:
  `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`.
- Explicit config path Sui CLI active address resolves to:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Expected upgrade/admin address:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Readiness result: use the explicit `--client.config
  C:\Users\peter\.sui\sui_config\client.yaml` flag for future Sui CLI preflight
  and transaction commands from this workspace.
- Plain CLI address list contains only alias `brave-chrysolite` for
  `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`.
- Explicit config path address list contains alias `mint-admin-45c4` for
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Operator SUI balance from read-only GraphQL:
  `128717457088` MIST (`128.717457088 SUI`).
- The expected operator account is available on this workstation when the
  explicit config path is supplied. Do not request, paste, export, or commit any
  private key or seed phrase.

Read-only object verification notes:

- `sui client object <id>` failed locally with `NativeCertsNotFound`.
- Public fullnode JSON-RPC returned `Method not found` because public JSON-RPC
  object reads are deprecated.
- A read-only request to `https://sui-mainnet.mystenlabs.com/graphql` did not
  complete from this workstation because Windows curl/PowerShell hit a TLS
  transport handshake failure before a GraphQL response was received.
- Read-only GraphQL queries against `https://graphql.mainnet.sui.io/graphql`
  succeeded and should be the preferred public object-read fallback for this
  workstation.
- `sui client --client.config C:\Users\peter\.sui\sui_config\client.yaml
  chain-identifier` and gas reads still failed locally with
  `NativeCertsNotFound`, so network-state reads should use GraphQL until the Sui
  CLI certificate issue is fixed.
- `suiup` installed `sui 1.77.2-51d177ad7d65`, and PowerShell resolves
  `C:\Users\peter\AppData\Local\bin\sui.exe` before the old
  `C:\Users\peter\sui\sui.exe` when `$env:LOCALAPPDATA\bin` is first in PATH.
- The newer CLI removed the protocol-version blocker. The upgrade transaction
  was run from the operator PowerShell session where the updated CLI was active.
  Sui CLI network reads from the Codex environment still hit
  `NativeCertsNotFound`, so use GraphQL for read-only verification here.
- Mainnet upgrade digest:
  `7KqGMHxkTFJNroH2QcXsE44Z5zqHHYHq8Hm934MNgnR2`.
- Mainnet upgraded package:
  `0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf`.
- Mainnet package version: `8`.
- Published modules: `battle`, `config`, `errors`, `fifth_move`, `matchmaking`,
  `nft`, `utils`.

Verified with GraphQL:

- UpgradeCap owner:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- UpgradeCap package:
  `0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf`.
- UpgradeCap version: `8`.
- UpgradeCap policy: `0`.
- Upgrade transaction digest:
  `7KqGMHxkTFJNroH2QcXsE44Z5zqHHYHq8Hm934MNgnR2`.
- Config admin:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Config treasury:
  `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Config entry fee: `3000000000`.
- Config winner payout: `5000000000`.
- Config treasury share: `1000000000`.
- Config paused: `false`.

Before the real upgrade window, object verification should use a working Sui CLI
certificate setup, `https://graphql.mainnet.sui.io/graphql`, or a configured
private RPC provider that does not expose credentials in logs or committed files.

Validation commands:

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\sui_contract"
sui move build
sui move test

Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\contracts\garden-battles"
sui move build
sui move test

Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles"
npm.cmd run check
npm.cmd run build
npm.cmd run test:telegram
npx.cmd vite build --base /battle/

Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles"
git diff --check
```

## Dedicated Signer Preparation

Generate one dedicated Ed25519 signer for Fifth Move attestations. The private
key is a Railway secret only. The raw 32-byte public key is stored in
`FifthMoveConfig`.

Do not:

- reuse the Garden Battles admin seed phrase,
- reuse a personal wallet key,
- print the private key in terminal logs,
- commit the key,
- expose the key to the browser.

Record only:

- signer key ID,
- raw public key bytes,
- creation date,
- operator who generated it,
- storage location for the Railway secret.

## Package Upgrade Record

Completed on mainnet.

- Command gas budget: `1000000000` MIST.
- Upgrade digest: `7KqGMHxkTFJNroH2QcXsE44Z5zqHHYHq8Hm934MNgnR2`.
- New package ID:
  `0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf`.
- Package version: `8`.
- Created immutable package object version: `8`.
- UpgradeCap object version after upgrade: `962998916`.
- Gas cost: `278155220` MIST.
- Verified modules: `battle`, `config`, `errors`, `fifth_move`, `matchmaking`,
  `nft`, `utils`.
- No frontend, Railway, Telegram, FifthMoveConfig, or V3 queue action was
  performed by this upgrade transaction.

## FifthMoveConfig Creation

Create the shared config after the upgraded package is verified. It initializes
disabled. Do not execute until the dedicated production signer public key is
ready.

```powershell
sui client call `
  --package 0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf `
  --module fifth_move `
  --function init_fifth_move_config `
  --type-args 0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE `
  --args <SIGNER_PUBLIC_KEY_BYTES_VECTOR> <MAX_ATTESTATION_AGE_MS> `
  --gas-budget <BUDGET>
```

Verify:

- object type is
  `0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf::fifth_move::FifthMoveConfig`,
- admin is the expected operations wallet,
- `enabled` is `false`,
- `utility_coin` is canonical TREE,
- `min_underlying_tree_raw` is `1000000000000`,
- `signer_public_key` equals the dedicated signer public key,
- `config_version` is `1`,
- `max_attestation_age_ms` is the approved production value.

## V3 Queue Creation

Create V3 queues only after `FifthMoveConfig` exists and the package is verified.
`create_queue_v3` requires the existing shared `Config` object and the target
growth.

```powershell
sui client call `
  --package 0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf `
  --module matchmaking `
  --function create_queue_v3 `
  --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 50 `
  --gas-budget <BUDGET>

sui client call `
  --package 0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf `
  --module matchmaking `
  --function create_queue_v3 `
  --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 75 `
  --gas-budget <BUDGET>
```

From each transaction effect, capture the created shared
`MatchmakingQueueV3` object:

- `MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>`
- `MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>`

Verify:

- 50 queue target is `50`,
- 75 queue target is `75`,
- both queues have empty waiting state,
- both queues have zero bank,
- queue object types use the new package ID.

## Backend / Railway Configuration

Set these only after the package, config, and V3 queue IDs are verified:

```text
BATTLE_PACKAGE_ID=0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf
PVP_BATTLE_V2_EVENT_PACKAGE_ID=0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf
PVP_BATTLE_V3_EVENT_PACKAGE_ID=0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf
RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID=0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf
FIFTH_MOVE_ATTESTATION_PRIVATE_KEY=<DEDICATED_ED25519_PRIVATE_KEY>
FIFTH_MOVE_ATTESTATION_KEY_ID=<SIGNER_KEY_ID>
FIFTH_MOVE_CONFIG_ID=<FIFTH_MOVE_CONFIG_OBJECT_ID>
FIFTH_MOVE_ATTESTATION_TTL_MS=<APPROVED_TTL_MS>
FIFTH_MOVE_ATTESTATION_RATE_LIMIT_MS=5000
FIFTH_MOVE_CONFIG_CACHE_MS=30000
FIFTH_MOVE_CONFIG_READ_TIMEOUT_MS=5000
MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>
MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>
```

Preserve:

```text
LEGACY_MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d
MATCHMAKING_QUEUE_50_ID=0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960
MATCHMAKING_QUEUE_75_ID=0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd
```

Restart Railway only during the approved deployment window. Confirm the backend
can read `FifthMoveConfig` before enabling the feature.

## Frontend Configuration

Set these only after backend variables are staged and V3 objects are verified:

```text
VITE_BATTLE_PACKAGE_ID=0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf
VITE_FIFTH_MOVE_CONFIG_ID=<FIFTH_MOVE_CONFIG_OBJECT_ID>
VITE_MATCHMAKING_QUEUE_V3_50_ID=<CREATED_50_QUEUE_ID>
VITE_MATCHMAKING_QUEUE_V3_75_ID=<CREATED_75_QUEUE_ID>
```

Preserve existing V2 and legacy IDs until all V3 launch smoke tests pass.

If V3 queue IDs are unset, the frontend should continue using the live V2 50/75
queues.

## Enable Fifth Move

Enable the feature only after:

- backend can read the config,
- backend signer public key matches the on-chain config,
- frontend is pointed at the verified V3 package/config/queue IDs,
- standard four-move V3 entry works,
- V3 refunds work,
- event ingestion recognizes V3 events.

Enable command:

```powershell
sui client call `
  --package 0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf `
  --module fifth_move `
  --function set_enabled `
  --args <FIFTH_MOVE_CONFIG_OBJECT_ID> true `
  --gas-budget <BUDGET>
```

Verify `config_version` increments exactly once.

## Smoke Test Sequence

Run with small, controlled wallets first.

1. Practice Mode starts without requesting eligibility or proof.
2. Single Player fallback creates a standard four-move battle when proof is not
   available.
3. Qualified Single Player creates a five-move human hand and four-move bot hand.
4. 50 Growth standard PvP join creates a four-move entitlement snapshot.
5. 50 Growth qualified PvP join creates a five-move entitlement snapshot.
6. 75 Growth standard PvP join creates a four-move entitlement snapshot.
7. 75 Growth qualified PvP join creates a five-move entitlement snapshot.
8. PvP 4/4, 5/4, 4/5, and 5/5 battle creation all work.
9. `cancel_queue_v3` returns the full deposit for standard and qualified waiting
   entries.
10. V2 50/75 refunds still work.
11. Legacy recovery still works.
12. PvpBattleV3 and RankedBotBattleV2 events ingest into leaderboard storage.
13. Fifth Move entitlement does not change leaderboard scoring.
14. Telegram queue alerts parse V3 waiting entries without exposing entitlement
    internals to users.

## Rollback Plan

If package upgrade fails:

- no config or V3 queues exist,
- keep current V2 frontend/backend deployment unchanged.

If package upgrade succeeds but config or queue creation fails:

- do not deploy frontend V3 variables,
- do not set Railway V3 queue variables,
- keep V2 queues active,
- investigate and prepare a corrective compatible upgrade if needed.

If V3 queues exist but launch is not approved:

- keep `FifthMoveConfig.enabled = false`,
- keep frontend V3 variables unset,
- keep Railway V3 variables unset,
- V2 queues remain the public path.

If launch starts and issues appear:

- set `FifthMoveConfig.enabled = false` to stop new five-move proofs,
- preserve V3 queue and battle access for refunds and settlements,
- leave backend V3 event parsing enabled,
- do not remove queue IDs until every waiting entry and active V3 battle is
  settled or refunded,
- route new public entry back to V2 by unsetting frontend V3 queue IDs in the
  next deployment.

## Remaining Blockers Before Mainnet

- Dedicated signer generation and secure Railway secret entry.
- Gas budget selection for upgrade, config creation, queue creation, and enable
  transaction.
- Mainnet `FifthMoveConfig` object ID.
- Mainnet V3 50/75 queue object IDs.
- Approved deployment window and rollback owner.
