# Garden Battles Card Catalog V2

Status: balance-approved design candidate. This catalog does not alter the live Move package by itself.

## Dealing rules

- A standard hand contains four cards: one Attack, one Growth, one Hybrid, and one additional card drawn from the full standard pool without duplication.
- A wallet with the fifth-card benefit sees a three-card TREE Power draft: one Offense, one Growth, and one Defense/Hybrid card. The player chooses one of those three for the fifth slot for that battle.
- The nine TREE Power cards are exclusive to the fifth slot and never replace cards in a standard four-card hand.
- A player cannot use the same card on two consecutive turns.

## Standard deck (30 cards)

| ID | Card | Class | Proposed effect |
|---:|---|---|---|
| 1 | Wedgebreaker | Attack | Drain 11 Growth. Against a block, break it and still drain 7. |
| 2 | Skyreach Saw | Attack | Drain 8 Growth, or 12 when the opponent has at least 40 Growth. |
| 3 | Chainsaw Cyclone | Attack | 75% chance to drain 16 Growth. |
| 4 | Rootpiercer | Attack | Piercing strike that drains 11 Growth through blocks. |
| 5 | Limbfall Slam | Attack | Drain 8 Growth, or 12 if the opponent's previous card was Growth. |
| 6 | Acorn Barrage | Attack | Two separate 6-Growth hits; each hit interacts with protection independently. |
| 7 | Log Swing Rampage | Attack | Drain 10 Growth, or 13 while you are behind. |
| 8 | Barklash Shield | Hybrid | Gain 6 Growth and block the next hit; an unused fresh shield reflects 4 Growth. |
| 9 | Root Siphon | Hybrid | Drain 6 Growth and gain 4 Growth. |
| 10 | Beetle Blight | Attack | Apply 4 Growth damage at the start of the opponent's next two turns; does not stack. |
| 11 | Lightning Crown | Attack | 75% chance to drain 17 Growth. |
| 12 | Air Spade Blast | Attack | Remove one block, then pierce for 10 Growth. |
| 13 | Fungal Doom | Attack | Drain 7 Growth now and apply a 4-Growth penalty on the opponent's next turn. |
| 14 | Compost Cleanse | Hybrid | Clear pending poison/penalty before it triggers; gain 14 Growth when cleansing, otherwise 10. |
| 15 | Rootlink Surge | Growth | Gain 12 Growth while behind, otherwise gain 8. |
| 16 | Pruning Fury | Attack | Spend 4 of your Growth to drain 16 from the opponent. Unavailable below 4 Growth. |
| 17 | Mulch Fortress | Hybrid | If already protected, gain 10 Growth; otherwise gain 7 and add one block. |
| 18 | Graft Fusion | Hybrid | Gain 5 Growth and drain 5 Growth. |
| 19 | Wildwood Gamble | Growth | 60% chance to gain 20 Growth; otherwise lose 4. |
| 20 | Root Revival | Growth | Clear a pending one-turn penalty and gain 10 Growth. |
| 21 | Solar Bloom | Growth | Gain a random 8-14 Growth. |
| 22 | Rainmaker | Growth | Gain 14 Growth after an opponent Attack; otherwise gain 10. |
| 23 | Myco Might | Growth | Gain 15 Growth if the opponent is protected; otherwise gain 10. |
| 24 | Canopy Downpour | Growth | Gain 14 Growth while the opponent also gains 3. |
| 25 | Potassium Power | Growth | 75% chance to gain 15 Growth; otherwise gain 3. |
| 26 | Photosynthesis Overdrive | Growth | Gain 13 Growth after using an Attack; otherwise gain 11. |
| 27 | Ironbark Armor | Hybrid | Gain 7 Growth and halve the next direct hit. |
| 28 | Sap Surge | Growth | Gain 13 Growth at 10 Growth or below; otherwise gain 10. |
| 29 | Gale Guard | Hybrid | Gain 8 Growth with a 50% chance to add one block. |
| 30 | Shadow Canopy | Growth | Gain 8 Growth and cap the next direct attack against you at 8. |

All standard Attack cards also receive the Mulch Bonus: if the opponent is already at zero Growth when the Attack is played, gain 4 Growth so an attack-heavy hand cannot deadlock the match.

## TREE Power fifth-card pool (9 cards)

Each effect is deliberately close to standard-card strength. The value comes from choosing a fifth tactical option, not from an overwhelmingly stronger card.

| ID | Card | Draft lane | Proposed effect |
|---:|---|---|---|
| 31 | Chainsaw Cataclysm | Offense | Gain 3 Growth and drain 8. |
| 32 | Beetle Swarm Blitz | Offense | Gain 4 Growth and apply 3 Growth damage for the opponent's next two turns; does not stack. |
| 33 | Lightning Split | Offense | Gain 3 Growth and take a 75% chance to drain 10. |
| 34 | Ancient Root Awakening | Growth | Gain 11 Growth while behind, otherwise gain 10. |
| 35 | Canopy Explosion | Growth | Remove one opponent block and gain 10 Growth. |
| 36 | Solar Crown Surge | Growth | Clear pending poison/penalty before it triggers and gain 9 Growth. |
| 37 | Ironwood Fortress | Defense/Hybrid | Gain 7 Growth and add one block. |
| 38 | Rootstorm Siphon | Defense/Hybrid | Gain 6 Growth and drain 6. |
| 39 | Arborist Ascension | Defense/Hybrid | Gain 8 Growth and cap the next direct attack against you at 8. |

## Match-level balance rules

- Randomize the starting player. Always allowing the first queued wallet to move first produced an approximately 62% first-player win rate.
- Natural Growth adds 1 per turn, increases to 2 at total turn 16, and increases to 3 at total turn 26.
- Use a 50-total-turn limit for 50-Growth matches and a 65-total-turn limit for 75-Growth matches.
- At the turn limit, higher Growth wins. An exact tie is a draw and should refund rather than award a winner.

## Simulation evidence

The V2 simulator is `scripts/balance/pvp-card-simulation-v2.ts`. Simulation passes of up to 100,000 matches per scenario, followed by a 50,000-match confirmation pass after the fairness adjustment, showed:

| Scenario | Average turns | Even-wallet P1 win rate | Point decisions | Exact draws |
|---|---:|---:|---:|---:|
| 50 Growth, both standard | 17.12 | 50.21% | 5.01% | 0.13% |
| 50 Growth, both fifth-card | 16.98 in the confirming 50k pass | 50.02% | 4.07% | 0.14% |
| 75 Growth, both standard | 22.92 | 50.31% | 4.27% | 0.09% |
| 75 Growth, both fifth-card | 22.19 in the confirming 50k pass | 50.24% | 3.26% | 0.10% |

In a separate qualified-versus-standard fairness check with a random starter, the fifth-card wallet won 54.21% of 50-Growth matches and 54.75% of 75-Growth matches. This is a useful tactical benefit without the 66-68% win rate produced by the first overpowered TREE Power draft.

## Implementation gate

Before publishing a new Move package, the contract implementation, frontend labels/tooltips, battle log recovery labels, Garden Bot move resolution, PvP move resolution, and automated tests must all use this same ID-to-name-and-effect catalog. Existing production queue IDs, frontend VITE IDs, FifthMoveConfig, Railway variables, and unrelated contracts are outside this catalog change.
