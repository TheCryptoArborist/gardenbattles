import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTreeRerollCost,
  getTreeRerollCostRaw,
  getTreeRerollMoveFunction,
  parseTreeRerollCostRaw,
  selectTreeCoinInputs,
} from "./treeReroll";

test("reroll routes only to the active paid battle types", () => {
  assert.equal(getTreeRerollMoveFunction("pvp-v3"), "reroll_pvp_v3_moves");
  assert.equal(getTreeRerollMoveFunction("bot-v2"), "reroll_ranked_bot_v2_moves");
  assert.equal(getTreeRerollMoveFunction("pvp-v2"), null);
  assert.equal(getTreeRerollMoveFunction("legacy"), null);
});

test("reroll cost is read from the on-chain TreeConfig", () => {
  const response = { data: { content: { fields: { reroll_cost: "10000000000" } } } };
  const cost = parseTreeRerollCostRaw(response);
  assert.equal(cost, BigInt(10_000_000_000));
  assert.equal(formatTreeRerollCost(cost!), 10_000);
  assert.equal(parseTreeRerollCostRaw({ data: { content: { fields: { reroll_cost: "0" } } } }), null);
});

test("PvP rerolls cost twice the Garden Bot base fee", () => {
  const baseCost = BigInt(10_000_000_000);
  assert.equal(getTreeRerollCostRaw(baseCost, "bot-v2"), BigInt(10_000_000_000));
  assert.equal(getTreeRerollCostRaw(baseCost, "pvp-v3"), BigInt(20_000_000_000));
});

test("TREE coin selection combines only as many objects as the fee needs", () => {
  const selected = selectTreeCoinInputs(
    [
      { coinObjectId: "0x1", balance: "400" },
      { coinObjectId: "0x2", balance: "700" },
      { coinObjectId: "0x3", balance: "900" },
    ],
    BigInt(1_000),
  );
  assert.deepEqual(selected, { coinObjectIds: ["0x1", "0x2"], totalRaw: BigInt(1_100) });
  assert.equal(selectTreeCoinInputs([{ coinObjectId: "0x1", balance: "999" }], BigInt(1_000)), null);
});
