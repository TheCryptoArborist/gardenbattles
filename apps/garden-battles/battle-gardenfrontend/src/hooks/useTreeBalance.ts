import { useSuiClient } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_TREE_DECIMALS,
  TREE_COIN_TYPE,
  getTreeBalanceView,
  treeBalanceToNumber,
  type TreeBalanceView,
} from "@/lib/treeBalance";

const TREE_BALANCE_STALE_TIME_MS = 60_000;
const TREE_BALANCE_GC_TIME_MS = 5 * 60_000;

export function useTreeBalance(address?: string | null): TreeBalanceView {
  const suiClient = useSuiClient();
  const normalizedAddress = address?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: ["tree-balance", normalizedAddress],
    enabled: !!normalizedAddress,
    staleTime: TREE_BALANCE_STALE_TIME_MS,
    gcTime: TREE_BALANCE_GC_TIME_MS,
    queryFn: async () => {
      if (!address) return null;

      const [balance, metadata] = await Promise.all([
        suiClient.getBalance({
          owner: address,
          coinType: TREE_COIN_TYPE,
        }),
        suiClient.getCoinMetadata({
          coinType: TREE_COIN_TYPE,
        }),
      ]);

      const decimals = metadata?.decimals ?? FALLBACK_TREE_DECIMALS;
      return treeBalanceToNumber(BigInt(balance.totalBalance), decimals);
    },
  });

  return getTreeBalanceView({
    address: normalizedAddress,
    isLoading: query.isLoading || (query.isFetching && query.data === undefined),
    isUnavailable: query.isError,
    amount: query.data ?? null,
  });
}
