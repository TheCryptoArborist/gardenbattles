# Battle Card Catalog V2 — Upgrade Readiness

## Scope completed

- The 30-card standard catalog and nine exclusive TREE Power fifth cards use the approved names and effects.
- PvP V3 and Ranked Garden Bot V2 resolve the same catalog rules on-chain.
- Practice Mode mirrors the 30-card standard catalog in the browser.
- Qualified hands deal four balanced standard cards plus a three-card fifth-move draft:
  - one card from offense IDs 31–33;
  - one card from growth IDs 34–36;
  - one card from defense IDs 37–39.
- Battle card text, transaction move resolution, refreshed battle-log recovery, and display labels use the same IDs and names.
- The card interface now has a reusable visual shell with crests, catalog numbers, family colors, trigger badges, and a premium TREE Power treatment.

## Upgrade compatibility

The published `PvpBattleV3`, `RankedBotBattleV2`, and `Status` layouts are unchanged. New catalog-only state is stored as a dynamic field on battles created after the upgrade. This records:

- each fighter's last card;
- shield reflection;
- one-hit armor reduction;
- one-hit attack cap;
- total turns for Natural Growth.

Existing and in-progress battles do not have that dynamic field and continue through the legacy resolver. This avoids changing their rules halfway through a match. Newly created PvP V3 and Ranked Garden Bot V2 battles receive the catalog state and use V2 rules.

## Validation completed

- Sui Move: 100/100 tests passed.
- Frontend: 169/169 tests passed.
- Telegram queue notifier: 27/27 tests passed.
- TypeScript check passed.
- Standard production build passed.
- `/battle/` production-base build passed.
- `git diff --check` passed.

## Contract upgrade rehearsal — next controlled phase

Do not upgrade production directly from this implementation pass. Rehearse with the same admin wallet and package lineage first:

1. Confirm the active mainnet package, upgrade capability, network, and admin wallet without submitting a transaction.
2. Build the exact commit intended for rehearsal and retain the package digest and upgrade policy output.
3. Run the Sui upgrade compatibility check against the current published package.
4. Rehearse on a non-production environment or dry-run transaction path.
5. Create and finish one standard Garden Bot battle, one qualified Garden Bot battle, one four-vs-four PvP battle, and both one-qualified and two-qualified PvP battles.
6. Verify old/in-progress battle objects still resolve through the legacy path.
7. Verify the three-card fifth draft contains only IDs 31–39 and locks atomically with the first played move.
8. Verify payouts, surrender, timeout, queue cancellation, and refunds remain unchanged.
9. Review gas, object changes, events, and abort behavior before authorizing a mainnet upgrade.

## Deliberately deferred

- No Move package upgrade has been submitted.
- No frontend deployment has been made, because the new text must not describe effects that the current production contract does not yet execute.
- Bespoke card illustrations and the user's battle-tree artwork remain an art phase after mechanics and upgrade rehearsal.
- Soft turn-limit settlement is not part of this upgrade; it requires a separate payout/refund design review.
