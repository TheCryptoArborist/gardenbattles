# Garden Bot Free Reroll — Mainnet Version 14

The Garden Battles package was upgraded successfully on Sui mainnet on
2026-08-31 to restore one free four-card reroll in ranked Garden Bot battles.

- Transaction digest: `DochgZbsdd26uHM6GQ2rSkPnHb6UBDgfqbFYUnFFV5o3`
- New package: `0x7b826b0cf7f8de12390351caf5294ffbd6a06579591cd7fb3f10c3796452baab`
- UpgradeCap version: `14`
- UpgradeCap policy: `0` (compatible upgrades)
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- UpgradeCap owner: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Ownership transfer: none

## Live behavior

- Ranked Garden Bot V2 allows one free reroll per battle.
- The four standard cards are replaced without changing Growth, turn, or the
  selected bonus fifth card.
- Paid PvP V3 rerolls remain separate and continue to cost `20,000 TREE`.
- The frontend calls `battle::reroll_ranked_bot_v2_moves_free` from the
  version-14 package.

The version-13 catalog upgrade record remains unchanged as historical evidence.
