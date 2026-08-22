import assert from "node:assert/strict";
import test from "node:test";
import type {
  SuiTransport,
  SuiTransportRequestOptions,
  SuiTransportSubscribeOptions,
} from "@mysten/sui/client";
import {
  shouldFailoverSuiRpcError,
  SuiFailoverTransport,
} from "./suiFailoverTransport";

function transport(
  request: <T>(input: SuiTransportRequestOptions) => Promise<T>,
): SuiTransport {
  return {
    request,
    subscribe: async <T>(_input: SuiTransportSubscribeOptions<T>) =>
      async () => true,
  };
}

test("fails over after the Sui public fullnode JSON-RPC shutdown error", async () => {
  const calls: string[] = [];
  const failover = new SuiFailoverTransport([
    transport(async (input) => {
      calls.push(`first:${input.method}`);
      const error = new Error(
        "Method not found. JSON-RPC on public fullnodes has been deprecated.",
      ) as Error & { code: number };
      error.code = -32601;
      throw error;
    }),
    transport(async <T>(input: SuiTransportRequestOptions) => {
      calls.push(`second:${input.method}`);
      return { ok: true } as T;
    }),
  ]);

  const result = await failover.request<{ ok: boolean }>({
    method: "sui_getObject",
    params: [],
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, ["first:sui_getObject", "second:sui_getObject"]);
});

test("fails over on rate limits and transport failures", () => {
  assert.equal(
    shouldFailoverSuiRpcError(Object.assign(new Error("Too Many Requests"), { status: 429 })),
    true,
  );
  assert.equal(shouldFailoverSuiRpcError(new Error("Failed to fetch")), true);
});

test("preserves explicit transaction execution errors", async () => {
  let secondCalled = false;
  const explicitFailure = Object.assign(new Error("MoveAbort in battle module"), {
    code: -32002,
  });
  const failover = new SuiFailoverTransport([
    transport(async () => {
      throw explicitFailure;
    }),
    transport(async <T>() => {
      secondCalled = true;
      return {} as T;
    }),
  ]);

  await assert.rejects(
    failover.request({ method: "sui_executeTransactionBlock", params: [] }),
    explicitFailure,
  );
  assert.equal(secondCalled, false);
});
