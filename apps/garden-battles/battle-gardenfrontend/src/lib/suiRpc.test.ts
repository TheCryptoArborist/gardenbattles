import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSuiBalanceGraphQLBody,
  buildSuiDynamicFieldsGraphQLBody,
  buildSuiObjectGraphQLBody,
  buildSuiOwnedObjectsGraphQLBody,
  buildSuiTransactionGraphQLBody,
  classifySuiRpcReadError,
  readSuiBalanceWithRetry,
  readSuiDynamicFieldsWithRetry,
  readSuiObjectWithRetry,
  readSuiOwnedObjectsWithRetry,
  readSuiTransactionBlockWithRetry,
  resolveFetchImplementation,
  SuiRpcReadError,
} from "./suiRpc";

const quickQueue =
  "0xb380a69e611ad7636f2b7993fab6656c272c0802fd7a6ec35448a58956a0c38f";
const standardQueue =
  "0x03e77c44e4ef2a6203a0d84378a4a8faf3acfb82ddfef84cd5e0bb243ff5abe1";
const wallet =
  "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  } as Response;
}

function objectResult(
  id = quickQueue,
  fields: Record<string, unknown> = {
    waiting: {
      player: wallet,
      entry_fee_snapshot: "3000000000",
    },
    bank: "3000000000",
    target_growth: "50",
  },
) {
  return {
    data: {
      object: {
        address: id,
        digest: "objectDigest",
        version: 968278043,
        previousTransaction: { digest: "previousDigest" },
        owner: { __typename: "Shared", initialSharedVersion: 123 },
        asMoveObject: {
          contents: {
            type: { repr: "0xpackage::matchmaking::MatchmakingQueueV3" },
            json: { id, ...fields },
          },
        },
      },
    },
  };
}

function balanceResult(totalBalance = "4200000000") {
  return {
    data: {
      address: {
        balance: {
          coinType: { repr: "0x2::sui::SUI" },
          totalBalance,
        },
      },
    },
  };
}

function transactionResult(status: "SUCCESS" | "FAILURE" = "SUCCESS") {
  return {
    data: {
      transaction: {
        digest: "9digest",
        effects: {
          status,
          executionError:
            status === "FAILURE" ? { message: "MoveAbort code 104" } : null,
          events: {
            nodes: [
              {
                sequenceNumber: 0,
                contents: {
                  type: { repr: "0xpackage::battle::BattleUpdated" },
                  json: { battle_id: "0xbattle" },
                },
              },
            ],
          },
          objectChanges: {
            nodes: [
              {
                address: "0xbattle",
                idCreated: true,
                idDeleted: false,
                inputState: null,
                outputState: {
                  asMoveObject: {
                    contents: { type: { repr: "0xpackage::battle::Battle" } },
                  },
                },
              },
            ],
          },
        },
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

describe("Sui GraphQL read migration", () => {
  it("builds supported queries without retired JSON-RPC methods", () => {
    const objectBody = buildSuiObjectGraphQLBody({ id: quickQueue });
    const balanceBody = buildSuiBalanceGraphQLBody(wallet);
    const transactionBody = buildSuiTransactionGraphQLBody("9digest");

    assert.equal(objectBody.variables.id, quickQueue);
    assert.equal(balanceBody.variables.owner, wallet);
    assert.equal(balanceBody.variables.coinType, "0x2::sui::SUI");
    assert.equal(transactionBody.variables.digest, "9digest");
    assert.match(objectBody.query, /object\(address: \$id\)/);
    assert.match(balanceBody.query, /balance\(coinType: \$coinType\)/);
    assert.match(transactionBody.query, /transaction\(digest: \$digest\)/);
    assert.doesNotMatch(JSON.stringify(objectBody), /sui_getObject/);
    assert.doesNotMatch(JSON.stringify(balanceBody), /suix_getBalance/);
    assert.doesNotMatch(JSON.stringify(transactionBody), /sui_getTransactionBlock/);
  });

  it("maps Move JSON into the legacy object shape used by queue parsing", async () => {
    const endpoint = "https://graphql.example/graphql";
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, objectResult()),
    ]);
    const result = await readSuiObjectWithRetry(
      null,
      { id: quickQueue, options: { showContent: true } },
      { operation: "queue-read", endpoints: [endpoint], fetchImpl, retryDelaysMs: [] },
    );

    assert.equal(result.data?.objectId, quickQueue);
    assert.equal(result.data?.previousTransaction, "previousDigest");
    assert.equal((result.data?.content as any)?.fields?.bank, "3000000000");
    assert.equal((result.data?.owner as any)?.Shared?.initial_shared_version, "123");
    assert.equal(calls[0].url, endpoint);
    assert.equal(JSON.parse(String(calls[0].init.body)).variables.id, quickQueue);
  });

  it("defaults reads to the official Sui mainnet GraphQL endpoint", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, objectResult()),
    ]);
    await readSuiObjectWithRetry(null, { id: quickQueue }, {
      operation: "default-read",
      fetchImpl,
      retryDelaysMs: [],
    });
    assert.equal(calls[0].url, "https://graphql.mainnet.sui.io/graphql");
  });

  it("maps GraphQL balances into the existing balance response", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, balanceResult("5000000000")),
    ]);
    const result = await readSuiBalanceWithRetry(wallet, {
      operation: "balance-read",
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });
    assert.equal(result.totalBalance, "5000000000");
    assert.equal(JSON.parse(String(calls[0].init.body)).variables.owner, wallet);
  });

  it("maps filtered owned NFTrees and display metadata", async () => {
    const nftType = "0xcollection::collection::NFT";
    const nftId = "0xnft";
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(200, {
        data: {
          address: {
            objects: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  address: nftId,
                  digest: "nftDigest",
                  version: 12,
                  previousTransaction: { digest: "mintDigest" },
                  owner: {
                    __typename: "AddressOwner",
                    address: { address: wallet },
                  },
                  contents: {
                    type: { repr: nftType },
                    json: { id: nftId, image_url: "ipfs://fallback" },
                    display: {
                      output: { image_url: "https://images.example/nft.png" },
                      errors: null,
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    ]);

    const result = await readSuiOwnedObjectsWithRetry(wallet, {
      operation: "owned-nftrees",
      structType: nftType,
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });

    assert.equal(result.data[0].data.objectId, nftId);
    assert.equal(result.data[0].data.type, nftType);
    assert.equal(
      result.data[0].data.display.data.image_url,
      "https://images.example/nft.png",
    );
    assert.deepEqual(
      JSON.parse(String(calls[0].init.body)).variables.filter,
      { type: nftType },
    );
    assert.match(buildSuiOwnedObjectsGraphQLBody(wallet).query, /objects/);
  });

  it("maps kiosk dynamic-field names into the legacy scan shape", async () => {
    const kioskId = "0xkiosk";
    const nftId = "0xkioskNft";
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(200, {
        data: {
          address: {
            dynamicFields: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  address: "0xfield",
                  name: {
                    type: { repr: "0x2::kiosk::Item" },
                    json: { id: nftId },
                  },
                  value: {
                    __typename: "MoveObject",
                    address: nftId,
                    contents: { type: { repr: "0xcollection::collection::NFT" } },
                  },
                },
              ],
            },
          },
        },
      }),
    ]);

    const result = await readSuiDynamicFieldsWithRetry(kioskId, {
      operation: "kiosk-fields",
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });

    assert.equal(result.data[0].name.type, "0x2::kiosk::Item");
    assert.equal(result.data[0].name.value.id, nftId);
    assert.match(
      buildSuiDynamicFieldsGraphQLBody(kioskId).query,
      /dynamicFields/,
    );
  });

  it("maps effects, events, and object changes for post-digest recovery", async () => {
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(200, transactionResult()),
    ]);
    const result = await readSuiTransactionBlockWithRetry("9digest", {
      operation: "transaction-read",
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });
    assert.equal(result.effects.status.status, "success");
    assert.equal(result.events[0].type, "0xpackage::battle::BattleUpdated");
    assert.equal(result.events[0].parsedJson.battle_id, "0xbattle");
    assert.deepEqual(result.objectChanges[0], {
      type: "created",
      objectId: "0xbattle",
      objectType: "0xpackage::battle::Battle",
    });
  });

  it("preserves explicit transaction failure", async () => {
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(200, transactionResult("FAILURE")),
    ]);
    const result = await readSuiTransactionBlockWithRetry("9digest", {
      operation: "transaction-read",
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });
    assert.equal(result.effects.status.status, "failure");
    assert.equal(result.effects.status.error, "MoveAbort code 104");
  });

  it("retries after a 429 and succeeds", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(429, {}),
      jsonResponse(200, objectResult()),
    ]);
    const result = await readSuiObjectWithRetry(null, { id: quickQueue }, {
      operation: "retry-read",
      endpoints: ["https://graphql.example/graphql"],
      fetchImpl,
      retryDelaysMs: [0],
    });
    assert.equal(result.data?.objectId, quickQueue);
    assert.equal(calls.length, 2);
  });

  it("uses the next GraphQL endpoint after a transport failure", async () => {
    const { calls, fetchImpl } = fetchFromResponses([
      jsonResponse(503, {}),
      jsonResponse(200, objectResult(standardQueue, {
        waiting: null,
        bank: "0",
        target_growth: "75",
      })),
    ]);
    const result = await readSuiObjectWithRetry(null, { id: standardQueue }, {
      operation: "fallback-read",
      endpoints: ["https://primary.example/graphql", "https://fallback.example/graphql"],
      fetchImpl,
      retryDelaysMs: [],
    });
    assert.equal(result.data?.objectId, standardQueue);
    assert.equal(calls[1].url, "https://fallback.example/graphql");
  });

  it("throws a typed error when every endpoint fails", async () => {
    const { fetchImpl } = fetchFromResponses([
      jsonResponse(503, {}),
      jsonResponse(503, {}),
    ]);
    await assert.rejects(
      () => readSuiObjectWithRetry(null, { id: quickQueue }, {
        operation: "failed-read",
        endpoints: ["https://primary.example/graphql", "https://fallback.example/graphql"],
        fetchImpl,
        retryDelaysMs: [],
      }),
      (error) => error instanceof SuiRpcReadError && error.kind === "rate_limited",
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
        if (this !== expectedReceiver) throw new TypeError("Illegal invocation");
        return Promise.resolve(jsonResponse(200, objectResult()));
      } as typeof fetch;
      const wrappedFetch = resolveFetchImplementation();
      const response = await wrappedFetch("https://graphql.example/graphql", { method: "POST" });
      assert.equal(called, true);
      assert.equal(response.ok, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
