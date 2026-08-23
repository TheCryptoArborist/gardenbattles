import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionEntry } from "@/components/BattleLog";
import {
  mergeBattleLogEntries,
  readBattleLogCache,
  reconstructPvpBattleLog,
  selectPvpBattleLogMoveDigests,
  writeBattleLogCache,
  type PvpBattleLogEvent,
} from "./pvpBattleLogRecovery";

const battleId = "0xbattle";
const player1 = "0x111";
const player2 = "0x222";

function event(input: {
  digest: string;
  sender: string;
  timestamp: number;
  p1: number;
  p2: number;
  lastMove: number;
}): PvpBattleLogEvent {
  return {
    id: { txDigest: input.digest, eventSeq: "0" },
    sender: input.sender,
    timestampMs: String(input.timestamp),
    parsedJson: {
      battle_id: battleId,
      player1,
      player2,
      player1_growth: String(input.p1),
      player2_growth: String(input.p2),
      last_move_ms: String(input.lastMove),
    },
  };
}

const creation = event({ digest: "create", sender: player2, timestamp: 1_000, p1: 0, p2: 0, lastMove: 0 });
const p1Move = event({ digest: "p1move", sender: player1, timestamp: 2_000, p1: 12, p2: 0, lastMove: 2_000 });
const p2Move = event({ digest: "p2move", sender: player2, timestamp: 3_000, p1: 7, p2: 0, lastMove: 3_000 });

describe("PvP battle-log recovery", () => {
  it("reconstructs chronological exact moves for player one from newest-first events", () => {
    const events = [p2Move, p1Move, creation];
    const resolutions = new Map([
      ["create", { source: "unavailable" as const, moveId: null }],
      ["p1move", { source: "transaction" as const, moveId: 28, label: "Sap Surge" }],
      ["p2move", { source: "transaction" as const, moveId: 1, label: "Wedgebreaker" }],
    ]);

    const recovered = reconstructPvpBattleLog({ eventsNewestFirst: events, battleId, address: player1, resolutions });

    assert.equal(recovered.length, 2);
    assert.deepEqual(recovered.map((entry) => [entry.actor, entry.moveId, entry.label]), [
      ["you", 28, "Sap Surge"],
      ["opponent", 1, "Wedgebreaker"],
    ]);
    assert.deepEqual(
      [recovered[1].prevPlayerGrowth, recovered[1].nextPlayerGrowth, recovered[1].prevOpponentGrowth, recovered[1].nextOpponentGrowth],
      [12, 7, 0, 0],
    );
  });

  it("flips actors and growth perspective for player two", () => {
    const recovered = reconstructPvpBattleLog({
      eventsNewestFirst: [p2Move, p1Move, creation],
      battleId,
      address: player2,
      resolutions: new Map([
        ["p1move", { source: "transaction" as const, moveId: 28, label: "Sap Surge" }],
        ["p2move", { source: "transaction" as const, moveId: 1, label: "Wedgebreaker" }],
      ]),
    });

    assert.deepEqual(recovered.map((entry) => entry.actor), ["opponent", "you"]);
    assert.deepEqual(
      [recovered[0].prevPlayerGrowth, recovered[0].nextPlayerGrowth, recovered[0].prevOpponentGrowth, recovered[0].nextOpponentGrowth],
      [0, 0, 0, 12],
    );
  });

  it("selects only creation and state-transition transaction digests", () => {
    const reroll = event({ digest: "reroll", sender: player1, timestamp: 2_500, p1: 12, p2: 0, lastMove: 2_000 });
    assert.deepEqual(
      selectPvpBattleLogMoveDigests([p2Move, reroll, p1Move, creation], battleId),
      ["create", "p1move", "p2move"],
    );
  });

  it("replaces a locally unresolved transition with the recovered exact move", () => {
    const local: ActionEntry = {
      id: "local",
      timestamp: 3_500,
      actor: "opponent",
      moveId: 0,
      label: "Opponent move resolved",
      prevPlayerGrowth: 12,
      nextPlayerGrowth: 7,
      prevOpponentGrowth: 0,
      nextOpponentGrowth: 0,
    };
    const recovered = reconstructPvpBattleLog({
      eventsNewestFirst: [p2Move, p1Move, creation],
      battleId,
      address: player1,
      resolutions: new Map([
        ["p1move", { source: "transaction" as const, moveId: 28, label: "Sap Surge" }],
        ["p2move", { source: "transaction" as const, moveId: 1, label: "Wedgebreaker" }],
      ]),
    });

    const merged = mergeBattleLogEntries([local], recovered);
    assert.equal(merged.length, 2);
    assert.equal(merged[1].moveId, 1);
    assert.equal(merged[1].label, "Wedgebreaker");
  });

  it("restores a valid cache and rejects an expired cache", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key),
    };
    const entries = reconstructPvpBattleLog({
      eventsNewestFirst: [p2Move, p1Move, creation],
      battleId,
      address: player1,
      resolutions: new Map([
        ["p1move", { source: "transaction" as const, moveId: 28, label: "Sap Surge" }],
        ["p2move", { source: "transaction" as const, moveId: 1, label: "Wedgebreaker" }],
      ]),
    });

    writeBattleLogCache(storage, player1, battleId, entries, 10_000);
    assert.equal(readBattleLogCache(storage, player1, battleId, 11_000).length, 2);
    assert.equal(readBattleLogCache(storage, player1, battleId, 30_000_000).length, 0);
  });
});
