import test from "node:test";
import assert from "node:assert/strict";
import {
  handleTelegramSelfServiceUpdate,
  type TelegramDestinationStore,
  type TelegramSelfServiceApi,
  type TelegramUpdate,
} from "./telegram-self-service";

class MemoryDestinationStore implements TelegramDestinationStore {
  rows = new Map<string, { enabled: number; chatId: string; messageThreadId: number | null }>();

  private key(chatId: string, threadId?: number | null) {
    return `${chatId}:${threadId ?? 0}`;
  }

  list() {
    return [...this.rows.values()]
      .filter((row) => row.enabled === 1)
      .map(({ chatId, messageThreadId }) => ({ chatId, messageThreadId }));
  }

  get(chatId: string, threadId?: number | null) {
    return this.rows.get(this.key(chatId, threadId)) ?? null;
  }

  enable(input: { chatId: string; messageThreadId?: number | null }) {
    this.rows.set(this.key(input.chatId, input.messageThreadId), {
      enabled: 1,
      chatId: input.chatId,
      messageThreadId: input.messageThreadId ?? null,
    });
  }

  disable(chatId: string, threadId?: number | null) {
    const row = this.rows.get(this.key(chatId, threadId));
    if (row) row.enabled = 0;
  }
}

class FakeApi implements TelegramSelfServiceApi {
  adminStatus = "administrator";
  sent: Array<any> = [];
  memberChecks: Array<any> = [];

  async getUpdates() { return []; }
  async getChatMember(input: any) {
    this.memberChecks.push(input);
    return { status: this.adminStatus };
  }
  async sendMessage(input: any) {
    this.sent.push(input);
    return { messageId: String(this.sent.length) };
  }
  async setMyCommands() {}
}

function update(
  text: string,
  options: { type?: "private" | "group" | "supergroup"; threadId?: number; userId?: number } = {},
): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      ...(options.threadId ? { message_thread_id: options.threadId } : {}),
      text,
      chat: { id: -100123, type: options.type ?? "supergroup", title: "Tree Test" },
      from: { id: options.userId ?? 42, username: "admin" },
    },
  };
}

async function run(
  command: string,
  options: Parameters<typeof update>[1] = {},
  api = new FakeApi(),
  store = new MemoryDestinationStore(),
) {
  const result = await handleTelegramSelfServiceUpdate({
    update: update(command, options),
    botToken: "token",
    api,
    store,
    battleUrl: "https://nftree.net/battle",
  });
  return { result, api, store };
}

test("an administrator can enable alerts for the current group", async () => {
  const { result, api, store } = await run("/gardenalerts_on@GardenBot");
  assert.equal(result, "handled");
  assert.equal(store.get("-100123")?.enabled, 1);
  assert.equal(api.memberChecks[0].userId, 42);
  assert.match(api.sent[0].text, /now ON for this group/);
});

test("forum-topic subscriptions are scoped to the exact topic", async () => {
  const api = new FakeApi();
  const store = new MemoryDestinationStore();
  await run("/gardenalerts_on", { threadId: 77 }, api, store);
  assert.equal(store.get("-100123", 77)?.enabled, 1);
  assert.equal(store.get("-100123")?.enabled, undefined);
  assert.equal(api.sent[0].messageThreadId, 77);
  assert.match(api.sent[0].text, /this topic/);
});

test("a non-administrator cannot enable alerts", async () => {
  const api = new FakeApi();
  api.adminStatus = "member";
  const store = new MemoryDestinationStore();
  await run("/gardenalerts_on", {}, api, store);
  assert.equal(store.list().length, 0);
  assert.match(api.sent[0].text, /Only a group administrator/);
});

test("status reports only the current topic and does not require admin", async () => {
  const api = new FakeApi();
  const store = new MemoryDestinationStore();
  store.enable({ chatId: "-100123", messageThreadId: 77 });
  await run("/gardenalerts_status", { threadId: 78 }, api, store);
  assert.match(api.sent[0].text, /OFF/);
  assert.equal(api.memberChecks.length, 0);
});

test("off disables only the current topic", async () => {
  const api = new FakeApi();
  const store = new MemoryDestinationStore();
  store.enable({ chatId: "-100123", messageThreadId: 77 });
  store.enable({ chatId: "-100123", messageThreadId: 78 });
  await run("/gardenalerts_off", { threadId: 77 }, api, store);
  assert.equal(store.get("-100123", 77)?.enabled, 0);
  assert.equal(store.get("-100123", 78)?.enabled, 1);
});

test("test alert is sent into the same topic with a battle button", async () => {
  const { api } = await run("/gardenalerts_test", { threadId: 91 });
  assert.equal(api.sent[0].messageThreadId, 91);
  assert.match(api.sent[0].text, /test alert/);
  assert.deepEqual(api.sent[0].replyMarkup.inline_keyboard[0][0], {
    text: "Play Garden Battles",
    url: "https://nftree.net/battle",
  });
});

test("configuration commands explain that private chats are unsupported", async () => {
  const { api, store } = await run("/gardenalerts_on", { type: "private" });
  assert.equal(store.list().length, 0);
  assert.match(api.sent[0].text, /Add this bot to a Telegram group/);
});

test("gardenbattle works without administrator privileges", async () => {
  const api = new FakeApi();
  api.adminStatus = "member";
  await run("/gardenbattle", { type: "private" }, api);
  assert.equal(api.memberChecks.length, 0);
  assert.match(api.sent[0].text, /Garden Battles/);
});

test("unrelated messages are ignored", async () => {
  const { result, api } = await run("hello");
  assert.equal(result, "ignored");
  assert.equal(api.sent.length, 0);
});
