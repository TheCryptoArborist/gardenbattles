import { SuiClient } from "@mysten/sui/client";
import {
  FIFTH_MOVE_THRESHOLD_RAW,
  TREE_COIN_TYPE,
  VERIFIED_TREE_DECIMALS,
  aggregateFifthMoveEligibility,
  calculateV2TotalUnderlyingTreeRaw,
  normalizeSuiAddress,
  serializeFifthMoveEligibility,
  type FifthMoveEligibilityResponse,
  type FifthMoveEligibilityResult,
  type FifthMoveSourceResult,
} from "../shared/tree-power-eligibility";

export const CANONICAL_TREE_SUIDEX_V2_POOL_ID =
  "0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc";
export const CANONICAL_TREE_SUIDEX_V3_POOL_ID =
  "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf";
export const CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE =
  "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, 0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>";
export const CANONICAL_TREE_SUIDEX_V2_FARM_ID: string | null = null;
export const CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE: string | null = null;
export const MOONBAGS_TREE_STAKING_POOL_ID: string | null = null;
export const MOONBAGS_TREE_STAKE_POSITION_TYPE: string | null = null;

const TREE_POWER_CACHE_MS = 60_000;
const TREE_POWER_READ_TIMEOUT_MS = 8_000;

type CacheEntry = {
  expiresAt: number;
  response: FifthMoveEligibilityResponse;
};

const eligibilityCache = new Map<string, CacheEntry>();

function withTimeout<T>(promise: Promise<T>, timeoutMs = TREE_POWER_READ_TIMEOUT_MS): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("tree_power_read_timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function getFields(object: Awaited<ReturnType<SuiClient["getObject"]>>): Record<string, any> | null {
  const content = object.data?.content;
  return content && "fields" in content ? ((content as any).fields ?? null) : null;
}

function isVerifiedTreeV2Pool(object: Awaited<ReturnType<SuiClient["getObject"]>>): boolean {
  const type = object.data?.type ?? "";
  return (
    object.data?.objectId?.toLowerCase() === CANONICAL_TREE_SUIDEX_V2_POOL_ID &&
    type.includes("::pair::Pair<") &&
    type.includes(TREE_COIN_TYPE)
  );
}

async function getAllCoinBalanceRaw(
  client: SuiClient,
  owner: string,
  coinType: string,
): Promise<{ total: bigint; objectIds: string[] }> {
  let cursor: string | null = null;
  let total = BigInt(0);
  const objectIds: string[] = [];

  do {
    const page = await client.getCoins({
      owner,
      coinType,
      cursor,
      limit: 50,
    });

    for (const coin of page.data) {
      total += BigInt(coin.balance);
      objectIds.push(coin.coinObjectId);
    }

    cursor = page.hasNextPage ? (page.nextCursor ?? null) : null;
  } while (cursor);

  return { total, objectIds };
}

async function verifyTreeMetadata(client: SuiClient): Promise<void> {
  const metadata = await client.getCoinMetadata({ coinType: TREE_COIN_TYPE });
  if (!metadata || metadata.symbol !== "Tree" || metadata.decimals !== VERIFIED_TREE_DECIMALS) {
    throw new Error("unexpected_tree_coin_metadata");
  }
}

async function readSuiDexV2DirectLp(client: SuiClient, wallet: string): Promise<FifthMoveSourceResult> {
  try {
    const [poolObject, lpCoins] = await Promise.all([
      client.getObject({
        id: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
        options: { showContent: true, showType: true, showOwner: true },
      }),
      getAllCoinBalanceRaw(client, wallet, CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE),
    ]);

    if (!isVerifiedTreeV2Pool(poolObject)) {
      return {
        source: "suidex-v2",
        status: "unavailable",
        reason: "canonical_v2_pool_shape_mismatch",
        evidence: { poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID },
      };
    }

    const fields = getFields(poolObject);
    const poolTreeReserveRaw = BigInt(fields?.reserve1 ?? fields?.balance1 ?? 0);
    const totalLpSupplyRaw = BigInt(fields?.total_supply ?? fields?.lp_supply?.fields?.value ?? 0);

    if (lpCoins.total <= BigInt(0)) {
      return {
        source: "suidex-v2",
        status: "unavailable",
        underlyingTreeRaw: BigInt(0),
        evidence: {
          poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
          objectIds: [],
          positionCount: 0,
        },
        reason: "direct_lp_zero_and_v2_farm_representation_unverified",
      };
    }

    const underlyingTreeRaw = calculateV2TotalUnderlyingTreeRaw({
      directLpRaw: lpCoins.total,
      farmedLpRaw: BigInt(0),
      poolTreeReserveRaw,
      totalLpSupplyRaw,
    });

    return {
      source: "suidex-v2",
      status: underlyingTreeRaw > BigInt(0) ? "qualified-data" : "verified-zero",
      underlyingTreeRaw,
      evidence: {
        poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
        objectIds: lpCoins.objectIds,
        positionCount: lpCoins.objectIds.length,
      },
      reason:
        CANONICAL_TREE_SUIDEX_V2_FARM_ID === null
          ? "direct_wallet_lp_verified_v2_farm_unavailable_until_farm_id_and_receipt_shape_are_verified"
          : "direct_wallet_lp_verified",
    };
  } catch (err) {
    return {
      source: "suidex-v2",
      status: "unavailable",
      reason: err instanceof Error ? err.message : "suidex_v2_read_failed",
      evidence: { poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID },
    };
  }
}

async function readSuiDexV3Status(client: SuiClient): Promise<FifthMoveSourceResult> {
  try {
    const poolObject = await client.getObject({
      id: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      options: { showContent: true, showType: true, showOwner: true },
    });
    const type = poolObject.data?.type ?? "";
    const fields = getFields(poolObject);
    const treeIsTypeY = fields?.type_y?.fields?.name === TREE_COIN_TYPE.replace(/^0x/, "");

    if (!type.includes("::pool::Pool<") || !type.includes(TREE_COIN_TYPE) || !treeIsTypeY) {
      return {
        source: "suidex-v3",
        status: "unavailable",
        reason: "canonical_v3_pool_shape_mismatch",
        evidence: { poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID },
      };
    }

    return {
      source: "suidex-v3",
      status: "unavailable",
      reason:
        CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE === null
          ? "v3_pool_verified_position_object_type_and_owner_lookup_not_yet_verified"
          : "v3_position_lookup_not_enabled",
      evidence: { poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID, positionCount: 0 },
    };
  } catch (err) {
    return {
      source: "suidex-v3",
      status: "unavailable",
      reason: err instanceof Error ? err.message : "suidex_v3_read_failed",
      evidence: { poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID },
    };
  }
}

function readMoonbagsStatus(): FifthMoveSourceResult {
  return {
    source: "moonbags-staking",
    status: "unavailable",
    reason:
      MOONBAGS_TREE_STAKING_POOL_ID === null || MOONBAGS_TREE_STAKE_POSITION_TYPE === null
        ? "moonbags_tree_staking_pool_and_position_shape_not_yet_verified"
        : "moonbags_tree_staking_lookup_not_enabled",
    evidence: { positionCount: 0 },
  };
}

export async function getFifthMoveEligibility(
  client: SuiClient,
  address: string,
): Promise<FifthMoveEligibilityResult> {
  const wallet = normalizeSuiAddress(address);
  if (!wallet) {
    throw new Error("invalid_sui_address");
  }

  await verifyTreeMetadata(client);

  const [v2, v3] = await Promise.all([
    readSuiDexV2DirectLp(client, wallet),
    readSuiDexV3Status(client),
  ]);

  return aggregateFifthMoveEligibility({
    wallet,
    thresholdRaw: FIFTH_MOVE_THRESHOLD_RAW,
    sources: [v2, v3, readMoonbagsStatus()],
  });
}

export async function getCachedFifthMoveEligibility(
  client: SuiClient,
  address: string,
): Promise<FifthMoveEligibilityResponse> {
  const wallet = normalizeSuiAddress(address);
  if (!wallet) {
    throw new Error("invalid_sui_address");
  }

  const cached = eligibilityCache.get(wallet);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.response;
  }

  const response = serializeFifthMoveEligibility(
    await withTimeout(getFifthMoveEligibility(client, wallet)),
  );
  eligibilityCache.set(wallet, {
    expiresAt: Date.now() + TREE_POWER_CACHE_MS,
    response,
  });
  return response;
}

export function clearTreePowerEligibilityCache(): void {
  eligibilityCache.clear();
}
