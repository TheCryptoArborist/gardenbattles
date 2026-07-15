import type { ParsedPvpQueueState } from "./pvpQueueState";

export function shouldSuppressQueueRecovery(params: {
  isConnected: boolean;
  address: string | null;
  hasActiveBattle: boolean;
}): boolean {
  return !params.isConnected || !params.address || params.hasActiveBattle;
}

export function getQueueClearTransitionKey(
  wallet: string,
  queueState: ParsedPvpQueueState,
): string {
  return [
    wallet.toLowerCase(),
    queueState.queueId.toLowerCase(),
    queueState.targetGrowth,
    queueState.entryFeeMist,
    queueState.queueType,
  ].join(":");
}

export function shouldRunQueueClearDiscovery(params: {
  previousQueueState: ParsedPvpQueueState | null;
  hasActiveBattle: boolean;
  inFlight: boolean;
  lastDiscoveryKey: string | null;
  wallet: string;
}): { shouldRun: boolean; key: string | null } {
  if (
    !params.previousQueueState ||
    params.hasActiveBattle ||
    params.inFlight
  ) {
    return { shouldRun: false, key: null };
  }

  const key = getQueueClearTransitionKey(
    params.wallet,
    params.previousQueueState,
  );
  return {
    shouldRun: key !== params.lastDiscoveryKey,
    key,
  };
}

export function resolvePvpHydrationMode(params: {
  currentBattleId?: string | null;
  nextBattleId?: string | null;
  hasCurrentActiveBattle: boolean;
}): "initialize" | "apply-update" | "ignore" {
  if (!params.nextBattleId) return "ignore";
  if (!params.hasCurrentActiveBattle || !params.currentBattleId) {
    return "initialize";
  }
  return params.currentBattleId.toLowerCase() ===
    params.nextBattleId.toLowerCase()
    ? "apply-update"
    : "initialize";
}
