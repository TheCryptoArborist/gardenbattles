import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSuiGetObjectJsonRpcBody,
  buildSuiGetTransactionBlockJsonRpcBody,
  classifySuiRpcReadError,
  readSuiObjectWithRetry,
  readSuiTransactionBlockWithRetry,
  resolveFetchImplementation,
  SuiRpcReadError,
} from "./suiRpc";

const legacyQueue =
  "0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d";
const quickQueue =
  "0x469a5da237047f4c78223e3a2fac6bf42427ba488fd1e26f2233b65f01a31960";
const standardQueue =
  "0x9d805e74d3a4412e4bb935ed383ad8f9dde00715632ea61704ccc4af804666cd";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  } as Response;
}

function objectResult(id = "0xobject") {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      data: {
        objectId: id,
        content: { fields: {} },
      },
    },
  };
}

function fetchFromResponses(responses: Response[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const response = responses.shift();
    if (!response) throw new Error("No test response configured");
    return response;
  };
  return { calls, fetchImpl: fetchImpl as typeof fetch };
}

describe("readSuiObjectWithRetry", () => {
  it("builds a proper sui_getObject JSON-RPC POST body", () => {
    const body = buildSuiGetObjectJsonRpcBody({
      id: quickQueue,
      options: { showContent: true },
    });

    assert.equal(body.method, "sui_getObject");
    assert.equal(body.params[0], quickQueue);
    assert.deepEqual(body.params[1], {
      showType: true,
      showOwner: true,
      showContent: true,
    });
  });

  it("preserves showPreviousTransaction in object reads", () => {
    const body = buildSuiGetObjectJsonRpcBody({
      id: quickQueue,
      options: {
        showContent: true,
        showType: true,
        showPreviousTransaction: true,
      },
    });

    assert.deepEqual(body.params[1], {
      showType: true,
      showOwner: true,
      showContent: true,
      showPreviousTransaction: true,
    });
  });

  it("posts to the endpoint URL unchanged without appending the object ID", async () => {
    const endpoint = "https://example.quicknode.pro/token/path/";
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, objectResult(quickQueue)),
    ]);

    await readSuiObjectWithRetry(
      null,
      { id: quickQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: [endpoint],
        fetchImpl,
        retryDelaysMs: [],
      },
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, endpoint);
    assert.equal(calls[0].init.method, "POST");
    assert.equal(
      JSON.parse(String(calls[0].init.body)).params[0],
      quickQueue,
    );
    assert.equal(calls[0].url.includes(quickQueue), false);
  });

  it("builds a proper sui_getTransactionBlock JSON-RPC POST body", () => {
    const body = buildSuiGetTransactionBlockJsonRpcBody("9digest", {
      showEffects: true,
    });

    assert.equal(body.method, "sui_getTransactionBlock");
    assert.equal(body.params[0], "9digest");
    assert.deepEqual(body.params[1], {
      showInput: true,
      showEffects: true,
      showEvents: false,
      showObjectChanges: false,
      showBalanceChanges: false,
    });
  });

  it("reads transaction blocks through POST without altering endpoint URLs", async () => {
    const endpoint = "https://example.quicknode.pro/token/path/";
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, {
        jsonrpc: "2.0",
        id: 1,
        result: { digest: "9digest" },
      }),
    ]);

    const result = await readSuiTransactionBlockWithRetry("9digest", {
      operation: "tx-read",
      endpoints: [endpoint],
      fetchImpl,
      retryDelaysMs: [],
    });

    assert.equal(result.digest, "9digest");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, endpoint);
    assert.equal(calls[0].init.method, "POST");
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.method, "sui_getTransactionBlock");
    assert.equal(body.params[0], "9digest");
  });

  it("returns the primary RPC object response when primary succeeds", async () => {
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(200, objectResult(legacyQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: legacyQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc"],
        fetchImpl,
        retryDelaysMs: [],
      },
    );

    assert.equal(result.data?.objectId, legacyQueue);
  });

  it("retries primary after a 429 and succeeds", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(429, { error: { code: 429, message: "Too Many Requests" } }),
      jsonResponse(200, objectResult(quickQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: quickQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc"],
        fetchImpl,
        retryDelaysMs: [0],
      },
    );

    assert.equal(result.data?.objectId, quickQueue);
    assert.equal(calls.length, 2);
  });

  it("uses fallback when primary returns 404", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(404, { error: { code: -32000, message: "not found" } }),
      jsonResponse(200, objectResult(standardQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: standardQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc", "https://fallback.example/rpc"],
        fetchImpl,
        retryDelaysMs: [],
      },
    );

    assert.equal(result.data?.objectId, standardQueue);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://primary.example/rpc");
    assert.equal(calls[1].url, "https://fallback.example/rpc");
  });

  it("throws an RPC unavailable error when all endpoints fail", async () => {
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(404, { error: { code: -32000, message: "not found" } }),
      jsonResponse(503, { error: { code: 503, message: "unavailable" } }),
    ]);

    await assert.rejects(
      () =>
        readSuiObjectWithRetry(
          null,
          { id: quickQueue, options: { showContent: true } },
          {
            operation: "test-read",
            endpoints: ["https://primary.example/rpc", "https://fallback.example/rpc"],
            fetchImpl,
            retryDelaysMs: [],
          },
        ),
      (error) =>
        error instanceof SuiRpcReadError &&
        (error.kind === "transport" || error.kind === "rate_limited"),
    );
  });

  it("classifies transport failures as retryable", () => {
    const result = classifySuiRpcReadError(new Error("Failed to fetch"));

    assert.equal(result.kind, "transport");
    assert.equal(result.retryable, true);
  });

  it("default fetch wrapper preserves the globalThis receiver", async () => {
    const originalFetch = globalThis.fetch;
    const expectedReceiver = globalThis;
    let called = false;

    try {
      globalThis.fetch = function receiverSensitiveFetch(
        this: unknown,
        _input: RequestInfo | URL,
        _init?: RequestInit,
      ) {
        called = true;
        if (this !== expectedReceiver) {
          throw new TypeError("Illegal invocation");
        }
        return Promise.resolve(jsonResponse(200, objectResult(quickQueue)));
      } as typeof fetch;

      const wrappedFetch = resolveFetchImplementation();
      const response = await wrappedFetch("https://primary.example/rpc", {
        method: "POST",
      });

      assert.equal(called, true);
      assert.equal(response.ok, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
