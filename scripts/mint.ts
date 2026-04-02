import "dotenv/config";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function keypairFromPrivateKey(privateKey: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(privateKey);
}

function toBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PACKAGE_ID = requireEnv("PACKAGE_ID");
const MINT_CAP_ID = requireEnv("MINT_CAP_ID");
const RECIPIENT = requireEnv("RECIPIENT_ADDRESS");
const PRIVATE_KEY = requireEnv("PRIVATE_KEY");

const IPFS_BASE =
  "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda";

const COLLECTION_NAME = "Tree Nft";
const COLLECTION_DESCRIPTION = "TreeNft Collection";
const TOTAL_SUPPLY = 100;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const keypair = keypairFromPrivateKey(PRIVATE_KEY);
  const sender = keypair.getPublicKey().toSuiAddress();
  console.log("Deployer address:", sender);

  const client = new SuiClient({ url: getFullnodeUrl("testnet") });

  // Build parallel vectors for all 100 NFTs
  const numbers: number[] = [];
  const names: number[][] = [];
  const descriptions: number[][] = [];
  const imageUrls: number[][] = [];

  for (let i = 1; i <= TOTAL_SUPPLY; i++) {
    numbers.push(i);
    names.push(toBytes(`${COLLECTION_NAME} #${i}`));
    descriptions.push(toBytes(COLLECTION_DESCRIPTION));
    imageUrls.push(toBytes(`${IPFS_BASE}/${i}.jpg`));
  }

  // Single PTB — all 100 NFTs in one transaction
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::collection::batch_mint`,
    arguments: [
      tx.object(MINT_CAP_ID),
      tx.pure.vector("u64", numbers),
      tx.pure.vector("vector<u8>", names),
      tx.pure.vector("vector<u8>", descriptions),
      tx.pure.vector("vector<u8>", imageUrls),
      tx.pure.address(RECIPIENT),
    ],
  });

  tx.setGasBudget(500_000_000); // 0.5 SUI — adjust if needed

  console.log(`\nSubmitting batch_mint for ${TOTAL_SUPPLY} NFTs...`);
  console.log("Recipient:", RECIPIENT);

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: {
      showEffects: true,
      showObjectChanges: true,
    },
  });

  if (result.effects?.status.status === "success") {
    console.log("\n✅ Mint successful!");
    console.log("Transaction digest:", result.digest);
    console.log(
      `View on explorer: https://suiscan.xyz/testnet/tx/${result.digest}`,
    );

    const created = result.objectChanges?.filter(
      (c) =>
        c.type === "created" &&
        "objectType" in c &&
        c.objectType.includes("::collection::NFT"),
    );
    console.log(`\nNFTs created: ${created?.length ?? 0}`);
  } else {
    console.error("\n❌ Mint failed:", result.effects?.status);
  }
}

main().catch(console.error);
