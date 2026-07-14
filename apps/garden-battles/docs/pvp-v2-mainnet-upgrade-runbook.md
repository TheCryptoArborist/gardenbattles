# Garden Battles PvP v2 Mainnet Upgrade Runbook

This runbook records the completed package upgrade, authority transfer, and v2 queue initialization for PvP 50/75 Growth. Deployment and Railway configuration changes remain pending.

## Current Verified State

- Sui client active environment: `mainnet`
- Current package from `Published.toml`: `0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- Current package version from `Published.toml` and mainnet object: `7`
- Upgrade transaction: `8goT3mXxMPFNSMdx678bwkq6myjkxHYcqpoWuZPMCSxz`
- Original package ID: `0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- UpgradeCap owner from mainnet object: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- UpgradeCap package field from mainnet object: `0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- UpgradeCap policy: `0`
- UpgradeCap version field: `7`
- Config object: `0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf`
- Config admin from mainnet object: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Admin transfer transaction: `5DfpU1CWxSpZa2z6gF5fAz1eNYRctaZbMea63LrbtBv3`
- Config treasury: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Config entry fee: `3000000000` MIST
- Config winner payout: `5000000000` MIST
- Config treasury share: `1000000000` MIST
- Legacy matchmaking queue: `0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`
- 50 Growth queue: `0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960`
- 50 Growth queue transaction: `5fQQ2kkbdem8vhTqd8fAFszqyjNuF1dd3dvAcRrHsfXv`
- 75 Growth queue: `0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd`
- 75 Growth queue transaction: `A98DCKUwainiP9CFfppe4gkGBvWDGqSbdv3UQynszghE`

## Completion Status

- Complete: package upgrade to version 7.
- Complete: Config authority transfer from `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36` to `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Complete: 50 Growth shared queue creation.
- Complete: 75 Growth shared queue creation.
- Pending: frontend deployment with verified v2 IDs.
- Pending: Railway variable update with verified v2 IDs.
- Pending: production smoke tests.

## Local Package Configuration

- `apps/garden-battles/sui_contract/Move.toml` has `published-at = "0xfff4c6177eaa2cec6bc2c5aa4366cbf8a55c8ba58e3196f0c803f6f0ce301070"`.
- `contracts/garden-battles/Move.toml` has the same `published-at` value.
- Both `Published.toml` files should record the current mainnet package as `0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`, version `7`.
- Treat `Published.toml` and the UpgradeCap object as the current package lineage source of truth for this runbook.
- Before executing an upgrade, confirm the Sui CLI is using the intended package metadata and does not require a separate approved `Move.toml` published-at cleanup.

## Readiness Caveats

- Upgrade, authority consolidation, and queue initialization are complete.
- Remaining privileged follow-up work should be signed by `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Do not create replacement queues unless a new launch plan is approved.

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

## Package Upgrade Record

Executed upgrade command shape:

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles\sui_contract"
sui client upgrade --upgrade-capability 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604 --gas-budget 1000000000 .
```

Recommended gas budget: `1000000000` MIST. If a dry run or wallet simulation gives a higher requirement, use the higher value with margin.

Recorded result:

- Upgraded package object: `0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- Package version: `7`
- Upgrade transaction: `8goT3mXxMPFNSMdx678bwkq6myjkxHYcqpoWuZPMCSxz`

## Authority Consolidation

Goal: make `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4` the sole Garden Battles administrative wallet before creating the v2 queues.

Known authority objects:

- Old Config admin: `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`
- New sole admin: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Config object: `0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- Live TreeConfig object ID: unresolved. Do not attempt TreeConfig transfer until a live TreeConfig object ID is verified with `sui client object <TREE_CONFIG_ID>`.

Completed launch order:

1. Complete: `d45c4` upgraded the package.
2. Complete: upgraded package ID and UpgradeCap version were verified.
3. Complete: `6f36` signed `config::transfer_admin` to `d45c4` through Slush.
4. Complete: live Config admin is `d45c4`.
5. Not applicable unless a verified live TreeConfig exists later.
6. Deferred: no verified live TreeConfig object ID is recorded.
7. Complete: `d45c4` created the 50 Growth queue.
8. Complete: `d45c4` created the 75 Growth queue.
9. Complete: both shared queue object IDs are recorded.
10. Pending: deploy frontend configuration.
11. Pending: update Railway variables.
12. Pending: deploy.
13. Pending: run smoke tests.

Config admin transfer command record:

```powershell
sui client call --package 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23 --module config --function transfer_admin --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4 --gas-budget 100000000
```

Recorded signer requirement: this transaction was signed by the previous Config admin, `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`.

Config transfer verification:

```powershell
sui client object 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf
```

Expected field after transfer:

- `admin = 0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`

TreeConfig admin transfer command template, only if a live TreeConfig object is verified:

```powershell
sui client call --package 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23 --module config --function transfer_tree_admin --args <TREE_CONFIG_ID> 0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4 --gas-budget 100000000
```

Signer requirement: this transaction must be signed by the current TreeConfig admin shown on the verified TreeConfig object.

TreeConfig transfer verification:

```powershell
sui client object <TREE_CONFIG_ID>
```

Expected field after transfer:

- `admin = 0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`

## Queue Creation Record

`create_queue_v2` is defined as:

```move
public entry fun create_queue_v2(config: &Config, target_growth: u64, ctx: &mut TxContext)
```

It requires:

- signer is the Config admin. After authority consolidation, this should be `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- `config` is the live shared Config object
- `target_growth` is `50` or `75`

50 Growth queue transaction:

```powershell
sui client call --package 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23 --module matchmaking --function create_queue_v2 --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 50 --gas-budget 200000000
```

- Queue ID: `0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960`
- Transaction digest: `5fQQ2kkbdem8vhTqd8fAFszqyjNuF1dd3dvAcRrHsfXv`

75 Growth queue transaction:

```powershell
sui client call --package 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23 --module matchmaking --function create_queue_v2 --args 0x30addc978abe37f31d55cc60a395f30fd6cfdcbfb3cd4e319d2920b0e780a9bf 75 --gas-budget 200000000
```

- Queue ID: `0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd`
- Transaction digest: `A98DCKUwainiP9CFfppe4gkGBvWDGqSbdv3UQynszghE`

## Transaction Verification

After the upgrade transaction:

```powershell
sui client object 0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604
sui client object 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23
```

Verify:

- UpgradeCap `package` equals `0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`.
- UpgradeCap `version` equals `7`.
- Package object exists and is immutable.

Verify the queue objects:

```powershell
sui client object 0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960
sui client object 0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd
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

- `PACKAGE_ID=0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- `MATCHMAKING_QUEUE_50_ID=0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960`
- `MATCHMAKING_QUEUE_75_ID=0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd`
- `ADMIN_ADDRESSES=["0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4"]`
- Keep `LEGACY_MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`
- Keep `ORIGINAL_PACKAGE_ID=0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- Keep `BOT_MOVE_RESOLVED_EVENT_PACKAGE_ID=0x6cae4020693bcfcac9523ce8bc3d0bef7f830900e48b743d002b5d6b676e5142`

`PvpBattleV2Update` event package should be the upgraded package:

- `PVP_BATTLE_V2_EVENT_PACKAGE_ID=0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`

## Railway Variable Changes

Do not change Railway variables until the upgrade and queue creation transactions are verified.

Set or update:

- `BATTLE_PACKAGE_ID=0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- `PVP_BATTLE_V2_EVENT_PACKAGE_ID=0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23`
- `LEGACY_MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d`
- `MATCHMAKING_QUEUE_50_ID=0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960`
- `MATCHMAKING_QUEUE_75_ID=0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd`

Preserve:

- `DISABLE_SUI_RELAY=true`
- `CORS_ALLOWED_ORIGINS`
- `GARDEN_BATTLES_DB_PATH`
- Telegram variables

## Smoke Tests

On-chain read-only checks:

```powershell
sui client object 0x37d3567ff2d92f94b5b55198d0692a4ba02437325aa4281f3db69ee8078aca23
sui client object 0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960
sui client object 0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd
sui client object 0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d
```

Frontend smoke tests after deployment:

- Battle page loads under `/battle`.
- Legacy queue/refund recovery still displays if relevant.
- 50 Growth option uses `0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960`.
- 75 Growth option uses `0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd`.
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

Historical rollback note for the pre-completion stage where the package upgrade succeeded but Config transfer had failed:

- Do not deploy v2 frontend configuration.
- Do not create queues from an unauthorized wallet.
- Legacy queue remains operational.
- Before the recorded transfer transaction, retry would have required the previous Config admin, `0xaf19c438c96320d14954a63c06d71fab99a2165800c839d667bd1803ecf86f36`.
- Package remains upgraded and usable.

If Config transfer succeeds but queue creation fails:

- Verify Config admin is `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Retry queue creation from `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
- Keep v2 queue IDs unset until successful.
- Legacy queue remains available.

If TreeConfig transfer is not applicable:

- Document that no verified live TreeConfig exists.
- Do not create a TreeConfig merely for this migration.
- Proceed with Config consolidation only.

If one queue is created and the second fails:

- Do not deploy partially configured frontend unless explicitly approved.
- Keep both v2 queue IDs unset until both queues are verified.
- Preserve the created queue object for later use.
- Retry the missing queue creation from `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.

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
