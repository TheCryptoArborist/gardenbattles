import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  CANONICAL_TREE_SUIDEX_V3_POOL_ID,
  buildTreePowerDiagnosticReport,
  classifyOwnedObject,
  getAllCoins,
  getDynamicFieldSummaries,
  getAllOwnedObjects,
  helpText,
  parseCliArgs,
  readMoonbagsTreeStake,
  readV2DirectLp,
  sanitizedOutputPath,
  type DiagnosticClient,
} from "./tree-power-diagnostics";

const wallet = "0x18d72fc2a3df6d92d0806da3b04d92be056e2d6d35882a56c16ddb25f48d35d6";
const treeCoinType =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

function object(data: Record<string, unknown>) {
  return { data };
}

function poolObject() {
  return object({
    objectId: CANONICAL_TREE_SUIDEX_V2_POOL_ID,
    type: `0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::pair::Pair<0x2::sui::SUI, ${treeCoinType}>`,
    owner: { Shared: { initial_shared_version: "1" } },
    previousTransaction: "pooltx",
    content: {
      fields: {
        reserve1: "1000",
        total_supply: "100",
      },
    },
  });
}

function v3PoolObject() {
  return object({
    objectId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
    type: `0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::pool::Pool<0x2::sui::SUI, ${treeCoinType}>`,
    owner: { Shared: { initial_shared_version: "2" } },
    previousTransaction: "v3pooltx",
    content: {
      fields: {
        type_x: { fields: { name: "2::sui::SUI" } },
        type_y: { fields: { name: treeCoinType.replace(/^0x/, "") } },
        tick_index: { fields: { bits: { fields: { value: "123" } } } },
        sqrt_price: "999",
        tick_spacing: "60",
      },
    },
  });
}

const moonbagsPoolId = "0x65b92741de03a6889da61c17bccb6f1e27d3d2455b4701948d8571eab8744ece";
const moonbagsConfigId = "0x245161e22ea04614628b56da68fe0474fff8c3c631292c2ee1a0bd669db57959";
const moonbagsOriginPackage = "0x8f70ad5db84e1a99b542f86ccfb1a932ca7ba010a2fa12a1504d839ff4c111c6";
const moonbagsAccountType = `${moonbagsOriginPackage}::moonbags_stake::StakingAccount`;

function moonbagsPoolObject() {
  return object({
    objectId: moonbagsPoolId,
    type: `${moonbagsOriginPackage}::moonbags_stake::StakingPool<${treeCoinType}>`,
    owner: { ObjectOwner: "0xparent" },
    previousTransaction: "pooltx",
    content: {
      fields: {
        staking_token: {
          type: `0x2::coin::Coin<${treeCoinType}>`,
          fields: { balance: "33746700996112" },
        },
        sui_token: {
          type: "0x2::coin::Coin<0x2::sui::SUI>",
          fields: { balance: "22391427109" },
        },
        total_supply: "33746700996112",
        reward_index: "8628653355448",
        pending_initial_rewards: "0",
      },
    },
  });
}

function moonbagsConfigObject() {
  return object({
    objectId: moonbagsConfigId,
    type: `${moonbagsOriginPackage}::moonbags_stake::Configuration`,
    owner: { Shared: { initial_shared_version: "531399707" } },
    previousTransaction: "configtx",
    content: {
      fields: {
        admin: "0x0b14e1e4b99ae114f4688c48758053c65575791159afdd8f2323781432ec79f1",
        version: "1",
      },
    },
  });
}

function moonbagsAccountObject(balance = "2000000000000") {
  return object({
    objectId: "0xstakeaccount",
    type: moonbagsAccountType,
    owner: { ObjectOwner: "0xdynamicfield" },
    previousTransaction: "stakeaccttx",
    content: {
      fields: {
        staker: wallet,
        balance,
        earned: "999999",
        reward_index: "3939342406848",
        unstake_deadline: "1753943181715",
      },
    },
  });
}

function makeClient(): DiagnosticClient & { calls: Record<string, number> } {
  const calls: Record<string, number> = { getOwnedObjects: 0, getCoins: 0, getDynamicFields: 0, queryTransactionBlocks: 0 };
  return {
    calls,
    async getObject({ id }: { id: string }) {
      if (id === CANONICAL_TREE_SUIDEX_V2_POOL_ID) return poolObject();
      if (id === CANONICAL_TREE_SUIDEX_V3_POOL_ID) return v3PoolObject();
      if (id === moonbagsPoolId) return moonbagsPoolObject();
      if (id === moonbagsConfigId) return moonbagsConfigObject();
      return object({
        objectId: id,
        type: "0x2::example::Thing",
        owner: { AddressOwner: wallet },
        previousTransaction: "manualtx",
        content: { fields: { value: "1" } },
      });
    },
    async getOwnedObjects({ cursor }: { cursor?: string | null }) {
      calls.getOwnedObjects += 1;
      if (!cursor) {
        return {
          data: [
            object({
              objectId: "0xlp",
              type: CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE,
              owner: { AddressOwner: wallet },
              previousTransaction: "lptx",
              content: { fields: { balance: "10" } },
            }),
          ],
          hasNextPage: true,
          nextCursor: "page2",
        };
      }
      return {
        data: [
          object({
            objectId: "0xv3",
            type: "0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position",
            owner: { AddressOwner: wallet },
            previousTransaction: "v3tx",
            content: { fields: { pool_id: CANONICAL_TREE_SUIDEX_V3_POOL_ID, liquidity: "100" } },
          }),
        ],
        hasNextPage: false,
        nextCursor: null,
      };
    },
    async getCoins({ cursor, coinType }: { cursor?: string | null; coinType: string }) {
      assert.equal(coinType, CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE);
      calls.getCoins += 1;
      if (!cursor) {
        return {
          data: [{ coinObjectId: "0xcoin1", balance: "5", digest: "d1", version: "1" }],
          hasNextPage: true,
          nextCursor: "coins2",
        };
      }
      return {
        data: [{ coinObjectId: "0xcoin2", balance: "20", digest: "d2", version: "2" }],
        hasNextPage: false,
        nextCursor: null,
      };
    },
    async getDynamicFields({ cursor, parentId }: { cursor?: string | null; parentId: string }) {
      calls.getDynamicFields += 1;
      assert.equal(parentId, "0xv3");
      if (!cursor) {
        return {
          data: [
            {
              name: { type: "0x2::object::ID", value: "tick-lower" },
              objectId: "0xdf1",
              objectType: "0x2::dynamic_field::Field<0x2::object::ID, u64>",
            },
          ],
          hasNextPage: true,
          nextCursor: "df2",
        };
      }
      return {
        data: [
          {
            name: { type: "0x2::object::ID", value: "tick-upper" },
            objectId: "0xdf2",
            objectType: "0x2::dynamic_field::Field<0x2::object::ID, u64>",
          },
        ],
        hasNextPage: false,
        nextCursor: null,
      };
    },
    async getDynamicFieldObject({ name }: { name: { value: string } }) {
      if (name.value === wallet) return moonbagsAccountObject();
      return object({
        objectId: `0x${name.value}`,
        type: "0x2::dynamic_field::Field<0x2::object::ID, u64>",
        previousTransaction: "dftx",
        content: { fields: { value: name.value === "tick-lower" ? "-100" : "100" } },
      });
    },
    async getTransactionBlock() {
      return {
        digest: "tx",
        effects: { status: { status: "success" } },
        transaction: {
          data: {
            transaction: {
              transactions: [
                {
                  MoveCall: {
                    package: "0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a",
                    module: "farm",
                    function: "deposit",
                    typeArguments: [treeCoinType],
                  },
                },
              ],
            },
          },
        },
      };
    },
    async queryTransactionBlocks({ limit }: { limit: number }) {
      calls.queryTransactionBlocks += 1;
      return {
        data: [
          {
            digest: "suidexTx",
            effects: { status: { status: "success" } },
            transaction: {
              data: {
                transaction: {
                  transactions: [
                    {
                      MoveCall: {
                        package: "0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56",
                        module: "position",
                        function: "add_liquidity",
                        typeArguments: [treeCoinType],
                      },
                    },
                  ],
                },
              },
            },
            objectChanges: [],
            events: [],
          },
          {
            digest: "moonbagsTx",
            effects: { status: { status: "success" } },
            transaction: {
              data: {
                transaction: {
                  transactions: [
                    {
                      MoveCall: {
                        package: "0x9bc9ddc5cd0220ef810489c73e770f8587a8aa09cad064a0d8e0d1ad903a9e0f",
                        module: "moonbags_stake",
                        function: "stake",
                        typeArguments: [treeCoinType],
                      },
                    },
                  ],
                },
              },
            },
            objectChanges: [],
            events: [],
          },
          {
            digest: `ignored-${limit}`,
            effects: { status: { status: "success" } },
            transaction: { data: { transaction: { transactions: [] } } },
            objectChanges: [],
            events: [],
          },
        ],
      };
    },
  };
}

test("--help exits through parser without requiring RPC inputs", () => {
  const options = parseCliArgs(["--help"]);
  assert.equal(options.help, true);
  assert.match(helpText(), /--wallet <address>/);
});

test("malformed wallet is rejected and valid wallet is normalized", () => {
  assert.throws(() => parseCliArgs(["--wallet", "0x123"]), /complete Sui address/);
  assert.equal(parseCliArgs(["--wallet", wallet.toUpperCase()]).wallet, wallet);
});

test("owned object pagination scans every page and classifies candidates", async () => {
  const client = makeClient();
  const result = await getAllOwnedObjects(client, wallet);
  assert.equal(result.pagesScanned, 2);
  assert.equal(result.objects.length, 2);
  assert.equal(result.objects[0].classification, "canonical-v2-lp-coin");
  assert.equal(result.objects[1].classification, "potential-v3-position");
});

test("getCoins pagination sums direct V2 LP balance", async () => {
  const client = makeClient();
  const result = await getAllCoins(client, wallet, CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE);
  assert.equal(result.pagesScanned, 2);
  assert.equal(result.totalBalanceRaw, 25n);
  assert.deepEqual(result.coins.map((coin) => coin.coinObjectId), ["0xcoin1", "0xcoin2"]);
});

test("dynamic field scan is paginated and summarizes field values", async () => {
  const client = makeClient();
  const result = await getDynamicFieldSummaries(client, ["0xv3"]);
  assert.equal(result.supported, true);
  assert.equal(result.objects[0].pagesScanned, 2);
  assert.deepEqual(result.objects[0].fields.map((field: any) => field.objectId), ["0xdf1", "0xdf2"]);
  assert.equal((result.objects[0].fields[0] as any).value.relevantFields.value, "-100");
});

test("direct V2 LP calculation uses bigint pool reserves", async () => {
  const client = makeClient();
  const result = await readV2DirectLp(client, wallet);
  assert.equal(result.totalRawDirectLpBalance, "25");
  assert.equal(result.directUnderlyingTreeRaw, "250");
});

test("classification excludes unrelated LP and detects possible farm receipts", () => {
  assert.equal(classifyOwnedObject("0x2::coin::Coin<0x2::sui::SUI>"), "unrelated-object");
  assert.equal(classifyOwnedObject(`0x2::coin::Coin<${CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE}>`), "canonical-v2-lp-coin");
  assert.equal(
    classifyOwnedObject("0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::farm::Receipt"),
    "potential-v2-farm-receipt",
  );
  assert.equal(
    classifyOwnedObject(`0xbfac5e1c6bf6ef29b12f7723857695fd2f4da9a11a7d88162c15e9124c243a4a::farm::StakingPosition<${CANONICAL_TREE_SUIDEX_V2_LP_COIN_TYPE}>`),
    "potential-v2-farm-receipt",
  );
  assert.equal(
    classifyOwnedObject("0xb5f529c1dcda6580a61bf7ee9fbd524b50be62f11044d137c8202c8cbace9e56::position::Position"),
    "potential-v3-position",
  );
  assert.equal(classifyOwnedObject(moonbagsAccountType), "canonical-moonbags-tree-staking-account");
  assert.equal(
    classifyOwnedObject(`${moonbagsOriginPackage}::moonbags_token_lock::Lock<${treeCoinType}>`),
    "excluded-moonbags-token-lock",
  );
});

test("Moonbags diagnostic reads wallet-keyed principal and excludes rewards", async () => {
  const client = makeClient();
  const result = await readMoonbagsTreeStake(client, wallet);

  assert.equal((result as any).canonicalTreePool.verified, true);
  assert.equal((result as any).walletStake.status, "qualified-data");
  assert.equal((result as any).walletStake.principalRaw, "2000000000000");
  assert.equal((result as any).walletStake.principalDisplay, "2000000");
  assert.equal((result as any).walletStake.rewardFieldsExcluded.earnedRaw, "999999");
});

test("full report omits private RPC URL and filters recent transactions", async () => {
  const client = makeClient();
  const options = parseCliArgs(["--wallet", wallet, "--rpc-url", "https://secret.example/token", "--recent-transactions", "3"]);
  const report = await buildTreePowerDiagnosticReport("suidex-v3-position", options, client);
  assert.equal((report as any).rpc, "custom");
  assert.equal(JSON.stringify(report).includes("secret.example"), false);
  assert.equal((report as any).ownedObjectScan.totalObjectsScanned, 2);
  assert.equal((report as any).ownedObjectScan.dynamicFieldScan.objects.length, 1);
  assert.equal((report as any).recentTransactions.requestedLimit, 3);
  assert.equal((report as any).recentTransactions.matchingSuiDexTransactions.length, 1);
});

test("Moonbags report filters recent transactions to Moonbags staking activity", async () => {
  const client = makeClient();
  const options = parseCliArgs(["--wallet", wallet, "--rpc-url", "https://secret.example/token", "--recent-transactions", "3"]);
  const report = await buildTreePowerDiagnosticReport("moonbags-tree-stake", options, client);

  assert.equal((report as any).rpc, "custom");
  assert.equal(JSON.stringify(report).includes("secret.example"), false);
  assert.equal((report as any).moonbagsTreeStaking.walletStake.status, "qualified-data");
  assert.equal((report as any).recentTransactions.matchingSuiDexTransactions.length, 1);
  assert.equal((report as any).recentTransactions.matchingSuiDexTransactions[0].digest, "moonbagsTx");
});

test("sanitized output filename is deterministic and wallet-scoped", () => {
  assert.equal(
    sanitizedOutputPath("suidex-v2-farm", wallet, new Date("2026-07-24T12:34:56Z")),
    "diagnostics-output\\suidex-v2-farm-18d72f-8d35d6-20260724123456.json",
  );
});
