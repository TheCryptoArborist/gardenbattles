import assert from "node:assert/strict";
import test from "node:test";
import {
  CANONICAL_TREE_SUIDEX_V2_POOL_ID,
  CANONICAL_TREE_SUIDEX_V3_POOL_ID,
  getFifthMoveEligibilityFromPositions,
  isCanonicalMoonbagsTreeStake,
  hasVerifiedSuiDexPositionShapes,
  isCanonicalTreeV2Position,
  isCanonicalTreeV3Position,
} from "./suiDexTreePosition";

test("no SuiDex position produces not-qualified", () => {
  assert.deepEqual(getFifthMoveEligibilityFromPositions({ v2: [], v3: [] }), {
    status: "not-qualified",
    sources: [],
  });
});

test("V2 active nonzero canonical position qualifies", () => {
  const position = { poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID, amount: "1" };

  assert.equal(isCanonicalTreeV2Position(position), true);
  assert.deepEqual(getFifthMoveEligibilityFromPositions({ v2: [position], v3: [] }), {
    status: "qualified",
    sources: ["suidex-v2"],
  });
});

test("V3 active nonzero canonical position qualifies", () => {
  const position = {
    poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
    liquidity: 1n,
    closed: false,
  };

  assert.equal(isCanonicalTreeV3Position(position), true);
  assert.deepEqual(getFifthMoveEligibilityFromPositions({ v2: [], v3: [position] }), {
    status: "qualified",
    sources: ["suidex-v3"],
  });
});

test("Moonbags TREE stake qualifies", () => {
  assert.deepEqual(
    getFifthMoveEligibilityFromPositions({
      moonbags: [
        {
          owner: "0xabc",
          coinType:
            "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
          stakedAmount: "1",
          active: true,
        },
      ],
    }),
    {
      status: "qualified",
      sources: ["moonbags-staking"],
    },
  );
});

test("V2, V3, and Moonbags positions qualify as multiple sources", () => {
  assert.deepEqual(
    getFifthMoveEligibilityFromPositions({
      v2: [{ poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID, stakedAmount: 2 }],
      v3: [{ poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID, liquidity: "3", closed: false }],
      moonbags: [
        {
          owner: "0xabc",
          coinType:
            "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
          stakedAmount: 4,
          active: true,
        },
      ],
    }),
    {
      status: "qualified",
      sources: ["suidex-v2", "suidex-v3", "moonbags-staking"],
    },
  );
});

test("zero V2 LP amount and zero-liquidity V3 position do not qualify", () => {
  assert.equal(
    isCanonicalTreeV2Position({ poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID, amount: 0 }),
    false,
  );
  assert.equal(
    isCanonicalTreeV3Position({
      poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      liquidity: 0,
      closed: false,
    }),
    false,
  );
  assert.deepEqual(
    getFifthMoveEligibilityFromPositions({
      v2: [{ poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID, amount: 0 }],
      v3: [{ poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID, liquidity: 0, closed: false }],
    }),
    {
      status: "not-qualified",
      sources: [],
    },
  );
});

test("zero, withdrawn, unrelated, generic lock, and treasury Moonbags stakes do not qualify", () => {
  const treeCoin =
    "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

  for (const stake of [
    { owner: "0xabc", coinType: treeCoin, stakedAmount: 0, active: true },
    { owner: "0xabc", coinType: treeCoin, stakedAmount: 1, active: true, withdrawn: true },
    { owner: "0xabc", coinType: "0x2::sui::SUI", stakedAmount: 1, active: true },
    { owner: "0xabc", coinType: treeCoin, stakedAmount: 1, active: true, genericTokenLock: true },
    { owner: "0xtreasury", coinType: treeCoin, stakedAmount: 1, active: true, projectTreasuryLock: true },
  ]) {
    assert.deepEqual(getFifthMoveEligibilityFromPositions({ moonbags: [stake] }), {
      status: "not-qualified",
      sources: [],
    });
  }
});

test("project treasury lock does not qualify a different wallet", () => {
  assert.equal(
    isCanonicalMoonbagsTreeStake(
      {
        owner: "0xtreasury",
        coinType:
          "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE",
        stakedAmount: 1,
        active: true,
      },
      "0xplayer",
    ),
    false,
  );
});

test("one qualifying source wins even if another provider is unavailable", () => {
  assert.deepEqual(
    getFifthMoveEligibilityFromPositions({
      v2: [{ poolId: CANONICAL_TREE_SUIDEX_V2_POOL_ID, amount: 1 }],
      moonbagsUnavailable: true,
    }),
    {
      status: "qualified",
      sources: ["suidex-v2"],
    },
  );
});

test("unavailable provider with no qualifying sources is unavailable", () => {
  assert.deepEqual(getFifthMoveEligibilityFromPositions({ moonbagsUnavailable: true }), {
    status: "unavailable",
    sources: [],
  });
});

test("closed or unrelated SuiDex positions do not qualify", () => {
  assert.equal(
    isCanonicalTreeV2Position({ poolId: "0xnot-the-tree-pool", amount: 10 }),
    false,
  );
  assert.equal(
    isCanonicalTreeV3Position({
      poolId: CANONICAL_TREE_SUIDEX_V3_POOL_ID,
      liquidity: 10,
      closed: true,
    }),
    false,
  );
});

test("RPC failure produces unavailable, not not-qualified", () => {
  assert.deepEqual(getFifthMoveEligibilityFromPositions({ rpcUnavailable: true }), {
    status: "unavailable",
    sources: [],
  });
});

test("live detector remains disabled until LP and position shapes are verified", () => {
  assert.equal(hasVerifiedSuiDexPositionShapes(), false);
});
