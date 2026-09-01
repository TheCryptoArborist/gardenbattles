# TREE Reroll Mainnet Launch Record

## Live objects

- Garden Battles package version: `14`
- Call package: `0x7b826b0cf7f8de12390351caf5294ffbd6a06579591cd7fb3f10c3796452baab`
- Upgrade capability: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- TreeConfig: `0x828da1764a6c1d4d9c31cc2dc54eac9e1096172e9b68a629510818c5475119a1`
- TreeConfig admin: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- TREE coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`
- TreeConfig base reroll cost: `10000000000` raw units (`10,000 TREE` at 6 decimals)
- Garden Bot reroll: one free four-card reroll per battle
- Paid PvP V3 reroll cost: `20,000 TREE` (twice the base fee, enforced on-chain)
- Boost and advantage parameters: disabled at `0`

The TreeConfig is a shared object so active battle transactions can read it. Its admin field remains the existing Garden Battles admin wallet. No TreeConfig admin transfer or upgrade-capability transfer was performed.

## Mainnet transactions

- Package upgrade: `DPyveFxpFeCtFKo7ZqqMfp5gDSMEWtwDXpDyfLde7LNm`
- TreeConfig creation: `HVaLXsfoxro5xgLSDfkH1kBFR49zTCrQHVCWmDebZwYm`
- TREE coin configuration: `Ejuwq1tBSxvWv3U3CL1Hq9e6h3xQqYXPtcSGJJpr1Uiy`
- Reroll fee configuration: `GUm64HnFE7mbMtfXGd57X1NUqUz2DSaznxwKCeZpKDkn`
- Mode-specific reroll pricing upgrade: `HBZscosXJW9FQNHUyAZWiNiHdVQm2ah2p3VfVx7Vph5R`
- Garden Bot reroll removal upgrade: `CVGKneq5sdAM5vfAApKJZjASytvzUmHGr6TryAGQ616W`
- Free Garden Bot reroll restoration upgrade: `DochgZbsdd26uHM6GQ2rSkPnHb6UBDgfqbFYUnFFV5o3`

## Live rules

- Paid PvP V3 (`PvpBattleV3`) rerolls continue to cost `20,000 TREE`.
- Ranked Garden Bot V2 provides one free reroll per wallet per battle.
- One reroll per wallet per battle is enforced on-chain in both modes.
- Reroll is allowed only on the caller's turn.
- The full hand is replaced without changing Growth or advancing the turn.
- No replacement card can match a card in the previous hand.
- Qualified fifth-card players receive a fresh three-card fifth-move draft after reroll.
- The website reads the exact fee from TreeConfig before opening the wallet.
