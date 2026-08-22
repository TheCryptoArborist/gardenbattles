import type { ActionEntry } from "@/components/BattleLog";
import type { PvpMoveResolution } from "./pvpMoveResolution";

export interface PvpBattleLogEvent {
  id?: {
    txDigest?: string;
    eventSeq?: string;
  };
  sender?: string;
  parsedJson?: Record<string, unknown>;
  timestampMs?: string;
}

interface BattleLogCacheRecord {
  version: 1;
  cachedAt: number;
  battleId: string;
  entries: ActionEntry[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const BATTLE_LOG_STORAGE_PREFIX = "battle_garden_action_log:";
const BATTLE_LOG_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BATTLE_LOG_CACHE_MAX_ENTRIES = 120;

function normalize(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function eventBattleId(event: PvpBattleLogEvent): string {
  return normalize(event.parsedJson?.battle_id);
}

function eventDigest(event: PvpBattleLogEvent): string {
  return typeof event.id?.txDigest === "string" ? event.id.txDigest : "";
}

function logStorageKey(address: string, battleId: string): string {
  return `${BATTLE_LOG_STORAGE_PREFIX}${normalize(address)}:${normalize(battleId)}`;
}

function relevantEvents(
  eventsNewestFirst: PvpBattleLogEvent[],
  battleId: string,
): PvpBattleLogEvent[] {
  const normalizedBattleId = normalize(battleId);
  const seen = new Set<string>();
  return eventsNewestFirst
    .filter((event) => eventBattleId(event) === normalizedBattleId)
    .filter((event) => {
      const key = `${eventDigest(event)}:${event.id?.eventSeq ?? ""}`;
      if (!eventDigest(event) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reverse();
}

function growthChanged(previous: PvpBattleLogEvent, next: PvpBattleLogEvent): boolean {
  return (
    numberValue(previous.parsedJson?.player1_growth) !==
      numberValue(next.parsedJson?.player1_growth) ||
    numberValue(previous.parsedJson?.player2_growth) !==
      numberValue(next.parsedJson?.player2_growth)
  );
}

function lastMoveChanged(previous: PvpBattleLogEvent, next: PvpBattleLogEvent): boolean {
  return (
    numberValue(previous.parsedJson?.last_move_ms) !==
    numberValue(next.parsedJson?.last_move_ms)
  );
}

export function selectPvpBattleLogMoveDigests(
  eventsNewestFirst: PvpBattleLogEvent[],
  battleId: string,
): string[] {
  const events = relevantEvents(eventsNewestFirst, battleId);
  const digests: string[] = [];

  events.forEach((event, index) => {
    if (index === 0) {
      digests.push(eventDigest(event));
      return;
    }
    const previous = events[index - 1];
    if (growthChanged(previous, event) || lastMoveChanged(previous, event)) {
      digests.push(eventDigest(event));
    }
  });

  return Array.from(new Set(digests.filter(Boolean)));
}

export function reconstructPvpBattleLog(options: {
  eventsNewestFirst: PvpBattleLogEvent[];
  battleId: string;
  address: string;
  resolutions: ReadonlyMap<string, PvpMoveResolution>;
}): ActionEntry[] {
  const events = relevantEvents(options.eventsNewestFirst, options.battleId);
  const address = normalize(options.address);
  const entries: ActionEntry[] = [];

  events.forEach((event, index) => {
    const json = event.parsedJson ?? {};
    const player1 = normalize(json.player1);
    const player2 = normalize(json.player2);
    const sender = normalize(event.sender);
    if (!address || (address !== player1 && address !== player2)) return;
    if (sender !== player1 && sender !== player2) return;

    const previous = index > 0 ? events[index - 1] : null;
    const resolution = options.resolutions.get(eventDigest(event));
    const hasStateTransition = !!previous &&
      (growthChanged(previous, event) || lastMoveChanged(previous, event));
    if (!hasStateTransition && resolution?.source !== "transaction") return;

    const previousJson = previous?.parsedJson ?? {};
    const isPlayer1 = address === player1;
    const actor = sender === address ? "you" : "opponent";
    const timestamp = numberValue(event.timestampMs) ||
      numberValue(json.last_move_ms) || Date.now();

    entries.push({
      id: `chain:${eventDigest(event)}:${event.id?.eventSeq ?? "0"}`,
      timestamp,
      actor,
      moveId:
        resolution?.source === "transaction" && resolution.moveId
          ? resolution.moveId
          : 0,
      prevPlayerGrowth: isPlayer1
        ? numberValue(previousJson.player1_growth)
        : numberValue(previousJson.player2_growth),
      nextPlayerGrowth: isPlayer1
        ? numberValue(json.player1_growth)
        : numberValue(json.player2_growth),
      prevOpponentGrowth: isPlayer1
        ? numberValue(previousJson.player2_growth)
        : numberValue(previousJson.player1_growth),
      nextOpponentGrowth: isPlayer1
        ? numberValue(json.player2_growth)
        : numberValue(json.player1_growth),
      label:
        resolution?.label ??
        (actor === "you" ? "Your move resolved" : "Opponent move resolved"),
    });
  });

  return entries;
}

function sameTransition(left: ActionEntry, right: ActionEntry): boolean {
  return (
    left.actor === right.actor &&
    left.prevPlayerGrowth === right.prevPlayerGrowth &&
    left.nextPlayerGrowth === right.nextPlayerGrowth &&
    left.prevOpponentGrowth === right.prevOpponentGrowth &&
    left.nextOpponentGrowth === right.nextOpponentGrowth &&
    Math.abs(left.timestamp - right.timestamp) < 120_000
  );
}

export function mergeBattleLogEntries(
  existing: ActionEntry[],
  recovered: ActionEntry[],
): ActionEntry[] {
  const merged = [...existing];
  for (const recoveredEntry of recovered) {
    const exactIndex = merged.findIndex((entry) => entry.id === recoveredEntry.id);
    if (exactIndex >= 0) {
      merged[exactIndex] = recoveredEntry;
      continue;
    }

    const transitionIndex = merged.findIndex((entry) => sameTransition(entry, recoveredEntry));
    if (transitionIndex >= 0) {
      merged[transitionIndex] = recoveredEntry;
    } else {
      merged.push(recoveredEntry);
    }
  }

  return merged
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-BATTLE_LOG_CACHE_MAX_ENTRIES);
}

export function readBattleLogCache(
  storage: StorageLike,
  address: string,
  battleId: string,
  now = Date.now(),
): ActionEntry[] {
  const key = logStorageKey(address, battleId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const cached = JSON.parse(raw) as BattleLogCacheRecord;
    if (
      cached.version !== 1 ||
      normalize(cached.battleId) !== normalize(battleId) ||
      now - cached.cachedAt > BATTLE_LOG_CACHE_MAX_AGE_MS ||
      !Array.isArray(cached.entries)
    ) {
      storage.removeItem(key);
      return [];
    }
    return cached.entries.slice(-BATTLE_LOG_CACHE_MAX_ENTRIES);
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
    return [];
  }
}

export function writeBattleLogCache(
  storage: StorageLike,
  address: string,
  battleId: string,
  entries: ActionEntry[],
  now = Date.now(),
) {
  const record: BattleLogCacheRecord = {
    version: 1,
    cachedAt: now,
    battleId,
    entries: entries.slice(-BATTLE_LOG_CACHE_MAX_ENTRIES),
  };
  try {
    storage.setItem(logStorageKey(address, battleId), JSON.stringify(record));
  } catch {
    // Battle play must continue even when browser storage is unavailable.
  }
}

export function removeBattleLogCache(
  storage: StorageLike,
  address: string,
  battleId: string,
) {
  try {
    storage.removeItem(logStorageKey(address, battleId));
  } catch {
    // Battle play must continue even when browser storage is unavailable.
  }
}
