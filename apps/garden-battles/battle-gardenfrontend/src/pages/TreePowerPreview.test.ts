import assert from "node:assert/strict";
import test from "node:test";
import { TREE_POWER_PREVIEW_SCENARIOS } from "./TreePowerPreview";

test("Tree Power preview contains the corrected Fifth Move scenarios", () => {
  const scenarioTitles = TREE_POWER_PREVIEW_SCENARIOS.map((scenario) => scenario.title);

  assert.deepEqual(
    [
      "Wallet disconnected",
      "Position verification loading",
      "No qualifying position",
      "Qualified via SuiDex V2",
      "Qualified via SuiDex V3",
      "Moonbags TREE stake only",
      "V2 + Moonbags",
      "V3 + Moonbags",
      "V2 + V3 + Moonbags",
      "Moonbags stake verification unavailable",
      "Zero Moonbags stake",
      "Unrelated Moonbags token stake",
      "Qualified position, activation not live",
      "Active five-move hand",
      "Large liquid TREE, no position",
    ].every((title) => scenarioTitles.includes(title)),
    true,
  );
});

test("Tree Power preview does not say NFTree unlocks the fifth move", () => {
  const combinedCopy = TREE_POWER_PREVIEW_SCENARIOS.map((scenario) => scenario.note).join(" ");

  assert.doesNotMatch(combinedCopy, /NFTree.*unlock/i);
  assert.doesNotMatch(combinedCopy, /NFTree or qualifying ecosystem position/i);
});
