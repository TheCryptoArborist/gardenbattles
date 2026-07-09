# Single Player TREE Reward Seasons

Status: planning/spec only. Do not implement payouts, claims, contract changes, or leaderboard season logic from this document until separately approved.

## Product Decision

Garden Battles should split bot play into two clearly different modes:

- Single Player: the current on-chain Garden Bot path. It is ranked, verified, leaderboard eligible, and can be TREE reward-season eligible when a season is active.
- Practice Mode: future no-wallet practice. It is local or non-verified practice only and must never count for rewards, leaderboard records, or TreeDrop claims.

TREE is the recommended reward token for Single Player seasons because it ties directly into Tree Power, TREE Status, Garden Battles identity, NFTree holder utility, and TreeDrop reward claims.

## Mode Split

### Single Player

- On-chain Garden Bot battle mode.
- Ranked and leaderboard eligible.
- TREE reward-season eligible when a season is active.
- Wallet approval required for verified actions.
- Results are verified by transaction digest and on-chain events such as BattleUpdate and BotMoveResolved.
- Verified battle records are deduped by transaction digest and battle ID.

Suggested card copy:

- Single Player
- Ranked Garden Bot battle.
- Leaderboard eligible.
- TREE reward-season eligible when active.
- Wallet approval required.

### Practice Mode

- Fast no-wallet practice mode.
- No wallet prompts per move.
- No SUI rewards.
- No TREE rewards.
- No ranked leaderboard credit.
- No verified battle record.
- No TreeDrop claim eligibility.
- Must never submit records to `/api/battle-records/submit`.

Suggested card copy:

- Practice Mode
- Fast no-wallet practice.
- No rewards.
- No leaderboard credit.

## Reward Asset

- TREE is the primary reward token for Single Player reward seasons.
- SUI can remain separate for other reward programs if desired.
- Single Player TREE rewards reinforce Tree Power and TREE Status.
- Earned TREE should only count toward Tree Power after it is claimed and held in the wallet.
- Pending, estimated, or unclaimed rewards should not be treated as liquid TREE.

## Season Model

Recommended initial model:

- Fixed TREE pool per season.
- Configurable season duration, such as 7 days or 30 days.
- Points determine allocation.
- Rewards become claimable only after season finalization.
- No instant per-win payouts.
- Practice Mode is completely excluded.
- PvP should use a separate leaderboard or reward pool and should not be mixed with Single Player.

## Points Model

Recommended MVP:

- Verified Single Player win: 10 points.
- Loss: 0 points by default.
- Optional participation variant: 1 point per verified loss.
- Minimum battles to qualify: 3.
- Daily counted-win cap: 5 wins per day.
- Optional season counted-win cap if farming pressure appears.
- Practice Mode: 0 points.
- PvP: separate leaderboard or reward pool.

The daily cap should affect reward-counted points, not necessarily the public win/loss record. For example, a player can keep playing after 5 wins in a day, but additional wins may not increase season reward points.

## Reward Formula

Use a pro-rata fixed-pool formula:

```text
wallet reward = TREE season pool * wallet points / total eligible season points
```

Example:

- Pool: 1,000,000 TREE
- Total eligible season points: 10,000
- Wallet points: 250
- Wallet reward: 25,000 TREE

If total eligible season points is 0, the season should finalize with no reward distribution or roll the pool forward according to an approved admin policy.

## Eligibility

Recommended MVP:

- Wallet must hold at least 1 NFTree at season snapshot or finalization.
- Only verified Single Player battle records count.
- Duplicate transaction digests do not count.
- Duplicate battle IDs do not count.
- Practice Mode records do not exist for rewards and do not count.
- Suspicious activity can be reviewed before finalization.

Open eligibility decision:

- Snapshot timing should be approved before launch: season start, season end, finalization time, or all of the above.

## TreeDrop Claim Flow

Recommended flow:

1. Season ends.
2. Backend freezes leaderboard and season points.
3. Admin reviews results and suspicious activity.
4. Final reward CSV or JSON is generated.
5. TreeDrop claim round is created.
6. Eligible wallets claim TREE.
7. Tree Power updates only after claimed TREE appears in the wallet.

TreeDrop should receive finalized reward outputs, not live estimates.

## Anti-Abuse Guardrails

- Fixed reward pool only.
- No unlimited faucet.
- Duplicate transaction digest dedupe.
- Duplicate battle ID dedupe.
- Daily reward-counted win cap.
- Minimum battle requirement.
- NFTree holder eligibility.
- Admin review before claim generation.
- Practice Mode excluded.
- No bot, local, or Arcade-style records counted.
- Verified records only from confirmed on-chain battle events.

## UI Copy

### Battle Page

Single Player:

- Ranked Garden Bot battle.
- Leaderboard eligible.
- TREE reward-season eligible when active.
- Wallet approval required.

Practice Mode:

- Fast no-wallet practice.
- No rewards.
- No leaderboard credit.

### Leaderboard

- Single Player Season
- Verified Garden Bot results only.
- Practice Mode does not count.
- TREE rewards are distributed after the season ends.

### Tree Power Panel

- Single Player Season Points
- Projected TREE Reward
- Estimated until season finalization.
- Claimed TREE counts only once held in wallet.

## Future Additions

- NFTree rarity bonus.
- Full Grove Set collector bonus.
- Cosmetic rewards.
- Canopy Clash eligibility.
- Seasonal badges.
- PvP reward seasons.
- Cross-chain Arcade research later.

## Implementation Roadmap

### Phase 1: Spec and UI Labels

- Approve this spec.
- Rename the current on-chain Garden Bot UX to Single Player.
- Rename future no-wallet mode to Practice Mode.
- Add clear reward-eligibility copy without implementing rewards.

### Phase 2: Backend Season Fields

- Add season ID tagging to verified battle records.
- Add season configuration storage.
- Preserve existing verified digest submission.
- Keep Practice Mode excluded from record submission.

### Phase 3: Leaderboard Season Points Display

- Add Single Player season points to leaderboard views.
- Show current season, season status, and estimated points.
- Keep overall records separate from season reward points.

### Phase 4: Admin Export and Finalization

- Add admin finalization workflow.
- Freeze eligible records.
- Generate reward CSV or JSON.
- Include duplicate and suspicious-activity review.

### Phase 5: TreeDrop Claim Integration

- Use finalized reward outputs to create a TreeDrop claim round.
- Show claim status once TreeDrop data is available.
- Count TREE toward Tree Power only after claim and wallet hold.

### Phase 6: Bonuses

- Add NFTree rarity bonus rules if approved.
- Add Full Grove Set collector bonus if approved.
- Add seasonal cosmetic rewards if approved.

## Open Questions

- Should verified losses receive 0 points or 1 participation point?
- Should the first season use 7 days or 30 days?
- Should NFTree eligibility be checked at season start, season end, finalization, or all three?
- Should reward-counted wins cap at 5 per day for the MVP?
- Should there be a season-wide cap in addition to the daily cap?
- Should suspicious-activity review be manual only for MVP?
- Should TreeDrop claim exports include only wallet and amount, or also rank, points, and season metadata?
- Should PvP reward seasons launch separately after Single Player seasons prove stable?

## Risks

- Players may confuse Practice Mode with reward-eligible Single Player unless labels are very clear.
- TREE reward estimates can be misunderstood as guaranteed payouts before finalization.
- Daily caps may frustrate heavy players if not explained.
- NFTree holder snapshot timing can create disputes if not announced before each season.
- Backend season data must remain deduped by transaction digest and battle ID.
- Admin review must be timely so TreeDrop claims do not feel delayed.
