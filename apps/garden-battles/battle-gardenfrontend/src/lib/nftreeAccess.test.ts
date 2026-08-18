import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findDirectWalletNftByTypeFilter,
  readAllowedNftTypesFromStorage,
  scanWalletAndKiosksForNft,
} from "./nftreeAccess";

const NFTREE_TYPE = "0xabc::collection::NFT";
const OTHER_TYPE = "0xdef::other::Thing";

function ownedObject(objectId: string, type: string, imageUrl = "") {
  return {
    data: {
      objectId,
      type,
      display: { data: { image_url: imageUrl } },
      content: { fields: {} },
    },
  };
}

describe("NFTree access scanning", () => {
  it("finds a direct wallet NFTree with a StructType lookup before broad pagination", async () => {
    const calls: any[] = [];
    const client = {
      async getOwnedObjects(args: any) {
        calls.push(args);
        if (args.filter?.StructType === NFTREE_TYPE) {
          return {
            data: [ownedObject("0xnft", NFTREE_TYPE, "ipfs://nft")],
            hasNextPage: false,
          };
        }
        throw new Error("broad scan should not run");
      },
      async getDynamicFields() {
        return { data: [] };
      },
      async getObject() {
        return { data: null };
      },
    };

    const nft = await findDirectWalletNftByTypeFilter(client, "0xowner", [
      NFTREE_TYPE,
    ]);

    assert.equal(nft?.nftId, "0xnft");
    assert.equal(nft?.location, "wallet");
    assert.equal(nft?.imageUrl, "ipfs://nft");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].filter, { StructType: NFTREE_TYPE });
  });

  it("falls back to broad pagination when the direct type lookup finds no NFTree", async () => {
    const broadPages = [
      {
        data: [ownedObject("0xother", OTHER_TYPE)],
        hasNextPage: true,
        nextCursor: "page-2",
      },
      {
        data: [ownedObject("0xnft", NFTREE_TYPE)],
        hasNextPage: false,
        nextCursor: null,
      },
    ];
    const client = {
      async getOwnedObjects(args: any) {
        if (args.filter?.StructType) {
          return { data: [], hasNextPage: false };
        }
        return broadPages.shift();
      },
      async getDynamicFields() {
        return { data: [] };
      },
      async getObject() {
        return { data: null };
      },
    };

    const direct = await findDirectWalletNftByTypeFilter(client, "0xowner", [
      NFTREE_TYPE,
    ]);
    const fallback = await scanWalletAndKiosksForNft(client, "0xowner", [
      NFTREE_TYPE,
    ]);

    assert.equal(direct, null);
    assert.equal(fallback?.nftId, "0xnft");
  });

  it("ignores malformed local collection cache instead of failing the scan setup", () => {
    const storage = {
      getItem() {
        return "{not-json";
      },
    } as Storage;

    assert.deepEqual(readAllowedNftTypesFromStorage(storage, NFTREE_TYPE), [
      NFTREE_TYPE,
    ]);
  });
});
