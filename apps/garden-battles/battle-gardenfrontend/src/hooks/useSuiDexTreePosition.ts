import { useQuery } from "@tanstack/react-query";
import {
  hasVerifiedFifthMoveProviderShapes,
  type FifthMoveEligibility,
} from "@/lib/suiDexTreePosition";

const SUIDEX_TREE_POSITION_STALE_TIME_MS = 60_000;
const SUIDEX_TREE_POSITION_GC_TIME_MS = 5 * 60_000;

export function useSuiDexTreePosition(address?: string | null): FifthMoveEligibility {
  const normalizedAddress = address?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: ["suidex-tree-position", normalizedAddress],
    enabled: !!normalizedAddress && hasVerifiedFifthMoveProviderShapes(),
    staleTime: SUIDEX_TREE_POSITION_STALE_TIME_MS,
    gcTime: SUIDEX_TREE_POSITION_GC_TIME_MS,
    queryFn: async (): Promise<FifthMoveEligibility> => {
      return { status: "unavailable", sources: [] };
    },
  });

  if (!normalizedAddress) return { status: "not-connected", sources: [] };
  if (!hasVerifiedFifthMoveProviderShapes()) return { status: "unavailable", sources: [] };
  if (query.isLoading || (query.isFetching && query.data === undefined)) {
    return { status: "checking", sources: [] };
  }
  if (query.isError || !query.data) return { status: "unavailable", sources: [] };
  return query.data;
}
