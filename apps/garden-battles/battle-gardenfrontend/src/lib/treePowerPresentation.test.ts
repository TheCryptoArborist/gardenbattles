import assert from "node:assert/strict";
import test from "node:test";
import {
  TREE_POWER_BUY_URL,
  getFifthMovePresentation,
  getTreeRerollPresentation,
  type TreeRerollStatus,
} from "./treePowerPresentation";

test("fifth move is inactive without an active battle", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: false,
    currentMoveCount: 4,
    eligibility: { status: "not-connected", sources: [] },
  });

  assert.equal(fifth.status, "inactive");
  assert.equal(fifth.handLabel, "Current Hand: - / 5");
  assert.match(fifth.description, /active battle/i);
});

test("active four-move hand remains locked without inferred qualification", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "not-qualified", sources: [] },
  });

  assert.equal(fifth.status, "not-qualified");
  assert.equal(fifth.statusLabel, "No Qualifying TREE Position");
  assert.equal(fifth.handLabel, "Current Hand: 4 / 5");
  assert.equal(fifth.filledSlots, 4);
  assert.match(fifth.description, /combined 1,000,000 TREE position/i);
  assert.doesNotMatch(fifth.description, /NFTree/i);
});

test("active five-move hand is shown as unlocked", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 5,
    eligibility: { status: "unavailable", sources: [] },
  });

  assert.equal(fifth.status, "active");
  assert.equal(fifth.statusLabel, "Unlocked");
  assert.equal(fifth.handLabel, "Current Hand: 5 / 5");
  assert.equal(fifth.isUnlocked, true);
});

test("NFTree access copy does not qualify the fifth move", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "not-qualified", sources: [] },
  });

  assert.match(fifth.explainer ?? "", /NFTree grants access to Garden Battles/i);
  assert.match(fifth.explainer ?? "", /SuiDex liquidity or Moonbags staking/i);
  assert.equal(fifth.isUnlocked, false);
});

test("large liquid TREE balance does not change fifth-move qualification", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "not-qualified", sources: [] },
  });

  assert.equal(fifth.status, "not-qualified");
  assert.equal(fifth.handLabel, "Current Hand: 4 / 5");
  assert.equal(fifth.isUnlocked, false);
});

test("qualified SuiDex positions can render future unlocked source labels", () => {
  const v2 = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "qualified", sources: ["suidex-v2"] },
    isFifthMoveActivationLive: true,
  });
  const v3 = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "qualified", sources: ["suidex-v3"] },
    isFifthMoveActivationLive: true,
  });
  const both = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "qualified", sources: ["suidex-v2", "suidex-v3", "moonbags-staking"] },
    isFifthMoveActivationLive: true,
  });

  assert.equal(v2.statusLabel, "Unlocked via SuiDex V2");
  assert.equal(v3.statusLabel, "Unlocked via SuiDex V3");
  assert.equal(both.statusLabel, "Unlocked via Multiple TREE Positions");
  assert.equal(both.filledSlots, 5);
});

test("Moonbags TREE stake can render future unlocked source label", () => {
  const moonbags = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "qualified", sources: ["moonbags-staking"] },
    isFifthMoveActivationLive: true,
  });

  assert.equal(moonbags.statusLabel, "Unlocked via Moonbags Staking");
  assert.equal(moonbags.filledSlots, 5);
});

test("qualified position does not create a fake fifth move before activation", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "qualified", sources: ["moonbags-staking"] },
  });

  assert.equal(fifth.status, "qualified-not-live");
  assert.equal(fifth.statusLabel, "Position Qualified");
  assert.equal(fifth.handLabel, "Current Hand: 4 / 5");
  assert.equal(fifth.filledSlots, 4);
  assert.equal(fifth.isUnlocked, false);
  assert.match(fifth.description, /Activation Not Live Yet/i);
});

test("RPC failure is unavailable, not not-qualified", () => {
  const fifth = getFifthMovePresentation({
    isBattleActive: true,
    currentMoveCount: 4,
    eligibility: { status: "unavailable", sources: [] },
  });

  assert.equal(fifth.status, "unavailable");
  assert.equal(fifth.statusLabel, "Position Verification Unavailable");
  assert.match(fifth.description, /temporarily unavailable/i);
});

test("practice mode disables TREE payment utilities", () => {
  const reroll = getTreeRerollPresentation({
    isPracticeBattle: true,
    rerollStatus: "available",
    rerollCostTree: 100,
  });

  assert.equal(reroll.status, "mode-excluded");
  assert.equal(reroll.disabled, true);
  assert.equal(reroll.buttonLabel, "Not Used in Practice");
  assert.match(reroll.helperText, /live paid-PvP feature/i);
});

test("reroll design state is not live without a configured cost", () => {
  const reroll = getTreeRerollPresentation({
    isPracticeBattle: false,
    rerollStatus: "not-live",
    rerollCostTree: null,
  });

  assert.equal(reroll.statusLabel, "Not Live");
  assert.equal(reroll.costLabel, "Cost not configured");
  assert.equal(reroll.buttonLabel, "TREE Reroll Not Active");
  assert.equal(reroll.disabled, true);
});

test("all reroll states return deterministic presentation", () => {
  const states: TreeRerollStatus[] = [
    "unavailable",
    "available-in-pvp",
    "waiting-turn",
    "mode-excluded",
    "available",
    "insufficient-tree",
    "awaiting-approval",
    "submitted",
    "used",
    "not-live",
  ];

  for (const status of states) {
    const reroll = getTreeRerollPresentation({
      isPracticeBattle: false,
      rerollStatus: status,
      rerollCostTree: 25,
    });
    assert.equal(reroll.status, status);
    assert.ok(reroll.buttonLabel.length > 0);
    assert.ok(reroll.helperText.length > 0);
  }
});

test("reroll is advertised as live when no paid PvP match is active", () => {
  const reroll = getTreeRerollPresentation({
    isPracticeBattle: false,
    rerollStatus: "available-in-pvp",
    rerollCostTree: 20_000,
  });

  assert.equal(reroll.statusLabel, "Live in Paid PvP");
  assert.equal(reroll.costLabel, "20,000 TREE");
  assert.doesNotMatch(`${reroll.statusLabel} ${reroll.buttonLabel}`, /unavailable/i);
  assert.match(reroll.helperText, /replace your entire hand once/i);
});

test("Buy TREE URL opens the TREE Command Center swap", () => {
  assert.equal(TREE_POWER_BUY_URL, "https://www.tree-token.xyz/dapp/#swap");
});

test("presentation copy avoids removed utility placeholders", () => {
  const combined = [
    getTreeRerollPresentation({ isPracticeBattle: false }).helperText,
    getTreeRerollPresentation({ isPracticeBattle: false }).buttonLabel,
    getFifthMovePresentation({
      isBattleActive: true,
      currentMoveCount: 4,
      eligibility: { status: "not-qualified", sources: [] },
    }).description,
  ].join(" ");

  assert.doesNotMatch(combined, /Canopy Clash/i);
  assert.doesNotMatch(combined, /Move Swap/i);
  assert.doesNotMatch(combined, /NFTree or qualifying ecosystem position/i);
});
