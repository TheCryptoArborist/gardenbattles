import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import {
  createNftreeAccessHandler,
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

async function withNftreeAccessEndpoint(
  client: any,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.get(
    "/api/nftree-access/:address",
    createNftreeAccessHandler({
      client,
      nftreeStructType: "0xabc::collection::NFT",
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

test("Sui RPC proxy forwards upstream JSON-RPC errors while logging safe metadata", async () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  const fetchImpl: typeof fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32000, message: "backend read failed" },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };

  try {
    await withProxyEndpoint(fetchImpl, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/sui-rpc`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 11,
          method: "suix_getOwnedObjects",
          params: ["0xowner"],
        }),
      });

      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.error.message, "backend read failed");
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "[sui-rpc-proxy] upstream json-rpc error");
  assert.deepEqual(warnings[0][1], {
    methods: ["suix_getOwnedObjects"],
    status: 200,
    errors: [{ id: 11, code: -32000, message: "backend read failed" }],
  });
  assert.equal(JSON.stringify(warnings).includes("0xowner"), false);
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

test("NFTree access endpoint returns a direct wallet NFTree", async () => {
  let capturedArgs: any = null;
  const client = {
    async getOwnedObjects(args: any) {
      capturedArgs = args;
      return {
        data: [
          {
            data: {
              objectId: "0xnft",
              type: "0xabc::collection::NFT",
              display: { data: { image_url: "ipfs://nft" } },
              content: { fields: {} },
            },
          },
        ],
      };
    },
  };

  await withNftreeAccessEndpoint(client, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/nftree-access/0x00000000000000000000000000000000000000000000000000000000000000ab`,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.nft.nftId, "0xnft");
    assert.equal(body.nft.location, "wallet");
    assert.equal(body.nft.imageUrl, "ipfs://nft");
    assert.deepEqual(capturedArgs.filter, { StructType: "0xabc::collection::NFT" });
  });
});

test("NFTree access endpoint returns null only after a successful empty lookup", async () => {
  const client = {
    async getOwnedObjects() {
      return { data: [] };
    },
  };

  await withNftreeAccessEndpoint(client, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/nftree-access/0x00000000000000000000000000000000000000000000000000000000000000ab`,
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.nft, null);
  });
});

test("NFTree access endpoint reports RPC failure without converting it to no NFTree", async () => {
  const client = {
    async getOwnedObjects() {
      throw new Error("rpc unavailable");
    },
  };

  await withNftreeAccessEndpoint(client, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/nftree-access/0x00000000000000000000000000000000000000000000000000000000000000ab`,
    );
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error, "nftree_access_unavailable");
  });
});
