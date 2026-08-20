import { getPvpMatchDisplayLabel, type PvpMatchOption } from "./sui-config";
import type { ParsedPvpQueueState } from "./pvpQueueState";

export const PVP_JOIN_SYNCING_MESSAGE =
  "Queue transaction submitted. Network confirmation is still syncing. Checking your on-chain queue status.";

export type PvpJoinTransactionStatus =
  | { status: "success" }
  | { status: "failed"; error: string };

export type PvpJoinRecoveryOutcome =
  | { status: "failed"; error: string }
  | { status: "waiting"; queueState: ParsedPvpQueueState }
  | { status: "active-battle" }
  | { status: "syncing"; digest: string; message: string };

export function readErrorStatus(error: any): number | undefined {
  const status =
    error?.status ??
    error?.response?.status ??
    error?.cause?.status ??
    error?.cause?.response?.status;
  return Number.isFinite(Number(status)) ? Number(status) : undefined;
}

export function isTransientPvpJoinConfirmationError(error: any): boolean {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "");
  const status = readErrorStatus(error);

  if (status === 429 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  return /aborterror|timeouterror/i.test(name) ||
    /signal timed out|timeout|timed out|failed to fetch|fetch failed|network|transport|rate-?limit|too many requests|temporarily unavailable|bad gateway|service unavailable|gateway timeout/i.test(
      message,
    );
}

export function classifyPvpJoinTransactionStatus(
  tx: any,
): PvpJoinTransactionStatus {
  const status = tx?.effects?.status?.status;
  if (status && status !== "success") {
    return {
      status: "failed",
      error: String(tx?.effects?.status?.error ?? `Transaction status: ${status}`),
    };
  }
  return { status: "success" };
}

export function buildSubmittedPvpJoinQueueState(input: {
  address: string;
  entryFeeMist: number;
  option: PvpMatchOption;
}): ParsedPvpQueueState {
  return {
    queueId: input.option.queueId,
    player: input.address.toLowerCase(),
    entryFeeMist: input.entryFeeMist,
    targetGrowth: input.option.targetGrowth,
    matchLabel: getPvpMatchDisplayLabel(input.option.targetGrowth),
    queueType: input.option.queueType,
  };
}

export function resolvePvpJoinRecoveryOutcome(input: {
  digest: string;
  transactionStatus?: PvpJoinTransactionStatus | null;
  queueState?: ParsedPvpQueueState | null;
  activeBattleFound?: boolean;
}): PvpJoinRecoveryOutcome {
  if (input.transactionStatus?.status === "failed") {
    return {
      status: "failed",
      error: input.transactionStatus.error,
    };
  }

  if (input.queueState) {
    return {
      status: "waiting",
      queueState: input.queueState,
    };
  }

  if (input.activeBattleFound) {
    return { status: "active-battle" };
  }

  return {
    status: "syncing",
    digest: input.digest,
    message: PVP_JOIN_SYNCING_MESSAGE,
  };
}
