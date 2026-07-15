export const TREE_COIN_TYPE =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

export const FALLBACK_TREE_DECIMALS = 6;

export type TreeBalanceStatus = "disconnected" | "loading" | "ready" | "unavailable";

export type TreeBalanceView =
  | { status: "disconnected"; label: "Connect wallet"; exactLabel: null; amount: null }
  | { status: "loading"; label: "Loading"; exactLabel: null; amount: null }
  | { status: "unavailable"; label: "Unavailable"; exactLabel: null; amount: null }
  | { status: "ready"; label: string; exactLabel: string; amount: number };

export function treeBalanceToNumber(balance: bigint, decimals: number): number {
  return Number(balance) / 10 ** decimals;
}

export function formatCompactTREE(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(4);
}

export function formatExactTREE(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(3)}M`;
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return amount.toFixed(4);
}

export function makeTreeBalanceView(amount: number): TreeBalanceView {
  return {
    status: "ready",
    amount,
    label: `${formatCompactTREE(amount)} TREE`,
    exactLabel: `${formatExactTREE(amount)} TREE`,
  };
}

export function getTreeBalanceView(options: {
  address?: string | null;
  isLoading?: boolean;
  isUnavailable?: boolean;
  amount?: number | null;
}): TreeBalanceView {
  if (!options.address) {
    return { status: "disconnected", label: "Connect wallet", exactLabel: null, amount: null };
  }

  if (options.isLoading) {
    return { status: "loading", label: "Loading", exactLabel: null, amount: null };
  }

  if (options.isUnavailable || options.amount === null || options.amount === undefined) {
    return { status: "unavailable", label: "Unavailable", exactLabel: null, amount: null };
  }

  return makeTreeBalanceView(options.amount);
}
