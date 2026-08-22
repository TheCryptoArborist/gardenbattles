import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Transaction } from "@mysten/sui/transactions";

import {
  addPvpMoveRequestNonce,
  BATTLE_MOVE_GAS_BUDGET_MIST,
  setBattleMoveGasBudget,
} from "./pvpMoveTransaction";

function makeMoveTransaction(nonce: number) {
  const transaction = new Transaction();
  addPvpMoveRequestNonce(transaction, nonce);
  setBattleMoveGasBudget(transaction);
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

  it("sets a fixed safety budget for variable-cost battle moves", async () => {
    const transaction = JSON.parse(await makeMoveTransaction(103).toJSON());

    assert.equal(
      Number(transaction.gasData.budget),
      BATTLE_MOVE_GAS_BUDGET_MIST,
    );
  });
});
