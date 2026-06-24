# 🚀 DEPLOYMENT INSTRUCTIONS - Sui Battle Garden

## ⚡ **QUICK START (2 Minutes)**

### **Step 1: Deploy the Contract** (1 minute)

Open your terminal where Sui CLI is installed and run:

```bash
cd C:\ContractTree\battle_garden\sui_contract

# Build the contract
sui move build

# Deploy to mainnet (costs ~0.05-0.08 SUI)
sui client publish --gas-budget 100000000
```

---

### **Step 2: Copy the Deployment Output** (30 seconds)

After deployment succeeds, you'll see output like this:

```
Transaction Digest: AbCd1234...
╭─────────────────────────────────────────────────────────────────────╮
│ Object Changes                                                      │
├─────────────────────────────────────────────────────────────────────┤
│ Created Objects:                                                    │
│  ┌──                                                                │
│  │ ObjectID: 0xABC123...                    <- PACKAGE ID           │
│  │ Sender: 0x...                                                    │
│  │ Owner: Immutable                                                 │
│  │ ObjectType: 0x2::package::UpgradeCap                            │
│  └──                                                                │
│  ┌──                                                                │
│  │ ObjectID: 0xDEF456...                    <- CONFIG ID            │
│  │ Sender: 0x...                                                    │
│  │ Owner: Shared                                                    │
│  │ ObjectType: <PACKAGE_ID>::battle_garden::Config                 │
│  └──                                                                │
│  ┌──                                                                │
│  │ ObjectID: 0xGHI789...                    <- QUEUE ID             │
│  │ Sender: 0x...                                                    │
│  │ Owner: Shared                                                    │
│  │ ObjectType: <PACKAGE_ID>::battle_garden::MatchmakingQueue       │
│  └──                                                                │
╰─────────────────────────────────────────────────────────────────────╯
```

**Copy these 3 IDs:**
1. **PACKAGE_ID** - The first Created Object (Immutable, type: package::UpgradeCap)
2. **CONFIG_ID** - The object with type `battle_garden::Config`
3. **QUEUE_ID** - The object with type `battle_garden::MatchmakingQueue`

---

### **Step 3: Share the IDs** (30 seconds)

Send me these 3 IDs in this format:

```
PACKAGE_ID: 0xABC123...
CONFIG_ID: 0xDEF456...
QUEUE_ID: 0xGHI789...
```

I will immediately update the frontend and test everything!

---

## 📋 **What Happens After You Deploy:**

✅ Contract is live on Sui mainnet
✅ You are the admin (your wallet address)
✅ Config object created with initial settings:
   - Entry fee: 3 SUI
   - Winner payout: 5 SUI
   - Treasury share: 1 SUI
   - Whitelist: Empty (ready for you to add collections)
✅ Matchmaking queue ready
✅ All security features active

---

## 🔍 **Troubleshooting:**

### **"Access denied" error:**
```bash
# Kill any running Sui processes
taskkill /F /IM sui.exe

# Delete lock file
del Move.lock

# Try again
sui client publish --gas-budget 100000000
```

### **"Insufficient gas" error:**
You need at least 0.1 SUI in your wallet for deployment.

### **"Version mismatch" warning:**
This is just a warning - deployment should still work. If it fails, update Sui CLI:
```bash
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui
```

---

## ✅ **After I Update the Frontend:**

1. You'll whitelist Tree Roots NFT collection via Admin Panel
2. Your NFT in the kiosk will be detected
3. You can join battles!

---

## 🎯 **That's It!**

Total time: **2 minutes**
Your private key: **Never leaves your machine** ✅
