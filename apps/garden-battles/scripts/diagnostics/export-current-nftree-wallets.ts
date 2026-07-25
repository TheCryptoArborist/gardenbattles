import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";
const NFTREE_TYPE =
  "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";
const TREEDROP_ADMIN_ADDRESS =
  "0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 100;
const MAX_OWNER_RESOLUTION_DEPTH = 3;

type ParsedOwner =
  | { kind: "direct"; ownerAddress: string }
  | { kind: "object"; ownerObjectId: string; ownerText: string; unresolvedReason: string }
  | { kind: "unresolved"; ownerText?: string; unresolvedReason: string };

type NftreeRecord = {
  nftreeObjectId: string;
  version?: string;
  digest?: string;
  ownerAddress?: string;
  ownerSource: "direct" | "resolved";
  resolutionPath?: string[];
};

type UnresolvedRecord = {
  nftreeObjectId: string;
  version?: string;
  digest?: string;
  owner?: string;
  reason: string;
  resolutionPath?: string[];
};

type HolderRecord = {
  ownerAddress: string;
  nftreeCount: number;
  nftreeObjectIds: string[];
};

function isSuiAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value.trim());
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseArgs(argv: string[]) {
  const options = {
    graphqlUrl: process.env.SUI_GRAPHQL_URL || DEFAULT_SUI_GRAPHQL_URL,
    outputDir: "diagnostics-output",
    excludedWallets: [TREEDROP_ADMIN_ADDRESS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--graphql-url") {
      options.graphqlUrl = next;
      index += 1;
    } else if (arg === "--output-dir") {
      options.outputDir = next;
      index += 1;
    } else if (arg === "--excluded-wallets") {
      options.excludedWallets = next.split(",").map((wallet) => wallet.trim()).filter(Boolean);
      index += 1;
    }
  }

  return options;
}

function parseOwner(owner: any): ParsedOwner {
  if (!owner || typeof owner !== "object") {
    return { kind: "unresolved", unresolvedReason: "Owner is not available from the indexer response." };
  }

  const ownerType = stringValue(owner.__typename) || "UnknownOwner";
  const ownerAddress = stringValue(owner.address?.address);

  if (ownerType === "AddressOwner") {
    if (isSuiAddress(ownerAddress)) return { kind: "direct", ownerAddress: ownerAddress.toLowerCase() };
    return {
      kind: "unresolved",
      ownerText: ownerType,
      unresolvedReason: "Address-owned NFTree did not include a valid owner address.",
    };
  }

  if (ownerType === "ObjectOwner") {
    if (isSuiAddress(ownerAddress)) {
      return {
        kind: "object",
        ownerObjectId: ownerAddress.toLowerCase(),
        ownerText: ownerAddress.toLowerCase(),
        unresolvedReason: "Owner is object-owned; final wallet resolution required.",
      };
    }
    return {
      kind: "unresolved",
      ownerText: ownerAddress || ownerType,
      unresolvedReason: "Owner is object-owned; final wallet resolution required.",
    };
  }

  return {
    kind: "unresolved",
    ownerText: ownerAddress || ownerType,
    unresolvedReason: `Owner type ${ownerType} is not supported by the automatic snapshot source.`,
  };
}

const OWNER_FRAGMENT = `
  owner {
    __typename
    ... on AddressOwner {
      address {
        address
      }
    }
    ... on ObjectOwner {
      address {
        address
      }
    }
    ... on Shared {
      initialSharedVersion
    }
    ... on Immutable {
      _
    }
    ... on ConsensusAddressOwner {
      startVersion
      address {
        address
      }
    }
  }
`;

async function graphQlRequest(graphqlUrl: string, query: string, variables: Record<string, unknown>) {
  const response = await fetch(graphqlUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Sui GraphQL request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error: any) => error.message).filter(Boolean).join("; ");
    throw new Error(message || "Sui GraphQL returned an error while querying NFTree objects.");
  }
  return payload;
}

async function fetchObjectOwner(graphqlUrl: string, objectId: string) {
  const query = `
    query NFTreeOwnerObject($address: SuiAddress!) {
      object(address: $address) {
        address
        ${OWNER_FRAGMENT}
      }
    }
  `;
  const payload = await graphQlRequest(graphqlUrl, query, { address: objectId });
  return payload?.data?.object?.owner;
}

async function resolveFinalWalletOwner(input: {
  graphqlUrl: string;
  ownerObjectId: string;
  depth?: number;
  resolutionPath?: string[];
  cache: Map<string, Promise<{ ownerAddress?: string; unresolvedReason?: string; resolutionPath: string[] }>>;
}): Promise<{ ownerAddress?: string; unresolvedReason?: string; resolutionPath: string[] }> {
  const normalizedOwnerObjectId = input.ownerObjectId.toLowerCase();
  const depth = input.depth ?? 0;
  const startingPath = input.resolutionPath?.length
    ? input.resolutionPath
    : [`NFTree object-owned by ${normalizedOwnerObjectId}`];

  if (depth >= MAX_OWNER_RESOLUTION_DEPTH) {
    return {
      unresolvedReason: "Owner chain did not resolve to direct wallet within max depth.",
      resolutionPath: startingPath,
    };
  }

  const cached = input.cache.get(normalizedOwnerObjectId);
  if (cached) return cached;

  const resolutionPromise = (async () => {
    const parsedOwner = parseOwner(await fetchObjectOwner(input.graphqlUrl, normalizedOwnerObjectId));
    if (parsedOwner.kind === "direct") {
      return {
        ownerAddress: parsedOwner.ownerAddress,
        resolutionPath: [...startingPath, `${normalizedOwnerObjectId} owned by ${parsedOwner.ownerAddress}`],
      };
    }
    if (parsedOwner.kind === "object") {
      return resolveFinalWalletOwner({
        graphqlUrl: input.graphqlUrl,
        ownerObjectId: parsedOwner.ownerObjectId,
        depth: depth + 1,
        resolutionPath: [...startingPath, `${normalizedOwnerObjectId} object-owned by ${parsedOwner.ownerObjectId}`],
        cache: input.cache,
      });
    }
    return {
      unresolvedReason: parsedOwner.unresolvedReason,
      resolutionPath: [...startingPath, `${normalizedOwnerObjectId}: ${parsedOwner.unresolvedReason}`],
    };
  })();

  input.cache.set(normalizedOwnerObjectId, resolutionPromise);
  return resolutionPromise;
}

function groupHolders(nftrees: NftreeRecord[], excludedWallets: string[]): HolderRecord[] {
  const excluded = new Set(excludedWallets.map((wallet) => wallet.toLowerCase()));
  const byOwner = new Map<string, HolderRecord>();
  for (const nftree of nftrees) {
    const ownerAddress = nftree.ownerAddress?.toLowerCase();
    if (!ownerAddress || excluded.has(ownerAddress)) continue;
    const holder = byOwner.get(ownerAddress) ?? { ownerAddress, nftreeCount: 0, nftreeObjectIds: [] };
    holder.nftreeCount += 1;
    holder.nftreeObjectIds.push(nftree.nftreeObjectId);
    byOwner.set(ownerAddress, holder);
  }
  return [...byOwner.values()].sort((a, b) =>
    b.nftreeCount === a.nftreeCount
      ? a.ownerAddress.localeCompare(b.ownerAddress)
      : b.nftreeCount - a.nftreeCount,
  );
}

async function fetchCurrentNftreeSnapshot(graphqlUrl: string, excludedWallets: string[]) {
  const nftrees: NftreeRecord[] = [];
  const unresolved: UnresolvedRecord[] = [];
  const ownerResolutionCache = new Map<string, Promise<{ ownerAddress?: string; unresolvedReason?: string; resolutionPath: string[] }>>();
  let cursor: string | null = null;
  let pages = 0;

  const query = `
    query NFTreeHolderSnapshot($type: String!, $first: Int!, $after: String) {
      objects(filter: { type: $type }, first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          address
          version
          digest
          ${OWNER_FRAGMENT}
        }
      }
    }
  `;

  do {
    pages += 1;
    if (pages > MAX_PAGES) throw new Error(`Snapshot query exceeded ${MAX_PAGES} pages.`);
    const payload = await graphQlRequest(graphqlUrl, query, {
      type: NFTREE_TYPE,
      first: DEFAULT_PAGE_SIZE,
      after: cursor,
    });
    const connection = payload?.data?.objects;
    const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];
    for (const node of nodes) {
      const nftreeObjectId = stringValue(node.address);
      if (!isSuiAddress(nftreeObjectId)) continue;
      const base = {
        nftreeObjectId: nftreeObjectId.toLowerCase(),
        version: node.version === undefined ? undefined : String(node.version),
        digest: stringValue(node.digest),
      };
      const parsedOwner = parseOwner(node.owner);
      if (parsedOwner.kind === "direct") {
        nftrees.push({
          ...base,
          ownerAddress: parsedOwner.ownerAddress,
          ownerSource: "direct",
          resolutionPath: [`NFTree directly owned by ${parsedOwner.ownerAddress}`],
        });
      } else if (parsedOwner.kind === "object") {
        const resolution = await resolveFinalWalletOwner({
          graphqlUrl,
          ownerObjectId: parsedOwner.ownerObjectId,
          cache: ownerResolutionCache,
        });
        if (resolution.ownerAddress && isSuiAddress(resolution.ownerAddress)) {
          nftrees.push({
            ...base,
            ownerAddress: resolution.ownerAddress.toLowerCase(),
            ownerSource: "resolved",
            resolutionPath: resolution.resolutionPath,
          });
        } else {
          unresolved.push({
            ...base,
            owner: parsedOwner.ownerText,
            reason: resolution.unresolvedReason || parsedOwner.unresolvedReason,
            resolutionPath: resolution.resolutionPath,
          });
        }
      } else {
        unresolved.push({
          ...base,
          owner: parsedOwner.ownerText,
          reason: parsedOwner.unresolvedReason,
        });
      }
    }
    cursor = connection?.pageInfo?.hasNextPage ? stringValue(connection.pageInfo.endCursor) ?? null : null;
  } while (cursor);

  const holders = groupHolders(nftrees, excludedWallets);
  const excludedSet = new Set(excludedWallets.map((wallet) => wallet.toLowerCase()));
  const excludedNftrees = nftrees.filter((nftree) => nftree.ownerAddress && excludedSet.has(nftree.ownerAddress));
  const eligibleNftrees = nftrees.filter((nftree) => nftree.ownerAddress && !excludedSet.has(nftree.ownerAddress));
  const snapshotTime = new Date().toISOString();

  return {
    snapshotTime,
    canonicalNftreeType: NFTREE_TYPE,
    source: "Sui GraphQL object type query",
    method: "TreeDrop nftree-holder-snapshot logic: objects(filter:type), owner-chain resolution depth 3, excluded project wallet filter",
    graphqlEndpoint: graphqlUrl === DEFAULT_SUI_GRAPHQL_URL ? "default-mainnet-sui-graphql" : "custom",
    holderOwnedNftreeCount: eligibleNftrees.length,
    uniqueOwnerWalletCount: holders.length,
    totalResolvedNftrees: nftrees.length,
    directNftrees: nftrees.filter((nftree) => nftree.ownerSource === "direct").length,
    kioskOrObjectResolvedNftrees: nftrees.filter((nftree) => nftree.ownerSource === "resolved").length,
    excludedProjectWalletNftrees: excludedNftrees.length,
    unresolvedKioskOrObjectOwnership: unresolved.length,
    excludedWallets: excludedWallets.map((wallet) => wallet.toLowerCase()),
    holders,
    unresolved,
    historicalComparison: {
      june22HolderOwnedNftrees: 87,
      june22UniqueOwnerWallets: 28,
      june22SalePoolNftrees: 213,
      june22TotalLoadedAccounting: 300,
    },
  };
}

function toWalletCsv(snapshot: Awaited<ReturnType<typeof fetchCurrentNftreeSnapshot>>) {
  return [
    "ownerAddress,nftreeCount,nftreeObjectIds",
    ...snapshot.holders.map((holder) =>
      [holder.ownerAddress, String(holder.nftreeCount), holder.nftreeObjectIds.join(" ")].join(","),
    ),
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const snapshot = await fetchCurrentNftreeSnapshot(options.graphqlUrl, options.excludedWallets);
  const outputDir = path.resolve(process.cwd(), options.outputDir);
  await mkdir(outputDir, { recursive: true });
  const stamp = snapshot.snapshotTime.replace(/[^0-9]/g, "").slice(0, 14);
  const jsonPath = path.join(outputDir, `nftree-holder-wallets-${stamp}.json`);
  const csvPath = path.join(outputDir, `nftree-holder-wallets-${stamp}.csv`);
  await writeFile(jsonPath, JSON.stringify(snapshot, null, 2));
  await writeFile(csvPath, toWalletCsv(snapshot));
  console.log(JSON.stringify({
    snapshotTime: snapshot.snapshotTime,
    canonicalNftreeType: snapshot.canonicalNftreeType,
    holderOwnedNftreeCount: snapshot.holderOwnedNftreeCount,
    uniqueOwnerWalletCount: snapshot.uniqueOwnerWalletCount,
    unresolvedKioskOrObjectOwnership: snapshot.unresolvedKioskOrObjectOwnership,
    jsonPath,
    csvPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
