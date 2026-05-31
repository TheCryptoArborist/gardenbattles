/**
 * deploy-battle.ts
 *
 * Fresh-publish the battle_garden Move package and automatically update:
 *   - sui_contract/Published.toml        (new package ID)
 *   - battle-gardenfrontend/src/lib/sui-config.ts  (PACKAGE_ID, CONFIG_ID, MATCHMAKING_QUEUE_ID)
 *   - server/routes.ts                   (fallback hard-coded PACKAGE_ID)
 *   - .env.example                       (BATTLE_PACKAGE_ID comment)
 *   - scripts/.deployed-battle.json      (full IDs for reference)
 *
 * Usage:
 *   PRIVATE_KEY=suiprivkey... npx ts-node scripts/deploy-battle.ts
 *   (or set PRIVATE_KEY in scripts/.env)
 *
 * After running, commit the updated files and redeploy your frontend/server.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { getFullnodeUrl, SuiClient } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT          = path.resolve(__dirname, "..");
const PACKAGE_DIR   = path.join(ROOT, "sui_contract");
const PUB_TOML      = path.join(PACKAGE_DIR, "Published.toml");
const SUI_CONFIG_TS = path.join(ROOT, "battle-gardenfrontend", "src", "lib", "sui-config.ts");
const ROUTES_TS     = path.join(ROOT, "server", "routes.ts");
const ENV_EXAMPLE   = path.join(ROOT, ".env.example");
const DEPLOYED_JSON = path.join(__dirname, ".deployed-battle.json");
const NETWORK       = "mainnet";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function keypairFromPrivateKey(pk: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(pk);
}

function readFile(p: string): string {
  return fs.readFileSync(p, "utf8");
}

function writeFile(p: string, content: string): void {
  fs.writeFileSync(p, content, "utf8");
}

// ─── Step 1: Publish ──────────────────────────────────────────────────────────

async function publishPackage(): Promise<{
  packageId: string;
  configId: string;
  matchmakingQueueId: string;
  upgradeCap: string;
}> {
  console.log("\n📦 Building Move package...");

  // Temporarily blank Published.toml so the CLI doesn't refuse to publish
  const backupToml = fs.existsSync(PUB_TOML) ? readFile(PUB_TOML) : null;
  writeFile(PUB_TOML, "# cleared for fresh publish\n");

  let rawOutput: string;
  try {
    rawOutput = execSync(
      `sui client publish --gas-budget 300000000 --json`,
      { cwd: PACKAGE_DIR, stdio: ["pipe", "pipe", "pipe"] }
    ).toString();
  } catch (err: any) {
    // Restore backup on failure
    if (backupToml !== null) writeFile(PUB_TOML, backupToml);
    const stderr = err.stderr?.toString() ?? "";
    const stdout = err.stdout?.toString() ?? "";
    throw new Error(
      `sui client publish failed:\nSTDERR: ${stderr}\nSTDOUT: ${stdout}`
    );
  }

  // Strip non-JSON preamble (warnings / build lines before the JSON object)
  const jsonStart = rawOutput.indexOf("{");
  if (jsonStart === -1) {
    if (backupToml !== null) writeFile(PUB_TOML, backupToml);
    throw new Error("No JSON found in publish output:\n" + rawOutput);
  }
  const result = JSON.parse(rawOutput.slice(jsonStart));

  if (result.effects?.status?.status !== "success") {
    if (backupToml !== null) writeFile(PUB_TOML, backupToml);
    throw new Error("Publish failed: " + JSON.stringify(result.effects?.status));
  }

  const changes: any[] = result.objectChanges ?? [];

  const packageObj = changes.find((c: any) => c.type === "published");

  const configObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::config::Config")
  );

  const queueObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::matchmaking::MatchmakingQueue")
  );

  const upgradeObj = changes.find(
    (c: any) =>
      c.type === "created" &&
      (c.objectType ?? "").includes("::package::UpgradeCap")
  );

  if (!packageObj) {
    if (backupToml !== null) writeFile(PUB_TOML, backupToml);
    console.error("objectChanges:\n", JSON.stringify(changes, null, 2));
    throw new Error("Could not find published package in output.");
  }

  if (!configObj || !queueObj) {
    if (backupToml !== null) writeFile(PUB_TOML, backupToml);
    console.error("objectChanges:\n", JSON.stringify(changes, null, 2));
    throw new Error(
      "Could not find Config and/or MatchmakingQueue objects. " +
      "Check that both modules have an `init` function that shares these objects."
    );
  }

  const ids = {
    packageId:           packageObj.packageId  as string,
    configId:            configObj.objectId    as string,
    matchmakingQueueId:  queueObj.objectId     as string,
    upgradeCap:          upgradeObj?.objectId  as string ?? "",
  };

  // Write new Published.toml
  const newToml = [
    "# Generated by deploy-battle.ts",
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
  writeFile(PUB_TOML, newToml);
  console.log("   ✅ Updated sui_contract/Published.toml");

  return ids;
}

// ─── Step 2: Patch sui-config.ts ─────────────────────────────────────────────

function patchSuiConfig(ids: {
  packageId: string;
  configId: string;
  matchmakingQueueId: string;
}) {
  let content = readFile(SUI_CONFIG_TS);

  // Replace PACKAGE_ID value (the line: "0x..." after PACKAGE_ID:)
  content = content.replace(
    /(PACKAGE_ID\s*:\s*\n?\s*)"0x[0-9a-f]+"/,
    `$1"${ids.packageId}"`
  );

  // Replace CONFIG_ID value
  content = content.replace(
    /(CONFIG_ID\s*:\s*\n?\s*)"0x[0-9a-f]+"/,
    `$1"${ids.configId}"`
  );

  // Replace MATCHMAKING_QUEUE_ID value
  content = content.replace(
    /(MATCHMAKING_QUEUE_ID\s*:\s*\n?\s*)"0x[0-9a-f]+"/,
    `$1"${ids.matchmakingQueueId}"`
  );

  writeFile(SUI_CONFIG_TS, content);
  console.log("   ✅ Updated battle-gardenfrontend/src/lib/sui-config.ts");
}

// ─── Step 3: Patch server/routes.ts fallback ─────────────────────────────────

function patchServerRoutes(packageId: string) {
  let content = readFile(ROUTES_TS);

  // Replace the hard-coded fallback PACKAGE_ID string
  content = content.replace(
    /"0x25d3dd5bfb4bf4afbc1f1da0ec7ad90498e41f74e094abdd6df23047d64432e9"/g,
    `"${packageId}"`
  );

  writeFile(ROUTES_TS, content);
  console.log("   ✅ Updated server/routes.ts (fallback PACKAGE_ID)");
}

// ─── Step 4: Save deployed JSON ───────────────────────────────────────────────

function saveDeployedJson(ids: {
  packageId: string;
  configId: string;
  matchmakingQueueId: string;
  upgradeCap: string;
}) {
  const data = {
    network:            NETWORK,
    deployedAt:         new Date().toISOString(),
    packageId:          ids.packageId,
    configId:           ids.configId,
    matchmakingQueueId: ids.matchmakingQueueId,
    upgradeCap:         ids.upgradeCap,
  };
  writeFile(DEPLOYED_JSON, JSON.stringify(data, null, 2));
  console.log("   ✅ Saved scripts/.deployed-battle.json");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const PRIVATE_KEY = requireEnv("PRIVATE_KEY");
  const keypair     = keypairFromPrivateKey(PRIVATE_KEY);
  const sender      = keypair.getPublicKey().toSuiAddress();

  console.log("=".repeat(60));
  console.log("  Battle Garden — Fresh Deploy");
  console.log("=".repeat(60));
  console.log("Admin wallet:", sender);
  console.log("Network:     ", NETWORK);
  console.log("Package dir: ", PACKAGE_DIR);

  // ── Publish ──
  const ids = await publishPackage();

  console.log("\n📋 Deployed objects:");
  console.log("   Package ID:          ", ids.packageId);
  console.log("   Config ID:           ", ids.configId);
  console.log("   MatchmakingQueue ID: ", ids.matchmakingQueueId);
  console.log("   UpgradeCap:          ", ids.upgradeCap);

  // ── Patch config files ──
  console.log("\n🔧 Patching config files...");
  patchSuiConfig(ids);
  patchServerRoutes(ids.packageId);
  saveDeployedJson(ids);

  // ── Summary ──
  console.log("\n" + "=".repeat(60));
  console.log("✅ Deploy complete! Summary:");
  console.log("=".repeat(60));
  console.log(`
  PACKAGE_ID:          "${ids.packageId}"
  CONFIG_ID:           "${ids.configId}"
  MATCHMAKING_QUEUE_ID:"${ids.matchmakingQueueId}"

  Explorer:
  https://suiscan.xyz/mainnet/object/${ids.packageId}
`);
  console.log("=".repeat(60));
  console.log("Next steps:");
  console.log("  1. Set BATTLE_PACKAGE_ID in your server .env:");
  console.log(`     BATTLE_PACKAGE_ID=${ids.packageId}`);
  console.log("  2. Whitelist your NFT collection via the Admin Panel");
  console.log("  3. Redeploy your frontend and server");
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error("\n❌ Error:", e?.message ?? e);
  process.exit(1);
});
