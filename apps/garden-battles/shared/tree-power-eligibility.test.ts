import assert from "node:assert/strict";
import test from "node:test";
import {
  FIFTH_MOVE_THRESHOLD_RAW,
  Q64,
  TREE_COIN_TYPE,
  aggregateFifthMoveEligibility,
  calculateMoonbagsStakedTreeRaw,
  calculateV2TotalUnderlyingTreeRaw,
  calculateV2UnderlyingTreeRaw,
  calculateV3UnderlyingTreeForPositions,
  calculateV3UnderlyingTreeRaw,
  decodeSignedI32Bits,
  displayTreeToRaw,
  getVerifiedV2FarmedLpRaw,
  rawTreeToDisplay,
  reconstructMoonbagsStakePrincipalFromEvents,
  reconstructV2FarmPrincipalFromEvents,
  serializeFifthMoveEligibility,
  sqrtPriceX64AtTick,
  type FifthMoveSourceResult,
} from "./tree-power-eligibility";

const wallet = "0x1111111111111111111111111111111111111111111111111111111111111111";
const raw = (tree: string) => displayTreeToRaw(tree);
const source = (
  sourceName: FifthMoveSourceResult["source"],
  status: FifthMoveSourceResult["status"],
  amount?: string,
): FifthMoveSourceResult => ({
  source: sourceName,
  status,
  underlyingTreeRaw: amount === undefined ? undefined : raw(amount),
});

test("TREE decimal conversion uses bigint and exact 1,000,000 TREE threshold", () => {
  assert.equal(rawTreeToDisplay(raw("1000000")), "1000000");
  assert.equal(raw("1000000").toString(), "1000000000000");
  assert.equal(FIFTH_MOVE_THRESHOLD_RAW.toString(), "1000000000000");
  assert.equal(raw("999999.999999").toString(), "999999999999");
  assert.throws(() => raw("1.0000001"), /too many decimal/i);
});

test("V2 direct LP formula floors deterministically", () => {
  assert.equal(
    calculateV2UnderlyingTreeRaw({
      playerLpRaw: BigInt(25),
      poolTreeReserveRaw: BigInt(1000),
      totalLpSupplyRaw: BigInt(100),
    }),
    BigInt(250),
  );
  assert.equal(
    calculateV2UnderlyingTreeRaw({
      playerLpRaw: BigInt(1),
      poolTreeReserveRaw: BigInt(10),
      totalLpSupplyRaw: BigInt(3),
    }),
    BigInt(3),
  );
});

test("V2 farmed LP combines with direct LP and ignores unrelated or inactive receipts", () => {
  const farm = "0xfarm";
  const farmed = getVerifiedV2FarmedLpRaw({
    canonicalFarmId: farm,
    candidates: [
      { objectId: "0xactive", farmId: farm, lpAmountRaw: 20, active: true },
      { objectId: "0xzero", farmId: farm, lpAmountRaw: 0, active: true },
      { objectId: "0xwithdrawn", farmId: farm, lpAmountRaw: 30, withdrawn: true },
      { objectId: "0xunrelated", farmId: "0xother", lpAmountRaw: 40, active: true },
    ],
  });

  assert.equal(farmed.farmedLpRaw, BigInt(20));
  assert.deepEqual(farmed.objectIds, ["0xactive"]);
  assert.equal(
    calculateV2TotalUnderlyingTreeRaw({
      directLpRaw: BigInt(5),
      farmedLpRaw: farmed.farmedLpRaw,
      poolTreeReserveRaw: BigInt(1000),
      totalLpSupplyRaw: BigInt(100),
    }),
    BigInt(250),
  );
});

test("V2 farm principal reconstruction supports deposits, withdrawals, rewards, duplicates, and unrelated events", () => {
  const farmed = reconstructV2FarmPrincipalFromEvents({
    wallet,
    canonicalLpType: "0xlp",
    positionId: "0xposition",
    events: [
      { eventId: "deposit-1", kind: "deposit", wallet, positionId: "0xposition", poolType: "0xlp", amountRaw: 100 },
      { eventId: "deposit-2", kind: "deposit", wallet, positionId: "0xposition", poolType: "0xlp", amountRaw: 50 },
      { eventId: "deposit-2", kind: "deposit", wallet, positionId: "0xposition", poolType: "0xlp", amountRaw: 50 },
      { eventId: "withdraw-1", kind: "withdrawal", wallet, positionId: "0xposition", poolType: "0xlp", amountRaw: 25 },
      { eventId: "reward", kind: "reward", wallet, positionId: "0xposition", poolType: "0xlp", amountRaw: 999 },
      { eventId: "other-position", kind: "deposit", wallet, positionId: "0xother", poolType: "0xlp", amountRaw: 1000 },
      { eventId: "other-lp", kind: "deposit", wallet, positionId: "0xposition", poolType: "0xother", amountRaw: 1000 },
      { eventId: "other-wallet", kind: "deposit", wallet: "0x2222222222222222222222222222222222222222222222222222222222222222", positionId: "0xposition", poolType: "0xlp", amountRaw: 1000 },
    ],
  });

  assert.equal(farmed.depositLpRaw, BigInt(150));
  assert.equal(farmed.withdrawalLpRaw, BigInt(25));
  assert.equal(farmed.principalLpRaw, BigInt(125));
  assert.deepEqual(farmed.eventIds, ["deposit-1", "deposit-2", "withdraw-1"]);
});

test("V2 farm principal reconstruction handles full withdrawal and incomplete history conservatively", () => {
  assert.equal(
    reconstructV2FarmPrincipalFromEvents({
      wallet,
      canonicalLpType: "0xlp",
      events: [
        { eventId: "deposit", kind: "deposit", wallet, poolType: "0xlp", amountRaw: 100 },
        { eventId: "withdraw", kind: "withdrawal", wallet, poolType: "0xlp", amountRaw: 100 },
      ],
    }).principalLpRaw,
    BigInt(0),
  );

  const incomplete = reconstructV2FarmPrincipalFromEvents({
    wallet,
    canonicalLpType: "0xlp",
    requireCompleteHistory: false,
    events: [{ eventId: "deposit", kind: "deposit", wallet, poolType: "0xlp", amountRaw: 100 }],
  });

  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.depositLpRaw, BigInt(100));
  assert.equal(incomplete.principalLpRaw, BigInt(0));
});

test("V2 farm principal fixture floors underlying TREE deterministically", () => {
  assert.equal(
    calculateV2UnderlyingTreeRaw({
      playerLpRaw: BigInt("94369282575"),
      poolTreeReserveRaw: BigInt("49293644613355"),
      totalLpSupplyRaw: BigInt("8142055208088"),
    }).toString(),
    "571330672512",
  );
});

test("V2 zero LP and invalid supply are handled safely", () => {
  assert.equal(
    calculateV2UnderlyingTreeRaw({
      playerLpRaw: BigInt(0),
      poolTreeReserveRaw: BigInt(1000),
      totalLpSupplyRaw: BigInt(100),
    }),
    BigInt(0),
  );
  assert.throws(
    () =>
      calculateV2UnderlyingTreeRaw({
        playerLpRaw: BigInt(1),
        poolTreeReserveRaw: BigInt(1000),
        totalLpSupplyRaw: BigInt(0),
      }),
    /positive/i,
  );
});

test("V3 CLMM TREE calculation covers below, in, and above range when TREE is token 1", () => {
  const lower = Q64;
  const current = BigInt(2) * Q64;
  const upper = BigInt(4) * Q64;
  const liquidity = BigInt(1000);

  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity,
      sqrtPriceLower: lower,
      sqrtPriceCurrent: lower / BigInt(2),
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(0),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity,
      sqrtPriceLower: lower,
      sqrtPriceCurrent: current,
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(1000),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity,
      sqrtPriceLower: lower,
      sqrtPriceCurrent: BigInt(5) * Q64,
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(3000),
  );
});

test("V3 position aggregation covers multiple positions and excludes unrelated or closed positions", () => {
  const lower = Q64;
  const current = BigInt(2) * Q64;
  const upper = BigInt(4) * Q64;
  const poolId = "0xpool";

  const result = calculateV3UnderlyingTreeForPositions({
    pool: { poolId, sqrtPriceCurrent: current, treeTokenIndex: 1 },
    positions: [
      { objectId: "0xin-range", poolId, liquidity: 1000, sqrtPriceLower: lower, sqrtPriceUpper: upper },
      { objectId: "0xabove", poolId, liquidity: 1000, sqrtPriceLower: lower, sqrtPriceUpper: upper, closed: true },
      { objectId: "0xother", poolId: "0xother", liquidity: 1000, sqrtPriceLower: lower, sqrtPriceUpper: upper },
      { objectId: "0xzero", poolId, liquidity: 0, sqrtPriceLower: lower, sqrtPriceUpper: upper },
    ],
  });

  assert.equal(result.underlyingTreeRaw, BigInt(1000));
  assert.deepEqual(result.objectIds, ["0xin-range"]);
  assert.equal(result.positionCount, 1);
});

test("V3 tick decoding and Q64 sqrt price calculation are deterministic", () => {
  assert.equal(decodeSignedI32Bits(33900), 33900);
  assert.equal(decodeSignedI32Bits(4294967250), -46);
  assert.equal(sqrtPriceX64AtTick(0), Q64);
  assert.equal(sqrtPriceX64AtTick(33900).toString(), "100464370031846246815");
  assert.equal(sqrtPriceX64AtTick(37620).toString(), "121000398407248309748");
});

test("V3 position aggregation accepts signed tick indexes from live SuiDex position shape", () => {
  const result = calculateV3UnderlyingTreeForPositions({
    pool: {
      poolId: "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf",
      sqrtPriceCurrent: "109707448322793383515",
      treeTokenIndex: 1,
    },
    positions: [
      {
        objectId: "0xe68e034a6f2390eaa9caf2dce42b75e48ab6c408a64a722a2f92f8b3a92f31c3",
        poolId: "0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf",
        liquidity: "164081076071423",
        tickLower: 33900,
        tickUpper: 37620,
      },
    ],
  });

  assert.equal(result.underlyingTreeRaw.toString(), "82215822268196");
  assert.deepEqual(result.objectIds, ["0xe68e034a6f2390eaa9caf2dce42b75e48ab6c408a64a722a2f92f8b3a92f31c3"]);
});

test("V3 TREE as type_y principal can be zero, partial, or entirely present across ranges", () => {
  const lower = Q64;
  const current = BigInt(2) * Q64;
  const upper = BigInt(4) * Q64;

  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(1000),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: lower / BigInt(2),
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(0),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(1000),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: current,
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(1000),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(1000),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: upper * BigInt(2),
      sqrtPriceUpper: upper,
      treeTokenIndex: 1,
    }),
    BigInt(3000),
  );
});

test("V3 tick-index positions cover below, in, above, zero, closed, unrelated, and multiple", () => {
  const poolId = "0xpool";
  const current = sqrtPriceX64AtTick(150);
  const result = calculateV3UnderlyingTreeForPositions({
    pool: { poolId, sqrtPriceCurrent: current, treeTokenIndex: 1 },
    positions: [
      { objectId: "below", poolId, liquidity: 1000, tickLower: 200, tickUpper: 300 },
      { objectId: "inside", poolId, liquidity: 1000, tickLower: 100, tickUpper: 300 },
      { objectId: "above", poolId, liquidity: 1000, tickLower: -300, tickUpper: -100 },
      { objectId: "zero", poolId, liquidity: 0, tickLower: 100, tickUpper: 300 },
      { objectId: "closed", poolId, liquidity: 1000, tickLower: 100, tickUpper: 300, closed: true },
      { objectId: "unrelated", poolId: "0xother", liquidity: 1000, tickLower: 100, tickUpper: 300 },
      { objectId: "inside-two", poolId, liquidity: 2000, tickLower: 100, tickUpper: 300 },
    ],
  });

  const inside = calculateV3UnderlyingTreeRaw({
    liquidity: 1000n,
    sqrtPriceLower: sqrtPriceX64AtTick(100),
    sqrtPriceCurrent: current,
    sqrtPriceUpper: sqrtPriceX64AtTick(300),
    treeTokenIndex: 1,
  });
  const above = calculateV3UnderlyingTreeRaw({
    liquidity: 1000n,
    sqrtPriceLower: sqrtPriceX64AtTick(-300),
    sqrtPriceCurrent: current,
    sqrtPriceUpper: sqrtPriceX64AtTick(-100),
    treeTokenIndex: 1,
  });
  const insideTwo = calculateV3UnderlyingTreeRaw({
    liquidity: 2000n,
    sqrtPriceLower: sqrtPriceX64AtTick(100),
    sqrtPriceCurrent: current,
    sqrtPriceUpper: sqrtPriceX64AtTick(300),
    treeTokenIndex: 1,
  });

  assert.equal(result.underlyingTreeRaw, inside + above + insideTwo);
  assert.deepEqual(result.objectIds, ["inside", "above", "inside-two"]);
});

test("V3 CLMM TREE calculation respects token ordering, zero liquidity, and closed positions", () => {
  const lower = Q64;
  const current = BigInt(2) * Q64;
  const upper = BigInt(4) * Q64;

  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(1000),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: current,
      sqrtPriceUpper: upper,
      treeTokenIndex: 0,
    }),
    BigInt(250),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(0),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: current,
      sqrtPriceUpper: upper,
      treeTokenIndex: 0,
    }),
    BigInt(0),
  );
  assert.equal(
    calculateV3UnderlyingTreeRaw({
      liquidity: BigInt(1000),
      sqrtPriceLower: lower,
      sqrtPriceCurrent: current,
      sqrtPriceUpper: upper,
      treeTokenIndex: 0,
      closed: true,
    }),
    BigInt(0),
  );
});

test("Moonbags active TREE stake counts principal only and excludes rewards and lock-like records", () => {
  const result = calculateMoonbagsStakedTreeRaw({
    wallet,
    canonicalPoolId: "0xpool",
    candidates: [
      {
        objectId: "0xstake",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        rewardsRaw: raw("5000000"),
        active: true,
      },
      {
        objectId: "0xstake-two",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("250000"),
        active: true,
      },
      {
        objectId: "0xother-pool",
        owner: wallet,
        poolId: "0xother",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
      },
      {
        objectId: "0xwithdrawn",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        withdrawn: true,
      },
      {
        objectId: "0xlock",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        genericTokenLock: true,
      },
      {
        objectId: "0xtreasury",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        projectTreasuryLock: true,
      },
      {
        objectId: "0xother-token",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x2::sui::SUI",
        stakedAmountRaw: raw("1000000"),
      },
      {
        objectId: "0xwrong-wallet",
        owner: "0x2222222222222222222222222222222222222222222222222222222222222222",
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
      },
    ],
  });

  assert.equal(result.stakedTreeRaw, raw("1250000"));
  assert.deepEqual(result.objectIds, ["0xstake", "0xstake-two"]);
});

test("Moonbags zero and inactive current stake candidates return verified-zero input amounts", () => {
  const result = calculateMoonbagsStakedTreeRaw({
    wallet,
    canonicalPoolId: "0xpool",
    candidates: [
      {
        objectId: "0xzero",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: 0,
      },
      {
        objectId: "0xinactive",
        owner: wallet,
        poolId: "0xpool",
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("100"),
        active: false,
      },
    ],
  });

  assert.equal(result.stakedTreeRaw, BigInt(0));
  assert.deepEqual(result.objectIds, []);
});

test("Moonbags event reconstruction supports partial/full withdrawal, reward claims, duplicates, and incomplete history", () => {
  const reconstructed = reconstructMoonbagsStakePrincipalFromEvents({
    wallet,
    canonicalPoolId: "0xpool",
    events: [
      { eventId: "stake-1", kind: "stake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("1000") },
      { eventId: "stake-2", kind: "stake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("500") },
      { eventId: "stake-2", kind: "stake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("500") },
      { eventId: "unstake-1", kind: "unstake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("250") },
      { eventId: "reward", kind: "reward", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("999999") },
      { eventId: "sui-reward", kind: "reward", wallet, poolId: "0xpool", coinType: "0x2::sui::SUI", amountRaw: raw("999999") },
      { eventId: "wrong-token", kind: "stake", wallet, poolId: "0xpool", coinType: "0x2::sui::SUI", amountRaw: raw("1000") },
      { eventId: "wrong-pool", kind: "stake", wallet, poolId: "0xother", coinType: TREE_COIN_TYPE, amountRaw: raw("1000") },
      {
        eventId: "wrong-wallet",
        kind: "stake",
        wallet: "0x2222222222222222222222222222222222222222222222222222222222222222",
        poolId: "0xpool",
        coinType: TREE_COIN_TYPE,
        amountRaw: raw("1000"),
      },
    ],
  });

  assert.equal(reconstructed.depositTreeRaw, raw("1500"));
  assert.equal(reconstructed.withdrawalTreeRaw, raw("250"));
  assert.equal(reconstructed.stakedTreeRaw, raw("1250"));
  assert.deepEqual(reconstructed.eventIds, ["stake-1", "stake-2", "unstake-1"]);

  assert.equal(
    reconstructMoonbagsStakePrincipalFromEvents({
      wallet,
      canonicalPoolId: "0xpool",
      events: [
        { eventId: "stake", kind: "stake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("10") },
        { eventId: "unstake", kind: "unstake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("10") },
      ],
    }).stakedTreeRaw,
    BigInt(0),
  );

  const incomplete = reconstructMoonbagsStakePrincipalFromEvents({
    wallet,
    canonicalPoolId: "0xpool",
    requireCompleteHistory: false,
    events: [{ eventId: "stake", kind: "stake", wallet, poolId: "0xpool", coinType: TREE_COIN_TYPE, amountRaw: raw("10") }],
  });
  assert.equal(incomplete.complete, false);
  assert.equal(incomplete.stakedTreeRaw, BigInt(0));
});

test("aggregator qualifies exactly at threshold and combined sources", () => {
  assert.equal(
    aggregateFifthMoveEligibility({
      wallet,
      sources: [
        source("suidex-v2", "qualified-data", "400000"),
        source("suidex-v3", "qualified-data", "300000"),
        source("moonbags-staking", "qualified-data", "300000"),
      ],
    }).status,
    "qualified",
  );
});

test("aggregator does not qualify one raw unit below threshold when all sources verified", () => {
  const result = aggregateFifthMoveEligibility({
    wallet,
    sources: [
      { source: "suidex-v2", status: "qualified-data", underlyingTreeRaw: FIFTH_MOVE_THRESHOLD_RAW - BigInt(1) },
      source("suidex-v3", "verified-zero", "0"),
      source("moonbags-staking", "verified-zero", "0"),
    ],
  });
  assert.equal(result.status, "not-qualified");
  assert.equal(result.remainingTreeRaw?.toString(), "1");
});

test("aggregator qualifies despite unavailable source once verified total reaches threshold", () => {
  const result = aggregateFifthMoveEligibility({
    wallet,
    sources: [
      source("suidex-v2", "qualified-data", "1100000"),
      source("suidex-v3", "verified-zero", "0"),
      source("moonbags-staking", "unavailable"),
    ],
  });
  assert.equal(result.status, "qualified");
});

test("aggregator reports incomplete or unavailable instead of false not-qualified", () => {
  assert.equal(
    aggregateFifthMoveEligibility({
      wallet,
      sources: [
        source("suidex-v2", "qualified-data", "600000"),
        source("suidex-v3", "verified-zero", "0"),
        source("moonbags-staking", "unavailable"),
      ],
    }).status,
    "verification-incomplete",
  );
  assert.equal(
    aggregateFifthMoveEligibility({
      wallet,
      sources: [
        source("suidex-v2", "unavailable"),
        source("suidex-v3", "unavailable"),
        source("moonbags-staking", "unavailable"),
      ],
    }).status,
    "unavailable",
  );
});

test("serializer returns decimal strings for bigint fields", () => {
  const serialized = serializeFifthMoveEligibility(
    aggregateFifthMoveEligibility({
      wallet,
      sources: [source("suidex-v2", "qualified-data", "1000000")],
    }),
  );
  assert.equal(serialized.thresholdRaw, "1000000000000");
  assert.equal(serialized.verifiedUnderlyingTreeRaw, "1000000000000");
  assert.equal(serialized.sources[0].underlyingTreeRaw, "1000000000000");
});
