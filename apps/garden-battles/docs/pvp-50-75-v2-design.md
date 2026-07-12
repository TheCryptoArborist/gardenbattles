# Garden Battles PvP 50/75 v2 Design

**Status:** Draft for design review  
**Implementation status:** Not started  
**Deployment status:** Not authorized  
**Target repository path:** `apps/garden-battles/docs/pvp-50-75-v2-design.md`

## 1. Purpose

Replace the legacy hardcoded 100-Growth PvP matchmaking path with an additive PvP v2 architecture that supports:

- **Quick Match:** 50 Growth
- **Standard Match:** 75 Growth

The design must preserve all existing on-chain objects and operational behavior, including:

- legacy `Battle` objects and 100-Growth PvP completion
- existing bot battles
- current payout and treasury economics
- waiting-player refunds
- surrender, timeout, and administrative close paths
- Telegram queue notifications
- refresh-safe waiting-queue recovery
- refresh-safe active-battle recovery

This document defines architecture only. It does not authorize implementation, package upgrade, frontend deployment, Railway deployment, queue initialization, or mainnet changes.

### Current production context

```text
Current package v6:
0x71a3b321d9db461746b2f9a2427f381e2e3105a80a648bc08c2e5f7c45eed5ef

Legacy matchmaking queue:
0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d

Frontend:
https://nftree.net/battle

Backend:
https://gardenbattles-production.up.railway.app
```

The v2 economic model remains unchanged:

```text
3 SUI entry per player
5 SUI winner payout
1 SUI treasury / TREE buyback share
```

The package, queue, and service identifiers above are deployment context only. The Config ID, UpgradeCap ID, registry ID, and new queue IDs must be read from the actual recovery branch and deployment transactions before any upgrade is prepared.

---

## 2. Current Legacy Baseline

The live-compatible legacy package has these relevant characteristics:

- `battle::Battle` does not store a target.
- `battle::BattleUpdate` does not emit a target.
- `matchmaking::MatchmakingQueue` contains one `Option<Pending>` and one SUI bank.
- `matchmaking::Pending` stores only the player and entry-fee snapshot.
- `battle::use_ability_id` currently resolves victory at:
  - 50 Growth for bot battles
  - 100 Growth for non-bot battles
- `matchmaking::join_queue` creates a legacy `Battle` through `battle::create_battle`.
- Legacy Battle and Queue objects are already live and must remain readable and actionable.

Sui package upgrades require existing public function signatures and existing struct layouts to remain compatible. New structs and functions may be added. Package module initializers do not rerun during an upgrade, so new shared objects require an explicit post-upgrade initialization transaction.

---

## 3. Non-Negotiable Invariants

1. **Do not add fields to `Battle`.**
2. **Do not add fields to `BattleUpdate`.**
3. **Do not add fields to `MatchmakingQueue` or `Pending`.**
4. **Do not change existing public function signatures.**
5. **Do not migrate or rewrite live legacy Battle objects.**
6. **Legacy non-bot Battles continue to finish at 100 Growth.**
7. **Legacy bot Battles continue to finish at 50 Growth.**
8. **A 50-Growth player can never match a 75-Growth player.**
9. **The selected target must be stored on-chain in the new battle object.**
10. **The selected target must be present in new battle and queue events.**
11. **Payout amounts are snapshotted from the existing Config at battle creation.**
12. **Queue cancellation always returns the exact waiting-player fee snapshot.**
13. **Disabling PvP v2 must not prevent refunds or settlement of active v2 battles.**
14. **The frontend must recover chain state before presenting a new deposit action.**
15. **No production publish, upgrade, initialization, or deployment occurs before design and test review approval.**

---

## 4. Chosen Architecture

PvP v2 is an additive extension within the existing package:

```text
battle module
├── Battle                         legacy, unchanged
├── BattleUpdate                   legacy, unchanged
├── PvpBattleV2                    new
└── PvpBattleV2Update              new

matchmaking module
├── MatchmakingQueue               legacy, unchanged
├── Pending                        legacy, unchanged
├── PvpV2Registry                  new
├── MatchmakingQueue50             new
├── MatchmakingQueue75             new
├── PendingV2                      new
└── PvP v2 queue events            new
```

`PvpBattleV2` should be added to the existing `battle` module rather than a separate battle module. This permits reuse of the module-private move generation, move resolution, status, damage, payout, and timeout logic without duplicating game mechanics.

The legacy `Battle` implementation remains logically separate. Shared helper refactoring is permitted only when deterministic regression tests prove legacy behavior is unchanged.

---

## 5. On-Chain Data Model

### 5.1 Constants

Production code should define fixed supported targets:

```move
const PVP_V2_RULES_VERSION: u64 = 2;
const QUICK_TARGET_GROWTH: u64 = 50;
const STANDARD_TARGET_GROWTH: u64 = 75;
```

No caller-selected arbitrary target is permitted.

### 5.2 `PvpBattleV2`

Recommended layout:

```move
public struct PvpBattleV2 has key {
    id: UID,
    rules_version: u64,
    target_growth: u64,

    player1: address,
    player2: address,
    p1_growth: u64,
    p2_growth: u64,
    turn: u8,
    finished: bool,
    winner: Option<address>,

    p1_moves: vector<u8>,
    p2_moves: vector<u8>,
    p1_status: Status,
    p2_status: Status,

    vault: Balance<SUI>,
    battle_entry_fee: u64,
    winner_payout: u64,
    treasury_share: u64,
    treasury_addr: address,

    last_move_ms: u64,
}
```

Design rules:

- `target_growth` must be exactly 50 or 75.
- `rules_version` is stored for future parsing and migration decisions.
- PvP v2 is PvP-only, so an `is_bot_battle` field is unnecessary.
- Growth remains clamped to the existing maximum of 100, not to the match target. Overshoot remains visible, such as `55/50`, while victory is determined by `growth >= target_growth`.
- Economics are copied from Config at creation exactly as legacy PvP does.
- The vault contains both players' entry fees.

### 5.3 `PvpBattleV2Update`

Recommended event:

```move
public struct PvpBattleV2Update has copy, drop {
    battle_id: ID,
    rules_version: u64,
    target_growth: u64,
    player1: address,
    player2: address,
    player1_moves: vector<u8>,
    player2_moves: vector<u8>,
    player1_growth: u64,
    player2_growth: u64,
    turn: u8,
    finished: bool,
    winner: Option<address>,
    last_move_ms: u64,
}
```

The event must be emitted:

- when a v2 battle is created
- after every completed player action
- after surrender
- after timeout settlement
- after administrative refund close
- after administrative winner close

The object remains the source of truth. Events are discovery and notification indexes, not authoritative state.

### 5.4 `PendingV2`

Recommended layout:

```move
public struct PendingV2 has copy, drop, store {
    player: address,
    entry_fee_snapshot: u64,
    target_growth: u64,
    entry_sequence: u64,
    joined_at_ms: u64,
}
```

`entry_sequence` is monotonically increased by its queue. It gives the Telegram notifier a stable restart-safe deduplication key and distinguishes a later re-entry by the same wallet.

### 5.5 `MatchmakingQueue50`

Recommended layout:

```move
public struct MatchmakingQueue50 has key {
    id: UID,
    rules_version: u64,
    target_growth: u64,
    enabled: bool,
    next_entry_sequence: u64,
    waiting: Option<PendingV2>,
    bank: Balance<SUI>,
}
```

Invariant:

```text
target_growth == 50
```

### 5.6 `MatchmakingQueue75`

Same layout and behavior as Queue50, with the invariant:

```text
target_growth == 75
```

The queue types are intentionally distinct. A transaction accepting `&mut MatchmakingQueue50` cannot accidentally receive Queue75, and vice versa.

### 5.7 `PvpV2Registry`

Recommended shared registry:

```move
public struct PvpV2Registry has key {
    id: UID,
    rules_version: u64,
    enabled: bool,
    queue_50_id: ID,
    queue_75_id: ID,
    waiting_memberships: Table<address, u64>,
}
```

Responsibilities:

- identify the canonical Queue50 and Queue75 object IDs
- act as the master switch for new v2 joins
- prevent the same wallet from waiting in both target queues
- provide a stable object for frontend and backend configuration verification

The registry tracks waiting membership only. It does not gate active battle actions. This avoids making every move depend on a global shared registry and ensures active battle settlement remains available during a rollback.

---

## 6. One-Time Queue Initialization

### 6.1 Why explicit initialization is required

An upgrade does not rerun package `init` functions. Queue50, Queue75, and the registry must therefore be created in an explicit, admin-authorized transaction after the package upgrade.

### 6.2 Initialization guard

The existing Config layout cannot change. The recommended one-time guard is an additive dynamic-field marker attached to the existing Config UID through a new function inside the `config` module.

Conceptual API:

```move
public(package) fun claim_pvp_v2_initialization(
    config: &mut Config,
    ctx: &mut TxContext,
)
```

This function must:

1. verify `tx_context::sender(ctx) == config.admin`
2. verify the PvP v2 initialization marker does not exist
3. add the marker to Config
4. abort on every later initialization attempt

Because the entire transaction is atomic, a failure while creating or sharing any queue also rolls back the marker.

### 6.3 Initialization entry point

Conceptual entry function:

```move
public entry fun initialize_pvp_v2(
    config: &mut Config,
    ctx: &mut TxContext,
)
```

It creates and shares:

- one `MatchmakingQueue50`
- one `MatchmakingQueue75`
- one `PvpV2Registry`

It emits:

```move
public struct PvpV2Initialized has copy, drop {
    rules_version: u64,
    registry_id: ID,
    queue_50_id: ID,
    queue_75_id: ID,
}
```

The transaction digest and all three object IDs must be recorded in the deployment runbook before any frontend or backend configuration changes.

The registry, Queue50, and Queue75 IDs cannot be proposed as literal values during design because Sui assigns them when the initialization transaction creates the objects. The review package should therefore define configuration keys now and populate their values only from the verified initialization transaction output.

---

## 7. Matchmaking Entry Points

Use target-specific function names. Do not expose a generic arbitrary-target public entry function.

Recommended direct-NFT functions:

```text
join_queue_50
join_queue_75
cancel_queue_50
cancel_queue_75
```

Recommended kiosk functions:

```text
join_queue_50_from_kiosk
join_queue_75_from_kiosk
```

Recommended administrative functions:

```text
set_pvp_v2_enabled
set_queue_50_enabled
set_queue_75_enabled
admin_refund_queue_50_waiter
admin_refund_queue_75_waiter
withdraw_queue_50_surplus
withdraw_queue_75_surplus
```

### 7.1 Join algorithm

Each target-specific join function must:

1. verify Config is not globally paused
2. verify registry and target queue are enabled
3. verify the queue ID matches the canonical ID stored in the registry
4. verify the queue rules version and target invariant
5. verify the NFT collection is whitelisted
6. verify payment equals the current Config entry fee
7. verify sender has no existing waiting membership in the registry
8. deposit the payment into the target queue bank
9. if no player is waiting:
   - increment `next_entry_sequence`
   - create `PendingV2`
   - add sender to `waiting_memberships`
   - emit a waiting event
10. if a player is waiting:
   - extract the existing pending record
   - verify the opponent differs from sender
   - verify the pending fee snapshot equals the current entry fee
   - remove the waiting opponent from `waiting_memberships`
   - split exactly two entry fees from the queue bank
   - create a `PvpBattleV2` with the queue's fixed target
   - emit matched and battle-created/update events

The second player is never placed in waiting membership because the battle is created in the same transaction.

### 7.2 Fee change behavior

Preserve the existing safety rule:

```text
pending.entry_fee_snapshot must equal the current Config entry fee
```

If economics change while a player is waiting, a second join aborts rather than mixing fee schedules. The waiting player retains access to cancellation and an exact refund.

### 7.3 Cancellation algorithm

Cancellation must remain available even when:

- the registry is disabled
- the target queue is disabled
- Config is paused
- the frontend has hidden new matchmaking

Cancellation must:

1. verify a pending record exists
2. verify sender is the pending player
3. extract the pending record
4. remove sender from registry waiting membership
5. split exactly `entry_fee_snapshot` from the queue bank
6. transfer the refund to sender
7. emit a cancellation event containing target and entry sequence

### 7.4 Administrative waiter refund

An admin-only recovery function must refund the actual pending player, never the admin or treasury. It is used only when the normal user cancellation path is inaccessible or during an operational rollback.

---

## 8. Queue Events

Recommended events:

```move
public struct PvpV2QueueWaiting has copy, drop {
    registry_id: ID,
    queue_id: ID,
    player: address,
    target_growth: u64,
    entry_fee_snapshot: u64,
    entry_sequence: u64,
    joined_at_ms: u64,
}

public struct PvpV2QueueMatched has copy, drop {
    registry_id: ID,
    queue_id: ID,
    battle_id: ID,
    player1: address,
    player2: address,
    target_growth: u64,
    entry_sequence: u64,
}

public struct PvpV2QueueCancelled has copy, drop {
    registry_id: ID,
    queue_id: ID,
    player: address,
    target_growth: u64,
    refunded_amount: u64,
    entry_sequence: u64,
}
```

Only `PvpV2QueueWaiting` triggers a Telegram "player is waiting" notification. A second player who immediately creates a match must not produce a waiting alert.

---

## 9. PvP v2 Battle Functions

Recommended functions:

```text
create_pvp_battle_v2          package-restricted factory
use_pvp_v2_ability
use_pvp_v2_ability_id
surrender_pvp_v2
claim_pvp_v2_timeout_win
admin_force_close_pvp_v2
admin_force_close_pvp_v2_with_winner
```

### 9.1 Creation

The factory must:

- accept only target 50 or 75
- reject identical player addresses
- generate independent four-move hands using the current move-generation rules
- snapshot entry fee, payout, treasury share, and treasury address
- initialize growth and statuses to zero
- set `last_move_ms`
- emit `PvpBattleV2Update`
- share the battle object
- return or expose the new battle ID so matchmaking can emit `PvpV2QueueMatched`

### 9.2 Victory condition

Every v2 action path uses the stored value:

```move
if (battle.p1_growth >= battle.target_growth) { ... }
if (battle.p2_growth >= battle.target_growth) { ... }
```

There must be no hardcoded 50 or 75 inside turn-resolution branches other than target validation constants.

### 9.3 Payout and refunds

Use the same accounting semantics as legacy PvP:

- winner receives the snapshotted winner payout
- treasury receives the snapshotted treasury share
- any valid remainder follows the existing payout rule
- administrative no-winner close refunds both players using the existing split behavior

No new fee, tax, reward token, or payout schedule is introduced by PvP v2.

### 9.4 Timeout

PvP v2 uses the current non-bot PvP timeout. Timeout logic must use the battle's stored `last_move_ms` and remain callable when new matchmaking is disabled.

### 9.5 Feature parity review

Before implementation, inventory the active recovery branch for every feature that accepts `&mut Battle`, including any TREE utility, reroll, boost, or administrative function added after the remote baseline. Each feature must be classified as:

- required on `PvpBattleV2` before launch
- intentionally legacy-only with documented rationale
- deferred and therefore launch-blocking

PvP v2 must not silently remove a live player capability.

---

## 10. Legacy Compatibility and Migration

### 10.1 No object migration

There is no conversion of:

- legacy `Battle` to `PvpBattleV2`
- legacy `MatchmakingQueue` to Queue50 or Queue75
- legacy `Pending` to `PendingV2`

Legacy objects continue under legacy rules.

### 10.2 Legacy waiting queue

At rollout:

- a wallet already waiting in the legacy queue keeps its 100-Growth queue state
- it can still be matched under legacy rules or cancel for a refund
- the frontend must continue to recover and display the legacy waiting state
- the frontend must not deposit that wallet into Queue50 or Queue75 while legacy waiting state exists

The legacy queue ID remains in configuration for recovery and refunds even after new v2 matchmaking becomes the normal entry path.

### 10.3 Legacy active battles

Active legacy battle discovery and hydration remain unchanged. A non-bot legacy Battle displays a 100-Growth target inferred from its type and legacy rules. A legacy bot Battle displays 50 Growth.

### 10.4 Object-type discrimination

Frontend and backend parsers must branch by actual object type:

```text
battle::Battle       -> legacy parser
battle::PvpBattleV2  -> v2 parser using stored target_growth
```

Do not infer v2 target from frontend selection, queue ID, transaction history, or URL state once a battle object exists.

---

## 11. Frontend Design

### 11.1 Configuration

Add, while retaining all legacy IDs:

```text
PVP_V2_ENABLED
PVP_V2_REGISTRY_ID
MATCHMAKING_QUEUE_50_ID
MATCHMAKING_QUEUE_75_ID
LEGACY_MATCHMAKING_QUEUE_ID
```

The transaction package ID and canonical/original package ID must remain distinct where the current Sui integration requires them. Event-type filtering must be verified against actual testnet emissions after upgrade rather than assumed.

### 11.2 Mode selector

PvP mode selection presents:

```text
Quick Match
First to 50 Growth

Standard Match
First to 75 Growth
```

No 100-Growth option is offered for new v2 matchmaking. Legacy 100-Growth state appears only during recovery of existing queue or battle objects.

### 11.3 Pre-wallet approval

Before invoking the wallet, the confirmation panel must show:

- selected mode name
- exact target, 50 or 75 Growth
- current entry fee read from chain/config
- current payout summary
- NFTree used for eligibility
- target queue identity in diagnostic details

The Move calls are target-specific (`join_queue_50` or `join_queue_75`) so the submitted transaction cannot be silently redirected by a mutable frontend target parameter.

### 11.4 Recovery priority

On wallet connect and refresh, resolve state in this order:

```text
Active v2 or legacy Battle
>
Waiting in legacy, Queue50, or Queue75
>
Normal mode selection
```

Recovery must query all supported object/event types before enabling a deposit button.

If inconsistent state is found, such as multiple active battles or waiting in more than one queue, the frontend must:

- block new deposits
- show all discovered object IDs
- provide safe recovery actions
- never choose a state silently

### 11.5 Waiting panel

The waiting panel must show:

- `Quick Match — 50 Growth` or `Standard Match — 75 Growth`
- entry fee deposited
- queue object ID in expandable diagnostics
- refund action
- current recovery status

Use one waiting message only:

```text
Waiting for an opponent to join.
```

Remove duplicate variants such as both "Waiting for your opponent..." and "Waiting for your opponent to move."

### 11.6 Battle hydration

The normalized frontend battle model should include:

```ts
type BattleVersion = "legacy" | "pvp-v2";

type HydratedBattle = {
  version: BattleVersion;
  objectId: string;
  targetGrowth: 50 | 75 | 100;
  // existing player, move, growth, turn, winner, timeout fields
};
```

For v2, `targetGrowth` comes from the object. For legacy, it is inferred from legacy object fields and rules.

### 11.7 Battle log

PvP v2 does not solve the existing battle-log data gap by fabrication. If the exact opponent move is unavailable, display a truthful effect-based fallback derived from before/after state, or state that the move detail is unavailable. Never invent an ability name.

---

## 12. Telegram Monitoring

### 12.1 Monitored sources

The notifier must support:

- legacy queue monitoring during migration
- Queue50 monitoring
- Queue75 monitoring

The v2 notifier should prefer `PvpV2QueueWaiting` events and verify the queue object's current pending state before sending when practical. Direct object polling remains a recovery fallback.

### 12.2 Alert content

Recommended message:

```text
⚔️ A player is waiting in the Garden Battles arena!

Match: Quick Match
Target: 50 Growth
Entry: 3 SUI

Open the arena:
https://nftree.net/battle
```

For Queue75:

```text
Match: Standard Match
Target: 75 Growth
```

The entry amount must come from the event's fee snapshot or verified queue state, not a hardcoded server string.

### 12.3 Deduplication

Recommended SQLite deduplication key:

```text
network + queue_id + entry_sequence
```

Persist:

- event transaction digest and sequence when available
- queue ID
- target growth
- waiting player
- entry sequence
- sent timestamp

A cancellation followed by a later re-entry by the same wallet must produce a new alert because the entry sequence changes.

### 12.4 Feature flags

Add independent operational flags:

```text
ENABLE_PVP_V2_QUEUE_TELEGRAM=true|false
ENABLE_LEGACY_QUEUE_TELEGRAM=true|false
```

Disabling Telegram monitoring must not affect matchmaking.

---

## 13. Deterministic Move Tests

All existing legacy tests remain and must pass unchanged. Add deterministic tests for PvP v2.

### 13.1 Required test support

Use test-only constructors or fixtures that can inject known move hands. Production randomness must not be weakened or replaced for test convenience.

### 13.2 Battle tests

Required cases:

1. Quick Match stores `target_growth == 50`.
2. Standard Match stores `target_growth == 75`.
3. Unsupported targets abort.
4. Quick Match does not finish at 49.
5. Quick Match finishes at exactly 50.
6. Quick Match also finishes on overshoot, such as 55.
7. Standard Match does not finish at 74.
8. Standard Match finishes at exactly 75.
9. Standard Match also finishes on overshoot.
10. Growth remains clamped at 100.
11. `PvpBattleV2Update` contains the target on creation and every update.
12. Winner payout equals Config snapshot.
13. Treasury share equals Config snapshot.
14. Surrender settles correctly.
15. Timeout settles correctly.
16. Administrative no-winner close refunds both players.
17. Administrative winner close uses normal payout semantics.
18. Active battle functions remain callable when registry/queues are disabled.

### 13.3 Matchmaking tests

Required cases:

1. Queue50 initialization stores target 50.
2. Queue75 initialization stores target 75.
3. initialization cannot execute twice against the same Config.
4. first Queue50 player becomes pending.
5. second Queue50 player creates a 50-Growth battle.
6. first Queue75 player becomes pending.
7. second Queue75 player creates a 75-Growth battle.
8. Queue50 pending player is not consumed by Queue75 join.
9. Queue75 pending player is not consumed by Queue50 join.
10. one wallet cannot wait in both queues.
11. a wallet cannot match itself.
12. wrong payment aborts without changing queue bank or membership.
13. fee change prevents matching against an old snapshot.
14. cancellation refunds the exact snapshot.
15. cancellation clears membership.
16. cancellation works while queue and registry are disabled.
17. admin recovery refunds the pending player.
18. waiting event includes target and entry sequence.
19. matched event includes target and battle ID.
20. queue bank has no unexplained residual balance after match/refund scenarios.

### 13.4 Legacy regression tests

Required cases:

1. Legacy PvP still requires 100 Growth.
2. Legacy bot battle still requires 50 Growth.
3. Existing legacy Battle object layout compiles unchanged.
4. Existing legacy MatchmakingQueue layout compiles unchanged.
5. Existing payout, timeout, surrender, and refund tests still pass.

---

## 14. Package Upgrade Plan

### Phase 0 — Design review

- approve this architecture
- inspect the actual local recovery branch status
- inventory uncommitted frontend and Move changes
- inventory all current functions that operate on legacy `Battle`
- resolve all open review questions in Section 17

### Phase 1 — Additive implementation

- add new structs, events, constants, and functions
- do not change existing struct layouts or public signatures
- add deterministic tests
- add frontend parsers behind a disabled feature flag
- add Telegram support behind a disabled feature flag

### Phase 2 — Local validation

Run at minimum:

```powershell
sui move build
sui move test
npm.cmd run check
npm.cmd run build
npx.cmd vite build --base /battle/
npm.cmd run test:telegram
```

Also perform the Sui CLI upgrade-compatibility check against the exact currently published package and UpgradeCap before any testnet or mainnet transaction.

### Phase 3 — Testnet rehearsal

Use a testnet package and fresh objects to validate:

- one-time initialization
- queue IDs and registry ID capture
- two-wallet Queue50 match
- two-wallet Queue75 match
- cancellation and refund
- fee-change behavior
- active battle refresh recovery
- timeout/surrender/admin close
- event discovery
- Telegram deduplication across process restart
- frontend wallet confirmation and target display

### Phase 4 — Mainnet upgrade review

Before authorization, produce a runbook containing:

- exact git commit
- Move build/test output
- upgrade compatibility output
- package UpgradeCap ID
- current package ID and original package ID
- Config ID
- legacy queue ID
- expected initialization transaction
- rollback operator and wallet
- frontend and backend feature-flag values
- testnet evidence

### Phase 5 — Mainnet execution

Only after explicit approval:

1. pause frontend release changes, not necessarily the on-chain Config
2. upgrade the package
3. verify upgrade transaction and package linkage
4. call one-time `initialize_pvp_v2`
5. record registry, Queue50, and Queue75 IDs
6. verify object fields and emitted initialization event
7. configure backend with v2 monitoring disabled
8. deploy frontend with v2 hidden but recovery parsers enabled
9. perform controlled mainnet smoke tests
10. enable Telegram v2 monitoring
11. enable the PvP v2 selector

No combined "upgrade and instantly open to all users" transaction or deployment is permitted.

---

## 15. Rollback Plan

A Sui package upgrade cannot be deleted. Rollback therefore means disabling new v2 entry and reverting application routing while preserving user exits and settlement.

### 15.1 On-chain rollback

Admin actions:

1. set `PvpV2Registry.enabled = false`
2. set Queue50 and Queue75 `enabled = false`
3. leave both cancellation functions enabled
4. leave all active `PvpBattleV2` action and settlement functions enabled
5. if necessary, use admin waiter-refund functions to clear pending queues
6. do not withdraw queue-bank funds until pending state is proven empty

Global Config pause is reserved for a broader incident because it also affects legacy and bot flows.

### 15.2 Frontend rollback

Set:

```text
PVP_V2_ENABLED=false
```

Then:

- hide Quick/Standard deposit actions
- retain v2 queue recovery and refund panels
- retain v2 active-battle hydration and controls
- retain legacy recovery
- show an operational notice only when needed

Never remove v2 parsers while v2 objects may still be live.

### 15.3 Telegram rollback

Set:

```text
ENABLE_PVP_V2_QUEUE_TELEGRAM=false
```

Keep SQLite deduplication data. Do not delete it, or old entries may be resent when monitoring is re-enabled.

### 15.4 Code rollback

A later corrective package upgrade may fix v2 logic, but it must remain layout-compatible with all types introduced by this version. Existing v2 object layouts become permanent compatibility obligations after mainnet creation.

---

## 16. Acceptance Criteria

Architecture is ready for implementation only when reviewers agree that:

- legacy object layouts and public signatures are untouched
- Queue50 and Queue75 are type-isolated
- target is fixed, stored, validated, and emitted
- one-time initialization cannot be repeated
- same-wallet cross-queue waiting is blocked
- refunds work while matchmaking is disabled
- active battles settle without registry or queue enablement
- frontend recovers legacy and v2 states before allowing deposits
- Telegram obtains target from on-chain data
- deterministic tests cover exact thresholds and overshoot
- rollback preserves every user exit path

Implementation is ready for deployment review only when all Move, TypeScript, frontend build, recovery, two-wallet, refund, event, and Telegram restart tests pass.

---

## 17. Design Review Questions

These items require an explicit answer before coding begins:

1. **Feature parity:** Which current TREE utility, reroll, boost, or other post-baseline Battle functions must support `PvpBattleV2` at launch?
2. **Legacy queue wind-down:** Should the frontend permit new 100-Growth legacy matches temporarily, or recovery/refund only?
3. **Mode default:** Should Quick Match be preselected, or should the user be forced to select 50 or 75 each session?
4. **Admin recovery:** Is an admin waiter-refund function acceptable, provided funds can only return to the recorded pending player?
5. **Operational ownership:** Which wallet controls initialization and v2 enable/disable actions?
6. **Event retention:** Should the backend retain both event-based discovery and direct-object polling permanently, or only during migration?

No implementation should begin until Questions 1, 2, 4, and 5 are resolved.

---

## 18. Recommended Decision Summary

Recommended approval position:

- approve additive `PvpBattleV2`
- approve distinct `MatchmakingQueue50` and `MatchmakingQueue75`
- approve stored and emitted `target_growth`
- approve `PvpV2Registry` for canonical IDs, enablement, and cross-queue waiting protection
- approve dynamic-field one-time initialization guard on existing Config
- approve event sequence-based Telegram deduplication
- approve recovery-first frontend routing
- approve operational rollback by disabling joins while preserving refunds and settlement
- defer all implementation and deployment until the active local branch is inspected and the design questions are signed off



---

## 19. Current Review Gate

This specification is complete enough for architecture review, but implementation must begin only from the actual local recovery branch after these checks are captured:

```powershell
git status --short
git diff --stat
git log -5 --oneline
```

The implementation checkpoint must keep existing frontend recovery work, test-only Move changes, and PvP v2 production changes in separately reviewable diffs. No commit, publish, deployment, Railway variable change, or mainnet initialization is authorized by this document.
