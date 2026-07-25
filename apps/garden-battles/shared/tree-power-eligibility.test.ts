import assert from "node:assert/strict";
import test from "node:test";
import {
  FIFTH_MOVE_THRESHOLD_RAW,
  Q64,
  aggregateFifthMoveEligibility,
  calculateMoonbagsStakedTreeRaw,
  calculateV2TotalUnderlyingTreeRaw,
  calculateV2UnderlyingTreeRaw,
  calculateV3UnderlyingTreeForPositions,
  calculateV3UnderlyingTreeRaw,
  displayTreeToRaw,
  getVerifiedV2FarmedLpRaw,
  rawTreeToDisplay,
  serializeFifthMoveEligibility,
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
    candidates: [
      {
        objectId: "0xstake",
        owner: wallet,
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        rewardsRaw: raw("5000000"),
        active: true,
      },
      {
        objectId: "0xwithdrawn",
        owner: wallet,
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        withdrawn: true,
      },
      {
        objectId: "0xlock",
        owner: wallet,
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        genericTokenLock: true,
      },
      {
        objectId: "0xtreasury",
        owner: wallet,
        coinType: "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmountRaw: raw("1000000"),
        projectTreasuryLock: true,
      },
      {
        objectId: "0xother-token",
        owner: wallet,
        coinType: "0x2::sui::SUI",
        stakedAmountRaw: raw("1000000"),
      },
    ],
  });

  assert.equal(result.stakedTreeRaw, raw("1000000"));
  assert.deepEqual(result.objectIds, ["0xstake"]);
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
