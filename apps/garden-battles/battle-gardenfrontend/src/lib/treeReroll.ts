import { Transaction } from "@mysten/sui/transactions";
import { SUI_CONFIG, type PvpBattleVersion } from "@/lib/sui-config";
import { FALLBACK_TREE_DECIMALS, TREE_COIN_TYPE } from "@/lib/treeBalance";

export type TreeCoinInput = {
  coinObjectId: string;
  balance: string | number | bigint;
};

export function getTreeRerollMoveFunction(
  battleVersion?: PvpBattleVersion,
): "reroll_pvp_v3_moves" | "reroll_ranked_bot_v2_moves" | null {
  if (battleVersion === "pvp-v3") return "reroll_pvp_v3_moves";
  if (battleVersion === "bot-v2") return "reroll_ranked_bot_v2_moves";
  return null;
}

export function parseTreeRerollCostRaw(response: any): bigint | null {
  const fields = response?.data?.content?.fields;
  const value = fields?.reroll_cost;
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const parsed = BigInt(value);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatTreeRerollCost(raw: bigint): number {
  return Number(raw) / 10 ** FALLBACK_TREE_DECIMALS;
}

export function getTreeRerollCostRaw(
  baseCostRaw: bigint,
  battleVersion?: PvpBattleVersion,
): bigint {
  return battleVersion === "pvp-v3" ? baseCostRaw * BigInt(2) : baseCostRaw;
}

export function selectTreeCoinInputs(
  coins: TreeCoinInput[],
  costRaw: bigint,
): { coinObjectIds: string[]; totalRaw: bigint } | null {
  if (costRaw <= BigInt(0)) return null;
  const selected: string[] = [];
  let totalRaw = BigInt(0);
  for (const coin of coins) {
    if (!coin.coinObjectId) continue;
    let balance: bigint;
    try {
      balance = BigInt(coin.balance);
    } catch {
      continue;
    }
    if (balance <= BigInt(0)) continue;
    selected.push(coin.coinObjectId);
    totalRaw += balance;
    if (totalRaw >= costRaw) {
      return { coinObjectIds: selected, totalRaw };
    }
  }
  return null;
}

export function buildTreeRerollTransaction(options: {
  address: string;
  battleId: string;
  battleVersion?: PvpBattleVersion;
  treeConfigId: string;
  randomObjectId: string;
  costRaw: bigint;
  coinObjectIds: string[];
}): Transaction {
  const moveFunction = getTreeRerollMoveFunction(options.battleVersion);
  if (!moveFunction) {
    throw new Error("TREE Reroll is available only in Garden Bot and current paid PvP battles.");
  }
  if (!options.treeConfigId || options.coinObjectIds.length === 0 || options.costRaw <= BigInt(0)) {
    throw new Error("TREE Reroll is not configured.");
  }

  const tx = new Transaction();
  const primaryCoin = tx.object(options.coinObjectIds[0]);
  if (options.coinObjectIds.length > 1) {
    tx.mergeCoins(
      primaryCoin,
      options.coinObjectIds.slice(1).map((coinObjectId) => tx.object(coinObjectId)),
    );
  }
  const [payment] = tx.splitCoins(primaryCoin, [tx.pure.u64(options.costRaw)]);
  tx.moveCall({
    target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${moveFunction}`,
    typeArguments: [TREE_COIN_TYPE],
    arguments: [
      tx.object(options.battleId),
      tx.object(options.treeConfigId),
      payment,
      tx.object(options.randomObjectId),
    ],
  });
  tx.setSender(options.address);
  return tx;
}
