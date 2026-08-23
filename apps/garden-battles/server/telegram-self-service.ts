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

export function startTelegramSelfServiceCommands(input: {
  botToken: string;
  battleUrl?: string;
  api?: TelegramSelfServiceApi;
  store?: TelegramDestinationStore;
}): () => void {
  const api = input.api ?? new FetchTelegramSelfServiceApi();
  const store = input.store ?? sqliteTelegramDestinationStore;
  let stopped = false;

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
  };
}
