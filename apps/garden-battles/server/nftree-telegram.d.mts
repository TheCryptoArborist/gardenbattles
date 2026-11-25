import type { getArboristTrialCompletions } from "./battle-storage";

export function startNftreeTelegramNotifier(options?: {
  listTrials?: typeof getArboristTrialCompletions;
}): void;
