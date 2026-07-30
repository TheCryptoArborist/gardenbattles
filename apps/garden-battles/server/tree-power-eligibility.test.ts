import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  clearTreePowerEligibilityCache,
  getCachedFifthMoveEligibility,
} from "./tree-power-eligibility";

const wallet = "0x1111111111111111111111111111111111111111111111111111111111111111";
const treeCoinType =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

function makePoolObject() {
  return {
    data: {
      objectId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
      type: `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::Pair<0x2::sui::SUI, ${treeCoinType}>`,
      content: {
        dataType: "moveObject",
        fields: {
          reserve1: "1000000000000",
          total_supply: "1000000000000",
        },
      },
    },
  };
}

function makeV3PoolObject() {
  return {
    data: {
      objectId: "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf",
      type: `0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::pool::Pool<0x2::sui::SUI, ${treeCoinType}>`,
      content: {
        dataType: "moveObject",
        fields: {
          sqrt_price: "109707448322793383515",
          type_y: {
            fields: {
              name: treeCoinType.replace(/^0x/, ""),
            },
          },
        },
      },
    },
  };
}

function makeV3PositionObject(options: {
  objectId?: string;
  owner?: string;
  poolId?: string;
  liquidity?: string;
  lower?: number;
  upper?: number;
  typeY?: string;
  closed?: boolean;
}) {
  return {
    data: {
      objectId: options.objectId ?? "0xe68e034a6f2390eaa9caf2dce42b75e48ab6c408a64a722a2f92f8b3a92f31c3",
      type: "0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position",
      owner: { AddressOwner: options.owner ?? wallet },
      content: {
        dataType: "moveObject",
        fields: {
          pool_id: options.poolId ?? "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf",
          liquidity: options.liquidity ?? "164081076071423",
          tick_lower_index: { fields: { bits: options.lower ?? 33900 } },
          tick_upper_index: { fields: { bits: options.upper ?? 37620 } },
          type_y: { fields: { name: (options.typeY ?? treeCoinType).replace(/^0x/, "") } },
          ...(options.closed === undefined ? {} : { closed: options.closed }),
        },
      },
    },
  };
}

function makeClient(options: { lpBalance?: string; failV2?: boolean; v3Positions?: any[] } = {}) {
  let coinMetadataCalls = 0;
  return {
    get callCount() {
      return coinMetadataCalls;
    },
    async getCoinMetadata() {
      coinMetadataCalls += 1;
      return { symbol: "Tree", decimals: 6 };
    },
    async getObject({ id }: { id: string }) {
      if (id === CANONICAL_TREE_SUIDEX_V2_POOL_ID) {
        if (options.failV2) throw new Error("v2_unavailable");
        return makePoolObject();
      }
      return makeV3PoolObject();
    },
    async getCoins({ coinType }: { coinType: string }) {
      assert.equal(coinType, CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE);
      return {
        data:
          options.lpBalance && options.lpBalance !== "0"
            ? [
                {
                  coinObjectId: "0x2222222222222222222222222222222222222222222222222222222222222222",
                  balance: options.lpBalance,
                },
              ]
            : [],
        hasNextPage: false,
        nextCursor: null,
      };
    },
    async getOwnedObjects({ cursor }: { cursor?: string | null }) {
      if (cursor) {
        return { data: [], hasNextPage: false, nextCursor: null };
      }
      return {
        data: options.v3Positions ?? [],
        hasNextPage: false,
        nextCursor: null,
      };
    },
  };
}

test("read-only eligibility returns serialized bigint threshold strings", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ lpBalance: "1000000000000" }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "qualified");
  assert.equal(response.thresholdRaw, "1000000000000");
  assert.equal(response.verifiedUnderlyingTreeRaw, "1000000000000");
  assert.equal(response.sources[0].source, "suidex-v2");
  assert.equal(response.sources[0].status, "qualified-data");
});

test("invalid Sui address is rejected before RPC reads", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient() as any;
  await assert.rejects(() => getCachedFifthMoveEligibility(client, "not-an-address"), /invalid_sui_address/);
});

test("cache reuses a wallet response for approximately 60 seconds", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ lpBalance: "1000000000000" });

  await getCachedFifthMoveEligibility(client as any, wallet);
  await getCachedFifthMoveEligibility(client as any, wallet);

  assert.equal(client.callCount, 1);
});

test("provider failures remain unavailable and do not become verified zero", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ failV2: true }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "verification-incomplete");
  assert.equal(response.sources[0].status, "unavailable");
  assert.equal(response.sources[0].reason, "v2_unavailable");
  assert.equal(response.sources[1].status, "verified-zero");
});

test("zero direct V2 LP remains incomplete while farm representation is unverified", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ lpBalance: "0" }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "verification-incomplete");
  assert.equal(response.sources[0].source, "suidex-v2");
  assert.equal(response.sources[0].status, "unavailable");
  assert.equal(response.sources[0].underlyingTreeRaw, "0");
  assert.equal(response.sources[0].reason, "direct_lp_zero_and_v2_farm_representation_unverified");
  assert.equal(response.sources[1].reason, "v3_pool_and_owned_positions_verified_principal_only");
  assert.equal(response.sources[1].underlyingTreeRaw, "0");
  assert.equal(response.sources[2].reason, "moonbags_tree_staking_pool_and_position_shape_not_yet_verified");
});

test("verified V3 principal can qualify while V2 farm and Moonbags remain unavailable", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({
    lpBalance: "0",
    v3Positions: [makeV3PositionObject({})],
  }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "qualified");
  assert.equal(response.sources[1].source, "suidex-v3");
  assert.equal(response.sources[1].status, "qualified-data");
  assert.equal(response.sources[1].underlyingTreeRaw, "82215822268196");
  assert.deepEqual(response.sources[1].evidence?.objectIds, [
    "0xe68e034a6f2390eaa9caf2dce42b75e48ab6c408a64a722a2f92f8b3a92f31c3",
  ]);
});

test("V3 provider excludes unrelated, closed, wrong-owner, and zero-liquidity positions", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({
    lpBalance: "0",
    v3Positions: [
      makeV3PositionObject({ objectId: "0xother-pool", poolId: "0xother" }),
      makeV3PositionObject({ objectId: "0xclosed", closed: true }),
      makeV3PositionObject({ objectId: "0xwrong-owner", owner: "0x2222222222222222222222222222222222222222222222222222222222222222" }),
      makeV3PositionObject({ objectId: "0xzero", liquidity: "0" }),
    ],
  }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "verification-incomplete");
  assert.equal(response.sources[1].status, "verified-zero");
  assert.equal(response.sources[1].underlyingTreeRaw, "0");
  assert.equal(response.sources[1].evidence?.positionCount, 0);
});
