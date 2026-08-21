import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_TREE_DECIMALS,
  TREE_COIN_TYPE,
  getTreeBalanceView,
  treeBalanceToNumber,
  type TreeBalanceView,
} from "@/lib/treeBalance";
import { readSuiBalanceWithRetry } from "@/lib/suiRpc";

const TREE_BALANCE_STALE_TIME_MS = 60_000;
const TREE_BALANCE_GC_TIME_MS = 5 * 60_000;

export function useTreeBalance(address?: string | null): TreeBalanceView {
  const normalizedAddress = address?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: ["tree-balance", normalizedAddress],
    enabled: !!normalizedAddress,
    staleTime: TREE_BALANCE_STALE_TIME_MS,
    gcTime: TREE_BALANCE_GC_TIME_MS,
    queryFn: async () => {
      if (!address) return null;

      const balance = await readSuiBalanceWithRetry(address, {
        operation: "tree-liquid-balance",
        coinType: TREE_COIN_TYPE,
      });

      return treeBalanceToNumber(
        BigInt(balance.totalBalance),
        FALLBACK_TREE_DECIMALS,
      );
    },
  });

  return getTreeBalanceView({
    address: normalizedAddress,
    isLoading: query.isLoading || (query.isFetching && query.data === undefined),
    isUnavailable: query.isError,
    amount: query.data ?? null,
  });
}
