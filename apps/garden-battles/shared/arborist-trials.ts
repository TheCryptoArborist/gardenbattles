export const ARBORIST_TRIAL_TARGET_GROWTH = 50;
export const ARBORIST_TRIAL_VERSION = 1;

export type ArboristTrialChallenge = {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  description: string;
  seed: number;
  targetGrowth: number;
  playerStartGrowth: number;
  botStartGrowth: number;
  expiresAt: number;
};

export type ArboristTrialResultInput = {
  won: boolean;
  rounds: number;
  playerGrowth: number;
  botGrowth: number;
  uniqueMoves: number;
};

const TRIAL_VARIANTS = [
  {
    title: "Root Rush",
    subtitle: "Race the clock",
    description: "Both trees start even. Win efficiently and use a varied hand to maximize your daily score.",
    playerStartGrowth: 0,
    botStartGrowth: 0,
  },
  {
    title: "Comeback Canopy",
    subtitle: "Overcome the head start",
    description: "Garden Bot begins ahead. Counter carefully, recover the gap, and take the canopy.",
    playerStartGrowth: 0,
    botStartGrowth: 8,
  },
  {
    title: "Crown Race",
    subtitle: "Every card matters",
    description: "Both trees begin established. The shorter runway rewards counters, timing, and card variety.",
    playerStartGrowth: 10,
    botStartGrowth: 10,
  },
] as const;

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getArboristTrialDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getArboristTrialChallenge(now = new Date()): ArboristTrialChallenge {
  const date = getArboristTrialDate(now);
  const seed = hashText(`garden-battles:arborist-trials:v${ARBORIST_TRIAL_VERSION}:${date}`);
  const variant = TRIAL_VARIANTS[seed % TRIAL_VARIANTS.length];
  const expiresAt = Date.parse(`${date}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return {
    id: `arborist-trial-v${ARBORIST_TRIAL_VERSION}-${date}`,
    date,
    seed,
    targetGrowth: ARBORIST_TRIAL_TARGET_GROWTH,
    expiresAt,
    ...variant,
  };
}

export function calculateArboristTrialScore(result: ArboristTrialResultInput): number {
  const rounds = Math.max(1, Math.min(100, Math.round(result.rounds)));
  const playerGrowth = Math.max(0, Math.min(100, Math.round(result.playerGrowth)));
  const botGrowth = Math.max(0, Math.min(100, Math.round(result.botGrowth)));
  const uniqueMoves = Math.max(0, Math.min(5, Math.round(result.uniqueMoves)));
  const victory = result.won ? 10_000 : 0;
  const efficiency = result.won ? Math.max(0, 30 - rounds) * 200 : 0;
  const margin = result.won
    ? Math.max(0, playerGrowth - botGrowth) * 25
    : playerGrowth * 10;
  const variety = uniqueMoves * 100;
  return victory + efficiency + margin + variety;
}
