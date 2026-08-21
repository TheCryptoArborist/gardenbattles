import assert from "node:assert/strict";
import { describe, it } from "node:test";

import handler from "./nftree-sale-pools.mjs";

const MINT_CONFIG_ID =
  "0xe83616020f61f73b30c40fd3f888ed397626afd071bd4666374c306d8e98b06b";

const POOL_FIXTURES = {
  "0x8cb91464eec7ada1af801a439207647d78de66bc0d4f124d6437091745a0163a": [
    { number: "8", rarity: "Legendary" },
    { number: "12", rarity: "Epic" },
  ],
  "0xedd6b2d96968197bc121ad7bed064a43b5ad7d84cbb8b7c00d8fd78bea3e2e4d": [
    { number: "1268", rarity: "Rare" },
  ],
  "0xed43f2ffb52ef542ea2cfccd0358431923460fec8ef659febda111614e20457a": [],
};

describe("NFTree sale-pools function", () => {
  it("reads mint configuration and pools through Sui GraphQL", async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];

    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      const objectId = body.variables.id;
      const fields =
        objectId === MINT_CONFIG_ID
          ? {
              admin: "0xadmin",
              mint_price_mist: "25000000000",
              treasury: "0xtreasury",
            }
          : { nfts: POOL_FIXTURES[objectId] };

      return Response.json({
        data: {
          object: {
            address: objectId,
            version: 42,
            asMoveObject: {
              contents: {
                type: { repr: "0xpackage::collection::Object" },
                json: fields,
              },
            },
          },
        },
      });
    };

    try {
      const response = await handler(
        new Request("https://nftree.net/api/nftree-sale-pools"),
      );
      const payload = await response.json();

      assert.equal(response.status, 200);
      assert.equal(payload.source, "sui-graphql");
      assert.equal(payload.mintPriceMist, "25000000000");
      assert.equal(payload.treasury, "0xtreasury");
      assert.equal(payload.totalAvailable, 3);
      assert.equal(payload.activePoolId, payload.pools[0].poolId);
      assert.deepEqual(payload.pools[0].rarityBreakdown, {
        Legendary: 1,
        Epic: 1,
      });
      assert.equal(requests.length, 4);
      assert.ok(
        requests.every((request) => request.query.includes("query SuiObject")),
      );
      assert.ok(requests.every((request) => request.variables.id));
      assert.ok(requests.every((request) => !("method" in request)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
