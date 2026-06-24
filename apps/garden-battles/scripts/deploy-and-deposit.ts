/**
 * deploy-and-deposit.ts
 *
 * Does everything in one run:
 *   1. Publishes the collection Move package (sui_contract/collection)
 *   2. Extracts MintCap, MintConfig, Pool IDs from the publish receipt
 *   3. Saves all IDs to scripts/.deployed.json
 *   4. Batch-deposits all NFTs into the shared Pool with rarity tiers
 *
 * Usage:
 *   PRIVATE_KEY=suiprivkey... ts-node deploy-and-deposit.ts
 *   (or set PRIVATE_KEY in scripts/.env)
 *
 * Rarity tiers (by NFT number):
 *   #1  – #3   : Mythic     (3 NFTs)
 *   #4  – #10  : Legendary  (7 NFTs)
 *   #11 – #25  : Epic       (15 NFTs)
 *   #26 – #55  : Rare       (30 NFTs)
 *   #56 – #100 : Common     (45 NFTs)
 *
 * Numbers are shuffled before deposit so buyers can't predict rarity from timing.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// ─── Config ───────────────────────────────────────────────────────────────────

const IPFS_BASE =
  "https://gateway.pinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda";

// If your IPFS files are named 1.jpg, 2.jpg but your NFTs start at #1, set this to 0
const FILENAME_OFFSET = 0; 


const COLLECTION_NAME   = "Tree NFT";
const COLLECTION_DESC   = "A unique tree from the Tree NFT collection.";
const TOTAL_SUPPLY      = 100;
const MINT_PRICE_SUI    = 25;           // SUI — matches contract default
const NETWORK           = "mainnet";

// Path to the Move package (relative to this script)
const PACKAGE_DIR = path.resolve(__dirname, "../sui_contract/collection");
const DEPLOYED_FILE = path.resolve(__dirname, ".deployed.json");

// ─── Rarity ───────────────────────────────────────────────────────────────────

const RARITY_TIERS: Array<{ label: string; max: number }> = [
  { label: "Mythic",    max: 3  },
  { label: "Legendary", max: 10 },
  { label: "Epic",      max: 25 },
  { label: "Rare",      max: 55 },
  { label: "Common",    max: 100 },
];

function rarityForNumber(n: number): string {
  for (const tier of RARITY_TIERS) {
    if (n <= tier.max) return tier.label;
  }
  return "Common";
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function keypairFromPrivateKey(pk: string): Ed25519Keypair {
  // Supports both suiprivkey... bech32 format and raw hex/base64
  if (pk.startsWith("suiprivkey")) {
    return Ed25519Keypair.fromSecretKey(pk);
  }
  return Ed25519Keypair.fromSecretKey(pk);
}

// ─── Step 1: Publish ──────────────────────────────────────────────────────────

async function publishPackage(keypair: Ed25519Keypair, client: SuiClient): Promise<{
  packageId: string;
  mintCapId: string;
  mintConfigId: string;
  poolId: string;
  upgradeCap: string;
}> {
  console.log("\n📦 Building Move package...");
  execSync(`sui move build`, { cwd: PACKAGE_DIR, stdio: "inherit" });

  console.log("\n🚀 Publishing package to", NETWORK, "...");
  const sender = keypair.getPublicKey().toSuiAddress();

  // Temporarily clear Published.toml so CLI doesn't block with "already published"
  const pubTomlPath = path.join(PACKAGE_DIR, "Published.toml");
  const pubTomlBackup = fs.existsSync(pubTomlPath) ? fs.readFileSync(pubTomlPath, "utf8") : null;
  fs.writeFileSync(pubTomlPath, "# cleared for fresh publish\n");

  let rawOutput: string;
  try {
    rawOutput = execSync(
      `sui client publish --gas-budget 200000000 --json`,
      { cwd: PACKAGE_DIR, stdio: ["pipe", "pipe", "pipe"] }
    ).toString();
  } finally {
    // Always restore/update Published.toml
    if (pubTomlBackup !== null) fs.writeFileSync(pubTomlPath, pubTomlBackup);
  }

  // Strip any non-JSON preamble (warnings, build output lines) — find the first '{'
  const jsonStart = rawOutput.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("No JSON found in publish output:\n" + rawOutput);
  }
  const raw = rawOutput.slice(jsonStart);

  const result = JSON.parse(raw);

  if (result.effects?.status?.status !== "success") {
    throw new Error("Publish failed: " + JSON.stringify(result.effects?.status));
  }

  const changes: any[] = result.objectChanges ?? [];

  const packageObj = changes.find(
    (c: any) => c.type === "published"
  );
  const mintCapObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::collection::MintCap")
  );
  const mintConfigObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::collection::MintConfig")
  );
  const poolObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::collection::Pool")
  );
  const upgradeObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::package::UpgradeCap")
  );

  if (!packageObj || !mintCapObj || !mintConfigObj || !poolObj) {
    console.error("objectChanges:", JSON.stringify(changes, null, 2));
    throw new Error("Could not find all required objects in publish output.");
  }

  const ids = {
    packageId:   packageObj.packageId,
    mintCapId:   mintCapObj.objectId,
    mintConfigId: mintConfigObj.objectId,
    poolId:      poolObj.objectId,
    upgradeCap:  upgradeObj?.objectId ?? "",
  };

  // Save new Published.toml with updated IDs
  const newPubToml = [
    "# Generated by deploy-and-deposit.ts",
    "# This file contains metadata about published versions of this package",
    "",
    "[published.mainnet]",
    `chain-id = "35834a8a"`,
    `published-at = "${ids.packageId}"`,
    `original-id = "${ids.packageId}"`,
    `version = 1`,
    `upgrade-capability = "${ids.upgradeCap}"`,
    "",
  ].join("\n");
  fs.writeFileSync(pubTomlPath, newPubToml);
  console.log("   Updated Published.toml with new package ID");

  return ids;
}

// ─── Step 2: Batch deposit ────────────────────────────────────────────────────

async function batchDeposit(
  keypair: Ed25519Keypair,
  client: SuiClient,
  ids: { packageId: string; mintCapId: string; poolId: string }
): Promise<void> {
  const { packageId, mintCapId, poolId } = ids;

  // Build the full list of NFTs in order 1-100, then shuffle
  const ordered = Array.from({ length: TOTAL_SUPPLY }, (_, i) => i + 1);
  const numbers = shuffle(ordered);

  const numberVec: number[]       = [];
  const nameVec: number[][]       = [];
  const descVec: number[][]       = [];
  const imageVec: number[][]      = [];
  const rarityVec: number[][]     = [];

  for (const n of numbers) {
    const rarity = rarityForNumber(n);
    numberVec.push(n);
    nameVec.push(toBytes(`${COLLECTION_NAME} #${n}`));
    descVec.push(toBytes(`${COLLECTION_DESC} Rarity: ${rarity}`));
    imageVec.push(toBytes(`${IPFS_BASE}/${n + FILENAME_OFFSET}.jpg`));
    rarityVec.push(toBytes(rarity));

  }

  console.log("\n🌱 Depositing", TOTAL_SUPPLY, "NFTs into Pool", poolId, "...");
  console.log("   Rarity breakdown:");
  console.log("   Mythic (1-3):", numbers.filter(n => n <= 3).length, "NFTs");
  console.log("   Legendary (4-10):", numbers.filter(n => n >= 4 && n <= 10).length, "NFTs");
  console.log("   Epic (11-25):", numbers.filter(n => n >= 11 && n <= 25).length, "NFTs");
  console.log("   Rare (26-55):", numbers.filter(n => n >= 26 && n <= 55).length, "NFTs");
  console.log("   Common (56-100):", numbers.filter(n => n >= 56).length, "NFTs");

  const tx = new Transaction();

  tx.moveCall({
    target: `${packageId}::collection::batch_deposit`,
    arguments: [
      tx.object(mintCapId),
      tx.object(poolId),
      tx.pure.vector("u64", numberVec),
      tx.pure.vector("vector<u8>", nameVec),
      tx.pure.vector("vector<u8>", descVec),
      tx.pure.vector("vector<u8>", imageVec),
      tx.pure.vector("vector<u8>", rarityVec),
    ],
  });

  tx.setGasBudget(800_000_000); // 0.8 SUI — 100 NFTs is heavy

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true },
  });

  if (result.effects?.status.status !== "success") {
    throw new Error("batch_deposit failed: " + JSON.stringify(result.effects?.status));
  }

  console.log("\n✅ Deposit successful! Tx:", result.digest);
  console.log(`   Explorer: https://suiscan.xyz/${NETWORK}/tx/${result.digest}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const PRIVATE_KEY = requireEnv("PRIVATE_KEY");
  const keypair = keypairFromPrivateKey(PRIVATE_KEY);
  const sender  = keypair.getPublicKey().toSuiAddress();

  console.log("=".repeat(60));
  console.log("  Tree NFT — Deploy & Deposit");
  console.log("=".repeat(60));
  console.log("Admin wallet:", sender);
  console.log("Network:     ", NETWORK);
  console.log("Total supply:", TOTAL_SUPPLY);
  console.log("Mint price:  ", MINT_PRICE_SUI, "SUI");
  console.log("IPFS base:   ", IPFS_BASE);

  const client = new SuiClient({ url: getFullnodeUrl(NETWORK) });

  // ── Publish ──
  const ids = await publishPackage(keypair, client);

  console.log("\n📋 Deployed objects:");
  console.log("   Package ID:    ", ids.packageId);
  console.log("   MintCap ID:    ", ids.mintCapId);
  console.log("   MintConfig ID: ", ids.mintConfigId);
  console.log("   Pool ID:       ", ids.poolId);
  console.log("   UpgradeCap:    ", ids.upgradeCap);

  // ── Save IDs ──
  const deployed = {
    network:       NETWORK,
    packageId:     ids.packageId,
    mintCapId:     ids.mintCapId,
    mintConfigId:  ids.mintConfigId,
    poolId:        ids.poolId,
    upgradeCap:    ids.upgradeCap,
    deployedAt:    new Date().toISOString(),
  };
  fs.writeFileSync(DEPLOYED_FILE, JSON.stringify(deployed, null, 2));
  console.log("\n💾 Saved to scripts/.deployed.json");

  // ── Deposit all NFTs into pool ──
  await batchDeposit(keypair, client, ids);

  // ── Print sui-config.ts snippet ──
  console.log("\n" + "=".repeat(60));
  console.log("  Update battle-gardenfrontend/src/lib/sui-config.ts:");
  console.log("=".repeat(60));
  console.log(`
  COLLECTION_PACKAGE_ID: "${ids.packageId}",
  COLLECTION_MINT_CONFIG_ID: "${ids.mintConfigId}",
  COLLECTION_POOL_ID: "${ids.poolId}",
`);
  console.log("=".repeat(60));
  console.log("✅ All done! Pool is live with", TOTAL_SUPPLY, "NFTs.");
}

main().catch((e) => {
  console.error("\n❌ Error:", e?.message ?? e);
  process.exit(1);
});
