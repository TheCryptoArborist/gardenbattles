# Tree Power Fifth Move Eligibility

Garden Battles access and Fifth Move eligibility are separate product concepts.

- NFTree ownership grants access to Garden Battles.
- A qualifying TREE liquidity position on SuiDex V2 or SuiDex V3 is an intended Fifth Move eligibility source.
- An active TREE staking position on Moonbags.io is an intended Fifth Move eligibility source.
- Liquid TREE wallet balance is separate and does not qualify a player for the Fifth Move Unlock.
- TREE payment during battle is reserved for the future full-hand TREE Reroll.

## Current Frontend State

The frontend can present the eligibility model and read-only status states, but the Fifth Move feature is not active. A four-move hand must remain a four-move hand, even if a future detector reports a qualifying position. A five-move hand is the only frontend-visible confirmation that the fifth move is actually active.

The current read-only detector is intentionally conservative. The app has verified canonical SuiDex pool IDs from existing SuiDex links:

- SuiDex V2 TREE pool: `0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc`
- SuiDex V3 TREE pool: `0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf`

The following are not yet verified in source and must be confirmed before live qualification detection:

- V2 farm ID or farm position type
- V3 position object type and active-liquidity shape
- Moonbags staking package ID
- Moonbags TREE staking pool or registry object ID
- Moonbags staking position object type
- Moonbags wallet ownership representation
- Moonbags active staked TREE amount field

The V2 LP coin type is verified for direct wallet LP, but SuiDex farmed LP remains unavailable until the canonical farm and receipt/account shape are verified from public objects.

## Phase 1B Read-Only Evidence Tools

Use these local diagnostics before promoting a missing source from `unavailable` to countable:

```powershell
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v2-farm.ts --wallet <wallet> --digest <tx_digest> --receipt-object-id <object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v3-position.ts --wallet <wallet> --digest <tx_digest> --object-id <position_object_id>
npm.cmd exec -- tsx scripts/diagnostics/inspect-moonbags-tree-stake.ts --wallet <wallet> --digest <tx_digest> --stake-object-id <object_id>
```

The scripts are read-only and print public Sui object and transaction evidence only. They are intended to verify farm receipt, V3 position, and Moonbags stake shapes before any production detector counts those sources.

## Future Contract Requirement

The final Fifth Move feature must be enforced on-chain. Frontend detection alone is not sufficient.

A later mechanics checkpoint must define how the transaction supplies verifiable proof:

- V2 LP coin or farm position proof
- V3 position object proof
- Moonbags TREE staking position proof
- verified canonical pool identity
- active nonzero liquidity
- active nonzero TREE stake
- optional minimum threshold once the product decision is finalized

Do not treat unrelated SuiDex positions, zero-liquidity positions, closed V3 positions, claimable Moonbags rewards, generic Moonbags token locks, unrelated token stakes, project treasury locks, zero or withdrawn stakes, liquid TREE wallet balance, or NFTree ownership as Fifth Move qualification.
