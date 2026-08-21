import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSuiMoveList } from "./suiMoveList";

describe("normalizeSuiMoveList", () => {
  it("preserves legacy JSON-RPC numeric arrays", () => {
    assert.deepEqual(normalizeSuiMoveList([12, "13", 28, 29]), [12, 13, 28, 29]);
  });

  it("decodes GraphQL vector<u8> Base64 values", () => {
    assert.deepEqual(normalizeSuiMoveList("DA0cHQ=="), [12, 13, 28, 29]);
    assert.deepEqual(normalizeSuiMoveList("BwwUGw=="), [7, 12, 20, 27]);
  });

  it("supports wrapped Move values and rejects unusable input", () => {
    assert.deepEqual(normalizeSuiMoveList({ fields: { value: "DA0cHQ==" } }), [
      12,
      13,
      28,
      29,
    ]);
    assert.deepEqual(normalizeSuiMoveList(null), []);
  });
});
