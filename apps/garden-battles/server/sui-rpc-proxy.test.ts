import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import {
  createSuiRpcProxyHandler,
  isAllowedSuiRpcProxyMethod,
} from "./routes";

async function withProxyEndpoint(
  fetchImpl: typeof fetch,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  app.post(
    "/api/sui-rpc",
    createSuiRpcProxyHandler({
      upstreamUrl: "https://secret-rpc.example/jsonrpc?api_key=do-not-leak",
      fetchImpl,
      timeoutMs: 1_000,
    }),
  );
  const server: Server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("Sui RPC proxy allowlist permits read/query methods and blocks write-like methods", () => {
  assert.equal(isAllowedSuiRpcProxyMethod("sui_getObject"), true);
  assert.equal(isAllowedSuiRpcProxyMethod("sui_multiGetObjects"), true);
  assert.equal(isAllowedSuiRpcProxyMethod("suix_getOwnedObjects"), true);
  assert.equal(isAllowedSuiRpcProxyMethod("suix_queryEvents"), true);
  assert.equal(isAllowedSuiRpcProxyMethod("rpc.discover"), true);
  assert.equal(isAllowedSuiRpcProxyMethod("sui_executeTransactionBlock"), false);
  assert.equal(isAllowedSuiRpcProxyMethod("sui_dryRunTransactionBlock"), false);
  assert.equal(isAllowedSuiRpcProxyMethod("sui_devInspectTransactionBlock"), false);
  assert.equal(isAllowedSuiRpcProxyMethod("unsafe_transferObject"), false);
});

test("Sui RPC proxy forwards an allowed read request without exposing the upstream URL", async () => {
  let capturedUrl = "";
  let capturedBody: any = null;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: capturedBody.id, result: { data: [] } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  await withProxyEndpoint(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sui-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "suix_getOwnedObjects",
        params: ["0xabc"],
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.result, { data: [] });
    assert.equal(capturedUrl, "https://secret-rpc.example/jsonrpc?api_key=do-not-leak");
    assert.equal(capturedBody.method, "suix_getOwnedObjects");
    assert.equal(JSON.stringify(body).includes("do-not-leak"), false);
  });
});

test("Sui RPC proxy forwards Sui client metadata discovery", async () => {
  let capturedBody: any = null;
  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: capturedBody.id,
        result: { methods: [] },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  await withProxyEndpoint(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sui-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "rpc.discover",
        params: [],
      }),
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.result, { methods: [] });
    assert.equal(capturedBody.method, "rpc.discover");
  });
});

test("Sui RPC proxy blocks transaction execution methods", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("fetch should not be called for blocked methods");
  };

  await withProxyEndpoint(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sui-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "sui_executeTransactionBlock",
        params: [],
      }),
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.id, 7);
    assert.equal(body.error.message, "Sui JSON-RPC method is not allowed by this proxy.");
  });
});

test("Sui RPC proxy reports upstream failure without leaking credentials", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("upstream unavailable");
  };

  await withProxyEndpoint(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/sui-rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "sui_getObject",
        params: ["0x123"],
      }),
    });

    assert.equal(response.status, 503);
    const text = await response.text();
    assert.match(text, /Sui RPC proxy upstream unavailable/);
    assert.equal(text.includes("secret-rpc.example"), false);
    assert.equal(text.includes("do-not-leak"), false);
  });
});
