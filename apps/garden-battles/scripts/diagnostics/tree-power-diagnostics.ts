import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import {
  calculateV2UnderlyingTreeRaw,
  rawTreeToDisplay,
  TREE_COIN_TYPE,
} from "../../shared/tree-power-eligibility";

export const CANONICAL_TREE_SUIDEX_V2_POOL_ID =
  "0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc";
export const CANONICAL_TREE_SUIDEX_V3_POOL_ID =
  "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf";
export const CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE =
  `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, ${TREE_COIN_TYPE}>`;

const SUIDEX_V2_PACKAGE_ID = "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a";
const SUIDEX_V3_PACKAGE_ID = "0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56";
const DEFAULT_RECENT_TRANSACTION_LIMIT = 50;
const MAX_RECENT_TRANSACTION_LIMIT = 200;

export type DiagnosticLabel = "suidex-v2-farm" | "suidex-v3-position" | "moonbags-tree-stake";

export type CliOptions = {
  help: boolean;
  wallet?: string;
  digest?: string;
  objectId?: string;
  objectIds: string[];
  rpcUrl: string;
  recentTransactions: number;
  output?: string;
};

export type DiagnosticClient = {
  getObject(input: any): Promise<any>;
  getOwnedObjects(input: any): Promise<any>;
  getCoins(input: any): Promise<any>;
  getDynamicFields?(input: any): Promise<any>;
  getDynamicFieldObject?(input: any): Promise<any>;
  getTransactionBlock(input: any): Promise<any>;
  queryTransactionBlocks(input: any): Promise<any>;
};

type OwnedObjectSummary = {
  objectId?: string;
  type?: string;
  owner?: unknown;
  previousTransaction?: string;
  fields?: Record<string, unknown>;
  classification: string;
  relevantFields?: Record<string, unknown>;
};

type CoinSummary = {
  coinObjectId: string;
  balance: string;
  digest?: string;
  version?: string;
};

function normalizeSuiAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`Invalid --wallet value: expected a complete Sui address, received "${value}".`);
  }
  return normalized;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

export function helpText(): string {
  return `Tree Power read-only diagnostics

Usage:
  npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v2-farm.ts [options]
  npm.cmd exec -- tsx scripts/diagnostics/inspect-suidex-v3-position.ts [options]
  npm.cmd exec -- tsx scripts/diagnostics/inspect-moonbags-tree-stake.ts [options]

Options:
  --wallet <address>                 Scan a wallet's owned objects, LP coins, and recent transactions.
  --digest <transaction-digest>       Inspect a public transaction digest.
  --object-id <object-id>             Inspect one public object.
  --object-ids <id1,id2,...>          Inspect comma-separated public objects.
  --receipt-object-id <object-id>     Alias for --object-id for V2 farm receipts.
  --stake-object-id <object-id>       Alias for --object-id for Moonbags stake objects.
  --rpc-url <url>                     Use a custom Sui RPC endpoint. The URL is never printed.
  --recent-transactions <number>      Bounded sender transaction scan. Default ${DEFAULT_RECENT_TRANSACTION_LIMIT}, max ${MAX_RECENT_TRANSACTION_LIMIT}.
  --output <file>                     Write sanitized JSON to a file.
  --help, -h                          Show this help and exit without RPC.

All commands are read-only and never execute transactions.`;
}

export function parseCliArgs(argv: string[], env = process.env): CliOptions {
  const options: CliOptions = {
    help: false,
    objectIds: [],
    rpcUrl: env.SUI_RPC_URL || getFullnodeUrl("mainnet"),
    recentTransactions: DEFAULT_RECENT_TRANSACTION_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--wallet") {
      options.wallet = normalizeSuiAddress(requireValue(arg, next));
      index += 1;
    } else if (arg === "--digest") {
      options.digest = requireValue(arg, next);
      index += 1;
    } else if (arg === "--object-id" || arg === "--receipt-object-id" || arg === "--stake-object-id") {
      const objectId = requireValue(arg, next);
      options.objectId = objectId;
      options.objectIds.push(objectId);
      index += 1;
    } else if (arg === "--object-ids") {
      options.objectIds.push(...requireValue(arg, next).split(",").map((value) => value.trim()).filter(Boolean));
      index += 1;
    } else if (arg === "--rpc-url") {
      options.rpcUrl = requireValue(arg, next);
      index += 1;
    } else if (arg === "--recent-transactions") {
      const parsed = Number.parseInt(requireValue(arg, next), 10);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("--recent-transactions must be a non-negative integer.");
      options.recentTransactions = Math.min(parsed, MAX_RECENT_TRANSACTION_LIMIT);
      index += 1;
    } else if (arg === "--output") {
      options.output = requireValue(arg, next);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function objectFields(object: any): Record<string, unknown> | undefined {
  const content = object?.data?.content;
  return content && typeof content === "object" && "fields" in content ? content.fields : undefined;
}

function selectedFields(fields: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!fields) return undefined;
  const result: Record<string, unknown> = {};
  for (const key of [
    "id",
    "balance",
    "value",
    "pool",
    "pool_id",
    "poolId",
    "farm",
    "farm_id",
    "liquidity",
    "lower_tick",
    "upper_tick",
    "tick_lower",
    "tick_upper",
    "tick_lower_index",
    "tick_upper_index",
    "tick_lower_id",
    "tick_upper_id",
    "lower_tick_index",
    "upper_tick_index",
    "tick_index",
    "sqrt_price",
    "tick_spacing",
    "reserve1",
    "balance1",
    "total_supply",
    "lp_supply",
    "type_x",
    "type_y",
    "reward",
    "rewards",
    "fee",
    "fees",
    "closed",
    "active",
    "withdrawn",
  ]) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) result[key] = fields[key];
  }
  return Object.keys(result).length ? result : undefined;
}

function includesTreeAndSui(type = ""): boolean {
  return type.includes(TREE_COIN_TYPE) && type.includes("0x2::sui::SUI");
}

export function classifyOwnedObject(type = "", fields?: Record<string, unknown>): string {
  const lowerType = type.toLowerCase();
  const serializedFields = JSON.stringify(fields ?? {}).toLowerCase();

  if (type === CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE || type.includes(`Coin<${CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE}>`)) {
    return "canonical-v2-lp-coin";
  }
  if (lowerType.includes(SUIDEX_V2_PACKAGE_ID) && (lowerType.includes("::farm::") || lowerType.includes("receipt") || serializedFields.includes("farm"))) {
    return "potential-v2-farm-receipt";
  }
  if (lowerType.includes(SUIDEX_V2_PACKAGE_ID) && (lowerType.includes("account") || serializedFields.includes("lp"))) {
    return "potential-v2-farm-account";
  }
  if (lowerType.includes("::lpcoin<") && lowerType.includes(SUIDEX_V2_PACKAGE_ID)) return "unrelated-suidex-object";
  if (lowerType.includes(SUIDEX_V3_PACKAGE_ID) && (lowerType.includes("position") || serializedFields.includes("liquidity"))) {
    return "potential-v3-position";
  }
  if (lowerType.includes(SUIDEX_V2_PACKAGE_ID) || lowerType.includes(SUIDEX_V3_PACKAGE_ID) || lowerType.includes("suidex")) {
    return "unrelated-suidex-object";
  }
  return "unrelated-object";
}

function summarizeObject(object: any): OwnedObjectSummary {
  const fields = objectFields(object);
  const type = object?.data?.type;
  return {
    objectId: object?.data?.objectId,
    type,
    owner: object?.data?.owner,
    previousTransaction: object?.data?.previousTransaction,
    fields: selectedFields(fields),
    classification: classifyOwnedObject(type, fields),
    relevantFields: selectedFields(fields),
  };
}

function shouldScanDynamicFields(object: OwnedObjectSummary): boolean {
  return (
    object.classification === "potential-v2-farm-receipt" ||
    object.classification === "potential-v2-farm-account" ||
    object.classification === "potential-v3-position"
  );
}

export async function getDynamicFieldSummaries(client: DiagnosticClient, objectIds: string[]) {
  if (!client.getDynamicFields) {
    return {
      supported: false,
      objects: [],
    };
  }

  const objects = [];
  for (const objectId of objectIds) {
    let cursor: string | null = null;
    let pagesScanned = 0;
    const fields = [];
    do {
      const page = await client.getDynamicFields({
        parentId: objectId,
        cursor,
        limit: 50,
      });
      pagesScanned += 1;
      for (const field of page.data ?? []) {
        let value: OwnedObjectSummary | undefined;
        if (client.getDynamicFieldObject) {
          try {
            value = summarizeObject(
              await client.getDynamicFieldObject({
                parentId: objectId,
                name: field.name,
              }),
            );
          } catch (error) {
            value = {
              classification: "dynamic-field-read-error",
              fields: {
                message: error instanceof Error ? error.message : String(error),
              },
            };
          }
        }
        fields.push({
          name: field.name,
          objectId: field.objectId,
          objectType: field.objectType,
          value,
        });
      }
      cursor = page.hasNextPage ? page.nextCursor ?? null : null;
    } while (cursor);
    objects.push({
      objectId,
      pagesScanned,
      fields,
    });
  }

  return {
    supported: true,
    objects,
  };
}

export async function getAllOwnedObjects(client: DiagnosticClient, owner: string): Promise<{ pagesScanned: number; objects: OwnedObjectSummary[] }> {
  let cursor: string | null = null;
  let pagesScanned = 0;
  const objects: OwnedObjectSummary[] = [];
  do {
    const page = await client.getOwnedObjects({
      owner,
      cursor,
      limit: 50,
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
        showPreviousTransaction: true,
      },
    });
    pagesScanned += 1;
    for (const item of page.data ?? []) objects.push(summarizeObject(item));
    cursor = page.hasNextPage ? page.nextCursor ?? null : null;
  } while (cursor);
  return { pagesScanned, objects };
}

export async function getAllCoins(client: DiagnosticClient, owner: string, coinType: string): Promise<{ pagesScanned: number; coins: CoinSummary[]; totalBalanceRaw: bigint }> {
  let cursor: string | null = null;
  let pagesScanned = 0;
  const coins: CoinSummary[] = [];
  let totalBalanceRaw = BigInt(0);
  do {
    const page = await client.getCoins({ owner, coinType, cursor, limit: 50 });
    pagesScanned += 1;
    for (const coin of page.data ?? []) {
      const balance = BigInt(coin.balance ?? 0);
      coins.push({
        coinObjectId: coin.coinObjectId,
        balance: balance.toString(),
        digest: coin.digest,
        version: coin.version,
      });
      totalBalanceRaw += balance;
    }
    cursor = page.hasNextPage ? page.nextCursor ?? null : null;
  } while (cursor);
  return { pagesScanned, coins, totalBalanceRaw };
}

function getPoolReserveFields(poolObject: any): { poolTreeReserveRaw: bigint; totalLpSupplyRaw: bigint } {
  const fields = objectFields(poolObject);
  return {
    poolTreeReserveRaw: BigInt((fields?.reserve1 ?? fields?.balance1 ?? 0) as any),
    totalLpSupplyRaw: BigInt((fields?.total_supply ?? (fields?.lp_supply as any)?.fields?.value ?? 0) as any),
  };
}

export async function readV2DirectLp(client: DiagnosticClient, wallet: string) {
  const [poolObject, lpCoins] = await Promise.all([
    client.getObject({
      id: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
      options: { showType: true, showContent: true, showOwner: true, showPreviousTransaction: true },
    }),
    getAllCoins(client, wallet, CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE),
  ]);
  const { poolTreeReserveRaw, totalLpSupplyRaw } = getPoolReserveFields(poolObject);
  const directUnderlyingTreeRaw = calculateV2UnderlyingTreeRaw({
    playerLpRaw: lpCoins.totalBalanceRaw,
    poolTreeReserveRaw,
    totalLpSupplyRaw,
  });
  return {
    pool: summarizeObject(poolObject),
    lpCoinType: CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
    pagesScanned: lpCoins.pagesScanned,
    matchingLpCoinObjects: lpCoins.coins,
    totalRawDirectLpBalance: lpCoins.totalBalanceRaw.toString(),
    poolTreeReserveRaw: poolTreeReserveRaw.toString(),
    totalLpSupplyRaw: totalLpSupplyRaw.toString(),
    directUnderlyingTreeRaw: directUnderlyingTreeRaw.toString(),
    directUnderlyingTreeDisplay: rawTreeToDisplay(directUnderlyingTreeRaw),
  };
}

function extractV3PoolSnapshot(poolObject: any) {
  const fields = objectFields(poolObject);
  return {
    object: summarizeObject(poolObject),
    packageId: SUIDEX_V3_PACKAGE_ID,
    tokenXType: (fields?.type_x as any)?.fields?.name ? `0x${(fields?.type_x as any).fields.name}` : undefined,
    tokenYType: (fields?.type_y as any)?.fields?.name ? `0x${(fields?.type_y as any).fields.name}` : undefined,
    treeIsTokenY: (fields?.type_y as any)?.fields?.name === TREE_COIN_TYPE.replace(/^0x/, ""),
    currentTick: (fields?.tick_index as any)?.fields?.bits ?? fields?.tick_index,
    currentSqrtPrice: fields?.sqrt_price,
    tickSpacing: fields?.tick_spacing,
  };
}

export async function readV3Pool(client: DiagnosticClient) {
  const poolObject = await client.getObject({
    id: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
    options: { showType: true, showContent: true, showOwner: true, showPreviousTransaction: true },
  });
  return extractV3PoolSnapshot(poolObject);
}

function summarizeTransaction(transaction: any) {
  const moveCalls = (transaction.transaction?.data?.transaction?.transactions ?? [])
    .map((item: any) => item.MoveCall ?? item.moveCall)
    .filter(Boolean);
  const packageIds = new Set<string>(moveCalls.map((call: any) => call.package));
  const touchesSuiDex =
    [...packageIds].some((packageId) => packageId === SUIDEX_V2_PACKAGE_ID || packageId === SUIDEX_V3_PACKAGE_ID) ||
    JSON.stringify(transaction).includes(SUIDEX_V2_PACKAGE_ID) ||
    JSON.stringify(transaction).includes(SUIDEX_V3_PACKAGE_ID) ||
    JSON.stringify(transaction).toLowerCase().includes("suidex");

  return {
    digest: transaction.digest,
    timestampMs: transaction.timestampMs,
    status: transaction.effects?.status,
    moveCalls: moveCalls.map((call: any) => ({
      package: call.package,
      module: call.module,
      function: call.function,
      typeArguments: call.typeArguments,
    })),
    objectChanges: transaction.objectChanges?.map((change: any) => ({
      type: change.type,
      objectType: change.objectType,
      objectId: change.objectId,
      owner: change.owner,
    })),
    events: transaction.events?.map((event: any) => ({
      type: event.type,
      sender: event.sender,
      parsedJson: event.parsedJson,
    })),
    touchesSuiDex,
  };
}

export async function getRecentTransactions(client: DiagnosticClient, sender: string, limit: number) {
  if (limit <= 0) return [];
  const page = await client.queryTransactionBlocks({
    filter: { FromAddress: sender },
    limit,
    order: "descending",
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  });
  return (page.data ?? []).map(summarizeTransaction).filter((transaction: any) => transaction.touchesSuiDex);
}

export function sanitizedOutputPath(label: string, wallet?: string, timestamp = new Date()): string {
  const stamp = timestamp.toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const shortWallet = wallet ? `${wallet.slice(2, 8)}-${wallet.slice(-6)}` : "manual";
  return path.join("diagnostics-output", `${label}-${shortWallet}-${stamp}.json`);
}

function sanitizedRpcLabel(rpcUrl: string): string {
  return rpcUrl === getFullnodeUrl("mainnet") ? "default-mainnet" : "custom";
}

export async function buildTreePowerDiagnosticReport(label: DiagnosticLabel, options: CliOptions, client: DiagnosticClient) {
  const report: Record<string, unknown> = {
    diagnostic: label,
    wallet: options.wallet,
    rpc: sanitizedRpcLabel(options.rpcUrl),
    objectIds: options.objectIds,
    generatedAt: new Date().toISOString(),
    constants: {
      treeCoinType: TREE_COIN_TYPE,
      v2PoolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
      v2LpCoinType: CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
      v3PoolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      v3TreeTokenSide: "token_y",
    },
  };

  if (options.wallet) {
    const [ownedObjects, directV2, v3Pool, recentTransactions] = await Promise.all([
      getAllOwnedObjects(client, options.wallet),
      readV2DirectLp(client, options.wallet),
      readV3Pool(client),
      getRecentTransactions(client, options.wallet, options.recentTransactions),
    ]);
    const candidates = ownedObjects.objects.filter((object) => object.classification !== "unrelated-object");
    const dynamicFieldScan = await getDynamicFieldSummaries(
      client,
      candidates.filter(shouldScanDynamicFields).map((object) => object.objectId).filter(Boolean) as string[],
    );
    report.ownedObjectScan = {
      pagesScanned: ownedObjects.pagesScanned,
      totalObjectsScanned: ownedObjects.objects.length,
      candidates,
      classificationCounts: ownedObjects.objects.reduce<Record<string, number>>((counts, object) => {
        counts[object.classification] = (counts[object.classification] ?? 0) + 1;
        return counts;
      }, {}),
      dynamicFieldScan,
    };
    report.v2DirectLp = directV2;
    report.v3Pool = v3Pool;
    report.recentTransactions = {
      requestedLimit: options.recentTransactions,
      matchingSuiDexTransactions: recentTransactions,
    };
  }

  if (options.digest) {
    report.transaction = summarizeTransaction(
      await client.getTransactionBlock({
        digest: options.digest,
        options: {
          showInput: true,
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
      }),
    );
  }

  if (options.objectIds.length > 0) {
    const objects = await Promise.all(
      options.objectIds.map((id) =>
        client.getObject({
          id,
          options: {
            showContent: true,
            showOwner: true,
            showType: true,
            showPreviousTransaction: true,
          },
        }),
      ),
    );
    report.objects = objects.map(summarizeObject);
  }

  if (label === "suidex-v2-farm") {
    report.v2FarmDiscoveryStatus = "read-only discovery only; runtime farm counting remains disabled until receipt/account relationship is proven";
  } else if (label === "suidex-v3-position") {
    report.v3PositionDiscoveryStatus = "read-only discovery only; runtime V3 counting remains disabled until owned position fields are verified";
  } else {
    report.moonbagsDiscoveryStatus = "read-only discovery only; runtime Moonbags counting remains disabled until stake object shape is verified";
  }

  return report;
}

export async function runTreePowerDiagnostic(label: DiagnosticLabel, argv = process.argv.slice(2)): Promise<void> {
  const options = parseCliArgs(argv);
  if (options.help) {
    console.log(helpText());
    return;
  }

  const client = new SuiClient({ url: options.rpcUrl });
  const report = await buildTreePowerDiagnosticReport(label, options, client);
  const outputPath = options.output ?? (options.wallet ? sanitizedOutputPath(label, options.wallet) : undefined);
  if (outputPath) {
    const resolved = path.resolve(process.cwd(), outputPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, JSON.stringify(report, null, 2));
    (report as any).outputPath = resolved;
  }

  console.log(JSON.stringify(report, null, 2));
}
