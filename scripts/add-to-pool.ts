import "dotenv/config";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

// ─── Deployed IDs ─────────────────────────────────────────────────────────────
const PACKAGE_ID = "0xd71fd29b28658e165f23ea09191f659bcd0282f5d635500bde891b8d1875cee3";
const MINT_CAP_ID = "0xb4b943003f7ce80732c0e4ee3a8df4403462357991a283bba6825135cb7cb0e4";
const POOL_ID    = "0xdca30e18c4156c59a243d6ef266943854c9a1ca588e91afb19cb5ced074fa3ea";

// ─── IPFS base ────────────────────────────────────────────────────────────────
const IPFS_BASE =
  "https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeid2ow76ezrhk3hxpxtvxpu3q7u233slokcf2pvsot74tk6sjyau4m";

const COLLECTION_NAME        = "Tree Nft";
const COLLECTION_DESCRIPTION = "TreeNft Collection";

// ─── Range config ─────────────────────────────────────────────────────────────
// Override via env: START_NUM=101 COUNT=50 node add-to-pool.ts
const START_NUM = parseInt(process.env.START_NUM ?? "101", 10);
const COUNT     = parseInt(process.env.COUNT     ?? "100", 10);

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
  const client  = new SuiClient({ url: getFullnodeUrl("testnet") });

  console.log(`Adding NFTs #${START_NUM} – #${START_NUM + COUNT - 1} to pool…`);

  const numbers: number[]   = [];
  const names: number[][]   = [];
  const descs: number[][]   = [];
  const images: number[][]  = [];
  const rarities: number[][] = [];

  function getRarity(n: number): string {
    if (n <= 3)   return "Mythic";
    if (n <= 10)  return "Legendary";
    if (n <= 25)  return "Epic";
    if (n <= 55)  return "Rare";
    return "Common";
  }

  for (let i = START_NUM; i < START_NUM + COUNT; i++) {
    numbers.push(i);
    names.push(toBytes(`${COLLECTION_NAME} #${i}`));
    descs.push(toBytes(COLLECTION_DESCRIPTION));
    images.push(toBytes(`${IPFS_BASE}/${i}.jpg`));
    rarities.push(toBytes(getRarity(i)));
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
  tx.setGasBudget(400_000_000);

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (result.effects?.status.status === "success") {
    console.log("✅ Deposited successfully!");
    console.log("Tx:", result.digest);
    console.log(`Explorer: https://suiscan.xyz/testnet/tx/${result.digest}`);
    const created = result.objectChanges?.filter(
      (c) => c.type === "created" && "objectType" in c && c.objectType.includes("::collection::NFT"),
    );
    console.log(`NFTs added to pool: ${created?.length ?? 0}`);
  } else {
    console.error("❌ Failed:", result.effects?.status);
  }
}

main().catch(console.error);
