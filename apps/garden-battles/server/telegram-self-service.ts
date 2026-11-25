import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  disableTelegramAlertDestination,
  enableTelegramAlertDestination,
  getTelegramAlertDestination,
  listTelegramAlertDestinations,
} from "./battle-storage";

const TELEGRAM_API_TIMEOUT_MS = 35_000;
const DEFAULT_BATTLE_URL = "https://nftree.net/battle";

export interface TelegramAlertDestination {
  chatId: string;
  messageThreadId?: number | null;
}

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
}

interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  text?: string;
  chat: TelegramChat;
  from?: TelegramUser;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramSelfServiceApi {
  getUpdates(input: {
    botToken: string;
    offset?: number;
    timeout: number;
  }): Promise<TelegramUpdate[]>;
  getChatMember(input: {
    botToken: string;
    chatId: string;
    userId: number;
  }): Promise<{ status: string }>;
  sendMessage(input: {
    botToken: string;
    chatId: string;
    messageThreadId?: number | null;
    text: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ messageId: string | null }>;
  setMyCommands(input: {
    botToken: string;
    commands: Array<{ command: string; description: string }>;
  }): Promise<void>;
}

export interface TelegramDestinationStore {
  list(): TelegramAlertDestination[];
  get(chatId: string, messageThreadId?: number | null): { enabled: number } | null;
  enable(input: {
    chatId: string;
    messageThreadId?: number | null;
    chatTitle?: string | null;
    configuredBy: string;
  }): void;
  disable(chatId: string, messageThreadId?: number | null): void;
}

export const sqliteTelegramDestinationStore: TelegramDestinationStore = {
  list: () =>
    listTelegramAlertDestinations().map((row) => ({
      chatId: row.chat_id,
      messageThreadId: row.message_thread_id || null,
    })),
  get: getTelegramAlertDestination,
  enable: enableTelegramAlertDestination,
  disable: disableTelegramAlertDestination,
};

export const TELEGRAM_SELF_SERVICE_COMMANDS = [
  { command: "announce", description: "Share a @thickquidity X post from a private chat" },
  { command: "youtube", description: "Share a Crypto Arborist video from a private chat" },
  { command: "gardenalerts_on", description: "Send matchup alerts here" },
  { command: "gardenalerts_off", description: "Stop alerts here" },
  { command: "gardenalerts_status", description: "Check alerts for this chat or topic" },
  { command: "gardenalerts_test", description: "Send a test alert here" },
  { command: "gardenbattle", description: "Open Garden Battles" },
];

function telegramPayloadError(method: string, status: number, body: string): Error {
  return new Error(`Telegram ${method} failed: ${status} ${body}`);
}

async function callTelegram(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
  timeoutMs = TELEGRAM_API_TIMEOUT_MS,
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.ok) {
      throw telegramPayloadError(method, response.status, JSON.stringify(json ?? {}));
    }
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

export class FetchTelegramSelfServiceApi implements TelegramSelfServiceApi {
  async getUpdates(input: {
    botToken: string;
    offset?: number;
    timeout: number;
  }): Promise<TelegramUpdate[]> {
    return await callTelegram(
      input.botToken,
      "getUpdates",
      {
        ...(input.offset != null ? { offset: input.offset } : {}),
        timeout: input.timeout,
        allowed_updates: ["message"],
      },
      (input.timeout + 10) * 1_000,
    );
  }

  async getChatMember(input: {
    botToken: string;
    chatId: string;
    userId: number;
  }): Promise<{ status: string }> {
    return await callTelegram(input.botToken, "getChatMember", {
      chat_id: input.chatId,
      user_id: input.userId,
    });
  }

  async sendMessage(input: {
    botToken: string;
    chatId: string;
    messageThreadId?: number | null;
    text: string;
    replyMarkup?: Record<string, unknown>;
  }): Promise<{ messageId: string | null }> {
    const result = await callTelegram(input.botToken, "sendMessage", {
      chat_id: input.chatId,
      ...(input.messageThreadId != null
        ? { message_thread_id: input.messageThreadId }
        : {}),
      disable_web_page_preview: true,
      parse_mode: "HTML",
      ...(input.replyMarkup ? { reply_markup: input.replyMarkup } : {}),
      text: input.text,
    });
    return {
      messageId: result?.message_id == null ? null : String(result.message_id),
    };
  }

  async setMyCommands(input: {
    botToken: string;
    commands: Array<{ command: string; description: string }>;
  }): Promise<void> {
    await callTelegram(input.botToken, "setMyCommands", {
      commands: input.commands,
    });
  }
}

function parseCommand(text: string | undefined): string | null {
  const token = (text ?? "").trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (!token?.startsWith("/")) return null;
  return token.slice(1).split("@", 1)[0] || null;
}

function destinationLabel(threadId?: number | null): string {
  return threadId ? "this topic" : "this group";
}

function battleButton(battleUrl: string): Record<string, unknown> {
  return { inline_keyboard: [[{ text: "Play Garden Battles", url: battleUrl }]] };
}

async function reply(
  api: TelegramSelfServiceApi,
  botToken: string,
  message: TelegramMessage,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await api.sendMessage({
    botToken,
    chatId: String(message.chat.id),
    messageThreadId: message.message_thread_id ?? null,
    text,
    replyMarkup,
  });
}

async function isAdministrator(
  api: TelegramSelfServiceApi,
  botToken: string,
  message: TelegramMessage,
): Promise<boolean> {
  if (!message.from) return false;
  const member = await api.getChatMember({
    botToken,
    chatId: String(message.chat.id),
    userId: message.from.id,
  });
  return member.status === "creator" || member.status === "administrator";
}

async function handleAnnouncement(
  input: {api: TelegramSelfServiceApi; botToken: string},
  message: TelegramMessage,
  command: "announce" | "youtube",
): Promise<void> {
  const {api, botToken} = input;
  if (message.chat.type !== "private" || !message.from) return;
  const youtube = command === "youtube";
  const group = process.env.TELEGRAM_ANNOUNCEMENT_GROUP_ID;
  const topic = Number(youtube
    ? process.env.TELEGRAM_YOUTUBE_TOPIC_ID
    : process.env.TELEGRAM_X_TOPIC_ID);
  const channel = process.env.TELEGRAM_YOUTUBE_CHANNEL_ID;
  if (!group || !Number.isSafeInteger(topic) || topic < 1 || (youtube && !channel)) {
    await reply(api, botToken, message, "This announcement destination is still being set up.");
    return;
  }

  const member = await api.getChatMember({botToken, chatId: group, userId: message.from.id});
  if (member.status !== "creator" && member.status !== "administrator") {
    await reply(api, botToken, message, "Only admins of the TREE group can publish announcements.");
    return;
  }

  const link = message.text?.trim().split(/\s+/)[1] ?? "";
  const xMatch = /^https:\/\/(?:www\.)?(?:x|twitter)\.com\/thickquidity\/status\/(\d+)\/?(?:[?#]|$)/i.exec(link);
  const videoMatch = /^https:\/\/(?:youtu\.be\/|(?:(?:www|m)\.)?youtube\.com\/(?:watch\?v=|shorts\/|live\/))([\w-]{11})(?:[?&#/]|$)/i.exec(link);
  const id = (youtube ? videoMatch : xMatch)?.[1];
  if (!id) {
    await reply(api, botToken, message, youtube
      ? "Usage: /youtube https://youtu.be/VIDEO_ID"
      : "Usage: /announce https://x.com/thickquidity/status/POST_ID");
    return;
  }

  const announcement = {
    botToken,
    text: youtube ? "🌳 New video from The Crypto Arborist" : "🌳 New post from @thickquidity on X",
    replyMarkup: {inline_keyboard: [[{
      text: youtube ? "Watch on YouTube" : "View on X",
      url: youtube ? `https://www.youtube.com/watch?v=${id}` : `https://x.com/thickquidity/status/${id}`,
    }]]},
  };
  const destinations = [
    {chatId: group, messageThreadId: topic, label: youtube ? "YouTube topic" : "X topic"},
    ...(youtube && channel ? [{chatId: channel, messageThreadId: null, label: "Telegram channel"}] : []),
  ];
  const results = await Promise.allSettled(destinations.map(({chatId, messageThreadId}) =>
    api.sendMessage({...announcement, chatId, messageThreadId}),
  ));
  await reply(api, botToken, message, results.map((result, index) =>
    `${destinations[index].label}: ${result.status === "fulfilled" ? "sent" : "delivery could not be confirmed"}`,
  ).join("\n"));
}

export async function handleTelegramSelfServiceUpdate(input: {
  update: TelegramUpdate;
  botToken: string;
  api: TelegramSelfServiceApi;
  store: TelegramDestinationStore;
  battleUrl?: string;
}): Promise<"ignored" | "handled"> {
  const message = input.update.message;
  const command = parseCommand(message?.text);
  if (!message || !command || !TELEGRAM_SELF_SERVICE_COMMANDS.some((item) => item.command === command)) {
    return "ignored";
  }

  if (command === "announce" || command === "youtube") {
    await handleAnnouncement(input, message, command);
    return "handled";
  }

  const battleUrl = input.battleUrl ?? DEFAULT_BATTLE_URL;
  if (command === "gardenbattle") {
    await reply(
      input.api,
      input.botToken,
      message,
      "&#x1f333; <b>Garden Battles</b>\nChoose your cards, grow your tree, and battle for the canopy.",
      battleButton(battleUrl),
    );
    return "handled";
  }

  if (message.chat.type !== "group" && message.chat.type !== "supergroup") {
    await reply(
      input.api,
      input.botToken,
      message,
      "Add this bot to a Telegram group, then run this command inside the group or the exact forum topic where alerts should appear.",
    );
    return "handled";
  }

  const chatId = String(message.chat.id);
  const threadId = message.message_thread_id ?? null;
  const label = destinationLabel(threadId);

  if (command === "gardenalerts_status") {
    const active = input.store.get(chatId, threadId)?.enabled === 1;
    await reply(
      input.api,
      input.botToken,
      message,
      active
        ? `&#x2705; Garden Battles matchup alerts are <b>ON</b> for ${label}.`
        : `&#x26aa; Garden Battles matchup alerts are <b>OFF</b> for ${label}.`,
    );
    return "handled";
  }

  if (!(await isAdministrator(input.api, input.botToken, message))) {
    await reply(
      input.api,
      input.botToken,
      message,
      `Only a group administrator can change or test Garden Battles alerts for ${label}.`,
    );
    return "handled";
  }

  if (command === "gardenalerts_on") {
    input.store.enable({
      chatId,
      messageThreadId: threadId,
      chatTitle: message.chat.title ?? null,
      configuredBy: String(message.from!.id),
    });
    await reply(
      input.api,
      input.botToken,
      message,
      `&#x2705; <b>Garden Battles alerts are now ON for ${label}.</b>\nWhen a player is waiting for a PvP opponent, the matchup notice will appear here.`,
      battleButton(battleUrl),
    );
    return "handled";
  }

  if (command === "gardenalerts_off") {
    input.store.disable(chatId, threadId);
    await reply(
      input.api,
      input.botToken,
      message,
      `&#x1f6d1; Garden Battles matchup alerts are now <b>OFF</b> for ${label}.`,
    );
    return "handled";
  }

  await reply(
    input.api,
    input.botToken,
    message,
    `&#x2694;&#xfe0f; <b>Garden Battles test alert</b>\n\nThis is where live PvP opponent requests will appear for ${label}.`,
    battleButton(battleUrl),
  );
  return "handled";
}

async function marketJson(url: string) {
  const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`Market data HTTP ${response.status}`);
  return response.json();
}

async function sendDailyMarketBrief(api: TelegramSelfServiceApi, botToken: string) {
  const chatId = process.env.TELEGRAM_ANNOUNCEMENT_GROUP_ID;
  const topic = Number(process.env.TELEGRAM_MARKET_TOPIC_ID);
  if (!chatId || !Number.isSafeInteger(topic) || topic < 1) return;

  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => local.find(item => item.type === type)?.value;
  const testId = process.env.TELEGRAM_MARKET_TEST_ID;
  if (part("hour") !== "08" && !testId) return;
  const day = [part("year"), part("month"), part("day")].join("-");
  const directory = process.env.RAILWAY_VOLUME_MOUNT_PATH || "/data";
  const test = !!testId && /^[\w-]+$/.test(testId) &&
    !existsSync(join(directory, `tree-market-test-${testId}`));
  if (!test && part("hour") !== "08") return;
  const marker = join(directory, test ? `tree-market-test-${testId}` : `tree-market-brief-${day}`);
  if (existsSync(marker)) return;
  mkdirSync(directory, {recursive: true});

  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 86_400_000);
  const coinbase = "https://api.exchange.coinbase.com/products/BTC-USD";
  const candleQuery = new URLSearchParams({
    granularity: "86400", start: start.toISOString(), end: end.toISOString(),
  });
  const [stats, candles, sentiment] = await Promise.all([
    marketJson(`${coinbase}/stats`),
    marketJson(`${coinbase}/candles?${candleQuery}`),
    marketJson("https://api.alternative.me/fng/?limit=2"),
  ]);
  const candle = candles.find((row: number[]) => row[0] === start.getTime() / 1000);
  const price = Number(stats.last);
  const open = Number(stats.open);
  const low = Number(candle?.[1]);
  const high = Number(candle?.[2]);
  const [latest, previous] = sentiment.data ?? [];
  const score = Number(latest?.value);
  const prior = Number(previous?.value);
  const label = latest?.value_classification;
  if (![price, open, low, high].every(value => Number.isFinite(value) && value > 0) ||
      ![score, prior].every(value => Number.isInteger(value) && value >= 0 && value <= 100) ||
      typeof label !== "string" || !/^(?:Extreme )?(?:Fear|Greed)$|^Neutral$/.test(label) ||
      Math.abs(now.getTime() / 1000 - Number(latest?.timestamp)) > 48 * 3600 ||
      !Number.isFinite(Number(latest?.timestamp))) {
    throw new Error("Market sources returned missing or stale data");
  }

  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 0,
  });
  const signed = (value: number, digits: number) =>
    `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
  const {messageId} = await api.sendMessage({
    botToken, chatId, messageThreadId: topic,
    text: [
      test ? "🌳 <b>TEST · TREE Market Brief</b>" : "🌳 <b>TREE Market Brief</b>",
      `BTC ${dollars.format(price)} (${signed((price / open - 1) * 100, 2)}% in 24h)`,
      `Previous UTC day: low ${dollars.format(low)} · high ${dollars.format(high)}`,
      `Fear &amp; Greed: ${score}/100 · ${label} (${signed(score - prior, 0)} pts)`,
      "Sources: Coinbase Exchange and Alternative.me",
    ].join("\n"),
    replyMarkup: {inline_keyboard: [[{
      text: "Open Market Insights", url: "https://tree-token.xyz/market-insights/",
    }]]},
  });
  writeFileSync(marker + ".tmp", day);
  renameSync(marker + ".tmp", marker);
  console.log(`[market-brief] Delivered ${test ? `test ${testId}` : day}; message ${messageId}`);
}

export function startTelegramSelfServiceCommands(input: {
  botToken: string;
  battleUrl?: string;
  api?: TelegramSelfServiceApi;
  store?: TelegramDestinationStore;
}): () => void {
  const api = input.api ?? new FetchTelegramSelfServiceApi();
  const store = input.store ?? sqliteTelegramDestinationStore;
  let stopped = false;
  let marketBusy = false;
  const checkMarket = async () => {
    if (marketBusy) return;
    marketBusy = true;
    try { await sendDailyMarketBrief(api, input.botToken); }
    catch (error) { console.warn('[market-brief]', error instanceof Error ? error.message : 'Delivery failed'); }
    finally { marketBusy = false; }
  };
  const marketTimer = setInterval(() => void checkMarket(), 60_000);
  marketTimer.unref();
  void checkMarket();

  void api.setMyCommands({
    botToken: input.botToken,
    commands: TELEGRAM_SELF_SERVICE_COMMANDS,
  }).catch((error) => console.warn("[telegram] Could not publish bot commands", error));

  void (async () => {
    let offset: number | undefined;
    try {
      const latest = await api.getUpdates({
        botToken: input.botToken,
        offset: -1,
        timeout: 0,
      });
      if (latest.length > 0) offset = Math.max(...latest.map((item) => item.update_id)) + 1;
    } catch (error) {
      console.warn("[telegram] Could not initialize self-service commands", error);
    }

    while (!stopped) {
      try {
        const updates = await api.getUpdates({
          botToken: input.botToken,
          offset,
          timeout: 25,
        });
        for (const update of updates) {
          offset = Math.max(offset ?? 0, update.update_id + 1);
          try {
            await handleTelegramSelfServiceUpdate({
              update,
              botToken: input.botToken,
              api,
              store,
              battleUrl: input.battleUrl,
            });
          } catch (error) {
            console.warn("[telegram] Self-service command failed", error);
          }
        }
      } catch (error) {
        if (!stopped) {
          console.warn("[telegram] Self-service update poll failed", error);
          await new Promise((resolve) => setTimeout(resolve, 5_000));
        }
      }
    }
  })();

  return () => {
    stopped = true;
    clearInterval(marketTimer);
  };
}
