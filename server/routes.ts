import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { storage } from "./storage";

// ─── Sui polling configuration ────────────────────────────────────────────────
const SUI_RPC_URL = "https://fullnode.testnet.sui.io:443";
const PACKAGE_ID =
  "0x7f9f3a5656d9efd93e1428ef40a3572cf8681178ff77ea6e2211dff848fcefb7";
const MODULE = "battle";
const BATTLE_UPDATE_EVENT = `${PACKAGE_ID}::${MODULE}::BattleUpdate`;
const POLL_INTERVAL_MS = 2_000; // poll every 2 s

// ─── In-memory battle state ────────────────────────────────────────────────────
interface BattleState {
  battleId: string;
  player1: string;
  player2: string;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  winner: string | null;
  lastEventCursor?: string | null;
}

// battleId → current state
const battles = new Map<string, BattleState>();

// address (lowercase) → battleId
const playerToBattle = new Map<string, string>();

// ─── Sui RPC helper ────────────────────────────────────────────────────────────
async function querySuiEvents(
  cursor: string | null = null,
  limit = 50,
): Promise<{ data: any[]; nextCursor: string | null; hasNextPage: boolean }> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "suix_queryEvents",
    params: [
      { MoveEventType: BATTLE_UPDATE_EVENT },
      cursor,
      limit,
      true, // descending so newest first
    ],
  };

  const res = await fetch(SUI_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Sui RPC error: ${res.status}`);
  const json = await res.json();

  if (json.error)
    throw new Error(`Sui RPC error: ${JSON.stringify(json.error)}`);

  return {
    data: json.result?.data ?? [],
    nextCursor: json.result?.nextCursor ?? null,
    hasNextPage: json.result?.hasNextPage ?? false,
  };
}

// ─── Parse a raw Sui event into our BattleState shape ─────────────────────────
function parseBattleEvent(parsedJson: any): BattleState | null {
  try {
    if (
      !parsedJson?.battle_id ||
      !parsedJson?.player1 ||
      !parsedJson?.player2
    ) {
      return null;
    }

    return {
      battleId: parsedJson.battle_id,
      player1: parsedJson.player1.toLowerCase(),
      player2: parsedJson.player2.toLowerCase(),
      player1Moves: parsedJson.player1_moves ?? [],
      player2Moves: parsedJson.player2_moves ?? [],
      player1Growth: Number(parsedJson.player1_growth ?? 0),
      player2Growth: Number(parsedJson.player2_growth ?? 0),
      winner:
        parsedJson.winner && parsedJson.winner !== "0x0"
          ? parsedJson.winner.toLowerCase()
          : null,
    };
  } catch {
    return null;
  }
}

// ─── Core poll – fetch recent events, update state, notify clients ─────────────
let io: SocketIOServer | null = null;

async function pollSuiEvents() {
  try {
    // We only need the most recent page (descending).
    const { data } = await querySuiEvents(null, 50);

    // Track newest event per battleId (data is descending, so first = newest)
    const seen = new Set<string>();

    for (const event of data) {
      const parsed = parseBattleEvent(event.parsedJson);
      if (!parsed) continue;

      const { battleId } = parsed;
      if (seen.has(battleId)) continue; // already processed newest for this battle
      seen.add(battleId);

      const existing = battles.get(battleId);

      // Skip if nothing changed (check growth, winner, and moves)
      if (
        existing &&
        existing.player1Growth === parsed.player1Growth &&
        existing.player2Growth === parsed.player2Growth &&
        existing.winner === parsed.winner &&
        JSON.stringify(existing.player1Moves) ===
          JSON.stringify(parsed.player1Moves) &&
        JSON.stringify(existing.player2Moves) ===
          JSON.stringify(parsed.player2Moves)
      ) {
        continue;
      }

      // Persist latest state
      battles.set(battleId, parsed);
      playerToBattle.set(parsed.player1, battleId);
      playerToBattle.set(parsed.player2, battleId);

      // Broadcast to the Socket.io room for this battle
      if (io) {
        io.to(`battle:${battleId}`).emit("battle_update", parsed);
        console.log(
          `[relay] battle ${battleId.slice(0, 8)}… p1=${parsed.player1Growth} p2=${parsed.player2Growth} winner=${parsed.winner ?? "none"}`,
        );
      }
    }
  } catch (err) {
    console.error("[relay] poll error:", err);
  }
}

// ─── registerRoutes ───────────────────────────────────────────────────────────
export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // ── Socket.io setup ─────────────────────────────────────────────────────────
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[relay] client connected: ${socket.id}`);

    // Client tells us which player address it is
    socket.on(
      "identify",
      (payload: { address: string }, ack?: (res: any) => void) => {
        const address = payload?.address?.toLowerCase();
        if (!address) return;

        socket.data.address = address;
        console.log(
          `[relay] identified ${socket.id} as ${address.slice(0, 8)}…`,
        );

        // If there's already an active battle for this player, auto-join the room
        const existingBattleId = playerToBattle.get(address);
        if (existingBattleId) {
          const state = battles.get(existingBattleId);
          if (state && !state.winner) {
            socket.join(`battle:${existingBattleId}`);
            socket.emit("battle_update", state);
            console.log(
              `[relay] rejoined ${address.slice(0, 8)}… to battle ${existingBattleId.slice(0, 8)}…`,
            );
          }
        }

        if (ack) ack({ ok: true });
      },
    );

    // Client explicitly joins a battle room (called after matchmaking)
    socket.on(
      "join_battle",
      (payload: { battleId: string }, ack?: (res: any) => void) => {
        const { battleId } = payload ?? {};
        if (!battleId) return;

        socket.join(`battle:${battleId}`);
        console.log(
          `[relay] ${socket.id} joined room battle:${battleId.slice(0, 8)}…`,
        );

        // Send current state immediately if we have it
        const state = battles.get(battleId);
        if (state) {
          socket.emit("battle_update", state);
        }

        if (ack) ack({ ok: true, state: state ?? null });
      },
    );

    // Client asks for latest state for a given player address
    socket.on(
      "get_battle_state",
      (payload: { address: string }, ack?: (res: any) => void) => {
        const address = payload?.address?.toLowerCase();
        if (!address || !ack) return;

        const battleId = playerToBattle.get(address);
        const state = battleId ? (battles.get(battleId) ?? null) : null;
        ack({ state });
      },
    );

    socket.on("disconnect", () => {
      console.log(`[relay] client disconnected: ${socket.id}`);
    });
  });

  // ── REST: health check ──────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, battles: battles.size, players: playerToBattle.size });
  });

  // ── REST: get battle state by player address ────────────────────────────────
  app.get("/api/battle/state/:address", (req, res) => {
    const address = req.params.address?.toLowerCase();
    const battleId = playerToBattle.get(address);
    if (!battleId) {
      return res.status(404).json({ error: "No active battle found" });
    }
    const state = battles.get(battleId);
    res.json({ state: state ?? null });
  });

  // ── Start Sui polling loop ──────────────────────────────────────────────────
  console.log(
    `[relay] starting Sui event polling every ${POLL_INTERVAL_MS / 1000}s`,
  );
  pollSuiEvents(); // immediate first poll
  setInterval(pollSuiEvents, POLL_INTERVAL_MS);

  return httpServer;
}
