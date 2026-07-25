export const TREE_COIN_TYPE =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

export const VERIFIED_TREE_DECIMALS = 6;
export const FIFTH_MOVE_THRESHOLD_TREE = "1000000";
function pow10(decimals: number): bigint {
  let result = BigInt(1);
  for (let index = 0; index < decimals; index += 1) {
    result *= BigInt(10);
  }
  return result;
}

export const FIFTH_MOVE_THRESHOLD_RAW = BigInt(1_000_000) * pow10(VERIFIED_TREE_DECIMALS);
export const Q64 = BigInt(1) << BigInt(64);

export type FifthMoveSource = "suidex-v2" | "suidex-v3" | "moonbags-staking";
export type PositionSourceStatus = "qualified-data" | "verified-zero" | "unavailable";
export type FifthMoveEligibilityStatus =
  | "qualified"
  | "not-qualified"
  | "verification-incomplete"
  | "unavailable";

export type FifthMoveSourceResult = {
  source: FifthMoveSource;
  status: PositionSourceStatus;
  underlyingTreeRaw?: bigint;
  underlyingTreeDisplay?: string;
  evidence?: {
    objectIds?: string[];
    poolId?: string;
    positionCount?: number;
  };
  reason?: string;
};

export type SuiDexV2FarmCandidate = {
  objectId?: string;
  farmId?: string;
  lpAmountRaw?: bigint | number | string | null;
  active?: boolean;
  withdrawn?: boolean;
};

export type SuiDexV3PositionCandidate = {
  objectId?: string;
  poolId?: string;
  liquidity: bigint | number | string;
  sqrtPriceLower: bigint | number | string;
  sqrtPriceUpper: bigint | number | string;
  closed?: boolean;
};

export type SuiDexV3PoolSnapshot = {
  poolId: string;
  sqrtPriceCurrent: bigint | number | string;
  treeTokenIndex: 0 | 1;
};

export type MoonbagsTreeStakeCandidate = {
  objectId?: string;
  owner?: string;
  coinType?: string;
  stakedAmountRaw?: bigint | number | string | null;
  rewardsRaw?: bigint | number | string | null;
  active?: boolean;
  withdrawn?: boolean;
  genericTokenLock?: boolean;
  projectTreasuryLock?: boolean;
};

export type FifthMoveEligibilityResult = {
  wallet: string;
  status: FifthMoveEligibilityStatus;
  thresholdTree: string;
  thresholdRaw: bigint;
  verifiedUnderlyingTree: string;
  verifiedUnderlyingTreeRaw: bigint;
  remainingTree?: string;
  remainingTreeRaw?: bigint;
  sources: FifthMoveSourceResult[];
};

export type FifthMoveEligibilityResponse = Omit<
  FifthMoveEligibilityResult,
  "thresholdRaw" | "verifiedUnderlyingTreeRaw" | "remainingTreeRaw" | "sources"
> & {
  thresholdRaw: string;
  verifiedUnderlyingTreeRaw: string;
  remainingTreeRaw?: string;
  sources: Array<Omit<FifthMoveSourceResult, "underlyingTreeRaw"> & { underlyingTreeRaw?: string }>;
};

export function normalizeSuiAddress(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^0x[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
}

export function displayTreeToRaw(display: string, decimals = VERIFIED_TREE_DECIMALS): bigint {
  const value = display.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error("Invalid TREE display amount");
  }

  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > decimals) {
    throw new Error("TREE display amount has too many decimal places");
  }

  return BigInt(whole) * pow10(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

export function rawTreeToDisplay(raw: bigint, decimals = VERIFIED_TREE_DECIMALS): string {
  const scale = pow10(decimals);
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

export function calculateV2UnderlyingTreeRaw(input: {
  playerLpRaw: bigint;
  poolTreeReserveRaw: bigint;
  totalLpSupplyRaw: bigint;
}): bigint {
  if (input.playerLpRaw <= BigInt(0) || input.poolTreeReserveRaw <= BigInt(0)) return BigInt(0);
  if (input.totalLpSupplyRaw <= BigInt(0)) throw new Error("total LP supply must be positive");
  return (input.playerLpRaw * input.poolTreeReserveRaw) / input.totalLpSupplyRaw;
}

function toNonNegativeBigInt(value: bigint | number | string | null | undefined): bigint {
  if (value === null || value === undefined) return BigInt(0);
  const parsed = BigInt(value);
  return parsed > BigInt(0) ? parsed : BigInt(0);
}

export function getVerifiedV2FarmedLpRaw(input: {
  candidates: SuiDexV2FarmCandidate[];
  canonicalFarmId: string;
}): { farmedLpRaw: bigint; objectIds: string[] } {
  const canonicalFarmId = input.canonicalFarmId.toLowerCase();
  let farmedLpRaw = BigInt(0);
  const objectIds: string[] = [];

  for (const candidate of input.candidates) {
    if (!candidate.farmId || candidate.farmId.toLowerCase() !== canonicalFarmId) continue;
    if (candidate.withdrawn || candidate.active === false) continue;
    const amount = toNonNegativeBigInt(candidate.lpAmountRaw);
    if (amount <= BigInt(0)) continue;
    farmedLpRaw += amount;
    if (candidate.objectId) objectIds.push(candidate.objectId);
  }

  return { farmedLpRaw, objectIds };
}

export function calculateV2TotalUnderlyingTreeRaw(input: {
  directLpRaw?: bigint;
  farmedLpRaw?: bigint;
  poolTreeReserveRaw: bigint;
  totalLpSupplyRaw: bigint;
}): bigint {
  return calculateV2UnderlyingTreeRaw({
    playerLpRaw: (input.directLpRaw ?? BigInt(0)) + (input.farmedLpRaw ?? BigInt(0)),
    poolTreeReserveRaw: input.poolTreeReserveRaw,
    totalLpSupplyRaw: input.totalLpSupplyRaw,
  });
}

export function calculateClmmTokenAmounts(input: {
  liquidity: bigint;
  sqrtPriceLower: bigint;
  sqrtPriceCurrent: bigint;
  sqrtPriceUpper: bigint;
}): { token0Raw: bigint; token1Raw: bigint } {
  const { liquidity, sqrtPriceLower, sqrtPriceCurrent, sqrtPriceUpper } = input;
  if (liquidity <= BigInt(0)) return { token0Raw: BigInt(0), token1Raw: BigInt(0) };
  if (sqrtPriceLower <= BigInt(0) || sqrtPriceUpper <= sqrtPriceLower) {
    throw new Error("invalid CLMM price range");
  }

  if (sqrtPriceCurrent <= sqrtPriceLower) {
    return {
      token0Raw: (liquidity * (sqrtPriceUpper - sqrtPriceLower) * Q64) / (sqrtPriceUpper * sqrtPriceLower),
      token1Raw: BigInt(0),
    };
  }

  if (sqrtPriceCurrent >= sqrtPriceUpper) {
    return {
      token0Raw: BigInt(0),
      token1Raw: (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / Q64,
    };
  }

  return {
    token0Raw: (liquidity * (sqrtPriceUpper - sqrtPriceCurrent) * Q64) / (sqrtPriceUpper * sqrtPriceCurrent),
    token1Raw: (liquidity * (sqrtPriceCurrent - sqrtPriceLower)) / Q64,
  };
}

export function calculateV3UnderlyingTreeRaw(input: {
  liquidity: bigint;
  sqrtPriceLower: bigint;
  sqrtPriceCurrent: bigint;
  sqrtPriceUpper: bigint;
  treeTokenIndex: 0 | 1;
  closed?: boolean;
}): bigint {
  if (input.closed || input.liquidity <= BigInt(0)) return BigInt(0);
  const amounts = calculateClmmTokenAmounts(input);
  return input.treeTokenIndex === 0 ? amounts.token0Raw : amounts.token1Raw;
}

export function calculateV3UnderlyingTreeForPositions(input: {
  pool: SuiDexV3PoolSnapshot;
  positions: SuiDexV3PositionCandidate[];
}): { underlyingTreeRaw: bigint; objectIds: string[]; positionCount: number } {
  let underlyingTreeRaw = BigInt(0);
  const objectIds: string[] = [];

  for (const position of input.positions) {
    if (position.poolId && position.poolId.toLowerCase() !== input.pool.poolId.toLowerCase()) continue;
    const amount = calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(position.liquidity),
      sqrtPriceLower: BigInt(position.sqrtPriceLower),
      sqrtPriceCurrent: BigInt(input.pool.sqrtPriceCurrent),
      sqrtPriceUpper: BigInt(position.sqrtPriceUpper),
      treeTokenIndex: input.pool.treeTokenIndex,
      closed: position.closed,
    });
    if (amount <= BigInt(0)) continue;
    underlyingTreeRaw += amount;
    if (position.objectId) objectIds.push(position.objectId);
  }

  return { underlyingTreeRaw, objectIds, positionCount: objectIds.length };
}

export function calculateMoonbagsStakedTreeRaw(input: {
  wallet: string;
  candidates: MoonbagsTreeStakeCandidate[];
  treeCoinType?: string;
}): { stakedTreeRaw: bigint; objectIds: string[] } {
  const wallet = input.wallet.toLowerCase();
  const treeCoinType = (input.treeCoinType ?? TREE_COIN_TYPE).toLowerCase();
  let stakedTreeRaw = BigInt(0);
  const objectIds: string[] = [];

  for (const candidate of input.candidates) {
    if (candidate.owner && candidate.owner.toLowerCase() !== wallet) continue;
    if (!candidate.coinType || candidate.coinType.toLowerCase() !== treeCoinType) continue;
    if (candidate.withdrawn || candidate.active === false) continue;
    if (candidate.genericTokenLock || candidate.projectTreasuryLock) continue;
    const amount = toNonNegativeBigInt(candidate.stakedAmountRaw);
    if (amount <= BigInt(0)) continue;
    stakedTreeRaw += amount;
    if (candidate.objectId) objectIds.push(candidate.objectId);
  }

  return { stakedTreeRaw, objectIds };
}

export function aggregateFifthMoveEligibility(input: {
  wallet: string;
  sources: FifthMoveSourceResult[];
  thresholdRaw?: bigint;
  decimals?: number;
}): FifthMoveEligibilityResult {
  const thresholdRaw = input.thresholdRaw ?? FIFTH_MOVE_THRESHOLD_RAW;
  const decimals = input.decimals ?? VERIFIED_TREE_DECIMALS;
  const verifiedSources = input.sources.filter((source) => source.status !== "unavailable");
  const unavailableSources = input.sources.filter((source) => source.status === "unavailable");
  const verifiedUnderlyingTreeRaw = verifiedSources.reduce(
    (total, source) => total + (source.underlyingTreeRaw ?? BigInt(0)),
    BigInt(0),
  );

  let status: FifthMoveEligibilityStatus;
  if (verifiedUnderlyingTreeRaw >= thresholdRaw) {
    status = "qualified";
  } else if (verifiedSources.length === 0 && unavailableSources.length > 0) {
    status = "unavailable";
  } else if (unavailableSources.length > 0) {
    status = "verification-incomplete";
  } else {
    status = "not-qualified";
  }

  const remainingTreeRaw = verifiedUnderlyingTreeRaw >= thresholdRaw
    ? undefined
    : thresholdRaw - verifiedUnderlyingTreeRaw;

  return {
    wallet: input.wallet.toLowerCase(),
    status,
    thresholdTree: rawTreeToDisplay(thresholdRaw, decimals),
    thresholdRaw,
    verifiedUnderlyingTree: rawTreeToDisplay(verifiedUnderlyingTreeRaw, decimals),
    verifiedUnderlyingTreeRaw,
    remainingTree: remainingTreeRaw === undefined ? undefined : rawTreeToDisplay(remainingTreeRaw, decimals),
    remainingTreeRaw,
    sources: input.sources.map((source) => ({
      ...source,
      underlyingTreeDisplay:
        source.underlyingTreeRaw === undefined
          ? source.underlyingTreeDisplay
          : rawTreeToDisplay(source.underlyingTreeRaw, decimals),
    })),
  };
}

export function serializeFifthMoveEligibility(
  result: FifthMoveEligibilityResult,
): FifthMoveEligibilityResponse {
  return {
    wallet: result.wallet,
    status: result.status,
    thresholdTree: result.thresholdTree,
    thresholdRaw: result.thresholdRaw.toString(),
    verifiedUnderlyingTree: result.verifiedUnderlyingTree,
    verifiedUnderlyingTreeRaw: result.verifiedUnderlyingTreeRaw.toString(),
    remainingTree: result.remainingTree,
    remainingTreeRaw: result.remainingTreeRaw?.toString(),
    sources: result.sources.map((source) => ({
      ...source,
      underlyingTreeRaw: source.underlyingTreeRaw?.toString(),
    })),
  };
}
