/**
 * useSuiWallet – battle state is driven directly from Sui RPC.
 *
 * Flow:
 *  1. Sui events are used to discover the current battle id
 *  2. The shared Battle object is read for canonical turn/growth/winner state
 *  3. Post-transaction refresh plus interval polling keep both players in sync
 *  4. localStorage cache restores the active battle after page refresh
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import {
  MOVE_LABELS,
  MOVE_META,
  SUI_CONFIG,
  getConfiguredPvpQueueOptions,
  getBattleUpdateEvent,
  getBotMoveResolvedEvent,
  getPvpBattleV2UpdateEvent,
  getPvpMatchDisplayLabel,
  getPvpMatchOption,
  type PvpBattleVersion,
  type PvpMatchOption,
  type PvpMatchTarget,
} from "@/lib/sui-config";
import { submitBattleRecord } from "@/lib/api";
import type { ActionEntry } from "@/components/BattleLog";
import {
  getPvpQueueCancelFunctionName,
  parsePvpQueueStateFromObject,
} from "@/lib/pvpQueueState";
import { readSuiObjectWithRetry, SuiRpcReadError } from "@/lib/suiRpc";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleState {
  battleId: string | null;
  player1: string | null;
  player2: string | null;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  turn: number;
  winner: string | null;
  finished?: boolean;
  isBotBattle?: boolean;
  lastMoveMs?: number;
  battleVersion?: PvpBattleVersion;
  targetGrowth?: number;
  matchLabel?: string;
}

export interface NftData {
  nftId: string;
  nftType: string;
  location: "wallet" | "kiosk";
  kioskId?: string;
  kioskCapId?: string;
  imageUrl?: string;
}

export interface PvpQueueState {
  queueId: string;
  player: string;
  entryFeeMist: number;
  targetGrowth: PvpMatchTarget;
  matchLabel: string;
  queueType: "legacy" | "v2";
}

export type MoveLifecycleStage =
  | "idle"
  | "awaiting-wallet-approval"
  | "transaction-submitted"
  | "transaction-confirmed"
  | "battle-refresh-running"
  | "battle-refresh-failed"
  | "leaderboard-sync-failed";

export interface RecoverableBattleError {
  title: string;
  body: string;
  detail?: string;
  digest?: string;
}

type BotStartStatus =
  | "wallet-request-opened"
  | "transaction-digest-received"
  | "battle-state-loaded";

interface StartBotBattleOptions {
  onStatus?: (status: BotStartStatus, details?: { digest?: string }) => void;
}

interface CancelQueueOptions {
  onWalletApprovalRequested?: (queueState: PvpQueueState) => void;
}

export interface CancelQueueResult {
  digest?: string;
  queueState: PvpQueueState;
  verificationNotice?: string;
}

interface SuiWalletContextType {
  address: string | null;
  isConnected: boolean;
  battleState: BattleState | null;
  isWaiting: boolean;
  pvpQueueState: PvpQueueState | null;
  entryFeeMist: number;
  isMyTurn: boolean;
  actionLog: ActionEntry[];
  clearActionLog: () => void;
  joinBattle: (nftData: NftData, targetGrowth?: PvpMatchTarget) => Promise<void>;
  startBotBattle: (
    nftData: NftData,
    options?: StartBotBattleOptions,
  ) => Promise<void>;
  useAbility: (abilityId: number) => Promise<void>;
  claimTimeoutWin: () => Promise<void>;
  forfeitBattle: () => Promise<void>;
  adminForceClose: (winner?: string) => Promise<void>;
  cancelQueue: (options?: CancelQueueOptions) => Promise<CancelQueueResult>;
  refreshPvpQueueState: () => Promise<PvpQueueState | null>;
  refreshActivePvpBattle: (reason?: string) => Promise<BattleState | null>;
  refreshCurrentBattleState: (reason?: string) => Promise<BattleState | null>;
  moveLifecycleStage: MoveLifecycleStage;
  isMoveTransactionPending: boolean;
  isBattleRefreshPending: boolean;
  recoverableBattleError: RecoverableBattleError | null;
  dismissRecoverableBattleError: () => void;
  getFirstValidSaplingNft: (owner: string) => Promise<NftData | null>;
  ConnectWalletButton: () => JSX.Element;
}

const SuiWalletContext = createContext<SuiWalletContextType | null>(null);

const ACTIVE_BATTLE_STORAGE_PREFIX = "battle_garden_active_battle:";
const ACTIVE_BATTLE_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const BOT_START_TIMEOUT_MS = 120_000;

interface CachedBattleState {
  version: 1;
  cachedAt: number;
  state: BattleState;
}

interface BattleUpdateTransactionResult {
  state: BattleState | null;
  botMoveId: number | null;
}

const DEBUG_TX_TIMING = import.meta.env.VITE_DEBUG_TX_TIMING === "true";
const DEBUG_BATTLE_LOG = import.meta.env.VITE_DEBUG_BATTLE_LOG === "true";
const MOVE_NOT_SUBMITTED_MESSAGE =
  "Move was not submitted. Check your wallet connection and network, then try again.";
const TRANSACTION_CONFIRMATION_UNAVAILABLE_MESSAGE =
  "Transaction submitted, but confirmation could not be loaded. Check your wallet history before trying again.";
const BATTLE_REFRESH_FAILED_MESSAGE =
  "Move confirmed on-chain, but the battle state could not be refreshed.";
const LEADERBOARD_SYNC_FAILED_MESSAGE =
  "Move confirmed. Leaderboard sync will retry.";
const RECOVERABLE_BATTLE_ERROR_TITLE = "Battle refresh interrupted";
const RECOVERABLE_BATTLE_ERROR_BODY =
  "Your battle is still active. Refresh the on-chain state before making another move.";

function txTimingNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function txTimingLog(label: string, details: Record<string, unknown>) {
  if (DEBUG_TX_TIMING) {
    console.info("[tx-timing]", label, details);
  }
}

function logTxTiming(
  label: string,
  startedAt: number,
  details: Record<string, unknown> = {},
) {
  txTimingLog(label, {
    elapsedMs: Math.round(txTimingNow() - startedAt),
    ...details,
  });
}

function battleLogDebug(label: string, details: Record<string, unknown>) {
  if (DEBUG_BATTLE_LOG) {
    console.info("[battle-log]", label, details);
  }
}

function battleStorageKey(address: string): string {
  return `${ACTIVE_BATTLE_STORAGE_PREFIX}${address.toLowerCase()}`;
}

function isZeroAddress(address: string | null | undefined): boolean {
  return !address || address === "0x0";
}

function normalizeAddress(value: unknown): string | null {
  return typeof value === "string" && value ? value.toLowerCase() : null;
}

function isGardenBotAddress(value: unknown): boolean {
  return normalizeAddress(value) === SUI_CONFIG.BOT_ADDRESS.toLowerCase();
}

function readOnChainBool(value: any): boolean {
  return value === true || value === "true" || value?.fields?.value === true;
}

function inferIsBotBattle(
  explicitValue: any,
  player1: unknown,
  player2: unknown,
): boolean {
  return (
    readOnChainBool(explicitValue) ||
    isGardenBotAddress(player1) ||
    isGardenBotAddress(player2)
  );
}

function battleBelongsToAddress(
  state: BattleState | null,
  address: string | null,
): state is BattleState {
  if (!state || !state.battleId || !address) return false;

  const normalizedAddress = address.toLowerCase();
  return (
    state.player1?.toLowerCase() === normalizedAddress ||
    state.player2?.toLowerCase() === normalizedAddress
  );
}

function isActiveBattleForAddress(
  state: BattleState | null,
  address: string | null,
): state is BattleState {
  return (
    battleBelongsToAddress(state, address) && !state.winner && !state.finished
  );
}

function readTargetGrowth(value: any): number | undefined {
  const targetGrowth = Number(value);
  return Number.isFinite(targetGrowth) && targetGrowth > 0
    ? targetGrowth
    : undefined;
}

function resolveBattleTargetGrowth(state: Pick<BattleState, "isBotBattle" | "targetGrowth" | "battleVersion">): number {
  if (state.targetGrowth && Number.isFinite(state.targetGrowth)) {
    return state.targetGrowth;
  }

  if (state.isBotBattle) return 50;
  return state.battleVersion === "pvp-v2" ? 50 : 100;
}

function resolveBattleMatchLabel(state: Pick<BattleState, "isBotBattle" | "targetGrowth" | "battleVersion">): string {
  if (state.isBotBattle) return "Single Player Garden Bot";
  const targetGrowth = resolveBattleTargetGrowth(state);
  if (targetGrowth === 50) return "Quick Match";
  if (targetGrowth === 75) return "Standard Match";
  return "Legacy Match";
}

function isPvpBattleV2ObjectType(type: unknown): boolean {
  return typeof type === "string" && type.endsWith(`::${SUI_CONFIG.MODULE}::PvpBattleV2`);
}

function isLegacyBattleObjectType(type: unknown): boolean {
  return typeof type === "string" && type.endsWith(`::${SUI_CONFIG.MODULE}::Battle`);
}

function isActivePvpBattleForAddress(
  state: BattleState | null,
  address: string | null,
): state is BattleState {
  return (
    isActiveBattleForAddress(state, address) &&
    !state.isBotBattle &&
    !isZeroAddress(state.player1) &&
    !isZeroAddress(state.player2)
  );
}

function normalizeWinner(value: any): string | null {
  if (!value || value === "0x0") return null;

  if (typeof value === "string") {
    return value.toLowerCase();
  }

  if (Array.isArray(value)) {
    return normalizeWinner(value[0]);
  }

  if (typeof value === "object") {
    return normalizeWinner(
      value.vec ?? value.fields?.vec ?? value.fields?.value ?? value.value,
    );
  }

  return null;
}

function readConfigEntryFeeMist(content: any): number | null {
  const rawFee = content?.fields?.entry_fee;
  const fee = Number(rawFee);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}

function parseBattleStateFromEvent(
  json: any,
  battleVersion: PvpBattleVersion = "legacy",
): BattleState | null {
  if (!json?.battle_id || !json?.player1 || !json?.player2) return null;

  const parsedTurn = Number(json.turn);
  const player1 = json.player1.toLowerCase();
  const player2 = json.player2.toLowerCase();
  const isBotBattle =
    battleVersion === "legacy"
      ? inferIsBotBattle(json.is_bot_battle, player1, player2)
      : false;
  const targetGrowth =
    battleVersion === "pvp-v2"
      ? readTargetGrowth(json.target_growth)
      : isBotBattle
        ? 50
        : 100;
  return {
    battleId: json.battle_id,
    player1,
    player2,
    player1Moves: json.player1_moves ?? [],
    player2Moves: json.player2_moves ?? [],
    player1Growth: Number(json.player1_growth ?? 0),
    player2Growth: Number(json.player2_growth ?? 0),
    turn: Number.isFinite(parsedTurn) ? parsedTurn : 0,
    winner: normalizeWinner(json.winner),
    finished: !!normalizeWinner(json.winner),
    isBotBattle,
    lastMoveMs: Number(json.last_move_ms ?? 0),
    battleVersion,
    targetGrowth,
    matchLabel: resolveBattleMatchLabel({
      isBotBattle,
      battleVersion,
      targetGrowth,
    }),
  };
}

function readCachedBattleState(address: string): BattleState | null {
  try {
    const cached = localStorage.getItem(battleStorageKey(address));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as BattleState | CachedBattleState;
    const state = "state" in parsed ? parsed.state : parsed;
    const cachedAt = "cachedAt" in parsed ? parsed.cachedAt : 0;
    if (cachedAt && Date.now() - cachedAt > ACTIVE_BATTLE_CACHE_MAX_AGE_MS) {
      localStorage.removeItem(battleStorageKey(address));
      return null;
    }

    return isActiveBattleForAddress(state, address) ? state : null;
  } catch {
    return null;
  }
}

function cacheBattleState(address: string, state: BattleState | null) {
  try {
    const key = battleStorageKey(address);
    if (isActiveBattleForAddress(state, address)) {
      localStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          cachedAt: Date.now(),
          state,
        } satisfies CachedBattleState),
      );
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage can be unavailable in private or embedded browser contexts.
  }
}

function normalizeMoveList(value: any): number[] {
  return Array.isArray(value) ? value.map((move) => Number(move)) : [];
}

function getLatestAddedMoveId(previousMoves: number[], nextMoves: number[]): number | null {
  const previous = previousMoves.filter((moveId) => Number.isFinite(moveId) && moveId > 0);
  const next = nextMoves.filter((moveId) => Number.isFinite(moveId) && moveId > 0);

  if (next.length > previous.length) {
    for (let index = previousMoves.length; index < nextMoves.length; index += 1) {
      const moveId = Number(nextMoves[index]);
      if (Number.isFinite(moveId) && moveId > 0) return moveId;
    }
  }

  for (let index = 0; index < Math.max(previousMoves.length, nextMoves.length); index += 1) {
    const previousMove = Number(previousMoves[index] ?? 0);
    const nextMove = Number(nextMoves[index] ?? 0);
    if (nextMove > 0 && previousMove !== nextMove) return nextMove;
  }

  const removedMoves = previous.filter((moveId) => !next.includes(moveId));
  return removedMoves.length === 1 ? removedMoves[0] : null;
}

function getBotMoves(state: BattleState): number[] {
  return isGardenBotAddress(state.player1) ? state.player1Moves : state.player2Moves;
}

function parsePositiveMoveId(value: unknown): number | null {
  const moveId =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;

  return Number.isFinite(moveId) && moveId > 0 ? moveId : null;
}

function resolveBotMoveId(
  previousState: BattleState,
  nextState: BattleState,
  explicitBotMoveId: number | null,
): number | null {
  if (explicitBotMoveId && Number.isFinite(explicitBotMoveId) && explicitBotMoveId > 0) {
    return explicitBotMoveId;
  }

  const derivedMoveId = getLatestAddedMoveId(
    getBotMoves(previousState),
    getBotMoves(nextState),
  );
  return derivedMoveId && Number.isFinite(derivedMoveId) && derivedMoveId > 0
    ? derivedMoveId
    : null;
}

function parseBattleStateFromObjectFields(
  battleId: string,
  fields: any,
  battleVersion: PvpBattleVersion = "legacy",
): BattleState | null {
  if (!fields?.player1 || !fields?.player2) return null;

  const player1 = String(fields.player1).toLowerCase();
  const player2 = String(fields.player2).toLowerCase();
  const isBotBattle =
    battleVersion === "legacy"
      ? inferIsBotBattle(fields.is_bot_battle, player1, player2)
      : false;
  const targetGrowth =
    battleVersion === "pvp-v2"
      ? readTargetGrowth(fields.target_growth)
      : isBotBattle
        ? 50
        : 100;
  return {
    battleId,
    player1,
    player2,
    player1Moves: normalizeMoveList(fields.p1_moves),
    player2Moves: normalizeMoveList(fields.p2_moves),
    player1Growth: Number(fields.p1_growth ?? 0),
    player2Growth: Number(fields.p2_growth ?? 0),
    turn: Number(fields.turn ?? 0),
    winner: normalizeWinner(fields.winner),
    finished: Boolean(fields.finished) || !!normalizeWinner(fields.winner),
    isBotBattle,
    lastMoveMs: Number(fields.last_move_ms ?? 0),
    battleVersion,
    targetGrowth,
    matchLabel: resolveBattleMatchLabel({
      isBotBattle,
      battleVersion,
      targetGrowth,
    }),
  };
}

async function getRefundablePvpQueueState(
  suiClient: any,
  address: string,
): Promise<PvpQueueState | null> {
  try {
    console.info("[pvp-queue] checking refundable queue state");
    for (const option of getConfiguredPvpQueueOptions()) {
      const state = await getPvpQueueStateForOption(
        suiClient,
        address,
        option,
        "pvp-queue-refund-read",
      );
      if (state) {
        console.info("[pvp-queue] found refundable battle/queue object", {
          queueId: state.queueId,
          entryFeeMist: state.entryFeeMist,
          targetGrowth: state.targetGrowth,
          queueType: state.queueType,
        });
        return state;
      }
    }
    console.info("[pvp-queue] no refundable queue found");
    return null;
  } catch (err) {
    console.warn("[pvp-queue] could not check refundable queue state", err);
    throw err;
  }
}

async function getPvpQueueStateForOption(
  suiClient: any,
  address: string,
  option: PvpMatchOption,
  operation: string,
): Promise<PvpQueueState | null> {
  const obj = await readSuiObjectWithRetry(
    suiClient,
    {
      id: option.queueId,
      options: { showContent: true },
    },
    {
      operation,
      queueId: option.queueId,
    },
  );
  if (!obj?.data?.content || !("fields" in (obj.data.content as any))) {
    throw new Error("Unexpected PvP queue data shape.");
  }
  return parsePvpQueueStateFromObject(obj, address, option);
}

async function getLiveBattleState(
  suiClient: any,
  battleId: string,
): Promise<BattleState | null | undefined> {
  try {
    const obj = await readSuiObjectWithRetry(
      suiClient,
      {
        id: battleId,
        options: { showContent: true },
      },
      {
        operation: "active-battle-read",
      },
    );
    const content = obj?.data?.content as any;
    const type = obj?.data?.type ?? content?.type;
    const fields = content?.fields;
    const battleVersion: PvpBattleVersion = isPvpBattleV2ObjectType(type)
      ? "pvp-v2"
      : "legacy";
    return parseBattleStateFromObjectFields(battleId, fields, battleVersion);
  } catch (err) {
    console.warn("[battle] could not verify live battle object:", err);
    return undefined;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

async function getBattleStateFromTransaction(
  suiClient: any,
  digest: string,
  address: string,
): Promise<BattleState | null> {
  const tx = await suiClient.waitForTransaction({
    digest,
    timeout: 45_000,
    pollInterval: 1_500,
    options: {
      showEvents: true,
      showObjectChanges: true,
    },
  });

  const eventState = tx.events
    ?.filter(
      (event: any) =>
        event.type === getBattleUpdateEvent() ||
        event.type === getPvpBattleV2UpdateEvent(),
    )
    .map((event: any) =>
      parseBattleStateFromEvent(
        event.parsedJson,
        event.type === getPvpBattleV2UpdateEvent() ? "pvp-v2" : "legacy",
      ),
    )
    .find((state: BattleState | null) =>
      isActiveBattleForAddress(state, address),
    );
  if (eventState) return eventState;

  const createdBattle = tx.objectChanges?.find(
    (change: any) =>
      change.type === "created" &&
      typeof change.objectType === "string" &&
      (isLegacyBattleObjectType(change.objectType) ||
        isPvpBattleV2ObjectType(change.objectType)) &&
      typeof change.objectId === "string",
  );

  if (createdBattle?.objectId) {
    const liveState = await getLiveBattleState(
      suiClient,
      createdBattle.objectId,
    );
    return isActiveBattleForAddress(liveState ?? null, address)
      ? (liveState as BattleState)
      : null;
  }

  return null;
}

async function findActivePvpBattleState(
  suiClient: any,
  address: string,
): Promise<BattleState | null> {
  console.info("[pvp-match] checking active battle", { address });
  const eventQueries = [
    { eventType: getPvpBattleV2UpdateEvent(), battleVersion: "pvp-v2" as const },
    { eventType: getBattleUpdateEvent(), battleVersion: "legacy" as const },
  ];

  for (const eventQuery of eventQueries) {
    const events = await suiClient.queryEvents({
      query: { MoveEventType: eventQuery.eventType },
      limit: 100,
      order: "descending",
    });

    for (const event of events.data ?? []) {
      const eventState = parseBattleStateFromEvent(
        event.parsedJson,
        eventQuery.battleVersion,
      );
      if (!battleBelongsToAddress(eventState, address)) continue;
      if (eventState?.isBotBattle) continue;

      const battleId = eventState.battleId;
      if (!battleId) continue;

      const liveState = await getLiveBattleState(suiClient, battleId);
      if (isActivePvpBattleForAddress(liveState ?? null, address)) {
        console.info("[pvp-match] active battle found", {
          battleId,
          battleVersion: liveState?.battleVersion,
          targetGrowth: liveState?.targetGrowth,
        });
        return liveState as BattleState;
      }
    }
  }

  console.info("[pvp-match] no active battle found");
  return null;
}

async function getBattleUpdateStateFromTransaction(
  suiClient: any,
  digest: string,
  address: string,
  expectedBattleId?: string | null,
  timingStartedAt?: number,
): Promise<BattleUpdateTransactionResult> {
  const waitStartedAt = txTimingNow();
  if (timingStartedAt !== undefined) {
    logTxTiming("waitForTransaction start", timingStartedAt, { digest });
  }
  const tx = await suiClient.waitForTransaction({
    digest,
    timeout: 45_000,
    pollInterval: 1_500,
    options: {
      showEvents: true,
    },
  });
  if (timingStartedAt !== undefined) {
    logTxTiming("waitForTransaction complete", timingStartedAt, {
      digest,
      waitMs: Math.round(txTimingNow() - waitStartedAt),
    });
  }

  const parseStartedAt = txTimingNow();
  const state =
    tx.events
      ?.filter(
        (event: any) =>
          event.type === getBattleUpdateEvent() ||
          event.type === getPvpBattleV2UpdateEvent(),
      )
      .map((event: any) =>
        parseBattleStateFromEvent(
          event.parsedJson,
          event.type === getPvpBattleV2UpdateEvent() ? "pvp-v2" : "legacy",
        ),
      )
      .find((state: BattleState | null) =>
        battleBelongsToAddress(state, address),
      ) ?? null;

  const targetBattleId = String(state?.battleId ?? expectedBattleId ?? "").toLowerCase();
  const botMoveEvent = tx.events
    ?.filter((event: any) => event.type === getBotMoveResolvedEvent())
    .map((event: any) => event.parsedJson)
    .find((json: any) => {
      if (!json || !targetBattleId) return false;
      const eventBattleId = String(json.battle_id ?? "").toLowerCase();
      return eventBattleId === targetBattleId;
    });

  const botMoveId = parsePositiveMoveId(botMoveEvent?.move_id);
  if (botMoveId !== null) {
    battleLogDebug("BotMoveResolved parsed", {
      battleId: String(botMoveEvent?.battle_id ?? state?.battleId ?? expectedBattleId ?? ""),
      moveId: botMoveId,
    });
  }
  if (timingStartedAt !== undefined) {
    logTxTiming("event parsing complete", timingStartedAt, {
      digest,
      parseMs: Math.round(txTimingNow() - parseStartedAt),
      hasBattleUpdate: !!state,
      botMoveId,
    });
  }

  return {
    state,
    botMoveId,
  };
}

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [pvpQueueState, setPvpQueueState] = useState<PvpQueueState | null>(null);
  const [entryFeeMist, setEntryFeeMist] = useState<number>(
    SUI_CONFIG.ENTRY_FEE,
  );
  const [randomObjectId, setRandomObjectId] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionEntry[]>([]);
  const [moveLifecycleStage, setMoveLifecycleStage] =
    useState<MoveLifecycleStage>("idle");
  const [isBattleRefreshPending, setIsBattleRefreshPending] = useState(false);
  const [recoverableBattleError, setRecoverableBattleError] =
    useState<RecoverableBattleError | null>(null);
  const prevBattleStateRef = useRef<BattleState | null>(null);
  const lastMoveIdRef = useRef<number>(0);
  const lastLoggedActionKeyRef = useRef<string | null>(null);
  const recentBattleDigestRef = useRef<string | null>(null);
  const submittedBattleDigestsRef = useRef<Set<string>>(new Set());
  const isWaitingRef = useRef(false);
  const refreshCurrentBattleInFlightRef = useRef(false);

  const address = currentAccount?.address ?? null;
  const isConnected = !!currentAccount;

  // Derived: is it currently this player's turn?
  const isMyTurn =
    !!battleState &&
    !!address &&
    !battleState.winner &&
    !battleState.finished &&
    ((battleState.player1?.toLowerCase() === address.toLowerCase() &&
      battleState.turn === 0) ||
      (battleState.player2?.toLowerCase() === address.toLowerCase() &&
        battleState.turn === 1));

  const isMoveTransactionPending =
    moveLifecycleStage === "awaiting-wallet-approval" ||
    moveLifecycleStage === "transaction-submitted" ||
    moveLifecycleStage === "transaction-confirmed";

  const dismissRecoverableBattleError = useCallback(() => {
    setRecoverableBattleError(null);
  }, []);

  const clearActionLog = useCallback(() => setActionLog([]), []);

  const hydrateActivePvpBattle = useCallback(
    (state: BattleState, reason: string): BattleState | null => {
      if (!address || !isActivePvpBattleForAddress(state, address)) {
        return null;
      }

      console.info("[pvp-match] battle hydrated", {
        battleId: state.battleId,
        reason,
      });
      setBattleState(state);
      prevBattleStateRef.current = state;
      setIsWaiting(false);
      setPvpQueueState(null);
      cacheBattleState(address, state);
      console.info("[pvp-match] stale queue state cleared", { reason });
      return state;
    },
    [address],
  );

  const refreshActivePvpBattle = useCallback(
    async (reason = "manual refresh"): Promise<BattleState | null> => {
      if (!address) return null;

      try {
        const state = await findActivePvpBattleState(suiClient, address);
        return state ? hydrateActivePvpBattle(state, reason) : null;
      } catch (err) {
        console.warn("[pvp-match] active battle check failed", err);
        return null;
      }
    },
    [address, hydrateActivePvpBattle, suiClient],
  );

  const showRecoverableBattleRefreshError = useCallback(
    (detail?: string, digest?: string) => {
      setRecoverableBattleError({
        title: RECOVERABLE_BATTLE_ERROR_TITLE,
        body: RECOVERABLE_BATTLE_ERROR_BODY,
        detail,
        digest,
      });
    },
    [],
  );

  const refreshPvpQueueState = useCallback(async () => {
    if (!address) {
      setPvpQueueState(null);
      setIsWaiting(false);
      return null;
    }

    if (isActivePvpBattleForAddress(battleState, address)) {
      setPvpQueueState(null);
      setIsWaiting(false);
      return null;
    }

    const queueState = await getRefundablePvpQueueState(suiClient, address);
    setPvpQueueState(queueState);
    setIsWaiting(!!queueState);
    if (queueState) {
      console.info("[pvp-queue] queue state restored after refresh", {
        queueId: queueState.queueId,
      });
    }
    return queueState;
  }, [address, battleState, suiClient]);

  const submitFinishedBattleDigest = useCallback((digest: string | null, reason: string) => {
    if (!digest) {
      console.log(`[leaderboard] submission skipped: no digest for ${reason}`);
      return;
    }

    if (submittedBattleDigestsRef.current.has(digest)) {
      console.log(`[leaderboard] submission skipped: duplicate digest for ${reason}`);
      return;
    }

    console.log(`[leaderboard] submitting battle digest ${digest} (${reason})`);
    submittedBattleDigestsRef.current.add(digest);
    const submitStartedAt = txTimingNow();
    logTxTiming("leaderboard submit queued", submitStartedAt, { digest, reason });

    submitBattleRecord(digest)
      .then((result) => {
        console.log("[leaderboard] submit result", result);
        logTxTiming("leaderboard submit complete", submitStartedAt, {
          digest,
          recorded: result?.recorded,
        });
      })
      .catch((err) => {
        console.warn("[leaderboard] battle record submission failed:", err);
        console.warn("[pvp-move] leaderboard sync failed", {
          digest,
          reason,
          userMessage: LEADERBOARD_SYNC_FAILED_MESSAGE,
          error: err,
        });
        setMoveLifecycleStage("leaderboard-sync-failed");
        logTxTiming("leaderboard submit complete", submitStartedAt, {
          digest,
          failed: true,
        });
      });
  }, []);

  const submitCompletedBattleRecord = useCallback(
    (digest: string, state: BattleState | null | undefined, reason: string) => {
      if (!state?.winner) {
        console.log(`[leaderboard] submission skipped: battle not finished for ${reason}`);
        return;
      }

      recentBattleDigestRef.current = digest;
      submitFinishedBattleDigest(digest, reason);
    },
    [submitFinishedBattleDigest],
  );

  useEffect(() => {
    isWaitingRef.current = isWaiting;
  }, [isWaiting]);

  const refreshEntryFee = useCallback(async () => {
    const obj = await suiClient.getObject({
      id: SUI_CONFIG.CONFIG_ID,
      options: { showContent: true },
    });
    const fee = readConfigEntryFeeMist(obj.data?.content);
    if (fee === null) {
      throw new Error("Could not read battle entry fee from on-chain config");
    }
    setEntryFeeMist(fee);
    return fee;
  }, [suiClient]);

  const clearBattleState = useCallback(() => {
    setBattleState(null);
    setIsWaiting(false);
    setPvpQueueState(null);
    prevBattleStateRef.current = null;
    if (address) cacheBattleState(address, null);
  }, [address]);

  const applyBattleState = useCallback(
    async (
      nextState: BattleState | null,
      options: { verifyLive?: boolean; botMoveId?: number | null } = {},
    ) => {
      if (!address || !battleBelongsToAddress(nextState, address)) return;

      let state: BattleState = nextState;
      if (
        options.verifyLive &&
        state.battleId &&
        !state.winner &&
        !state.finished
      ) {
        const liveState = await getLiveBattleState(suiClient, state.battleId);
        if (liveState === null) {
          if (!isZeroAddress(state.player2) && !isWaitingRef.current) {
            clearBattleState();
          }
          return;
        }

        if (liveState && battleBelongsToAddress(liveState, address)) {
          state = {
            ...liveState,
            isBotBattle: state.isBotBattle,
          };
        }
      }

      const stateHasWinner = !!state.winner;
      const stateIsActive = isActiveBattleForAddress(state, address);
      if (!stateIsActive && !stateHasWinner) {
        clearBattleState();
        return;
      }

      setBattleState((prev) => {
        if (
          prev?.battleId === state.battleId &&
          (prev.lastMoveMs ?? 0) > (state.lastMoveMs ?? 0)
        ) {
          return prev;
        }
        buildActionLogEntry(prev, state, address, options.botMoveId ?? null);
        prevBattleStateRef.current = state;
        return state;
      });
      if (stateHasWinner) {
        submitFinishedBattleDigest(
          recentBattleDigestRef.current,
          "finished state applied",
        );
      }
      const stateIsWaiting = stateIsActive && isZeroAddress(state.player2);
      setIsWaiting(stateIsWaiting);
      if (!stateIsWaiting) {
        setPvpQueueState(null);
      }
    },
    [address, clearBattleState, suiClient, submitFinishedBattleDigest],
  );

  const refreshCurrentBattleState = useCallback(
    async (reason = "manual refresh"): Promise<BattleState | null> => {
      if (!address || !battleState?.battleId) return null;
      if (refreshCurrentBattleInFlightRef.current) return null;

      const battleId = battleState.battleId;
      refreshCurrentBattleInFlightRef.current = true;
      setIsBattleRefreshPending(true);
      setMoveLifecycleStage("battle-refresh-running");
      console.info("[pvp-move] battle refresh started", { battleId, reason });

      try {
        const liveState = await getLiveBattleState(suiClient, battleId);
        if (!liveState || !battleBelongsToAddress(liveState, address)) {
          throw new Error(
            "Direct battle object refresh did not return a usable battle state.",
          );
        }

        const hydrated = {
          ...liveState,
          isBotBattle: battleState.isBotBattle,
        };
        await applyBattleState(hydrated);
        setRecoverableBattleError(null);
        setMoveLifecycleStage("idle");
        console.info("[pvp-move] battle refresh completed", {
          battleId,
          reason,
        });
        return hydrated;
      } catch (err) {
        console.warn("[pvp-move] battle refresh failed", {
          battleId,
          reason,
          error: err,
        });
        setMoveLifecycleStage("battle-refresh-failed");
        showRecoverableBattleRefreshError(BATTLE_REFRESH_FAILED_MESSAGE);
        return null;
      } finally {
        refreshCurrentBattleInFlightRef.current = false;
        setIsBattleRefreshPending(false);
      }
    },
    [
      address,
      battleState,
      suiClient,
      applyBattleState,
      showRecoverableBattleRefreshError,
    ],
  );

  useEffect(() => {
    if (!isConnected || !address) return;
    if (isActivePvpBattleForAddress(battleState, address)) return;

    void refreshActivePvpBattle("page load").catch((err) => {
      console.warn("[pvp-match] page-load active battle check failed", err);
    });
  }, [isConnected, address, battleState?.battleId, refreshActivePvpBattle]);

  useEffect(() => {
    if (!isConnected || !address) {
      setPvpQueueState(null);
      return;
    }

    let cancelled = false;

    const checkQueue = async () => {
      try {
        const hadQueueState =
          isWaitingRef.current ||
          !!pvpQueueState ||
          isActiveBattleForAddress(battleState, address);
        const state = await refreshPvpQueueState();
        if (cancelled) return;
        if (state) {
          console.info("[pvp-queue] refund object id", {
            queueId: state.queueId,
          });
        } else if (hadQueueState) {
          console.info("[pvp-match] queue cleared; checking for match");
          const activeBattle = await refreshActivePvpBattle("queue cleared");
          if (!cancelled && !activeBattle) {
            console.info("[pvp-match] no active battle found after queue cleared");
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[pvp-queue] queue refresh failed", err);
        }
      }
    };

    void checkQueue();
    const interval = setInterval(() => {
      void checkQueue();
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    isConnected,
    address,
    pvpQueueState,
    battleState,
    refreshPvpQueueState,
    refreshActivePvpBattle,
  ]);

  useEffect(() => {
    if (!isConnected || !address) return;

    const cached = readCachedBattleState(address);
    if (!cached) return;

    console.log("[battle] verifying cached battle state");
    void applyBattleState(cached, { verifyLive: true });
  }, [isConnected, address, applyBattleState]);

  useEffect(() => {
    if (!address) return;
    cacheBattleState(address, battleState);
  }, [address, battleState]);

  useEffect(() => {
    refreshEntryFee().catch((err) => {
      console.warn("[battle] could not load on-chain entry fee:", err);
    });
  }, [refreshEntryFee]);

  // ── 1. Resolve a valid Sui random object ──────────────────────────────────
  useEffect(() => {
    async function ensureRandomObject() {
      for (const id of SUI_CONFIG.RANDOM_OBJECT_CANDIDATES) {
        try {
          const obj = await suiClient.getObject({
            id,
            options: { showType: true },
          });
          if (obj?.data?.type?.endsWith("::random::Random")) {
            setRandomObjectId(id);
            return;
          }
        } catch {
          // try next
        }
      }
      setRandomObjectId(SUI_CONFIG.RANDOM_OBJECT_CANDIDATES[0]);
    }
    ensureRandomObject();
  }, [suiClient]);

  // ── 2. Clear local battle state when wallet disconnects ───────────────────
  useEffect(() => {
    if (!isConnected || !address) {
      clearBattleState();
    }
  }, [isConnected, address, clearBattleState]);

  // ── 3. Direct Sui Polling Fallback ──────────────────────────────────────────
  // This allows the app to work on Netlify/Vercel without a relay server.
  useEffect(() => {
    if (!isConnected || !address) return;

    let cancelled = false;

    const pollForLatestBattle = async (force = false) => {
      // If we are waiting for a match OR in an active battle, poll for updates
      // (Even if socket is connected, direct polling is a safe fallback)
      if (
        force ||
        isWaiting ||
        isActiveBattleForAddress(battleState, address)
      ) {
        try {
          if (battleState?.battleId) {
            const liveState = await getLiveBattleState(
              suiClient,
              battleState.battleId,
            );
            if (
              liveState &&
              battleBelongsToAddress(liveState, address) &&
              JSON.stringify(liveState) !== JSON.stringify(battleState)
            ) {
              console.log("[polling] refreshed battle from shared object");
              await applyBattleState(liveState);
              return;
            }
            return;
          }

          const eventQueries = [
            { eventType: getPvpBattleV2UpdateEvent(), battleVersion: "pvp-v2" as const },
            { eventType: getBattleUpdateEvent(), battleVersion: "legacy" as const },
          ];

          for (const eventQuery of eventQueries) {
            const events = await suiClient.queryEvents({
              query: { MoveEventType: eventQuery.eventType },
              limit: force ? 50 : 20,
              order: "descending",
            });

            for (const event of events.data) {
              if (cancelled) return;

              const newState = parseBattleStateFromEvent(
                event.parsedJson,
                eventQuery.battleVersion,
              );

              // Is this battle relevant to us?
              if (battleBelongsToAddress(newState, address)) {
                if (isWaiting && !isActiveBattleForAddress(newState, address)) {
                  continue;
                }

                // Update state if it's newer or we were waiting
                if (
                  isWaiting ||
                  JSON.stringify(newState) !== JSON.stringify(battleState)
                ) {
                  console.log("[polling] detected battle update from blockchain");
                  await applyBattleState(newState, { verifyLive: true });
                }
                return; // Found our most recent battle, stop searching
              }
            }
          }
        } catch (err) {
          console.error("[polling] Sui RPC error:", err);
        }
      }
    };

    void pollForLatestBattle(true);
    const pollInterval = setInterval(() => {
      void pollForLatestBattle(false);
    }, 10_000); // Poll every 10 seconds to avoid hammering public RPC.

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [
    isConnected,
    address,
    isWaiting,
    battleState,
    suiClient,
    applyBattleState,
  ]);

  // ── 4. Scan wallet / kiosks for a valid NFT ───────────────────────────────
  const getFirstValidSaplingNft = useCallback(
    async (owner: string): Promise<NftData | null> => {
      const stored = localStorage.getItem("allowed_nft_collections");
      let allowedTypes: string[] = stored
        ? JSON.parse(stored).map((c: any) => c.type)
        : [SUI_CONFIG.SAPLING_STRUCT];

      // Fetch on-chain whitelisted collections to ensure we have the latest global list
      try {
        const configObj = await suiClient.getObject({
          id: SUI_CONFIG.CONFIG_ID,
          options: { showContent: true },
        });

        const whitelisted = (configObj?.data?.content as any)?.fields
          ?.whitelisted_collections;
        if (whitelisted && Array.isArray(whitelisted)) {
          const onChainTypes = whitelisted.map((t: any) => {
            // TypeName fields usually store the type string in a 'name' field
            let typeNameStr = typeof t === "string" ? t : t?.fields?.name || t;
            // Some TypeName representations might not start with 0x
            if (
              typeof typeNameStr === "string" &&
              !typeNameStr.startsWith("0x")
            ) {
              typeNameStr = "0x" + typeNameStr;
            }
            return typeNameStr;
          });
          // Merge allowed types
          allowedTypes = Array.from(
            new Set([...allowedTypes, ...onChainTypes]),
          );
        }
      } catch (err) {
        console.error("Failed to fetch on-chain config collections:", err);
      }

      const kiosks = new Map<string, string>(); // kioskId → ownerCapId
      let cursor: string | null = null;

      try {
        do {
          const res = await suiClient.getOwnedObjects({
            owner,
            options: { showType: true, showContent: true },
            cursor: cursor || undefined,
            limit: 50,
          });

          for (const obj of res.data) {
            const type = obj?.data?.type;
            if (!type) continue;

            if (type.includes("::kiosk::KioskOwnerCap")) {
              const capId = obj?.data?.objectId;
              // @ts-ignore
              const kioskId =
                // @ts-ignore
                obj?.data?.content?.fields?.for?.fields?.kiosk_id ||
                // @ts-ignore
                obj?.data?.content?.fields?.kiosk_id ||
                // @ts-ignore
                obj?.data?.content?.fields?.for;
              if (kioskId && capId) kiosks.set(kioskId, capId);
            }

            if (allowedTypes.includes(type)) {
              const id = obj?.data?.objectId;
              // Extract image from Display or object field
              // @ts-ignore
              const displayUrl = obj?.data?.display?.data?.image_url;
              // @ts-ignore
              const contentUrlField = obj?.data?.content?.fields?.image_url;
              // Handle case where image_url is a Url struct { url: string }
              const contentUrl =
                typeof contentUrlField === "string"
                  ? contentUrlField
                  : contentUrlField?.fields?.url || contentUrlField?.url || "";

              const imageUrl = displayUrl || contentUrl || "";

              if (id)
                return {
                  nftId: id,
                  nftType: type,
                  location: "wallet",
                  imageUrl,
                };
            }
          }

          cursor = res.hasNextPage ? (res.nextCursor ?? null) : null;
        } while (cursor);

        for (const [kioskId, ownerCapId] of Array.from(kiosks.entries())) {
          try {
            const fields = await suiClient.getDynamicFields({
              parentId: kioskId,
            });
            for (const field of fields.data) {
              const fieldType = field?.name?.type ?? "";
              if (fieldType.includes("::Lock")) continue;
              // @ts-ignore
              const nftId = field?.name?.value?.id;
              if (!nftId) continue;

              const obj = await suiClient.getObject({
                id: nftId,
                options: { showType: true, showContent: true },
              });

              if (obj?.data?.type && allowedTypes.includes(obj.data.type)) {
                if (fieldType.includes("::Item")) {
                  // @ts-ignore
                  const displayUrl = obj?.data?.display?.data?.image_url;
                  // @ts-ignore
                  const contentUrlField = obj?.data?.content?.fields?.image_url;
                  const contentUrl =
                    typeof contentUrlField === "string"
                      ? contentUrlField
                      : contentUrlField?.fields?.url ||
                        contentUrlField?.url ||
                        "";

                  const imageUrl = displayUrl || contentUrl || "";

                  return {
                    nftId,
                    nftType: obj.data.type,
                    location: "kiosk",
                    kioskId,
                    kioskCapId: ownerCapId,
                    imageUrl,
                  };
                }
              }
            }
          } catch {
            // skip bad kiosk
          }
        }

        return null;
      } catch (err) {
        console.error("NFT scan error:", err);
        throw new Error(
          "Could not scan your NFTrees because the Sui RPC request failed. Wait a moment and try again.",
        );
      }
    },
    [suiClient],
  );

  // ── 4. Join the battle queue ──────────────────────────────────────────────
  const joinBattle = useCallback(
    async (nftData: NftData, targetGrowth: PvpMatchTarget = 50) => {
      if (!address || !randomObjectId) {
        throw new Error(
          "Wallet not connected or random object not initialised",
        );
      }

      const matchOption = getPvpMatchOption(targetGrowth);
      if (matchOption.queueType === "v2" && !matchOption.queueId.trim()) {
        throw new Error("This match type is not active yet.");
      }

      const liveEntryFeeMist = await refreshEntryFee();

      // Balance check
      try {
        const balance = await suiClient.getBalance({ owner: address });
        const balSui = Number(balance.totalBalance) / 1e9;
        const needed = liveEntryFeeMist / 1e9 + 0.1;
        if (balSui < needed) {
          throw new Error(
            `Insufficient balance: you have ${balSui.toFixed(2)} SUI but need ${needed} SUI`,
          );
        }
      } catch (e: any) {
        if (e.message?.includes("Insufficient")) throw e;
      }

      const tx = new Transaction();
      const [fee] =
        liveEntryFeeMist === 0
          ? [
              tx.moveCall({
                target: "0x2::coin::zero",
                typeArguments: ["0x2::sui::SUI"],
                arguments: [],
              }),
            ]
          : tx.splitCoins(tx.gas, [tx.pure.u64(liveEntryFeeMist)]);

      if (nftData.location === "wallet") {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::${
            matchOption.queueType === "v2" ? "join_queue_v2" : "join_queue"
          }`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(matchOption.queueId),
            tx.object(nftData.nftId),
            fee,
            tx.object(randomObjectId),
          ],
        });
      } else if (nftData.kioskId && nftData.kioskCapId) {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::${
            matchOption.queueType === "v2"
              ? "join_queue_v2_from_kiosk"
              : "join_queue_from_kiosk"
          }`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(matchOption.queueId),
            tx.object(nftData.kioskId),
            tx.object(nftData.kioskCapId),
            tx.pure.address(nftData.nftId),
            fee,
            tx.object(randomObjectId),
          ],
        });
      } else {
        throw new Error("Invalid NFT location data");
      }

      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: async (result) => {
              console.log("join_queue tx success:", result.digest);
              try {
                const matchedBattle = await getBattleStateFromTransaction(
                  suiClient,
                  result.digest,
                  address,
                );
                if (matchedBattle && hydrateActivePvpBattle(matchedBattle, "join_queue transaction")) {
                  resolve();
                  return;
                }
              } catch (err) {
                console.warn("[pvp-match] could not hydrate joined battle from transaction", err);
              }

              setPvpQueueState({
                queueId: matchOption.queueId,
                player: address.toLowerCase(),
                entryFeeMist: liveEntryFeeMist,
                targetGrowth: matchOption.targetGrowth,
                matchLabel: getPvpMatchDisplayLabel(matchOption.targetGrowth),
                queueType: matchOption.queueType,
              });
              setIsWaiting(true);
              resolve();
            },
            onError: (err: any) => {
              console.error("join_queue tx failed:", err);
              reject(new Error(err?.message ?? "Failed to join battle"));
            },
          },
        );
      });
    },
    [
      address,
      randomObjectId,
      refreshEntryFee,
      suiClient,
      signAndExecuteTransaction,
      hydrateActivePvpBattle,
    ],
  );

  // ── 5. Start a no-payout bot practice battle ─────────────────────────────
  const startBotBattle = useCallback(
    async (nftData: NftData, options?: StartBotBattleOptions) => {
      if (!address || !randomObjectId) {
        throw new Error(
          "Wallet not connected or random object not initialised",
        );
      }

      clearBattleState();
      clearActionLog();
      setIsWaiting(true);

      const tx = new Transaction();
      const botAddress = SUI_CONFIG.BOT_ADDRESS;

      if (nftData.location === "wallet") {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::create_bot_battle`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(nftData.nftId),
            tx.pure.address(botAddress),
            tx.object(randomObjectId),
          ],
        });
      } else if (nftData.kioskId && nftData.kioskCapId) {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::create_bot_battle_from_kiosk`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(nftData.kioskId),
            tx.object(nftData.kioskCapId),
            tx.pure.address(nftData.nftId),
            tx.pure.address(botAddress),
            tx.object(randomObjectId),
          ],
        });
      } else {
        throw new Error("Invalid NFT location data");
      }

      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          callback();
        };
        const fail = (error: Error) => {
          if (settled) return;
          setIsWaiting(false);
          finish(() => reject(error));
        };
        const timeoutId = setTimeout(() => {
          console.warn("[bot-start] timeout");
          fail(
            new Error(
              "Timed out waiting for the Garden Bot battle to start. Please try again.",
            ),
          );
        }, BOT_START_TIMEOUT_MS);

        try {
          console.info("[bot-start] wallet request opened");
          options?.onStatus?.("wallet-request-opened");
          signAndExecuteTransaction(
            { transaction: tx, chain: SUI_CONFIG.CHAIN },
            {
              onSuccess: async (result) => {
                try {
                  console.info("[bot-start] transaction digest received", {
                    digest: result.digest,
                  });
                  options?.onStatus?.("transaction-digest-received", {
                    digest: result.digest,
                  });
                  const newState = await getBattleStateFromTransaction(
                    suiClient,
                    result.digest,
                    address,
                  );
                  if (settled) return;

                  if (!newState) {
                    throw new Error(
                      "Battle transaction confirmed, but the game did not refresh. Try Refresh Battle.",
                    );
                  }

                  await applyBattleState(newState);
                  if (settled) return;
                  console.info("[bot-start] battle state loaded", {
                    battleId: newState.battleId,
                  });
                  options?.onStatus?.("battle-state-loaded", {
                    digest: result.digest,
                  });
                  finish(() => resolve());
                } catch (err: any) {
                  console.warn(
                    "[bot-start] failed",
                    err,
                  );
                  fail(
                    new Error(
                      err?.message ??
                        "Battle transaction confirmed, but the game did not refresh. Try Refresh Battle.",
                    ),
                  );
                }
              },
              onError: (err: any) => {
                const message = err?.message ?? "Failed to start bot battle";
                if (/reject|cancel|denied|declined/i.test(message)) {
                  console.info("[bot-start] cancelled");
                } else {
                  console.warn("[bot-start] failed", err);
                }
                fail(new Error(err?.message ?? "Failed to start bot battle"));
              },
            },
          );
        } catch (err: any) {
          console.warn("[bot-start] failed", err);
          fail(new Error(err?.message ?? "Failed to start bot battle"));
        }
      });
    },
    [
      address,
      randomObjectId,
      suiClient,
      applyBattleState,
      clearBattleState,
      clearActionLog,
      signAndExecuteTransaction,
    ],
  );

  // ── 6. Use an ability ─────────────────────────────────────────────────────
  const useAbility = useCallback(
    async (abilityId: number) => {
      if (!address || !randomObjectId || !battleState?.battleId) {
        throw new Error("Battle not active");
      }

      let activeState = battleState;
      if (!isActiveBattleForAddress(activeState, address)) {
        clearBattleState();
        throw new Error("Battle not active");
      }
      const battleId = activeState.battleId;
      if (!battleId) {
        clearBattleState();
        throw new Error("Battle not active");
      }

      const liveState = await getLiveBattleState(suiClient, battleId);
      if (
        liveState === null ||
        (liveState && !isActiveBattleForAddress(liveState, address))
      ) {
        clearBattleState();
        throw new Error("Battle not active");
      }

      if (liveState) {
        activeState = {
          ...liveState,
          isBotBattle: activeState.isBotBattle,
        };
        await applyBattleState(activeState);
      }

      const isPlayer1 =
        activeState.player1?.toLowerCase() === address.toLowerCase();
      const isPlayer2 =
        activeState.player2?.toLowerCase() === address.toLowerCase();
      const isCurrentTurn =
        (isPlayer1 && activeState.turn === 0) ||
        (isPlayer2 && activeState.turn === 1);
      if (!isCurrentTurn) {
        throw new Error("Not your turn yet");
      }

      const availableMoves = isPlayer1
        ? activeState.player1Moves
        : activeState.player2Moves;
      if (!availableMoves.includes(abilityId)) {
        throw new Error("That move is not available in this battle");
      }

      const tx = new Transaction();
      lastMoveIdRef.current = abilityId; // track for action log
      tx.moveCall({
        target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${
          activeState.battleVersion === "pvp-v2"
            ? "use_ability_id_pvp_v2"
            : "use_ability_id"
        }`,
        arguments: [
          tx.object(battleId),
          tx.pure.u8(abilityId),
          tx.object(randomObjectId),
        ],
      });
      tx.setSender(address);
      const txTimingStartedAt = txTimingNow();
      logTxTiming("move submitted", txTimingStartedAt, {
        battleId,
        abilityId,
      });
      setRecoverableBattleError(null);
      setMoveLifecycleStage("awaiting-wallet-approval");
      console.info("[pvp-move] wallet approval requested", {
        battleId,
        abilityId,
      });

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: async (result) => {
              console.info("[pvp-move] transaction submitted", {
                battleId,
                abilityId,
                digest: result.digest,
              });
              setMoveLifecycleStage("transaction-submitted");
              logTxTiming("wallet approved / digest received", txTimingStartedAt, {
                digest: result.digest,
              });
              recentBattleDigestRef.current = result.digest;
              let completedState: BattleState | null = null;
              let confirmationLoaded = false;
              try {
                const eventResult = await getBattleUpdateStateFromTransaction(
                  suiClient,
                  result.digest,
                  address,
                  battleId,
                  txTimingStartedAt,
                );
                confirmationLoaded = true;
                console.info("[pvp-move] transaction confirmed", {
                  battleId,
                  abilityId,
                  digest: result.digest,
                });
                setMoveLifecycleStage("transaction-confirmed");
                if (eventResult.state) {
                  completedState = {
                    ...eventResult.state,
                    isBotBattle: activeState.isBotBattle,
                  };
                  console.info("[pvp-move] battle refresh started", {
                    battleId,
                    digest: result.digest,
                    source: "BattleUpdate event",
                  });
                  setIsBattleRefreshPending(true);
                  setMoveLifecycleStage("battle-refresh-running");
                  await applyBattleState(completedState, {
                    botMoveId: eventResult.botMoveId,
                  });
                  setRecoverableBattleError(null);
                  setMoveLifecycleStage("idle");
                  console.info("[pvp-move] battle refresh completed", {
                    battleId: completedState.battleId,
                    digest: result.digest,
                    source: "BattleUpdate event",
                  });
                  logTxTiming("applyBattleState complete", txTimingStartedAt, {
                    battleId: completedState.battleId,
                    source: "BattleUpdate event",
                  });
                } else {
                  console.log("[battle] BattleUpdate event missing; refreshing live battle state.");
                  console.info("[pvp-move] battle refresh started", {
                    battleId,
                    digest: result.digest,
                    source: "live object fallback",
                  });
                  setIsBattleRefreshPending(true);
                  setMoveLifecycleStage("battle-refresh-running");
                  const refreshed = await getLiveBattleState(suiClient, battleId);
                  if (refreshed) {
                    completedState = {
                      ...refreshed,
                      isBotBattle: activeState.isBotBattle,
                    };
                    await applyBattleState(completedState, {
                      botMoveId: eventResult.botMoveId,
                    });
                    logTxTiming("applyBattleState complete", txTimingStartedAt, {
                      battleId: completedState.battleId,
                      source: "live refresh fallback",
                    });
                    setRecoverableBattleError(null);
                    setMoveLifecycleStage("idle");
                    console.info("[pvp-move] battle refresh completed", {
                      battleId: completedState.battleId,
                      digest: result.digest,
                      source: "live object fallback",
                    });
                  } else {
                    console.warn("[pvp-move] battle refresh failed", {
                      battleId,
                      digest: result.digest,
                      source: "live object fallback",
                    });
                    setMoveLifecycleStage("battle-refresh-failed");
                    showRecoverableBattleRefreshError(
                      BATTLE_REFRESH_FAILED_MESSAGE,
                      result.digest,
                    );
                  }
                }
              } catch (err) {
                if (!confirmationLoaded) {
                  console.warn("[pvp-move] transaction confirmation failed", {
                    battleId,
                    digest: result.digest,
                    error: err,
                  });
                  showRecoverableBattleRefreshError(
                    TRANSACTION_CONFIRMATION_UNAVAILABLE_MESSAGE,
                    result.digest,
                  );
                  setMoveLifecycleStage("battle-refresh-failed");
                  reject(
                    new Error(TRANSACTION_CONFIRMATION_UNAVAILABLE_MESSAGE),
                  );
                  return;
                }

                console.warn("[battle] post-move refresh will retry via direct object read:", err);
                console.warn("[pvp-move] battle refresh failed", {
                  battleId,
                  digest: result.digest,
                  error: err,
                });
                console.info("[pvp-move] battle refresh started", {
                  battleId,
                  digest: result.digest,
                  source: "error live object fallback",
                });
                setIsBattleRefreshPending(true);
                setMoveLifecycleStage("battle-refresh-running");
                const refreshed = await getLiveBattleState(suiClient, battleId);
                if (refreshed) {
                  completedState = {
                    ...refreshed,
                    isBotBattle: activeState.isBotBattle,
                  };
                  await applyBattleState(completedState);
                  setRecoverableBattleError(null);
                  setMoveLifecycleStage("idle");
                  console.info("[pvp-move] battle refresh completed", {
                    battleId: completedState.battleId,
                    digest: result.digest,
                    source: "error live object fallback",
                  });
                  logTxTiming("applyBattleState complete", txTimingStartedAt, {
                    battleId: completedState.battleId,
                    source: "error live refresh fallback",
                  });
                } else {
                  setMoveLifecycleStage("battle-refresh-failed");
                  showRecoverableBattleRefreshError(
                    BATTLE_REFRESH_FAILED_MESSAGE,
                    result.digest,
                  );
                }
              } finally {
                setIsBattleRefreshPending(false);
              }
              submitCompletedBattleRecord(
                result.digest,
                completedState,
                "post-move confirmed state",
              );
              resolve();
            },
            onError: (err: any) => {
              console.warn("[pvp-move] transaction submission failed", {
                battleId,
                abilityId,
                error: err,
              });
              setMoveLifecycleStage("idle");
              reject(new Error(MOVE_NOT_SUBMITTED_MESSAGE));
            },
          },
        );
      });
    },
    [
      address,
      randomObjectId,
      battleState,
      suiClient,
      applyBattleState,
      clearBattleState,
      signAndExecuteTransaction,
      submitCompletedBattleRecord,
      showRecoverableBattleRefreshError,
    ],
  );

  const claimTimeoutWin = useCallback(async () => {
    if (!address || !battleState?.battleId) {
      throw new Error("Battle not active");
    }

    const battleId = battleState.battleId;
    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${
        battleState.battleVersion === "pvp-v2"
          ? "claim_timeout_win_pvp_v2"
          : "claim_timeout_win"
      }`,
      arguments: [tx.object(battleId)],
    });
    tx.setSender(address);

    return new Promise<void>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx, chain: SUI_CONFIG.CHAIN },
        {
          onSuccess: async (result) => {
            recentBattleDigestRef.current = result.digest;
            const liveState = await getLiveBattleState(suiClient, battleId);
            if (liveState) {
              const completedState = {
                ...liveState,
                isBotBattle: battleState.isBotBattle,
              };
              await applyBattleState(completedState);
              submitCompletedBattleRecord(
                result.digest,
                completedState,
                "timeout win confirmed state",
              );
            }
            resolve();
          },
          onError: (err: any) =>
            reject(new Error(err?.message ?? "Failed to claim timeout win")),
        },
      );
    });
  }, [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState, submitCompletedBattleRecord]);

  const forfeitBattle = useCallback(async () => {
    if (!address || !battleState?.battleId) {
      throw new Error("Battle not active");
    }

    const battleId = battleState.battleId;
    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${
        battleState.battleVersion === "pvp-v2" ? "surrender_pvp_v2" : "surrender"
      }`,
      arguments: [tx.object(battleId)],
    });
    tx.setSender(address);

    return new Promise<void>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx, chain: SUI_CONFIG.CHAIN },
        {
          onSuccess: async (result) => {
            recentBattleDigestRef.current = result.digest;
            const liveState = await getLiveBattleState(suiClient, battleId);
            if (liveState) {
              const completedState = {
                ...liveState,
                isBotBattle: battleState.isBotBattle,
              };
              await applyBattleState(completedState);
              submitCompletedBattleRecord(
                result.digest,
                completedState,
                "forfeit confirmed state",
              );
            }
            resolve();
          },
          onError: (err: any) =>
            reject(new Error(err?.message ?? "Failed to forfeit battle")),
        },
      );
    });
  }, [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState, submitCompletedBattleRecord]);

  const adminForceClose = useCallback(
    async (winner?: string) => {
      if (!address || !battleState?.battleId) {
        throw new Error("Battle not active");
      }

      const battleId = battleState.battleId;
      const tx = new Transaction();
      if (winner) {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${
            battleState.battleVersion === "pvp-v2"
              ? "admin_force_close_pvp_v2_with_winner"
              : "admin_force_close_with_winner"
          }`,
          arguments: [
            tx.object(battleId),
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.pure.address(winner),
          ],
        });
      } else {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::${
            battleState.battleVersion === "pvp-v2"
              ? "admin_force_close_pvp_v2"
              : "admin_force_close"
          }`,
          arguments: [tx.object(battleId), tx.object(SUI_CONFIG.CONFIG_ID)],
        });
      }
      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: async (result) => {
              recentBattleDigestRef.current = result.digest;
              const liveState = await getLiveBattleState(suiClient, battleId);
              if (liveState) {
                const completedState = {
                  ...liveState,
                  isBotBattle: battleState.isBotBattle,
                };
                await applyBattleState(completedState);
                submitCompletedBattleRecord(
                  result.digest,
                  completedState,
                  "admin close confirmed state",
                );
              }
              resolve();
            },
            onError: (err: any) =>
              reject(new Error(err?.message ?? "Failed to force close battle")),
          },
        );
      });
    },
    [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState, submitCompletedBattleRecord],
  );

  // ── 6. Cancel queue / emergency refund ───────────────────────────────────
  const cancelQueue = useCallback(async (options?: CancelQueueOptions) => {
    if (!address) throw new Error("Wallet not connected");

    let queueState: PvpQueueState | null = null;
    try {
      queueState = await getRefundablePvpQueueState(suiClient, address);
    } catch (err) {
      console.warn("[pvp-queue] refund queue hydration failed", err);
      if (err instanceof SuiRpcReadError) {
        if (err.kind === "rate_limited" || err.kind === "transport") {
          throw new Error(
            "The Sui network is temporarily rate-limiting requests. Your queue deposit has not been reported missing. Wait a moment and try again.",
          );
        }
      }
      throw new Error(
        "Could not read your PvP queue entry. Refresh the page and try again.",
      );
    }

    if (!queueState) {
      setPvpQueueState(null);
      setIsWaiting(false);
      throw new Error("You are NOT in the queue. Nothing to refund.");
    }

    console.info("[pvp-queue] constructing refund transaction", {
      queueId: queueState.queueId,
      queueType: queueState.queueType,
      targetGrowth: queueState.targetGrowth,
    });

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::${getPvpQueueCancelFunctionName(queueState.queueType)}`,
      arguments: [tx.object(queueState.queueId)],
    });
    tx.setSender(address);

    // Build first so wallet approval is only requested for a verified queue entry.
    try {
      await tx.build({ client: suiClient });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("108")) {
        setPvpQueueState(null);
        setIsWaiting(false);
        throw new Error("You are NOT in the queue. Nothing to refund.");
      }
      if (msg.includes("102")) throw new Error("This is not your queue entry.");
      throw new Error(`Cannot refund: ${msg}`);
    }

    options?.onWalletApprovalRequested?.(queueState);

    const result = await new Promise<any>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx, chain: SUI_CONFIG.CHAIN },
        {
          onSuccess: (r) => {
            setPvpQueueState(null);
            setIsWaiting(false);
            resolve(r);
          },
          onError: (e) => reject(e),
        },
      );
    });

    let verificationNotice: string | undefined;
    const refundedQueueOption: PvpMatchOption = {
      targetGrowth: queueState.targetGrowth,
      label:
        queueState.targetGrowth === 50
          ? "Quick Match"
          : queueState.targetGrowth === 75
            ? "Standard Match"
            : "Legacy Match",
      shortLabel: `${queueState.targetGrowth} Growth`,
      queueId: queueState.queueId,
      queueType: queueState.queueType,
    };

    try {
      const remainingEntry = await getPvpQueueStateForOption(
        suiClient,
        address,
        refundedQueueOption,
        "pvp-queue-post-refund-verify",
      );
      if (remainingEntry) {
        verificationNotice =
          "Refund transaction succeeded, but the queue still appears to show a waiting entry. Refresh once before joining again.";
        console.warn("[pvp-queue] post-refund verification still found entry", {
          queueId: remainingEntry.queueId,
          targetGrowth: remainingEntry.targetGrowth,
        });
      }
    } catch (err) {
      if (err instanceof SuiRpcReadError) {
        if (err.kind === "rate_limited" || err.kind === "transport") {
          verificationNotice =
            "Refund complete. Follow-up queue verification was rate-limited, but your local waiting state was cleared.";
        } else {
          verificationNotice =
            "Refund complete. Follow-up queue verification could not read the queue shape.";
        }
      } else {
        verificationNotice =
          "Refund complete. Follow-up queue verification could not be completed.";
      }
      console.warn("[pvp-queue] post-refund verification failed", err);
    }

    setPvpQueueState(null);
    setIsWaiting(false);

    return {
      digest: result?.digest,
      queueState,
      verificationNotice,
    };
  }, [address, suiClient, signAndExecuteTransaction]);

  // ── ConnectWalletButton component ─────────────────────────────────────────
  const ConnectWalletButton = useCallback(
    () => (
      <ConnectButton
        connectText="Connect Wallet"
        style={{
          border: "2px solid #00ff00",
          background:
            "linear-gradient(45deg, rgba(0,100,0,0.5), rgba(0,150,0,0.5))",
          color: "white",
          boxShadow: "0 0 10px #00ff00",
          borderRadius: "8px",
          padding: "0.5rem 1.25rem",
          fontSize: "0.875rem",
          fontFamily: "Orbitron, sans-serif",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      />
    ),
    [],
  );

  // ── Action log builder (called inside setBattleState updater) ──────────────
  function buildActionLogEntry(
    prev: BattleState | null,
    next: BattleState,
    myAddress: string | null,
    explicitBotMoveId: number | null = null,
  ) {
    if (!prev || !myAddress) return;
    if (!next.battleId || next.battleId !== prev.battleId) return;

    const p1Changed = next.player1Growth !== prev.player1Growth;
    const p2Changed = next.player2Growth !== prev.player2Growth;
    const turnAdvanced =
      next.turn !== prev.turn || next.lastMoveMs !== prev.lastMoveMs;
    const hasLocalMove = lastMoveIdRef.current !== 0;
    if (!p1Changed && !p2Changed && !turnAdvanced && !hasLocalMove) return;

    const isP1 = prev.player1?.toLowerCase() === myAddress.toLowerCase();
    const p1Acted = prev.turn === 0;
    const actor: "you" | "opponent" =
      (isP1 && p1Acted) || (!isP1 && !p1Acted) ? "you" : "opponent";

    const createEntry = (
      entryActor: "you" | "opponent" | "round",
      moveId: number,
      details?: string[],
      label?: string,
    ): ActionEntry => ({
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      actor: entryActor,
      moveId,
      prevPlayerGrowth: isP1 ? prev.player1Growth : prev.player2Growth,
      nextPlayerGrowth: isP1 ? next.player1Growth : next.player2Growth,
      prevOpponentGrowth: isP1 ? prev.player2Growth : prev.player1Growth,
      nextOpponentGrowth: isP1 ? next.player2Growth : next.player1Growth,
      label,
      details,
    });

    const playerPrevGrowth = isP1 ? prev.player1Growth : prev.player2Growth;
    const playerNextGrowth = isP1 ? next.player1Growth : next.player2Growth;
    const opponentPrevGrowth = isP1 ? prev.player2Growth : prev.player1Growth;
    const opponentNextGrowth = isP1 ? next.player2Growth : next.player1Growth;
    const playerGrowthDelta = playerNextGrowth - playerPrevGrowth;
    const opponentGrowthDelta = opponentNextGrowth - opponentPrevGrowth;
    const targetGrowth = resolveBattleTargetGrowth(next);
    const botMoveEventId =
      explicitBotMoveId && Number.isFinite(explicitBotMoveId) && explicitBotMoveId > 0
        ? explicitBotMoveId
        : null;
    const resolvedBotMoveId = next.isBotBattle
      ? resolveBotMoveId(prev, next, botMoveEventId)
      : null;
    const usedExplicitBotMove = !!(
      botMoveEventId &&
      Number.isFinite(botMoveEventId) &&
      botMoveEventId > 0 &&
      resolvedBotMoveId === botMoveEventId
    );
    if (next.isBotBattle && actor === "you" && !usedExplicitBotMove && resolvedBotMoveId !== null) {
      battleLogDebug("falling back to derived bot move", {
        moveId: resolvedBotMoveId,
      });
    }
    const transitionKey = [
      next.battleId,
      prev.lastMoveMs,
      next.lastMoveMs,
      actor,
      lastMoveIdRef.current,
      resolvedBotMoveId ?? 0,
      playerPrevGrowth,
      playerNextGrowth,
      opponentPrevGrowth,
      opponentNextGrowth,
    ].join(":");
    if (lastLoggedActionKeyRef.current === transitionKey) {
      lastMoveIdRef.current = 0;
      return;
    }

    const formatDelta = (delta: number) =>
      delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "no change";
    const formatMoveDescriptionForActor = (
      moveId: number,
      moveActor: "you" | "garden-bot",
    ): string | null => {
      const meta = MOVE_META[moveId];
      if (!meta?.effect) return null;
      if (moveActor === "you") {
        return meta.effect.replace(/\bYOUR\b/g, "your");
      }

      const effect = meta.effect.toLowerCase();
      const canGrow = meta.type === "growth" || effect.includes("grow");
      const canDrain = meta.type === "attack" || effect.includes("drain") || effect.includes("poison");
      const canBlock = effect.includes("block");
      const parts: string[] = [];

      if (canDrain) parts.push("reduce your growth");
      if (canGrow) parts.push("gain growth");
      if (canBlock) parts.push("block or prepare a block");

      if (parts.length === 0) return "Garden Bot used a utility move.";
      return `Garden Bot can ${parts.join(" and ")} with this move.`;
    };
    const describeNoVisibleEffect = (moveId: number, targetLabel: string, targetGrowth: number) => {
      const meta = MOVE_META[moveId];
      const effect = meta?.effect.toLowerCase() ?? "";

      if (meta?.type === "attack" || effect.includes("drain") || effect.includes("poison")) {
        if (targetGrowth <= 0) return `${targetLabel} had no growth to reduce.`;
        if (effect.includes("hit chance")) return "The move may have missed or had no visible effect this turn.";
        if (effect.includes("50/50") || effect.includes("block")) {
          return "No growth was reduced; this move can resolve as a block effect.";
        }
        return "No visible growth was reduced this turn.";
      }

      if (meta?.type === "growth" || effect.includes("grow")) {
        if (effect.includes("success rate") || effect.includes("chance")) {
          return "The growth effect may not have triggered this turn.";
        }
        return "No visible growth was gained this turn.";
      }

      if (effect.includes("block")) {
        return "No visible growth changed; this move may have affected block.";
      }

      return "The move had no visible effect this turn.";
    };
    const classifyBotEffectFallback = (): string => {
      if (playerGrowthDelta < 0 && opponentGrowthDelta > 0) {
        return "Garden Bot used a mixed move.";
      }

      if (playerGrowthDelta < 0) {
        return "Garden Bot used a drain move.";
      }

      if (opponentGrowthDelta > 0) {
        return "Garden Bot used a growth move.";
      }

      if (playerGrowthDelta !== 0 || opponentGrowthDelta !== 0) {
        return "Garden Bot used a mixed move.";
      }

      return "Garden Bot made a move with no visible effect.";
    };
    const buildPlayerMoveDetails = (moveId: number): string[] => {
      const details: string[] = [];
      const meta = MOVE_META[moveId];
      const moveDescription = formatMoveDescriptionForActor(moveId, "you");

      if (moveDescription) details.push(moveDescription);

      if (playerGrowthDelta > 0) {
        details.push(`Your tree gained +${playerGrowthDelta} growth.`);
      } else if (playerGrowthDelta < 0) {
        details.push(`After the full turn, your tree lost ${Math.abs(playerGrowthDelta)} growth.`);
      }

      if (opponentGrowthDelta < 0) {
        details.push(`Garden Bot growth was reduced by ${Math.abs(opponentGrowthDelta)}.`);
      } else if (opponentGrowthDelta > 0 && meta?.type === "attack") {
        details.push(`Garden Bot still gained +${opponentGrowthDelta} growth after the full turn.`);
      }

      if (details.length === (meta?.effect ? 1 : 0)) {
        details.push(describeNoVisibleEffect(moveId, "Garden Bot", opponentPrevGrowth));
      }

      return details;
    };
    const buildBotResponseDetails = (moveId: number | null): string[] => {
      const details: string[] = [];
      const meta = moveId ? MOVE_META[moveId] : undefined;
      const moveDescription = moveId
        ? formatMoveDescriptionForActor(moveId, "garden-bot")
        : null;

      if (moveDescription) {
        details.push(moveDescription);
      }

      if (playerGrowthDelta < 0) {
        details.push(`Your growth was reduced by ${Math.abs(playerGrowthDelta)}.`);
      } else if (playerGrowthDelta > 0 && meta?.type === "attack") {
        details.push(`Your tree still gained +${playerGrowthDelta} growth after the full turn.`);
      }

      if (opponentGrowthDelta > 0) {
        details.push(`Garden Bot gained +${opponentGrowthDelta} growth.`);
      } else if (opponentGrowthDelta < 0) {
        details.push(`Garden Bot lost ${Math.abs(opponentGrowthDelta)} growth after the full turn.`);
      }

      if (details.length === (moveId && meta?.effect ? 1 : 0)) {
        details.push(
          moveId
            ? describeNoVisibleEffect(moveId, "Your tree", playerPrevGrowth)
            : "No visible growth changed from the Garden Bot move.",
        );
      }

      return details;
    };
    const buildRoundResultDetails = (): string[] => {
      const details = [
        `Round result: You ${playerNextGrowth} / ${targetGrowth} - Garden Bot ${opponentNextGrowth} / ${targetGrowth}`,
      ];

      if (next.winner) {
        details.push(
          next.winner.toLowerCase() === myAddress.toLowerCase()
            ? "You reached the target growth first."
            : "Garden Bot reached the target growth first.",
        );
      }

      if (playerGrowthDelta === 0 && opponentGrowthDelta === 0) {
        details.push("No visible growth changed this round.");
      }

      return details;
    };
    const roundResultDetails =
      next.isBotBattle && actor === "you"
        ? [
            ...buildRoundResultDetails(),
            `Your tree: ${playerPrevGrowth} -> ${playerNextGrowth} (${formatDelta(playerGrowthDelta)})`,
            `Garden Bot: ${opponentPrevGrowth} -> ${opponentNextGrowth} (${formatDelta(opponentGrowthDelta)})`,
          ]
        : undefined;
    const resolvedBotMoveLabel =
      resolvedBotMoveId !== null
        ? MOVE_LABELS[resolvedBotMoveId] ?? `Garden Bot Move #${resolvedBotMoveId}`
        : undefined;
    const botFallbackLabel =
      next.isBotBattle && actor === "you" && resolvedBotMoveId === null
        ? classifyBotEffectFallback()
        : undefined;
    if (next.isBotBattle && actor === "you" && usedExplicitBotMove && resolvedBotMoveId !== null) {
      if (MOVE_LABELS[resolvedBotMoveId]) {
        battleLogDebug("exact bot move applied", {
          moveId: resolvedBotMoveId,
          label: resolvedBotMoveLabel,
        });
      } else {
        battleLogDebug("BotMoveResolved label missing", {
          moveId: resolvedBotMoveId,
        });
      }
    }

    const playerMoveDetails =
      next.isBotBattle && actor === "you"
        ? buildPlayerMoveDetails(lastMoveIdRef.current)
        : undefined;

    const entries: ActionEntry[] = [];
    const playerMoveId = actor === "you" ? lastMoveIdRef.current : 0;

    if (actor !== "you" || playerMoveId > 0) {
      entries.push(
        createEntry(
          actor,
          playerMoveId,
          actor === "you" ? playerMoveDetails : undefined,
        ),
      );
    }

    if (next.isBotBattle && actor === "you") {
      entries.push(
        createEntry(
          "opponent",
          resolvedBotMoveId ?? 0,
          buildBotResponseDetails(resolvedBotMoveId),
          resolvedBotMoveLabel ?? botFallbackLabel,
        ),
        createEntry("round", 0, roundResultDetails, "Round Result"),
      );
    }

    setActionLog((log) => [...log, ...entries]);
    lastLoggedActionKeyRef.current = transitionKey;
    lastMoveIdRef.current = 0;
  }

  return (
    <SuiWalletContext.Provider
      value={{
        address,
        isConnected,
        battleState,
        isWaiting,
        pvpQueueState,
        entryFeeMist,
        isMyTurn,
        actionLog,
        clearActionLog,
        joinBattle,
        startBotBattle,
        useAbility,
        claimTimeoutWin,
        forfeitBattle,
        adminForceClose,
        cancelQueue,
        refreshPvpQueueState,
        refreshActivePvpBattle,
        refreshCurrentBattleState,
        moveLifecycleStage,
        isMoveTransactionPending,
        isBattleRefreshPending,
        recoverableBattleError,
        dismissRecoverableBattleError,
        getFirstValidSaplingNft,
        ConnectWalletButton,
      }}
    >
      {children}
    </SuiWalletContext.Provider>
  );
}

export function useSuiWallet() {
  const ctx = useContext(SuiWalletContext);
  if (!ctx)
    throw new Error("useSuiWallet must be used within SuiWalletProvider");
  return ctx;
}
