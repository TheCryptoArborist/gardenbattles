# Mobile Compatibility Checklist

Mobile support is a core release requirement for Garden Battles and NFTree. Every UI change must be reviewed for mobile before it is considered production-ready.

## Required Viewports

- [ ] 320px
- [ ] 375px
- [ ] 390px
- [ ] 414px
- [ ] 768px
- [ ] Desktop

## Reviewed Pages And Components

| Area | Reviewed | Mobile issues found | Fixes applied | Remaining mobile risks | Mobile-ready |
| --- | --- | --- | --- | --- | --- |
| Battle screen layout | Partial | Battle view is visually dense and can crowd small screens. | Existing battle grid uses responsive sizing and overflow-x is hidden. | Needs real-device or browser viewport review after local preview is accessible. | No |
| Battle move cards | Partial | Four cards can become tight on narrow phones. | Existing grid uses auto-fit responsive columns. | Confirm touch spacing and text wrapping at 320px. | No |
| Battle log | Yes | New log entries previously scrolled the whole page after moves. | Log now scrolls internally instead of forcing the page to the bottom. | Confirm momentum scrolling and readability on iOS/Android. | Partial |
| Garden Bot round feedback | Yes | Bot responses were easy to miss because they happen inside the same wallet-confirmed move. | Added clear round-result detail text showing that Garden Bot answered in the same confirmation and listing both growth totals. | Exact bot move names require a future contract event upgrade. | Partial |
| Winner panel | Yes | New winner/share panel started as a desktop two-column layout. | Changed to responsive auto-fit grid with 44px minimum share controls. | Needs visual review with actual winner state on phone widths. | Partial |
| Share controls | Yes | Social share buttons needed practical tap targets. | Added minimum touch target sizing and wrapping buttons. | Native mobile share sheet needs real-device check. | Partial |
| Wallet connection flow | Partial | Wallet connect worked in preview, but Garden Bot start stayed on an old completed battle after confirmation. | Garden Bot start now clears stale finished state, waits for the confirmed transaction, and applies the new battle from the transaction event. | Must retest wallet-confirmed Garden Bot start on desktop and mobile wallet/deep-link flow. | Partial |
| Header and navigation | Not yet | Header may crowd wallet/account controls on phones. | None yet. | Needs mobile navigation review and possibly collapsed menu. | No |
| How-to-play panel | Not yet | Panel may be too text-heavy on small screens. | None yet. | Needs shorter mobile copy or collapsible sections. | No |
| Admin/config panels | Not yet | Unknown. | None yet. | Must verify forms, buttons, and modal behavior on phones. | No |
| Leaderboard/tournament views | Not yet | Unknown. | None yet. | Wide ranking data should become cards or horizontal scroll. | No |

## Current Mobile Issues Found

- Battle completion target logic and artwork progression were tied to the old 100 Growth game, which made 50 Growth Garden Bot matches confusing.
- The Battle Log auto-scroll behavior moved the entire page after moves instead of only scrolling the log.
- The winner/share panel needed mobile-first sizing before it could be considered safe for release.
- After confirming Play Garden Bot, the interface could remain on a stale completed Garden Bot result instead of showing the newly created battle.
- Garden Bot responses happen inside the player's transaction, but the UI did not clearly show the bot response after every move.
- Wallet, navigation, how-to-play, admin, leaderboard, and tournament flows still need dedicated mobile review.

## Fixes Applied In Current Pass

- Battle Log now uses internal scroll behavior so move playback does not pull the page to the bottom.
- Garden Bot battle target display now uses 50 Growth in the UI, with a temporary UI stop when the current contract keeps running past that threshold.
- Stage artwork now scales against the active target instead of hardcoded 100 Growth milestones.
- Player NFT image is held for the winner reveal instead of appearing too early during the match.
- Winner screen includes share, copy, X, Telegram, and Facebook actions.
- Winner/share controls now use responsive wrapping and minimum practical touch targets.
- Play Garden Bot now clears the old winner screen before signing, waits for the confirmed transaction digest, and loads the active battle from the emitted `BattleUpdate` event.
- Garden Bot move feedback now shows a round result after every move, including a note that the bot answered inside the same wallet confirmation and the resulting growth totals for both sides.

## Validation Log

| Check | Status | Notes |
| --- | --- | --- |
| Static syntax check | Passed | `npm run check` passed after the battle UI changes. |
| Production frontend build | Passed | Vite production build passed using the local Windows workaround. |
| Desktop visual browser check | Blocked | The local browser preview was blocked by the desktop environment. |
| Mobile viewport visual checks | Pending | Must test 320, 375, 390, 414, and 768px after browser preview is available. |
| Preview wallet connect | Passed | Wallet connect worked on the Netlify preview; wallet warned to proceed with caution. |
| Garden Bot start after wallet confirmation | Pending | Retest after the stale-finished-battle fix is redeployed. |
| Real mobile wallet flow | Pending | Must verify on mobile wallet/deep-link flow before production-ready status. |

## Release Gate

The project is not production-ready until the unchecked viewport tests and major user flows above are completed.
