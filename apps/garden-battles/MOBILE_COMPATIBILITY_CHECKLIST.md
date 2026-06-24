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
