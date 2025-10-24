# Updated Contract Deployment Instructions

## What Changed ✅

The smart contract has been updated to support:

1. **✅ Generic NFT Types** - No longer limited to `SaplingNFT` with `issuer` field
2. **✅ Collection Whitelist** - Admin can add/remove approved NFT collections
3. **✅ Kiosk Support** - Battle with NFTs locked in kiosks (no withdrawal needed!)
4. **✅ Two Entry Points:**
   - `join_queue<T>` - For wallet-held NFTs
   - `join_queue_from_kiosk<T>` - For kiosk-locked NFTs

## Your Tree Roots NFT Will Work! 🌳

Your NFT (`0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft`) will be **fully supported** after deploying this updated contract!

---

## Deployment Steps

### Step 1: Install Sui CLI

```bash
# Install Sui (if not already installed)
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
```

### Step 2: Configure Your Wallet

```bash
# Switch to mainnet
sui client switch --env mainnet

# Verify your active address (should be your admin wallet)
sui client active-address
```

### Step 3: Build the Contract

```bash
cd sui_contract
sui move build
```

### Step 4: Publish to Mainnet

```bash
sui client publish --gas-budget 100000000
```

**Save these object IDs from the output:**
- 📦 Package ID (e.g., `0x...`)
- ⚙️ Config object ID
- 🎯 MatchmakingQueue object ID
- 🔑 MintCap object ID

### Step 5: Whitelist Your Tree Roots Collection

After deployment, whitelist the Tree Roots NFT collection:

```bash
sui client call \
  --package <NEW_PACKAGE_ID> \
  --module battle_garden \
  --function whitelist_collection \
  --type-args "0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft" \
  --args <CONFIG_OBJECT_ID> \
  --gas-budget 10000000
```

### Step 6: Update Frontend Config

Edit `client/src/lib/sui-config.ts`:

```typescript
export const SUI_CONFIG = {
  NETWORK: 'mainnet',
  RPC_URL: 'https://fullnode.mainnet.sui.io:443',
  WS_URL: 'wss://fullnode.mainnet.sui.io:443',
  PACKAGE_ID: '<NEW_PACKAGE_ID>',        // ← Update this
  MODULE: 'battle_garden',
  CONFIG_ID: '<NEW_CONFIG_ID>',          // ← Update this
  MATCHMAKING_QUEUE_ID: '<NEW_QUEUE_ID>', // ← Update this
  SAPLING_STRUCT: '0xf1207462f6ee39938cd9f6e93285e4dc0a8034d49cb6bfb55cb5a827ba4f0cb6::tree_roots::Nft',
  ENTRY_FEE: 3_000_000_000,
  RANDOM_OBJECT_CANDIDATES: ['0x8', '0x6'],
} as const;
```

### Step 7: Update Admin Address

Edit `client/src/pages/Battle.tsx` (line 695):

```typescript
<AdminPanel 
  adminAddress="<YOUR_ADMIN_WALLET_ADDRESS>"  // ← Your actual admin wallet
  currentAddress={address || null}
/>
```

---

## New Contract Features

### 1. Whitelist Collections (Admin Only)

```bash
# Add a new collection
sui client call \
  --package <PACKAGE_ID> \
  --module battle_garden \
  --function whitelist_collection \
  --type-args "<NFT_TYPE>" \
  --args <CONFIG_ID> \
  --gas-budget 10000000

# Remove a collection
sui client call \
  --package <PACKAGE_ID> \
  --module battle_garden \
  --function remove_collection \
  --type-args "<NFT_TYPE>" \
  --args <CONFIG_ID> \
  --gas-budget 10000000
```

### 2. Join Queue from Wallet

Frontend automatically calls this when NFT is in wallet:

```typescript
join_queue<TreeRootsNFT>(config, queue, nft_ref, payment, rand, ctx)
```

### 3. Join Queue from Kiosk

Frontend automatically calls this when NFT is in kiosk:

```typescript
join_queue_from_kiosk<TreeRootsNFT>(
  config, 
  queue, 
  kiosk, 
  owner_cap, 
  nft_id, 
  payment, 
  rand, 
  ctx
)
```

---

## Testing Checklist

After deployment:

- [ ] Whitelist Tree Roots collection
- [ ] Update frontend config with new IDs
- [ ] Update admin address in Battle.tsx
- [ ] Connect wallet and verify NFT detection (check console)
- [ ] Try joining battle queue
- [ ] Verify "Admin Panel" button appears for admin wallet
- [ ] Test adding/removing collections via admin panel

---

## Security Notes

✅ **Type-based Whitelist** - Only admin-approved NFT types can battle  
✅ **Kiosk Ownership** - Requires valid `KioskOwnerCap` to use kiosk NFTs  
✅ **No Copycat NFTs** - Contract validates exact type strings  
✅ **Admin Controls** - Only admin can whitelist/remove collections  

---

## Troubleshooting

**Error: "NFT not whitelisted"**
→ Run the `whitelist_collection` command for your NFT type

**Error: "Kiosk borrow failed"**
→ Make sure you own the KioskOwnerCap for that kiosk

**Admin button not showing**
→ Update admin address in Battle.tsx to match your wallet

**NFT not detected**
→ Check browser console for "Scanning for NFTs" logs

---

## What's Next?

After successful deployment:

1. ✅ Your Tree Roots NFT will work (wallet or kiosk!)
2. ✅ Admin can whitelist more collections
3. ✅ Users can battle without withdrawing from kiosks
4. ✅ Multiple official NFT collections supported

🌳 **Ready to battle!**
