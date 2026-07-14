import {
  getPvpMatchDisplayLabel,
  type PvpMatchOption,
  type PvpMatchTarget,
} from "./sui-config";

export interface ParsedPvpQueueState {
  queueId: string;
  player: string;
  entryFeeMist: number;
  targetGrowth: PvpMatchTarget;
  matchLabel: string;
  queueType: "legacy" | "v2";
}

export function getPvpQueueCancelFunctionName(queueType: "legacy" | "v2") {
  return queueType === "v2" ? "cancel_queue_v2" : "cancel_queue";
}

export type PvpRefundLifecycleOutcome =
  | "success"
  | "failed"
  | "wallet-rejected";

export interface PvpQueueUiRecoveryState {
  localPvpQueued: boolean;
  recoveredQueueState: ParsedPvpQueueState | null;
  activationKey: string | null;
  recoveryWallet: string | null;
}

export function resolvePvpQueueUiAfterRefund(
  state: PvpQueueUiRecoveryState,
  outcome: PvpRefundLifecycleOutcome,
): PvpQueueUiRecoveryState {
  if (outcome !== "success") return state;

  return {
    localPvpQueued: false,
    recoveredQueueState: null,
    activationKey: null,
    recoveryWallet: null,
  };
}

function readMoveOptionVec(value: any): any[] {
  const vec =
    value?.fields?.vec ??
    value?.vec ??
    value?.fields?.value?.fields?.vec ??
    value?.value?.fields?.vec;
  return Array.isArray(vec) ? vec : [];
}

export function readPendingQueueEntry(value: any): any | null {
  if (!value) return null;

  const optionEntry = readMoveOptionVec(value)[0];
  if (optionEntry) return optionEntry;

  if (value?.fields?.player || value?.player) return value;

  return null;
}

function readObjectTargetGrowth(value: any): number | undefined {
  const targetGrowth = Number(value);
  return Number.isFinite(targetGrowth) && targetGrowth > 0
    ? targetGrowth
    : undefined;
}

export function parsePvpQueueStateFromObject(
  obj: any,
  address: string,
  option: PvpMatchOption,
): ParsedPvpQueueState | null {
  const fields = obj?.data?.content?.fields;
  const pending = readPendingQueueEntry(fields?.waiting);
  const pendingFields = pending?.fields ?? pending;
  const player =
    typeof pendingFields?.player === "string"
      ? pendingFields.player.toLowerCase()
      : null;

  if (!player || player !== address.toLowerCase()) return null;

  const entryFeeMist = Number(pendingFields?.entry_fee_snapshot ?? 0);
  if (!Number.isFinite(entryFeeMist) || entryFeeMist < 0) return null;

  const objectTargetGrowth = readObjectTargetGrowth(fields?.target_growth);
  if (
    option.queueType === "v2" &&
    objectTargetGrowth &&
    objectTargetGrowth !== option.targetGrowth
  ) {
    console.warn("[pvp-queue] configured queue target mismatch", {
      queueId: option.queueId,
      configuredTargetGrowth: option.targetGrowth,
      objectTargetGrowth,
    });
    return null;
  }

  return {
    queueId: option.queueId,
    player,
    entryFeeMist,
    targetGrowth:
      option.queueType === "v2" && objectTargetGrowth
        ? (objectTargetGrowth as PvpMatchTarget)
        : option.targetGrowth,
    matchLabel: getPvpMatchDisplayLabel(option.targetGrowth),
    queueType: option.queueType,
  };
}
