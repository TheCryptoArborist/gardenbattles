import assert from "node:assert/strict";
import test from "node:test";
import {
  getBattleMoveFunction,
  getFifthMoveDraftState,
  isUnlockedFifthMoveCard,
} from "./pvpFifthMoveDraft";

test("splits an entitled hand into base cards and one exclusive candidate per draft lane", () => {
  assert.deepEqual(getFifthMoveDraftState([1, 20, 8, 24, 31, 34, 37], true), {
    pending: true,
    playableMoves: [1, 20, 8, 24],
    candidates: [31, 34, 37],
  });
});

test("keeps selected and non-entitled hands directly playable", () => {
  assert.deepEqual(getFifthMoveDraftState([1, 20, 8, 24, 9], true), {
    pending: false,
    playableMoves: [1, 20, 8, 24, 9],
    candidates: [],
  });
  assert.deepEqual(getFifthMoveDraftState([1, 20, 8, 24], false), {
    pending: false,
    playableMoves: [1, 20, 8, 24],
    candidates: [],
  });
});

test("routes PvP and ranked bot drafts through their atomic selection functions", () => {
  assert.equal(
    getBattleMoveFunction("pvp-v3", true),
    "use_ability_id_pvp_v3_with_fifth_move",
  );
  assert.equal(
    getBattleMoveFunction("bot-v2", true),
    "use_ability_id_ranked_bot_v2_with_fifth_move",
  );
  assert.equal(getBattleMoveFunction("pvp-v3", false), "use_ability_id_pvp_v3");
  assert.equal(getBattleMoveFunction("bot-v2", false), "use_ability_id_ranked_bot_v2");
});

test("identifies only the earned fifth slot after the draft is locked", () => {
  assert.equal(isUnlockedFifthMoveCard(4, 5, true), true);
  assert.equal(isUnlockedFifthMoveCard(3, 5, true), false);
  assert.equal(isUnlockedFifthMoveCard(4, 4, true), false);
  assert.equal(isUnlockedFifthMoveCard(4, 5, false), false);
});
