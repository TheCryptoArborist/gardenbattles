# Paid reroll release mismatch — 2026-09-02

Confirmed transaction: `DiD8ZJ4PZdBT45uARXpi5dGrQYNmrYmei87TqGvWmFXP`

- Sender: `0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6`
- Time: 2026-09-02 22:36:49 UTC.
- Successful call to version 14: `0x7b826b0cf7f8de12390351caf5294ffbd6a06579591cd7fb3f10c3796452baab::battle::reroll_pvp_v3_moves`.
- Balance changes: 20,000 TREE (20,000,000,000 base units) debited from the player and credited to the zero address.
- The landing repository's previous `index-GNQnYl44.js` bundle targeted version 14. Upgrading the contract did not update that bundled frontend.
- The later Trials deployment switched the landing bundle to version 15, but already-open browser tabs can retain the previous code.

The approved version-15 package remains `0x053f4cf0bd41ba3340a0580f4ae1aaca18656ba0032eb3e920de554309d97755`; its on-chain battle bytecode contains treasury `0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f`.

## Safeguards

1. Pin the paid reroll builder to the treasury-routing package.
2. Simulate the exact transaction before wallet approval. Fail closed unless it credits precisely the requested TREE fee to the treasury and debits that fee from the sender, with no other TREE recipient.
3. Display the full treasury address in the payment review.
4. Gate the landing site's build on the approved package and the presence of the payment guard in all three shipped game entry points.
5. Publish both game source and landing-site bundle so later releases do not restore version 14.

No additional mainnet contract upgrade or transfer is needed for these safeguards. Existing tabs must reload to receive them. This does not refund or redirect the already-completed zero-address transfer.
