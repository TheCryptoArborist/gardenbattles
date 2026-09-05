import assert from "node:assert/strict";
import test from "node:test";
import { TREE_POWER_PREVIEW_SCENARIOS } from "./TreePowerPreview";

test("Tree Power preview contains the corrected Fifth Move scenarios", () => {
  const scenarioTitles = TREE_POWER_PREVIEW_SCENARIOS.map((scenario) => scenario.title);

  assert.deepEqual(
    [
      "Wallet disconnected",
      "Position verification loading",
      "0 TREE verified",
      "999,999 TREE",
      "Exactly 1,000,000 TREE",
      "1,000,001 TREE",
      "400K V2 + 300K V3 + 1M TREE Lock",
      "600K V2, TREE Lock unavailable",
      "1.1M V2, TREE Lock unavailable",
      "All providers unavailable",
      "Qualified via SuiDex V2",
      "Qualified via SuiDex V3",
      "30-Day TREE Lock only",
      "V2 + TREE Lock",
      "V3 + TREE Lock",
      "V2 + V3 + TREE Lock",
      "TREE Lock verification unavailable",
      "No active TREE Lock",
      "Unrelated token lock",
      "Qualified position, activation not live",
      "Active five-move hand",
      "Large liquid TREE, no position",
      "NFTree owned, zero qualifying position",
    ].every((title) => scenarioTitles.includes(title)),
    true,
  );
});

test("Tree Power preview does not say NFTree unlocks the fifth move", () => {
  const combinedCopy = TREE_POWER_PREVIEW_SCENARIOS.map((scenario) => scenario.note).join(" ");

  assert.doesNotMatch(combinedCopy, /NFTree.*unlock/i);
  assert.doesNotMatch(combinedCopy, /NFTree or qualifying ecosystem position/i);
});
