export type GrowthStage = 1 | 2 | 3 | 4;

const PLAYER_STAGE_ASSETS: Record<GrowthStage, string> = {
  1: "assets/battle-trees/player-stage-1.png",
  2: "assets/battle-trees/player-stage-2.png",
  3: "assets/battle-trees/player-stage-3.png",
  4: "assets/battle-trees/player-stage-4.png",
};

const GARDEN_BOT_STAGE_ASSETS: Record<GrowthStage, string> = {
  1: "assets/battle-trees/garden-bot-stage-1.png",
  2: "assets/battle-trees/garden-bot-stage-2.png",
  3: "assets/battle-trees/garden-bot-stage-3.png",
  4: "assets/battle-trees/garden-bot-stage-4.png",
};

export function resolveGrowthStage(
  growth: number,
  growthTarget = 100,
): GrowthStage {
  const progress =
    growthTarget > 0 ? Math.max(0, Math.min(1, growth / growthTarget)) : 0;

  if (progress < 0.25) return 1;
  if (progress < 0.5) return 2;
  if (progress < 0.75) return 3;
  return 4;
}

export function getBattleTreeAssetPath(
  stage: GrowthStage,
  isGardenBot: boolean,
): string {
  return isGardenBot
    ? GARDEN_BOT_STAGE_ASSETS[stage]
    : PLAYER_STAGE_ASSETS[stage];
}
