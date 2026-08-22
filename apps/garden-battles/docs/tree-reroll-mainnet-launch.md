# TREE Reroll Mainnet Launch Record

## Live objects

- Garden Battles package version: `10`
- Call package: `0xb1656e809b744345bee628ca4c4b10357c30bc518166228c0913312509edbf45`
- Upgrade capability: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- TreeConfig: `0x828da1764a6c1d4d9c31cc2dc54eac9e1096172e9b68a629510818c5475119a1`
- TreeConfig admin: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- TREE coin type: `0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE`
- Reroll cost: `10000000000` raw units (`10,000 TREE` at 6 decimals)
- Boost and advantage parameters: disabled at `0`

The TreeConfig is a shared object so active battle transactions can read it. Its admin field remains the existing Garden Battles admin wallet. No TreeConfig admin transfer or upgrade-capability transfer was performed.

## Mainnet transactions

- Package upgrade: `DPyveFxpFeCtFKo7ZqqMfp5gDSMEWtwDXpDyfLde7LNm`
- TreeConfig creation: `HVaLXsfoxro5xgLSDfkH1kBFR49zTCrQHVCWmDebZwYm`
- TREE coin configuration: `Ejuwq1tBSxvWv3U3CL1Hq9e6h3xQqYXPtcSGJJpr1Uiy`
- Reroll fee configuration: `GUm64HnFE7mbMtfXGd57X1NUqUz2DSaznxwKCeZpKDkn`

## Live rules

- Garden Bot (`RankedBotBattleV2`) and paid PvP (`PvpBattleV3`) only.
- One reroll per wallet per battle, enforced on-chain.
- Reroll is allowed only on the caller's turn.
- The full hand is replaced without changing Growth or advancing the turn.
- No replacement card can match a card in the previous hand.
- Qualified fifth-card players receive a fresh three-card fifth-move draft after reroll.
- The website reads the exact fee from TreeConfig before opening the wallet.
