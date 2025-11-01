# Frontend Config Update Template

## After you share the deployment IDs, I will update:

### File: `client/src/lib/sui-config.ts`

```typescript
export const SUI_CONFIG = {
  NETWORK: 'mainnet',
  PACKAGE_ID: '0xYOUR_PACKAGE_ID_HERE',
  MODULE: 'battle_garden',
  CONFIG_ID: '0xYOUR_CONFIG_ID_HERE',
  QUEUE_ID: '0xYOUR_QUEUE_ID_HERE',
} as const;
```

---

## Then I will verify:

1. ✅ Frontend connects to new contract
2. ✅ Admin panel appears for your wallet
3. ✅ Can whitelist NFT collections
4. ✅ NFT detection works
5. ✅ Battle queue integration works

---

## Status: Waiting for deployment IDs...

Share the 3 IDs in any format, I'll handle the rest!
