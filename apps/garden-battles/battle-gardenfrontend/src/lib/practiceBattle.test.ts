import assert from "node:assert/strict";
import test from "node:test";
import { createPracticeBattle } from "./practiceBattle";
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
