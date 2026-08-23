# Garden Battles tree artwork

This folder preserves the source-resolution artwork for the battle-tree visual system. The authoritative gameplay artwork is stored under `user-supplied-masters/`. Files under `masters/` are recovered concept sources and are not active gameplay art.

## Arena growth stages

| Stage | Trigger | Player master | Garden Bot master |
| --- | --- | --- | --- |
| 1 | Below 25% of target | `player-stage-1-master.jpg` | `garden-bot-stage-1-master.jpg` |
| 2 | 25% to below 50% | `player-stage-2-master.jpg` | `garden-bot-stage-2-master.jpg` |
| 3 | 50% to below 75% | `player-stage-3-master.jpg` | `garden-bot-stage-3-master.jpg` |
| 4 | 75% through victory | `player-stage-4-master.jpg` | `garden-bot-stage-4-master.jpg` |

The percentage-based mapping works for both 50-Growth and 75-Growth matches without changing game mechanics. PvP uses the player artwork for both wallets. Garden Bot uses the robotic artwork only for the bot opponent.

## Supporting sources

- `growth-progression-seven-stage-reference.png` preserves the recovered visual progression reference.
- `tree-reroll-ring-master.png` is the recovered TREE reroll visual source.
- `battle-tree-cosmetics-concept.png` is a future cosmetics presentation concept and is not active gameplay UI.

## Integration rule

Run `extract-battle-art.ps1` to rebuild transparent 768 × 768 web derivatives in the frontend's `public/assets/battle-trees/` directory. Keep the supplied masters unchanged so the derivatives can always be reproduced.
