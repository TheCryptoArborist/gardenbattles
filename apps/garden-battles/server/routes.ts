import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { SuiClient } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { storage } from "./storage";
import {
  trackBattle,
  updateBattleFinishedAtByTransactionDigest,
  getBattleByOnChainId,
  getBattleByTransactionDigest,
  getPlayerStatsByAddress,
  getPlayerLeaderboardStats,
  getLeaderboard,
  getTotalPlayers,
  getRecentBattlesByAddress,
  getGlobalRecentBattles,
  type LeaderboardMode,
} from "./battle-storage";
import { startPvpQueueTelegramNotifier } from "./pvp-queue-telegram";
import {
  getTodayArboristTrial,
  submitTodayArboristTrial,
} from "./arborist-trials";
import { readBattleTransactionViaGraphQL } from "./sui-graphql";
import {
  createGraphqlTreePowerClient,
  getCachedFifthMoveEligibility,
  refreshFifthMoveEligibility,
} from "./tree-power-eligibility";
import {
  TREE_COIN_TYPE,
  normalizeSuiAddress,
} from "../shared/tree-power-eligibility";
import {
  buildFifthMoveAttestationPayload,
  encodeFifthMoveAttestationPayload,
  serializeFifthMoveAttestationPayload,
} from "../shared/fifth-move-attestation";
import { scanWalletAndKiosksForNft } from "../battle-gardenfrontend/src/lib/nftreeAccess";
import {
  readSuiDynamicFieldsWithRetry,
  readSuiObjectWithRetry,
  readSuiOwnedObjectsWithRetry,
} from "../battle-gardenfrontend/src/lib/suiRpc";

// ─── Sui polling configuration ────────────────────────────────────────────────
const SUI_RPC_URL =
  process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
const PACKAGE_ID =
  process.env.BATTLE_PACKAGE_ID ||
  process.env.PACKAGE_ID ||
  "0x50864e060caca53c7c50a355f7550276b52f91a0bd1e7b1e54ac9dbb754ef299";
const BATTLE_CALL_PACKAGE_ID =
  process.env.BATTLE_CALL_PACKAGE_ID ||
  "0x4a77289a2cd3d54c18f16a17cc7fe7b8890322e60e566df8683391d5a479f7ec";
const EVENT_PACKAGE_ID =
  process.env.BATTLE_EVENT_PACKAGE_ID ||
  process.env.BATTLE_ORIGINAL_PACKAGE_ID ||
  "0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b";
const MODULE = process.env.BATTLE_MODULE || "battle";
const BATTLE_UPDATE_EVENT = `${EVENT_PACKAGE_ID}::${MODULE}::BattleUpdate`;
const PVP_BATTLE_V2_EVENT_PACKAGE_ID =
  process.env.PVP_BATTLE_V2_EVENT_PACKAGE_ID ||
  process.env.BATTLE_PACKAGE_ID ||
  process.env.PACKAGE_ID ||
  PACKAGE_ID;
const PVP_BATTLE_V2_UPDATE_EVENT = `${PVP_BATTLE_V2_EVENT_PACKAGE_ID}::${MODULE}::PvpBattleV2Update`;
const PVP_BATTLE_V3_EVENT_PACKAGE_ID =
  process.env.PVP_BATTLE_V3_EVENT_PACKAGE_ID ||
  process.env.BATTLE_PACKAGE_ID ||
  process.env.PACKAGE_ID ||
  PACKAGE_ID;
const PVP_BATTLE_V3_UPDATE_EVENT = `${PVP_BATTLE_V3_EVENT_PACKAGE_ID}::${MODULE}::PvpBattleV3Update`;
const RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID =
  process.env.RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID ||
  process.env.BATTLE_PACKAGE_ID ||
  process.env.PACKAGE_ID ||
  PACKAGE_ID;
const RANKED_BOT_BATTLE_V2_UPDATE_EVENT = `${RANKED_BOT_BATTLE_V2_EVENT_PACKAGE_ID}::${MODULE}::RankedBotBattleV2Update`;
const POLL_INTERVAL_MS = 2_000; // poll every 2 s
const RANDOM_OBJECT_ID = process.env.SUI_RANDOM_OBJECT_ID || "0x8";
const LEADERBOARD_MODES = new Set<LeaderboardMode>(["pvp", "bot", "overall"]);
const FIFTH_MOVE_ATTESTATION_PRIVATE_KEY = process.env.FIFTH_MOVE_ATTESTATION_PRIVATE_KEY;
const FIFTH_MOVE_ATTESTATION_TTL_MS = Number(process.env.FIFTH_MOVE_ATTESTATION_TTL_MS ?? 180_000);
const FIFTH_MOVE_CONFIG_ID = normalizeSuiAddress(process.env.FIFTH_MOVE_CONFIG_ID) ?? "";
const FIFTH_MOVE_ATTESTATION_KEY_ID = process.env.FIFTH_MOVE_ATTESTATION_KEY_ID ?? "local-dev";
const FIFTH_MOVE_ATTESTATION_RATE_LIMIT_MS = Number(
  process.env.FIFTH_MOVE_ATTESTATION_RATE_LIMIT_MS ?? 5_000,
);
const FIFTH_MOVE_CONFIG_CACHE_MS = Number(process.env.FIFTH_MOVE_CONFIG_CACHE_MS ?? 30_000);
const FIFTH_MOVE_CONFIG_READ_TIMEOUT_MS = Number(process.env.FIFTH_MOVE_CONFIG_READ_TIMEOUT_MS ?? 5_000);
const SUI_RPC_PROXY_TIMEOUT_MS = Number(process.env.SUI_RPC_PROXY_TIMEOUT_MS ?? 10_000);
const NFTREE_STRUCT_TYPE =
  process.env.NFTREE_STRUCT_TYPE ||
  "0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT";
const NFTREE_ACCESS_READ_TIMEOUT_MS = Number(
  process.env.NFTREE_ACCESS_READ_TIMEOUT_MS ?? 5_000,
);

function isEnvEnabled(value: string | undefined): boolean {
  return ["true", "1", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

const BLOCKED_SUI_RPC_PROXY_METHODS = new Set([
  "sui_dryRunTransactionBlock",
  "sui_devInspectTransactionBlock",
]);

export function isAllowedSuiRpcProxyMethod(method: unknown): method is string {
  if (typeof method !== "string") return false;
  if (method === "rpc.discover") return true;
  if (method === "sui_executeTransactionBlock") return true;
  if (method.startsWith("unsafe_")) return false;
  if (BLOCKED_SUI_RPC_PROXY_METHODS.has(method)) return false;
  return (
    method.startsWith("sui_get") ||
    method.startsWith("sui_multiGet") ||
    method.startsWith("suix_get") ||
    method.startsWith("suix_query")
  );
}

function extractSuiRpcProxyMethods(body: unknown): string[] {
  const requests = Array.isArray(body) ? body : [body];
  return requests
    .map((request) =>
      request && typeof request === "object"
        ? (request as { method?: unknown }).method
        : null,
    )
    .filter((method): method is string => typeof method === "string");
}

function extractSuiRpcProxyErrors(body: unknown): Array<{
  id: unknown;
  code: unknown;
  message: unknown;
}> {
  const responses = Array.isArray(body) ? body : [body];
  return responses.flatMap((response) => {
    if (!response || typeof response !== "object") return [];
    const error = (response as { error?: unknown }).error;
    if (!error || typeof error !== "object") return [];
    return [
      {
        id: (response as { id?: unknown }).id ?? null,
        code: (error as { code?: unknown }).code ?? null,
        message: (error as { message?: unknown }).message ?? null,
      },
    ];
  });
}

const DISABLE_SUI_RELAY = isEnvEnabled(process.env.DISABLE_SUI_RELAY);

function getLeaderboardMode(value: unknown): LeaderboardMode {
  return typeof value === "string" && LEADERBOARD_MODES.has(value as LeaderboardMode)
    ? (value as LeaderboardMode)
    : "pvp";
}

function battleVersionForEventType(
  eventType: string,
): "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2" {
  if (eventType === PVP_BATTLE_V3_UPDATE_EVENT) return "pvp-v3";
  if (eventType === RANKED_BOT_BATTLE_V2_UPDATE_EVENT) return "bot-v2";
  if (eventType === PVP_BATTLE_V2_UPDATE_EVENT) return "pvp-v2";
  return "legacy";
}

// ─── Bot configuration ───────────────────────────────────────────────────────
const BOT_PRIVATE_KEY = process.env.BATTLE_BOT_PRIVATE_KEY;
const BOT_MOVE_DELAY_MS = Number(process.env.BATTLE_BOT_MOVE_DELAY_MS ?? 1_500);
const botClient = DISABLE_SUI_RELAY ? null : new SuiClient({ url: SUI_RPC_URL });
const botKeypair = !DISABLE_SUI_RELAY && BOT_PRIVATE_KEY
  ? (() => {
      const parsed = decodeSuiPrivateKey(BOT_PRIVATE_KEY);
      if (parsed.schema !== "ED25519") {
        throw new Error("BATTLE_BOT_PRIVATE_KEY must be an ED25519 Sui key");
      }
      return Ed25519Keypair.fromSecretKey(parsed.secretKey);
    })()
  : null;
const BOT_ADDRESS =
  process.env.BATTLE_BOT_ADDRESS?.toLowerCase() ||
  botKeypair?.getPublicKey().toSuiAddress().toLowerCase() ||
  null;
const processedBotTurns = new Set<string>();
let suiVerificationClient: SuiClient | null = null;
let fifthMoveSigner: Ed25519Keypair | null | undefined;
const fifthMoveAttestationRequests = new Map<string, number>();
export type LiveFifthMoveConfig = {
  id: string;
  enabled: boolean;
  utilityCoin: string;
  minUnderlyingTreeRaw: string;
  signerPublicKey: Uint8Array;
  configVersion: string;
  maxAttestationAgeMs: string;
};

type FifthMoveEligibilityForAttestation = Awaited<ReturnType<typeof getCachedFifthMoveEligibility>>;

export type FifthMoveAttestationRouteOptions = {
  getEligibility?: (wallet: string) => Promise<FifthMoveEligibilityForAttestation>;
  getSigner?: () => Ed25519Keypair | null;
  readConfig?: (serverSignerPublicKey: Uint8Array) => Promise<LiveFifthMoveConfig>;
  checkRateLimit?: (key: string) => boolean;
  nowMs?: () => number;
  ttlMs?: number;
  keyId?: string;
  expectedUtilityCoin?: string;
};
let cachedFifthMoveConfig:
  | { checkedAtMs: number; config: LiveFifthMoveConfig }
  | null = null;
let fifthMoveConfigReadInFlight: Promise<LiveFifthMoveConfig> | null = null;

function getSuiVerificationClient(): SuiClient {
  if (!suiVerificationClient) {
    suiVerificationClient = new SuiClient({ url: SUI_RPC_URL });
  }
  return suiVerificationClient;
}

const treePowerGraphqlClient = createGraphqlTreePowerClient();

function getFifthMoveSigner(): Ed25519Keypair | null {
  if (fifthMoveSigner !== undefined) return fifthMoveSigner;
  if (!FIFTH_MOVE_ATTESTATION_PRIVATE_KEY) {
    fifthMoveSigner = null;
    return fifthMoveSigner;
  }

  const parsed = decodeSuiPrivateKey(FIFTH_MOVE_ATTESTATION_PRIVATE_KEY);
  if (parsed.schema !== "ED25519") {
    throw new Error("FIFTH_MOVE_ATTESTATION_PRIVATE_KEY must be an ED25519 Sui key");
  }
  fifthMoveSigner = Ed25519Keypair.fromSecretKey(parsed.secretKey);
  return fifthMoveSigner;
}

function sourceBitmapFromEligibility(eligibility: Awaited<ReturnType<typeof getCachedFifthMoveEligibility>>): number {
  let bitmap = 0;
  for (const source of eligibility.sources ?? []) {
    if (source.status !== "qualified-data") continue;
    if (source.source === "suidex-v2" && source.reason?.includes("farmed")) {
      bitmap |= 1 << 1;
    } else if (source.source === "suidex-v2") {
      bitmap |= 1 << 0;
    } else if (source.source === "suidex-v3") {
      bitmap |= 1 << 2;
    } else if (source.source === "moonbags-staking") {
      bitmap |= 1 << 3;
    } else if (source.source === "tree-lock") {
      bitmap |= 1 << 4;
    }
  }
  return bitmap;
}

export function parseMoveU64(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "bigint" && value >= BigInt(0)) return value.toString();
  return null;
}

export function parseMoveTypeName(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const fields = (value as { fields?: Record<string, unknown> }).fields;
  const directName = fields?.name;
  if (typeof directName === "string") return directName;
  const nestedName = (directName as { fields?: Record<string, unknown> } | undefined)?.fields?.name;
  return typeof nestedName === "string" ? nestedName : null;
}

function normalizeMoveTypeName(value: string): string {
  const parts = value.split("::");
  if (parts.length < 3) return value;
  const [address, ...rest] = parts;
  const normalizedAddress = `0x${address.replace(/^0x/i, "").toLowerCase().padStart(64, "0")}`;
  return [normalizedAddress, ...rest].join("::");
}

export function parseMoveU8Vector(value: unknown): Uint8Array | null {
  if (typeof value === "string") {
    const encoded = value.trim();
    const isCanonicalBase64 =
      encoded.length % 4 === 0 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded);
    if (!isCanonicalBase64) return null;
    return Uint8Array.from(Buffer.from(encoded, "base64"));
  }

  const raw = Array.isArray(value)
    ? value
    : Array.isArray((value as { fields?: { contents?: unknown[] } } | undefined)?.fields?.contents)
      ? (value as { fields: { contents: unknown[] } }).fields.contents
      : null;
  if (!raw) return null;
  const bytes: number[] = [];
  for (const item of raw) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 255) {
      return null;
    }
    bytes.push(item);
  }
  return Uint8Array.from(bytes);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function assertExpectedSignerPublicKey(onChainKey: Uint8Array, serverKey: Uint8Array): void {
  if (onChainKey.length !== 32) {
    throw new Error("fifth_move_config_malformed_signer");
  }
  if (serverKey.length !== 32) {
    throw new Error("fifth_move_server_signer_malformed");
  }
  if (!Buffer.from(onChainKey).equals(Buffer.from(serverKey))) {
    throw new Error("fifth_move_signer_mismatch");
  }
}

export function validateLiveFifthMoveConfigFields(
  config: {
    id: string;
    enabled: boolean;
    utilityCoin: string | null;
    minUnderlyingTreeRaw: string | null;
    signerPublicKey: Uint8Array | null;
    configVersion: string | null;
    maxAttestationAgeMs: string | null;
  },
  serverSignerPublicKey: Uint8Array,
): LiveFifthMoveConfig {
  if (!config.signerPublicKey) {
    throw new Error("fifth_move_config_malformed_signer");
  }
  assertExpectedSignerPublicKey(config.signerPublicKey, serverSignerPublicKey);
  if (!config.utilityCoin || normalizeMoveTypeName(config.utilityCoin) !== normalizeMoveTypeName(TREE_COIN_TYPE)) {
    throw new Error("fifth_move_config_wrong_utility_coin");
  }
  if (!config.minUnderlyingTreeRaw || BigInt(config.minUnderlyingTreeRaw) <= BigInt(0)) {
    throw new Error("fifth_move_config_invalid_threshold");
  }
  if (!config.configVersion || BigInt(config.configVersion) <= BigInt(0)) {
    throw new Error("fifth_move_config_invalid_version");
  }
  if (!config.maxAttestationAgeMs || BigInt(config.maxAttestationAgeMs) <= BigInt(0)) {
    throw new Error("fifth_move_config_invalid_max_age");
  }
  if (!config.enabled) throw new Error("fifth_move_config_disabled");

  return {
    id: config.id,
    enabled: config.enabled,
    utilityCoin: normalizeMoveTypeName(config.utilityCoin),
    minUnderlyingTreeRaw: config.minUnderlyingTreeRaw,
    signerPublicKey: config.signerPublicKey,
    configVersion: config.configVersion,
    maxAttestationAgeMs: config.maxAttestationAgeMs,
  };
}

async function readLiveFifthMoveConfig(serverSignerPublicKey: Uint8Array): Promise<LiveFifthMoveConfig> {
  if (!FIFTH_MOVE_CONFIG_ID) {
    throw new Error("fifth_move_config_id_unconfigured");
  }

  const now = Date.now();
  if (cachedFifthMoveConfig && now - cachedFifthMoveConfig.checkedAtMs < FIFTH_MOVE_CONFIG_CACHE_MS) {
    assertExpectedSignerPublicKey(cachedFifthMoveConfig.config.signerPublicKey, serverSignerPublicKey);
    return cachedFifthMoveConfig.config;
  }

  if (!fifthMoveConfigReadInFlight) {
    fifthMoveConfigReadInFlight = (async () => {
      const object = await withTimeout(
        treePowerGraphqlClient.getObject({
          id: FIFTH_MOVE_CONFIG_ID,
          options: { showType: true, showContent: true },
        }),
        FIFTH_MOVE_CONFIG_READ_TIMEOUT_MS,
        "fifth_move_config_read",
      );

      if (object.error) {
        throw new Error(`fifth_move_config_read_failed:${object.error.code}`);
      }
      const data = object.data;
      if (!data || data.objectId.toLowerCase() !== FIFTH_MOVE_CONFIG_ID) {
        throw new Error("fifth_move_config_id_mismatch");
      }
      if (!data.type?.endsWith("::fifth_move::FifthMoveConfig")) {
        throw new Error("fifth_move_config_unexpected_type");
      }
      if (data.content?.dataType !== "moveObject") {
        throw new Error("fifth_move_config_unexpected_content");
      }

      const fields = data.content.fields as Record<string, unknown>;
      const enabled = fields.enabled === true;
      const utilityCoin = parseMoveTypeName(fields.utility_coin);
      const minUnderlyingTreeRaw = parseMoveU64(fields.min_underlying_tree_raw);
      const configVersion = parseMoveU64(fields.config_version);
      const maxAttestationAgeMs = parseMoveU64(fields.max_attestation_age_ms);
      const signerPublicKey = parseMoveU8Vector(fields.signer_public_key);

      return validateLiveFifthMoveConfigFields({
        id: data.objectId.toLowerCase(),
        enabled,
        utilityCoin,
        minUnderlyingTreeRaw,
        signerPublicKey,
        configVersion,
        maxAttestationAgeMs,
      }, serverSignerPublicKey);
    })().finally(() => {
      fifthMoveConfigReadInFlight = null;
    });
  }

  const config = await fifthMoveConfigReadInFlight;
  cachedFifthMoveConfig = { checkedAtMs: Date.now(), config };
  return config;
}

function checkFifthMoveRateLimit(key: string): boolean {
  const now = Date.now();
  const previous = fifthMoveAttestationRequests.get(key) ?? 0;
  if (now - previous < FIFTH_MOVE_ATTESTATION_RATE_LIMIT_MS) {
    return false;
  }
  fifthMoveAttestationRequests.set(key, now);
  return true;
}

export function createFifthMoveAttestationHandler(
  options: FifthMoveAttestationRouteOptions = {},
): RequestHandler {
  const getEligibility = options.getEligibility ?? ((wallet: string) =>
    refreshFifthMoveEligibility(treePowerGraphqlClient, wallet));
  const getSigner = options.getSigner ?? getFifthMoveSigner;
  const readConfig = options.readConfig ?? readLiveFifthMoveConfig;
  const checkRateLimit = options.checkRateLimit ?? checkFifthMoveRateLimit;
  const nowMs = options.nowMs ?? Date.now;
  const ttlMs = options.ttlMs ?? FIFTH_MOVE_ATTESTATION_TTL_MS;
  const keyId = options.keyId ?? FIFTH_MOVE_ATTESTATION_KEY_ID;

  return async (req, res) => {
    const wallet = typeof req.body?.wallet === "string" ? req.body.wallet.trim().toLowerCase() : "";
    if (!/^0x[a-f0-9]{64}$/.test(wallet)) {
      return res.status(400).json({ ok: false, reason: "invalid_sui_address" });
    }

    const rateLimitKey = `${req.ip ?? "unknown"}:${wallet}`;
    if (!checkRateLimit(rateLimitKey)) {
      return res.status(429).json({ ok: false, reason: "rate_limited" });
    }

    let signer: Ed25519Keypair | null;
    try {
      signer = getSigner();
    } catch (err) {
      console.warn("[fifth-move] signer configuration error", {
        message: err instanceof Error ? err.message : String(err),
      });
      return res.status(503).json({ ok: false, reason: "fifth_move_signer_invalid" });
    }

    try {
      const eligibility = await getEligibility(wallet);

      if (eligibility.status !== "qualified") {
        return res.json({
          ok: true,
          attestation: null,
          eligibility,
          reason: "wallet_not_qualified",
        });
      }

      if (!signer) {
        return res.status(503).json({
          ok: false,
          attestation: null,
          eligibility,
          reason: "fifth_move_signer_unconfigured",
        });
      }

      const liveConfig = await readConfig(signer.getPublicKey().toRawBytes());
      const expectedUtilityCoin = options.expectedUtilityCoin ?? TREE_COIN_TYPE;
      if (normalizeMoveTypeName(liveConfig.utilityCoin) !== normalizeMoveTypeName(expectedUtilityCoin)) {
        return res.status(503).json({
          ok: false,
          attestation: null,
          eligibility,
          reason: "fifth_move_config_wrong_utility_coin",
        });
      }
      const sourceBitmap = sourceBitmapFromEligibility(eligibility);
      if (sourceBitmap <= 0 || sourceBitmap > 31) {
        return res.status(503).json({
          ok: false,
          attestation: null,
          eligibility,
          reason: "fifth_move_source_bitmap_unavailable",
        });
      }

      const issuedAtMs = nowMs();
      const maxAgeMs = Number(liveConfig.maxAttestationAgeMs);
      const requestedTtlMs = Number.isFinite(ttlMs) && ttlMs > 0
        ? ttlMs
        : 180_000;
      const attestationTtlMs = Math.min(requestedTtlMs, maxAgeMs);
      const expiresAtMs = issuedAtMs + attestationTtlMs;
      const payload = buildFifthMoveAttestationPayload({
        fifthMoveConfigId: liveConfig.id,
        wallet,
        qualified: true,
        verifiedUnderlyingTreeRaw: eligibility.verifiedUnderlyingTreeRaw,
        thresholdRaw: liveConfig.minUnderlyingTreeRaw,
        sourceBitmap,
        configVersion: liveConfig.configVersion,
        issuedAtMs,
        expiresAtMs,
      });
      const payloadBytes = serializeFifthMoveAttestationPayload(payload);
      const signature = await signer.sign(payloadBytes);

      return res.json({
        ok: true,
        eligibility,
        attestation: {
          payload,
          payloadBytes: encodeFifthMoveAttestationPayload(payload),
          signature: Buffer.from(signature).toString("base64"),
          signerPublicKey: Buffer.from(signer.getPublicKey().toRawBytes()).toString("base64"),
          keyId,
          fifthMoveConfigId: liveConfig.id,
          expiresAtMs,
        },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "fifth_move_attestation_failed";
      const status = reason === "invalid_sui_address" ? 400 : 503;
      return res.status(status).json({ ok: false, reason });
    }
  };
}

export function createSuiRpcProxyHandler(options: {
  upstreamUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}): RequestHandler {
  const upstreamUrl = options.upstreamUrl ?? SUI_RPC_URL;
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? SUI_RPC_PROXY_TIMEOUT_MS;

  return async (req, res) => {
    const methods = extractSuiRpcProxyMethods(req.body);
    if (methods.length === 0) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid Sui JSON-RPC request." },
      });
    }

    const blockedMethod = methods.find((method) => !isAllowedSuiRpcProxyMethod(method));
    if (blockedMethod) {
      console.warn("[sui-rpc-proxy] blocked method", { method: blockedMethod });
      return res.status(403).json({
        jsonrpc: "2.0",
        id: Array.isArray(req.body) ? null : req.body?.id ?? null,
        error: { code: -32601, message: "Sui JSON-RPC method is not allowed by this proxy." },
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstreamResponse = await fetchImpl(upstreamUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body),
        signal: controller.signal,
      });
      const text = await upstreamResponse.text();
      try {
        const parsed = JSON.parse(text);
        const errors = extractSuiRpcProxyErrors(parsed);
        if (errors.length > 0) {
          console.warn("[sui-rpc-proxy] upstream json-rpc error", {
            methods,
            status: upstreamResponse.status,
            errors,
          });
        }
      } catch {
        if (!upstreamResponse.ok) {
          console.warn("[sui-rpc-proxy] upstream non-json response", {
            methods,
            status: upstreamResponse.status,
          });
        }
      }
      res.status(upstreamResponse.status);
      res.type(upstreamResponse.headers.get("content-type") ?? "application/json");
      return res.send(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn("[sui-rpc-proxy] upstream request failed", {
        methods,
        message,
      });
      return res.status(503).json({
        jsonrpc: "2.0",
        id: Array.isArray(req.body) ? null : req.body?.id ?? null,
        error: { code: -32000, message: "Sui RPC proxy upstream unavailable." },
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

function extractNftreeImageUrl(obj: any): string {
  const displayUrl = obj?.data?.display?.data?.image_url;
  const contentUrlField = obj?.data?.content?.fields?.image_url;
  if (typeof displayUrl === "string" && displayUrl.trim()) return displayUrl;
  if (typeof contentUrlField === "string") return contentUrlField;
  return contentUrlField?.fields?.url || contentUrlField?.url || "";
}

async function readNftreeForWallet(wallet: string) {
  const graphqlClient = {
    getOwnedObjects: (args: any) => readSuiOwnedObjectsWithRetry(args.owner, {
      operation: "nftree-server-owned-objects",
      structType: args.filter?.StructType,
      cursor: args.cursor,
      limit: args.limit,
    }),
    getDynamicFields: (args: { parentId: string }) => readSuiDynamicFieldsWithRetry(args.parentId, {
      operation: "nftree-server-kiosk-fields",
      limit: 50,
    }),
    getObject: (args: { id: string; options?: Record<string, unknown> }) => readSuiObjectWithRetry(null, args, {
      operation: "nftree-server-kiosk-object",
    }),
  };
  return scanWalletAndKiosksForNft(graphqlClient, wallet, [NFTREE_STRUCT_TYPE]);
}

async function walletHasNftreeAccess(wallet: string): Promise<boolean> {
  return !!(await withTimeout(readNftreeForWallet(wallet), 12_000, "trial_nftree_access"));
}

export function createNftreeAccessHandler(options: {
  client?: Pick<SuiClient, "getOwnedObjects">;
  nftreeStructType?: string;
  timeoutMs?: number;
} = {}): RequestHandler {
  const client = options.client;
  const nftreeStructType = options.nftreeStructType ?? NFTREE_STRUCT_TYPE;
  const timeoutMs = options.timeoutMs ?? NFTREE_ACCESS_READ_TIMEOUT_MS;

  return async (req, res) => {
    const wallet = normalizeSuiAddress(req.params.address);
    if (!wallet) {
      return res.status(400).json({ ok: false, error: "invalid_sui_address" });
    }

    try {
      if (!client) {
        const nft = await withTimeout(
          readNftreeForWallet(wallet),
          timeoutMs,
          "nftree_access_read",
        );
        return res.json({ ok: true, nft });
      }

      const page = await withTimeout(
        client.getOwnedObjects({
          owner: wallet,
          filter: { StructType: nftreeStructType },
          options: { showType: true, showContent: true, showDisplay: true },
          limit: 50,
        }),
        timeoutMs,
        "nftree_access_read",
      );

      const match = page.data.find((obj: any) => obj?.data?.type === nftreeStructType);
      if (!match?.data?.objectId) {
        return res.json({ ok: true, nft: null });
      }

      return res.json({
        ok: true,
        nft: {
          nftId: match.data.objectId,
          nftType: nftreeStructType,
          location: "wallet",
          imageUrl: extractNftreeImageUrl(match),
        },
      });
    } catch (err) {
      console.warn("[nftree-access] server lookup failed", {
        wallet,
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(503).json({
        ok: false,
        error: "nftree_access_unavailable",
      });
    }
  };
}

// ─── In-memory battle state ────────────────────────────────────────────────────
interface BattleState {
  battleId: string;
  player1: string;
  player2: string;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  turn: number;
  winner: string | null;
  finished?: boolean;
  isBotBattle?: boolean;
  lastMoveMs?: number;
  lastEventCursor?: string | null;
  battleVersion?: "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2";
  targetGrowth?: number | null;
  verifiedTransactionMs?: number;
}

// battleId → current state
const battles = new Map<string, BattleState>();

// address (lowercase) → battleId
const playerToBattle = new Map<string, string>();

// ─── Sui RPC helper ────────────────────────────────────────────────────────────
async function querySuiEvents(
  cursor: string | null = null,
  limit = 50,
  eventType = BATTLE_UPDATE_EVENT,
): Promise<{ data: any[]; nextCursor: string | null; hasNextPage: boolean }> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "suix_queryEvents",
    params: [
      { MoveEventType: eventType },
      cursor,
      limit,
      true, // descending so newest first
    ],
  };

  const res = await fetch(SUI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Sui RPC error: ${res.status}`);
  const json = await res.json();

  if (json.error)
    throw new Error(`Sui RPC error: ${JSON.stringify(json.error)}`);

  return {
    data: json.result?.data ?? [],
    nextCursor: json.result?.nextCursor ?? null,
    hasNextPage: json.result?.hasNextPage ?? false,
  };
}

// ─── Parse a raw Sui event into our BattleState shape ─────────────────────────
export function parseBattleEvent(
  parsedJson: any,
  battleVersion: "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2" = "legacy",
): BattleState | null {
  try {
    if (
      !parsedJson?.battle_id ||
      !parsedJson?.player1 ||
      !parsedJson?.player2
    ) {
      return null;
    }

    const player1 = parsedJson.player1.toLowerCase();
    const player2 = parsedJson.player2.toLowerCase();
    const winner = normalizeWinner(parsedJson.winner);
    const parsedTurn = Number(parsedJson.turn);
    const isBotBattle =
      battleVersion === "bot-v2" ||
      (battleVersion === "legacy" &&
        (Boolean(parsedJson.is_bot_battle) ||
          (!!BOT_ADDRESS && (player1 === BOT_ADDRESS || player2 === BOT_ADDRESS))));
    const targetGrowth =
      battleVersion === "pvp-v2" || battleVersion === "pvp-v3" || battleVersion === "bot-v2"
        ? Number(parsedJson.target_growth)
        : isBotBattle
          ? 50
          : 100;

    return {
      battleId: parsedJson.battle_id,
      player1,
      player2,
      player1Moves: parsedJson.player1_moves ?? [],
      player2Moves: parsedJson.player2_moves ?? [],
      player1Growth: Number(parsedJson.player1_growth ?? 0),
      player2Growth: Number(parsedJson.player2_growth ?? 0),
      turn: Number.isFinite(parsedTurn) ? parsedTurn : 0,
      winner,
      finished: !!winner,
      isBotBattle,
      lastMoveMs: Number(parsedJson.last_move_ms ?? 0),
      battleVersion,
      targetGrowth: Number.isFinite(targetGrowth) && targetGrowth > 0 ? targetGrowth : null,
    };
  } catch {
    return null;
  }
}

async function getVerifiedBattleStateFromTransaction(
  digest: string,
): Promise<BattleState | null> {
  const tx = await readBattleTransactionViaGraphQL(digest);

  const status = tx.effects?.status?.status;
  if (status && status !== "success") {
    return null;
  }

  const states =
    tx.events
      ?.filter(
        (event: any) =>
          event.type === BATTLE_UPDATE_EVENT ||
          event.type === PVP_BATTLE_V2_UPDATE_EVENT ||
          event.type === PVP_BATTLE_V3_UPDATE_EVENT ||
          event.type === RANKED_BOT_BATTLE_V2_UPDATE_EVENT,
      )
      .map((event: any) =>
        parseBattleEvent(
          event.parsedJson,
          battleVersionForEventType(event.type),
        ),
      )
      .filter((state: BattleState | null): state is BattleState => !!state) ?? [];

  const verifiedState = (
    states.find((state) => !!state.winner) ??
    states[states.length - 1] ??
    null
  );
  return verifiedState
    ? { ...verifiedState, verifiedTransactionMs: tx.timestampMs }
    : null;
}

async function hydrateBattleState(
  eventState: BattleState,
): Promise<BattleState> {
  if (!botClient) return eventState;

  try {
    const object = await botClient.getObject({
      id: eventState.battleId,
      options: { showContent: true },
    });
    const fields = (object.data?.content as any)?.fields;
    if (!fields?.player1 || !fields?.player2) return eventState;

    const winner = normalizeWinner(fields.winner);
    return {
      battleId: eventState.battleId,
      player1: String(fields.player1).toLowerCase(),
      player2: String(fields.player2).toLowerCase(),
      player1Moves: (fields.p1_moves ?? []).map(Number),
      player2Moves: (fields.p2_moves ?? []).map(Number),
      player1Growth: Number(fields.p1_growth ?? 0),
      player2Growth: Number(fields.p2_growth ?? 0),
      turn: Number(fields.turn ?? 0),
      winner,
      finished: Boolean(fields.finished) || !!winner,
      isBotBattle: Boolean(fields.is_bot_battle),
      lastMoveMs: Number(fields.last_move_ms ?? 0),
      battleVersion: eventState.battleVersion,
      targetGrowth:
        eventState.battleVersion === "pvp-v2" ||
        eventState.battleVersion === "pvp-v3" ||
        eventState.battleVersion === "bot-v2"
          ? Number(fields.target_growth ?? eventState.targetGrowth ?? 0)
          : eventState.targetGrowth,
    };
  } catch (err) {
    console.warn(
      `[relay] could not hydrate battle ${eventState.battleId.slice(0, 8)}...`,
      err,
    );
    return eventState;
  }
}

function normalizeWinner(value: any): string | null {
  if (!value || value === "0x0") return null;

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (Array.isArray(value)) {
    return normalizeWinner(value[0]);
  }

  if (typeof value === "object") {
    return normalizeWinner(
      value.vec ?? value.fields?.vec ?? value.fields?.value ?? value.value,
    );
  }

  return null;
}

function chooseBotMove(state: BattleState, botIsPlayer1: boolean): number | null {
  const moves = botIsPlayer1 ? state.player1Moves : state.player2Moves;
  if (!moves.length) return null;

  const botGrowth = botIsPlayer1 ? state.player1Growth : state.player2Growth;
  const opponentGrowth = botIsPlayer1 ? state.player2Growth : state.player1Growth;

  const available = new Set(moves);
  const firstAvailable = (ids: number[]) => ids.find((id) => available.has(id));

  if (botGrowth >= 82) {
    const finisher = firstAvailable([25, 26, 24, 22, 30, 28, 21, 20]);
    if (finisher) return finisher;
  }

  if (opponentGrowth >= 80) {
    const defense = firstAvailable([27, 8, 29, 11, 3, 7, 1, 5]);
    if (defense) return defense;
  }

  return (
    firstAvailable([26, 25, 24, 22, 11, 3, 30, 28, 21, 20, 9, 7, 1, 5, 13, 8]) ??
    moves[Math.floor(Math.random() * moves.length)] ??
    null
  );
}

async function maybeRunBotTurn(state: BattleState) {
  if (DISABLE_SUI_RELAY || !botClient || !botKeypair || !BOT_ADDRESS || state.winner) return;

  const botIsPlayer1 = state.player1 === BOT_ADDRESS;
  const botIsPlayer2 = state.player2 === BOT_ADDRESS;
  if (!botIsPlayer1 && !botIsPlayer2) return;

  const isBotTurn =
    (botIsPlayer1 && state.turn === 0) || (botIsPlayer2 && state.turn === 1);
  if (!isBotTurn) return;

  const turnKey = [
    state.battleId,
    state.turn,
    state.player1Growth,
    state.player2Growth,
    state.player1Moves.join(","),
    state.player2Moves.join(","),
  ].join(":");
  if (processedBotTurns.has(turnKey)) return;
  processedBotTurns.add(turnKey);

  const moveId = chooseBotMove(state, botIsPlayer1);
  if (!moveId) return;

  setTimeout(async () => {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${BATTLE_CALL_PACKAGE_ID}::${MODULE}::use_ability_id`,
        arguments: [
          tx.object(state.battleId),
          tx.pure.u8(moveId),
          tx.object(RANDOM_OBJECT_ID),
        ],
      });

      const result = await botClient.signAndExecuteTransaction({
        signer: botKeypair,
        transaction: tx,
        options: { showEffects: true },
      });

      console.log(
        `[bot] battle ${state.battleId.slice(0, 8)}… used move ${moveId}; tx=${result.digest}`,
      );
    } catch (err) {
      processedBotTurns.delete(turnKey);
      console.error("[bot] failed to submit move:", err);
    }
  }, BOT_MOVE_DELAY_MS);
}

// ─── Core poll – fetch recent events, update state, notify clients ─────────────
let io: SocketIOServer | null = null;

async function pollSuiEvents() {
  try {
    // We only need the most recent page (descending).
    const eventPages = await Promise.all([
      querySuiEvents(null, 50, RANKED_BOT_BATTLE_V2_UPDATE_EVENT),
      querySuiEvents(null, 50, PVP_BATTLE_V3_UPDATE_EVENT),
      querySuiEvents(null, 50, PVP_BATTLE_V2_UPDATE_EVENT),
      querySuiEvents(null, 50, BATTLE_UPDATE_EVENT),
    ]);
    const data = eventPages.flatMap((page) => page.data ?? []);

    // Track newest event per battleId (data is descending, so first = newest)
    const seen = new Set<string>();

    for (const event of data) {
      const eventType = event.type ?? event.eventType ?? "";
      const eventState = parseBattleEvent(
        event.parsedJson,
        battleVersionForEventType(eventType),
      );
      if (!eventState) continue;
      const parsed = await hydrateBattleState(eventState);

      const { battleId } = parsed;
      if (seen.has(battleId)) continue; // already processed newest for this battle
      seen.add(battleId);

      const existing = battles.get(battleId);

      // Skip if nothing changed (check growth, winner, and moves)
      if (
        existing &&
        existing.player1Growth === parsed.player1Growth &&
        existing.player2Growth === parsed.player2Growth &&
        existing.turn === parsed.turn &&
        existing.winner === parsed.winner &&
        JSON.stringify(existing.player1Moves) ===
          JSON.stringify(parsed.player1Moves) &&
        JSON.stringify(existing.player2Moves) ===
          JSON.stringify(parsed.player2Moves)
      ) {
        continue;
      }

      // Persist latest state
      battles.set(battleId, parsed);
      if (parsed.winner) {
        // Track finished battle for leaderboard/stats (only once per battle)
        const alreadyTracked = getBattleByOnChainId(battleId);
        if (!alreadyTracked) {
          trackBattle({
            battleId,
            player1: parsed.player1,
            player2: parsed.player2,
            winner: parsed.winner,
            isBotBattle: parsed.isBotBattle ?? false,
            battleVersion: parsed.battleVersion ?? "legacy",
            targetGrowth: parsed.targetGrowth ?? null,
            transactionDigest:
              event.id?.txDigest ?? event.id?.tx_digest ?? event.txDigest ?? null,
            finishedAt: parsed.lastMoveMs ?? Date.now(),
          });
        }

        if (playerToBattle.get(parsed.player1) === battleId) {
          playerToBattle.delete(parsed.player1);
        }
        if (playerToBattle.get(parsed.player2) === battleId) {
          playerToBattle.delete(parsed.player2);
        }
      } else {
        playerToBattle.set(parsed.player1, battleId);
        playerToBattle.set(parsed.player2, battleId);
      }
      void maybeRunBotTurn(parsed);

      // Broadcast to the Socket.io room for this battle
      if (io) {
        io.to(`battle:${battleId}`).emit("battle_update", parsed);
        console.log(
          `[relay] battle ${battleId.slice(0, 8)}… p1=${parsed.player1Growth} p2=${parsed.player2Growth} turn=${parsed.turn} winner=${parsed.winner ?? "none"}`,
        );
      }
    }
  } catch (err) {
    console.error("[relay] poll error:", err);
  }
}

// ─── registerRoutes ───────────────────────────────────────────────────────────
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // ── Socket.io setup ─────────────────────────────────────────────────────────
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[relay] client connected: ${socket.id}`);

    // Client tells us which player address it is
    socket.on(
      "identify",
      (payload: { address: string }, ack?: (res: any) => void) => {
        const address = payload?.address?.toLowerCase();
        if (!address) return;

        socket.data.address = address;
        console.log(
          `[relay] identified ${socket.id} as ${address.slice(0, 8)}…`,
        );

        // If there's already an active battle for this player, auto-join the room
        const existingBattleId = playerToBattle.get(address);
        if (existingBattleId) {
          const state = battles.get(existingBattleId);
          if (state && !state.winner) {
            socket.join(`battle:${existingBattleId}`);
            socket.emit("battle_update", state);
            console.log(
              `[relay] rejoined ${address.slice(0, 8)}… to battle ${existingBattleId.slice(0, 8)}…`,
            );
          }
        }

        if (ack) ack({ ok: true });
      },
    );

    // Client explicitly joins a battle room (called after matchmaking)
    socket.on(
      "join_battle",
      (payload: { battleId: string }, ack?: (res: any) => void) => {
        const { battleId } = payload ?? {};
        if (!battleId) return;

        socket.join(`battle:${battleId}`);
        console.log(
          `[relay] ${socket.id} joined room battle:${battleId.slice(0, 8)}…`,
        );

        // Send current state immediately if we have it
        const state = battles.get(battleId);
        if (state) {
          socket.emit("battle_update", state);
        }

        if (ack) ack({ ok: true, state: state ?? null });
      },
    );

    // Client asks for latest state for a given player address
    socket.on(
      "get_battle_state",
      (payload: { address: string }, ack?: (res: any) => void) => {
        const address = payload?.address?.toLowerCase();
        if (!address || !ack) return;

        const battleId = playerToBattle.get(address);
        const state = battleId ? (battles.get(battleId) ?? null) : null;
        ack({ state: state && !state.winner ? state : null });
      },
    );

    socket.on("disconnect", () => {
      console.log(`[relay] client disconnected: ${socket.id}`);
    });
  });

  app.post("/api/sui-rpc", createSuiRpcProxyHandler());
  app.get("/api/nftree-access/:address", createNftreeAccessHandler());

  // ── REST: health check ──────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      service: "garden-battles-api",
    });
  });

  app.get("/api/tree-power/eligibility/:address", async (req, res) => {
    const address = typeof req.params.address === "string" ? req.params.address : "";

    try {
      const readEligibility = req.query.refresh === "1"
        ? refreshFifthMoveEligibility
        : getCachedFifthMoveEligibility;
      const eligibility = await readEligibility(
        treePowerGraphqlClient,
        address,
      );
      return res.json(eligibility);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "tree_power_eligibility_failed";
      const status = reason === "invalid_sui_address" ? 400 : 503;
      return res.status(status).json({ error: reason });
    }
  });

  // ── REST: verified battle record submission for leaderboard ingestion ─────
  app.post("/api/tree-power/fifth-move-attestation", createFifthMoveAttestationHandler());

  app.post("/api/battle-records/submit", async (req, res) => {
    const transactionDigest =
      typeof req.body?.transaction_digest === "string"
        ? req.body.transaction_digest.trim()
        : "";

    if (!transactionDigest) {
      return res.status(400).json({
        ok: false,
        recorded: false,
        reason: "transaction_digest_required",
      });
    }

    try {
      const verifiedState =
        await getVerifiedBattleStateFromTransaction(transactionDigest);

      if (!verifiedState) {
        return res.status(400).json({
          ok: false,
          recorded: false,
          reason: "no_valid_battle_update",
        });
      }

      if (!verifiedState.winner) {
        return res.status(400).json({
          ok: false,
          recorded: false,
          reason: "battle_not_finished",
        });
      }

      const existingDigestRecord =
        getBattleByTransactionDigest(transactionDigest);
      if (existingDigestRecord) {
        const repaired = verifiedState.verifiedTransactionMs
          ? updateBattleFinishedAtByTransactionDigest(
              transactionDigest,
              verifiedState.verifiedTransactionMs,
            )
          : false;
        return res.json({
          ok: true,
          recorded: false,
          reason: "already_recorded",
          repaired,
        });
      }

      if (getBattleByOnChainId(verifiedState.battleId)) {
        return res.json({
          ok: true,
          recorded: false,
          reason: "already_recorded",
        });
      }

      trackBattle({
        battleId: verifiedState.battleId,
        player1: verifiedState.player1,
        player2: verifiedState.player2,
        winner: verifiedState.winner,
        isBotBattle: verifiedState.isBotBattle ?? false,
        battleVersion: verifiedState.battleVersion ?? "legacy",
        targetGrowth: verifiedState.targetGrowth ?? null,
        transactionDigest,
        finishedAt:
          verifiedState.verifiedTransactionMs ||
          verifiedState.lastMoveMs ||
          Date.now(),
      });

      return res.json({
        ok: true,
        recorded: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[leaderboard] battle record submission failed: ${message}`);
      return res.status(400).json({
        ok: false,
        recorded: false,
        reason: "transaction_verification_failed",
      });
    }
  });

  // ── REST: expose bot address so the client can create practice battles ─────
  app.get("/api/battle/bot", (_req, res) => {
    if (!BOT_ADDRESS) {
      return res
        .status(503)
        .json({ error: "Battle bot is not configured on this server" });
    }
    res.json({ address: BOT_ADDRESS });
  });

  // ── REST: Arborist Trials daily challenge and ranked attempt ─────────────
  app.get("/api/arborist-trials/today", async (req, res) => {
    const wallet = typeof req.query.wallet === "string" ? req.query.wallet : undefined;
    const normalizedWallet = wallet ? normalizeSuiAddress(wallet) : null;
    let nftreeAccess: "not_connected" | "eligible" | "ineligible" | "unavailable" = "not_connected";
    let fifthMoveAccess: "not_connected" | "qualified" | "not-qualified" | "verification-incomplete" | "unavailable" = "not_connected";
    let fifthMoveEligibility: Awaited<ReturnType<typeof refreshFifthMoveEligibility>> | null = null;
    if (normalizedWallet) {
      const [nftreeResult, fifthMoveResult] = await Promise.allSettled([
        walletHasNftreeAccess(normalizedWallet),
        refreshFifthMoveEligibility(treePowerGraphqlClient, normalizedWallet),
      ]);
      if (nftreeResult.status === "fulfilled") {
        nftreeAccess = nftreeResult.value ? "eligible" : "ineligible";
      } else {
        console.warn("[arborist-trials] NFTree access check failed", {
          wallet: normalizedWallet,
          error: nftreeResult.reason instanceof Error ? nftreeResult.reason.message : String(nftreeResult.reason),
        });
        nftreeAccess = "unavailable";
      }
      if (fifthMoveResult.status === "fulfilled") {
        fifthMoveEligibility = fifthMoveResult.value;
        fifthMoveAccess = fifthMoveResult.value.status;
      } else {
        console.warn("[arborist-trials] fifth-card access check failed", {
          wallet: normalizedWallet,
          error: fifthMoveResult.reason instanceof Error ? fifthMoveResult.reason.message : String(fifthMoveResult.reason),
        });
        fifthMoveAccess = "unavailable";
      }
    }
    return res.json({
      ...getTodayArboristTrial(wallet),
      nftreeAccess,
      fifthMoveAccess,
      fifthMoveUnlocked: fifthMoveAccess === "qualified",
      fifthMoveEligibility,
    });
  });

  app.post("/api/arborist-trials/results", async (req, res) => {
    const submission = await submitTodayArboristTrial(req.body ?? {}, new Date(), {
      hasNftreeAccess: walletHasNftreeAccess,
      getFifthMoveUnlocked: async (wallet) => {
        const eligibility = await refreshFifthMoveEligibility(
          treePowerGraphqlClient,
          wallet,
        );
        return eligibility.status === "qualified";
      },
    });
    return res.status(submission.status).json(submission.body);
  });

  // ── REST: get battle state by player address ────────────────────────────────
  app.get("/api/battle/state/:address", (req, res) => {
    const address = req.params.address?.toLowerCase();
    const battleId = playerToBattle.get(address);
    if (!battleId) {
      return res.status(404).json({ error: "No active battle found" });
    }
    const state = battles.get(battleId);
    if (!state || state.winner) {
      return res.status(404).json({ error: "No active battle found" });
    }
    res.json({ state: state ?? null });
  });

  // ── REST: Leaderboard ────────────────────────────────────────────────────────
  app.get("/api/leaderboard", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const mode = getLeaderboardMode(req.query.mode);
    const entries = getLeaderboard(limit, offset, mode);
    res.json({
      leaderboard: entries,
      total: getTotalPlayers(mode),
      limit,
      offset,
      mode,
    });
  });

  // ── REST: Player stats ────────────────────────────────────────────────────────
  app.get("/api/player/:address/stats", (req, res) => {
    const address = req.params.address?.toLowerCase();
    if (!address) return res.status(400).json({ error: "Address required" });

    const requestedMode = typeof req.query.mode === "string" ? req.query.mode : null;
    if (requestedMode) {
      const mode = getLeaderboardMode(requestedMode);
      const modeStats = getPlayerLeaderboardStats(address, mode);
      if (!modeStats) {
        return res.json({
          address,
          wins: 0,
          losses: 0,
          total_battles: 0,
          current_streak: 0,
          max_win_streak: 0,
          rank_title: "Grove Recruit",
          badges: [],
          win_rate: 0,
          total_bot_wins: 0,
          total_bot_losses: 0,
          mode,
          last_played: null,
          recent_result: null,
          ranked: false,
          pvp_target_counts: {
            quick_50: 0,
            standard_75: 0,
            legacy_100: 0,
          },
        });
      }

      return res.json({
        address: modeStats.address,
        wins: modeStats.wins,
        losses: modeStats.losses,
        total_battles: modeStats.total_battles,
        current_streak: modeStats.current_streak,
        max_win_streak: 0,
        rank_title: modeStats.rank_title,
        badges: modeStats.badges,
        win_rate: modeStats.win_rate,
        total_bot_wins: mode === "bot" ? modeStats.wins : 0,
        total_bot_losses: mode === "bot" ? modeStats.losses : 0,
        mode,
        last_played: modeStats.last_played,
        recent_result: modeStats.recent_result,
        ranked: modeStats.ranked,
        pvp_target_counts: modeStats.pvp_target_counts,
      });
    }

    const stats = getPlayerStatsByAddress(address);
    if (!stats) {
      return res.json({
        address,
        wins: 0,
        losses: 0,
        total_battles: 0,
        current_streak: 0,
        max_win_streak: 0,
        rank_title: "Grove Recruit",
        badges: [],
        win_rate: 0,
        total_bot_wins: 0,
        total_bot_losses: 0,
      });
    }

    res.json({
      address: stats.address,
      wins: stats.wins,
      losses: stats.losses,
      total_battles: stats.total_battles,
      current_streak: stats.current_streak,
      max_win_streak: stats.max_win_streak,
      rank_title: stats.rank_title,
      badges: JSON.parse(stats.badges || "[]"),
      win_rate: +stats.win_rate.toFixed(4),
      total_bot_wins: stats.total_bot_wins,
      total_bot_losses: stats.total_bot_losses,
    });
  });

  // ── REST: Player recent battles ────────────────────────────────────────────────
  app.get("/api/player/:address/battles", (req, res) => {
    const address = req.params.address?.toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (!address) return res.status(400).json({ error: "Address required" });

    const battles = getRecentBattlesByAddress(address, limit);
    res.json({ battles });
  });

  // ── REST: Global recent battles ────────────────────────────────────────────────
  app.get("/api/battles/recent", (_req, res) => {
    const limit = Math.min(Number(_req.query.limit) || 20, 50);
    const battles = getGlobalRecentBattles(limit);
    res.json({ battles });
  });

  // ── REST: Top players endpoint (aliased for leaderboard page) ─────────────────
  app.get("/api/top-players", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 100);
    const mode = getLeaderboardMode(req.query.mode);
    const entries = getLeaderboard(limit, 0, mode);
    res.json(entries);
  });

  // ── Start Sui polling loop ──────────────────────────────────────────────────
  if (DISABLE_SUI_RELAY) {
    console.log("[relay] disabled by DISABLE_SUI_RELAY=true");
  } else {
    console.log(
      `[relay] starting Sui event polling every ${POLL_INTERVAL_MS / 1000}s`,
    );
    pollSuiEvents(); // immediate first poll
    setInterval(pollSuiEvents, POLL_INTERVAL_MS);
  }

  startPvpQueueTelegramNotifier();

  return httpServer;
}
