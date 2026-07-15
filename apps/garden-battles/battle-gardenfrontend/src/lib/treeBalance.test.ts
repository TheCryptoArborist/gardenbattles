import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCompactTREE,
  getTreeBalanceView,
  makeTreeBalanceView,
} from "./treeBalance";

test("formats compact TREE balances", () => {
  assert.equal(formatCompactTREE(1_150_000), "1.1M");
  assert.equal(formatCompactTREE(11_283_000), "11.3M");
  assert.equal(formatCompactTREE(15_500), "15.5K");
  assert.equal(formatCompactTREE(42), "42.0");
  assert.equal(formatCompactTREE(0), "0.0000");
});

test("builds disconnected, loading, unavailable, positive, and zero balance views", () => {
  assert.deepEqual(getTreeBalanceView({ address: null }), {
    status: "disconnected",
    label: "Connect wallet",
    exactLabel: null,
    amount: null,
  });

  assert.deepEqual(getTreeBalanceView({ address: "0x1", isLoading: true }), {
    status: "loading",
    label: "Loading",
    exactLabel: null,
    amount: null,
  });

  assert.deepEqual(getTreeBalanceView({ address: "0x1", isUnavailable: true }), {
    status: "unavailable",
    label: "Unavailable",
    exactLabel: null,
    amount: null,
  });

  assert.equal(makeTreeBalanceView(1_150_000).label, "1.1M TREE");
  assert.equal(makeTreeBalanceView(0).label, "0.0000 TREE");
});
