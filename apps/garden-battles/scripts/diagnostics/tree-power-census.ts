import { readFile } from "node:fs/promises";
import {
  calculateV2UnderlyingTreeRaw,
  calculateV3UnderlyingTreeForPositions,
  displayTreeToRaw,
  rawTreeToDisplay,
  TREE_COIN_TYPE,
  type FifthMoveEligibilityStatus,
} from "../../shared/tree-power-eligibility";
import {
  CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE,
  CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  CANONICAL_TREE_SUIDEX_V3_POOL_ID,
  CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE,
  DEFAULT_SUI_GRAPHQL_URL,
  MOONBAGS_TREE_STAKING_ACCOUNT_TYPE,
  MOONBAGS_TREE_STAKING_POOL_ID,
} from "../../server/tree-power-eligibility";

const TREE_THRESHOLD_LABEL = "1000000";
const DIRECT_V2_COIN_TYPE = `0x2::coin::Coin<${CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE}>`;

type CensusOptions = {
  walletFile?: string;
  graphqlUrl: string;
};

type MoveObjectJson = {
  address?: string;
  asMoveObject?: {
    contents?: {
      type?: { repr?: string };
      json?: Record<string, any>;
    };
  };
};

type WalletEligibilitySnapshot = {
  wallet: string;
  status: FifthMoveEligibilityStatus;
  directV2TreeRaw: bigint;
  farmedV2TreeRaw: bigint;
  v3TreeRaw: bigint;
  moonbagsTreeRaw: bigint;
  totalVerifiedTreeRaw: bigint;
  unavailableSources: string[];
};

function parseArgs(argv: string[]): CensusOptions {
  const options: CensusOptions = {
    graphqlUrl: process.env.SUI_GRAPHQL_URL || DEFAULT_SUI_GRAPHQL_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--wallet-file") {
      options.walletFile = next;
      index += 1;
    } else if (arg === "--graphql-url") {
      options.graphqlUrl = next;
      index += 1;
    }
  }

  return options;
}

function percentile(values: bigint[], ratio: number): bigint {
  if (values.length === 0) return BigInt(0);
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio));
  return sorted[index];
}

async function readWallets(path?: string): Promise<string[]> {
  if (!path) {
    throw new Error("Provide --wallet-file with one NFTree owner wallet address per line.");
  }
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const walletPattern = /^0x[0-9a-fA-F]{64}$/;
  return lines
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((wallet) => walletPattern.test(wallet))
    .map((wallet) => wallet.toLowerCase());
}

async function suiGraphql<T>(
  graphqlUrl: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Sui GraphQL request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).filter(Boolean).join("; ") || "Sui GraphQL error");
  }
  if (!payload.data) throw new Error("Sui GraphQL returned an empty response.");
  return payload.data;
}

function moveObjectJson(object: MoveObjectJson | null | undefined): Record<string, any> | null {
  return object?.asMoveObject?.contents?.json ?? null;
}

function moveObjectType(object: MoveObjectJson | null | undefined): string | null {
  return object?.asMoveObject?.contents?.type?.repr ?? null;
}

function normalizeMoveTypeName(typeName: string): string {
  return typeName
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/0x/g, "")
    .replace(/0{63}2/g, "2");
}

function typeNameToCanonical(typeName: any): string | null {
  if (typeof typeName === "string") return `0x${typeName.replace(/^0x/, "")}`;
  const name = typeName?.fields?.name;
  return typeof name === "string" ? `0x${name}` : null;
}

function readI32Bits(value: any): number | null {
  const bits = value?.fields?.bits ?? value?.bits ?? value;
  if (bits === null || bits === undefined) return null;
  const parsed = BigInt(bits);
  const unsigned = parsed & BigInt(0xffffffff);
  const signed = unsigned >= BigInt(0x80000000) ? unsigned - BigInt(0x100000000) : unsigned;
  const asNumber = Number(signed);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

async function readObjectJson(graphqlUrl: string, objectId: string): Promise<{ type: string; fields: Record<string, any> } | null> {
  const data = await suiGraphql<{ object: MoveObjectJson | null }>(
    graphqlUrl,
    `query($id:SuiAddress!) {
      object(address: $id) {
        address
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
  const type = moveObjectType(data.object);
  const fields = moveObjectJson(data.object);
  return type && fields ? { type, fields } : null;
}

async function readOwnedObjectsByType(
  graphqlUrl: string,
  wallet: string,
  type: string,
): Promise<Array<{ objectId: string; type: string; fields: Record<string, any> }>> {
  const objects: Array<{ objectId: string; type: string; fields: Record<string, any> }> = [];
  let cursor: string | null = null;
  do {
    const data = await suiGraphql<{
      objects: {
        pageInfo: { hasNextPage: boolean; endCursor?: string | null };
        nodes: MoveObjectJson[];
      };
    }>(
      graphqlUrl,
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
      { owner: wallet, type, after: cursor },
    );
    for (const node of data.objects.nodes) {
      const objectId = node.address;
      const objectType = moveObjectType(node);
      const fields = moveObjectJson(node);
      if (objectId && objectType && fields) objects.push({ objectId, type: objectType, fields });
    }
    cursor = data.objects.pageInfo.hasNextPage ? (data.objects.pageInfo.endCursor ?? null) : null;
  } while (cursor);
  return objects;
}

async function readV2PoolSnapshot(graphqlUrl: string): Promise<{ poolTreeReserveRaw: bigint; totalLpSupplyRaw: bigint }> {
  const pool = await readObjectJson(graphqlUrl, CANONICAL_TREE_SUIDEX_V2_POOL_ID);
  if (!pool || !pool.type.includes("::pair::Pair<") || !pool.type.includes(TREE_COIN_TYPE)) {
    throw new Error("canonical_v2_pool_shape_mismatch");
  }
  return {
    poolTreeReserveRaw: BigInt(pool.fields.reserve1 ?? pool.fields.balance1 ?? 0),
    totalLpSupplyRaw: BigInt(pool.fields.total_supply ?? pool.fields.lp_supply?.fields?.value ?? 0),
  };
}

async function readV3PoolSnapshot(graphqlUrl: string): Promise<{ sqrtPriceCurrent: bigint; treeTokenIndex: 0 | 1 }> {
  const pool = await readObjectJson(graphqlUrl, CANONICAL_TREE_SUIDEX_V3_POOL_ID);
  if (!pool || !pool.type.includes("::pool::Pool<") || !pool.type.includes(TREE_COIN_TYPE)) {
    throw new Error("canonical_v3_pool_shape_mismatch");
  }
  const treeIsTokenY = typeNameToCanonical(pool.fields.type_y) === TREE_COIN_TYPE;
  if (!treeIsTokenY) throw new Error("canonical_v3_tree_token_side_mismatch");
  return {
    sqrtPriceCurrent: BigInt(pool.fields.sqrt_price ?? 0),
    treeTokenIndex: 1,
  };
}

async function readMoonbagsStakeSnapshot(graphqlUrl: string): Promise<Map<string, bigint>> {
  const accounts = new Map<string, bigint>();
  let cursor: string | null = null;

  do {
    const data = await suiGraphql<{
      object: {
        dynamicFields: {
          pageInfo: { hasNextPage: boolean; endCursor?: string | null };
          nodes: Array<{
            name?: { type?: { repr?: string }; json?: string };
            value?: {
              address?: string;
              contents?: {
                type?: { repr?: string };
                json?: Record<string, any>;
              };
            };
          }>;
        };
      } | null;
    }>(
      graphqlUrl,
      `query($id:SuiAddress!, $after:String) {
        object(address: $id) {
          dynamicFields(first: 50, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              name { type { repr } json }
              value {
                ... on MoveObject {
                  address
                  contents {
                    type { repr }
                    json
                  }
                }
              }
            }
          }
        }
      }`,
      { id: MOONBAGS_TREE_STAKING_POOL_ID, after: cursor },
    );

    const page = data.object?.dynamicFields;
    if (!page) throw new Error("moonbags_tree_staking_pool_dynamic_fields_unavailable");

    for (const node of page.nodes) {
      const fields = node.value?.contents?.json;
      const type = node.value?.contents?.type?.repr;
      const wallet = String(node.name?.json ?? fields?.staker ?? "").toLowerCase();
      if (node.name?.type?.repr !== "address") continue;
      if (type !== MOONBAGS_TREE_STAKING_ACCOUNT_TYPE) continue;
      if (!/^0x[0-9a-f]{64}$/.test(wallet)) continue;
      if (String(fields?.staker ?? "").toLowerCase() !== wallet) continue;
      const balance = BigInt(fields?.balance ?? 0);
      accounts.set(wallet, balance > BigInt(0) ? balance : BigInt(0));
    }

    cursor = page.pageInfo.hasNextPage ? (page.pageInfo.endCursor ?? null) : null;
  } while (cursor);

  return accounts;
}

async function readWalletEligibility(
  graphqlUrl: string,
  wallet: string,
  snapshots: {
    v2Pool: Awaited<ReturnType<typeof readV2PoolSnapshot>>;
    v3Pool: Awaited<ReturnType<typeof readV3PoolSnapshot>>;
    moonbagsAccounts: Map<string, bigint>;
  },
): Promise<WalletEligibilitySnapshot> {
  const canonicalLpType = normalizeMoveTypeName(CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE);
  const canonicalPositionType = normalizeMoveTypeName(CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE);
  const [directLpCoins, farmPositions, v3Positions] = await Promise.all([
    readOwnedObjectsByType(graphqlUrl, wallet, DIRECT_V2_COIN_TYPE),
    readOwnedObjectsByType(graphqlUrl, wallet, CANONICAL_TREE_SUIDEX_V2_FARM_POSITION_TYPE),
    readOwnedObjectsByType(graphqlUrl, wallet, CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE),
  ]);

  const directLpRaw = directLpCoins.reduce((total, coin) => total + BigInt(coin.fields.balance ?? 0), BigInt(0));
  let farmedLpRaw = BigInt(0);
  for (const position of farmPositions) {
    if (normalizeMoveTypeName(position.type) !== canonicalPositionType) continue;
    if (String(position.fields.owner ?? "").toLowerCase() !== wallet) continue;
    if (normalizeMoveTypeName(String(position.fields.pool_type ?? "")) !== canonicalLpType) continue;
    const amount = BigInt(position.fields.amount ?? 0);
    if (amount <= BigInt(0)) continue;
    const vaultId = String(position.fields.vault_id ?? "");
    const vault = vaultId ? await readObjectJson(graphqlUrl, vaultId) : null;
    if (!vault || !normalizeMoveTypeName(vault.type).includes("::farm::stakedtokenvault<")) continue;
    if (String(vault.fields.owner ?? "").toLowerCase() !== wallet) continue;
    if (normalizeMoveTypeName(String(vault.fields.pool_type ?? "")) !== canonicalLpType) continue;
    const vaultAmount = BigInt(vault.fields.amount ?? vault.fields.balance ?? 0);
    const vaultBalance = BigInt(vault.fields.balance ?? vault.fields.amount ?? 0);
    if (vaultAmount !== amount || vaultBalance !== amount) continue;
    farmedLpRaw += amount;
  }

  const directV2TreeRaw = calculateV2UnderlyingTreeRaw({
    playerLpRaw: directLpRaw,
    poolTreeReserveRaw: snapshots.v2Pool.poolTreeReserveRaw,
    totalLpSupplyRaw: snapshots.v2Pool.totalLpSupplyRaw,
  });
  const farmedV2TreeRaw = calculateV2UnderlyingTreeRaw({
    playerLpRaw: farmedLpRaw,
    poolTreeReserveRaw: snapshots.v2Pool.poolTreeReserveRaw,
    totalLpSupplyRaw: snapshots.v2Pool.totalLpSupplyRaw,
  });

  const v3TreeRaw = calculateV3UnderlyingTreeForPositions({
    pool: {
      poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      sqrtPriceCurrent: snapshots.v3Pool.sqrtPriceCurrent,
      treeTokenIndex: snapshots.v3Pool.treeTokenIndex,
    },
    positions: v3Positions.flatMap((position) => {
      if (position.type !== CANONICAL_TREE_SUIDEX_V3_POSITION_TYPE) return [];
      if (String(position.fields.pool_id ?? "").toLowerCase() !== CANONICAL_TREE_SUIDEX_V3_POOL_ID) return [];
      if (typeNameToCanonical(position.fields.type_y) !== TREE_COIN_TYPE) return [];
      const tickLower = readI32Bits(position.fields.tick_lower_index);
      const tickUpper = readI32Bits(position.fields.tick_upper_index);
      if (tickLower === null || tickUpper === null) return [];
      return [{
        objectId: position.objectId,
        poolId: position.fields.pool_id,
        liquidity: BigInt(position.fields.liquidity ?? 0),
        tickLower,
        tickUpper,
        closed: Boolean(position.fields.closed),
      }];
    }),
  }).underlyingTreeRaw;

  const moonbagsTreeRaw = snapshots.moonbagsAccounts.get(wallet) ?? BigInt(0);
  const totalVerifiedTreeRaw = directV2TreeRaw + farmedV2TreeRaw + v3TreeRaw + moonbagsTreeRaw;
  const thresholdRaw = displayTreeToRaw(TREE_THRESHOLD_LABEL);
  const unavailableSources: string[] = [];
  const status: FifthMoveEligibilityStatus = totalVerifiedTreeRaw >= thresholdRaw
    ? "qualified"
    : "not-qualified";

  return {
    wallet,
    status,
    directV2TreeRaw,
    farmedV2TreeRaw,
    v3TreeRaw,
    moonbagsTreeRaw,
    totalVerifiedTreeRaw,
    unavailableSources,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const wallets = await readWallets(options.walletFile);
  const thresholds = ["500000", "1000000", "2500000", "5000000"].map((value) => ({
    label: value,
    raw: displayTreeToRaw(value),
  }));
  const snapshots = {
    v2Pool: await readV2PoolSnapshot(options.graphqlUrl),
    v3Pool: await readV3PoolSnapshot(options.graphqlUrl),
    moonbagsAccounts: await readMoonbagsStakeSnapshot(options.graphqlUrl),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    source: "Sui GraphQL read-only census",
    graphqlEndpoint: options.graphqlUrl === DEFAULT_SUI_GRAPHQL_URL ? "default-mainnet-sui-graphql" : "custom",
    totalNftreeWalletsChecked: wallets.length,
    qualifiedAt1000000Tree: 0,
    notQualifiedAllSourcesVerified: 0,
    verificationIncomplete: 0,
    unavailable: 0,
    qualificationBySource: {
      "suidex-v2-direct": 0,
      "suidex-v2-farm": 0,
      "suidex-v3": 0,
      "moonbags-staking": 0,
    },
    qualificationThroughCombinedSuiDexSources: 0,
    qualificationThroughCombinedSources: 0,
    medianVerifiedUnderlyingTreeRaw: "0",
    medianVerifiedUnderlyingTree: "0",
    distribution: Object.fromEntries(thresholds.map((threshold) => [threshold.label, 0])),
    moonbagsStatus: "enabled",
  };
  const totals: bigint[] = [];

  for (const wallet of wallets) {
    const eligibility = await readWalletEligibility(options.graphqlUrl, wallet, snapshots);
    const total = eligibility.totalVerifiedTreeRaw;
    totals.push(total);

    if (eligibility.status === "qualified") report.qualifiedAt1000000Tree += 1;
    if (eligibility.status === "not-qualified") report.notQualifiedAllSourcesVerified += 1;
    if (eligibility.status === "verification-incomplete") report.verificationIncomplete += 1;
    if (eligibility.status === "unavailable") report.unavailable += 1;

    if (eligibility.status === "qualified") {
      const positiveSources = [
        eligibility.directV2TreeRaw > BigInt(0) ? "suidex-v2-direct" : null,
        eligibility.farmedV2TreeRaw > BigInt(0) ? "suidex-v2-farm" : null,
        eligibility.v3TreeRaw > BigInt(0) ? "suidex-v3" : null,
        eligibility.moonbagsTreeRaw > BigInt(0) ? "moonbags-staking" : null,
      ].filter(Boolean) as Array<keyof typeof report.qualificationBySource>;
      for (const source of positiveSources) report.qualificationBySource[source] += 1;
      const positiveSuiDexSources = positiveSources.filter((source) => source !== "moonbags-staking");
      if (positiveSuiDexSources.length > 1) report.qualificationThroughCombinedSuiDexSources += 1;
      if (positiveSources.length > 1) report.qualificationThroughCombinedSources += 1;
    }

    for (const threshold of thresholds) {
      if (total >= threshold.raw) report.distribution[threshold.label] += 1;
    }
  }

  const medianRaw = percentile(totals, 0.5);
  report.medianVerifiedUnderlyingTreeRaw = medianRaw.toString();
  report.medianVerifiedUnderlyingTree = rawTreeToDisplay(medianRaw);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
