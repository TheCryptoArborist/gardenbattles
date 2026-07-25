import { useQuery } from "@tanstack/react-query";
import {
  fetchFifthMoveEligibility,
  type FifthMoveEligibilityResponse,
  type FifthMoveSource,
} from "@/lib/api";
import type { FifthMoveEligibility, FifthMoveQualificationSource } from "@/lib/suiDexTreePosition";

export const FIFTH_MOVE_ELIGIBILITY_STALE_TIME_MS = 60_000;
const FIFTH_MOVE_ELIGIBILITY_GC_TIME_MS = 5 * 60_000;

export type FifthMoveEligibilityView = {
  status:
    | "not-connected"
    | "checking"
    | FifthMoveEligibilityResponse["status"];
  panelEligibility: FifthMoveEligibility;
  response: FifthMoveEligibilityResponse | null;
  error: boolean;
};

function isSourceId(value: FifthMoveSource): value is FifthMoveQualificationSource {
  return value === "suidex-v2" || value === "suidex-v3" || value === "moonbags-staking";
}

export function mapFifthMoveResponseToPanelEligibility(
  response: FifthMoveEligibilityResponse,
): FifthMoveEligibility {
  if (response.status === "qualified") {
    const sources = response.sources
      .filter((source) => source.status === "qualified-data" && isSourceId(source.source))
      .map((source) => source.source);
    return { status: "qualified", sources };
  }

  if (response.status === "not-qualified") {
    return { status: "not-qualified", sources: [] };
  }

  if (response.status === "verification-incomplete") {
    const sources = response.sources
      .filter((source) => source.status === "qualified-data" && isSourceId(source.source))
      .map((source) => source.source);
    return { status: "verification-incomplete", sources };
  }

  return { status: "unavailable", sources: [] };
}

export function useFifthMoveEligibility(address?: string | null): FifthMoveEligibilityView {
  const normalizedAddress = address?.toLowerCase() ?? null;

  const query = useQuery({
    queryKey: ["fifth-move-eligibility", normalizedAddress],
    enabled: !!normalizedAddress,
    staleTime: FIFTH_MOVE_ELIGIBILITY_STALE_TIME_MS,
    gcTime: FIFTH_MOVE_ELIGIBILITY_GC_TIME_MS,
    queryFn: async () => {
      if (!normalizedAddress) return null;
      return fetchFifthMoveEligibility(normalizedAddress);
    },
  });

  if (!normalizedAddress) {
    return {
      status: "not-connected",
      panelEligibility: { status: "not-connected", sources: [] },
      response: null,
      error: false,
    };
  }

  if (query.isLoading || (query.isFetching && query.data === undefined)) {
    return {
      status: "checking",
      panelEligibility: { status: "checking", sources: [] },
      response: null,
      error: false,
    };
  }

  if (query.isError || !query.data) {
    return {
      status: "unavailable",
      panelEligibility: { status: "unavailable", sources: [] },
      response: null,
      error: true,
    };
  }

  return {
    status: query.data.status,
    panelEligibility: mapFifthMoveResponseToPanelEligibility(query.data),
    response: query.data,
    error: false,
  };
}
