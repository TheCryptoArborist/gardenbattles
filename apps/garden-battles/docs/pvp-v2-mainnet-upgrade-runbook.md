# Garden Battles PvP v2 Mainnet Upgrade Runbook

This runbook prepares the package upgrade and v2 queue initialization for PvP 50/75 Growth. It is a planning document only. Do not execute transaction commands until the upgrade window is explicitly approved.

## Current Verified State

- Sui client active environment: `mainnet`
- Sui client active address observed during preflight: `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`
- Current package from `Published.toml`: `0x71a3b321d9db461746b2f9a2427f381e2e3105a80a648bc08c2e5f7c45eed5ef`
- Current package version from `Published.toml` and mainnet object: `6`
- Original package ID: `0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- UpgradeCap owner from mainnet object: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- UpgradeCap package field from mainnet object: `0x71a3b321d9db461746b2f9a2427f381e2e3105a80a648bc08c2e5f7c45eed5ef`
- UpgradeCap policy: `0`
- UpgradeCap version field: `6`
- Config object: `0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf`
- Config admin from mainnet object: `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`
- Config treasury: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Config entry fee: `3000000000` MIST
- Config winner payout: `5000000000` MIST
- Config treasury share: `1000000000` MIST
- Legacy matchmaking queue: `0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`

## Local Package Configuration

- `apps/garden-battles/sui_contract/Move.toml` has `published-at = "0xfff4c6177eaa2cec6bc2c5aa4366cbf8a55c8ba58e3196f0c803f6f0ce301070"`.
- `contracts/garden-battles/Move.toml` has the same `published-at` value.
- Both `Published.toml` files record the current mainnet package as `0x71a3b321d9db461746b2f9a2427f381e2e3105a80a648bc08c2e5f7c45eed5ef`.
- Treat `Published.toml` and the UpgradeCap object as the current package lineage source of truth for this runbook.
- Before executing an upgrade, confirm the Sui CLI is using the intended package metadata and does not require a separate approved `Move.toml` published-at cleanup.

## Readiness Caveats

- The active CLI address observed during this runbook, `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`, does not own the UpgradeCap.
- The active CLI address observed during this runbook is also not the Config admin.
- Package upgrade must be signed by the UpgradeCap owner: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Queue initialization must be signed by the Config admin: `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`.
- Do not attempt the upgrade or queue initialization until the CLI active address, hardware wallet, or multisig flow matches the required signer for that step.

## Preflight Checks

Run these checks immediately before the upgrade window.

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles"
git status --short
git log -4 --oneline
```

Expected committed checkpoints include:

- `ed8f9a204 PvP v2 design`
- `4ae1dc9a2 compatible PvP 50/75 contracts`
- `232b9c128 frontend PvP 50/75 support`
- `b72b568bf backend PvP 50/75 support`

Verify Sui environment and signer:

```powershell
sui client active-env
sui client active-address
sui client object 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604
sui client object 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf
```

Contract validation:

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\sui_contract"
sui move build
sui move test

Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\contracts\garden-battles"
sui move build
sui move test
```

## Package Upgrade Command

Use the authoritative source package:

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\sui_contract"
sui client upgrade --upgrade-capability 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604 --gas-budget 1000000000 .
```

Recommended gas budget: `1000000000` MIST. If a dry run or wallet simulation gives a higher requirement, use the higher value with margin.

Expected result:

- A new upgraded package object is created.
- The UpgradeCap package field advances from `0x71a3b321d9db461746b2f9a2427f381e2e3105a80a648bc08c2e5f7c45eed5ef` to `<UPGRADED_PACKAGE_ID>`.
- The package version advances from `6` to `<UPGRADED_PACKAGE_VERSION>`.

Unresolved placeholders until execution:

- `<UPGRADED_PACKAGE_ID>`
- `<UPGRADED_PACKAGE_VERSION>`
- `<UPGRADE_TRANSACTION_DIGEST>`

## Queue Creation Commands

`create_queue_v2` is defined as:

```move
public entry fun create_queue_v2(config: &Config, target_growth: u64, ctx: &mut TxContext)
```

It requires:

- signer is the Config admin
- `config` is the live shared Config object
- `target_growth` is `50` or `75`

Create the 50 Growth queue:

```powershell
sui client call --package <UPGRADED_PACKAGE_ID> --module matchmaking --function create_queue_v2 --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 50 --gas-budget 200000000
```

Create the 75 Growth queue:

```powershell
sui client call --package <UPGRADED_PACKAGE_ID> --module matchmaking --function create_queue_v2 --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 75 --gas-budget 200000000
```

Recommended queue creation gas budget: `200000000` MIST per queue. Increase if wallet simulation reports a higher requirement.

Unresolved placeholders until execution:

- `<QUEUE_50_TRANSACTION_DIGEST>`
- `<QUEUE_75_TRANSACTION_DIGEST>`
- `<MATCHMAKING_QUEUE_50_ID>`
- `<MATCHMAKING_QUEUE_75_ID>`

## Transaction Verification

After the upgrade transaction:

```powershell
sui client object 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604
sui client object <UPGRADED_PACKAGE_ID>
```

Verify:

- UpgradeCap `package` equals `<UPGRADED_PACKAGE_ID>`.
- UpgradeCap `version` equals `<UPGRADED_PACKAGE_VERSION>`.
- Package object exists and is immutable.

After each queue creation transaction:

1. Inspect the transaction effects.
2. Find the created shared object with type:

```text
<UPGRADED_PACKAGE_ID>::matchmaking::MatchmakingQueueV2
```

3. Record its object ID as the queue ID.
4. Verify the queue object:

```powershell
sui client object <MATCHMAKING_QUEUE_50_ID>
sui client object <MATCHMAKING_QUEUE_75_ID>
```

Expected 50 queue fields:

- `target_growth = 50`
- `waiting = none`
- `bank = 0`

Expected 75 queue fields:

- `target_growth = 75`
- `waiting = none`
- `bank = 0`

## Frontend Configuration Changes

Do not deploy the frontend until both v2 queue IDs are known and verified.

Update frontend config after verification:

- `PACKAGE_ID=<UPGRADED_PACKAGE_ID>`
- `MATCHMAKING_QUEUE_50_ID=<MATCHMAKING_QUEUE_50_ID>`
- `MATCHMAKING_QUEUE_75_ID=<MATCHMAKING_QUEUE_75_ID>`
- Keep `LEGACY_MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`
- Keep `ORIGINAL_PACKAGE_ID=0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- Keep `BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID=0x6cae4020693bcfcac9523ce8bc3d0bef7f830900e48b743d002b5d6b676e5142`

`PvpBattleV2Update` event package should be the upgraded package:

- `PVP_BATTLE_V2_EVENT_PACKAGE_ID=<UPGRADED_PACKAGE_ID>`

## Railway Variable Changes

Do not change Railway variables until the upgrade and queue creation transactions are verified.

Set or update:

- `BATTLE_PACKAGE_ID=<UPGRADED_PACKAGE_ID>`
- `PVP_BATTLE_V2_EVENT_PACKAGE_ID=<UPGRADED_PACKAGE_ID>`
- `LEGACY_MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`
- `MATCHMAKING_QUEUE_50_ID=<MATCHMAKING_QUEUE_50_ID>`
- `MATCHMAKING_QUEUE_75_ID=<MATCHMAKING_QUEUE_75_ID>`

Preserve:

- `DISABLE_SUI_RELAY=true`
- `CORS_ALLOWED_ORIGINS`
- `GARDEN_BATTLES_DB_PATH`
- Telegram variables

## Smoke Tests

On-chain read-only checks:

```powershell
sui client object <UPGRADED_PACKAGE_ID>
sui client object <MATCHMAKING_QUEUE_50_ID>
sui client object <MATCHMAKING_QUEUE_75_ID>
sui client object 0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d
```

Frontend smoke tests after deployment:

- Battle page loads under `/battle`.
- Legacy queue/refund recovery still displays if relevant.
- 50 Growth option uses `<MATCHMAKING_QUEUE_50_ID>`.
- 75 Growth option uses `<MATCHMAKING_QUEUE_75_ID>`.
- Legacy 100 Growth queue remains available for recovery only.
- No frontend build points to unset v2 queue IDs.

Backend/Railway smoke tests after variable update:

- `/api/health` returns JSON.
- `/api/leaderboard?mode=pvp` returns JSON.
- Telegram notifier logs configured queues:
  - Legacy Match, 100 Growth
  - Quick Match, 50 Growth
  - Standard Match, 75 Growth
- Empty/unset v2 queues are not expected after launch.
- `DISABLE_SUI_RELAY=true` remains active.

Gameplay smoke tests:

- Join 50 Growth queue with wallet A.
- Confirm Telegram alert says `Match target: 50 Growth` and `Quick Match`.
- Join 50 Growth queue with wallet B.
- Confirm a `PvpBattleV2` is created with `target_growth = 50`.
- Repeat for 75 Growth.
- Confirm winner payout remains 5 SUI and treasury share remains 1 SUI.
- Confirm legacy queue/refund recovery still works.

## Rollback Plan

If the package upgrade succeeds but queue initialization fails:

- Do not deploy frontend v2 queue support.
- Keep `MATCHMAKING_QUEUE_50_ID` and `MATCHMAKING_QUEUE_75_ID` unset in Railway.
- Keep legacy queue recovery available.
- Investigate signer, Config admin, target validation, and gas before retrying queue creation.

If queue initialization succeeds but frontend/backend launch fails:

- Remove or leave unset v2 queue IDs in frontend/Railway deployment configuration.
- Keep `LEGACY_MATCHMAKING_QUEUE_ID` unchanged.
- Keep legacy recovery and refunds available.
- Do not delete or abandon shared v2 queue objects.
- Allow any active v2 queue deposits or battles to settle through the deployed package functions before hiding access permanently.

If v2 gameplay has a live issue:

- Stop advertising 50/75 queue IDs in frontend.
- Clear `MATCHMAKING_QUEUE_50_ID` and `MATCHMAKING_QUEUE_75_ID` in Railway so Telegram does not alert on v2 queues.
- Preserve access to active v2 battle/refund functions for affected users.
- Do not pause global Config unless the issue also affects legacy or Single Player flows.

If the upgraded package has a severe issue:

- Do not publish another upgrade until root cause is understood and tested.
- Keep legacy shared objects reachable.
- Avoid frontend deployment that calls unknown or unverified package IDs.

## Validation Performed For This Runbook

- `sui client active-env`: `mainnet`
- `sui client active-address`: `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`
- `sui client object <UpgradeCap>`: verified owner, package, policy, and version.
- `sui client object <Config>`: verified admin, economics, paused state, treasury, and whitelist.
- `sui move build` in `apps/garden-battles/sui_contract`: passed.
- `sui move test` in `apps/garden-battles/sui_contract`: 32/32 passed.
- `sui move build` in `contracts/garden-battles`: passed.
- `sui move test` in `contracts/garden-battles`: 32/32 passed.

Move tests emitted existing implicit constant-copy warnings in `matchmaking_tests.move`; these warnings did not fail validation.
