import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTelegramSendMessagePayload,
  createPvpQueueTelegramPoller,
  parseTelegramMessageThreadId,
  sendManualPvpQueueTelegramTest,
  startPvpQueueTelegramNotifier,
  validateTelegramChatId,
  type PendingQueueEntry,
  type QueueAlertStore,
} from "./pvp-queue-telegram";
import type { PvpQueueTelegramAlertRow } from "./battle-storage";

const QUEUE_ID = "0xqueue";
const PLAYER_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PLAYER_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const PLAYER_C = "0xcccccccccccccccccccccccccccccccccccccccc";

function queueObject(
  player: string | null,
  version: string,
  previousTransaction: string,
  entryFeeMist = 3_000_000_000,
) {
  return {
    data: {
      objectId: QUEUE_ID,
      version,
      previousTransaction,
      content: {
        fields: {
          bank: player ? String(entryFeeMist) : "0",
          waiting: player
            ? {
                type: "matchmaking::Pending",
                fields: {
                  entry_fee_snapshot: String(entryFeeMist),
                  player,
                },
              }
            : null,
        },
      },
    },
  };
}

class FakeSuiClient {
  objects: any[] = [];
  calls = 0;

  constructor(objects: any[]) {
    this.objects = objects;
  }

  async getObject() {
    if (this.objects.length === 0) {
      throw new Error("no fake Sui object queued");
    }
    const index = Math.min(this.calls, this.objects.length - 1);
    this.calls += 1;
    const next = this.objects[index];
    if (next instanceof Error) throw next;
    return next;
  }
}

class FakeTelegramClient {
  sent: Array<{
    chatId?: string;
    messageThreadId?: number | string | null;
    replyMarkup?: Record<string, unknown>;
    text: string;
  }> = [];
  failNext = false;
  errorMessage = "telegram failed";

  async sendMessage(input: {
    chatId?: string;
    messageThreadId?: number | string | null;
    replyMarkup?: Record<string, unknown>;
    text: string;
  }) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error(this.errorMessage);
    }

    this.sent.push(input);
    return { messageId: String(this.sent.length) };
  }
}

class MemoryStore implements QueueAlertStore {
  rows = new Map<string, PvpQueueTelegramAlertRow>();

  getActive(queueId: string): PvpQueueTelegramAlertRow | null {
    return (
      Array.from(this.rows.values()).find(
        (row) => row.queue_id === queueId && row.active === 1,
      ) ?? null
    );
  }

  getByKey(queueEntryKey: string): PvpQueueTelegramAlertRow | null {
    return this.rows.get(queueEntryKey) ?? null;
  }

  markNotified(input: {
    entry: PendingQueueEntry;
    telegramMessageId: string | null;
    notifiedAt: number;
  }): void {
    const existing = this.rows.get(input.entry.queueEntryKey);
    const now = Date.now();
    this.rows.set(input.entry.queueEntryKey, {
      id: existing?.id ?? this.rows.size + 1,
      queue_entry_key: input.entry.queueEntryKey,
      queue_id: input.entry.queueId,
      waiting_wallet: input.entry.player,
      queue_object_version: input.entry.objectVersion,
      previous_transaction: input.entry.previousTransaction,
      entry_fee_mist: input.entry.entryFeeMist,
      telegram_message_id: input.telegramMessageId,
      notified_at: input.notifiedAt,
      resolved_at: null,
      active: 1,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });
  }

  resolve(queueEntryKey: string, resolvedAt = Date.now()): void {
    const existing = this.rows.get(queueEntryKey);
    if (!existing) return;
    this.rows.set(queueEntryKey, {
      ...existing,
      active: 0,
      resolved_at: existing.resolved_at ?? resolvedAt,
      updated_at: resolvedAt,
    });
  }

  resolveActive(queueId: string, resolvedAt = Date.now()): void {
    for (const row of this.rows.values()) {
      if (row.queue_id === queueId && row.active === 1) {
        this.resolve(row.queue_entry_key, resolvedAt);
      }
    }
  }
}

function makePoller(
  objects: any[],
  store = new MemoryStore(),
  messageThreadId: number | null = 123,
) {
  const suiClient = new FakeSuiClient(objects);
  const telegramClient = new FakeTelegramClient();
  const poller = createPvpQueueTelegramPoller({
    queueId: QUEUE_ID,
    battleUrl: "https://nftree.net/battle",
    botToken: "token",
    chatId: "chat",
    messageThreadId,
    suiClient,
    telegramClient,
    store,
  });

  return { poller, store, telegramClient, suiClient };
}

test("empty to player A sends exactly once and repeated A polls skip", async () => {
  const { poller, telegramClient } = makePoller([
    queueObject(null, "1", "tx-empty"),
    queueObject(PLAYER_A, "2", "tx-a"),
    queueObject(PLAYER_A, "2", "tx-a"),
  ]);

  assert.equal((await poller.pollOnce()).status, "empty");
  assert.equal((await poller.pollOnce()).status, "notified");
  assert.equal((await poller.pollOnce()).reason, "already_notified");
  assert.equal(telegramClient.sent.length, 1);
  assert.equal(telegramClient.sent[0].messageThreadId, 123);
  assert.match(telegramClient.sent[0].text, /<b>Garden Battles PvP queue alert<\/b>/);
  assert.deepEqual(telegramClient.sent[0].replyMarkup, {
    inline_keyboard: [[{ text: "Join Battle", url: "https://nftree.net/battle" }]],
  });
});

test("no thread ID omits message_thread_id from sendMessage payload", () => {
  const payload = buildTelegramSendMessagePayload({
    chatId: "-1001234567890",
    text: "test",
  });

  assert.equal(Object.hasOwn(payload, "message_thread_id"), false);
});

test("valid thread ID includes numeric message_thread_id in payload", () => {
  const payload = buildTelegramSendMessagePayload({
    chatId: "-1001234567890",
    messageThreadId: 123,
    text: "test",
  });

  assert.equal(payload.message_thread_id, 123);
});

test("valid thread ID parses to a numeric message_thread_id", () => {
  assert.equal(parseTelegramMessageThreadId("123"), 123);
  assert.equal(parseTelegramMessageThreadId(456), 456);
});

test("invalid thread ID fails clearly", () => {
  assert.throws(
    () => parseTelegramMessageThreadId("not-a-topic"),
    /TELEGRAM_MESSAGE_THREAD_ID must be a positive integer/,
  );
});

test("chat ID rejects full t.me links", () => {
  assert.throws(
    () => validateTelegramChatId("https://t.me/example/123"),
    /not a t\.me URL/,
  );
});

test("restart while A waits does not resend when store is durable", async () => {
  const store = new MemoryStore();
  const first = makePoller([queueObject(PLAYER_A, "2", "tx-a")], store);
  assert.equal((await first.poller.pollOnce()).status, "notified");

  const restarted = makePoller([queueObject(PLAYER_A, "2", "tx-a")], store);
  assert.equal((await restarted.poller.pollOnce()).reason, "already_notified");
  assert.equal(first.telegramClient.sent.length, 1);
  assert.equal(restarted.telegramClient.sent.length, 0);
});

test("A to empty resolves A, then C sends once", async () => {
  const store = new MemoryStore();
  const first = makePoller(
    [
      queueObject(PLAYER_A, "2", "tx-a"),
      queueObject(null, "3", "tx-empty"),
      queueObject(PLAYER_C, "4", "tx-c"),
    ],
    store,
  );

  await first.poller.pollOnce();
  await first.poller.pollOnce();
  assert.equal(store.getActive(QUEUE_ID), null);
  assert.equal((await first.poller.pollOnce()).status, "notified");
  assert.equal(first.telegramClient.sent.length, 2);
});

test("A to B directly resolves A and alerts B", async () => {
  const store = new MemoryStore();
  const { poller, telegramClient } = makePoller(
    [
      queueObject(PLAYER_A, "2", "tx-a"),
      queueObject(PLAYER_B, "3", "tx-b"),
    ],
    store,
  );

  await poller.pollOnce();
  await poller.pollOnce();

  const rows = Array.from(store.rows.values());
  assert.equal(rows.find((row) => row.waiting_wallet === PLAYER_A)?.active, 0);
  assert.equal(rows.find((row) => row.waiting_wallet === PLAYER_B)?.active, 1);
  assert.equal(telegramClient.sent.length, 2);
});

test("A rejoins with a new queue-entry key and alerts again", async () => {
  const store = new MemoryStore();
  const { poller, telegramClient } = makePoller(
    [
      queueObject(PLAYER_A, "2", "tx-a"),
      queueObject(null, "3", "tx-empty"),
      queueObject(PLAYER_A, "4", "tx-a-new"),
    ],
    store,
  );

  await poller.pollOnce();
  await poller.pollOnce();
  await poller.pollOnce();

  assert.equal(telegramClient.sent.length, 2);
});

test("Telegram error does not mark notification successful", async () => {
  const { poller, store, telegramClient } = makePoller([
    queueObject(PLAYER_A, "2", "tx-a"),
  ]);
  telegramClient.failNext = true;

  assert.equal((await poller.pollOnce()).status, "error");
  assert.equal(store.getByKey(`${QUEUE_ID}:${PLAYER_A}:tx-a`), null);
});

test("manual Telegram API rejection fails without exposing bot token", async () => {
  const telegramClient = new FakeTelegramClient();
  telegramClient.failNext = true;
  telegramClient.errorMessage =
    "Telegram sendMessage failed: 400 Bad Request: message thread not found";

  await assert.rejects(
    () =>
      sendManualPvpQueueTelegramTest({
        botToken: "secret-token",
        chatId: "-1001234567890",
        messageThreadId: "123",
        telegramClient,
      }),
    (error: any) => {
      assert.match(String(error.message), /message thread not found/);
      assert.doesNotMatch(String(error.message), /secret-token/);
      return true;
    },
  );
});

test("RPC failure does not resolve active state", async () => {
  const store = new MemoryStore();
  const first = makePoller([queueObject(PLAYER_A, "2", "tx-a")], store);
  await first.poller.pollOnce();

  const failing = makePoller([new Error("rpc failed")], store);
  assert.equal((await failing.poller.pollOnce()).status, "error");
  assert.equal(store.getActive(QUEUE_ID)?.waiting_wallet, PLAYER_A);
});

test("duplicate watcher startup does not create duplicate alerts", async () => {
  const store = new MemoryStore();
  const suiClient = new FakeSuiClient([queueObject(PLAYER_A, "2", "tx-a")]);
  const telegramClient = new FakeTelegramClient();

  const stopA = startPvpQueueTelegramNotifier({
    enabled: true,
    botToken: "token",
    chatId: "-1001234567890",
    messageThreadId: 123,
    queueId: QUEUE_ID,
    pollIntervalMs: 60_000,
    suiClient,
    telegramClient,
    store,
  });
  const stopB = startPvpQueueTelegramNotifier({
    enabled: true,
    botToken: "token",
    chatId: "-1001234567890",
    messageThreadId: 123,
    queueId: QUEUE_ID,
    pollIntervalMs: 60_000,
    suiClient,
    telegramClient,
    store,
  });

  await new Promise((resolve) => setTimeout(resolve, 25));
  stopA?.();
  assert.equal(stopA, stopB);
  assert.equal(telegramClient.sent.length, 1);
});
