import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { awaitPvpMovePreflight } from "./pvpMovePreflight";

describe("awaitPvpMovePreflight", () => {
  it("returns a completed live read", async () => {
    const result = await awaitPvpMovePreflight(Promise.resolve("live"), 50);

    assert.deepEqual(result, { status: "completed", value: "live" });
  });

  it("stops waiting when the live read stalls", async () => {
    const stalled = new Promise<string>(() => undefined);
    const result = await awaitPvpMovePreflight(stalled, 5);

    assert.deepEqual(result, { status: "timed-out" });
  });
});
