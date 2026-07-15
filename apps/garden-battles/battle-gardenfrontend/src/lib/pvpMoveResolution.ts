import { MOVE_LABELS } from "./sui-config";
import {
  readSuiTransactionBlockWithRetry,
  type SuiTransactionBlockResponse,
} from "./suiRpc";

export type PvpMoveResolutionSource = "local" | "transaction" | "unavailable";

export interface PvpMoveResolution {
  moveId: number | null;
  source: PvpMoveResolutionSource;
  label?: string;
  failureCategory?: string;
}

const SUPPORTED_PVP_MOVE_FUNCTIONS = new Set([
  "use_ability_id_pvp_v2",
  "use_ability_id",
  "use_ability_id_v2",
]);

const MAX_CACHE_ENTRIES = 80;
const transactionResolutionCache = new Map<string, PvpMoveResolution>();

function normalizeId(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function readPathCandidates(value: any, keys: string[]): any {
  let current = value;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function getProgrammableTransaction(tx: SuiTransactionBlockResponse): any {
  return (
    readPathCandidates(tx, ["transaction", "data", "transaction"]) ??
    readPathCandidates(tx, ["data", "transaction"]) ??
    readPathCandidates(tx, ["transaction"]) ??
    tx
  );
}

function getInputs(tx: SuiTransactionBlockResponse): any[] {
  const programmable = getProgrammableTransaction(tx);
  const inputs =
    programmable?.inputs ??
    programmable?.ProgrammableTransaction?.inputs ??
    programmable?.kind?.inputs ??
    [];
  return Array.isArray(inputs) ? inputs : [];
}

function getCommands(tx: SuiTransactionBlockResponse): any[] {
  const programmable = getProgrammableTransaction(tx);
  const commands =
    programmable?.transactions ??
    programmable?.commands ??
    programmable?.ProgrammableTransaction?.transactions ??
    programmable?.ProgrammableTransaction?.commands ??
    [];
  return Array.isArray(commands) ? commands : [];
}

function normalizeMoveCall(command: any): any | null {
  return (
    command?.MoveCall ??
    command?.moveCall ??
    command?.command?.MoveCall ??
    command?.command?.moveCall ??
    (command?.$kind === "MoveCall" ? command.MoveCall : null) ??
    (command?.kind === "MoveCall" ? command : null)
  );
}

function readFunctionName(moveCall: any): string {
  if (typeof moveCall?.function === "string") return moveCall.function;
  if (typeof moveCall?.functionName === "string") return moveCall.functionName;
  if (typeof moveCall?.target === "string") {
    return moveCall.target.split("::").pop() ?? "";
  }
  return "";
}

function readModuleName(moveCall: any): string {
  if (typeof moveCall?.module === "string") return moveCall.module;
  if (typeof moveCall?.target === "string") {
    return moveCall.target.split("::").at(-2) ?? "";
  }
  return "";
}

function readCommandArgs(moveCall: any): any[] {
  const args = moveCall?.arguments ?? moveCall?.args ?? [];
  return Array.isArray(args) ? args : [];
}

function resolveInputReference(argument: any, inputs: any[]): any {
  const inputIndex =
    typeof argument?.Input === "number"
      ? argument.Input
      : typeof argument?.input === "number"
        ? argument.input
        : argument?.$kind === "Input" && typeof argument?.Input === "number"
          ? argument.Input
          : undefined;

  return inputIndex === undefined ? argument : inputs[inputIndex];
}

function findObjectId(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  if (typeof value.objectId === "string") return value.objectId;
  if (typeof value.id === "string") return value.id;
  if (typeof value.Object === "string") return value.Object;
  if (typeof value.object === "string") return value.object;

  for (const nested of [
    value.Object,
    value.object,
    value.ImmOrOwnedObject,
    value.SharedObject,
    value.Receiving,
    value.value,
  ]) {
    const found = findObjectId(nested);
    if (found) return found;
  }

  return null;
}

function parsePureU8(value: any): number | null {
  const raw =
    value?.value ??
    value?.Pure ??
    value?.pure ??
    value?.fields?.value ??
    value;

  const moveId =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && raw.trim()
        ? Number(raw)
        : Array.isArray(raw) && raw.length === 1
          ? Number(raw[0])
          : NaN;

  return Number.isInteger(moveId) && moveId > 0 && moveId <= 255
    ? moveId
    : null;
}

export function resolvePvpMoveFromTransactionBlock(
  tx: SuiTransactionBlockResponse,
  battleId: string,
): PvpMoveResolution {
  const inputs = getInputs(tx);
  const commands = getCommands(tx);
  const normalizedBattleId = normalizeId(battleId);

  for (const command of commands) {
    const moveCall = normalizeMoveCall(command);
    if (!moveCall) continue;

    const moduleName = readModuleName(moveCall);
    const functionName = readFunctionName(moveCall);
    if (
      moduleName !== "battle" ||
      !SUPPORTED_PVP_MOVE_FUNCTIONS.has(functionName)
    ) {
      continue;
    }

    const args = readCommandArgs(moveCall);
    const battleArg = resolveInputReference(args[0], inputs);
    const argBattleId = findObjectId(battleArg);
    if (normalizeId(argBattleId) !== normalizedBattleId) {
      return {
        moveId: null,
        source: "unavailable",
        failureCategory: "wrong-battle-object",
      };
    }

    const moveArg = resolveInputReference(args[1], inputs);
    const moveId = parsePureU8(moveArg);
    if (!moveId) {
      return {
        moveId: null,
        source: "unavailable",
        failureCategory: "malformed-move-id",
      };
    }

    const label = MOVE_LABELS[moveId];
    if (!label) {
      return {
        moveId: null,
        source: "unavailable",
        failureCategory: "unknown-move-id",
      };
    }

    return {
      moveId,
      source: "transaction",
      label,
    };
  }

  return {
    moveId: null,
    source: "unavailable",
    failureCategory: "unsupported-transaction",
  };
}

function rememberResolution(digest: string, resolution: PvpMoveResolution) {
  transactionResolutionCache.set(digest, resolution);
  while (transactionResolutionCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = transactionResolutionCache.keys().next().value;
    if (!firstKey) break;
    transactionResolutionCache.delete(firstKey);
  }
}

export function clearPvpMoveResolutionCacheForTests() {
  transactionResolutionCache.clear();
}

export async function resolvePvpMoveFromTransactionDigest(
  digest: string | null | undefined,
  battleId: string | null | undefined,
): Promise<PvpMoveResolution> {
  if (!digest || !battleId) {
    return {
      moveId: null,
      source: "unavailable",
      failureCategory: "missing-digest-or-battle",
    };
  }

  const cached = transactionResolutionCache.get(digest);
  if (cached) return cached;

  try {
    const tx = await readSuiTransactionBlockWithRetry(digest, {
      operation: "pvp-move-resolution",
      requestOptions: {
        showInput: true,
        showEffects: false,
        showEvents: false,
        showObjectChanges: false,
        showBalanceChanges: false,
      },
    });
    const resolution = resolvePvpMoveFromTransactionBlock(tx, battleId);
    rememberResolution(digest, resolution);
    return resolution;
  } catch (err) {
    const resolution: PvpMoveResolution = {
      moveId: null,
      source: "unavailable",
      failureCategory: "transaction-read-failed",
    };
    rememberResolution(digest, resolution);
    console.warn("[pvp-move-resolution] transaction read failed", {
      battleId,
      digest,
      failureCategory: resolution.failureCategory,
      error: err,
    });
    return resolution;
  }
}
