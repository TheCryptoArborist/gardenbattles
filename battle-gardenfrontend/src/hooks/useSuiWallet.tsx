/**
 * useSuiWallet – battle state is now driven by the Socket.io relay server.
 *
 * Flow:
 *  1. On wallet connect → identify ourselves to the relay
 *  2. After join_queue tx succeeds → tell relay to subscribe us to that battle room
 *  3. Relay server polls Sui every 2 s and pushes "battle_update" events
 *  4. Both players receive identical state → UI stays in sync
 *  5. HTTP fallback: /api/battle/state/:address on reconnect / page refresh
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
import { io as socketIO, Socket } from "socket.io-client";
import { SUI_CONFIG, getBattleUpdateEvent } from "@/lib/sui-config";
import type { ActionEntry } from "@/components/BattleLog";

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
}

export interface NftData {
  nftId: string;
  nftType: string;
  location: "wallet" | "kiosk";
  kioskId?: string;
  kioskCapId?: string;
  imageUrl?: string;
}

interface SuiWalletContextType {
  address: string | null;
  isConnected: boolean;
  battleState: BattleState | null;
  isWaiting: boolean;
  entryFeeMist: number;
  isMyTurn: boolean;
  actionLog: ActionEntry[];
  clearActionLog: () => void;
  joinBattle: (nftData: NftData) => Promise<void>;
  startBotBattle: (nftData: NftData) => Promise<void>;
  useAbility: (abilityId: number) => Promise<void>;
  claimTimeoutWin: () => Promise<void>;
  forfeitBattle: () => Promise<void>;
  adminForceClose: (winner?: string) => Promise<void>;
  cancelQueue: () => Promise<any>;
  getFirstValidSaplingNft: (owner: string) => Promise<NftData | null>;
  ConnectWalletButton: () => JSX.Element;
}

const SuiWalletContext = createContext<SuiWalletContextType | null>(null);

// ─── Relay URL ────────────────────────────────────────────────────────────────
// In development the relay runs on the same host (Vite proxies /socket.io).
// In production the express server serves everything on one port.
const RELAY_URL = (
  import.meta.env.VITE_RELAY_URL ||
  (typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:5000")
).replace(/\/+$/, "");

const API_BASE_URL = RELAY_URL;

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const ACTIVE_BATTLE_STORAGE_PREFIX = "battle_garden_active_battle:";
const ACTIVE_BATTLE_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

interface CachedBattleState {
  version: 1;
  cachedAt: number;
  state: BattleState;
}

function battleStorageKey(address: string): string {
  return `${ACTIVE_BATTLE_STORAGE_PREFIX}${address.toLowerCase()}`;
}

function isZeroAddress(address: string | null | undefined): boolean {
  return !address || address === "0x0";
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

function parseBattleStateFromEvent(json: any): BattleState | null {
  if (!json?.battle_id || !json?.player1 || !json?.player2) return null;

  return {
    battleId: json.battle_id,
    player1: json.player1.toLowerCase(),
    player2: json.player2.toLowerCase(),
    player1Moves: json.player1_moves ?? [],
    player2Moves: json.player2_moves ?? [],
    player1Growth: Number(json.player1_growth ?? 0),
    player2Growth: Number(json.player2_growth ?? 0),
    turn: Number(json.turn ?? 0),
    winner: normalizeWinner(json.winner),
    finished: !!normalizeWinner(json.winner),
    isBotBattle: Boolean(json.is_bot_battle),
    lastMoveMs: Number(json.last_move_ms ?? 0),
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

function parseBattleStateFromObjectFields(
  battleId: string,
  fields: any,
): BattleState | null {
  if (!fields?.player1 || !fields?.player2) return null;

  return {
    battleId,
    player1: String(fields.player1).toLowerCase(),
    player2: String(fields.player2).toLowerCase(),
    player1Moves: normalizeMoveList(fields.p1_moves),
    player2Moves: normalizeMoveList(fields.p2_moves),
    player1Growth: Number(fields.p1_growth ?? 0),
    player2Growth: Number(fields.p2_growth ?? 0),
    turn: Number(fields.turn ?? 0),
    winner: normalizeWinner(fields.winner),
    finished: Boolean(fields.finished) || !!normalizeWinner(fields.winner),
    isBotBattle: Boolean(fields.is_bot_battle),
    lastMoveMs: Number(fields.last_move_ms ?? 0),
  };
}

async function getLiveBattleState(
  suiClient: any,
  battleId: string,
): Promise<BattleState | null | undefined> {
  try {
    const obj = await suiClient.getObject({
      id: battleId,
      options: { showContent: true },
    });
    const fields = (obj?.data?.content as any)?.fields;
    return parseBattleStateFromObjectFields(battleId, fields);
  } catch (err) {
    console.warn("[battle] could not verify live battle object:", err);
    return undefined;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [entryFeeMist, setEntryFeeMist] = useState<number>(
    SUI_CONFIG.ENTRY_FEE,
  );
  const [randomObjectId, setRandomObjectId] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<ActionEntry[]>([]);
  const prevBattleStateRef = useRef<BattleState | null>(null);
  const lastMoveIdRef = useRef<number>(0);
  const isWaitingRef = useRef(false);

  const socketRef = useRef<Socket | null>(null);
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

  const clearActionLog = useCallback(() => setActionLog([]), []);

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
    prevBattleStateRef.current = null;
    if (address) cacheBattleState(address, null);
  }, [address]);

  const applyBattleState = useCallback(
    async (
      nextState: BattleState | null,
      options: { verifyLive?: boolean } = {},
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
        buildActionLogEntry(prev, state, address);
        prevBattleStateRef.current = state;
        return state;
      });
      setIsWaiting(stateIsActive && isZeroAddress(state.player2));
    },
    [address, clearBattleState, suiClient],
  );

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

  // ── 2. Socket.io connection – lifecycle tied to wallet connection ──────────
  useEffect(() => {
    if (!isConnected || !address) {
      // Cleanup on disconnect
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearBattleState();
      return;
    }

    // Already connected
    if (socketRef.current?.connected) return;

    const socket = socketIO(RELAY_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[relay] socket connected:", socket.id);

      // Tell relay who we are
      socket.emit("identify", { address }, (res: any) => {
        console.log("[relay] identify ack:", res);
      });

      // Try to restore battle state from server (handles page refreshes)
      fetch(apiUrl(`/api/battle/state/${address}`))
        .then(async (r) => {
          if (!r.ok) {
            clearBattleState();
            return null;
          }
          return r.json();
        })
        .then((body) => {
          const state = body?.state;
          if (!state) {
            return;
          }
          if (isActiveBattleForAddress(state, address)) {
            console.log("[relay] restored battle state from HTTP");
            // Re-join the socket room
            socket.emit("join_battle", { battleId: state.battleId });
            void applyBattleState(state, { verifyLive: true });
          } else {
            if (!isWaitingRef.current) clearBattleState();
          }
        })
        .catch(() => {
          // No active battle - that's fine
        });
    });

    socket.on("battle_update", (state: BattleState) => {
      console.log("[relay] battle_update received:", state);
      void applyBattleState(state);
    });

    socket.on("disconnect", (reason) => {
      console.warn("[relay] socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.error("[relay] connection error:", err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isConnected, address, applyBattleState, clearBattleState]);

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
          const events = await suiClient.queryEvents({
            query: { MoveEventType: getBattleUpdateEvent() },
            limit: force ? 50 : 20,
            order: "descending",
          });

          for (const event of events.data) {
            if (cancelled) return;

            const newState = parseBattleStateFromEvent(event.parsedJson);

            // Is this battle relevant to us?
            if (battleBelongsToAddress(newState, address)) {
              // Update state if it's newer or we were waiting
              if (
                isWaiting ||
                JSON.stringify(newState) !== JSON.stringify(battleState)
              ) {
                console.log("[polling] detected battle update from blockchain");
                await applyBattleState(newState, { verifyLive: force });
              }
              break; // Found our most recent battle, stop searching
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
    }, 3000); // Poll every 3 seconds

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
        return null;
      }
    },
    [suiClient],
  );

  // ── 4. Join the battle queue ──────────────────────────────────────────────
  const joinBattle = useCallback(
    async (nftData: NftData) => {
      if (!address || !randomObjectId) {
        throw new Error(
          "Wallet not connected or random object not initialised",
        );
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
          target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::join_queue`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID),
            tx.object(nftData.nftId),
            fee,
            tx.object(randomObjectId),
          ],
        });
      } else if (nftData.kioskId && nftData.kioskCapId) {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::join_queue_from_kiosk`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID),
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
            onSuccess: (result) => {
              console.log("join_queue tx success:", result.digest);
              setIsWaiting(true);

              // Tell relay to watch for this player's battle
              socketRef.current?.emit("identify", { address });

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
    ],
  );

  // ── 5. Start a no-payout bot practice battle ─────────────────────────────
  const startBotBattle = useCallback(
    async (nftData: NftData) => {
      if (!address || !randomObjectId) {
        throw new Error(
          "Wallet not connected or random object not initialised",
        );
      }

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
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: () => {
              setIsWaiting(true);
              socketRef.current?.emit("identify", { address });
              resolve();
            },
            onError: (err: any) => {
              reject(new Error(err?.message ?? "Failed to start bot battle"));
            },
          },
        );
      });
    },
    [address, randomObjectId, signAndExecuteTransaction],
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
        target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::use_ability_id`,
        arguments: [
          tx.object(battleId),
          tx.pure.u8(abilityId),
          tx.object(randomObjectId),
        ],
      });
      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: () => resolve(),
            onError: (err: any) =>
              reject(new Error(err?.message ?? "Failed to use ability")),
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
    ],
  );

  const claimTimeoutWin = useCallback(async () => {
    if (!address || !battleState?.battleId) {
      throw new Error("Battle not active");
    }

    const battleId = battleState.battleId;
    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::claim_timeout_win`,
      arguments: [tx.object(battleId)],
    });
    tx.setSender(address);

    return new Promise<void>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx, chain: SUI_CONFIG.CHAIN },
        {
          onSuccess: async () => {
            const liveState = await getLiveBattleState(suiClient, battleId);
            if (liveState) {
              await applyBattleState({
                ...liveState,
                isBotBattle: battleState.isBotBattle,
              });
            }
            resolve();
          },
          onError: (err: any) =>
            reject(new Error(err?.message ?? "Failed to claim timeout win")),
        },
      );
    });
  }, [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState]);

  const forfeitBattle = useCallback(async () => {
    if (!address || !battleState?.battleId) {
      throw new Error("Battle not active");
    }

    const battleId = battleState.battleId;
    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::surrender`,
      arguments: [tx.object(battleId)],
    });
    tx.setSender(address);

    return new Promise<void>((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx, chain: SUI_CONFIG.CHAIN },
        {
          onSuccess: async () => {
            const liveState = await getLiveBattleState(suiClient, battleId);
            if (liveState) {
              await applyBattleState({
                ...liveState,
                isBotBattle: battleState.isBotBattle,
              });
            }
            resolve();
          },
          onError: (err: any) =>
            reject(new Error(err?.message ?? "Failed to forfeit battle")),
        },
      );
    });
  }, [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState]);

  const adminForceClose = useCallback(
    async (winner?: string) => {
      if (!address || !battleState?.battleId) {
        throw new Error("Battle not active");
      }

      const battleId = battleState.battleId;
      const tx = new Transaction();
      if (winner) {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::admin_force_close_with_winner`,
          arguments: [
            tx.object(battleId),
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.pure.address(winner),
          ],
        });
      } else {
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::admin_force_close`,
          arguments: [tx.object(battleId), tx.object(SUI_CONFIG.CONFIG_ID)],
        });
      }
      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: SUI_CONFIG.CHAIN },
          {
            onSuccess: async () => {
              const liveState = await getLiveBattleState(suiClient, battleId);
              if (liveState) {
                await applyBattleState({
                  ...liveState,
                  isBotBattle: battleState.isBotBattle,
                });
              }
              resolve();
            },
            onError: (err: any) =>
              reject(new Error(err?.message ?? "Failed to force close battle")),
          },
        );
      });
    },
    [address, battleState, signAndExecuteTransaction, suiClient, applyBattleState],
  );

  // ── 6. Cancel queue / emergency refund ───────────────────────────────────
  const cancelQueue = useCallback(async () => {
    if (!address) throw new Error("Wallet not connected");

    const tx = new Transaction();
    tx.moveCall({
      target: `${SUI_CONFIG.PACKAGE_ID}::matchmaking::cancel_queue`,
      arguments: [tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID)],
    });
    tx.setSender(address);

    // Dry-run first
    try {
      await tx.build({ client: suiClient });
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("108"))
        throw new Error("You are NOT in the queue. Nothing to refund.");
      if (msg.includes("102")) throw new Error("This is not your queue entry.");
      throw new Error(`Cannot refund: ${msg}`);
    }

    const result = await new Promise((resolve, reject) => {
      signAndExecuteTransaction(
        { transaction: tx },
        {
          onSuccess: (r) => {
            setIsWaiting(false);
            resolve(r);
          },
          onError: (e) => reject(e),
        },
      );
    });

    return result;
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
  ) {
    if (!prev || !myAddress) return;
    if (!next.battleId || next.battleId !== prev.battleId) return;

    const p1Changed = next.player1Growth !== prev.player1Growth;
    const p2Changed = next.player2Growth !== prev.player2Growth;
    if (!p1Changed && !p2Changed) return;

    const isP1 = prev.player1?.toLowerCase() === myAddress.toLowerCase();
    // Determine who just acted: if it was player1's turn (prev turn=0 implied by p1Growth change)
    // We detect the actor by whose growth changed (or opponent's decreased)
    // Heuristic: if p1 growth went up or p2 went down → player1 acted; otherwise player2
    const p1Acted =
      next.player1Growth > prev.player1Growth ||
      (next.player2Growth < prev.player2Growth &&
        next.player1Growth === prev.player1Growth);
    const actor: "you" | "opponent" =
      (isP1 && p1Acted) || (!isP1 && !p1Acted) ? "you" : "opponent";

    const entry: ActionEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      actor,
      moveId: actor === "you" ? lastMoveIdRef.current : 0,
      prevPlayerGrowth: isP1 ? prev.player1Growth : prev.player2Growth,
      nextPlayerGrowth: isP1 ? next.player1Growth : next.player2Growth,
      prevOpponentGrowth: isP1 ? prev.player2Growth : prev.player1Growth,
      nextOpponentGrowth: isP1 ? next.player2Growth : next.player1Growth,
    };

    setActionLog((log) => [...log, entry]);
  }

  return (
    <SuiWalletContext.Provider
      value={{
        address,
        isConnected,
        battleState,
        isWaiting,
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
