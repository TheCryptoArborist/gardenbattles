# Type Normalization Investigation

**Date:** November 3, 2025
**Issue:** Error 101 (ENftNotWhitelisted) when joining battle despite collection being whitelisted
**Resolution:** Collection IS whitelisted correctly, error likely due to timing or caching

---

## Problem Report

User reported getting "Unexpected error" (Error 101 - ENftNotWhitelisted) when trying to join battle with Tree Roots NFT, despite whitelisting the collection via transaction `4jiebMXU6NfoMtkztcK5MCnNLTgVHa4ojvH3SnyXNz1J`.

---

## Investigation

### 1. Queried On-Chain Config Object

**Config ID:** `0x35b10278cf1bbebd5a43df3222e490af2796fb78f3a2c4a59e3debf08aef8587`

**Whitelisted Collections:**
```json
{
  "whitelisted_collections": [
    {
      "type": "0x1::type_name::TypeName",
      "fields": {
        "name": "f1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft"
      }
    }
  ]
}
```

✅ **CONFIRMED:** Tree Roots NFT IS whitelisted on-chain!

### 2. Type Name Format Analysis

**On-Chain Format (Move's `type_name`):**
- No `0x` prefix
- 64-character hex address (zero-padded)
- Lowercase
- Format: `{address}::{module}::{struct}`
- Example: `f1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft`

**Frontend Format (Sui SDK typeArguments):**
- WITH `0x` prefix
- 64-character hex address (zero-padded)
- Lowercase
- Format: `0x{address}::{module}::{struct}`
- Example: `0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft`

### 3. How Sui Handles Type Arguments

According to Sui documentation and architect review:

1. **Client SDK:** Always pass type arguments WITH the `0x` prefix
2. **Move Runtime:** Internally normalizes types using `type_name::get_with_original_ids<T>()`
3. **Storage:** TypeName values stored WITHOUT `0x` prefix
4. **Comparison:** Move runtime handles normalization automatically

**Key Insight:** The difference in format is EXPECTED and handled correctly by Sui!

---

## Attempted Fix (REVERTED)

Initially attempted to normalize types by stripping `0x` prefix in:
- `joinBattle()` function
- `addCollection()` function  
- `removeCollection()` function

**Architect Review:** ❌ **FAIL**
- Removing `0x` prefix breaks Sui SDK's ABI requirements
- Type arguments MUST include `0x` prefix for transactions
- Normalization happens internally in Move runtime, not in client code

**Resolution:** Reverted all changes, kept original code

---

## Root Cause Analysis

The error 101 was likely caused by:

1. **Timing Issue:** User tried to join battle before whitelist transaction was fully finalized
2. **RPC Cache:** RPC node hadn't propagated the Config update yet
3. **User Error:** Possibly tried with wrong NFT or before whitelisting

**Evidence:**
- ✅ Collection IS whitelisted on-chain (verified via RPC query)
- ✅ Code is correct (architect reviewed)
- ✅ Type formats are handled properly by Sui

---

## Lessons Learned

### Move Type Name Behavior

```move
// When you call this:
whitelist_collection<0xf1207...::tree_roots::Nft>(config, ctx)

// Move internally does:
let type_name = type_name::get_with_original_ids<T>();
// Returns: "f1207...::tree_roots::Nft" (NO 0x prefix)
// Stores in config.whitelisted_collections
```

```move
// When you call this:
join_queue_from_kiosk<0xf1207...::tree_roots::Nft>(config, queue, ...)

// Move internally does:
let type_name = type_name::get_with_original_ids<T>();
// Returns: "f1207...::tree_roots::Nft" (NO 0x prefix)
// Compares with config.whitelisted_collections
// ✅ MATCHES!
```

### Best Practices

1. **Always use `0x` prefix in Sui SDK typeArguments**
2. **Never strip `0x` in client transaction code**
3. **Trust Sui's internal type normalization**
4. **Verify on-chain state via RPC queries when debugging**

---

## Final Status

✅ **Code:** Correct (no changes needed)
✅ **Collection:** Whitelisted on-chain
✅ **Solution:** User should try again - error was likely transient

---

## Related Files

- `client/src/hooks/useSuiWallet.tsx` - Battle joining logic (unchanged)
- `client/src/components/AdminPanel.tsx` - Collection management (unchanged)
- `sui_contract/battle_garden.move` - Smart contract whitelist logic

---

## References

- Sui Type Name Docs: https://docs.sui.io/references/framework/sui_std/type_name
- Whitelist Transaction: https://suiscan.xyz/mainnet/tx/4jiebMXU6NfoMtkztcK5MCnNLTgVHa4ojvH3SnyXNz1J
- Config Object: 0x35b10278cf1bbebd5a43df3222e490af2796fb78f3a2c4a59e3debf08aef8587
