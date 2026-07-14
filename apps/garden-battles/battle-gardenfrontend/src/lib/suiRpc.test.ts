import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifySuiRpcReadError,
  readSuiObjectWithRetry,
  SuiRpcReadError,
} from "./suiRpc";

function objectResponse(id = "0xobject") {
  return {
    data: {
      objectId: id,
      content: { fields: {} },
    },
  };
}

function retryableError(status = 429) {
  const error = new Error(`${status} Too Many Requests`) as Error & {
    status?: number;
  };
  error.status = status;
  return error;
}

function clientFromResults(results: Array<unknown>) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      async getObject(args: unknown) {
        calls.push(args);
        const result = results.shift();
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
}

describe("readSuiObjectWithRetry", () => {
  it("returns the primary RPC object response when primary succeeds", async () => {
    const primary = clientFromResults([objectResponse()]);

    const result = await readSuiObjectWithRetry(
      primary.client,
      { id: "0xqueue", options: { showContent: true } },
      { operation: "test-read", retryDelaysMs: [] },
    );

    assert.equal(result.data?.objectId, "0xobject");
    assert.equal(primary.calls.length, 1);
  });

  it("retries primary after a 429 and succeeds", async () => {
    const primary = clientFromResults([retryableError(429), objectResponse()]);

    const result = await readSuiObjectWithRetry(
      primary.client,
      { id: "0xqueue", options: { showContent: true } },
      { operation: "test-read", retryDelaysMs: [0] },
    );

    assert.equal(result.data?.objectId, "0xobject");
    assert.equal(primary.calls.length, 2);
  });

  it("uses configured fallback when primary stays rate-limited", async () => {
    const primary = clientFromResults([retryableError(429)]);
    const fallback = clientFromResults([objectResponse("0xfallback")]);

    const result = await readSuiObjectWithRetry(
      primary.client,
      { id: "0xqueue", options: { showContent: true } },
      {
        operation: "test-read",
        fallbackClient: fallback.client,
        retryDelaysMs: [],
      },
    );

    assert.equal(result.data?.objectId, "0xfallback");
    assert.equal(primary.calls.length, 1);
    assert.equal(fallback.calls.length, 1);
  });

  it("throws a rate-limited read error when all endpoints are exhausted", async () => {
    const primary = clientFromResults([retryableError(429)]);
    const fallback = clientFromResults([retryableError(503)]);

    await assert.rejects(
      () =>
        readSuiObjectWithRetry(
          primary.client,
          { id: "0xqueue", options: { showContent: true } },
          {
            operation: "test-read",
            fallbackClient: fallback.client,
            retryDelaysMs: [],
          },
        ),
      (error) =>
        error instanceof SuiRpcReadError && error.kind === "rate_limited",
    );
  });

  it("classifies transport failures as retryable", () => {
    const result = classifySuiRpcReadError(new Error("Failed to fetch"));

    assert.equal(result.kind, "transport");
    assert.equal(result.retryable, true);
  });
});
