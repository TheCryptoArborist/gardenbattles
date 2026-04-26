import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";

type Network = "testnet" | "mainnet";

type CliArgs = {
  _: string[];
  [key: string]: string | boolean | string[];
};

type NftManifestItem = {
  number: number;
  name: string;
  description: string;
  imageUrl: string;
  recipient: string;
  priceSui: number;
  priceMist: string;
  metadataUri?: string;
};

type NftManifest = {
  version: 1;
  collectionName: string;
  generatedAt: string;
  items: NftManifestItem[];
};

type BatchReceipt = {
  id: string;
  digest: string;
  recipient: string;
  fromNumber: number;
  toNumber: number;
  count: number;
  createdAt: string;
};

type MintRunState = {
  manifestPath: string;
  completedBatches: BatchReceipt[];
};

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_GAS_BUDGET = 1_000_000_000;
const PINATA_JSON_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    } else {
      out._.push(token);
    }
  }
  return out;
}

function getArg(args: CliArgs, key: string, fallback?: string): string {
  const value = args[key];
  if (typeof value === "string") return value;
  if (typeof fallback === "string") return fallback;
  throw new Error(`Missing required argument: --${key}`);
}

function getOptionalArg(args: CliArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberArg(args: CliArgs, key: string, fallback?: number): number {
  const value = getOptionalArg(args, key);
  if (!value && typeof fallback === "number") return fallback;
  if (!value) throw new Error(`Missing required argument: --${key}`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for --${key}: ${value}`);
  }
  return parsed;
}

function toMistFromSui(sui: number): string {
  return BigInt(Math.round(sui * 1_000_000_000)).toString();
}

function toBytes(input: string): number[] {
  return Array.from(new TextEncoder().encode(input));
}

function isAddress(input: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(input);
}

function normalizeUri(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, "")}/${suffix.replace(/^\/+/, "")}`;
}

function networkFromArgs(args: CliArgs): Network {
  const raw = (getOptionalArg(args, "network") || process.env.SUI_NETWORK || "testnet").toLowerCase();
  if (raw !== "testnet" && raw !== "mainnet") {
    throw new Error(`Unsupported network: ${raw}`);
  }
  return raw;
}

function rpcUrlFromArgs(args: CliArgs, network: Network): string {
  return getOptionalArg(args, "rpc-url") || process.env.SUI_RPC_URL || getFullnodeUrl(network);
}

function getClient(args: CliArgs): SuiClient {
  const network = networkFromArgs(args);
  const url = rpcUrlFromArgs(args, network);
  return new SuiClient({ url });
}

function signerFromArgs(args: CliArgs): Ed25519Keypair {
  const raw =
    getOptionalArg(args, "private-key") ||
    process.env.SUI_PRIVATE_KEY ||
    process.env.PRIVATE_KEY;
  if (!raw) {
    throw new Error("Missing signer private key. Use --private-key or SUI_PRIVATE_KEY.");
  }

  if (raw.startsWith("suiprivkey")) {
    const decoded = decodeSuiPrivateKey(raw);
    return Ed25519Keypair.fromSecretKey(decoded.secretKey);
  }

  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (hex.length % 2 !== 0) {
    throw new Error("Hex private key must have even length");
  }
  const bytes = Uint8Array.from(Buffer.from(hex, "hex"));
  return Ed25519Keypair.fromSecretKey(bytes);
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function uploadJsonToPinata(jwt: string, payload: unknown, name: string): Promise<string> {
  const fetchFn = (globalThis as any).fetch;
  if (!fetchFn) throw new Error("Global fetch is not available in this runtime");

  const response = await fetchFn(PINATA_JSON_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataMetadata: { name },
      pinataContent: payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pinata upload failed (${response.status}): ${text}`);
  }

  const body = (await response.json()) as { IpfsHash?: string };
  if (!body.IpfsHash) {
    throw new Error("Pinata response missing IpfsHash");
  }
  return body.IpfsHash;
}

function ensureManifest(manifest: NftManifest): void {
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error("Manifest has no items");
  }
  for (const item of manifest.items) {
    if (!Number.isInteger(item.number) || item.number < 1) {
      throw new Error(`Invalid NFT number in manifest: ${item.number}`);
    }
    if (!item.name || !item.description || !item.imageUrl) {
      throw new Error(`Missing required NFT fields for #${item.number}`);
    }
    if (!isAddress(item.recipient)) {
      throw new Error(`Invalid recipient for #${item.number}: ${item.recipient}`);
    }
  }
}

async function prepareManifest(args: CliArgs): Promise<void> {
  const mode = getArg(args, "mode");
  const start = getNumberArg(args, "start");
  const end = getNumberArg(args, "end");
  const out = getArg(args, "out");
  const namePrefix = getArg(args, "name-prefix");
  const description = getArg(args, "description");
  const recipient = getArg(args, "recipient");
  const collectionName = getOptionalArg(args, "collection-name") || "Tree Nft";
  const priceSui = getNumberArg(args, "price-sui", 25);
  const priceMist = toMistFromSui(priceSui);

  if (!isAddress(recipient)) {
    throw new Error(`Invalid --recipient address: ${recipient}`);
  }
  if (start < 1 || end < start) {
    throw new Error("Invalid --start/--end range");
  }
  if (priceSui <= 0) {
    throw new Error("--price-sui must be greater than zero");
  }

  const items: NftManifestItem[] = [];

  if (mode === "existing-cid") {
    const imageBaseUri = getArg(args, "image-base-uri");
    const imageExt = getOptionalArg(args, "image-ext") || "jpg";
    for (let i = start; i <= end; i += 1) {
      items.push({
        number: i,
        name: `${namePrefix}${i}`,
        description,
        imageUrl: normalizeUri(imageBaseUri, `${i}.${imageExt}`),
        recipient,
        priceSui,
        priceMist,
      });
    }
  } else if (mode === "pinata-metadata") {
    const jwt = getArg(args, "pinata-jwt", process.env.PINATA_JWT);
    const imageBaseUri = getArg(args, "image-base-uri");
    const imageExt = getOptionalArg(args, "image-ext") || "jpg";
    const pinataGateway =
      getOptionalArg(args, "pinata-gateway") || process.env.PINATA_GATEWAY || "ipfs://";

    for (let i = start; i <= end; i += 1) {
      const name = `${namePrefix}${i}`;
      const imageUrl = normalizeUri(imageBaseUri, `${i}.${imageExt}`);
      const metadata = {
        name,
        description,
        image: imageUrl,
        attributes: [
          {
            trait_type: "Mint Price",
            value: `${priceSui} SUI`,
          },
          {
            trait_type: "Mint Price MIST",
            value: priceMist,
          },
        ],
        external_url: normalizeUri(pinataGateway, ""),
      };
      const hash = await uploadJsonToPinata(jwt, metadata, `${collectionName}-${i}`);
      const metadataUri = pinataGateway.startsWith("http")
        ? normalizeUri(pinataGateway, hash)
        : `ipfs://${hash}`;
      items.push({
        number: i,
        name,
        description,
        imageUrl,
        recipient,
        priceSui,
        priceMist,
        metadataUri,
      });
      if (i % 25 === 0) {
        console.log(`Uploaded metadata ${i - start + 1}/${end - start + 1}`);
      }
    }
  } else {
    throw new Error(`Unsupported mode: ${mode}. Use existing-cid or pinata-metadata.`);
  }

  const manifest: NftManifest = {
    version: 1,
    collectionName,
    generatedAt: new Date().toISOString(),
    items,
  };

  await writeJsonFile(out, manifest);
  console.log(`Manifest written: ${out}`);
  console.log(`Items: ${items.length}`);
  console.log(`Configured mint price: ${priceSui} SUI (${priceMist} MIST)`);
}

function getBatchId(items: NftManifestItem[]): string {
  const first = items[0];
  const last = items[items.length - 1];
  return `${first.recipient}:${first.number}-${last.number}`;
}

async function mintFromManifest(args: CliArgs): Promise<void> {
  const manifestPath = getArg(args, "manifest");
  const packageId = getArg(args, "package-id", process.env.COLLECTION_PACKAGE_ID || process.env.PACKAGE_ID);
  const mintCapId = getArg(args, "mint-cap-id", process.env.MINT_CAP_ID);
  const batchSize = getNumberArg(args, "batch-size", DEFAULT_BATCH_SIZE);
  const gasBudget = getNumberArg(args, "gas-budget", DEFAULT_GAS_BUDGET);
  const stateFile = getOptionalArg(args, "state-file") || `${manifestPath}.state.json`;
  const startFrom = getNumberArg(args, "start-from", 1);
  const maxCount = getOptionalArg(args, "max-count");
  const dryRun = args["dry-run"] === true;

  const manifest = await readJsonFile<NftManifest>(manifestPath);
  ensureManifest(manifest);

  const client = getClient(args);
  const signer = dryRun ? null : signerFromArgs(args);
  const sender = signer ? signer.getPublicKey().toSuiAddress() : "dry-run";

  let state: MintRunState = { manifestPath, completedBatches: [] };
  try {
    state = await readJsonFile<MintRunState>(stateFile);
  } catch {
    // start with empty state file
  }

  const completed = new Set(state.completedBatches.map((b) => b.id));

  let items = manifest.items
    .filter((item) => item.number >= startFrom)
    .sort((a, b) => a.number - b.number);

  if (maxCount) {
    const parsedMax = Number(maxCount);
    if (!Number.isFinite(parsedMax) || parsedMax < 1) {
      throw new Error(`Invalid --max-count: ${maxCount}`);
    }
    items = items.slice(0, parsedMax);
  }

  const byRecipient = new Map<string, NftManifestItem[]>();
  for (const item of items) {
    if (!byRecipient.has(item.recipient)) byRecipient.set(item.recipient, []);
    byRecipient.get(item.recipient)!.push(item);
  }

  const groupedBatches: NftManifestItem[][] = [];
  for (const recipientItems of byRecipient.values()) {
    for (const group of chunk(recipientItems, batchSize)) {
      groupedBatches.push(group);
    }
  }

  console.log(`Signer: ${sender}`);
  console.log(`Batches planned: ${groupedBatches.length}`);

  for (const batch of groupedBatches) {
    const batchId = getBatchId(batch);
    if (completed.has(batchId)) {
      console.log(`Skipping completed batch ${batchId}`);
      continue;
    }

    const numbers = batch.map((item) => item.number);
    const names = batch.map((item) => toBytes(item.name));
    const descriptions = batch.map((item) => toBytes(item.description));
    const imageUrls = batch.map((item) => toBytes(item.imageUrl));
    const recipient = batch[0].recipient;

    if (dryRun) {
      console.log(`[dry-run] ${batchId} count=${batch.length}`);
      continue;
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::collection::batch_mint`,
      arguments: [
        tx.object(mintCapId),
        tx.pure.vector("u64", numbers),
        tx.pure.vector("vector<u8>", names),
        tx.pure.vector("vector<u8>", descriptions),
        tx.pure.vector("vector<u8>", imageUrls),
        tx.pure.address(recipient),
      ],
    });
    tx.setGasBudget(gasBudget);

    console.log(`Submitting ${batchId} (${batch.length} NFTs)`);
    const result = await client.signAndExecuteTransaction({
      signer: signer!,
      transaction: tx,
      options: { showEffects: true },
    });

    if (result.effects?.status.status !== "success") {
      throw new Error(`Batch failed ${batchId}: ${JSON.stringify(result.effects?.status)}`);
    }

    const receipt: BatchReceipt = {
      id: batchId,
      digest: result.digest,
      recipient,
      fromNumber: batch[0].number,
      toNumber: batch[batch.length - 1].number,
      count: batch.length,
      createdAt: new Date().toISOString(),
    };
    state.completedBatches.push(receipt);
    await writeJsonFile(stateFile, state);
    console.log(`Confirmed ${batchId}: ${result.digest}`);
  }

  console.log("Mint run completed.");
  console.log(`State file: ${stateFile}`);
}

async function setTreasury(args: CliArgs): Promise<void> {
  const battlePackageId = getArg(args, "battle-package-id", process.env.BATTLE_PACKAGE_ID || process.env.PACKAGE_ID);
  const configId = getArg(args, "config-id", process.env.CONFIG_ID);
  const treasuryAddress = getArg(args, "treasury-address", process.env.TREASURY_ADDRESS);
  const gasBudget = getNumberArg(args, "gas-budget", DEFAULT_GAS_BUDGET);

  if (!isAddress(treasuryAddress)) {
    throw new Error(`Invalid treasury address: ${treasuryAddress}`);
  }

  const client = getClient(args);
  const signer = signerFromArgs(args);

  const tx = new Transaction();
  tx.moveCall({
    target: `${battlePackageId}::config::set_treasury`,
    arguments: [tx.object(configId), tx.pure.address(treasuryAddress)],
  });
  tx.setGasBudget(gasBudget);

  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: { showEffects: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(`set_treasury failed: ${JSON.stringify(result.effects?.status)}`);
  }

  console.log(`Treasury updated to ${treasuryAddress}`);
  console.log(`Digest: ${result.digest}`);
}

async function syncWhitelist(args: CliArgs): Promise<void> {
  const battlePackageId = getArg(args, "battle-package-id", process.env.BATTLE_PACKAGE_ID || process.env.PACKAGE_ID);
  const configId = getArg(args, "config-id", process.env.CONFIG_ID);
  const collectionType = getArg(args, "collection-type");
  const gasBudget = getNumberArg(args, "gas-budget", DEFAULT_GAS_BUDGET);

  const client = getClient(args);
  const signer = signerFromArgs(args);

  const tx = new Transaction();
  tx.moveCall({
    target: `${battlePackageId}::config::whitelist_collection`,
    typeArguments: [collectionType],
    arguments: [tx.object(configId)],
  });
  tx.setGasBudget(gasBudget);

  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    options: { showEffects: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error(`whitelist sync failed: ${JSON.stringify(result.effects?.status)}`);
  }

  console.log(`Collection type synced: ${collectionType}`);
  console.log(`Digest: ${result.digest}`);
}

async function verifyMinted(args: CliArgs): Promise<void> {
  const manifestPath = getArg(args, "manifest");
  const packageId = getArg(args, "package-id", process.env.COLLECTION_PACKAGE_ID || process.env.PACKAGE_ID);
  const client = getClient(args);

  const manifest = await readJsonFile<NftManifest>(manifestPath);
  ensureManifest(manifest);

  const eventType = `${packageId}::collection::NFTMinted`;
  const expectedNumbers = new Set(manifest.items.map((x) => x.number));
  const expectedRecipients = new Set(manifest.items.map((x) => x.recipient.toLowerCase()));

  let cursor: { txDigest: string; eventSeq: string } | null = null;
  let found = 0;
  const mintedNumbers = new Set<number>();

  for (;;) {
    const response = await client.queryEvents({
      query: { MoveEventType: eventType },
      cursor,
      limit: 50,
      order: "descending",
    });

    for (const event of response.data) {
      const parsed = event.parsedJson as { number?: number; recipient?: string };
      if (!parsed || typeof parsed.number !== "number" || typeof parsed.recipient !== "string") continue;
      if (expectedNumbers.has(parsed.number) && expectedRecipients.has(parsed.recipient.toLowerCase())) {
        mintedNumbers.add(parsed.number);
      }
    }

    found = mintedNumbers.size;
    if (!response.hasNextPage || found >= expectedNumbers.size) {
      break;
    }
    cursor = response.nextCursor ?? null;
  }

  const missing: number[] = [];
  for (const number of expectedNumbers) {
    if (!mintedNumbers.has(number)) missing.push(number);
  }

  console.log(`Expected: ${expectedNumbers.size}`);
  console.log(`Found: ${found}`);
  if (missing.length > 0) {
    console.log(`Missing (${missing.length}): ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? " ..." : ""}`);
    process.exitCode = 2;
  } else {
    console.log("All manifest NFT numbers verified via events.");
  }
}

async function mainnetPreflight(args: CliArgs): Promise<void> {
  const network = networkFromArgs(args);
  const client = getClient(args);

  const packageId = getArg(args, "package-id", process.env.COLLECTION_PACKAGE_ID || process.env.PACKAGE_ID);
  const mintCapId = getArg(args, "mint-cap-id", process.env.MINT_CAP_ID);
  const battlePackageId = getOptionalArg(args, "battle-package-id") || process.env.BATTLE_PACKAGE_ID;
  const configId = getOptionalArg(args, "config-id") || process.env.CONFIG_ID;

  const signer = signerFromArgs(args);
  const signerAddress = signer.getPublicKey().toSuiAddress();

  const [pkgObj, capObj] = await Promise.all([
    client.getObject({ id: packageId, options: { showType: true } }),
    client.getObject({ id: mintCapId, options: { showType: true, showOwner: true } }),
  ]);

  const checks: Array<[string, boolean, string]> = [];
  checks.push(["Network is mainnet", network === "mainnet", `network=${network}`]);
  checks.push([
    "Collection package object found",
    !!pkgObj.data,
    pkgObj.error ? JSON.stringify(pkgObj.error) : packageId,
  ]);
  checks.push([
    "MintCap object found",
    !!capObj.data,
    capObj.error ? JSON.stringify(capObj.error) : mintCapId,
  ]);

  if (battlePackageId) {
    const battleObj = await client.getObject({ id: battlePackageId, options: { showType: true } });
    checks.push([
      "Battle package object found",
      !!battleObj.data,
      battleObj.error ? JSON.stringify(battleObj.error) : battlePackageId,
    ]);
  }

  if (configId) {
    const cfgObj = await client.getObject({ id: configId, options: { showType: true, showOwner: true } });
    checks.push([
      "Config object found",
      !!cfgObj.data,
      cfgObj.error ? JSON.stringify(cfgObj.error) : configId,
    ]);
  }

  const balance = await client.getBalance({ owner: signerAddress });
  checks.push([
    "Signer gas balance > 0",
    Number(balance.totalBalance) > 0,
    `${balance.totalBalance} MIST`,
  ]);

  console.log(`Signer: ${signerAddress}`);
  console.log("Preflight checks:");
  for (const [name, ok, detail] of checks) {
    console.log(`- [${ok ? "OK" : "FAIL"}] ${name} (${detail})`);
  }

  if (checks.some((entry) => !entry[1])) {
    process.exitCode = 2;
  }
}

function printHelp(): void {
  console.log(`Tree NFT CLI

Commands:
  prepare-manifest   Build manifest via existing CID mode or Pinata metadata mode.
  mint               Mint NFTs from manifest in chunked batches with resume state.
  verify-mint        Verify minted NFT numbers via NFTMinted events.
  set-treasury       Set battle config treasury address on-chain.
  sync-whitelist     Whitelist collection type in battle config.
  mainnet-preflight  Validate IDs, objects, signer, and network before mainnet run.

Examples:
  ts-node nft-cli.ts prepare-manifest --mode existing-cid --start 1 --end 5000 --name-prefix "Tree Nft #" --description "TreeNft Collection" --image-base-uri ipfs://CID --recipient 0xabc --price-sui 25 --out ./manifests/mainnet.json
  ts-node nft-cli.ts mint --network mainnet --manifest ./manifests/mainnet.json --package-id 0x... --mint-cap-id 0x... --batch-size 100 --state-file ./manifests/mainnet.state.json
  ts-node nft-cli.ts set-treasury --network mainnet --battle-package-id 0x... --config-id 0x... --treasury-address 0x...
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "prepare-manifest") {
    await prepareManifest(args);
    return;
  }
  if (command === "mint") {
    await mintFromManifest(args);
    return;
  }
  if (command === "verify-mint") {
    await verifyMinted(args);
    return;
  }
  if (command === "set-treasury") {
    await setTreasury(args);
    return;
  }
  if (command === "sync-whitelist") {
    await syncWhitelist(args);
    return;
  }
  if (command === "mainnet-preflight") {
    await mainnetPreflight(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
