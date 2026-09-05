import { Transaction } from "@mysten/sui/transactions";
import { SUI_CONFIG } from "@/lib/sui-config";
import { TREE_COIN_TYPE } from "@/lib/treeBalance";

export const TREE_LOCK_MINIMUM_RAW = BigInt(1_000_000_000_000);
export const TREE_LOCK_PERIOD_DAYS = 30;
export const TREE_LOCK_CLOCK_ID = "0x6";

export type TreeLockCoinInput = { coinObjectId: string; balance: string | number | bigint };

export function selectTreeLockCoins(coins: TreeLockCoinInput[]) {
  const selected: string[] = [];
  let totalRaw = BigInt(0);
  for (const coin of [...coins].sort((a, b) => Number(BigInt(b.balance) - BigInt(a.balance)))) {
    if (!coin.coinObjectId || BigInt(coin.balance) <= BigInt(0)) continue;
    selected.push(coin.coinObjectId);
    totalRaw += BigInt(coin.balance);
    if (totalRaw >= TREE_LOCK_MINIMUM_RAW) return { coinObjectIds: selected, totalRaw };
  }
  return null;
}

export function buildTreeLockTransaction(address: string, coinObjectIds: string[]): Transaction {
  if (!address || coinObjectIds.length === 0) throw new Error("A connected wallet with 1,000,000 liquid TREE is required.");
  const tx = new Transaction();
  const primary = tx.object(coinObjectIds[0]);
  if (coinObjectIds.length > 1) tx.mergeCoins(primary, coinObjectIds.slice(1).map((id) => tx.object(id)));
  const [payment] = tx.splitCoins(primary, [tx.pure.u64(TREE_LOCK_MINIMUM_RAW)]);
  tx.moveCall({
    target: `${SUI_CONFIG.PACKAGE_ID}::tree_lock::lock`,
    typeArguments: [TREE_COIN_TYPE],
    arguments: [payment, tx.object(TREE_LOCK_CLOCK_ID)],
  });
  tx.setSender(address);
  return tx;
}

export function buildTreeUnlockTransaction(address: string, lockObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SUI_CONFIG.PACKAGE_ID}::tree_lock::unlock`,
    typeArguments: [TREE_COIN_TYPE],
    arguments: [tx.object(lockObjectId), tx.object(TREE_LOCK_CLOCK_ID)],
  });
  tx.setSender(address);
  return tx;
}

export function assertTreeLockPreview(preview: unknown, sender: string): void {
  const blocked = () => new Error("TREE Lock blocked: custody could not be verified before wallet approval.");
  const result = preview as {
    effects?: { status?: { status?: string } };
    balanceChanges?: Array<{ coinType?: string; owner?: { AddressOwner?: string }; amount?: string }>;
    objectChanges?: Array<{ type?: string; objectType?: string; owner?: { AddressOwner?: string } }>;
  } | null;
  if (result?.effects?.status?.status !== "success") throw blocked();
  const debit = (result.balanceChanges ?? [])
    .filter((change) => change.coinType === TREE_COIN_TYPE && change.owner?.AddressOwner?.toLowerCase() === sender.toLowerCase())
    .reduce((sum, change) => sum + BigInt(change.amount ?? "0"), BigInt(0));
  const created = (result.objectChanges ?? []).some((change) =>
    change.type === "created" &&
    change.objectType?.includes("::tree_lock::TreeLock<") &&
    change.owner?.AddressOwner?.toLowerCase() === sender.toLowerCase(),
  );
  if (debit !== -TREE_LOCK_MINIMUM_RAW || !created) throw blocked();
}
