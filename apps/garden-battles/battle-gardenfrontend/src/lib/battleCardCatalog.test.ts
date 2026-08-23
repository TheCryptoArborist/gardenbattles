import assert from "node:assert/strict";
import test from "node:test";
import { MOVE_LABELS, MOVE_META } from "./sui-config";

test("the complete 39-card catalog has labels, effects, and valid types", () => {
  for (let moveId = 1; moveId <= 39; moveId += 1) {
    assert.ok(MOVE_LABELS[moveId], `missing label for card ${moveId}`);
    assert.ok(MOVE_META[moveId]?.effect, `missing effect for card ${moveId}`);
    assert.ok(["attack", "growth", "hybrid"].includes(MOVE_META[moveId].type));
  }
});

test("only cards 31-39 are exclusive TREE Power fifth-card candidates", () => {
  for (let moveId = 1; moveId <= 30; moveId += 1) {
    assert.equal(MOVE_META[moveId].fifthExclusive, undefined);
  }
  assert.deepEqual(
    [31, 32, 33].map((id) => MOVE_META[id].draftLane),
    ["offense", "offense", "offense"],
  );
  assert.deepEqual(
    [34, 35, 36].map((id) => MOVE_META[id].draftLane),
    ["growth", "growth", "growth"],
  );
  assert.deepEqual(
    [37, 38, 39].map((id) => MOVE_META[id].draftLane),
    ["defense", "defense", "defense"],
  );
});
