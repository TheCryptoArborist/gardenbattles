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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleState {
  battleId: string | null;
  player1: string | null;
  player2: string | null;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  winner: string | null;
}

export interface NftData {
  nftId: string;
  nftType: string;
  location: "wallet" | "kiosk";
  kioskId?: string;
  kioskCapId?: string;
}

interface SuiWalletContextType {
  address: string | null;
  isConnected: boolean;
  battleState: BattleState | null;
  isWaiting: boolean;
  joinBattle: (nftData: NftData) => Promise<void>;
  useAbility: (abilityId: number) => Promise<void>;
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
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000")
).replace(/\/+$/, "");

const API_BASE_URL = RELAY_URL;

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [randomObjectId, setRandomObjectId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const address = currentAccount?.address ?? null;
  const isConnected = !!currentAccount;

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
      setBattleState(null);
      setIsWaiting(false);
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
        .then((r) => r.json())
        .then(({ state }) => {
          if (state && !state.winner) {
            console.log("[relay] restored battle state from HTTP");
            setBattleState(state);
            setIsWaiting(false);
            // Re-join the socket room
            socket.emit("join_battle", { battleId: state.battleId });
          }
        })
        .catch(() => {
          // No active battle – that's fine
        });
    });

    socket.on("battle_update", (state: BattleState) => {
      console.log("[relay] battle_update received:", state);
      setBattleState(state);

      // If opponent has now joined (player2 set), stop the waiting overlay
      if (state.player2 && state.player2 !== "0x0") {
        setIsWaiting(false);
      }
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
  }, [isConnected, address]);

  // ── 3. Scan wallet / kiosks for a valid NFT ───────────────────────────────
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

        // @ts-ignore
        const whitelisted = configObj?.data?.content?.fields?.whitelisted_collections;
        if (whitelisted && Array.isArray(whitelisted)) {
          const onChainTypes = whitelisted.map((t: any) => {
            // TypeName fields usually store the type string in a 'name' field
            let typeNameStr = typeof t === 'string' ? t : (t?.fields?.name || t);
            // Some TypeName representations might not start with 0x
            if (typeof typeNameStr === 'string' && !typeNameStr.startsWith('0x')) {
               typeNameStr = '0x' + typeNameStr;
            }
            return typeNameStr;
          });
          // Merge allowed types
          allowedTypes = [...new Set([...allowedTypes, ...onChainTypes])];
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
              if (id) return { nftId: id, nftType: type, location: "wallet" };
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
                  return {
                    nftId,
                    nftType: obj.data.type,
                    location: "kiosk",
                    kioskId,
                    kioskCapId: ownerCapId,
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

      // Balance check
      try {
        const balance = await suiClient.getBalance({ owner: address });
        const balSui = Number(balance.totalBalance) / 1e9;
        const needed = SUI_CONFIG.ENTRY_FEE / 1e9 + 0.1;
        if (balSui < needed) {
          throw new Error(
            `Insufficient balance: you have ${balSui.toFixed(2)} SUI but need ${needed} SUI`,
          );
        }
      } catch (e: any) {
        if (e.message?.includes("Insufficient")) throw e;
      }

      const tx = new Transaction();
      const [fee] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_CONFIG.ENTRY_FEE)]);

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
          { transaction: tx, chain: "sui:testnet" },
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
    [address, randomObjectId, suiClient, signAndExecuteTransaction],
  );

  // ── 5. Use an ability ─────────────────────────────────────────────────────
  const useAbility = useCallback(
    async (abilityId: number) => {
      if (!address || !randomObjectId || !battleState?.battleId) {
        throw new Error("Battle not active");
      }

      const tx = new Transaction();
      tx.moveCall({
        target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::use_ability_id`,
        arguments: [
          tx.object(battleState.battleId),
          tx.pure.u8(abilityId),
          tx.object(randomObjectId),
        ],
      });
      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx, chain: "sui:testnet" },
          {
            onSuccess: () => resolve(),
            onError: (err: any) =>
              reject(new Error(err?.message ?? "Failed to use ability")),
          },
        );
      });
    },
    [address, randomObjectId, battleState, signAndExecuteTransaction],
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

  return (
    <SuiWalletContext.Provider
      value={{
        address,
        isConnected,
        battleState,
        isWaiting,
        joinBattle,
        useAbility,
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
