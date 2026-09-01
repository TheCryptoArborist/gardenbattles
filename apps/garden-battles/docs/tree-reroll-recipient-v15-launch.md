# TREE Reroll Recipient — Mainnet Version 15

The Garden Battles package was upgraded successfully on Sui mainnet on
2026-09-01 to route paid TREE reroll fees to the designated recipient wallet.

- Transaction digest: `HYHrhxSef4CsyDPWr7L8XLvDTZrwC1GHr8qUK85E6mVd`
- New package: `0x053f4cf0bd41ba3340a0580f4ae1aaca18656ba0032eb3e920de554309d97755`
- UpgradeCap version: `15`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- Reroll recipient: `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`

## Live behavior

- Paid PvP V3 rerolls cost `20,000 TREE`.
- The exact reroll fee is transferred to the recipient above.
- Any accidental payment surplus is returned to the player.
- Garden Bot rerolls remain free and do not transfer TREE.
- TREE boost routing remains unchanged.
