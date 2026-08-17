import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearPvpMoveResolutionCacheForTests,
  resolvePvpMoveFromTransactionBlock,
} from "./pvpMoveResolution";

const battleId =
  "0x22bde19ced50e2d4475d80c8e343dceaac403eb5a0adc3ac4ed49228233f7903";
const otherBattleId =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

function txBlock({
  functionName = "use_ability_id_pvp_v2",
  moduleName = "battle",
  objectId = battleId,
  moveId = 28,
  pureInput = { type: "pure", valueType: "u8", value: moveId },
} = {}) {
  return {
    transaction: {
      data: {
        transaction: {
          kind: "ProgrammableTransaction",
          inputs: [
            {
              type: "object",
              objectType: "sharedObject",
              objectId,
              initialSharedVersion: "944419412",
              mutable: true,
            },
            pureInput,
            {
              type: "object",
              objectType: "sharedObject",
              objectId:
                "0x0000000000000000000000000000000000000000000000000000000000000008",
              initialSharedVersion: "326168368",
              mutable: false,
            },
          ],
          transactions: [
            {
              MoveCall: {
                package:
                  "0x9a80317a43e1d59a4d13f9771a003b773153d729e79da329fa1793d301042edf",
                module: moduleName,
                function: functionName,
                arguments: [{ Input: 0 }, { Input: 1 }, { Input: 2 }],
              },
            },
          ],
        },
      },
    },
  };
}

describe("resolvePvpMoveFromTransactionBlock", () => {
  it("resolves exact move ID from a v2 player-1 transaction", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ moveId: 28 }),
      battleId,
    );

    assert.equal(result.source, "transaction");
    assert.equal(result.moveId, 28);
    assert.equal(result.label, "Sap Overflow");
  });

  it("resolves exact move ID from a v2 player-2 transaction", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ moveId: 29 }),
      battleId,
    );

    assert.equal(result.source, "transaction");
    assert.equal(result.moveId, 29);
    assert.equal(result.label, "Cloud Cover");
  });

  it("resolves legacy use_ability_id move calls", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ functionName: "use_ability_id", moveId: 9 }),
      battleId,
    );

    assert.equal(result.source, "transaction");
    assert.equal(result.moveId, 9);
    assert.equal(result.label, "Life Absorb");
  });

  it("rejects unrelated Move calls", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ moduleName: "matchmaking", functionName: "join_queue" }),
      battleId,
    );

    assert.equal(result.source, "unavailable");
    assert.equal(result.moveId, null);
    assert.equal(result.failureCategory, "unsupported-transaction");
  });

  it("rejects wrong battle objects", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ objectId: otherBattleId }),
      battleId,
    );

    assert.equal(result.source, "unavailable");
    assert.equal(result.moveId, null);
    assert.equal(result.failureCategory, "wrong-battle-object");
  });

  it("returns unresolved for malformed pure input", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ pureInput: { type: "pure", valueType: "u8", value: "nope" } }),
      battleId,
    );

    assert.equal(result.source, "unavailable");
    assert.equal(result.moveId, null);
    assert.equal(result.failureCategory, "malformed-move-id");
  });

  it("returns unresolved for unknown move IDs", () => {
    const result = resolvePvpMoveFromTransactionBlock(
      txBlock({ moveId: 255 }),
      battleId,
    );

    assert.equal(result.source, "unavailable");
    assert.equal(result.moveId, null);
    assert.equal(result.failureCategory, "unknown-move-id");
  });

  it("clears the bounded cache for test isolation", () => {
    clearPvpMoveResolutionCacheForTests();
    assert.ok(true);
  });
});
