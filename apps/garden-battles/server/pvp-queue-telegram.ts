import { SuiClient } from "@mysten/sui/client";
import {
  getActivePvpQueueTelegramAlert,
  getPvpQueueTelegramAlertByKey,
  resolveActivePvpQueueTelegramAlerts,
  resolvePvpQueueTelegramAlert,
  upsertNotifiedPvpQueueTelegramAlert,
  type PvpQueueTelegramAlertRow,
} from "./battle-storage";

const DEFAULT_SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443";
const DEFAULT_MATCHMAKING_QUEUE_ID =
  "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d";
const DEFAULT_BATTLE_URL = "https://nftree.net/battle";
const DEFAULT_POLL_INTERVAL_MS = 30_000;
const MIN_POLL_INTERVAL_MS = 15_000;
const RPC_TIMEOUT_MS = 10_000;
const TELEGRAM_TIMEOUT_MS = 10_000;

export interface PendingQueueEntry {
  queueId: string;
  player: string;
  entryFeeMist: number;
  objectVersion: string | null;
  previousTransaction: string | null;
  queueEntryKey: string;
  targetGrowth: 50 | 75 | 100;
  displayLabel: string;
  queueType: "legacy" | "v2" | "v3";
}

export interface PvpQueueDefinition {
  queueId: string;
  targetGrowth: 50 | 75 | 100;
  displayLabel: string;
  queueType: "legacy" | "v2" | "v3";
}

interface TelegramQueueNotifierOptions {
  suiRpcUrl?: string;
  queueId?: string;
  queues?: PvpQueueDefinition[];
  enabled?: boolean;
  botToken?: string;
  chatId?: string;
  messageThreadId?: number | string | null;
  battleUrl?: string;
  pollIntervalMs?: number;
  suiClient?: QueueSuiClient;
  telegramClient?: TelegramClient;
  store?: QueueAlertStore;
}

interface QueueSuiClient {
  getObject(input: {
    id: string;
    options: { showContent: boolean };
  }): Promise<any>;
}

interface TelegramClient {
  sendMessage(input: {
    botToken: string;
    chatId: string;
    messageThreadId?: number | null;
    text: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ messageId: string | null }>;
}

export interface QueueAlertStore {
  getActive(queueId: string): PvpQueueTelegramAlertRow | null;
  getByKey(queueEntryKey: string): PvpQueueTelegramAlertRow | null;
  markNotified(input: {
    entry: PendingQueueEntry;
    telegramMessageId: string | null;
    notifiedAt: number;
  }): void;
  resolve(queueEntryKey: string, resolvedAt?: number): void;
  resolveActive(queueId: string, resolvedAt?: number): void;
}

interface QueuePollResult {
  status: "empty" | "notified" | "skipped" | "error";
  reason?: string;
  entryKey?: string;
}

let stopSingletonNotifier: (() => void) | null = null;

function isEnvEnabled(value: string | undefined): boolean {
  return ["true", "1", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}

function isEnvDisabled(value: string | undefined): boolean {
  return ["false", "0", "no", "off"].includes((value ?? "").trim().toLowerCase());
}

export function validateTelegramChatId(value: string | undefined): string {
  const chatId = (value ?? "").trim();
  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID is required");
  }

  if (/^https?:\/\/t\.me\//i.test(chatId)) {
    throw new Error(
      "TELEGRAM_CHAT_ID must be a numeric chat ID or @username, not a t.me URL",
    );
  }

  if (/^-?\d+$/.test(chatId) || /^@[A-Za-z0-9_]{5,}$/.test(chatId)) {
    return chatId;
  }

  throw new Error("TELEGRAM_CHAT_ID must be a numeric chat ID or @username");
}

export function parseTelegramMessageThreadId(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;

  const threadId =
    typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(threadId) || threadId <= 0) {
    throw new Error("TELEGRAM_MESSAGE_THREAD_ID must be a positive integer");
  }

  return threadId;
}

function formatSui(mist: number): string {
  return `${(mist / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  })} SUI`;
}

function shortAddress(address: string): string {
  return address.length > 14
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function readMoveOptionVec(value: any): any[] {
  const vec =
    value?.fields?.vec ??
    value?.vec ??
    value?.fields?.value?.fields?.vec ??
    value?.value?.fields?.vec;
  return Array.isArray(vec) ? vec : [];
}

function readPendingQueueEntry(value: any): any | null {
  if (!value) return null;

  const optionEntry = readMoveOptionVec(value)[0];
  if (optionEntry) return optionEntry;

  if (value?.fields?.player || value?.player) return value;

  return null;
}

function buildQueueEntryKey(input: {
  queueId: string;
  player: string;
  objectVersion: string | null;
  previousTransaction: string | null;
  entryFeeMist: number;
}): string {
  if (input.previousTransaction) {
    return `${input.queueId}:${input.player}:${input.previousTransaction}`;
  }

  return `${input.queueId}:${input.player}:${input.objectVersion ?? "unknown-version"}:${input.entryFeeMist}`;
}

function normalizeQueueId(value: string | undefined | null): string {
  return (value ?? "").trim();
}

export function getConfiguredPvpQueueDefinitions(env: NodeJS.ProcessEnv = process.env): PvpQueueDefinition[] {
  const legacyQueueId =
    normalizeQueueId(env.LEGACY_MATCHMAKING_QUEUE_ID) ||
    normalizeQueueId(env.MATCHMAKING_QUEUE_ID) ||
    normalizeQueueId(env.PVP_MATCHMAKING_QUEUE_ID) ||
    DEFAULT_MATCHMAKING_QUEUE_ID;
  const queue50Id = normalizeQueueId(env.MATCHMAKING_QUEUE_50_ID);
  const queue75Id = normalizeQueueId(env.MATCHMAKING_QUEUE_75_ID);
  const queueV350Id = normalizeQueueId(env.MATCHMAKING_QUEUE_V3_50_ID);
  const queueV375Id = normalizeQueueId(env.MATCHMAKING_QUEUE_V3_75_ID);
  const queues: PvpQueueDefinition[] = [];

  if (legacyQueueId) {
    queues.push({
      queueId: legacyQueueId,
      targetGrowth: 100,
      displayLabel: "Legacy Match",
      queueType: "legacy",
    });
  }

  if (queue50Id) {
    queues.push({
      queueId: queue50Id,
      targetGrowth: 50,
      displayLabel: "Quick Match",
      queueType: "v2",
    });
  }

  if (queue75Id) {
    queues.push({
      queueId: queue75Id,
      targetGrowth: 75,
      displayLabel: "Standard Match",
      queueType: "v2",
    });
  }

  if (queueV350Id) {
    queues.push({
      queueId: queueV350Id,
      targetGrowth: 50,
      displayLabel: "Quick Match",
      queueType: "v3",
    });
  }

  if (queueV375Id) {
    queues.push({
      queueId: queueV375Id,
      targetGrowth: 75,
      displayLabel: "Standard Match",
      queueType: "v3",
    });
  }

  return queues;
}

function readQueueTargetGrowth(obj: any): number | null {
  const raw = obj?.data?.content?.fields?.target_growth;
  const target = Number(raw);
  return Number.isFinite(target) && target > 0 ? target : null;
}

export function parsePendingQueueEntry(
  obj: any,
  queue: PvpQueueDefinition,
): PendingQueueEntry | null {
  if (queue.queueType === "v2" || queue.queueType === "v3") {
    const onChainTarget = readQueueTargetGrowth(obj);
    if (onChainTarget !== queue.targetGrowth) {
      throw new Error(
        `Configured ${queue.displayLabel} queue target mismatch: expected ${queue.targetGrowth}, got ${onChainTarget ?? "missing"}`,
      );
    }
  }

  const objectVersion =
    obj?.data?.version != null ? String(obj.data.version) : null;
  const previousTransaction =
    typeof obj?.data?.previousTransaction === "string"
      ? obj.data.previousTransaction
      : null;
  const fields = obj?.data?.content?.fields;
  const pending = readPendingQueueEntry(fields?.waiting);
  const pendingFields = pending?.fields ?? pending;
  const player =
    typeof pendingFields?.player === "string"
      ? pendingFields.player.toLowerCase()
      : null;

  if (!player) return null;

  const entryFeeMist = Number(pendingFields?.entry_fee_snapshot ?? 0);
  if (!Number.isFinite(entryFeeMist) || entryFeeMist < 0) return null;

  return {
    queueId: queue.queueId,
    player,
    entryFeeMist,
    objectVersion,
    previousTransaction,
    queueEntryKey: buildQueueEntryKey({
      queueId: queue.queueId,
      player,
      objectVersion,
      previousTransaction,
      entryFeeMist,
    }),
    targetGrowth: queue.targetGrowth,
    displayLabel: queue.displayLabel,
    queueType: queue.queueType,
  };
}

class FetchTelegramClient implements TelegramClient {
  async sendMessage(input: {
    botToken: string;
    chatId: string;
    messageThreadId?: number | null;
    text: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ messageId: string | null }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${input.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildTelegramSendMessagePayload(input)),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`Telegram sendMessage failed: ${response.status} ${body}`);
      }

      const json = await response.json().catch(() => null);
      const messageId = json?.result?.message_id;
      return { messageId: messageId == null ? null : String(messageId) };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildTelegramSendMessagePayload(input: {
  chatId: string;
  messageThreadId?: number | null;
  text: string;
  replyMarkup?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    chat_id: input.chatId,
    ...(input.messageThreadId != null
      ? { message_thread_id: input.messageThreadId }
      : {}),
    disable_web_page_preview: true,
    parse_mode: "HTML",
    ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
    text: input.text,
  };
}

const sqliteQueueAlertStore: QueueAlertStore = {
  getActive: getActivePvpQueueTelegramAlert,
  getByKey: getPvpQueueTelegramAlertByKey,
  markNotified: ({ entry, telegramMessageId, notifiedAt }) => {
    upsertNotifiedPvpQueueTelegramAlert({
      queueEntryKey: entry.queueEntryKey,
      queueId: entry.queueId,
      waitingWallet: entry.player,
      queueObjectVersion: entry.objectVersion,
      previousTransaction: entry.previousTransaction,
      entryFeeMist: entry.entryFeeMist,
      targetGrowth: entry.targetGrowth,
      queueLabel: entry.displayLabel,
      queueType: entry.queueType,
      telegramMessageId,
      notifiedAt,
    });
  },
  resolve: resolvePvpQueueTelegramAlert,
  resolveActive: resolveActivePvpQueueTelegramAlerts,
};

function buildQueueMessage(entry: PendingQueueEntry, battleUrl: string): string {
  return [
    "&#x2694;&#xfe0f; <b>PvP Opponent Needed</b>",
    "",
    `Match target: <b>${entry.targetGrowth} Growth</b>`,
    `<b>${escapeHtml(entry.displayLabel)}</b>`,
    "",
    `Player: <code>${escapeHtml(shortAddress(entry.player))}</code>`,
    `Entry: <b>${escapeHtml(formatSui(entry.entryFeeMist))}</b>`,
    "Winner receives: <b>5 SUI</b>",
    "",
    `Join the battle: ${escapeHtml(battleUrl)}`,
  ].join("\n");
}

function buildQueueReplyMarkup(battleUrl: string): Record<string, unknown> {
  return {
    inline_keyboard: [
      [
        {
          text: "Join Battle",
          url: battleUrl,
        },
      ],
    ],
  };
}

function createQueueTestEntry(): PendingQueueEntry {
  const queueId = DEFAULT_MATCHMAKING_QUEUE_ID;
  const player = "0x0000000000000000000000000000000000000000";
  const entryFeeMist = 3_000_000_000;
  const objectVersion = "manual-test";
  const previousTransaction = "manual-test";

  return {
    queueId,
    player,
    entryFeeMist,
    objectVersion,
    previousTransaction,
    targetGrowth: 100,
    displayLabel: "Legacy Match",
    queueType: "legacy",
    queueEntryKey: buildQueueEntryKey({
      queueId,
      player,
      objectVersion,
      previousTransaction,
      entryFeeMist,
    }),
  };
}

async function getQueueObjectWithTimeout(
  suiClient: QueueSuiClient,
  queueId: string,
): Promise<any> {
  return await Promise.race([
    suiClient.getObject({
      id: queueId,
      options: { showContent: true },
    }),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error("Sui queue read timed out")), RPC_TIMEOUT_MS);
    }),
  ]);
}

export function createPvpQueueTelegramPoller(options: {
  queueId?: string;
  queues?: PvpQueueDefinition[];
  battleUrl: string;
  botToken: string;
  chatId: string;
  messageThreadId?: number | null;
  suiClient: QueueSuiClient;
  telegramClient: TelegramClient;
  store: QueueAlertStore;
}) {
  let pollInFlight = false;
  const queues =
    options.queues && options.queues.length > 0
      ? options.queues
      : [
          {
            queueId: options.queueId ?? DEFAULT_MATCHMAKING_QUEUE_ID,
            targetGrowth: 100,
            displayLabel: "Legacy Match",
            queueType: "legacy",
          } satisfies PvpQueueDefinition,
        ];

  const pollOnce = async (): Promise<QueuePollResult> => {
    if (pollInFlight) {
      return { status: "skipped", reason: "poll_in_flight" };
    }
    pollInFlight = true;

    try {
      let lastResult: QueuePollResult = { status: "empty", reason: "queue_empty" };
      for (const queue of queues) {
        const object = await getQueueObjectWithTimeout(
          options.suiClient,
          queue.queueId,
        );
        const pending = parsePendingQueueEntry(object, queue);

        if (!pending) {
          options.store.resolveActive(queue.queueId);
          continue;
        }

        const active = options.store.getActive(queue.queueId);
        if (active && active.queue_entry_key !== pending.queueEntryKey) {
          options.store.resolve(active.queue_entry_key);
        }

        const existing = options.store.getByKey(pending.queueEntryKey);
        if (existing?.notified_at) {
          lastResult = {
            status: "skipped",
            reason: "already_notified",
            entryKey: pending.queueEntryKey,
          };
          continue;
        }

        const telegramResult = await options.telegramClient.sendMessage({
          botToken: options.botToken,
          chatId: options.chatId,
          messageThreadId: options.messageThreadId,
          replyMarkup: buildQueueReplyMarkup(options.battleUrl),
          text: buildQueueMessage(pending, options.battleUrl),
        });

        options.store.markNotified({
          entry: pending,
          telegramMessageId: telegramResult.messageId,
          notifiedAt: Date.now(),
        });

        lastResult = {
          status: "notified",
          entryKey: pending.queueEntryKey,
        };
      }

      return lastResult;
    } catch (error) {
      console.warn("[telegram] PvP queue notifier poll failed", error);
      return {
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      pollInFlight = false;
    }
  };

  return { pollOnce };
}

export function startPvpQueueTelegramNotifier(
  options: TelegramQueueNotifierOptions = {},
): (() => void) | null {
  if (stopSingletonNotifier) {
    console.log("[telegram] PvP queue notifier already running");
    return stopSingletonNotifier;
  }

  const enabled =
    options.enabled ??
    (isEnvEnabled(process.env.ENABLE_PVP_QUEUE_TELEGRAM) ||
      isEnvEnabled(process.env.PVP_QUEUE_TELEGRAM_ENABLED));
  const explicitlyDisabled =
    isEnvDisabled(process.env.ENABLE_PVP_QUEUE_TELEGRAM) ||
    isEnvDisabled(process.env.PVP_QUEUE_TELEGRAM_ENABLED);
  const botToken = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const rawChatId =
    options.chatId ?? process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_PVP_QUEUE_CHAT_ID;
  const rawMessageThreadId =
    options.messageThreadId ??
    process.env.TELEGRAM_MESSAGE_THREAD_ID ??
    process.env.TELEGRAM_PVP_QUEUE_THREAD_ID ??
    null;

  if (explicitlyDisabled || !enabled) {
    console.log("[telegram] PvP queue notifier disabled");
    return null;
  }

  if (!botToken || !rawChatId) {
    console.warn(
      "[telegram] PvP queue notifier disabled: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required",
    );
    return null;
  }

  const chatId = validateTelegramChatId(rawChatId);
  const messageThreadId = parseTelegramMessageThreadId(rawMessageThreadId);

  const queues =
    options.queues ??
    (options.queueId
      ? [
          {
            queueId: options.queueId,
            targetGrowth: 100,
            displayLabel: "Legacy Match",
            queueType: "legacy",
          } satisfies PvpQueueDefinition,
        ]
      : getConfiguredPvpQueueDefinitions());
  const battleUrl =
    options.battleUrl ?? process.env.GARDEN_BATTLES_PUBLIC_URL ?? DEFAULT_BATTLE_URL;
  const pollIntervalMs = Math.max(
    Number(options.pollIntervalMs ?? process.env.PVP_QUEUE_TELEGRAM_POLL_MS) ||
      DEFAULT_POLL_INTERVAL_MS,
    MIN_POLL_INTERVAL_MS,
  );
  const suiClient =
    options.suiClient ??
    new SuiClient({
      url: options.suiRpcUrl ?? process.env.SUI_RPC_URL ?? DEFAULT_SUI_RPC_URL,
    });
  const poller = createPvpQueueTelegramPoller({
    queues,
    battleUrl,
    botToken,
    chatId,
    messageThreadId,
    suiClient,
    telegramClient: options.telegramClient ?? new FetchTelegramClient(),
    store: options.store ?? sqliteQueueAlertStore,
  });

  console.log(
    `[telegram] PvP queue notifier enabled; polling ${queues.length} queue(s) every ${pollIntervalMs}ms`,
  );
  void poller.pollOnce();
  const interval = setInterval(() => {
    void poller.pollOnce();
  }, pollIntervalMs);

  stopSingletonNotifier = () => {
    clearInterval(interval);
    stopSingletonNotifier = null;
  };

  return stopSingletonNotifier;
}

export async function sendManualPvpQueueTelegramTest(
  options: {
    botToken?: string;
    chatId?: string;
    messageThreadId?: number | string | null;
    battleUrl?: string;
    telegramClient?: TelegramClient;
  } = {},
): Promise<{ messageId: string | null }> {
  const botToken = options.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const chatId = validateTelegramChatId(
    options.chatId ?? process.env.TELEGRAM_CHAT_ID ?? process.env.TELEGRAM_PVP_QUEUE_CHAT_ID,
  );
  const messageThreadId = parseTelegramMessageThreadId(
    options.messageThreadId ??
      process.env.TELEGRAM_MESSAGE_THREAD_ID ??
      process.env.TELEGRAM_PVP_QUEUE_THREAD_ID ??
      null,
  );
  const battleUrl =
    options.battleUrl ?? process.env.GARDEN_BATTLES_PUBLIC_URL ?? DEFAULT_BATTLE_URL;
  const entry = createQueueTestEntry();

  return await (options.telegramClient ?? new FetchTelegramClient()).sendMessage({
    botToken,
    chatId,
    messageThreadId,
    replyMarkup: buildQueueReplyMarkup(battleUrl),
    text: buildQueueMessage(entry, battleUrl),
  });
}
