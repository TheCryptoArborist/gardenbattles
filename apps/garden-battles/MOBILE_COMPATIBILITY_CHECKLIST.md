# Mobile Compatibility Checklist

Mobile support is a core release requirement for Garden Battles and NFTree. Every UI change must be reviewed for mobile before it is considered production-ready.

## Required Viewports

- [ ] 320px
- [ ] 375px
- [x] 390px
- [ ] 414px
- [ ] 768px
- [ ] Desktop

## Reviewed Pages And Components

| Area | Reviewed | Mobile issues found | Fixes applied | Remaining mobile risks | Mobile-ready |
| --- | --- | --- | --- | --- | --- |
| Battle screen layout | Partial | Battle view is visually dense and can crowd small screens. | Existing battle grid uses responsive sizing and overflow-x is hidden. Local 390x844 check showed 0 horizontal overflow. | 320, 375, 414, 768, desktop, and real-device review still required. | Partial |
| Battle move cards | Partial | Four cards can become tight on narrow phones. | Existing grid uses auto-fit responsive columns. | Confirm touch spacing and text wrapping at 320px. | No |
| Battle log | Yes | New log entries previously scrolled the whole page after moves. | Log now scrolls internally instead of forcing the page to the bottom. Local wallet-connected test confirmed player and Garden Bot actions are separated. | Confirm momentum scrolling and readability on iOS/Android. | Partial |
| Garden Bot round feedback | Yes | Bot responses were easy to miss because they happen inside the same wallet-confirmed move. | Added a separate Garden Bot response log row after each player move, plus round-result detail text showing both growth totals. Local wallet-connected test confirmed the Garden Bot response appears as a separate action. | Exact bot move names require a future contract event upgrade. | Partial |
| Garden Bot stalled hands | Yes | Attack-heavy hands can feel useless when Garden Bot is already at 0 Growth because attack moves cannot reduce Growth below zero. | Added a visible stalled-attack warning, bad-hand detector that counts only real self-growth moves, hand summary, and a touch-friendly New Bot Hand escape control for practice battles. Local wallet-connected test confirmed the 0 Growth warning and New Bot Hand control. | Paid TREE reroll still requires the on-chain TreeConfig object and utility coin settings before wiring the real reroll call. | Partial |
| Battle move loading state | Yes | Move cards could disappear if the active battle state existed before moves were populated. | Battle controls now remain visible and show a chain-loading message when no move cards are available. | Needs live preview test against a slow RPC response. | Partial |
| Winner panel | Yes | New winner/share panel started as a desktop two-column layout. | Changed to responsive auto-fit grid with 44px minimum share controls. | Needs visual review with actual winner state on phone widths. | Partial |
| Share controls | Yes | Social share buttons needed practical tap targets. | Added minimum touch target sizing and wrapping buttons. | Native mobile share sheet needs real-device check. | Partial |
| Wallet connection flow | Partial | Wallet connect worked in preview, but Garden Bot start stayed on an old completed battle after confirmation. | Garden Bot start now clears stale finished state, waits for the confirmed transaction, and applies the new battle from the transaction event. Local wallet-connected Garden Bot UI test passed at `http://localhost:5000/battle`. | Mobile wallet/deep-link flow still requires real-device testing. | Partial |
| Header and navigation | Not yet | Header may crowd wallet/account controls on phones. | None yet. | Needs mobile navigation review and possibly collapsed menu. | No |
| How-to-play panel | Not yet | Panel may be too text-heavy on small screens. | None yet. | Needs shorter mobile copy or collapsible sections. | No |
| Admin/config panels | Not yet | Unknown. | None yet. | Must verify forms, buttons, and modal behavior on phones. | No |
| Leaderboard/tournament views | Not yet | Unknown. | None yet. | Wide ranking data should become cards or horizontal scroll. | No |

## NFTree / TREE Visual Alignment

- [ ] NFTree/TREE palette applied to Garden Battles header/theme. Status: in progress; pending visual QA.
- [ ] Deep forest / dark teal background retained. Status: in progress; pending visual QA.
- [ ] Bright TREE green primary accent used. Status: in progress; pending visual QA.
- [ ] Cyan/teal secondary accent used. Status: in progress; pending visual QA.
- [ ] Gold/yellow highlight available. Status: in progress; pending visual QA.
- [ ] Orange warning/accent retained for warnings. Status: in progress; pending visual QA.
- [ ] Soft mint/white text remains readable. Status: in progress; pending visual QA.
- [ ] Muted mint/green secondary text remains readable. Status: in progress; pending visual QA.
- [ ] Translucent dark panels with glow/border accents used. Status: in progress; pending visual QA.
- [ ] CSS variables/theme tokens preferred over scattered hardcoded colors. Status: in progress for the header/theme pass; broader app hardcoded colors remain.
- [ ] Mobile contrast checked at 320px. Status: pending visual QA.
- [ ] Mobile contrast checked at 360px. Status: pending visual QA.
- [ ] Mobile contrast checked at 390px. Status: pending visual QA.
- [ ] Mobile contrast checked at 414px. Status: pending visual QA.
- [ ] Mobile contrast checked at 430px. Status: pending visual QA.
- [ ] Battle identity preserved; do not blindly copy NFTree layout. Status: pending visual QA.
- [ ] Left logo/token area preserved exactly as-is. Status: pending visual QA.
- [ ] Connect Wallet remains visible up top. Status: pending disconnected and connected-wallet visual QA.
- [ ] Get Refund remains visible up top if it fits. Status: pending disconnected and connected-wallet visual QA.
- [ ] TREE ecosystem links remain usable on desktop. Status: pending visual QA.
- [ ] TREE ecosystem links collapse cleanly on mobile. Status: pending menu interaction QA.

## Garden Bot Visual Evolution + Animation

### Visual Concept

- [ ] 4-stage Garden Bot evolution system documented. Status: concept documented; pending implementation plan.
- [ ] Stage 1 robotic seedling concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 2 young biomechanical tree concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 3 powered guardian concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 4 final titan concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Visual style aligns with Garden Battles, TREE, and NFTree. Status: pending art direction review.
- [ ] These are concept references only, not final production assets yet. Status: documented.

### Gameplay Mapping

- [ ] Define what triggers each stage. Status: pending design decision.
- [ ] Decide whether stages are tied to Garden Bot growth amount. Status: pending design decision.
- [ ] Decide whether stages are tied to turn count. Status: pending design decision.
- [ ] Decide whether stages are tied to battle phase. Status: pending design decision.
- [ ] Decide whether stages are visual-only or affect gameplay. Status: pending design decision.
- [ ] Define exact thresholds for Stage 1 -> 2 -> 3 -> 4. Status: pending design decision.

### Asset Requirements

- [ ] Final production art selected for all 4 stages. Status: pending.
- [ ] Transparent PNG/WebP or optimized game assets prepared. Status: pending.
- [ ] Mobile-friendly asset sizes prepared. Status: pending.
- [ ] Desktop-friendly asset sizes prepared. Status: pending.
- [ ] Asset naming/file structure standardized. Status: pending.
- [ ] Legacy placeholder art identified for replacement. Status: pending.

### Animation Requirements

- [ ] Stage 1 idle animation planned. Status: pending.
- [ ] Stage 2 idle animation planned. Status: pending.
- [ ] Stage 3 idle animation planned. Status: pending.
- [ ] Stage 4 idle animation planned. Status: pending.
- [ ] Transition animation planned between stages. Status: pending.
- [ ] Hit/growth/defend/utility reactions planned. Status: pending.
- [ ] Victory/defeat animation considered. Status: pending.
- [ ] Animation performance considered for mobile. Status: pending.
- [ ] Reduced-motion fallback considered. Status: pending.

### UI Integration

- [ ] Stage art displays correctly in Garden Bot battle state. Status: pending visual QA.
- [ ] Stage art does not break player/opponent layout. Status: pending visual QA.
- [ ] Stage art does not cause horizontal overflow on mobile. Status: pending visual QA.
- [ ] Stage art works with the battle log, move cards, and warning panels. Status: pending visual QA.
- [ ] Stage art can be tested at 320/360/390/414/430 widths. Status: pending visual QA.
- [ ] Stage art can be tested on tablet and desktop. Status: pending visual QA.

### QA

- [ ] All 4 stages reviewed in static preview. Status: pending.
- [ ] All 4 stages reviewed in active Garden Bot battle state. Status: pending.
- [ ] Stage transitions tested locally. Status: pending.
- [ ] Mobile QA completed. Status: pending.
- [ ] Final art direction approved before production merge. Status: pending.

## Garden Battles Visual Theme / Recovered Concept Direction

### Home / Mode Selection

- [ ] Garden Battles home screen supports Garden Bot mode. Status: partially exists; pending concept-aligned visual pass.
- [ ] Garden Battles home screen supports PvP Battle mode. Status: partially exists; pending concept-aligned visual pass.
- [ ] Garden Battles home screen documents Canopy Clash as a future tournament mode. Status: pending.
- [ ] Mode cards visually match the recovered concept direction. Status: pending visual QA.
- [ ] Big Garden Battles logo treatment is preserved. Status: partially exists; pending visual QA.
- [ ] Active battle/status strip is represented. Status: pending visual design.
- [ ] How To Play panel remains accessible and mobile-safe. Status: pending visual QA.

### Battle Arena Layout

- [ ] Battle screen follows dark forest / neon arena theme. Status: in progress; pending visual QA.
- [ ] Player tree and opponent/Garden Bot tree are visually prominent. Status: partially exists; pending visual QA.
- [ ] Turn counter is visible. Status: pending.
- [ ] Timer is visible if active. Status: pending.
- [ ] Move cards are readable and visually distinct. Status: partially exists; pending visual QA.
- [ ] Battle activity log is readable and scrollable. Status: partially exists; pending visual QA.
- [ ] Warning panels remain readable. Status: partially exists; pending visual QA.
- [ ] Mobile layout does not overflow. Status: pending visual QA for this theme pass.

### TREE Power / Utility Panel

- [ ] TREE Power panel concept documented. Status: concept documented; pending implementation plan.
- [ ] Buy TREE action documented. Status: concept documented; header link exists, panel integration pending.
- [ ] Reroll action documented. Status: concept documented; live behavior needs separate wallet/chain review.
- [ ] Move swap / utility action documented. Status: concept documented; pending design decision.
- [ ] TREE balance display documented. Status: partially exists through connected-wallet TREE status; panel integration pending.
- [ ] Confirm which actions are live vs placeholders. Status: pending.

### Prize & Payout Panel

- [ ] Prize & Payout panel concept documented. Status: concept documented; pending implementation plan.
- [ ] Entry amount display documented. Status: partially exists; panel integration pending.
- [ ] Winner payout display documented. Status: partially exists; panel integration pending.
- [ ] Treasury amount display documented. Status: pending.
- [ ] TREE sink/removal display documented. Status: pending.
- [ ] Confirm which values are informational vs wired to live data. Status: pending.

### Growth Stage Visuals

- [ ] Player tree 4-stage growth system documented. Status: partially exists; pending visual QA and asset review.
- [ ] Garden Bot 4-stage evolution system documented. Status: concept documented; pending implementation plan.
- [ ] Stage thresholds still need definition. Status: pending design decision.
- [ ] Confirm whether stage changes are visual-only or gameplay-affecting. Status: pending design decision.
- [ ] Confirm whether stages are tied to growth amount, turn count, or battle phase. Status: pending design decision.

### Garden Bot Stage Art

- [ ] Stage 1 robotic seedling concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 2 young biomechanical tree concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 3 powered guardian concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Stage 4 final titan concept documented. Status: concept documented; reference only, not a production asset.
- [ ] Final production assets still pending. Status: pending.
- [ ] Asset naming and folder structure still pending. Status: pending.

### Animation Direction

- [ ] Idle glow animation planned. Status: pending.
- [ ] Leaf/circuit shimmer planned. Status: pending.
- [ ] Floating particles planned. Status: pending.
- [ ] Stage transition animation planned. Status: pending.
- [ ] Hit/growth/defend/reaction animations planned. Status: pending.
- [ ] Reduced-motion fallback required. Status: pending.
- [ ] Mobile performance testing required. Status: pending.

### Visual QA

- [ ] Test at 320px. Status: pending visual QA.
- [ ] Test at 360px. Status: pending visual QA.
- [ ] Test at 390px. Status: pending visual QA.
- [ ] Test at 414px. Status: pending visual QA.
- [ ] Test at 430px. Status: pending visual QA.
- [ ] Test tablet. Status: pending visual QA.
- [ ] Test desktop. Status: pending visual QA.
- [ ] Test connected wallet state. Status: pending visual QA.
- [ ] Test active Garden Bot state. Status: pending visual QA.
- [ ] Test winner/share panel state. Status: pending visual QA.

## Current Mobile Issues Found

- Battle completion target logic and artwork progression were tied to the old 100 Growth game, which made 50 Growth Garden Bot matches confusing.
- The Battle Log auto-scroll behavior moved the entire page after moves instead of only scrolling the log.
- The winner/share panel needed mobile-first sizing before it could be considered safe for release.
- After confirming Play Garden Bot, the interface could remain on a stale completed Garden Bot result instead of showing the newly created battle.
- Garden Bot responses happen inside the player's transaction, but the UI did not clearly show the bot response as a separate visible action after every move.
- Garden Bot attack-heavy hands can stall when the bot is at 0 Growth, because Growth is clamped at zero rather than acting like a health meter.
- Battle moves could appear missing if the move panel was hidden while the move list was empty or still refreshing.
- Wallet, navigation, how-to-play, admin, leaderboard, and tournament flows still need dedicated mobile review.

## Fixes Applied In Current Pass

- Battle Log now uses internal scroll behavior so move playback does not pull the page to the bottom.
- Garden Bot battle target display now uses 50 Growth in the UI, with a temporary UI stop when the current contract keeps running past that threshold.
- Stage artwork now scales against the active target instead of hardcoded 100 Growth milestones.
- Player NFT image is held for the winner reveal instead of appearing too early during the match.
- Winner screen includes share, copy, X, Telegram, and Facebook actions.
- Winner/share controls now use responsive wrapping and minimum practical touch targets.
- Play Garden Bot now clears the old winner screen before signing, waits for the confirmed transaction digest, and loads the active battle from the emitted `BattleUpdate` event.
- Garden Bot move feedback now creates a separate Garden Bot response entry after each player move, including a note that the bot answered inside the same wallet confirmation and the resulting growth totals for both sides.
- Garden Bot battles now warn when attack moves are stalled at 0 opponent Growth, detect bad hands with fewer than two real self-growth moves, and offer a New Bot Hand practice reset.
- Active battle controls now stay visible even when moves are still loading from chain.
- Future hand generation in the Move source now uses two attacks, one pure growth, and one growth-capable hybrid slot to avoid garbage hands after the next contract upgrade.

## Successful Local QA On 2026-06-24

- Branch tested: `codex/recovered-gardenbattles-20260624`
- Local URL tested: `http://localhost:5000/battle`
- Local server ran from `D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles`
- Local preview used `DISABLE_SUI_RELAY=true`
- Frontend validation passed: `npm.cmd run check`
- Frontend validation passed: `npm.cmd run build`
- App-local Sui Move validation passed: build and tests, 6/6
- Mirrored Sui Move validation passed: build and tests, 6/6
- Wallet-connected Garden Bot UI test passed
- New Bot Hand was visible in an active Garden Bot battle
- Garden Bot response showed as a separate action
- Bad-hand / 0 Growth warning showed correctly
- Battle log separated player and Garden Bot actions
- Mobile check at 390x844 showed horizontal overflow: 0

## Validation Log

| Check | Status | Notes |
| --- | --- | --- |
| Static syntax check | Passed | `npm.cmd run check` passed after the battle UI changes. |
| Production frontend build | Passed | `npm.cmd run build` passed. |
| Desktop visual browser check | Passed | Local wallet-connected Garden Bot UI test passed at `http://localhost:5000/battle` with `DISABLE_SUI_RELAY=true`. |
| Mobile viewport visual checks | Partial | Local battle page rendered at 390x844 with 0 horizontal overflow; 320, 375, 414, 768, and real-device checks still need full pass. |
| Preview wallet connect | Passed | Wallet connect worked on the Netlify preview; wallet warned to proceed with caution. |
| Garden Bot start after wallet confirmation | Passed | Local wallet-connected Garden Bot UI test passed after stale-state clearing and transaction-event hydration were imported. |
| Garden Bot stalled-hand escape | Passed | Local wallet-connected test confirmed New Bot Hand appears in an active Garden Bot battle. |
| Real mobile wallet flow | Pending | Must verify on mobile wallet/deep-link flow before production-ready status. |

## Release Gate

The project is not production-ready until the unchecked viewport tests and major user flows above are completed.
