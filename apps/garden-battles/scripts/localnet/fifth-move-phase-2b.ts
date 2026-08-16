import "dotenv/config";
import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import express from "express";
import { SuiClient, getFullnodeUrl, type SuiTransactionBlockResponse } from "@mysten/sui/client";
import { requestSuiFromFaucetV2 } from "@mysten/sui/faucet";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Ed25519PublicKey } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { createFifthMoveAttestationHandler, parseMoveTypeName, parseMoveU64, parseMoveU8Vector } from "../../server/routes";
import {
  decodeBase64Bytes,
  FIFTH_MOVE_SOURCE_BITS,
  serializeFifthMoveAttestationPayload,
} from "../../shared/fifth-move-attestation";
import type { FifthMoveEligibilityResponse } from "../../shared/tree-power-eligibility";
import { buildDirectPvpJoinTransaction } from "../../battle-gardenfrontend/src/lib/fifthMoveTransactions";
import type { FifthMoveProof } from "../../battle-gardenfrontend/src/lib/fifthMoveRouting";

const execFileAsync = promisify(execFile);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, "../..");
const REPO_DIR = path.resolve(APP_DIR, "../..");
const SOURCE_PACKAGE_DIR = path.join(APP_DIR, "sui_contract");
const DEFAULT_OUTPUT_DIR = path.join(APP_DIR, "diagnostics-output", "phase-2b-localnet");
const LOCAL_RPC_URL = "http://127.0.0.1:9000";
const LOCAL_FAUCET_URL = "http://127.0.0.1:9123";
const ENTRY_FEE_MIST = 3_000_000_000n;
const WINNER_PAYOUT_MIST = 5_000_000_000n;
const TREASURY_SHARE_MIST = 1_000_000_000n;
const THRESHOLD_RAW = "1000000000000";
const CLOCK_ID = "0x6";
const RANDOM_ID = "0x8";

const PUBLIC_RPC_URLS = new Set([
  getFullnodeUrl("mainnet"),
  getFullnodeUrl("testnet"),
  getFullnodeUrl("devnet"),
]);

type PublishedPackage = {
  packageId: string;
  digest: string;
  created: Array<{ objectId: string; objectType: string; owner?: unknown }>;
};

type LocalObjects = {
  fixturePackageId: string;
  fixtureMintCapId: string;
  gardenPackageId: string;
  configId: string;
  fifthMoveConfigId: string;
  queue50Id: string;
  player1NftId: string;
  player2NftId: string;
  refundNftId: string;
};

type Report = {
  generatedAt: string;
  suiVersion: string | null;
  localChainIdentifier: string;
  localPublicAddresses: Record<"admin" | "player1" | "player2", string>;
  ephemeralSignerPublicKey: string;
  localObjects: Partial<LocalObjects>;
  httpProof: {
    ok: boolean;
    bcsBytesVerified: boolean;
    rawSignatureVerified: boolean;
    fifthMoveConfigId?: string;
    status?: number;
    reason?: string;
  };
  transactions: {
    fixturePublish?: string;
    gardenPublish?: string;
    setup?: string[];
    qualifiedJoin?: string;
    standardJoin?: string;
    tamperedProof?: string;
    refundJoin?: string;
    refund?: string;
  };
  battle: {
    battleId?: string;
    targetGrowth?: string;
    p1MoveCount?: number;
    p2MoveCount?: number;
    p1UniqueMoves?: boolean;
    move8Absent?: boolean;
    p1Entitled?: boolean;
    p2Entitled?: boolean;
    vaultMist?: string;
    vaultFieldShape?: string;
  };
  queue: {
    waitingClearedAfterMatch?: boolean;
    bankMistAfterMatch?: string;
    waitingBeforeRefundShape?: string;
    bankMistBeforeRefund?: string;
    waitingClearedAfterRefund?: boolean;
    bankMistAfterRefund?: string;
  };
  cleanup: {
    localnetStopped: boolean;
    tempDirRemoved: boolean;
    secretMaterialPersisted: boolean;
  };
};

function isLoopbackRpcUrl(rpcUrl: string): boolean {
  const parsed = new URL(rpcUrl);
  return ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname);
}

async function readSuiVersion(): Promise<string | null> {
  try {
    const out = await execFileAsync("sui", ["--version"], { timeout: 10_000 });
    return out.stdout.trim();
  } catch {
    return null;
  }
}

async function waitForRpc(client: SuiClient, timeoutMs = 60_000): Promise<string> {
  const started = Date.now();
  let lastError: unknown = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await client.getChainIdentifier();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(`localnet_rpc_not_ready:${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function startLocalnet(networkDir: string, logDir: string): ChildProcessWithoutNullStreams {
  const stdout = createWriteStream(path.join(logDir, "sui-start.stdout.log"));
  const stderr = createWriteStream(path.join(logDir, "sui-start.stderr.log"));
  const proc = spawn(
    "sui",
    [
      "start",
      "--with-faucet",
      "--fullnode-rpc-port",
      "9000",
      "--network.config",
      networkDir,
    ],
    { cwd: logDir, windowsHide: true },
  );
  proc.stdout.pipe(stdout);
  proc.stderr.pipe(stderr);
  return proc;
}

async function prepareLocalnetConfig(networkDir: string): Promise<void> {
  await execFileAsync(
    "sui",
    ["genesis", "--working-dir", networkDir, "--with-faucet", "--force"],
    { cwd: networkDir, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
  );
}

async function stopLocalnet(proc: ChildProcessWithoutNullStreams | null): Promise<boolean> {
  if (!proc || proc.killed) return true;
  proc.kill();
  await Promise.race([
    once(proc, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (!proc.killed) proc.kill("SIGKILL");
  return true;
}

async function fundAccount(client: SuiClient, address: string): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    const faucet = await requestSuiFromFaucetV2({ host: LOCAL_FAUCET_URL, recipient: address });
    if (faucet.status === "Success") {
      for (let j = 0; j < 20; j += 1) {
        const balance = await client.getBalance({ owner: address });
        if (BigInt(balance.totalBalance) > 10_000_000_000n) return;
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`localnet_faucet_failed:${address}`);
}

async function writeFixturePackage(packageDir: string): Promise<void> {
  await mkdir(path.join(packageDir, "sources"), { recursive: true });
  await writeFile(
    path.join(packageDir, "Move.toml"),
    `[package]\nname = "local_fixtures"\nversion = "0.0.1"\nedition = "2024.beta"\n\n[addresses]\nlocal_fixtures = "0x0"\n`,
  );
  await writeFile(
    path.join(packageDir, "sources", "tree.move"),
    `module local_fixtures::tree {\n    public struct TREE has drop {}\n}\n`,
  );
  await writeFile(
    path.join(packageDir, "sources", "test_nft.move"),
    `module local_fixtures::test_nft {\n    public struct TestNFT has key, store { id: UID }\n    public struct MintCap has key, store { id: UID }\n\n    fun init(ctx: &mut TxContext) {\n        transfer::public_transfer(MintCap { id: object::new(ctx) }, tx_context::sender(ctx));\n    }\n\n    public fun mint(_cap: &MintCap, recipient: address, ctx: &mut TxContext) {\n        transfer::public_transfer(TestNFT { id: object::new(ctx) }, recipient);\n    }\n}\n`,
  );
}

async function compilePackage(packageDir: string): Promise<{ modules: string[]; dependencies: string[] }> {
  const output = await execFileAsync(
    "sui",
    ["move", "build", "--dump-bytecode-as-base64", "--path", packageDir, "--no-tree-shaking"],
    { cwd: packageDir, timeout: 120_000, maxBuffer: 100 * 1024 * 1024 },
  );
  const jsonLine = output.stdout.split(/\r?\n/).find((line) => line.trim().startsWith("{"));
  if (!jsonLine) throw new Error("bytecode_json_not_found");
  const parsed = JSON.parse(jsonLine);
  return { modules: parsed.modules, dependencies: parsed.dependencies };
}

async function execute(
  client: SuiClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  options: { allowFailure?: boolean } = {},
): Promise<SuiTransactionBlockResponse> {
  tx.setSenderIfNotSet(signer.getPublicKey().toSuiAddress());
  tx.setGasBudgetIfNotSet(2_000_000_000);
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
      showBalanceChanges: true,
    },
  });
  const confirmed = await client.waitForTransaction({
    digest: result.digest,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
      showBalanceChanges: true,
    },
  });
  const status = confirmed.effects?.status?.status;
  if (!options.allowFailure && status !== "success") {
    throw new Error(`transaction_failed:${confirmed.digest}:${confirmed.effects?.status?.error ?? "unknown"}`);
  }
  return confirmed;
}

async function publishPackage(
  client: SuiClient,
  signer: Ed25519Keypair,
  packageDir: string,
): Promise<PublishedPackage> {
  const compiled = await compilePackage(packageDir);
  const tx = new Transaction();
  const [upgradeCap] = tx.publish(compiled);
  tx.transferObjects([upgradeCap], signer.getPublicKey().toSuiAddress());
  const result = await execute(client, signer, tx);
  const packageId = result.objectChanges?.find((change: any) => change.type === "published")?.packageId;
  if (!packageId) throw new Error("published_package_id_not_found");
  const created = (result.objectChanges ?? [])
    .filter((change: any) => change.type === "created" && typeof change.objectId === "string")
    .map((change: any) => ({
      objectId: change.objectId,
      objectType: change.objectType,
      owner: change.owner,
    }));
  return { packageId, digest: result.digest, created };
}

function findCreated(created: PublishedPackage["created"], suffix: string): string {
  const found = created.find((object) => object.objectType?.endsWith(suffix));
  if (!found) throw new Error(`created_object_not_found:${suffix}`);
  return found.objectId;
}

async function readFields(client: SuiClient, objectId: string): Promise<Record<string, any>> {
  const object = await client.getObject({ id: objectId, options: { showContent: true, showType: true } });
  if (object.error) throw new Error(`object_read_failed:${objectId}:${object.error.code}`);
  const content = object.data?.content;
  if (!content || content.dataType !== "moveObject") throw new Error(`unexpected_object_content:${objectId}`);
  return content.fields as Record<string, any>;
}

function balanceValue(fields: any): string {
  if (typeof fields === "string") return fields;
  if (typeof fields === "number" && Number.isSafeInteger(fields)) return String(fields);
  if (typeof fields === "bigint") return fields.toString();
  const value = fields?.fields?.value ?? fields?.value;
  return typeof value === "string" ? value : String(value ?? "0");
}

function vectorLength(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  const contents = (value as any)?.fields?.contents;
  return Array.isArray(contents) ? contents.length : 0;
}

function vectorValues(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(Number);
  const contents = (value as any)?.fields?.contents;
  return Array.isArray(contents) ? contents.map(Number) : [];
}

function optionSome(value: unknown): any | null {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  if (value && typeof value === "object" && typeof (value as any).type === "string" && (value as any).type.includes("::matchmaking::Pending")) {
    return value;
  }
  const vec = (value as any)?.fields?.vec;
  const contents = vec?.fields?.contents ?? vec ?? (value as any)?.fields?.contents;
  return Array.isArray(contents) && contents.length > 0 ? contents[0] : null;
}

async function createExpressProofServer(input: {
  client: SuiClient;
  signer: Ed25519Keypair;
  fifthMoveConfigId: string;
  expectedUtilityCoin: string;
  wallet: string;
}): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/tree-power/fifth-move-attestation",
    createFifthMoveAttestationHandler({
      getSigner: () => input.signer,
      getEligibility: async (wallet) => ({
        wallet,
        status: "qualified",
        thresholdRaw: THRESHOLD_RAW,
        totalVerifiedUnderlyingTreeRaw: "2500000000000",
        verifiedUnderlyingTreeRaw: "2500000000000",
        remainingTreeRaw: "0",
        checkedAt: new Date().toISOString(),
        sources: [
          {
            source: "suidex-v3",
            status: "qualified-data",
            underlyingTreeRaw: "2500000000000",
            reason: "phase-2b-localnet-injected-qualified",
          },
        ],
      } satisfies FifthMoveEligibilityResponse),
      readConfig: async (serverSignerPublicKey) => {
        const fields = await readFields(input.client, input.fifthMoveConfigId);
        const signerPublicKey = parseMoveU8Vector(fields.signer_public_key);
        assert.deepEqual(Array.from(serverSignerPublicKey), Array.from(input.signer.getPublicKey().toRawBytes()));
        if (!signerPublicKey) throw new Error("local_config_signer_missing");
        return {
          id: input.fifthMoveConfigId.toLowerCase(),
          enabled: fields.enabled === true,
          utilityCoin: parseMoveTypeName(fields.utility_coin) ?? "",
          minUnderlyingTreeRaw: parseMoveU64(fields.min_underlying_tree_raw) ?? "0",
          signerPublicKey,
          configVersion: parseMoveU64(fields.config_version) ?? "0",
          maxAttestationAgeMs: parseMoveU64(fields.max_attestation_age_ms) ?? "0",
        };
      },
      expectedUtilityCoin: input.expectedUtilityCoin,
      checkRateLimit: () => true,
      ttlMs: 60_000,
      keyId: "phase-2b-localnet",
    }),
  );
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function requestProof(baseUrl: string, wallet: string): Promise<{ proof: FifthMoveProof; body: any; verified: boolean; status: number }> {
  const response = await fetch(`${baseUrl}/api/tree-power/fifth-move-attestation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, `proof_endpoint_status:${response.status}:${body?.reason ?? "unknown"}`);
  assert.ok(body.attestation);
  const payloadBytes = serializeFifthMoveAttestationPayload(body.attestation.payload);
  assert.deepEqual(decodeBase64Bytes(body.attestation.payloadBytes), Array.from(payloadBytes));
  const verified = await new Ed25519PublicKey(fromBase64(body.attestation.signerPublicKey)).verify(
    payloadBytes,
    fromBase64(body.attestation.signature),
  );
  return {
    body,
    verified,
    status: response.status,
    proof: {
      payload: body.attestation.payload,
      signatureBytes: Array.from(fromBase64(body.attestation.signature)),
    },
  };
}

async function setupLocalObjects(input: {
  client: SuiClient;
  admin: Ed25519Keypair;
  player1: Ed25519Keypair;
  player2: Ed25519Keypair;
  signerPublicKey: Uint8Array;
  tempDir: string;
}): Promise<{ objects: LocalObjects; transactions: string[]; fixturePublish: string; gardenPublish: string }> {
  const fixtureDir = path.join(input.tempDir, "local-fixtures");
  const gardenDir = path.join(input.tempDir, "garden-battles-package");
  await writeFixturePackage(fixtureDir);
  await cp(SOURCE_PACKAGE_DIR, gardenDir, {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}build${path.sep}`),
  });

  const fixture = await publishPackage(input.client, input.admin, fixtureDir);
  const garden = await publishPackage(input.client, input.admin, gardenDir);
  const fixtureMintCapId = findCreated(fixture.created, "::test_nft::MintCap");
  const configId = findCreated(garden.created, "::config::Config");
  const gardenMintCapId = findCreated(garden.created, "::nft::MintCap");
  void gardenMintCapId;

  const setupDigests: string[] = [];
  const fixtureNftType = `${fixture.packageId}::test_nft::TestNFT`;
  const localTreeType = `${fixture.packageId}::tree::TREE`;

  const setup = new Transaction();
  setup.moveCall({
    target: `${garden.packageId}::config::set_economics`,
    arguments: [
      setup.object(configId),
      setup.pure.u64(ENTRY_FEE_MIST),
      setup.pure.u64(WINNER_PAYOUT_MIST),
      setup.pure.u64(TREASURY_SHARE_MIST),
    ],
  });
  setup.moveCall({
    target: `${garden.packageId}::config::whitelist_collection`,
    typeArguments: [fixtureNftType],
    arguments: [setup.object(configId)],
  });
  setup.moveCall({
    target: `${garden.packageId}::fifth_move::init_fifth_move_config`,
    typeArguments: [localTreeType],
    arguments: [
      setup.pure.vector("u8", Array.from(input.signerPublicKey)),
      setup.pure.u64(120_000),
    ],
  });
  setup.moveCall({
    target: `${garden.packageId}::matchmaking::create_queue_v3`,
    arguments: [setup.object(configId), setup.pure.u64(50)],
  });
  const setupResult = await execute(input.client, input.admin, setup);
  setupDigests.push(setupResult.digest);
  const fifthMoveConfigId = setupResult.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::fifth_move::FifthMoveConfig"),
  )?.objectId;
  const queue50Id = setupResult.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::matchmaking::MatchmakingQueueV3"),
  )?.objectId;
  if (!fifthMoveConfigId || !queue50Id) throw new Error("setup_objects_not_created");

  const enable = new Transaction();
  enable.moveCall({
    target: `${garden.packageId}::fifth_move::set_enabled`,
    arguments: [enable.object(fifthMoveConfigId), enable.pure.bool(true)],
  });
  setupDigests.push((await execute(input.client, input.admin, enable)).digest);

  async function mintNft(recipient: string): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: `${fixture.packageId}::test_nft::mint`,
      arguments: [tx.object(fixtureMintCapId), tx.pure.address(recipient)],
    });
    const result = await execute(input.client, input.admin, tx);
    const nft = result.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType === fixtureNftType,
    )?.objectId;
    if (!nft) throw new Error("test_nft_not_minted");
    setupDigests.push(result.digest);
    return nft;
  }

  return {
    fixturePublish: fixture.digest,
    gardenPublish: garden.digest,
    transactions: setupDigests,
    objects: {
      fixturePackageId: fixture.packageId,
      fixtureMintCapId,
      gardenPackageId: garden.packageId,
      configId,
      fifthMoveConfigId,
      queue50Id,
      player1NftId: await mintNft(input.player1.getPublicKey().toSuiAddress()),
      player2NftId: await mintNft(input.player2.getPublicKey().toSuiAddress()),
      refundNftId: await mintNft(input.player1.getPublicKey().toSuiAddress()),
    },
  };
}

function tamperProof(proof: FifthMoveProof): FifthMoveProof {
  return {
    signatureBytes: proof.signatureBytes,
    payload: {
      ...proof.payload,
      verified_underlying_tree_raw: "2500000000001",
    },
  };
}

async function main() {
  const outputDir = process.env.PHASE_2B_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  await mkdir(outputDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(outputDir, "tmp-"));
  const networkDir = path.join(tempDir, "sui-network");
  await mkdir(networkDir, { recursive: true });
  let localnet: ChildProcessWithoutNullStreams | null = null;
  let server: Server | null = null;
  const report: Report = {
    generatedAt: new Date().toISOString(),
    suiVersion: await readSuiVersion(),
    localChainIdentifier: "",
    localPublicAddresses: { admin: "", player1: "", player2: "" },
    ephemeralSignerPublicKey: "",
    localObjects: {},
    httpProof: { ok: false, bcsBytesVerified: false, rawSignatureVerified: false },
    transactions: {},
    battle: {},
    queue: {},
    cleanup: { localnetStopped: false, tempDirRemoved: false, secretMaterialPersisted: false },
  };

  try {
    if (PUBLIC_RPC_URLS.has(LOCAL_RPC_URL) || !isLoopbackRpcUrl(LOCAL_RPC_URL)) {
      throw new Error("refusing_non_local_rpc");
    }
    await prepareLocalnetConfig(networkDir);
    localnet = startLocalnet(networkDir, outputDir);
    const client = new SuiClient({ url: LOCAL_RPC_URL });
    const chainIdentifier = await waitForRpc(client);
    report.localChainIdentifier = chainIdentifier;
    console.log("LOCALNET SAFETY CHECK PASSED");

    const admin = Ed25519Keypair.generate();
    const player1 = Ed25519Keypair.generate();
    const player2 = Ed25519Keypair.generate();
    const attestationSigner = Ed25519Keypair.generate();
    report.localPublicAddresses = {
      admin: admin.getPublicKey().toSuiAddress(),
      player1: player1.getPublicKey().toSuiAddress(),
      player2: player2.getPublicKey().toSuiAddress(),
    };
    report.ephemeralSignerPublicKey = attestationSigner.getPublicKey().toBase64();

    await fundAccount(client, report.localPublicAddresses.admin);
    await fundAccount(client, report.localPublicAddresses.player1);
    await fundAccount(client, report.localPublicAddresses.player2);

    const setup = await setupLocalObjects({
      client,
      admin,
      player1,
      player2,
      signerPublicKey: attestationSigner.getPublicKey().toRawBytes(),
      tempDir,
    });
    report.localObjects = setup.objects;
    report.transactions.fixturePublish = setup.fixturePublish;
    report.transactions.gardenPublish = setup.gardenPublish;
    report.transactions.setup = setup.transactions;

    const localFifthConfigFields = await readFields(client, setup.objects.fifthMoveConfigId);
    const localTreeType = parseMoveTypeName(localFifthConfigFields.utility_coin) ?? "";
    assert.match(localTreeType, /::tree::TREE$/);
    const proofServer = await createExpressProofServer({
      client,
      signer: attestationSigner,
      fifthMoveConfigId: setup.objects.fifthMoveConfigId,
      expectedUtilityCoin: localTreeType,
      wallet: report.localPublicAddresses.player1,
    });
    server = proofServer.server;
    const proofResult = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player1);
    report.httpProof = {
      ok: true,
      bcsBytesVerified: true,
      rawSignatureVerified: proofResult.verified,
      fifthMoveConfigId: proofResult.body.attestation.fifthMoveConfigId,
    };
    assert.equal(proofResult.verified, true);

    const nftType = `${setup.objects.fixturePackageId}::test_nft::TestNFT`;
    const qualifiedTx = buildDirectPvpJoinTransaction({
      packageId: setup.objects.gardenPackageId,
      configId: setup.objects.configId,
      fifthMoveConfigId: setup.objects.fifthMoveConfigId,
      queueId: setup.objects.queue50Id,
      nftId: setup.objects.player1NftId,
      nftType,
      queueType: "v3",
      entryFeeMist: ENTRY_FEE_MIST,
      randomObjectId: RANDOM_ID,
      sender: report.localPublicAddresses.player1,
      fifthMoveProof: proofResult.proof,
    }).tx;
    report.transactions.qualifiedJoin = (await execute(client, player1, qualifiedTx)).digest;

    const standardTx = buildDirectPvpJoinTransaction({
      packageId: setup.objects.gardenPackageId,
      configId: setup.objects.configId,
      queueId: setup.objects.queue50Id,
      nftId: setup.objects.player2NftId,
      nftType,
      queueType: "v3",
      entryFeeMist: ENTRY_FEE_MIST,
      randomObjectId: RANDOM_ID,
      sender: report.localPublicAddresses.player2,
      fifthMoveProof: null,
    }).tx;
    const standardResult = await execute(client, player2, standardTx);
    report.transactions.standardJoin = standardResult.digest;

    const battleId = standardResult.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType?.endsWith("::battle::PvpBattleV3"),
    )?.objectId;
    if (!battleId) throw new Error("pvp_battle_v3_not_created");
    report.battle.battleId = battleId;
    const battleFields = await readFields(client, battleId);
    const p1Moves = vectorValues(battleFields.p1_moves);
    const p2Moves = vectorValues(battleFields.p2_moves);
    report.battle = {
      ...report.battle,
      targetGrowth: String(battleFields.target_growth),
      p1MoveCount: p1Moves.length,
      p2MoveCount: p2Moves.length,
      p1UniqueMoves: new Set(p1Moves).size === p1Moves.length,
      move8Absent: !p1Moves.includes(8) && !p2Moves.includes(8),
      p1Entitled: battleFields.p1_fifth_move_entitled === true,
      p2Entitled: battleFields.p2_fifth_move_entitled === true,
      vaultMist: balanceValue(battleFields.vault),
      vaultFieldShape: JSON.stringify(battleFields.vault),
    };
    assert.equal(report.battle.targetGrowth, "50");
    assert.equal(report.battle.p1MoveCount, 5);
    assert.equal(report.battle.p2MoveCount, 4);
    assert.equal(report.battle.p1UniqueMoves, true);
    assert.equal(report.battle.move8Absent, true);
    assert.equal(report.battle.p1Entitled, true);
    assert.equal(report.battle.p2Entitled, false);
    assert.equal(report.battle.vaultMist, String(ENTRY_FEE_MIST * 2n));

    const queueAfterMatch = await readFields(client, setup.objects.queue50Id);
    report.queue.waitingClearedAfterMatch = optionSome(queueAfterMatch.waiting) === null;
    report.queue.bankMistAfterMatch = balanceValue(queueAfterMatch.bank);
    assert.equal(report.queue.waitingClearedAfterMatch, true);
    assert.equal(report.queue.bankMistAfterMatch, "0");

    const tampered = buildDirectPvpJoinTransaction({
      packageId: setup.objects.gardenPackageId,
      configId: setup.objects.configId,
      fifthMoveConfigId: setup.objects.fifthMoveConfigId,
      queueId: setup.objects.queue50Id,
      nftId: setup.objects.player1NftId,
      nftType,
      queueType: "v3",
      entryFeeMist: ENTRY_FEE_MIST,
      randomObjectId: RANDOM_ID,
      sender: report.localPublicAddresses.player1,
      fifthMoveProof: tamperProof(proofResult.proof),
    }).tx;
    const tamperedResult = await execute(client, player1, tampered, { allowFailure: true });
    report.transactions.tamperedProof = tamperedResult.digest;
    assert.equal(tamperedResult.effects?.status?.status, "failure");
    const queueAfterTamper = await readFields(client, setup.objects.queue50Id);
    assert.equal(optionSome(queueAfterTamper.waiting), null);
    assert.equal(balanceValue(queueAfterTamper.bank), "0");

    const refundJoin = buildDirectPvpJoinTransaction({
      packageId: setup.objects.gardenPackageId,
      configId: setup.objects.configId,
      fifthMoveConfigId: setup.objects.fifthMoveConfigId,
      queueId: setup.objects.queue50Id,
      nftId: setup.objects.refundNftId,
      nftType,
      queueType: "v3",
      entryFeeMist: ENTRY_FEE_MIST,
      randomObjectId: RANDOM_ID,
      sender: report.localPublicAddresses.player1,
      fifthMoveProof: proofResult.proof,
    }).tx;
    report.transactions.refundJoin = (await execute(client, player1, refundJoin)).digest;
    const queueBeforeRefund = await readFields(client, setup.objects.queue50Id);
    report.queue.waitingBeforeRefundShape = JSON.stringify(queueBeforeRefund.waiting);
    report.queue.bankMistBeforeRefund = balanceValue(queueBeforeRefund.bank);
    assert.notEqual(optionSome(queueBeforeRefund.waiting), null);
    assert.equal(balanceValue(queueBeforeRefund.bank), String(ENTRY_FEE_MIST));

    const refund = new Transaction();
    refund.moveCall({
      target: `${setup.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
      arguments: [refund.object(setup.objects.queue50Id)],
    });
    report.transactions.refund = (await execute(client, player1, refund)).digest;
    const queueAfterRefund = await readFields(client, setup.objects.queue50Id);
    report.queue.waitingClearedAfterRefund = optionSome(queueAfterRefund.waiting) === null;
    report.queue.bankMistAfterRefund = balanceValue(queueAfterRefund.bank);
    assert.equal(report.queue.waitingClearedAfterRefund, true);
    assert.equal(report.queue.bankMistAfterRefund, "0");
  } finally {
    if (server) {
      server.close();
      await once(server, "close").catch(() => undefined);
    }
    report.cleanup.localnetStopped = await stopLocalnet(localnet).catch(() => false);
    await rm(tempDir, { recursive: true, force: true }).then(
      () => { report.cleanup.tempDirRemoved = true; },
      () => { report.cleanup.tempDirRemoved = false; },
    );
    report.cleanup.secretMaterialPersisted = false;
    const reportPath = path.join(outputDir, `phase-2b1-localnet-${Date.now()}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Sanitized Phase 2B.1 report written to ${reportPath}`);
  }
}

main().catch((err) => {
  console.error("[phase-2b1-localnet] failed", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
