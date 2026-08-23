import assert from "node:assert/strict";
import test from "node:test";
import {
  getBattleTreeAssetPath,
  resolveGrowthStage,
} from "./battleTreeArtwork";

test("growth stages scale consistently for 50 and 75 Growth matches", () => {
  assert.equal(resolveGrowthStage(0, 50), 1);
  assert.equal(resolveGrowthStage(12, 50), 1);
  assert.equal(resolveGrowthStage(13, 50), 2);
  assert.equal(resolveGrowthStage(25, 50), 3);
  assert.equal(resolveGrowthStage(38, 50), 4);

  assert.equal(resolveGrowthStage(0, 75), 1);
  assert.equal(resolveGrowthStage(18, 75), 1);
  assert.equal(resolveGrowthStage(19, 75), 2);
  assert.equal(resolveGrowthStage(38, 75), 3);
  assert.equal(resolveGrowthStage(57, 75), 4);
});

test("player and Garden Bot stages use distinct artwork families", () => {
  for (const stage of [1, 2, 3, 4] as const) {
    assert.equal(
      getBattleTreeAssetPath(stage, false),
      `assets/battle-trees/player-stage-${stage}.png`,
    );
    assert.equal(
      getBattleTreeAssetPath(stage, true),
      `assets/battle-trees/garden-bot-stage-${stage}.png`,
    );
  }
});
