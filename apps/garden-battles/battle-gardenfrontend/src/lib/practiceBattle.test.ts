import assert from "node:assert/strict";
import test from "node:test";
import { createPracticeBattle, playPracticeRound } from "./practiceBattle";
import { MOVE_META } from "./sui-config";
import { getArboristTrialChallenge } from "@shared/arborist-trials";
import {
  applyArboristTrialFifthMove,
  createArboristTrialBattle,
  getArboristTrialResult,
  getCanopyDiagnosisForecast,
  getToolbeltLockedMoveIds,
  playArboristTrialRound,
} from "./arboristTrials";

test("a verified TREE Lock upgrades an active four-card Trial hand", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-05T12:00:00.000Z"));
  const fourCardBattle = createArboristTrialBattle(challenge, false);
  const upgraded = applyArboristTrialFifthMove(fourCardBattle, challenge, true);

  assert.equal(fourCardBattle.player1Moves.length, 4);
  assert.equal(upgraded.player1Moves.length, 5);
  assert.ok(upgraded.player1Moves[4] >= 31 && upgraded.player1Moves[4] <= 39);
  assert.equal(applyArboristTrialFifthMove(upgraded, challenge, true), upgraded);
});

test("practice hands mirror the balanced four-card deal", () => {
  for (let i = 0; i < 500; i += 1) {
    const battle = createPracticeBattle();
    for (const hand of [battle.player1Moves, battle.player2Moves]) {
      assert.equal(hand.length, 4);
      assert.equal(new Set(hand).size, 4);
      assert.ok(hand.some((move) => MOVE_META[move]?.type === "attack"));
      assert.ok(hand.some((move) => MOVE_META[move]?.type === "growth"));
      assert.ok(hand.some((move) => MOVE_META[move]?.type === "hybrid"));
    }
  }
});

test("Canopy Diagnosis forecasts and deals the announced Garden Bot card type", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-03T12:00:00.000Z"));
  let battle = createArboristTrialBattle(challenge, false);
  const forecast = getCanopyDiagnosisForecast(battle, challenge);
  assert.ok(forecast);
  battle = playArboristTrialRound(battle, challenge, battle.player1Moves[0]).battle;
  assert.equal(MOVE_META[battle.allBotMoves[0]]?.type, forecast);
});

test("Toolbelt Rotation locks a standard card until the four-card cycle completes", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-05T12:00:00.000Z"));
  const battle = createArboristTrialBattle(challenge, true);
  const standardMove = battle.player1Moves[0];
  const next = playArboristTrialRound(battle, challenge, standardMove).battle;
  assert.equal(getToolbeltLockedMoveIds(next, challenge).has(standardMove), true);
  assert.throws(
    () => playArboristTrialRound(next, challenge, standardMove),
    /tool is locked/i,
  );
});

test("Storm Response applies four Growth of storm damage after round three", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-07T12:00:00.000Z"));
  let battle = createArboristTrialBattle(challenge, false);
  let stormLogged = false;
  for (let round = 0; round < 3 && !battle.finished; round += 1) {
    const move = battle.player1Moves.find((moveId) => moveId !== battle.playerMoveHistory.at(-1))!;
    const played = playArboristTrialRound(battle, challenge, move);
    battle = played.battle;
    stormLogged ||= played.entries.some((entry) => entry.label === "Storm Front");
  }
  assert.equal(stormLogged, true);
});

test("Integrated Pest Management awards the full specialty bonus for two Attack plays", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-08T12:00:00.000Z"));
  const battle = createArboristTrialBattle(challenge, false);
  battle.finished = true;
  battle.winner = "practice-player";
  battle.allPlayerMoves = [1, 15, 9, 2];
  const result = getArboristTrialResult(battle, challenge);
  assert.equal(result.specialtyBonus, 1_500);
  assert.match(result.specialtySummary ?? "", /2 Attack cards/);
});

test("practice mode enforces the catalog no-consecutive-card rule", () => {
  const battle = createPracticeBattle();
  const repeatedMove = battle.player1Moves[0];
  battle.playerMoveHistory = [repeatedMove];
  assert.throws(
    () => playPracticeRound(battle, repeatedMove),
    /same card cannot be played twice in a row/i,
  );
});

test("seeded Arborist Trials deal identical hands and outcomes", () => {
  const options = {
    seed: 8675309,
    mode: "arborist-trial" as const,
    challengeId: "daily-test",
    playerStartGrowth: 0,
    botStartGrowth: 8,
    bonusMoveId: 34,
  };
  let first = createPracticeBattle(options);
  let second = createPracticeBattle(options);
  assert.deepEqual(first.player1Moves, second.player1Moves);
  assert.deepEqual(first.player2Moves, second.player2Moves);
  assert.equal(first.player1Moves.length, 5);
  assert.equal(first.player1Moves[4], 34);

  for (let round = 0; round < 3 && !first.finished; round += 1) {
    const move = first.player1Moves.find((moveId) => moveId !== first.playerMoveHistory.at(-1))!;
    const firstResult = playPracticeRound(first, move);
    const secondResult = playPracticeRound(second, move);
    first = firstResult.battle;
    second = secondResult.battle;
    assert.deepEqual(
      {
        player1Growth: first.player1Growth,
        player2Growth: first.player2Growth,
        botMoveHistory: first.botMoveHistory,
        playerStatus: first.playerStatus,
        botStatus: first.botStatus,
      },
      {
        player1Growth: second.player1Growth,
        player2Growth: second.player2Growth,
        botMoveHistory: second.botMoveHistory,
        playerStatus: second.playerStatus,
        botStatus: second.botStatus,
      },
    );
  }
});
