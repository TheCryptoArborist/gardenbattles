import "dotenv/config";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// ─── Deployed IDs ─────────────────────────────────────────────────────────────
const PACKAGE_ID  = "0x1624a78e4ea737c12f95515e40d53f0ffac2f499639f19359d0611893aa644e9";
const MINT_CAP_ID = "0x87c539ea9eab914197d11098bc92e9fbf22aea0311616f5300893136b9994004";
const POOL_ID     = "0xaed1160b32fb9410aa13469eea8c6cd8a67b8e1d139dc04b5396d8eb551e0716";

// ─── IPFS base ────────────────────────────────────────────────────────────────
// Update this to the new IPFS folder CID when uploading a new batch of images
const IPFS_BASE =
  "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeif6hexxcafd3k7xsqaqisax3lp35shh62p753qtqcdx4c2ir4l6je";

const COLLECTION_NAME        = "Tree Nft";
const COLLECTION_DESCRIPTION = "TreeNft Collection";

// ─── Network ──────────────────────────────────────────────────────────────────
// Override via env: NETWORK=mainnet npx ts-node add-to-pool.ts
const NETWORK = (process.env.NETWORK ?? "testnet") as "mainnet" | "testnet";

// ─── Range config ─────────────────────────────────────────────────────────────
// Override via env: START_NUM=101 COUNT=50 npx ts-node add-to-pool.ts
const START_NUM = parseInt(process.env.START_NUM ?? "101", 10);
const COUNT     = parseInt(process.env.COUNT     ?? "100", 10);

// ─── Rarity tiers ─────────────────────────────────────────────────────────────
// Percentage-based — applies to EVERY batch, not tied to NFT number.
// Adjust percentages here and all future top-ups get the same spread.
// Must sum to 100.
const RARITY_TIERS: Array<{ label: string; pct: number }> = [
  { label: "Mythic",    pct: 3  },  //  3% of each batch
  { label: "Legendary", pct: 7  },  //  7%
  { label: "Epic",      pct: 15 },  // 15%
  { label: "Rare",      pct: 30 },  // 30%
  { label: "Common",    pct: 45 },  // 45%
];

/**
 * Builds a shuffled rarity label array for `count` NFTs.
 * Uses percentage tiers above — any rounding remainder goes to Common.
 * Shuffled so buyers cannot predict rarity from NFT number or mint timing.
 */
function buildRarityList(count: number): string[] {
  const labels: string[] = [];

  // Assign all tiers except the last (Common absorbs rounding)
  for (let t = 0; t < RARITY_TIERS.length - 1; t++) {
    const n = Math.round((RARITY_TIERS[t].pct / 100) * count);
    for (let i = 0; i < n; i++) labels.push(RARITY_TIERS[t].label);
  }

  // Fill remainder with Common
  while (labels.length < count) {
    labels.push("Common");
  }

  // Fisher-Yates shuffle
  for (let i = labels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [labels[i], labels[j]] = [labels[j], labels[i]];
  }

  return labels;
}

function toBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function keypairFromPrivateKey(privateKey: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(privateKey);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing PRIVATE_KEY env var");

  const keypair = keypairFromPrivateKey(privateKey);
  const client  = new SuiClient({ url: process.env.RPC_URL ?? getFullnodeUrl(NETWORK) });

  const endNum = START_NUM + COUNT - 1;
  console.log("=".repeat(60));
  console.log("  Tree NFT — Add to Pool");
  console.log("=".repeat(60));
  console.log(`Network:    ${NETWORK}`);
  console.log(`Range:      #${START_NUM} – #${endNum}  (${COUNT} NFTs)`);
  console.log(`IPFS base:  ${IPFS_BASE}`);

  // Build rarity list and log the breakdown before sending tx
  const rarityLabels = buildRarityList(COUNT);

  console.log("\nRarity breakdown for this batch:");
  for (const tier of RARITY_TIERS) {
    const n = rarityLabels.filter((r) => r === tier.label).length;
    console.log(`  ${tier.label.padEnd(10)} ${n} NFTs  (${tier.pct}%)`);
  }
  console.log("");

  const numbers: number[]    = [];
  const names: number[][]    = [];
  const descs: number[][]    = [];
  const images: number[][]   = [];
  const rarities: number[][] = [];

  for (let i = 0; i < COUNT; i++) {
    const num = START_NUM + i;
    numbers.push(num);
    names.push(toBytes(`${COLLECTION_NAME} #${num}`));
    descs.push(toBytes(COLLECTION_DESCRIPTION));
    images.push(toBytes(`${IPFS_BASE}/${num}.jpg`));
    rarities.push(toBytes(rarityLabels[i]));
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::collection::batch_deposit`,
    arguments: [
      tx.object(MINT_CAP_ID),
      tx.object(POOL_ID),
      tx.pure.vector("u64", numbers),
      tx.pure.vector("vector<u8>", names),
      tx.pure.vector("vector<u8>", descs),
      tx.pure.vector("vector<u8>", images),
      tx.pure.vector("vector<u8>", rarities),
    ],
  });

  // Scale gas with batch size: ~4M MIST per NFT, minimum 200M
  const gasBudget = Math.max(200_000_000, COUNT * 4_000_000);
  tx.setGasBudget(gasBudget);
  console.log(`Gas budget: ${(gasBudget / 1_000_000_000).toFixed(3)} SUI`);
  console.log(`\nDepositing into pool ${POOL_ID}…`);

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true, showEvents: true },
  });

  if (result.effects?.status.status === "success") {
    console.log("\n✅ Deposited successfully!");
    console.log("Tx:", result.digest);
    console.log(`Explorer: https://suiscan.xyz/${NETWORK}/tx/${result.digest}`);
    const mintedEvents = result.events?.filter(
      (e) => e.type.includes("::collection::NFTMinted"),
    );
    console.log(`NFTs added to pool: ${mintedEvents?.length ?? 0}`);
  } else {
    console.error("❌ Failed:", result.effects?.status);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\n❌ Error:", e?.message ?? e);
  process.exit(1);
});
