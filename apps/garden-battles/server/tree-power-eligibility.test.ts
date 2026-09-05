import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  GARDEN_BATTLES_TREE_LOCK_TYPE,
  MOONBAGS_TREE_STAKING_ACCOUNT_TYPE,
  MOONBAGS_TREE_STAKING_POOL_ID,
  MOONBAGS_TREE_STAKING_POOL_TYPE,
  clearTreePowerEligibilityCache,
  createGraphqlTreePowerClient,
  getCachedFifthMoveEligibility,
  refreshFifthMoveEligibility,
} from "./tree-power-eligibility";

const wallet = "0x1111111111111111111111111111111111111111111111111111111111111111";
const treeCoinType =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";
const originalFetch = globalThis.fetch;
const v2FarmPositionType =
  "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::farm::StakingPosition<0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI, 0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>>";
const v2VaultType =
  "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::farm::StakedTokenVault<0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0x2::sui::SUI,0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>>";
const v2PoolType =
  "bfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::LPCoin<0000000000000000000000000000000000000000000000000000000000000002::sui::SUI,6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE>";

after(() => {
  globalThis.fetch = originalFetch;
});

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

function makeTreeLockObject(options: { amount?: string; owner?: string; unlockAt?: string; type?: string } = {}) {
  const owner = options.owner ?? wallet;
  return { data: {
    objectId: "0x9999999999999999999999999999999999999999999999999999999999999999",
    type: options.type ?? GARDEN_BATTLES_TREE_LOCK_TYPE,
    owner: { AddressOwner: owner },
    content: { dataType: "moveObject", type: options.type ?? GARDEN_BATTLES_TREE_LOCK_TYPE, fields: {
      owner,
      funds: options.amount ?? "1000000000000",
      locked_at_ms: "1000",
      unlock_at_ms: options.unlockAt ?? "2592001000",
    } },
  } };
}

function makeMoonbagsPoolObject(options: { type?: string; stakingTokenType?: string } = {}) {
  return {
    data: {
      objectId: MOONBAGS_TREE_STAKING_POOL_ID,
      type: options.type ?? MOONBAGS_TREE_STAKING_POOL_TYPE,
      content: {
        dataType: "moveObject",
        fields: {
          staking_token: {
            type: options.stakingTokenType ?? `0x2::coin::Coin<${treeCoinType}>`,
            fields: {
              balance: "33746700996112",
            },
          },
          sui_token: {
            type: "0x2::coin::Coin<0x2::sui::SUI>",
            fields: {
              balance: "22391427109",
            },
          },
          total_supply: "33746700996112",
          reward_index: "8628653355448",
        },
      },
    },
  };
}

function makeMoonbagsAccountObject(options: {
  objectId?: string;
  type?: string;
  staker?: string;
  balance?: string;
  earned?: string;
} = {}) {
  return {
    data: {
      objectId: options.objectId ?? "0x5555555555555555555555555555555555555555555555555555555555555555",
      type: options.type ?? MOONBAGS_TREE_STAKING_ACCOUNT_TYPE,
      content: {
        dataType: "moveObject",
        fields: {
          staker: options.staker ?? wallet,
          balance: options.balance ?? "0",
          earned: options.earned ?? "999999999999",
          reward_index: "3939342406848",
          unstake_deadline: "1753943181715",
        },
      },
    },
  };
}

function makeV2FarmGraphqlPosition(options: {
  objectId?: string;
  vaultId?: string;
  owner?: string;
  amount?: string;
  poolType?: string;
  vaultAmount?: string;
  vaultOwner?: string;
}) {
  const objectId = options.objectId ?? "0x3333333333333333333333333333333333333333333333333333333333333333";
  const vaultId = options.vaultId ?? "0x4444444444444444444444444444444444444444444444444444444444444444";
  const amount = options.amount ?? "1000000000000";
  const poolType = options.poolType ?? v2PoolType;
  return {
    objectId,
    vaultId,
    node: {
      address: objectId,
      asMoveObject: {
        contents: {
          type: { repr: v2FarmPositionType },
          json: {
            id: objectId,
            owner: options.owner ?? wallet,
            pool_type: poolType,
            amount,
            vault_id: vaultId,
          },
        },
      },
    },
    vault: {
      asMoveObject: {
        contents: {
          type: { repr: v2VaultType },
          json: {
            id: vaultId,
            owner: options.vaultOwner ?? options.owner ?? wallet,
            pool_type: poolType,
            amount: options.vaultAmount ?? amount,
            balance: options.vaultAmount ?? amount,
          },
        },
      },
    },
  };
}

function installGraphqlMock(v2FarmPositions: ReturnType<typeof makeV2FarmGraphqlPosition>[] = []) {
  globalThis.fetch = async (_input: any, init?: any) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const variables = body.variables ?? {};
    if (body.query.includes("objects(first: 50")) {
      return new Response(JSON.stringify({
        data: {
          objects: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: v2FarmPositions.map((position) => position.node),
          },
        },
      }));
    }
    if (body.query.includes("object(address: $id)")) {
      const position = v2FarmPositions.find((candidate) => candidate.vaultId === variables.id);
      return new Response(JSON.stringify({ data: { object: position?.vault ?? null } }));
    }
    return new Response(JSON.stringify({ data: {} }));
  };
}

function makeClient(options: {
  lpBalance?: string;
  failV2?: boolean;
  v3Positions?: any[];
  v2FarmPositions?: ReturnType<typeof makeV2FarmGraphqlPosition>[];
  moonbagsAccount?: any | null;
  moonbagsPool?: any;
  failMoonbags?: boolean;
  treeLocks?: any[];
} = {}) {
  installGraphqlMock(options.v2FarmPositions ?? []);
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
      if (id === MOONBAGS_TREE_STAKING_POOL_ID) {
        if (options.failMoonbags) throw new Error("moonbags_unavailable");
        return options.moonbagsPool ?? makeMoonbagsPoolObject();
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
    async getOwnedObjects({ cursor, filter }: { cursor?: string | null; filter?: { StructType?: string } }) {
      if (cursor) {
        return { data: [], hasNextPage: false, nextCursor: null };
      }
      return {
        data: filter?.StructType === GARDEN_BATTLES_TREE_LOCK_TYPE ? (options.treeLocks ?? []) : (options.v3Positions ?? []),
        hasNextPage: false,
        nextCursor: null,
      };
    },
    async getDynamicFieldObject({ parentId, name }: { parentId: string; name: { type: string; value: string } }) {
      assert.equal(parentId, MOONBAGS_TREE_STAKING_POOL_ID);
      assert.equal(name.type, "address");
      assert.equal(name.value, wallet);
      if (options.moonbagsAccount === null || options.moonbagsAccount === undefined) {
        return {};
      }
      return options.moonbagsAccount;
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

test("fresh eligibility bypasses a cached pre-lock result and updates the cache", async () => {
  clearTreePowerEligibilityCache();
  const options: { lpBalance: string; treeLocks: any[] } = { lpBalance: "0", treeLocks: [] };
  const client = makeClient(options) as any;

  const beforeLock = await getCachedFifthMoveEligibility(client, wallet);
  assert.equal(beforeLock.status, "not-qualified");

  options.treeLocks.push(makeTreeLockObject());
  const staleAfterLock = await getCachedFifthMoveEligibility(client, wallet);
  assert.equal(staleAfterLock.status, "not-qualified");

  const freshAfterLock = await refreshFifthMoveEligibility(client, wallet);
  assert.equal(freshAfterLock.status, "qualified");
  assert.equal(freshAfterLock.sources[2].source, "tree-lock");
  assert.equal(freshAfterLock.sources[2].underlyingTreeRaw, "1000000000000");

  const updatedCache = await getCachedFifthMoveEligibility(client, wallet);
  assert.equal(updatedCache.status, "qualified");
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

test("zero supported positions remain not qualified after Moonbags removal", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ lpBalance: "0", failMoonbags: true }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "not-qualified");
  assert.equal(response.sources[0].source, "suidex-v2");
  assert.equal(response.sources[0].status, "verified-zero");
  assert.equal(response.sources[0].underlyingTreeRaw, "0");
  assert.equal(response.sources[0].reason, "direct_wallet_lp_and_verified_farmed_lp_zero");
  assert.equal(response.sources[1].reason, "v3_pool_and_owned_positions_verified_principal_only");
  assert.equal(response.sources[1].underlyingTreeRaw, "0");
  assert.equal(response.sources[2].reason, "garden_battles_tree_lock_not_found");
});

test("verified V2 farmed LP principal can qualify through the V2 source", async () => {
  clearTreePowerEligibilityCache();
  const farmPosition = makeV2FarmGraphqlPosition({ amount: "1000000000000" });
  const client = makeClient({ lpBalance: "0", v2FarmPositions: [farmPosition] }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "qualified");
  assert.equal(response.sources[0].source, "suidex-v2");
  assert.equal(response.sources[0].status, "qualified-data");
  assert.equal(response.sources[0].underlyingTreeRaw, "1000000000000");
  assert.deepEqual(response.sources[0].evidence?.objectIds, [farmPosition.objectId, farmPosition.vaultId]);
  assert.equal(response.sources[0].reason, "direct_wallet_lp_and_verified_farmed_lp_principal");
});

test("V2 farmed LP excludes mismatched vault, owner, and pool type", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({
    lpBalance: "0",
    v2FarmPositions: [
      makeV2FarmGraphqlPosition({ objectId: "0xwrong-vault-amount", vaultAmount: "1" }),
      makeV2FarmGraphqlPosition({ objectId: "0xwrong-owner", owner: "0x2222222222222222222222222222222222222222222222222222222222222222" }),
      makeV2FarmGraphqlPosition({ objectId: "0xwrong-pool", poolType: "0xother::lp::LP" }),
    ],
  }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "not-qualified");
  assert.equal(response.sources[0].status, "verified-zero");
  assert.equal(response.sources[0].underlyingTreeRaw, "0");
});

test("verified V3 principal can qualify alongside an empty TREE Lock", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({
    lpBalance: "0",
    v3Positions: [makeV3PositionObject({})],
    failMoonbags: true,
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

test("a canonical 30-day TREE Lock qualifies and malformed locks do not count", async () => {
  clearTreePowerEligibilityCache();
  const qualified = await getCachedFifthMoveEligibility(makeClient({ treeLocks: [makeTreeLockObject()] }) as any, wallet);
  assert.equal(qualified.status, "qualified");
  assert.equal(qualified.sources[2].source, "tree-lock");
  assert.equal(qualified.sources[2].underlyingTreeRaw, "1000000000000");
  assert.equal(qualified.sources[2].reason, "garden_battles_tree_lock_principal_verified");

  clearTreePowerEligibilityCache();
  const malformed = await getCachedFifthMoveEligibility(makeClient({ treeLocks: [
    makeTreeLockObject({ owner: "0x2222222222222222222222222222222222222222222222222222222222222222" }),
    makeTreeLockObject({ unlockAt: "1001" }),
    makeTreeLockObject({ type: "0x2::bad::Lock" }),
  ] }) as any, wallet);
  assert.equal(malformed.status, "not-qualified");
  assert.equal(malformed.sources[2].status, "verified-zero");
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

  assert.equal(response.status, "not-qualified");
  assert.equal(response.sources[1].status, "verified-zero");
  assert.equal(response.sources[1].underlyingTreeRaw, "0");
  assert.equal(response.sources[1].evidence?.positionCount, 0);
});

test("production GraphQL adapter maps objects, coins, owned positions, and dynamic fields", async () => {
  const coinId = "0x2222222222222222222222222222222222222222222222222222222222222222";
  const positionId = "0x3333333333333333333333333333333333333333333333333333333333333333";
  const accountId = "0x4444444444444444444444444444444444444444444444444444444444444444";
  globalThis.fetch = async (_input: any, init?: any) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.query.includes("object(address: $id)")) {
      return new Response(JSON.stringify({
        data: {
          object: {
            address: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
            owner: { __typename: "Shared", initialSharedVersion: "1" },
            asMoveObject: {
              contents: {
                type: { repr: "0x2::test::Pool" },
                json: { reserve1: "100", total_supply: "10" },
              },
            },
          },
        },
      }));
    }
    if (body.query.includes("dynamicFields(first:")) {
      return new Response(JSON.stringify({
        data: {
          address: {
            dynamicFields: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{
                name: { type: { repr: "address" }, json: wallet },
                value: {
                  __typename: "MoveObject",
                  address: accountId,
                  contents: {
                    type: { repr: MOONBAGS_TREE_STAKING_ACCOUNT_TYPE },
                    json: { staker: wallet, balance: "123" },
                  },
                },
              }],
            },
          },
        },
      }));
    }
    const isCoinRead = String(body.variables?.filter?.type ?? "").includes("::coin::Coin<");
    return new Response(JSON.stringify({
      data: {
        address: {
          objects: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: isCoinRead
              ? [{
                  address: coinId,
                  owner: { __typename: "AddressOwner", address: { address: wallet } },
                  contents: {
                    type: { repr: `0x2::coin::Coin<${CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE}>` },
                    json: { balance: "456" },
                  },
                }]
              : [{
                  address: positionId,
                  owner: { __typename: "AddressOwner", address: { address: wallet } },
                  contents: {
                    type: { repr: "0x2::test::Position" },
                    json: { liquidity: "789" },
                  },
                }],
          },
        },
      },
    }));
  };

  const client = createGraphqlTreePowerClient();
  const object = await client.getObject({ id: CANONICAL_TREE_SUIDEX_V2_POOL_ID });
  assert.equal((object.data?.content as any)?.fields?.reserve1, "100");

  const coins = await client.getCoins({
    owner: wallet,
    coinType: CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  });
  assert.deepEqual(coins.data, [{ coinObjectId: coinId, balance: "456" }]);

  const positions = await client.getOwnedObjects({ owner: wallet });
  assert.equal(positions.data[0]?.data?.objectId, positionId);
  assert.equal((positions.data[0]?.data?.content as any)?.fields?.liquidity, "789");

  const account = await client.getDynamicFieldObject({
    parentId: MOONBAGS_TREE_STAKING_POOL_ID,
    name: { type: "address", value: wallet },
  });
  assert.equal(account.data?.objectId, accountId);
  assert.equal((account.data?.content as any)?.fields?.balance, "123");
});
