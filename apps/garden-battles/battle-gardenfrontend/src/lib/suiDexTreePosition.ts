import { TREE_COIN_TYPE } from "@/lib/treeBalance";

export const CANONICAL_TREE_SUIDEX_V2_POOL_ID =
  "0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc";

export const CANONICAL_TREE_SUIDEX_V3_POOL_ID =
  "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf";

export const CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE: string | null = null;
export const CANONICAL_TREE_SUIDEX_V2_FARM_ID: string | null = null;
export const CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE: string | null = null;
export const MOONBAGS_TREE_STAKING_PACKAGE_ID: string | null = null;
export const MOONBAGS_TREE_STAKING_POOL_ID: string | null = null;
export const MOONBAGS_TREE_STAKING_POSITION_TYPE: string | null = null;

export type FifthMoveQualificationSource =
  | "suidex-v2"
  | "suidex-v3"
  | "moonbags-staking";

export type FifthMoveEligibility =
  | { status: "not-connected"; sources: [] }
  | { status: "checking"; sources: [] }
  | { status: "not-qualified"; sources: [] }
  | { status: "qualified"; sources: FifthMoveQualificationSource[] }
  | { status: "unavailable"; sources: [] };

export type SuiDexTreeV2PositionCandidate = {
  poolId?: string | null;
  amount?: bigint | number | string | null;
  stakedAmount?: bigint | number | string | null;
};

export type SuiDexTreeV3PositionCandidate = {
  poolId?: string | null;
  liquidity?: bigint | number | string | null;
  closed?: boolean | null;
};

export type MoonbagsTreeStakeCandidate = {
  owner?: string | null;
  coinType?: string | null;
  stakedAmount?: bigint | number | string | null;
  active?: boolean | null;
  withdrawn?: boolean | null;
  genericTokenLock?: boolean | null;
  projectTreasuryLock?: boolean | null;
};

export type SuiDexTreePositionSnapshot = {
  v2?: SuiDexTreeV2PositionCandidate[];
  v3?: SuiDexTreeV3PositionCandidate[];
  moonbags?: MoonbagsTreeStakeCandidate[];
  rpcUnavailable?: boolean;
  suidexUnavailable?: boolean;
  moonbagsUnavailable?: boolean;
};

export function normalizeSuiObjectId(value?: string | null): string | null {
  return typeof value === "string" && value.length > 0 ? value.toLowerCase() : null;
}

export function hasPositiveAmount(value?: bigint | number | string | null): boolean {
  if (value === null || value === undefined) return false;
  try {
    if (typeof value === "bigint") return value > BigInt(0);
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (typeof value === "string" && value.trim().length > 0) return BigInt(value) > BigInt(0);
  } catch {
    return false;
  }
  return false;
}

export function isCanonicalTreeV2Position(candidate: SuiDexTreeV2PositionCandidate): boolean {
  const poolId = normalizeSuiObjectId(candidate.poolId);
  const canonicalPool = normalizeSuiObjectId(CANONICAL_TREE_SUIDEX_V2_POOL_ID);
  return (
    poolId === canonicalPool &&
    (hasPositiveAmount(candidate.amount) || hasPositiveAmount(candidate.stakedAmount))
  );
}

export function isCanonicalTreeV3Position(candidate: SuiDexTreeV3PositionCandidate): boolean {
  const poolId = normalizeSuiObjectId(candidate.poolId);
  const canonicalPool = normalizeSuiObjectId(CANONICAL_TREE_SUIDEX_V3_POOL_ID);
  return poolId === canonicalPool && candidate.closed !== true && hasPositiveAmount(candidate.liquidity);
}

export function isCanonicalMoonbagsTreeStake(
  candidate: MoonbagsTreeStakeCandidate,
  walletAddress?: string | null,
): boolean {
  const owner = normalizeSuiObjectId(candidate.owner);
  const wallet = normalizeSuiObjectId(walletAddress);
  const coinType = typeof candidate.coinType === "string" ? candidate.coinType : null;

  if (wallet && owner !== wallet) return false;
  if (coinType !== TREE_COIN_TYPE) return false;
  if (candidate.active !== true || candidate.withdrawn === true) return false;
  if (candidate.genericTokenLock === true || candidate.projectTreasuryLock === true) return false;
  return hasPositiveAmount(candidate.stakedAmount);
}

export function getFifthMoveEligibilityFromPositions(
  snapshot: SuiDexTreePositionSnapshot,
): FifthMoveEligibility {
  const hasV2 = snapshot.v2?.some(isCanonicalTreeV2Position) ?? false;
  const hasV3 = snapshot.v3?.some(isCanonicalTreeV3Position) ?? false;
  const hasMoonbags = snapshot.moonbags?.some((stake) => isCanonicalMoonbagsTreeStake(stake)) ?? false;
  const sources: FifthMoveQualificationSource[] = [];

  if (hasV2) sources.push("suidex-v2");
  if (hasV3) sources.push("suidex-v3");
  if (hasMoonbags) sources.push("moonbags-staking");

  if (sources.length > 0) return { status: "qualified", sources };

  if (snapshot.rpcUnavailable || snapshot.suidexUnavailable || snapshot.moonbagsUnavailable) {
    return { status: "unavailable", sources: [] };
  }

  return { status: "not-qualified", sources: [] };
}

export function hasVerifiedSuiDexPositionShapes(): boolean {
  return Boolean(CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE || CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE);
}

export function hasVerifiedMoonbagsStakeShape(): boolean {
  return Boolean(MOONBAGS_TREE_STAKING_PACKAGE_ID && MOONBAGS_TREE_STAKING_POSITION_TYPE);
}

export function hasVerifiedFifthMoveProviderShapes(): boolean {
  return hasVerifiedSuiDexPositionShapes() || hasVerifiedMoonbagsStakeShape();
}
