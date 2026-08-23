import assert from "node:assert/strict";
import test from "node:test";
import { createPracticeBattle, playPracticeRound } from "./practiceBattle";
import { MOVE_META } from "./sui-config";

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

test("practice mode enforces the catalog no-consecutive-card rule", () => {
  const battle = createPracticeBattle();
  const repeatedMove = battle.player1Moves[0];
  battle.playerMoveHistory = [repeatedMove];
  assert.throws(
    () => playPracticeRound(battle, repeatedMove),
    /same card cannot be played twice in a row/i,
  );
});
