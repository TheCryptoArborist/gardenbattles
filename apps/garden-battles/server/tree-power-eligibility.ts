import { SuiClient } from "@mysten/sui/client";
import {
  FIFTH_MOVE_THRESHOLD_RAW,
  TREE_COIN_TYPE,
  VERIFIED_TREE_DECIMALS,
  aggregateFifthMoveEligibility,
  calculateV2TotalUnderlyingTreeRaw,
  calculateV3UnderlyingTreeForPositions,
  decodeSignedI32Bits,
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
export const CANONICAL_TREE_SUIDEX_V2_FARM_ID =
  "0xc9c6844deb5031e87f14a9869736874327e4f7b9e2aef51c47f4e004c5b1053c";
export const CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE =
  "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::farm::StakingPosition<0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, 0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>>";
export const DEFAULT_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
export const CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE =
  "0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position";
export const MOONBAGS_CURRENT_STAKING_PACKAGE_ID =
  "0x9bc9ddc5cd0220ef810489c73e770f8587a8aa09cad064a0d8e0d1ad903a9e0f";
export const MOONBAGS_TYPE_ORIGIN_PACKAGE_ID =
  "0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6";
export const MOONBAGS_STAKE_CONFIG_ID =
  "0x245161e22ea04614628b56da68fe0474fff8c3c631292c2ee1a0bd669db57959";
export const MOONBAGS_TREE_STAKING_POOL_ID =
  "0x65b92741de03a6889da61c17bccb6f1e27d3d2455b4701948d8571eab8744ece";
export const MOONBAGS_TREE_STAKING_ACCOUNT_TYPE =
  `${MOONBAGS_TYPE_ORIGIN_PACKAGE_ID}::moonbags_stake::StakingAccount`;
export const MOONBAGS_TREE_STAKING_POOL_TYPE =
  `${MOONBAGS_TYPE_ORIGIN_PACKAGE_ID}::moonbags_stake::StakingPool<${TREE_COIN_TYPE}>`;

const TREE_POWER_CACHE_MS = 60_000;
const TREE_POWER_READ_TIMEOUT_MS = 8_000;

type CacheEntry = {
  expiresAt: number;
  response: FifthMoveEligibilityResponse;
};

type GraphqlFarmPositionsResponse = {
  objects: {
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
    nodes: Array<{
      address: string;
      asMoveObject?: {
        contents?: {
          type?: { repr?: string };
          json?: Record<string, any>;
        };
      };
    }>;
  };
};

const eligibilityCache = new Map<string, CacheEntry>();

export type TreePowerReadClient = Pick<
  SuiClient,
  "getCoinMetadata" | "getObject" | "getCoins" | "getOwnedObjects" | "getDynamicFieldObject"
>;

function withTimeout<T>(promise: Promise<T>, timeoutMs = TREE_POWER_READ_TIMEOUT_MS): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("tree_power_read_timeout")), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function getFields(object: Awaited<ReturnType<TreePowerReadClient["getObject"]>>): Record<string, any> | null {
  const content = object.data?.content;
  return content && "fields" in content ? ((content as any).fields ?? null) : null;
}

function typeNameToCanonical(typeName: any): string | null {
  const name = typeof typeName === "string" ? typeName : typeName?.fields?.name;
  return typeof name === "string" ? `0x${name}` : null;
}

function readI32Bits(value: any): number | null {
  const bits = value?.fields?.bits ?? value?.bits ?? value;
  if (bits === null || bits === undefined) return null;
  return decodeSignedI32Bits(bits);
}

function isAddressOwner(owner: any, wallet: string): boolean {
  return typeof owner?.AddressOwner === "string" && owner.AddressOwner.toLowerCase() === wallet;
}

function normalizeMoveTypeName(typeName: string): string {
  return typeName
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/0x/g, "")
    .replace(/0{63}2/g, "2");
}

async function suiGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(process.env.SUI_GRAPHQL_URL || DEFAULT_SUI_GRAPHQL_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`sui_graphql_http_${response.status}`);
  const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    throw new Error(payload.errors[0]?.message || "sui_graphql_error");
  }
  if (!payload.data) throw new Error("sui_graphql_empty_response");
  return payload.data;
}

function mapGraphqlOwner(owner: any): any {
  if (owner?.__typename === "AddressOwner") {
    return { AddressOwner: owner.address?.address };
  }
  if (owner?.__typename === "ObjectOwner") {
    return { ObjectOwner: owner.address?.address };
  }
  if (owner?.__typename === "Shared") {
    return { Shared: { initial_shared_version: String(owner.initialSharedVersion) } };
  }
  if (owner?.__typename === "Immutable") return "Immutable";
  return undefined;
}

function mapGraphqlMoveObject(node: any): any {
  const moveObject = node?.asMoveObject ?? node;
  const contents = moveObject?.contents;
  const type = contents?.type?.repr;
  return {
    data: {
      objectId: node?.address ?? moveObject?.address,
      type,
      owner: mapGraphqlOwner(node?.owner),
      content: contents
        ? { dataType: "moveObject", type, fields: contents.json ?? {} }
        : undefined,
    },
  };
}

async function readGraphqlObject(objectId: string): Promise<any> {
  const data = await suiGraphql<{ object: any | null }>(
    `query($id:SuiAddress!) {
      object(address: $id) {
        address
        owner {
          __typename
          ... on AddressOwner { address { address } }
          ... on ObjectOwner { address { address } }
          ... on Shared { initialSharedVersion }
        }
        asMoveObject { contents { type { repr } json } }
      }
    }`,
    { id: objectId },
  );
  return data.object ? mapGraphqlMoveObject(data.object) : { data: null };
}

async function readGraphqlOwnedObjectsPage(input: {
  owner: string;
  type?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<any> {
  const data = await suiGraphql<{ address: { objects: any } | null }>(
    `query($owner:SuiAddress!, $filter:ObjectFilter, $first:Int, $after:String) {
      address(address: $owner) {
        objects(first: $first, after: $after, filter: $filter) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            owner {
              __typename
              ... on AddressOwner { address { address } }
              ... on ObjectOwner { address { address } }
              ... on Shared { initialSharedVersion }
            }
            contents { type { repr } json }
          }
        }
      }
    }`,
    {
      owner: input.owner,
      filter: input.type ? { type: input.type } : null,
      first: input.limit ?? 50,
      after: input.cursor ?? null,
    },
  );
  const page = data.address?.objects;
  return {
    data: (page?.nodes ?? []).map(mapGraphqlMoveObject),
    hasNextPage: Boolean(page?.pageInfo?.hasNextPage),
    nextCursor: page?.pageInfo?.endCursor ?? null,
  };
}

async function readGraphqlDynamicFieldObject(parentId: string, wallet: string): Promise<any> {
  let cursor: string | null = null;
  do {
    const data: { address: { dynamicFields: any } | null } = await suiGraphql(
      `query($parent:SuiAddress!, $first:Int, $after:String) {
        address(address: $parent) {
          dynamicFields(first: $first, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              name { type { repr } json }
              value {
                __typename
                ... on MoveObject { address contents { type { repr } json } }
              }
            }
          }
        }
      }`,
      { parent: parentId, first: 50, after: cursor },
    );
    const page = data.address?.dynamicFields;
    for (const field of page?.nodes ?? []) {
      const fieldWallet = normalizeSuiAddress(String(field?.name?.json ?? ""));
      if (fieldWallet !== wallet || field?.value?.__typename !== "MoveObject") continue;
      return mapGraphqlMoveObject(field.value);
    }
    cursor = page?.pageInfo?.hasNextPage ? (page.pageInfo.endCursor ?? null) : null;
  } while (cursor);
  return { data: null, error: { code: "dynamicFieldNotFound" } };
}

/** GraphQL-only production reader for Fifth Move eligibility. */
export function createGraphqlTreePowerClient(): TreePowerReadClient {
  return {
    async getCoinMetadata({ coinType }: any) {
      return normalizeMoveTypeName(coinType) === normalizeMoveTypeName(TREE_COIN_TYPE)
        ? { symbol: "Tree", decimals: VERIFIED_TREE_DECIMALS }
        : null;
    },
    async getObject({ id }: any) {
      return readGraphqlObject(id);
    },
    async getCoins({ owner, coinType, cursor, limit }: any) {
      const page = await readGraphqlOwnedObjectsPage({
        owner,
        type: `0x2::coin::Coin<${coinType}>`,
        cursor,
        limit,
      });
      return {
        ...page,
        data: page.data.map((item: any) => ({
          coinObjectId: item.data.objectId,
          balance: String(
            item.data.content?.fields?.balance?.value ??
            item.data.content?.fields?.balance ??
            0,
          ),
        })),
      };
    },
    async getOwnedObjects({ owner, cursor, limit }: any) {
      return readGraphqlOwnedObjectsPage({ owner, cursor, limit });
    },
    async getDynamicFieldObject({ parentId, name }: any) {
      const wallet = normalizeSuiAddress(String(name?.value ?? ""));
      if (!wallet) return { data: null, error: { code: "invalidDynamicFieldName" } };
      return readGraphqlDynamicFieldObject(parentId, wallet);
    },
  } as TreePowerReadClient;
}

function graphqlMoveObjectJson(object: any): Record<string, any> | null {
  return object?.asMoveObject?.contents?.json ?? null;
}

async function readGraphqlObjectJson(objectId: string): Promise<{ type: string; fields: Record<string, any> } | null> {
  const data = await suiGraphql<{
    object: {
      asMoveObject?: {
        contents?: {
          type?: { repr?: string };
          json?: Record<string, any>;
        };
      };
    } | null;
  }>(
    `query($id:SuiAddress!) {
      object(address: $id) {
        asMoveObject {
          contents {
            type { repr }
            json
          }
        }
      }
    }`,
    { id: objectId },
  );
  const fields = graphqlMoveObjectJson(data.object);
  const type = data.object?.asMoveObject?.contents?.type?.repr;
  return fields && type ? { type, fields } : null;
}

async function readSuiDexV2FarmedLp(wallet: string): Promise<{ farmedLpRaw: bigint; objectIds: string[] }> {
  let cursor: string | null = null;
  let farmedLpRaw = BigInt(0);
  const objectIds: string[] = [];
  const canonicalPositionType = normalizeMoveTypeName(CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE);
  const canonicalLpType = normalizeMoveTypeName(CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE);

  do {
    const data: GraphqlFarmPositionsResponse = await suiGraphql<GraphqlFarmPositionsResponse>(
      `query($owner:SuiAddress!, $type:String!, $after:String) {
        objects(first: 50, after: $after, filter: { owner: $owner, type: $type }) {
          pageInfo { hasNextPage endCursor }
          nodes {
            address
            asMoveObject {
              contents {
                type { repr }
                json
              }
            }
          }
        }
      }`,
      { owner: wallet, type: CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE, after: cursor },
    );

    for (const node of data.objects.nodes) {
      const type = node.asMoveObject?.contents?.type?.repr;
      const fields = graphqlMoveObjectJson(node);
      if (!type || !fields) continue;
      if (normalizeMoveTypeName(type) !== canonicalPositionType) continue;
      if (String(fields.owner ?? "").toLowerCase() !== wallet) continue;
      if (normalizeMoveTypeName(String(fields.pool_type ?? "")) !== canonicalLpType) continue;
      const amount = BigInt(fields.amount ?? 0);
      if (amount <= BigInt(0)) continue;

      const vaultId = String(fields.vault_id ?? "");
      const vault = vaultId ? await readGraphqlObjectJson(vaultId) : null;
      if (!vault || !normalizeMoveTypeName(vault.type).includes("::farm::stakedtokenvault<")) continue;
      if (String(vault.fields.owner ?? "").toLowerCase() !== wallet) continue;
      if (normalizeMoveTypeName(String(vault.fields.pool_type ?? "")) !== canonicalLpType) continue;
      const vaultAmount = BigInt(vault.fields.amount ?? vault.fields.balance ?? 0);
      const vaultBalance = BigInt(vault.fields.balance ?? vault.fields.amount ?? 0);
      if (vaultAmount !== amount || vaultBalance !== amount) continue;

      farmedLpRaw += amount;
      objectIds.push(node.address, vaultId);
    }

    cursor = data.objects.pageInfo.hasNextPage ? (data.objects.pageInfo.endCursor ?? null) : null;
  } while (cursor);

  return { farmedLpRaw, objectIds };
}

function isVerifiedTreeV2Pool(object: Awaited<ReturnType<TreePowerReadClient["getObject"]>>): boolean {
  const type = object.data?.type ?? "";
  return (
    object.data?.objectId?.toLowerCase() === CANONICAL_TREE_SUIDEX_V2_POOL_ID &&
    type.includes("::pair::Pair<") &&
    type.includes(TREE_COIN_TYPE)
  );
}

async function getAllCoinBalanceRaw(
  client: TreePowerReadClient,
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

async function verifyTreeMetadata(client: TreePowerReadClient): Promise<void> {
  const metadata = await client.getCoinMetadata({ coinType: TREE_COIN_TYPE });
  if (!metadata || metadata.symbol !== "Tree" || metadata.decimals !== VERIFIED_TREE_DECIMALS) {
    throw new Error("unexpected_tree_coin_metadata");
  }
}

async function readSuiDexV2DirectLp(client: TreePowerReadClient, wallet: string): Promise<FifthMoveSourceResult> {
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

    const farmedLp = await readSuiDexV2FarmedLp(wallet);
    const combinedLpRaw = lpCoins.total + farmedLp.farmedLpRaw;

    if (combinedLpRaw <= BigInt(0)) {
      return {
        source: "suidex-v2",
        status: "verified-zero",
        underlyingTreeRaw: BigInt(0),
        evidence: {
          poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
          objectIds: [],
          positionCount: 0,
        },
        reason: "direct_wallet_lp_and_verified_farmed_lp_zero",
      };
    }

    const underlyingTreeRaw = calculateV2TotalUnderlyingTreeRaw({
      directLpRaw: lpCoins.total,
      farmedLpRaw: farmedLp.farmedLpRaw,
      poolTreeReserveRaw,
      totalLpSupplyRaw,
    });

    return {
      source: "suidex-v2",
      status: underlyingTreeRaw > BigInt(0) ? "qualified-data" : "verified-zero",
      underlyingTreeRaw,
      evidence: {
        poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
        objectIds: [...lpCoins.objectIds, ...farmedLp.objectIds],
        positionCount: lpCoins.objectIds.length + farmedLp.objectIds.length,
      },
      reason: farmedLp.farmedLpRaw > BigInt(0)
        ? "direct_wallet_lp_and_verified_farmed_lp_principal"
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

async function readSuiDexV3StatusForWallet(client: TreePowerReadClient, wallet: string): Promise<FifthMoveSourceResult> {
  try {
    const poolObject = await client.getObject({
      id: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      options: { showContent: true, showType: true, showOwner: true },
    });
    const type = poolObject.data?.type ?? "";
    const fields = getFields(poolObject);
    const treeIsTypeY = typeNameToCanonical(fields?.type_y) === TREE_COIN_TYPE;

    if (!type.includes("::pool::Pool<") || !type.includes(TREE_COIN_TYPE) || !treeIsTypeY) {
      return {
        source: "suidex-v3",
        status: "unavailable",
        reason: "canonical_v3_pool_shape_mismatch",
        evidence: { poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID },
      };
    }

    if (!wallet || typeof (client as any).getOwnedObjects !== "function") {
      return {
        source: "suidex-v3",
        status: "unavailable",
        reason: "v3_owned_position_lookup_unavailable",
        evidence: { poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID, positionCount: 0 },
      };
    }

    const positions = [];
    let cursor: string | null = null;
    do {
      const page = await client.getOwnedObjects({
        owner: wallet,
        cursor,
        limit: 50,
        options: {
          showContent: true,
          showOwner: true,
          showType: true,
          showPreviousTransaction: true,
        },
      });

      for (const item of page.data ?? []) {
        if (item.data?.type !== CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE) continue;
        if (!isAddressOwner(item.data.owner, wallet)) continue;
        const positionFields = getFields(item as any);
        if (!positionFields) continue;
        const positionPoolId = String(positionFields.pool_id ?? "").toLowerCase();
        if (positionPoolId !== CANONICAL_TREE_SUIDEX_V3_POOL_ID) continue;
        if (typeNameToCanonical(positionFields.type_y) !== TREE_COIN_TYPE) continue;
        const tickLower = readI32Bits(positionFields.tick_lower_index);
        const tickUpper = readI32Bits(positionFields.tick_upper_index);
        if (tickLower === null || tickUpper === null) continue;
        positions.push({
          objectId: item.data.objectId,
          poolId: positionFields.pool_id,
          liquidity: BigInt(positionFields.liquidity ?? 0),
          tickLower,
          tickUpper,
          closed: Boolean(positionFields.closed),
        });
      }

      cursor = page.hasNextPage ? (page.nextCursor ?? null) : null;
    } while (cursor);

    const underlying = calculateV3UnderlyingTreeForPositions({
      pool: {
        poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
        sqrtPriceCurrent: BigInt(fields?.sqrt_price ?? 0),
        treeTokenIndex: 1,
      },
      positions,
    });

    return {
      source: "suidex-v3",
      status: underlying.underlyingTreeRaw > BigInt(0) ? "qualified-data" : "verified-zero",
      underlyingTreeRaw: underlying.underlyingTreeRaw,
      reason: "v3_pool_and_owned_positions_verified_principal_only",
      evidence: {
        poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
        objectIds: underlying.objectIds,
        positionCount: underlying.positionCount,
      },
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

function isVerifiedMoonbagsTreePool(object: Awaited<ReturnType<TreePowerReadClient["getObject"]>>): boolean {
  const type = object.data?.type ?? "";
  const fields = getFields(object);
  const stakingTokenType = fields?.staking_token?.type ?? "";
  const hasCanonicalStakingBalance = /^\d+$/.test(String(fields?.staking_token?.balance ?? ""));
  return (
    object.data?.objectId?.toLowerCase() === MOONBAGS_TREE_STAKING_POOL_ID &&
    type === MOONBAGS_TREE_STAKING_POOL_TYPE &&
    (
      stakingTokenType === `0x2::coin::Coin<${TREE_COIN_TYPE}>` ||
      (stakingTokenType === "" && hasCanonicalStakingBalance)
    )
  );
}

function moonbagsMissingDynamicField(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamic field.*not.*found|object.*not.*exist|not exist|not found/i.test(message);
}

async function readMoonbagsStatus(client: TreePowerReadClient, wallet: string): Promise<FifthMoveSourceResult> {
  try {
    const poolObject = await client.getObject({
      id: MOONBAGS_TREE_STAKING_POOL_ID,
      options: { showContent: true, showType: true, showOwner: true },
    });
    if (!isVerifiedMoonbagsTreePool(poolObject)) {
      return {
        source: "moonbags-staking",
        status: "unavailable",
        reason: "moonbags_tree_staking_pool_shape_mismatch",
        evidence: { poolId: MOONBAGS_TREE_STAKING_POOL_ID, positionCount: 0 },
      };
    }

    let accountObject: Awaited<ReturnType<TreePowerReadClient["getDynamicFieldObject"]>>;
    try {
      accountObject = await client.getDynamicFieldObject({
        parentId: MOONBAGS_TREE_STAKING_POOL_ID,
        name: { type: "address", value: wallet },
      });
    } catch (error) {
      if (moonbagsMissingDynamicField(error)) {
        return {
          source: "moonbags-staking",
          status: "verified-zero",
          underlyingTreeRaw: BigInt(0),
          reason: "moonbags_tree_staking_account_not_found",
          evidence: { poolId: MOONBAGS_TREE_STAKING_POOL_ID, positionCount: 0 },
        };
      }
      throw error;
    }

    if (!accountObject.data) {
      return {
        source: "moonbags-staking",
        status: "verified-zero",
        underlyingTreeRaw: BigInt(0),
        reason: "moonbags_tree_staking_account_not_found",
        evidence: { poolId: MOONBAGS_TREE_STAKING_POOL_ID, positionCount: 0 },
      };
    }

    if (accountObject.data.type !== MOONBAGS_TREE_STAKING_ACCOUNT_TYPE) {
      return {
        source: "moonbags-staking",
        status: "unavailable",
        reason: "moonbags_tree_staking_account_shape_mismatch",
        evidence: {
          poolId: MOONBAGS_TREE_STAKING_POOL_ID,
          objectIds: [accountObject.data.objectId],
          positionCount: 1,
        },
      };
    }

    const fields = getFields(accountObject as any);
    if (!fields || String(fields.staker ?? "").toLowerCase() !== wallet) {
      return {
        source: "moonbags-staking",
        status: "unavailable",
        reason: "moonbags_tree_staking_account_owner_mismatch",
        evidence: {
          poolId: MOONBAGS_TREE_STAKING_POOL_ID,
          objectIds: [accountObject.data.objectId],
          positionCount: 1,
        },
      };
    }

    const stakedTreeRaw = BigInt(fields.balance ?? 0);
    return {
      source: "moonbags-staking",
      status: stakedTreeRaw > BigInt(0) ? "qualified-data" : "verified-zero",
      underlyingTreeRaw: stakedTreeRaw,
      reason: stakedTreeRaw > BigInt(0)
        ? "moonbags_tree_staking_account_principal_verified"
        : "moonbags_tree_staking_account_zero_principal",
      evidence: {
        poolId: MOONBAGS_TREE_STAKING_POOL_ID,
        objectIds: [accountObject.data.objectId],
        positionCount: stakedTreeRaw > BigInt(0) ? 1 : 0,
      },
    };
  } catch (err) {
    return {
      source: "moonbags-staking",
      status: "unavailable",
      reason: err instanceof Error ? err.message : "moonbags_tree_staking_read_failed",
      evidence: { poolId: MOONBAGS_TREE_STAKING_POOL_ID, positionCount: 0 },
    };
  }
}

export async function getFifthMoveEligibility(
  client: TreePowerReadClient,
  address: string,
): Promise<FifthMoveEligibilityResult> {
  const wallet = normalizeSuiAddress(address);
  if (!wallet) {
    throw new Error("invalid_sui_address");
  }

  await verifyTreeMetadata(client);

  const [v2, v3, moonbags] = await Promise.all([
    readSuiDexV2DirectLp(client, wallet),
    readSuiDexV3StatusForWallet(client, wallet),
    readMoonbagsStatus(client, wallet),
  ]);

  return aggregateFifthMoveEligibility({
    wallet,
    thresholdRaw: FIFTH_MOVE_THRESHOLD_RAW,
    sources: [v2, v3, moonbags],
  });
}

export async function getCachedFifthMoveEligibility(
  client: TreePowerReadClient,
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
