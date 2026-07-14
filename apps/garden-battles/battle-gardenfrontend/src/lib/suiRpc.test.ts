import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSuiGetObjectJsonRpcBody,
  classifySuiRpcReadError,
  readSuiObjectWithRetry,
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
  const fetchFn = async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const response = responses.shift();
    if (!response) throw new Error("No test response configured");
    return response;
  };
  return { calls, fetchFn: fetchFn as typeof fetch };
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

  it("posts to the endpoint URL unchanged without appending the object ID", async () => {
    const endpoint = "https://example.quicknode.pro/token/path/";
    const { calls, fetchFn } = fetchFromResponses([
      jsonResponse(200, objectResult(quickQueue)),
    ]);

    await readSuiObjectWithRetry(
      null,
      { id: quickQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: [endpoint],
        fetchFn,
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

  it("returns the primary RPC object response when primary succeeds", async () => {
    const { fetchFn } = fetchFromResponses([
      jsonResponse(200, objectResult(legacyQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: legacyQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc"],
        fetchFn,
        retryDelaysMs: [],
      },
    );

    assert.equal(result.data?.objectId, legacyQueue);
  });

  it("retries primary after a 429 and succeeds", async () => {
    const { calls, fetchFn } = fetchFromResponses([
      jsonResponse(429, { error: { code: 429, message: "Too Many Requests" } }),
      jsonResponse(200, objectResult(quickQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: quickQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc"],
        fetchFn,
        retryDelaysMs: [0],
      },
    );

    assert.equal(result.data?.objectId, quickQueue);
    assert.equal(calls.length, 2);
  });

  it("uses fallback when primary returns 404", async () => {
    const { calls, fetchFn } = fetchFromResponses([
      jsonResponse(404, { error: { code: -32000, message: "not found" } }),
      jsonResponse(200, objectResult(standardQueue)),
    ]);

    const result = await readSuiObjectWithRetry(
      null,
      { id: standardQueue, options: { showContent: true } },
      {
        operation: "test-read",
        endpoints: ["https://primary.example/rpc", "https://fallback.example/rpc"],
        fetchFn,
        retryDelaysMs: [],
      },
    );

    assert.equal(result.data?.objectId, standardQueue);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, "https://primary.example/rpc");
    assert.equal(calls[1].url, "https://fallback.example/rpc");
  });

  it("throws an RPC unavailable error when all endpoints fail", async () => {
    const { fetchFn } = fetchFromResponses([
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
            fetchFn,
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
});
