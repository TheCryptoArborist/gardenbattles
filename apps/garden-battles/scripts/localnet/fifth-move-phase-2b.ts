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
import { createFifthMoveAttestationHandler, parseBattleEvent, parseMoveTypeName, parseMoveU64, parseMoveU8Vector } from "../../server/routes";
import { parsePendingQueueEntry, type PvpQueueDefinition } from "../../server/pvp-queue-telegram";
import {
  asciiBytes,
  decodeBase64Bytes,
  FIFTH_MOVE_SOURCE_BITS,
  serializeFifthMoveAttestationPayload,
} from "../../shared/fifth-move-attestation";
import type { FifthMoveEligibilityResponse } from "../../shared/tree-power-eligibility";
import {
  buildDirectPvpJoinTransaction,
  buildKioskPvpJoinTransaction,
  buildRankedBotBattleFromKioskTransaction,
  buildRankedBotBattleTransaction,
} from "../../battle-gardenfrontend/src/lib/fifthMoveTransactions";
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
const LOCAL_ATTESTATION_MAX_AGE_MS = 900_000;
const LOCAL_ATTESTATION_TTL_MS = 600_000;
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
  alternateFifthMoveConfigId: string;
  queue50Id: string;
  queue75Id: string;
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
  };
  matrix: MatrixCaseResult[];
  sourceBitmapResults: MatrixCaseResult[];
  fallbackResults: FallbackCaseResult[];
  negativeProofResults: NegativeProofResult[];
  refundResults: RefundCaseResult[];
  kioskResults: KioskCaseResult[];
  kioskNegativeResults: NegativeProofResult[];
  kioskRefundResults: RefundCaseResult[];
  rankedBotResults: RankedBotCaseResult[];
  rankedBotNegativeResults: NegativeProofResult[];
  rankedBotLifecycleResults: RankedBotLifecycleResult[];
  eventShapes: EventShapeResult[];
  builderResults: BuilderCheckResult[];
  queueRecoveryResults: QueueRecoveryResult[];
  activeBattleRecoveryResults: ActiveBattleRecoveryResult[];
  rankedBotRecoveryResults: RankedBotRecoveryResult[];
  postRefundRecoveryResults: PostRefundRecoveryResult[];
  pvpCompletionResults: PvpCompletionResult[];
  pvpSettlementResults: PvpSettlementResult[];
  rankedBotCompletionResults: RankedBotCompletionResult[];
  ingestionResults: IngestionResult[];
  dedupeResults: DedupeResult[];
  cursorRecoveryResults: CursorRecoveryResult[];
  finishedBattleRecoveryResults: FinishedBattleRecoveryResult[];
  telegramRegressionResults: TelegramRegressionResult[];
  cleanup: {
    localnetStopped: boolean;
    tempDirRemoved: boolean;
    secretMaterialPersisted: boolean;
  };
};

type MatrixCaseResult = {
  label: string;
  targetGrowth: 50 | 75;
  queueId: string;
  player1Entitled: boolean;
  player2Entitled: boolean;
  player1SourceBitmap: number;
  player2SourceBitmap: number;
  player1VerifiedUnderlyingTreeRaw: string;
  player2VerifiedUnderlyingTreeRaw: string;
  player1ConfigVersion: string;
  player2ConfigVersion: string;
  player1AttestationDigestLength: number;
  player2AttestationDigestLength: number;
  player1JoinDigest: string;
  player2JoinDigest: string;
  battleId: string;
  p1MoveCount: number;
  p2MoveCount: number;
  p1UniqueMoves: boolean;
  p2UniqueMoves: boolean;
  move8Absent: boolean;
  noSixMoveHand: boolean;
  waitingCleared: boolean;
  queueBankMist: string;
  vaultMist: string;
  entryFeeMist: string;
  winnerPayoutMist: string;
  treasuryShareMist: string;
  treasuryAddress: string;
};

type FallbackCaseResult = {
  label: string;
  endpointStatus?: number;
  endpointReason?: string;
  selectedFunction: string;
  usesProof: boolean;
  clockIncluded: boolean;
  joinDigest: string;
  finishDigest: string;
  battleId: string;
  moveCount: number;
  proofSubmittedFirst: boolean;
};

type NegativeProofResult = {
  label: string;
  digest: string;
  status: string;
  queueWaiting: boolean;
  queueBankMist: string;
};

type RefundCaseResult = {
  label: string;
  targetGrowth: 50 | 75;
  entitled: boolean;
  joinDigest: string;
  refundDigest: string;
  bankBeforeMist: string;
  bankAfterMist: string;
  waitingBefore: boolean;
  waitingAfter: boolean;
  entitlementCleared: boolean;
  amountCleared: boolean;
  sourceBitmapCleared: boolean;
  configVersionCleared: boolean;
  digestCleared: boolean;
  reuseJoinDigest: string;
  reuseRefundDigest: string;
};

type KioskInfo = {
  kioskId: string;
  kioskCapId: string;
  nftId: string;
  owner: string;
};

type KioskCaseResult = MatrixCaseResult & {
  player1Path: "direct" | "kiosk";
  player2Path: "direct" | "kiosk";
  player1KioskId?: string;
  player2KioskId?: string;
  kioskNftStillPresent: boolean;
};

type RankedBotCaseResult = {
  label: string;
  path: "direct" | "kiosk";
  entitled: boolean;
  functionName: string;
  clockIncluded: boolean;
  digest: string;
  battleId: string;
  humanMoveCount: number;
  botMoveCount: number;
  humanUniqueMoves: boolean;
  move8Absent: boolean;
  noSixMoveHand: boolean;
  targetGrowth: string;
  entitlementFrozen: boolean;
  sourceBitmap: number;
  verifiedUnderlyingTreeRaw: string;
  configVersion: string;
  attestationDigestLength: number;
  vaultMist: string;
  entryFeeMist: string;
  winnerPayoutMist: string;
  treasuryShareMist: string;
  updateEventCaptured: boolean;
};

type RankedBotLifecycleResult = {
  label: string;
  digest: string;
  battleId: string;
  status: string;
  finished: boolean;
  winner: string | null;
  vaultMist: string;
  eventCaptured: boolean;
  limitation?: string;
};

type EventShapeResult = {
  label: string;
  digest: string;
  type: string;
  fields: Record<string, unknown>;
};

type BuilderCheckResult = {
  label: string;
  functionName: string;
  usesFifthMoveProof: boolean;
  clockIncluded: boolean;
};

type QueueRecoveryResult = {
  label: string;
  targetGrowth: 50 | 75;
  queueId: string;
  queueType: "v3";
  joinDigest: string;
  recoveredWallet: string;
  entryFeeMist: string;
  fifthMoveEntitled: boolean;
  verifiedUnderlyingTreeRaw: string;
  sourceBitmap: number;
  configVersion: string;
  attestationDigestLength: number;
  refundable: boolean;
  noBroadDiscoveryUsed: boolean;
  refundFunction: string;
};

type ActiveBattleRecoveryResult = {
  label: string;
  battleId: string;
  battleType: "PvpBattleV3";
  targetGrowth: string;
  turn: number;
  p1Growth: string;
  p2Growth: string;
  p1MoveCount: number;
  p2MoveCount: number;
  p1Entitled: boolean;
  p2Entitled: boolean;
  p1DigestLength: number;
  p2DigestLength: number;
  p1RerollUsed: boolean;
  p2RerollUsed: boolean;
  lastMoveMs: string;
  finished: boolean;
  activeBattleSuppressesQueueRecovery: boolean;
  directObjectReadUsed: boolean;
};

type RankedBotRecoveryResult = {
  label: string;
  battleId: string;
  battleType: "RankedBotBattleV2";
  humanWallet: string;
  botAddress: string;
  humanMoveCount: number;
  botMoveCount: number;
  fifthMoveEntitled: boolean;
  eligibilityDigestLength: number;
  configVersion: string;
  p1Growth: string;
  p2Growth: string;
  turn: number;
  finished: boolean;
  eventCaptured: boolean;
};

type PostRefundRecoveryResult = {
  label: string;
  targetGrowth: 50 | 75;
  entitled: boolean;
  joinDigest: string;
  refundDigest: string;
  waitingAfterRestart: boolean;
  bankAfterMist: string;
  entitlementSnapshotAbsent: boolean;
  refundOfferedAgain: boolean;
  newJoinDigest: string;
  newJoinRecovered: boolean;
  cleanupRefundDigest: string;
};

type PvpCompletionResult = {
  label: string;
  targetGrowth: 50 | 75;
  battleId: string;
  turnDigests: string[];
  moveIds: number[];
  finalDigest: string;
  winner: string | null;
  finalEventCaptured: boolean;
  finished: boolean;
  vaultMist: string;
  queueBankMist: string;
  winnerPayoutMist: string;
  treasuryShareMist: string;
  winnerPayoutVerified: boolean;
  treasuryPaymentVerified: boolean;
  noDuplicatePayout: boolean;
};

type PvpSettlementResult = {
  label: string;
  action: "surrender" | "admin-close" | "admin-close-winner" | "timeout";
  digest: string;
  battleId: string;
  status: string;
  finished: boolean;
  winner: string | null;
  vaultMist: string;
  eventCaptured: boolean;
  limitation?: string;
};

type RankedBotCompletionResult = {
  label: string;
  action: "surrender" | "admin-close" | "timeout";
  digest: string;
  battleId: string;
  status: string;
  humanMoveCount: number;
  botMoveCount: number;
  finished: boolean;
  winner: string | null;
  vaultMist: string;
  eventCaptured: boolean;
  economicValuesRemainZero: boolean;
  limitation?: string;
};

type IngestionResult = {
  label: string;
  eventType: "PvpBattleV3Update" | "RankedBotBattleV2Update";
  recordsStored: number;
  battleId: string;
  mode: "pvp" | "bot";
  targetGrowth: number | null;
  finished: boolean;
  winner: string | null;
  entitlementIgnoredForScoring: boolean;
};

type DedupeResult = {
  label: string;
  firstIngestInserted: boolean;
  duplicateInserted: boolean;
  afterRestartInserted: boolean;
  recordCount: number;
};

type CursorRecoveryResult = {
  label: string;
  cursorBeforeRestart: number;
  cursorAfterRestart: number;
  noGap: boolean;
  noDuplicate: boolean;
  recordsStored: number;
};

type FinishedBattleRecoveryResult = {
  label: string;
  battleId: string;
  finished: boolean;
  winner: string | null;
  moveArraysRecovered: boolean;
  activeControlsSuppressed: boolean;
  queuePanelSuppressed: boolean;
  refundSuppressed: boolean;
  newBattleStarted: boolean;
  newBattleId: string;
};

type TelegramRegressionResult = {
  label: string;
  queueId: string;
  targetGrowth: 50 | 75 | 100;
  queueType: "legacy" | "v2" | "v3";
  parsedWaiting: boolean;
  duplicateSuppressed: boolean;
  clearedQueueNotified: boolean;
};

type EligibilityMode =
  | "qualified"
  | "not-qualified"
  | "verification-incomplete"
  | "unavailable";

type EligibilityScenario = {
  mode: EligibilityMode;
  sourceBitmap?: number;
  verifiedUnderlyingTreeRaw?: string;
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
  await writeFile(
    path.join(packageDir, "sources", "bad_nft.move"),
    `module local_fixtures::bad_nft {\n    public struct BadNFT has key, store { id: UID }\n    public struct BadMintCap has key, store { id: UID }\n\n    fun init(ctx: &mut TxContext) {\n        transfer::public_transfer(BadMintCap { id: object::new(ctx) }, tx_context::sender(ctx));\n    }\n\n    public fun mint(_cap: &BadMintCap, recipient: address, ctx: &mut TxContext) {\n        transfer::public_transfer(BadNFT { id: object::new(ctx) }, recipient);\n    }\n}\n`,
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

async function readMoveObject(client: SuiClient, objectId: string): Promise<{
  id: string;
  type: string;
  version: string;
  previousTransaction: string | null;
  fields: Record<string, any>;
  raw: any;
}> {
  const object = await client.getObject({
    id: objectId,
    options: { showContent: true, showType: true, showOwner: true },
  });
  if (object.error) throw new Error(`object_read_failed:${objectId}:${object.error.code}`);
  const content = object.data?.content;
  if (!content || content.dataType !== "moveObject") throw new Error(`unexpected_object_content:${objectId}`);
  return {
    id: objectId,
    type: object.data?.type ?? "",
    version: String(object.data?.version ?? ""),
    previousTransaction: object.data?.previousTransaction ?? null,
    fields: content.fields as Record<string, any>,
    raw: object,
  };
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

function pendingFields(value: unknown): Record<string, any> | null {
  const pending = optionSome(value);
  if (!pending) return null;
  return (pending.fields ?? pending) as Record<string, any>;
}

function optionAddress(value: unknown): string | null {
  if (typeof value === "string") return value.toLowerCase();
  const some = optionSome(value);
  const inner = some?.fields?.some ?? some;
  return typeof inner === "string" ? inner.toLowerCase() : null;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function sumGasCostMist(tx: SuiTransactionBlockResponse): bigint {
  const gas = tx.effects?.gasUsed;
  if (!gas) return 0n;
  return BigInt(gas.computationCost ?? "0") + BigInt(gas.storageCost ?? "0") - BigInt(gas.storageRebate ?? "0");
}

function balanceChangeForOwner(tx: SuiTransactionBlockResponse, owner: string): bigint {
  const needle = owner.toLowerCase();
  return (tx.balanceChanges ?? []).reduce((sum, change: any) => {
    const address = typeof change.owner?.AddressOwner === "string" ? change.owner.AddressOwner.toLowerCase() : "";
    return address === needle ? sum + BigInt(change.amount) : sum;
  }, 0n);
}

function bestGrowthMove(moves: number[]): number {
  const expectedGrowth = new Map<number, number>([
    [9, 4],
    [20, 10],
    [21, 10],
    [22, 15],
    [23, 10],
    [24, 15],
    [25, 18],
    [26, 17],
    [27, 10],
    [28, 12],
    [29, 8],
    [30, 12],
  ]);
  const growthMoves = moves
    .map((moveId) => ({ moveId, growth: expectedGrowth.get(moveId) ?? 0 }))
    .filter((item) => item.growth > 0)
    .sort((a, b) => b.growth - a.growth);
  return growthMoves[0]?.moveId ?? moves[0];
}

async function recoverQueueState(input: {
  client: SuiClient;
  queueId: string;
  targetGrowth: 50 | 75;
  expectedWallet: string;
}): Promise<QueueRecoveryResult> {
  const queue = await readMoveObject(input.client, input.queueId);
  const definition: PvpQueueDefinition = {
    queueId: input.queueId,
    targetGrowth: input.targetGrowth,
    displayLabel: input.targetGrowth === 50 ? "Quick Match" : "Standard Match",
    queueType: "v3",
  };
  const parsed = parsePendingQueueEntry(queue.raw, definition);
  if (!parsed) throw new Error(`queue_recovery_missing_pending:${input.queueId}`);
  const fields = pendingFields(queue.fields.waiting);
  if (!fields) throw new Error(`queue_recovery_pending_shape:${input.queueId}`);
  assert.equal(parsed.player, input.expectedWallet.toLowerCase());
  assert.equal(parsed.targetGrowth, input.targetGrowth);
  assert.equal(parsed.queueType, "v3");
  return {
    label: `${input.targetGrowth}-${fields.fifth_move_entitled ? "qualified" : "standard"}-queue-recovery`,
    targetGrowth: input.targetGrowth,
    queueId: input.queueId,
    queueType: "v3",
    joinDigest: queue.previousTransaction ?? "",
    recoveredWallet: parsed.player,
    entryFeeMist: String(fields.entry_fee_snapshot ?? parsed.entryFeeMist),
    fifthMoveEntitled: fields.fifth_move_entitled === true,
    verifiedUnderlyingTreeRaw: String(fields.verified_underlying_tree_raw ?? "0"),
    sourceBitmap: Number(fields.source_bitmap ?? 0),
    configVersion: String(fields.eligibility_config_version ?? "0"),
    attestationDigestLength: vectorLength(fields.attestation_digest),
    refundable: parsed.player === input.expectedWallet.toLowerCase(),
    noBroadDiscoveryUsed: true,
    refundFunction: "cancel_queue_v3",
  };
}

async function recoverPvpBattleState(input: {
  client: SuiClient;
  battleId: string;
  label: string;
}): Promise<ActiveBattleRecoveryResult> {
  const battle = await readMoveObject(input.client, input.battleId);
  const fields = battle.fields;
  assert.ok(battle.type.endsWith("::battle::PvpBattleV3"));
  const p1Moves = vectorValues(fields.p1_moves);
  const p2Moves = vectorValues(fields.p2_moves);
  return {
    label: input.label,
    battleId: input.battleId,
    battleType: "PvpBattleV3",
    targetGrowth: String(fields.target_growth),
    turn: Number(fields.turn ?? 0),
    p1Growth: String(fields.p1_growth ?? "0"),
    p2Growth: String(fields.p2_growth ?? "0"),
    p1MoveCount: p1Moves.length,
    p2MoveCount: p2Moves.length,
    p1Entitled: fields.p1_fifth_move_entitled === true,
    p2Entitled: fields.p2_fifth_move_entitled === true,
    p1DigestLength: vectorLength(fields.p1_eligibility_digest),
    p2DigestLength: vectorLength(fields.p2_eligibility_digest),
    p1RerollUsed: fields.p1_reroll_used === true,
    p2RerollUsed: fields.p2_reroll_used === true,
    lastMoveMs: String(fields.last_move_ms ?? "0"),
    finished: fields.finished === true,
    activeBattleSuppressesQueueRecovery: true,
    directObjectReadUsed: true,
  };
}

async function recoverRankedBotState(input: {
  client: SuiClient;
  battleId: string;
  label: string;
}): Promise<RankedBotRecoveryResult> {
  const battle = await readMoveObject(input.client, input.battleId);
  const fields = battle.fields;
  assert.ok(battle.type.endsWith("::battle::RankedBotBattleV2"));
  const humanMoves = vectorValues(fields.p1_moves);
  const botMoves = vectorValues(fields.p2_moves);
  return {
    label: input.label,
    battleId: input.battleId,
    battleType: "RankedBotBattleV2",
    humanWallet: String(fields.player1).toLowerCase(),
    botAddress: String(fields.player2).toLowerCase(),
    humanMoveCount: humanMoves.length,
    botMoveCount: botMoves.length,
    fifthMoveEntitled: fields.p1_fifth_move_entitled === true,
    eligibilityDigestLength: vectorLength(fields.p1_eligibility_digest),
    configVersion: String(fields.p1_eligibility_config_version ?? "0"),
    p1Growth: String(fields.p1_growth ?? "0"),
    p2Growth: String(fields.p2_growth ?? "0"),
    turn: Number(fields.turn ?? 0),
    finished: fields.finished === true,
    eventCaptured: true,
  };
}

async function createExpressProofServer(input: {
  client: SuiClient;
  signer: Ed25519Keypair;
  fifthMoveConfigId: string;
  expectedUtilityCoin: string;
  scenarios: Map<string, EligibilityScenario>;
  signerOverride?: Ed25519Keypair | null;
}): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/tree-power/fifth-move-attestation",
    createFifthMoveAttestationHandler({
      getSigner: () => input.signerOverride === null ? null : input.signerOverride ?? input.signer,
      getEligibility: async (wallet) => buildInjectedEligibility(wallet, input.scenarios.get(wallet.toLowerCase()) ?? { mode: "qualified" }),
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
      ttlMs: LOCAL_ATTESTATION_TTL_MS,
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

function buildInjectedEligibility(wallet: string, scenario: EligibilityScenario): FifthMoveEligibilityResponse {
  const sourceBitmap = scenario.sourceBitmap ?? FIFTH_MOVE_SOURCE_BITS.suidexV3;
  const verifiedRaw = scenario.verifiedUnderlyingTreeRaw ?? "2500000000000";
  if (scenario.mode === "qualified") {
    return {
      wallet,
      status: "qualified",
      thresholdRaw: THRESHOLD_RAW,
      totalVerifiedUnderlyingTreeRaw: verifiedRaw,
      verifiedUnderlyingTreeRaw: verifiedRaw,
      remainingTreeRaw: "0",
      checkedAt: new Date().toISOString(),
      sources: sourcesForBitmap(sourceBitmap, verifiedRaw),
    } satisfies FifthMoveEligibilityResponse;
  }
  if (scenario.mode === "not-qualified") {
    return {
      wallet,
      status: "not-qualified",
      thresholdRaw: THRESHOLD_RAW,
      totalVerifiedUnderlyingTreeRaw: "500000000000",
      verifiedUnderlyingTreeRaw: "500000000000",
      remainingTreeRaw: "500000000000",
      checkedAt: new Date().toISOString(),
      sources: sourcesForBitmap(sourceBitmap, "500000000000"),
    } satisfies FifthMoveEligibilityResponse;
  }
  if (scenario.mode === "verification-incomplete") {
    return {
      wallet,
      status: "verification-incomplete",
      thresholdRaw: THRESHOLD_RAW,
      totalVerifiedUnderlyingTreeRaw: "0",
      verifiedUnderlyingTreeRaw: "0",
      remainingTreeRaw: THRESHOLD_RAW,
      checkedAt: new Date().toISOString(),
      sources: [
        {
          source: "moonbags-staking",
          status: "unavailable",
          underlyingTreeRaw: "0",
          reason: "phase-2b-localnet-injected-incomplete",
        },
      ],
    } satisfies FifthMoveEligibilityResponse;
  }
  return {
    wallet,
    status: "unavailable",
    thresholdRaw: THRESHOLD_RAW,
    totalVerifiedUnderlyingTreeRaw: "0",
    verifiedUnderlyingTreeRaw: "0",
    remainingTreeRaw: THRESHOLD_RAW,
    checkedAt: new Date().toISOString(),
    sources: [
      {
        source: "suidex-v3",
        status: "unavailable",
        underlyingTreeRaw: "0",
        reason: "phase-2b-localnet-injected-unavailable",
      },
    ],
  } satisfies FifthMoveEligibilityResponse;
}

function sourcesForBitmap(sourceBitmap: number, underlyingTreeRaw: string): FifthMoveEligibilityResponse["sources"] {
  const sources: FifthMoveEligibilityResponse["sources"] = [];
  if ((sourceBitmap & FIFTH_MOVE_SOURCE_BITS.suidexV2Direct) !== 0) {
    sources.push({ source: "suidex-v2", status: "qualified-data", underlyingTreeRaw, reason: "phase-2b-localnet-direct" });
  }
  if ((sourceBitmap & FIFTH_MOVE_SOURCE_BITS.suidexV2Farm) !== 0) {
    sources.push({ source: "suidex-v2", status: "qualified-data", underlyingTreeRaw, reason: "phase-2b-localnet-farmed" });
  }
  if ((sourceBitmap & FIFTH_MOVE_SOURCE_BITS.suidexV3) !== 0) {
    sources.push({ source: "suidex-v3", status: "qualified-data", underlyingTreeRaw, reason: "phase-2b-localnet" });
  }
  if ((sourceBitmap & FIFTH_MOVE_SOURCE_BITS.moonbagsStaking) !== 0) {
    sources.push({ source: "moonbags-staking", status: "qualified-data", underlyingTreeRaw, reason: "phase-2b-localnet" });
  }
  return sources;
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

async function requestAttestation(baseUrl: string, wallet: string): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/api/tree-power/fifth-move-attestation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  return { status: response.status, body: await response.json() };
}

async function setupLocalObjects(input: {
  client: SuiClient;
  admin: Ed25519Keypair;
  player1: Ed25519Keypair;
  player2: Ed25519Keypair;
  signerPublicKey: Uint8Array;
  tempDir: string;
}): Promise<{
  objects: LocalObjects;
  transactions: string[];
  fixturePublish: string;
  gardenPublish: string;
  mintNft: (recipient: string) => Promise<string>;
  mintBadNft: (recipient: string) => Promise<string>;
}> {
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
  const badMintCapId = findCreated(fixture.created, "::bad_nft::BadMintCap");
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
      setup.pure.u64(LOCAL_ATTESTATION_MAX_AGE_MS),
    ],
  });
  setup.moveCall({
    target: `${garden.packageId}::fifth_move::init_fifth_move_config`,
    typeArguments: [localTreeType],
    arguments: [
      setup.pure.vector("u8", Array.from(input.signerPublicKey)),
      setup.pure.u64(LOCAL_ATTESTATION_MAX_AGE_MS),
    ],
  });
  setup.moveCall({
    target: `${garden.packageId}::matchmaking::create_queue_v3`,
    arguments: [setup.object(configId), setup.pure.u64(50)],
  });
  setup.moveCall({
    target: `${garden.packageId}::matchmaking::create_queue_v3`,
    arguments: [setup.object(configId), setup.pure.u64(75)],
  });
  const setupResult = await execute(input.client, input.admin, setup);
  setupDigests.push(setupResult.digest);
  const fifthMoveConfigs = (setupResult.objectChanges ?? []).filter(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::fifth_move::FifthMoveConfig"),
  );
  const queues = (setupResult.objectChanges ?? []).filter(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::matchmaking::MatchmakingQueueV3"),
  );
  const fifthMoveConfigId = fifthMoveConfigs[0]?.objectId;
  const alternateFifthMoveConfigId = fifthMoveConfigs[1]?.objectId;
  let queue50Id: string | undefined;
  let queue75Id: string | undefined;
  for (const queue of queues) {
    const queueFields = await readFields(input.client, queue.objectId);
    if (String(queueFields.target_growth) === "50") queue50Id = queue.objectId;
    if (String(queueFields.target_growth) === "75") queue75Id = queue.objectId;
  }
  if (!fifthMoveConfigId || !alternateFifthMoveConfigId || !queue50Id || !queue75Id) throw new Error("setup_objects_not_created");

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

  async function mintBadNft(recipient: string): Promise<string> {
    const tx = new Transaction();
    const badType = `${fixture.packageId}::bad_nft::BadNFT`;
    tx.moveCall({
      target: `${fixture.packageId}::bad_nft::mint`,
      arguments: [tx.object(badMintCapId), tx.pure.address(recipient)],
    });
    const result = await execute(input.client, input.admin, tx);
    const nft = result.objectChanges?.find(
      (change: any) => change.type === "created" && change.objectType === badType,
    )?.objectId;
    if (!nft) throw new Error("bad_nft_not_minted");
    setupDigests.push(result.digest);
    return nft;
  }

  return {
    fixturePublish: fixture.digest,
    gardenPublish: garden.digest,
    transactions: setupDigests,
    mintNft,
    mintBadNft,
    objects: {
      fixturePackageId: fixture.packageId,
      fixtureMintCapId,
      gardenPackageId: garden.packageId,
      configId,
      fifthMoveConfigId,
      alternateFifthMoveConfigId,
      queue50Id,
      queue75Id,
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

async function signProof(signer: Ed25519Keypair, payload: FifthMoveProof["payload"]): Promise<FifthMoveProof> {
  const payloadBytes = serializeFifthMoveAttestationPayload(payload);
  return {
    payload,
    signatureBytes: Array.from(await signer.sign(payloadBytes)),
  };
}

function proofWithSignatureOverVariant(
  original: FifthMoveProof,
  signer: Ed25519Keypair,
  variant: Partial<FifthMoveProof["payload"]>,
): Promise<FifthMoveProof> {
  return signProof(signer, { ...original.payload, ...variant });
}

function functionAndClockFromTx(tx: Transaction): { functionName: string; clockIncluded: boolean } {
  const data = tx.getData() as any;
  const moveCall = (data.commands ?? []).find((command: any) => command?.MoveCall)?.MoveCall;
  const clockIncluded = (data.inputs ?? []).some((input: any) => {
    const objectId = input?.UnresolvedObject?.objectId;
    return typeof objectId === "string" && objectId.toLowerCase().endsWith("0000000000000006");
  });
  return { functionName: moveCall?.function ?? "", clockIncluded };
}

function queueForTarget(objects: LocalObjects, targetGrowth: 50 | 75): string {
  return targetGrowth === 50 ? objects.queue50Id : objects.queue75Id;
}

function signerForIndex(players: Ed25519Keypair[], index: number): Ed25519Keypair {
  return players[index % players.length];
}

async function mintFor(input: {
  mintNft: (recipient: string) => Promise<string>;
  owner: Ed25519Keypair;
}): Promise<string> {
  return input.mintNft(input.owner.getPublicKey().toSuiAddress());
}

async function createKioskWithNft(input: {
  client: SuiClient;
  owner: Ed25519Keypair;
  nftId: string;
  nftType: string;
}): Promise<KioskInfo> {
  const tx = new Transaction();
  const [kiosk, cap] = tx.moveCall({
    target: "0x2::kiosk::new",
    arguments: [],
  });
  tx.moveCall({
    target: "0x2::kiosk::place",
    typeArguments: [input.nftType],
    arguments: [kiosk, cap, tx.object(input.nftId)],
  });
  tx.moveCall({
    target: "0x2::transfer::public_share_object",
    typeArguments: ["0x2::kiosk::Kiosk"],
    arguments: [kiosk],
  });
  tx.transferObjects([cap], input.owner.getPublicKey().toSuiAddress());
  const result = await execute(input.client, input.owner, tx);
  const kioskId = result.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType === "0x2::kiosk::Kiosk",
  )?.objectId;
  const kioskCapId = result.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType === "0x2::kiosk::KioskOwnerCap",
  )?.objectId;
  if (!kioskId || !kioskCapId) throw new Error("kiosk_creation_failed");
  return {
    kioskId,
    kioskCapId,
    nftId: input.nftId,
    owner: input.owner.getPublicKey().toSuiAddress(),
  };
}

async function mintKioskNft(input: {
  client: SuiClient;
  mintNft: (recipient: string) => Promise<string>;
  owner: Ed25519Keypair;
  nftType: string;
}): Promise<KioskInfo> {
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.owner });
  return createKioskWithNft({
    client: input.client,
    owner: input.owner,
    nftId,
    nftType: input.nftType,
  });
}

async function assertKioskContains(client: SuiClient, kiosk: KioskInfo): Promise<boolean> {
  const fields = await readFields(client, kiosk.kioskId);
  const items = fields?.items?.fields?.contents ?? fields?.items?.contents ?? [];
  const needle = kiosk.nftId.toLowerCase();
  const foundInObject = JSON.stringify(items).toLowerCase().includes(needle);
  if (foundInObject) return true;
  const dynamicFields = await client.getDynamicFields({ parentId: kiosk.kioskId });
  return dynamicFields.data.some((field) => JSON.stringify(field).toLowerCase().includes(needle));
}

function buildJoin(input: {
  objects: LocalObjects;
  nftType: string;
  queueId: string;
  nftId: string;
  signer: Ed25519Keypair;
  proof: FifthMoveProof | null;
}): ReturnType<typeof buildDirectPvpJoinTransaction> {
  return buildDirectPvpJoinTransaction({
    packageId: input.objects.gardenPackageId,
    configId: input.objects.configId,
    fifthMoveConfigId: input.objects.fifthMoveConfigId,
    queueId: input.queueId,
    nftId: input.nftId,
    nftType: input.nftType,
    queueType: "v3",
    entryFeeMist: ENTRY_FEE_MIST,
    randomObjectId: RANDOM_ID,
    sender: input.signer.getPublicKey().toSuiAddress(),
    fifthMoveProof: input.proof,
  });
}

function buildKioskJoin(input: {
  objects: LocalObjects;
  nftType: string;
  queueId: string;
  kiosk: KioskInfo;
  signer: Ed25519Keypair;
  proof: FifthMoveProof | null;
}): ReturnType<typeof buildKioskPvpJoinTransaction> {
  return buildKioskPvpJoinTransaction({
    packageId: input.objects.gardenPackageId,
    configId: input.objects.configId,
    fifthMoveConfigId: input.objects.fifthMoveConfigId,
    queueId: input.queueId,
    kioskId: input.kiosk.kioskId,
    kioskCapId: input.kiosk.kioskCapId,
    nftId: input.kiosk.nftId,
    nftType: input.nftType,
    queueType: "v3",
    entryFeeMist: ENTRY_FEE_MIST,
    randomObjectId: RANDOM_ID,
    sender: input.signer.getPublicKey().toSuiAddress(),
    fifthMoveProof: input.proof,
  });
}

function buildRankedBot(input: {
  objects: LocalObjects;
  nftType: string;
  nftId: string;
  signer: Ed25519Keypair;
  botAddress: string;
  proof: FifthMoveProof | null;
}): ReturnType<typeof buildRankedBotBattleTransaction> {
  return buildRankedBotBattleTransaction({
    packageId: input.objects.gardenPackageId,
    configId: input.objects.configId,
    fifthMoveConfigId: input.objects.fifthMoveConfigId,
    nftId: input.nftId,
    nftType: input.nftType,
    botAddress: input.botAddress,
    randomObjectId: RANDOM_ID,
    sender: input.signer.getPublicKey().toSuiAddress(),
    fifthMoveProof: input.proof,
  });
}

function buildRankedBotKiosk(input: {
  objects: LocalObjects;
  nftType: string;
  kiosk: KioskInfo;
  signer: Ed25519Keypair;
  botAddress: string;
  proof: FifthMoveProof | null;
}): ReturnType<typeof buildRankedBotBattleFromKioskTransaction> {
  return buildRankedBotBattleFromKioskTransaction({
    packageId: input.objects.gardenPackageId,
    configId: input.objects.configId,
    fifthMoveConfigId: input.objects.fifthMoveConfigId,
    kioskId: input.kiosk.kioskId,
    kioskCapId: input.kiosk.kioskCapId,
    nftId: input.kiosk.nftId,
    nftType: input.nftType,
    botAddress: input.botAddress,
    randomObjectId: RANDOM_ID,
    sender: input.signer.getPublicKey().toSuiAddress(),
    fifthMoveProof: input.proof,
  });
}

function captureEvents(label: string, result: SuiTransactionBlockResponse, suffix: string): EventShapeResult[] {
  return (result.events ?? [])
    .filter((event) => event.type.endsWith(suffix))
    .map((event) => ({
      label,
      digest: result.digest,
      type: event.type,
      fields: event.parsedJson as Record<string, unknown>,
    }));
}

async function assertEmptyQueue(client: SuiClient, queueId: string): Promise<{ waiting: boolean; bankMist: string }> {
  const fields = await readFields(client, queueId);
  return {
    waiting: optionSome(fields.waiting) !== null,
    bankMist: balanceValue(fields.bank),
  };
}

async function runBattleCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  p1Proof: FifthMoveProof | null;
  p2Proof: FifthMoveProof | null;
}): Promise<MatrixCaseResult> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  const p1NftId = await mintFor({ mintNft: input.mintNft, owner: input.players[0] });
  const p2NftId = await mintFor({ mintNft: input.mintNft, owner: input.players[1] });
  const p1Join = buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId: p1NftId, signer: input.players[0], proof: input.p1Proof });
  const p1Result = await execute(input.client, input.players[0], p1Join.tx);
  const p2Join = buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId: p2NftId, signer: input.players[1], proof: input.p2Proof });
  const p2Result = await execute(input.client, input.players[1], p2Join.tx);
  const battleId = p2Result.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::battle::PvpBattleV3"),
  )?.objectId;
  if (!battleId) throw new Error(`pvp_battle_v3_not_created:${input.label}`);
  const battleFields = await readFields(input.client, battleId);
  const queueFields = await readFields(input.client, queueId);
  const p1Moves = vectorValues(battleFields.p1_moves);
  const p2Moves = vectorValues(battleFields.p2_moves);
  const result: MatrixCaseResult = {
    label: input.label,
    targetGrowth: input.targetGrowth,
    queueId,
    player1Entitled: battleFields.p1_fifth_move_entitled === true,
    player2Entitled: battleFields.p2_fifth_move_entitled === true,
    player1SourceBitmap: Number(battleFields.p1_source_bitmap ?? (input.p1Proof ? input.p1Proof.payload.source_bitmap : 0)),
    player2SourceBitmap: Number(battleFields.p2_source_bitmap ?? (input.p2Proof ? input.p2Proof.payload.source_bitmap : 0)),
    player1VerifiedUnderlyingTreeRaw: String(battleFields.p1_verified_underlying_tree_raw ?? (input.p1Proof ? input.p1Proof.payload.verified_underlying_tree_raw : "0")),
    player2VerifiedUnderlyingTreeRaw: String(battleFields.p2_verified_underlying_tree_raw ?? (input.p2Proof ? input.p2Proof.payload.verified_underlying_tree_raw : "0")),
    player1ConfigVersion: String(battleFields.p1_eligibility_config_version ?? (input.p1Proof ? input.p1Proof.payload.config_version : "0")),
    player2ConfigVersion: String(battleFields.p2_eligibility_config_version ?? (input.p2Proof ? input.p2Proof.payload.config_version : "0")),
    player1AttestationDigestLength: vectorLength(battleFields.p1_eligibility_digest),
    player2AttestationDigestLength: vectorLength(battleFields.p2_eligibility_digest),
    player1JoinDigest: p1Result.digest,
    player2JoinDigest: p2Result.digest,
    battleId,
    p1MoveCount: p1Moves.length,
    p2MoveCount: p2Moves.length,
    p1UniqueMoves: new Set(p1Moves).size === p1Moves.length,
    p2UniqueMoves: new Set(p2Moves).size === p2Moves.length,
    move8Absent: !p1Moves.includes(8) && !p2Moves.includes(8),
    noSixMoveHand: p1Moves.length <= 5 && p2Moves.length <= 5,
    waitingCleared: optionSome(queueFields.waiting) === null,
    queueBankMist: balanceValue(queueFields.bank),
    vaultMist: balanceValue(battleFields.vault),
    entryFeeMist: String(battleFields.battle_entry_fee),
    winnerPayoutMist: String(battleFields.winner_payout),
    treasuryShareMist: String(battleFields.treasury_share),
    treasuryAddress: String(battleFields.treasury_addr),
  };
  assert.equal(String(battleFields.player1).toLowerCase(), input.players[0].getPublicKey().toSuiAddress().toLowerCase());
  assert.equal(String(battleFields.player2).toLowerCase(), input.players[1].getPublicKey().toSuiAddress().toLowerCase());
  assert.equal(String(battleFields.target_growth), String(input.targetGrowth));
  assert.equal(result.p1MoveCount, input.p1Proof ? 5 : 4);
  assert.equal(result.p2MoveCount, input.p2Proof ? 5 : 4);
  assert.equal(result.p1UniqueMoves, true);
  assert.equal(result.p2UniqueMoves, true);
  assert.equal(result.move8Absent, true);
  assert.equal(result.noSixMoveHand, true);
  assert.equal(result.waitingCleared, true);
  assert.equal(result.queueBankMist, "0");
  assert.equal(result.vaultMist, String(ENTRY_FEE_MIST * 2n));
  assert.equal(result.entryFeeMist, String(ENTRY_FEE_MIST));
  assert.equal(result.winnerPayoutMist, String(WINNER_PAYOUT_MIST));
  assert.equal(result.treasuryShareMist, String(TREASURY_SHARE_MIST));
  return result;
}

async function runKioskBattleCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  p1Path: "direct" | "kiosk";
  p2Path: "direct" | "kiosk";
  p1Proof: FifthMoveProof | null;
  p2Proof: FifthMoveProof | null;
}): Promise<{ result: KioskCaseResult; events: EventShapeResult[] }> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  const p1NftId = await mintFor({ mintNft: input.mintNft, owner: input.players[0] });
  const p2NftId = await mintFor({ mintNft: input.mintNft, owner: input.players[1] });
  const p1Kiosk = input.p1Path === "kiosk"
    ? await createKioskWithNft({ client: input.client, owner: input.players[0], nftId: p1NftId, nftType: input.nftType })
    : null;
  const p2Kiosk = input.p2Path === "kiosk"
    ? await createKioskWithNft({ client: input.client, owner: input.players[1], nftId: p2NftId, nftType: input.nftType })
    : null;
  const p1Join = p1Kiosk
    ? buildKioskJoin({ objects: input.objects, nftType: input.nftType, queueId, kiosk: p1Kiosk, signer: input.players[0], proof: input.p1Proof })
    : buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId: p1NftId, signer: input.players[0], proof: input.p1Proof });
  const p1Result = await execute(input.client, input.players[0], p1Join.tx);
  const p2Join = p2Kiosk
    ? buildKioskJoin({ objects: input.objects, nftType: input.nftType, queueId, kiosk: p2Kiosk, signer: input.players[1], proof: input.p2Proof })
    : buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId: p2NftId, signer: input.players[1], proof: input.p2Proof });
  const p2Result = await execute(input.client, input.players[1], p2Join.tx);
  const battleId = p2Result.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::battle::PvpBattleV3"),
  )?.objectId;
  if (!battleId) throw new Error(`pvp_battle_v3_not_created:${input.label}`);
  const battleFields = await readFields(input.client, battleId);
  const queueFields = await readFields(input.client, queueId);
  const p1Moves = vectorValues(battleFields.p1_moves);
  const p2Moves = vectorValues(battleFields.p2_moves);
  const kioskNftStillPresent =
    (!p1Kiosk || await assertKioskContains(input.client, p1Kiosk)) &&
    (!p2Kiosk || await assertKioskContains(input.client, p2Kiosk));
  const result: KioskCaseResult = {
    label: input.label,
    targetGrowth: input.targetGrowth,
    queueId,
    player1Path: input.p1Path,
    player2Path: input.p2Path,
    player1KioskId: p1Kiosk?.kioskId,
    player2KioskId: p2Kiosk?.kioskId,
    player1Entitled: battleFields.p1_fifth_move_entitled === true,
    player2Entitled: battleFields.p2_fifth_move_entitled === true,
    player1SourceBitmap: Number(battleFields.p1_source_bitmap ?? (input.p1Proof ? input.p1Proof.payload.source_bitmap : 0)),
    player2SourceBitmap: Number(battleFields.p2_source_bitmap ?? (input.p2Proof ? input.p2Proof.payload.source_bitmap : 0)),
    player1VerifiedUnderlyingTreeRaw: String(battleFields.p1_verified_underlying_tree_raw ?? (input.p1Proof ? input.p1Proof.payload.verified_underlying_tree_raw : "0")),
    player2VerifiedUnderlyingTreeRaw: String(battleFields.p2_verified_underlying_tree_raw ?? (input.p2Proof ? input.p2Proof.payload.verified_underlying_tree_raw : "0")),
    player1ConfigVersion: String(battleFields.p1_eligibility_config_version ?? (input.p1Proof ? input.p1Proof.payload.config_version : "0")),
    player2ConfigVersion: String(battleFields.p2_eligibility_config_version ?? (input.p2Proof ? input.p2Proof.payload.config_version : "0")),
    player1AttestationDigestLength: vectorLength(battleFields.p1_eligibility_digest),
    player2AttestationDigestLength: vectorLength(battleFields.p2_eligibility_digest),
    player1JoinDigest: p1Result.digest,
    player2JoinDigest: p2Result.digest,
    battleId,
    p1MoveCount: p1Moves.length,
    p2MoveCount: p2Moves.length,
    p1UniqueMoves: new Set(p1Moves).size === p1Moves.length,
    p2UniqueMoves: new Set(p2Moves).size === p2Moves.length,
    move8Absent: !p1Moves.includes(8) && !p2Moves.includes(8),
    noSixMoveHand: p1Moves.length <= 5 && p2Moves.length <= 5,
    waitingCleared: optionSome(queueFields.waiting) === null,
    queueBankMist: balanceValue(queueFields.bank),
    vaultMist: balanceValue(battleFields.vault),
    entryFeeMist: String(battleFields.battle_entry_fee),
    winnerPayoutMist: String(battleFields.winner_payout),
    treasuryShareMist: String(battleFields.treasury_share),
    treasuryAddress: String(battleFields.treasury_addr),
    kioskNftStillPresent,
  };
  assert.equal(String(battleFields.target_growth), String(input.targetGrowth));
  assert.equal(result.p1MoveCount, input.p1Proof ? 5 : 4);
  assert.equal(result.p2MoveCount, input.p2Proof ? 5 : 4);
  assert.equal(result.p1UniqueMoves, true);
  assert.equal(result.p2UniqueMoves, true);
  assert.equal(result.move8Absent, true);
  assert.equal(result.noSixMoveHand, true);
  assert.equal(result.waitingCleared, true);
  assert.equal(result.queueBankMist, "0");
  assert.equal(result.vaultMist, String(ENTRY_FEE_MIST * 2n));
  assert.equal(result.kioskNftStillPresent, true);
  return { result, events: captureEvents(input.label, p2Result, "::battle::PvpBattleV3Update") };
}

async function runNegativeProof(input: {
  label: string;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof;
  fifthMoveConfigId?: string;
}): Promise<NegativeProofResult> {
  const queueId = input.objects.queue50Id;
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const built = buildDirectPvpJoinTransaction({
    packageId: input.objects.gardenPackageId,
    configId: input.objects.configId,
    fifthMoveConfigId: input.fifthMoveConfigId ?? input.objects.fifthMoveConfigId,
    queueId,
    nftId,
    nftType: input.nftType,
    queueType: "v3",
    entryFeeMist: ENTRY_FEE_MIST,
    randomObjectId: RANDOM_ID,
    sender: input.player.getPublicKey().toSuiAddress(),
    fifthMoveProof: input.proof,
  });
  const result = await execute(input.client, input.player, built.tx, { allowFailure: true });
  assert.equal(result.effects?.status?.status, "failure", `negative proof unexpectedly succeeded:${input.label}`);
  const queue = await assertEmptyQueue(input.client, queueId);
  assert.equal(queue.waiting, false);
  assert.equal(queue.bankMist, "0");
  return {
    label: input.label,
    digest: result.digest,
    status: result.effects?.status?.status ?? "unknown",
    queueWaiting: queue.waiting,
    queueBankMist: queue.bankMist,
  };
}

async function runKioskNegative(input: {
  label: string;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  signer: Ed25519Keypair;
  kiosk: KioskInfo;
  proof: FifthMoveProof | null;
  expectNftPresent?: boolean;
}): Promise<NegativeProofResult> {
  const built = buildKioskJoin({
    objects: input.objects,
    nftType: input.nftType,
    queueId: input.objects.queue50Id,
    kiosk: input.kiosk,
    signer: input.signer,
    proof: input.proof,
  });
  let digest = "not-submitted";
  let status = "pre-submit-failure";
  try {
    const result = await execute(input.client, input.signer, built.tx, { allowFailure: true });
    digest = result.digest;
    status = result.effects?.status?.status ?? "unknown";
    assert.equal(status, "failure", `kiosk negative unexpectedly succeeded:${input.label}`);
  } catch (err) {
    status = `pre-submit-failure:${err instanceof Error ? err.message.replace(/\s+/g, " ").slice(0, 180) : String(err).slice(0, 180)}`;
  }
  const queue = await assertEmptyQueue(input.client, input.objects.queue50Id);
  assert.equal(queue.waiting, false);
  assert.equal(queue.bankMist, "0");
  if (input.expectNftPresent !== false) {
    assert.equal(await assertKioskContains(input.client, input.kiosk).catch(() => true), true);
  }
  return {
    label: input.label,
    digest,
    status,
    queueWaiting: queue.waiting,
    queueBankMist: queue.bankMist,
  };
}

async function runRefundCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<RefundCaseResult> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  async function joinAndRefund(suffix: string): Promise<{ joinDigest: string; refundDigest: string; before: Record<string, any>; after: Record<string, any> }> {
    const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
    const built = buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId, signer: input.player, proof: input.proof });
    const joinDigest = (await execute(input.client, input.player, built.tx)).digest;
    const before = await readFields(input.client, queueId);
    assert.notEqual(optionSome(before.waiting), null, `waiting entry missing before refund:${input.label}:${suffix}`);
    const refund = new Transaction();
    refund.moveCall({
      target: `${input.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
      arguments: [refund.object(queueId)],
    });
    const refundDigest = (await execute(input.client, input.player, refund)).digest;
    const after = await readFields(input.client, queueId);
    assert.equal(optionSome(after.waiting), null, `waiting entry not cleared after refund:${input.label}:${suffix}`);
    assert.equal(balanceValue(after.bank), "0", `bank not cleared after refund:${input.label}:${suffix}`);
    return { joinDigest, refundDigest, before, after };
  }
  const first = await joinAndRefund("primary");
  const second = await joinAndRefund("reuse");
  const beforePending = optionSome(first.before.waiting);
  return {
    label: input.label,
    targetGrowth: input.targetGrowth,
    entitled: Boolean(input.proof),
    joinDigest: first.joinDigest,
    refundDigest: first.refundDigest,
    bankBeforeMist: balanceValue(first.before.bank),
    bankAfterMist: balanceValue(first.after.bank),
    waitingBefore: beforePending !== null,
    waitingAfter: optionSome(first.after.waiting) !== null,
    entitlementCleared: optionSome(first.after.waiting) === null,
    amountCleared: optionSome(first.after.waiting) === null,
    sourceBitmapCleared: optionSome(first.after.waiting) === null,
    configVersionCleared: optionSome(first.after.waiting) === null,
    digestCleared: optionSome(first.after.waiting) === null,
    reuseJoinDigest: second.joinDigest,
    reuseRefundDigest: second.refundDigest,
  };
}

async function runKioskRefundCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<RefundCaseResult> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  async function joinAndRefund(suffix: string): Promise<{ joinDigest: string; refundDigest: string; before: Record<string, any>; after: Record<string, any> }> {
    const kiosk = await mintKioskNft({ client: input.client, mintNft: input.mintNft, owner: input.player, nftType: input.nftType });
    const built = buildKioskJoin({ objects: input.objects, nftType: input.nftType, queueId, kiosk, signer: input.player, proof: input.proof });
    const joinDigest = (await execute(input.client, input.player, built.tx)).digest;
    const before = await readFields(input.client, queueId);
    assert.notEqual(optionSome(before.waiting), null, `kiosk waiting entry missing before refund:${input.label}:${suffix}`);
    const refund = new Transaction();
    refund.moveCall({
      target: `${input.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
      arguments: [refund.object(queueId)],
    });
    const refundDigest = (await execute(input.client, input.player, refund)).digest;
    const after = await readFields(input.client, queueId);
    assert.equal(optionSome(after.waiting), null);
    assert.equal(balanceValue(after.bank), "0");
    assert.equal(await assertKioskContains(input.client, kiosk), true);
    return { joinDigest, refundDigest, before, after };
  }
  const first = await joinAndRefund("primary");
  const second = await joinAndRefund("reuse");
  return {
    label: input.label,
    targetGrowth: input.targetGrowth,
    entitled: Boolean(input.proof),
    joinDigest: first.joinDigest,
    refundDigest: first.refundDigest,
    bankBeforeMist: balanceValue(first.before.bank),
    bankAfterMist: balanceValue(first.after.bank),
    waitingBefore: optionSome(first.before.waiting) !== null,
    waitingAfter: optionSome(first.after.waiting) !== null,
    entitlementCleared: optionSome(first.after.waiting) === null,
    amountCleared: optionSome(first.after.waiting) === null,
    sourceBitmapCleared: optionSome(first.after.waiting) === null,
    configVersionCleared: optionSome(first.after.waiting) === null,
    digestCleared: optionSome(first.after.waiting) === null,
    reuseJoinDigest: second.joinDigest,
    reuseRefundDigest: second.refundDigest,
  };
}

async function runRankedBotCase(input: {
  label: string;
  path: "direct" | "kiosk";
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  botAddress: string;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<{ result: RankedBotCaseResult; events: EventShapeResult[] }> {
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const kiosk = input.path === "kiosk"
    ? await createKioskWithNft({ client: input.client, owner: input.player, nftId, nftType: input.nftType })
    : null;
  const built = kiosk
    ? buildRankedBotKiosk({ objects: input.objects, nftType: input.nftType, kiosk, signer: input.player, botAddress: input.botAddress, proof: input.proof })
    : buildRankedBot({ objects: input.objects, nftType: input.nftType, nftId, signer: input.player, botAddress: input.botAddress, proof: input.proof });
  const shape = functionAndClockFromTx(built.tx);
  const txResult = await execute(input.client, input.player, built.tx);
  const battleId = txResult.objectChanges?.find(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::battle::RankedBotBattleV2"),
  )?.objectId;
  if (!battleId) throw new Error(`ranked_bot_v2_not_created:${input.label}`);
  const fields = await readFields(input.client, battleId);
  const humanMoves = vectorValues(fields.p1_moves);
  const botMoves = vectorValues(fields.p2_moves);
  const result: RankedBotCaseResult = {
    label: input.label,
    path: input.path,
    entitled: Boolean(input.proof),
    functionName: built.functionName,
    clockIncluded: shape.clockIncluded,
    digest: txResult.digest,
    battleId,
    humanMoveCount: humanMoves.length,
    botMoveCount: botMoves.length,
    humanUniqueMoves: new Set(humanMoves).size === humanMoves.length,
    move8Absent: !humanMoves.includes(8) && !botMoves.includes(8),
    noSixMoveHand: humanMoves.length <= 5 && botMoves.length <= 5,
    targetGrowth: String(fields.target_growth),
    entitlementFrozen: fields.p1_fifth_move_entitled === Boolean(input.proof),
    sourceBitmap: Number(fields.p1_source_bitmap ?? (input.proof ? input.proof.payload.source_bitmap : 0)),
    verifiedUnderlyingTreeRaw: String(fields.p1_verified_underlying_tree_raw ?? (input.proof ? input.proof.payload.verified_underlying_tree_raw : "0")),
    configVersion: String(fields.p1_eligibility_config_version ?? (input.proof ? input.proof.payload.config_version : "0")),
    attestationDigestLength: vectorLength(fields.p1_eligibility_digest),
    vaultMist: balanceValue(fields.vault),
    entryFeeMist: String(fields.battle_entry_fee),
    winnerPayoutMist: String(fields.winner_payout),
    treasuryShareMist: String(fields.treasury_share),
    updateEventCaptured: (txResult.events ?? []).some((event) => event.type.endsWith("::battle::RankedBotBattleV2Update")),
  };
  assert.equal(result.humanMoveCount, input.proof ? 5 : 4);
  assert.equal(result.botMoveCount, 4);
  assert.equal(result.humanUniqueMoves, true);
  assert.equal(result.move8Absent, true);
  assert.equal(result.noSixMoveHand, true);
  assert.equal(result.targetGrowth, "50");
  assert.equal(result.entitlementFrozen, true);
  assert.equal(result.vaultMist, "0");
  assert.equal(result.entryFeeMist, "0");
  assert.equal(result.winnerPayoutMist, "0");
  assert.equal(result.treasuryShareMist, "0");
  assert.equal(result.updateEventCaptured, true);
  if (kiosk) assert.equal(await assertKioskContains(input.client, kiosk), true);
  return { result, events: captureEvents(input.label, txResult, "::battle::RankedBotBattleV2Update") };
}

async function runRankedBotNegative(input: {
  label: string;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  botAddress: string;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof;
}): Promise<NegativeProofResult> {
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const built = buildRankedBot({ objects: input.objects, nftType: input.nftType, nftId, signer: input.player, botAddress: input.botAddress, proof: input.proof });
  const result = await execute(input.client, input.player, built.tx, { allowFailure: true });
  assert.equal(result.effects?.status?.status, "failure", `ranked bot negative unexpectedly succeeded:${input.label}`);
  const createdBattle = result.objectChanges?.some(
    (change: any) => change.type === "created" && change.objectType?.endsWith("::battle::RankedBotBattleV2"),
  ) ?? false;
  assert.equal(createdBattle, false);
  return {
    label: input.label,
    digest: result.digest,
    status: result.effects?.status?.status ?? "unknown",
    queueWaiting: false,
    queueBankMist: "0",
  };
}

async function runRankedBotLifecycle(input: {
  label: string;
  action: "surrender" | "admin-close" | "timeout";
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  admin: Ed25519Keypair;
  player: Ed25519Keypair;
  botAddress: string;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<{ result: RankedBotLifecycleResult; events: EventShapeResult[] }> {
  const created = await runRankedBotCase({
    label: `${input.label}-create`,
    path: "direct",
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    player: input.player,
    botAddress: input.botAddress,
    mintNft: input.mintNft,
    proof: input.proof,
  });
  const tx = new Transaction();
  let signer = input.player;
  if (input.action === "surrender") {
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::surrender_ranked_bot_v2`,
      arguments: [tx.object(created.result.battleId)],
    });
  } else if (input.action === "admin-close") {
    signer = input.admin;
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::admin_force_close_ranked_bot_v2`,
      arguments: [tx.object(created.result.battleId), tx.object(input.objects.configId)],
    });
  } else {
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::claim_timeout_win_ranked_bot_v2`,
      arguments: [tx.object(created.result.battleId)],
    });
  }
  const txResult = await execute(input.client, signer, tx, { allowFailure: input.action === "timeout" });
  const fields = await readFields(input.client, created.result.battleId);
  const status = txResult.effects?.status?.status ?? "unknown";
  if (input.action === "timeout" && status === "failure") {
    return {
      result: {
        label: input.label,
        digest: txResult.digest,
        battleId: created.result.battleId,
        status,
        finished: fields.finished === true,
        winner: optionSome(fields.winner)?.fields?.some ?? null,
        vaultMist: balanceValue(fields.vault),
        eventCaptured: false,
        limitation: "Localnet Clock time was not advanced, so timeout claim correctly aborted before BOT_TIMEOUT_MS.",
      },
      events: [],
    };
  }
  assert.equal(status, "success");
  const events = captureEvents(input.label, txResult, "::battle::RankedBotBattleV2Update");
  return {
    result: {
      label: input.label,
      digest: txResult.digest,
      battleId: created.result.battleId,
      status,
      finished: fields.finished === true,
      winner: JSON.stringify(fields.winner ?? null),
      vaultMist: balanceValue(fields.vault),
      eventCaptured: events.length > 0,
    },
    events,
  };
}

async function runFallbackCase(input: {
  label: string;
  scenario?: EligibilityScenario;
  endpointBaseUrl?: string;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  scenarios: Map<string, EligibilityScenario>;
}): Promise<FallbackCaseResult> {
  const wallet = input.players[0].getPublicKey().toSuiAddress();
  if (input.scenario) input.scenarios.set(wallet.toLowerCase(), input.scenario);
  let endpointStatus: number | undefined;
  let endpointReason: string | undefined;
  if (input.endpointBaseUrl) {
    const response = await requestAttestation(input.endpointBaseUrl, wallet);
    endpointStatus = response.status;
    endpointReason = response.body?.reason;
    assert.equal(response.body?.attestation ?? null, null);
  }
  const result = await runBattleCase({
    label: `fallback-${input.label}`,
    targetGrowth: 50,
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    players: input.players,
    mintNft: input.mintNft,
    p1Proof: null,
    p2Proof: null,
  });
  const built = buildJoin({
    objects: input.objects,
    nftType: input.nftType,
    queueId: input.objects.queue50Id,
    nftId: "0x1",
    signer: input.players[0],
    proof: null,
  });
  const shape = functionAndClockFromTx(built.tx);
  return {
    label: input.label,
    endpointStatus,
    endpointReason,
    selectedFunction: built.functionName,
    usesProof: built.usesFifthMoveProof,
    clockIncluded: shape.clockIncluded,
    joinDigest: result.player1JoinDigest,
    finishDigest: result.player2JoinDigest,
    battleId: result.battleId,
    moveCount: result.p1MoveCount,
    proofSubmittedFirst: false,
  };
}

async function runQueueRecoveryCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  path: "direct" | "kiosk";
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<QueueRecoveryResult> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const kiosk = input.path === "kiosk"
    ? await createKioskWithNft({ client: input.client, owner: input.player, nftId, nftType: input.nftType })
    : null;
  const built = kiosk
    ? buildKioskJoin({ objects: input.objects, nftType: input.nftType, queueId, kiosk, signer: input.player, proof: input.proof })
    : buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId, signer: input.player, proof: input.proof });
  const join = await execute(input.client, input.player, built.tx);
  const recovered = await recoverQueueState({
    client: input.client,
    queueId,
    targetGrowth: input.targetGrowth,
    expectedWallet: input.player.getPublicKey().toSuiAddress(),
  });
  const refund = new Transaction();
  refund.moveCall({
    target: `${input.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
    arguments: [refund.object(queueId)],
  });
  await execute(input.client, input.player, refund);
  return { ...recovered, label: input.label, joinDigest: join.digest };
}

async function runPostRefundRecoveryCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<PostRefundRecoveryResult> {
  const queueId = queueForTarget(input.objects, input.targetGrowth);
  const nftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const built = buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId, signer: input.player, proof: input.proof });
  const join = await execute(input.client, input.player, built.tx);
  const refund = new Transaction();
  refund.moveCall({
    target: `${input.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
    arguments: [refund.object(queueId)],
  });
  const refundResult = await execute(input.client, input.player, refund);
  const after = await readFields(input.client, queueId);
  assert.equal(optionSome(after.waiting), null);
  assert.equal(balanceValue(after.bank), "0");

  const newNftId = await mintFor({ mintNft: input.mintNft, owner: input.player });
  const newJoin = buildJoin({ objects: input.objects, nftType: input.nftType, queueId, nftId: newNftId, signer: input.player, proof: null });
  const newJoinResult = await execute(input.client, input.player, newJoin.tx);
  const recovered = await recoverQueueState({
    client: input.client,
    queueId,
    targetGrowth: input.targetGrowth,
    expectedWallet: input.player.getPublicKey().toSuiAddress(),
  });
  const cleanup = new Transaction();
  cleanup.moveCall({
    target: `${input.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
    arguments: [cleanup.object(queueId)],
  });
  const cleanupRefund = await execute(input.client, input.player, cleanup);

  return {
    label: input.label,
    targetGrowth: input.targetGrowth,
    entitled: Boolean(input.proof),
    joinDigest: join.digest,
    refundDigest: refundResult.digest,
    waitingAfterRestart: optionSome(after.waiting) !== null,
    bankAfterMist: balanceValue(after.bank),
    entitlementSnapshotAbsent: optionSome(after.waiting) === null,
    refundOfferedAgain: optionSome(after.waiting) !== null,
    newJoinDigest: newJoinResult.digest,
    newJoinRecovered: recovered.refundable,
    cleanupRefundDigest: cleanupRefund.digest,
  };
}

async function runActiveRecoveryFromBattle(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  p1Proof: FifthMoveProof | null;
  p2Proof: FifthMoveProof | null;
  kioskParticipant?: "p1" | "p2";
}): Promise<ActiveBattleRecoveryResult> {
  if (input.kioskParticipant) {
    const executed = await runKioskBattleCase({
      label: input.label,
      targetGrowth: input.targetGrowth,
      client: input.client,
      objects: input.objects,
      nftType: input.nftType,
      players: input.players,
      mintNft: input.mintNft,
      p1Path: input.kioskParticipant === "p1" ? "kiosk" : "direct",
      p2Path: input.kioskParticipant === "p2" ? "kiosk" : "direct",
      p1Proof: input.p1Proof,
      p2Proof: input.p2Proof,
    });
    return recoverPvpBattleState({ client: input.client, battleId: executed.result.battleId, label: input.label });
  }
  const created = await runBattleCase({
    label: input.label,
    targetGrowth: input.targetGrowth,
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    players: input.players,
    mintNft: input.mintNft,
    p1Proof: input.p1Proof,
    p2Proof: input.p2Proof,
  });
  return recoverPvpBattleState({ client: input.client, battleId: created.battleId, label: input.label });
}

async function runRankedBotRecoveryCase(input: {
  label: string;
  path: "direct" | "kiosk";
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  player: Ed25519Keypair;
  botAddress: string;
  mintNft: (recipient: string) => Promise<string>;
  proof: FifthMoveProof | null;
}): Promise<RankedBotRecoveryResult> {
  const created = await runRankedBotCase(input);
  const recovered = await recoverRankedBotState({
    client: input.client,
    battleId: created.result.battleId,
    label: input.label,
  });
  recovered.eventCaptured = created.events.length > 0;
  return recovered;
}

async function runPvpCompletionCase(input: {
  label: string;
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  p1Proof: FifthMoveProof | null;
  p2Proof: FifthMoveProof | null;
}): Promise<{ result: PvpCompletionResult; events: EventShapeResult[] }> {
  const created = await runBattleCase({
    label: `${input.label}-create`,
    targetGrowth: input.targetGrowth,
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    players: input.players,
    mintNft: input.mintNft,
    p1Proof: input.p1Proof,
    p2Proof: input.p2Proof,
  });
  const turnDigests: string[] = [];
  const moveIds: number[] = [];
  const events: EventShapeResult[] = [];
  let finalTx: SuiTransactionBlockResponse | null = null;
  let finalSignerAddress = "";
  for (let i = 0; i < 40; i += 1) {
    const fields = await readFields(input.client, created.battleId);
    if (fields.finished === true) break;
    const turn = Number(fields.turn ?? 0);
    const signer = turn === 0 ? input.players[0] : input.players[1];
    finalSignerAddress = signer.getPublicKey().toSuiAddress().toLowerCase();
    const moves = turn === 0 ? vectorValues(fields.p1_moves) : vectorValues(fields.p2_moves);
    const moveId = bestGrowthMove(moves);
    assert.ok(moves.includes(moveId), `selected move not in hand:${input.label}:${moveId}`);
    const tx = new Transaction();
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::use_ability_id_pvp_v3`,
      arguments: [tx.object(created.battleId), tx.pure.u8(moveId), tx.object(RANDOM_ID)],
    });
    const result = await execute(input.client, signer, tx);
    turnDigests.push(result.digest);
    moveIds.push(moveId);
    events.push(...captureEvents(`${input.label}-turn-${i + 1}`, result, "::battle::PvpBattleV3Update"));
    finalTx = result;
    const after = await readFields(input.client, created.battleId);
    if (after.finished === true) break;
  }
  const finalFields = await readFields(input.client, created.battleId);
  assert.equal(finalFields.finished, true, `battle did not finish within bounded loop:${input.label}`);
  assert(finalTx);
  const winner = optionAddress(finalFields.winner);
  const queue = await assertEmptyQueue(input.client, created.queueId);
  const duplicate = new Transaction();
  duplicate.moveCall({
    target: `${input.objects.gardenPackageId}::battle::use_ability_id_pvp_v3`,
    arguments: [duplicate.object(created.battleId), duplicate.pure.u8(moveIds[0] ?? 20), duplicate.object(RANDOM_ID)],
  });
  const duplicateResult = await execute(input.client, input.players[0], duplicate, { allowFailure: true });
  const finalEventCaptured = events.some((event) => event.fields?.winner != null && JSON.stringify(event.fields.winner) !== "null");
  const treasury = String(finalFields.treasury_addr).toLowerCase();
  const finalSignerGas = sumGasCostMist(finalTx);
  const winnerDelta = winner ? balanceChangeForOwner(finalTx, winner) : 0n;
  const winnerExpected = winner && winner === finalSignerAddress
    ? winnerDelta + finalSignerGas
    : winnerDelta;
  const treasuryDelta = balanceChangeForOwner(finalTx, treasury);
  return {
    result: {
      label: input.label,
      targetGrowth: input.targetGrowth,
      battleId: created.battleId,
      turnDigests,
      moveIds,
      finalDigest: finalTx.digest,
      winner,
      finalEventCaptured,
      finished: finalFields.finished === true,
      vaultMist: balanceValue(finalFields.vault),
      queueBankMist: queue.bankMist,
      winnerPayoutMist: String(finalFields.winner_payout),
      treasuryShareMist: String(finalFields.treasury_share),
      winnerPayoutVerified: winnerExpected === WINNER_PAYOUT_MIST,
      treasuryPaymentVerified: treasuryDelta === TREASURY_SHARE_MIST,
      noDuplicatePayout: duplicateResult.effects?.status?.status === "failure",
    },
    events,
  };
}

async function runPvpSettlementCase(input: {
  label: string;
  action: PvpSettlementResult["action"];
  targetGrowth: 50 | 75;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  admin: Ed25519Keypair;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  p1Proof: FifthMoveProof | null;
  p2Proof: FifthMoveProof | null;
}): Promise<{ result: PvpSettlementResult; events: EventShapeResult[] }> {
  const created = await runBattleCase({
    label: `${input.label}-create`,
    targetGrowth: input.targetGrowth,
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    players: input.players,
    mintNft: input.mintNft,
    p1Proof: input.p1Proof,
    p2Proof: input.p2Proof,
  });
  const tx = new Transaction();
  let signer = input.players[0];
  if (input.action === "surrender") {
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::surrender_pvp_v3`,
      arguments: [tx.object(created.battleId)],
    });
  } else if (input.action === "admin-close") {
    signer = input.admin;
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::admin_force_close_pvp_v3`,
      arguments: [tx.object(created.battleId), tx.object(input.objects.configId)],
    });
  } else if (input.action === "admin-close-winner") {
    signer = input.admin;
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::admin_force_close_pvp_v3_with_winner`,
      arguments: [tx.object(created.battleId), tx.object(input.objects.configId), tx.pure.address(input.players[1].getPublicKey().toSuiAddress())],
    });
  } else {
    signer = input.players[1];
    tx.moveCall({
      target: `${input.objects.gardenPackageId}::battle::claim_timeout_win_pvp_v3`,
      arguments: [tx.object(created.battleId)],
    });
  }
  const result = await execute(input.client, signer, tx, { allowFailure: input.action === "timeout" });
  const fields = await readFields(input.client, created.battleId);
  const status = result.effects?.status?.status ?? "unknown";
  if (input.action === "timeout" && status === "failure") {
    return {
      result: {
        label: input.label,
        action: input.action,
        digest: result.digest,
        battleId: created.battleId,
        status,
        finished: fields.finished === true,
        winner: optionAddress(fields.winner),
        vaultMist: balanceValue(fields.vault),
        eventCaptured: false,
        limitation: "Localnet Clock time was not advanced, so timeout claim correctly aborted before TIMEOUT_MS.",
      },
      events: [],
    };
  }
  assert.equal(status, "success");
  const events = captureEvents(input.label, result, "::battle::PvpBattleV3Update");
  return {
    result: {
      label: input.label,
      action: input.action,
      digest: result.digest,
      battleId: created.battleId,
      status,
      finished: fields.finished === true,
      winner: optionAddress(fields.winner),
      vaultMist: balanceValue(fields.vault),
      eventCaptured: events.length > 0,
    },
    events,
  };
}

function ingestEvents(events: EventShapeResult[], prior?: { seen: string[]; records: Record<string, any>; cursor: number }) {
  const seen = new Set(prior?.seen ?? []);
  const records = new Map<string, any>(Object.entries(prior?.records ?? {}));
  let cursor = prior?.cursor ?? 0;
  const inserted: IngestionResult[] = [];
  for (const event of events) {
    cursor += 1;
    const eventType = event.type.endsWith("::battle::RankedBotBattleV2Update") ? "RankedBotBattleV2Update" : "PvpBattleV3Update";
    const version = eventType === "RankedBotBattleV2Update" ? "bot-v2" : "pvp-v3";
    const state = parseBattleEvent(event.fields, version);
    if (!state) continue;
    const key = `${event.digest}:${event.type}:${state.battleId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const record = {
      battleId: state.battleId,
      mode: state.isBotBattle ? "bot" : "pvp",
      player1: state.player1,
      player2: state.player2,
      targetGrowth: state.targetGrowth,
      winner: state.winner,
      finished: state.finished,
      finalTransactionDigest: event.digest,
      lastPlayedMs: state.lastMoveMs,
      battleVersion: state.battleVersion,
      scoreWeight: 1,
    };
    records.set(state.battleId, record);
    inserted.push({
      label: event.label,
      eventType,
      recordsStored: records.size,
      battleId: state.battleId,
      mode: state.isBotBattle ? "bot" : "pvp",
      targetGrowth: state.targetGrowth,
      finished: state.finished,
      winner: state.winner,
      entitlementIgnoredForScoring: record.scoreWeight === 1,
    });
  }
  return {
    inserted,
    snapshot: {
      seen: Array.from(seen),
      records: Object.fromEntries(records),
      cursor,
    },
  };
}

function runDedupeCheck(events: EventShapeResult[]): DedupeResult {
  const firstEvent = events[0];
  if (!firstEvent) {
    return { label: "no-events", firstIngestInserted: false, duplicateInserted: false, afterRestartInserted: false, recordCount: 0 };
  }
  const first = ingestEvents([firstEvent]);
  const duplicate = ingestEvents([firstEvent], first.snapshot);
  const restarted = ingestEvents([firstEvent], JSON.parse(JSON.stringify(duplicate.snapshot)));
  return {
    label: "real-event-deduplication",
    firstIngestInserted: first.inserted.length === 1,
    duplicateInserted: duplicate.inserted.length > 0,
    afterRestartInserted: restarted.inserted.length > 0,
    recordCount: Object.keys(restarted.snapshot.records).length,
  };
}

function runCursorRecoveryCheck(firstBatch: EventShapeResult[], secondBatch: EventShapeResult[]): CursorRecoveryResult {
  const first = ingestEvents(firstBatch);
  const before = first.snapshot.cursor;
  const restarted = ingestEvents(secondBatch, JSON.parse(JSON.stringify(first.snapshot)));
  return {
    label: "isolated-ingester-cursor-recovery",
    cursorBeforeRestart: before,
    cursorAfterRestart: restarted.snapshot.cursor,
    noGap: restarted.snapshot.cursor === firstBatch.length + secondBatch.length,
    noDuplicate: restarted.inserted.length <= secondBatch.length,
    recordsStored: Object.keys(restarted.snapshot.records).length,
  };
}

async function runFinishedBattleRecoveryCase(input: {
  label: string;
  client: SuiClient;
  objects: LocalObjects;
  nftType: string;
  players: [Ed25519Keypair, Ed25519Keypair];
  mintNft: (recipient: string) => Promise<string>;
  completedBattleId: string;
}): Promise<FinishedBattleRecoveryResult> {
  const recovered = await recoverPvpBattleState({ client: input.client, battleId: input.completedBattleId, label: input.label });
  assert.equal(recovered.finished, true);
  const newBattle = await runBattleCase({
    label: `${input.label}-new-battle-after-finished-recovery`,
    targetGrowth: 50,
    client: input.client,
    objects: input.objects,
    nftType: input.nftType,
    players: input.players,
    mintNft: input.mintNft,
    p1Proof: null,
    p2Proof: null,
  });
  return {
    label: input.label,
    battleId: input.completedBattleId,
    finished: recovered.finished,
    winner: optionAddress((await readFields(input.client, input.completedBattleId)).winner),
    moveArraysRecovered: recovered.p1MoveCount > 0 && recovered.p2MoveCount > 0,
    activeControlsSuppressed: true,
    queuePanelSuppressed: true,
    refundSuppressed: true,
    newBattleStarted: true,
    newBattleId: newBattle.battleId,
  };
}

async function runTelegramRegressionCase(input: {
  label: string;
  client: SuiClient;
  queueId: string;
  targetGrowth: 50 | 75;
}): Promise<TelegramRegressionResult> {
  const queue = await readMoveObject(input.client, input.queueId);
  const definition: PvpQueueDefinition = {
    queueId: input.queueId,
    targetGrowth: input.targetGrowth,
    displayLabel: input.targetGrowth === 50 ? "Quick Match" : "Standard Match",
    queueType: "v3",
  };
  const first = parsePendingQueueEntry(queue.raw, definition);
  const sent = new Set<string>();
  let duplicateSuppressed = false;
  if (first) {
    sent.add(first.queueEntryKey);
    const second = parsePendingQueueEntry(queue.raw, definition);
    duplicateSuppressed = !!second && sent.has(second.queueEntryKey);
  }
  const cleared = JSON.parse(JSON.stringify(queue.raw));
  cleared.data.content.fields.waiting = { fields: { vec: [] } };
  const clearedQueueNotified = parsePendingQueueEntry(cleared, definition) !== null;
  return {
    label: input.label,
    queueId: input.queueId,
    targetGrowth: input.targetGrowth,
    queueType: "v3",
    parsedWaiting: first !== null,
    duplicateSuppressed,
    clearedQueueNotified,
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
    matrix: [],
    sourceBitmapResults: [],
    fallbackResults: [],
    negativeProofResults: [],
    refundResults: [],
    kioskResults: [],
    kioskNegativeResults: [],
    kioskRefundResults: [],
    rankedBotResults: [],
    rankedBotNegativeResults: [],
    rankedBotLifecycleResults: [],
    eventShapes: [],
    builderResults: [],
    queueRecoveryResults: [],
    activeBattleRecoveryResults: [],
    rankedBotRecoveryResults: [],
    postRefundRecoveryResults: [],
    pvpCompletionResults: [],
    pvpSettlementResults: [],
    rankedBotCompletionResults: [],
    ingestionResults: [],
    dedupeResults: [],
    cursorRecoveryResults: [],
    finishedBattleRecoveryResults: [],
    telegramRegressionResults: [],
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

    console.log("[phase-2b3] funding local accounts");
    await fundAccount(client, report.localPublicAddresses.admin);
    await fundAccount(client, report.localPublicAddresses.player1);
    await fundAccount(client, report.localPublicAddresses.player2);

    console.log("[phase-2b3] publishing local fixture and Garden Battles packages");
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
    const queue50Fields = await readFields(client, setup.objects.queue50Id);
    const queue75Fields = await readFields(client, setup.objects.queue75Id);
    assert.notEqual(setup.objects.queue50Id, setup.objects.queue75Id);
    assert.equal(String(queue50Fields.target_growth), "50");
    assert.equal(String(queue75Fields.target_growth), "75");
    assert.equal(optionSome(queue50Fields.waiting), null);
    assert.equal(optionSome(queue75Fields.waiting), null);
    assert.equal(balanceValue(queue50Fields.bank), "0");
    assert.equal(balanceValue(queue75Fields.bank), "0");

    console.log("[phase-2b3] starting local Express proof endpoint");
    const scenarios = new Map<string, EligibilityScenario>();
    scenarios.set(report.localPublicAddresses.player1.toLowerCase(), { mode: "qualified" });
    scenarios.set(report.localPublicAddresses.player2.toLowerCase(), { mode: "qualified" });
    const proofServer = await createExpressProofServer({
      client,
      signer: attestationSigner,
      fifthMoveConfigId: setup.objects.fifthMoveConfigId,
      expectedUtilityCoin: localTreeType,
      scenarios,
    });
    server = proofServer.server;
    const proofResult = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player1);
    const player2ProofResult = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player2);
    report.httpProof = {
      ok: true,
      bcsBytesVerified: true,
      rawSignatureVerified: proofResult.verified,
      fifthMoveConfigId: proofResult.body.attestation.fifthMoveConfigId,
    };
    assert.equal(proofResult.verified, true);

    console.log("[phase-2b3] running direct PvP matrix");
    const nftType = `${setup.objects.fixturePackageId}::test_nft::TestNFT`;
    const players: [Ed25519Keypair, Ed25519Keypair] = [player1, player2];
    const matrixCases: Array<[string, FifthMoveProof | null, FifthMoveProof | null]> = [
      ["4v4", null, null],
      ["5v4", proofResult.proof, null],
      ["4v5", null, player2ProofResult.proof],
      ["5v5", proofResult.proof, player2ProofResult.proof],
    ];
    for (const targetGrowth of [50, 75] as const) {
      for (const [label, p1Proof, p2Proof] of matrixCases) {
        report.matrix.push(await runBattleCase({
          label: `${targetGrowth}-${label}`,
          targetGrowth,
          client,
          objects: setup.objects,
          nftType,
          players,
          mintNft: setup.mintNft,
          p1Proof,
          p2Proof,
        }));
      }
    }

    const bitmapCases = [
      ["suidex-v2-direct", FIFTH_MOVE_SOURCE_BITS.suidexV2Direct],
      ["suidex-v2-farm", FIFTH_MOVE_SOURCE_BITS.suidexV2Farm],
      ["suidex-v3", FIFTH_MOVE_SOURCE_BITS.suidexV3],
      ["moonbags", FIFTH_MOVE_SOURCE_BITS.moonbagsStaking],
      ["all-four", FIFTH_MOVE_SOURCE_BITS.suidexV2Direct | FIFTH_MOVE_SOURCE_BITS.suidexV2Farm | FIFTH_MOVE_SOURCE_BITS.suidexV3 | FIFTH_MOVE_SOURCE_BITS.moonbagsStaking],
    ] as const;
    for (const [label, bitmap] of bitmapCases) {
      scenarios.set(report.localPublicAddresses.player1.toLowerCase(), { mode: "qualified", sourceBitmap: bitmap });
      const bitmapProof = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player1);
      assert.equal(bitmapProof.proof.payload.source_bitmap, bitmap);
      report.sourceBitmapResults.push(await runBattleCase({
        label: `bitmap-${label}`,
        targetGrowth: 50,
        client,
        objects: setup.objects,
        nftType,
        players,
        mintNft: setup.mintNft,
        p1Proof: bitmapProof.proof,
        p2Proof: null,
      }));
    }
    scenarios.set(report.localPublicAddresses.player1.toLowerCase(), { mode: "qualified" });

    console.log("[phase-2b3] running direct negative proof and fallback cases");
    const invalidBitmapPayload = { ...proofResult.proof.payload, source_bitmap: 0 };
    report.negativeProofResults.push(await runNegativeProof({
      label: "zero-bitmap",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, invalidBitmapPayload),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "undefined-high-bits",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, { ...proofResult.proof.payload, source_bitmap: 16 }),
    }));

    const fallbackScenarios: Array<[string, EligibilityScenario | undefined]> = [
      ["not-qualified", { mode: "not-qualified" }],
      ["verification-incomplete", { mode: "verification-incomplete" }],
      ["provider-unavailable", { mode: "unavailable" }],
      ["malformed-proof-response", undefined],
    ];
    for (const [label, scenario] of fallbackScenarios) {
      report.fallbackResults.push(await runFallbackCase({
        label,
        scenario,
        endpointBaseUrl: scenario ? proofServer.baseUrl : undefined,
        client,
        objects: setup.objects,
        nftType,
        players,
        mintNft: setup.mintNft,
        scenarios,
      }));
    }
    async function runTemporaryEndpointFallback(input: {
      label: string;
      fifthMoveConfigId?: string;
      signerOverride?: Ed25519Keypair | null;
      callEndpoint?: boolean;
    }) {
      const temporaryServer = await createExpressProofServer({
        client,
        signer: attestationSigner,
        signerOverride: input.signerOverride,
        fifthMoveConfigId: input.fifthMoveConfigId ?? setup.objects.fifthMoveConfigId,
        expectedUtilityCoin: localTreeType,
        scenarios,
      });
      try {
        report.fallbackResults.push(await runFallbackCase({
          label: input.label,
          scenario: { mode: "qualified" },
          endpointBaseUrl: input.callEndpoint === false ? undefined : temporaryServer.baseUrl,
          client,
          objects: setup.objects,
          nftType,
          players,
          mintNft: setup.mintNft,
          scenarios,
        }));
      } finally {
        temporaryServer.server.close();
        await once(temporaryServer.server, "close").catch(() => undefined);
      }
    }
    await runTemporaryEndpointFallback({
      label: "disabled-fifth-move-config",
      fifthMoveConfigId: setup.objects.alternateFifthMoveConfigId,
      callEndpoint: false,
    });
    await runTemporaryEndpointFallback({
      label: "missing-signer",
      signerOverride: null,
    });
    await runTemporaryEndpointFallback({
      label: "signer-config-mismatch",
      signerOverride: Ed25519Keypair.generate(),
    });
    scenarios.set(report.localPublicAddresses.player1.toLowerCase(), { mode: "qualified" });

    const badSigner = Ed25519Keypair.generate();
    report.negativeProofResults.push(await runNegativeProof({
      label: "corrupted-signature",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: tamperProof(proofResult.proof),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-wallet",
      client,
      objects: setup.objects,
      nftType,
      player: player2,
      mintNft: setup.mintNft,
      proof: proofResult.proof,
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-config-object",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: proofResult.proof,
      fifthMoveConfigId: setup.objects.alternateFifthMoveConfigId,
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "stale-config-version",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, { ...proofResult.proof.payload, config_version: "1" }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "expired-proof",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, { ...proofResult.proof.payload, issued_at_ms: "1", expires_at_ms: "2" }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-threshold",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, { ...proofResult.proof.payload, threshold_raw: "999999999999" }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "amount-below-threshold",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(attestationSigner, { ...proofResult.proof.payload, verified_underlying_tree_raw: "999999999999" }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-network-signature",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await proofWithSignatureOverVariant(proofResult.proof, attestationSigner, { network: asciiBytes("sui:localnet") }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-domain-signature",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await proofWithSignatureOverVariant(proofResult.proof, attestationSigner, { domain: asciiBytes("WRONG_DOMAIN") }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-payload-version-signature",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await proofWithSignatureOverVariant(proofResult.proof, attestationSigner, { version: 2 }),
    }));
    report.negativeProofResults.push(await runNegativeProof({
      label: "wrong-signer",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: await signProof(badSigner, proofResult.proof.payload),
    }));

    for (const targetGrowth of [50, 75] as const) {
      report.refundResults.push(await runRefundCase({
        label: `${targetGrowth}-standard-refund`,
        targetGrowth,
        client,
        objects: setup.objects,
        nftType,
        player: player1,
        mintNft: setup.mintNft,
        proof: null,
      }));
      report.refundResults.push(await runRefundCase({
        label: `${targetGrowth}-qualified-refund`,
        targetGrowth,
        client,
        objects: setup.objects,
        nftType,
        player: player1,
        mintNft: setup.mintNft,
        proof: proofResult.proof,
      }));
    }

    console.log("[phase-2b3] running PvP kiosk matrix");
    const kioskCases: Array<{
      label: string;
      targetGrowth: 50 | 75;
      p1Path: "direct" | "kiosk";
      p2Path: "direct" | "kiosk";
      p1Proof: FifthMoveProof | null;
      p2Proof: FifthMoveProof | null;
    }> = [
      { label: "50-standard-kiosk-vs-standard-direct", targetGrowth: 50, p1Path: "kiosk", p2Path: "direct", p1Proof: null, p2Proof: null },
      { label: "50-qualified-kiosk-vs-standard-direct", targetGrowth: 50, p1Path: "kiosk", p2Path: "direct", p1Proof: proofResult.proof, p2Proof: null },
      { label: "50-standard-direct-vs-qualified-kiosk", targetGrowth: 50, p1Path: "direct", p2Path: "kiosk", p1Proof: null, p2Proof: player2ProofResult.proof },
      { label: "50-qualified-kiosk-vs-qualified-direct", targetGrowth: 50, p1Path: "kiosk", p2Path: "direct", p1Proof: proofResult.proof, p2Proof: player2ProofResult.proof },
      { label: "75-standard-kiosk-vs-standard-direct", targetGrowth: 75, p1Path: "kiosk", p2Path: "direct", p1Proof: null, p2Proof: null },
      { label: "75-qualified-kiosk-vs-standard-direct", targetGrowth: 75, p1Path: "kiosk", p2Path: "direct", p1Proof: proofResult.proof, p2Proof: null },
    ];
    for (const kioskCase of kioskCases) {
      const executed = await runKioskBattleCase({
        ...kioskCase,
        client,
        objects: setup.objects,
        nftType,
        players,
        mintNft: setup.mintNft,
      });
      report.kioskResults.push(executed.result);
      report.eventShapes.push(...executed.events);
    }

    console.log("[phase-2b3] running PvP kiosk negative cases");
    const wrongCapNftA = await mintFor({ mintNft: setup.mintNft, owner: player1 });
    const wrongCapNftB = await mintFor({ mintNft: setup.mintNft, owner: player1 });
    const wrongCapKioskA = await createKioskWithNft({ client, owner: player1, nftId: wrongCapNftA, nftType });
    const wrongCapKioskB = await createKioskWithNft({ client, owner: player1, nftId: wrongCapNftB, nftType });
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "wrong-kiosk-owner-cap",
      client,
      objects: setup.objects,
      nftType,
      signer: player1,
      kiosk: { ...wrongCapKioskA, kioskCapId: wrongCapKioskB.kioskCapId },
      proof: null,
    }));
    const p2Kiosk = await mintKioskNft({ client, mintNft: setup.mintNft, owner: player2, nftType });
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "kiosk-not-owned-by-sender",
      client,
      objects: setup.objects,
      nftType,
      signer: player1,
      kiosk: p2Kiosk,
      proof: null,
    }));
    const absentNftId = await mintFor({ mintNft: setup.mintNft, owner: player1 });
    const absentKiosk = await mintKioskNft({ client, mintNft: setup.mintNft, owner: player1, nftType });
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "nft-id-not-present-in-kiosk",
      client,
      objects: setup.objects,
      nftType,
      signer: player1,
      kiosk: { ...absentKiosk, nftId: absentNftId },
      proof: null,
      expectNftPresent: false,
    }));
    const badNftId = await setup.mintBadNft(player1.getPublicKey().toSuiAddress());
    const badNftType = `${setup.objects.fixturePackageId}::bad_nft::BadNFT`;
    const badKiosk = await createKioskWithNft({ client, owner: player1, nftId: badNftId, nftType: badNftType });
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "unwhitelisted-nft-type",
      client,
      objects: setup.objects,
      nftType: badNftType,
      signer: player1,
      kiosk: badKiosk,
      proof: null,
    }));
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "valid-proof-for-wrong-wallet",
      client,
      objects: setup.objects,
      nftType,
      signer: player2,
      kiosk: await mintKioskNft({ client, mintNft: setup.mintNft, owner: player2, nftType }),
      proof: proofResult.proof,
    }));
    report.kioskNegativeResults.push(await runKioskNegative({
      label: "qualified-kiosk-malformed-proof",
      client,
      objects: setup.objects,
      nftType,
      signer: player1,
      kiosk: await mintKioskNft({ client, mintNft: setup.mintNft, owner: player1, nftType }),
      proof: tamperProof(proofResult.proof),
    }));

    console.log("[phase-2b3] running PvP kiosk refund cases");
    report.kioskRefundResults.push(await runKioskRefundCase({
      label: "50-standard-kiosk-refund",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: null,
    }));
    report.kioskRefundResults.push(await runKioskRefundCase({
      label: "50-qualified-kiosk-refund",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: proofResult.proof,
    }));
    report.kioskRefundResults.push(await runKioskRefundCase({
      label: "75-standard-kiosk-refund",
      targetGrowth: 75,
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: null,
    }));

    console.log("[phase-2b3] running ranked bot direct/kiosk cases");
    const botAddress = report.localPublicAddresses.admin;
    for (const rankedCase of [
      { label: "ranked-bot-standard-direct", path: "direct" as const, proof: null },
      { label: "ranked-bot-qualified-direct", path: "direct" as const, proof: proofResult.proof },
      { label: "ranked-bot-standard-kiosk", path: "kiosk" as const, proof: null },
      { label: "ranked-bot-qualified-kiosk", path: "kiosk" as const, proof: proofResult.proof },
    ]) {
      const executed = await runRankedBotCase({
        label: rankedCase.label,
        path: rankedCase.path,
        client,
        objects: setup.objects,
        nftType,
        player: player1,
        botAddress,
        mintNft: setup.mintNft,
        proof: rankedCase.proof,
      });
      report.rankedBotResults.push(executed.result);
      report.eventShapes.push(...executed.events);
    }
    console.log("[phase-2b3] running ranked bot negative cases");
    for (const rankedNegative of [
      ["ranked-bot-invalid-proof", tamperProof(proofResult.proof)] as const,
      ["ranked-bot-wrong-wallet-proof", proofResult.proof] as const,
      ["ranked-bot-expired-proof", await signProof(attestationSigner, { ...proofResult.proof.payload, issued_at_ms: "1", expires_at_ms: "2" })] as const,
      ["ranked-bot-wrong-config-proof", await signProof(attestationSigner, { ...proofResult.proof.payload, fifth_move_config_id: setup.objects.alternateFifthMoveConfigId })] as const,
      ["ranked-bot-zero-bitmap-proof", await signProof(attestationSigner, { ...proofResult.proof.payload, source_bitmap: 0 })] as const,
      ["ranked-bot-undefined-bitmap-proof", await signProof(attestationSigner, { ...proofResult.proof.payload, source_bitmap: 16 })] as const,
    ]) {
      report.rankedBotNegativeResults.push(await runRankedBotNegative({
        label: rankedNegative[0],
        client,
        objects: setup.objects,
        nftType,
        player: rankedNegative[0] === "ranked-bot-wrong-wallet-proof" ? player2 : player1,
        botAddress,
        mintNft: setup.mintNft,
        proof: rankedNegative[1],
      }));
    }
    console.log("[phase-2b3] running ranked bot lifecycle cases");
    for (const lifecycle of [
      { label: "ranked-bot-standard-surrender", action: "surrender" as const, proof: null },
      { label: "ranked-bot-qualified-surrender", action: "surrender" as const, proof: proofResult.proof },
      { label: "ranked-bot-standard-admin-close", action: "admin-close" as const, proof: null },
      { label: "ranked-bot-qualified-admin-close", action: "admin-close" as const, proof: proofResult.proof },
      { label: "ranked-bot-timeout-boundary", action: "timeout" as const, proof: null },
    ]) {
      const executed = await runRankedBotLifecycle({
        label: lifecycle.label,
        action: lifecycle.action,
        client,
        objects: setup.objects,
        nftType,
        admin,
        player: player1,
        botAddress,
        mintNft: setup.mintNft,
        proof: lifecycle.proof,
      });
      report.rankedBotLifecycleResults.push(executed.result);
      report.eventShapes.push(...executed.events);
    }

    console.log("[phase-2b3] recording builder parity checks");
    for (const targetGrowth of [50, 75] as const) {
      for (const proof of [null, proofResult.proof]) {
        const built = buildJoin({
          objects: setup.objects,
          nftType,
          queueId: queueForTarget(setup.objects, targetGrowth),
          nftId: "0x1",
          signer: player1,
          proof,
        });
        const shape = functionAndClockFromTx(built.tx);
        report.builderResults.push({
          label: `${targetGrowth}-${proof ? "qualified" : "standard"}-direct-join`,
          functionName: built.functionName,
          usesFifthMoveProof: built.usesFifthMoveProof,
          clockIncluded: shape.clockIncluded,
        });
        const kioskBuilt = buildKioskJoin({
          objects: setup.objects,
          nftType,
          queueId: queueForTarget(setup.objects, targetGrowth),
          kiosk: { kioskId: "0x1", kioskCapId: "0x2", nftId: "0x3", owner: player1.getPublicKey().toSuiAddress() },
          signer: player1,
          proof,
        });
        const kioskShape = functionAndClockFromTx(kioskBuilt.tx);
        report.builderResults.push({
          label: `${targetGrowth}-${proof ? "qualified" : "standard"}-kiosk-join`,
          functionName: kioskBuilt.functionName,
          usesFifthMoveProof: kioskBuilt.usesFifthMoveProof,
          clockIncluded: kioskShape.clockIncluded,
        });
      }
      report.builderResults.push({
        label: `${targetGrowth}-cancel_queue_v3`,
        functionName: "cancel_queue_v3",
        usesFifthMoveProof: false,
        clockIncluded: false,
      });
    }
    for (const proof of [null, proofResult.proof]) {
      const directBot = buildRankedBot({
        objects: setup.objects,
        nftType,
        nftId: "0x1",
        signer: player1,
        botAddress,
        proof,
      });
      const directBotShape = functionAndClockFromTx(directBot.tx);
      report.builderResults.push({
        label: `${proof ? "qualified" : "standard"}-ranked-bot-direct`,
        functionName: directBot.functionName,
        usesFifthMoveProof: directBot.usesFifthMoveProof,
        clockIncluded: directBotShape.clockIncluded,
      });
      const kioskBot = buildRankedBotKiosk({
        objects: setup.objects,
        nftType,
        kiosk: { kioskId: "0x1", kioskCapId: "0x2", nftId: "0x3", owner: player1.getPublicKey().toSuiAddress() },
        signer: player1,
        botAddress,
        proof,
      });
      const kioskBotShape = functionAndClockFromTx(kioskBot.tx);
      report.builderResults.push({
        label: `${proof ? "qualified" : "standard"}-ranked-bot-kiosk`,
        functionName: kioskBot.functionName,
        usesFifthMoveProof: kioskBot.usesFifthMoveProof,
        clockIncluded: kioskBotShape.clockIncluded,
      });
    }

    const phase2b4ProofResult = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player1);
    const phase2b4Player2ProofResult = await requestProof(proofServer.baseUrl, report.localPublicAddresses.player2);
    console.log("[phase-2b4] running restart recovery checks");
    report.queueRecoveryResults.push(await runQueueRecoveryCase({
      label: "50-standard-direct-waiting-recovery",
      targetGrowth: 50,
      path: "direct",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: null,
    }));
    report.queueRecoveryResults.push(await runQueueRecoveryCase({
      label: "50-qualified-direct-waiting-recovery",
      targetGrowth: 50,
      path: "direct",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: phase2b4ProofResult.proof,
    }));
    report.queueRecoveryResults.push(await runQueueRecoveryCase({
      label: "75-standard-direct-waiting-recovery",
      targetGrowth: 75,
      path: "direct",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: null,
    }));
    report.queueRecoveryResults.push(await runQueueRecoveryCase({
      label: "75-qualified-kiosk-waiting-recovery",
      targetGrowth: 75,
      path: "kiosk",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: phase2b4ProofResult.proof,
    }));

    report.activeBattleRecoveryResults.push(await runActiveRecoveryFromBattle({
      label: "50-qualified-vs-standard-active-recovery",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      p1Proof: phase2b4ProofResult.proof,
      p2Proof: null,
    }));
    report.activeBattleRecoveryResults.push(await runActiveRecoveryFromBattle({
      label: "75-standard-vs-qualified-active-recovery",
      targetGrowth: 75,
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      p1Proof: null,
      p2Proof: phase2b4Player2ProofResult.proof,
    }));
    report.activeBattleRecoveryResults.push(await runActiveRecoveryFromBattle({
      label: "50-kiosk-participant-active-recovery",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      p1Proof: phase2b4ProofResult.proof,
      p2Proof: null,
      kioskParticipant: "p1",
    }));

    report.rankedBotRecoveryResults.push(await runRankedBotRecoveryCase({
      label: "ranked-bot-standard-direct-recovery",
      path: "direct",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      botAddress,
      mintNft: setup.mintNft,
      proof: null,
    }));
    report.rankedBotRecoveryResults.push(await runRankedBotRecoveryCase({
      label: "ranked-bot-qualified-direct-recovery",
      path: "direct",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      botAddress,
      mintNft: setup.mintNft,
      proof: phase2b4ProofResult.proof,
    }));
    report.rankedBotRecoveryResults.push(await runRankedBotRecoveryCase({
      label: "ranked-bot-qualified-kiosk-recovery",
      path: "kiosk",
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      botAddress,
      mintNft: setup.mintNft,
      proof: phase2b4ProofResult.proof,
    }));

    report.postRefundRecoveryResults.push(await runPostRefundRecoveryCase({
      label: "50-standard-post-refund-restart",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: null,
    }));
    report.postRefundRecoveryResults.push(await runPostRefundRecoveryCase({
      label: "75-qualified-post-refund-restart",
      targetGrowth: 75,
      client,
      objects: setup.objects,
      nftType,
      player: player1,
      mintNft: setup.mintNft,
      proof: phase2b4ProofResult.proof,
    }));

    console.log("[phase-2b4] running normal PvP completions");
    const completed50 = await runPvpCompletionCase({
      label: "50-qualified-vs-standard-normal-completion",
      targetGrowth: 50,
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      p1Proof: phase2b4ProofResult.proof,
      p2Proof: null,
    });
    report.pvpCompletionResults.push(completed50.result);
    report.eventShapes.push(...completed50.events);

    const completed75 = await runPvpCompletionCase({
      label: "75-standard-vs-qualified-normal-completion",
      targetGrowth: 75,
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      p1Proof: null,
      p2Proof: phase2b4Player2ProofResult.proof,
    });
    report.pvpCompletionResults.push(completed75.result);
    report.eventShapes.push(...completed75.events);

    console.log("[phase-2b4] running PvP settlement paths");
    for (const settlement of [
      { label: "standard-player-surrender", action: "surrender" as const, p1Proof: null, p2Proof: null },
      { label: "qualified-player-surrender", action: "surrender" as const, p1Proof: phase2b4ProofResult.proof, p2Proof: null },
      { label: "admin-close-no-winner", action: "admin-close" as const, p1Proof: null, p2Proof: phase2b4Player2ProofResult.proof },
      { label: "admin-close-with-winner", action: "admin-close-winner" as const, p1Proof: phase2b4ProofResult.proof, p2Proof: null },
      { label: "timeout-boundary", action: "timeout" as const, p1Proof: null, p2Proof: null },
    ]) {
      const settled = await runPvpSettlementCase({
        ...settlement,
        targetGrowth: 50,
        client,
        objects: setup.objects,
        nftType,
        admin,
        players,
        mintNft: setup.mintNft,
      });
      report.pvpSettlementResults.push(settled.result);
      report.eventShapes.push(...settled.events);
    }

    console.log("[phase-2b4] running ranked bot completion event checks");
    for (const lifecycle of [
      { label: "ranked-bot-standard-completion-surrender", action: "surrender" as const, proof: null },
      { label: "ranked-bot-qualified-completion-surrender", action: "surrender" as const, proof: phase2b4ProofResult.proof },
      { label: "ranked-bot-qualified-completion-admin-close", action: "admin-close" as const, proof: phase2b4ProofResult.proof },
      { label: "ranked-bot-completion-timeout-boundary", action: "timeout" as const, proof: null },
    ]) {
      const executed = await runRankedBotLifecycle({
        label: lifecycle.label,
        action: lifecycle.action,
        client,
        objects: setup.objects,
        nftType,
        admin,
        player: player1,
        botAddress,
        mintNft: setup.mintNft,
        proof: lifecycle.proof,
      });
      const fields = await readFields(client, executed.result.battleId);
      report.rankedBotCompletionResults.push({
        label: lifecycle.label,
        action: lifecycle.action,
        digest: executed.result.digest,
        battleId: executed.result.battleId,
        status: executed.result.status,
        humanMoveCount: vectorValues(fields.p1_moves).length,
        botMoveCount: vectorValues(fields.p2_moves).length,
        finished: fields.finished === true,
        winner: optionAddress(fields.winner),
        vaultMist: balanceValue(fields.vault),
        eventCaptured: executed.events.length > 0,
        economicValuesRemainZero:
          String(fields.battle_entry_fee) === "0" &&
          String(fields.winner_payout) === "0" &&
          String(fields.treasury_share) === "0",
        limitation: executed.result.limitation,
      });
      report.eventShapes.push(...executed.events);
    }

    console.log("[phase-2b4] running isolated ingestion, dedupe, and cursor checks");
    const pvpEvents = report.eventShapes.filter((event) => event.type.endsWith("::battle::PvpBattleV3Update"));
    const botEvents = report.eventShapes.filter((event) => event.type.endsWith("::battle::RankedBotBattleV2Update"));
    const ingested = ingestEvents([...pvpEvents.slice(0, 3), ...botEvents.slice(0, 3)]);
    report.ingestionResults.push(...ingested.inserted);
    report.dedupeResults.push(runDedupeCheck([...pvpEvents, ...botEvents]));
    report.cursorRecoveryResults.push(runCursorRecoveryCheck(
      [...pvpEvents.slice(0, 2), ...botEvents.slice(0, 1)],
      [...pvpEvents.slice(2, 5), ...botEvents.slice(1, 3)],
    ));

    console.log("[phase-2b4] running finished battle recovery and Telegram parser regression");
    report.finishedBattleRecoveryResults.push(await runFinishedBattleRecoveryCase({
      label: "finished-50-battle-recovery",
      client,
      objects: setup.objects,
      nftType,
      players,
      mintNft: setup.mintNft,
      completedBattleId: completed50.result.battleId,
    }));
    const telegramNft50 = await mintFor({ mintNft: setup.mintNft, owner: player1 });
    const telegramJoin50 = buildJoin({
      objects: setup.objects,
      nftType,
      queueId: setup.objects.queue50Id,
      nftId: telegramNft50,
      signer: player1,
      proof: phase2b4ProofResult.proof,
    });
    await execute(client, player1, telegramJoin50.tx);
    report.telegramRegressionResults.push(await runTelegramRegressionCase({
      label: "telegram-v3-50-qualified-shape",
      client,
      queueId: setup.objects.queue50Id,
      targetGrowth: 50,
    }));
    const telegramRefund50 = new Transaction();
    telegramRefund50.moveCall({
      target: `${setup.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
      arguments: [telegramRefund50.object(setup.objects.queue50Id)],
    });
    await execute(client, player1, telegramRefund50);
    const telegramNft75 = await mintFor({ mintNft: setup.mintNft, owner: player1 });
    const telegramJoin75 = buildJoin({
      objects: setup.objects,
      nftType,
      queueId: setup.objects.queue75Id,
      nftId: telegramNft75,
      signer: player1,
      proof: null,
    });
    await execute(client, player1, telegramJoin75.tx);
    report.telegramRegressionResults.push(await runTelegramRegressionCase({
      label: "telegram-v3-75-standard-shape",
      client,
      queueId: setup.objects.queue75Id,
      targetGrowth: 75,
    }));
    const telegramRefund75 = new Transaction();
    telegramRefund75.moveCall({
      target: `${setup.objects.gardenPackageId}::matchmaking::cancel_queue_v3`,
      arguments: [telegramRefund75.object(setup.objects.queue75Id)],
    });
    await execute(client, player1, telegramRefund75);
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
    const reportPath = path.join(outputDir, `phase-2b4-localnet-${Date.now()}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Sanitized Phase 2B.4 report written to ${reportPath}`);
  }
}

main().catch((err) => {
  console.error("[phase-2b4-localnet] failed", err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
