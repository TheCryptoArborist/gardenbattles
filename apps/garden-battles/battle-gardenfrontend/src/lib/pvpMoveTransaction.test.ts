import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Transaction } from "@mysten/sui/transactions";

import { addPvpMoveRequestNonce } from "./pvpMoveTransaction";

function makeMoveTransaction(nonce: number) {
  const transaction = new Transaction();
  addPvpMoveRequestNonce(transaction, nonce);
  transaction.moveCall({
    target: "0x2::example::use_move",
    arguments: [transaction.pure.u8(26)],
  });
  return transaction;
}

describe("addPvpMoveRequestNonce", () => {
  it("makes repeated move requests unique without changing move arguments", async () => {
    const first = JSON.parse(await makeMoveTransaction(101).toJSON());
    const second = JSON.parse(await makeMoveTransaction(102).toJSON());

    assert.notDeepEqual(first.inputs[0], second.inputs[0]);
    assert.deepEqual(first.inputs.slice(1), second.inputs.slice(1));
    assert.deepEqual(first.commands, second.commands);
  });
});
