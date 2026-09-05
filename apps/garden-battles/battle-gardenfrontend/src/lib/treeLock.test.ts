import assert from "node:assert/strict";
import test from "node:test";
import { TREE_COIN_TYPE } from "./treeBalance";
import { assertTreeLockPreview, selectTreeLockCoins, TREE_LOCK_MINIMUM_RAW } from "./treeLock";

const sender = "0x1111111111111111111111111111111111111111111111111111111111111111";

test("TREE Lock coin selection requires at least one million TREE", () => {
  assert.equal(selectTreeLockCoins([{ coinObjectId: "0x1", balance: TREE_LOCK_MINIMUM_RAW - BigInt(1) }]), null);
  assert.deepEqual(selectTreeLockCoins([
    { coinObjectId: "0x1", balance: "400000000000" },
    { coinObjectId: "0x2", balance: "600000000000" },
  ])?.totalRaw, TREE_LOCK_MINIMUM_RAW);
});

test("TREE Lock preview requires exact debit and a wallet-owned receipt", () => {
  assert.doesNotThrow(() => assertTreeLockPreview({
    effects: { status: { status: "success" } },
    balanceChanges: [{ coinType: TREE_COIN_TYPE, owner: { AddressOwner: sender }, amount: "-1000000000000" }],
    objectChanges: [{ type: "created", objectType: `0xabc::tree_lock::TreeLock<${TREE_COIN_TYPE}>`, owner: { AddressOwner: sender } }],
  }, sender));
  assert.throws(() => assertTreeLockPreview({
    effects: { status: { status: "success" } },
    balanceChanges: [{ coinType: TREE_COIN_TYPE, owner: { AddressOwner: sender }, amount: "-1000000000000" }],
    objectChanges: [],
  }, sender), /custody could not be verified/);
});
