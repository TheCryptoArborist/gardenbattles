import assert from "node:assert/strict";
import test from "node:test";
import {
  assertTreeRerollTreasuryPayment,
  buildTreeRerollTransaction,
  TREE_REROLL_TREASURY,
  TREE_REROLL_PACKAGE,
  formatTreeRerollCost,
  getTreeRerollCostRaw,
  getTreeRerollMoveFunction,
  parseTreeRerollCostRaw,
  selectTreeCoinInputs,
} from "./treeReroll";
import { TREE_COIN_TYPE } from "./treeBalance";

const testSender = `0x${"1".repeat(64)}`;
const testFee = BigInt(20_000_000_000);
const change = (owner: string, amount: string) => ({ coinType: TREE_COIN_TYPE, owner: { AddressOwner: owner }, amount });
const preview = (balanceChanges: unknown[], status = "success") => ({ effects: { status: { status } }, balanceChanges });

test("reroll payment permits only the exact sender debit and treasury credit", () => {
  assert.doesNotThrow(() => assertTreeRerollTreasuryPayment(preview([
    change(testSender, (-testFee).toString()), change(TREE_REROLL_TREASURY, testFee.toString()),
    { coinType: "0x2::sui::SUI", owner: { AddressOwner: testSender }, amount: "-1500000" },
  ]), testSender, testFee));
});
test("zero-address, wrong recipient, extra charge and unverifiable rerolls fail closed", () => {
  for (const result of [null, {}, preview([]), preview([], "failure"),
    preview([change(testSender, (-testFee).toString()), change(`0x${"0".repeat(64)}`, testFee.toString())]),
    preview([change(testSender, (-testFee).toString()), change(`0x${"2".repeat(64)}`, testFee.toString())]),
    preview([change(testSender, "-20000000001"), change(TREE_REROLL_TREASURY, testFee.toString())]),
    preview([change(testSender, (-testFee).toString()), change(TREE_REROLL_TREASURY, "19000000000")]),
    preview([change(testSender, (-testFee).toString()), change(TREE_REROLL_TREASURY, "NaN")]),
  ]) assert.throws(() => assertTreeRerollTreasuryPayment(result, testSender, testFee), /Reroll blocked/);
});
test("paid reroll transaction targets the approved treasury-routing package", () => {
  const tx = buildTreeRerollTransaction({ address: testSender, battleId: "0x2", battleVersion: "pvp-v3", treeConfigId: "0x3", randomObjectId: "0x8", costRaw: testFee, coinObjectIds: ["0x4"] });
  const call = tx.getData().commands.find((command) => command.$kind === "MoveCall");
  assert.equal(call?.MoveCall?.package, TREE_REROLL_PACKAGE);
  assert.equal(call?.MoveCall?.function, "reroll_pvp_v3_moves");
});

test("reroll routes only to active paid PvP", () => {
  assert.equal(getTreeRerollMoveFunction("pvp-v3"), "reroll_pvp_v3_moves");
  assert.equal(getTreeRerollMoveFunction("bot-v2"), null);
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
