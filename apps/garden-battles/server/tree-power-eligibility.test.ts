import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  MOONBAGS_TREE_STAKING_ACCOUNT_TYPE,
  MOONBAGS_TREE_STAKING_POOL_ID,
  MOONBAGS_TREE_STAKING_POOL_TYPE,
  clearTreePowerEligibilityCache,
  getCachedFifthMoveEligibility,
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

test("provider failures remain unavailable and do not become verified zero", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ failV2: true }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "verification-incomplete");
  assert.equal(response.sources[0].status, "unavailable");
  assert.equal(response.sources[0].reason, "v2_unavailable");
  assert.equal(response.sources[1].status, "verified-zero");
});

test("zero direct V2 LP and zero verified farmed LP remain incomplete while Moonbags is unavailable", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({ lpBalance: "0", failMoonbags: true }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "verification-incomplete");
  assert.equal(response.sources[0].source, "suidex-v2");
  assert.equal(response.sources[0].status, "verified-zero");
  assert.equal(response.sources[0].underlyingTreeRaw, "0");
  assert.equal(response.sources[0].reason, "direct_wallet_lp_and_verified_farmed_lp_zero");
  assert.equal(response.sources[1].reason, "v3_pool_and_owned_positions_verified_principal_only");
  assert.equal(response.sources[1].underlyingTreeRaw, "0");
  assert.equal(response.sources[2].reason, "moonbags_unavailable");
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

test("verified V3 principal can qualify while Moonbags remains unavailable", async () => {
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

test("Moonbags active TREE staking principal qualifies and excludes reward fields", async () => {
  clearTreePowerEligibilityCache();
  const client = makeClient({
    lpBalance: "0",
    moonbagsAccount: makeMoonbagsAccountObject({
      balance: "2000000000000",
      earned: "5000000000000",
    }),
  }) as any;
  const response = await getCachedFifthMoveEligibility(client, wallet);

  assert.equal(response.status, "qualified");
  assert.equal(response.sources[2].source, "moonbags-staking");
  assert.equal(response.sources[2].status, "qualified-data");
  assert.equal(response.sources[2].underlyingTreeRaw, "2000000000000");
  assert.equal(response.sources[2].reason, "moonbags_tree_staking_account_principal_verified");
});

test("Moonbags missing account and zero principal are verified zero, not unavailable", async () => {
  clearTreePowerEligibilityCache();
  const missing = await getCachedFifthMoveEligibility(makeClient({ lpBalance: "0", moonbagsAccount: null }) as any, wallet);

  assert.equal(missing.status, "not-qualified");
  assert.equal(missing.sources[2].status, "verified-zero");
  assert.equal(missing.sources[2].underlyingTreeRaw, "0");
  assert.equal(missing.sources[2].reason, "moonbags_tree_staking_account_not_found");

  clearTreePowerEligibilityCache();
  const zero = await getCachedFifthMoveEligibility(
    makeClient({ lpBalance: "0", moonbagsAccount: makeMoonbagsAccountObject({ balance: "0", earned: "1000" }) }) as any,
    wallet,
  );

  assert.equal(zero.status, "not-qualified");
  assert.equal(zero.sources[2].status, "verified-zero");
  assert.equal(zero.sources[2].underlyingTreeRaw, "0");
  assert.equal(zero.sources[2].reason, "moonbags_tree_staking_account_zero_principal");
});

test("Moonbags shape and owner mismatches remain unavailable", async () => {
  clearTreePowerEligibilityCache();
  const wrongPool = await getCachedFifthMoveEligibility(
    makeClient({ lpBalance: "0", moonbagsPool: makeMoonbagsPoolObject({ type: "0x2::bad::Pool" }) }) as any,
    wallet,
  );
  assert.equal(wrongPool.status, "verification-incomplete");
  assert.equal(wrongPool.sources[2].status, "unavailable");
  assert.equal(wrongPool.sources[2].reason, "moonbags_tree_staking_pool_shape_mismatch");

  clearTreePowerEligibilityCache();
  const wrongAccountType = await getCachedFifthMoveEligibility(
    makeClient({
      lpBalance: "0",
      moonbagsAccount: makeMoonbagsAccountObject({ type: "0x2::bad::Account", balance: "1000" }),
    }) as any,
    wallet,
  );
  assert.equal(wrongAccountType.sources[2].status, "unavailable");
  assert.equal(wrongAccountType.sources[2].reason, "moonbags_tree_staking_account_shape_mismatch");

  clearTreePowerEligibilityCache();
  const wrongOwner = await getCachedFifthMoveEligibility(
    makeClient({
      lpBalance: "0",
      moonbagsAccount: makeMoonbagsAccountObject({
        staker: "0x2222222222222222222222222222222222222222222222222222222222222222",
        balance: "1000",
      }),
    }) as any,
    wallet,
  );
  assert.equal(wrongOwner.sources[2].status, "unavailable");
  assert.equal(wrongOwner.sources[2].reason, "moonbags_tree_staking_account_owner_mismatch");
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
