import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer, type Socket } from "socket.io";
import { SuiClient } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { storage } from "./storage";
import {
  trackBattle,
  getBattleByOnChainId,
  getPlayerStatsByAddress,
  getLeaderboard,
  getTotalPlayers,
  getRecentBattlesByAddress,
  getGlobalRecentBattles,
} from "./battle-storage";

// ─── Sui polling configuration ────────────────────────────────────────────────
const SUI_RPC_URL =
  process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443";
const PACKAGE_ID =
  process.env.BATTLE_PACKAGE_ID ||
  process.env.PACKAGE_ID ||
  "0x50864e060caca53c7c50a355f7550276b52f91a0bd1e7b1e54ac9dbb754ef299";
const EVENT_PACKAGE_ID =
  process.env.BATTLE_EVENT_PACKAGE_ID ||
  process.env.BATTLE_ORIGINAL_PACKAGE_ID ||
  "0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b";
const MODULE = process.env.BATTLE_MODULE || "battle";
const BATTLE_UPDATE_EVENT = `${EVENT_PACKAGE_ID}::${MODULE}::BattleUpdate`;
const POLL_INTERVAL_MS = 2_000; // poll every 2 s
const RANDOM_OBJECT_ID = process.env.SUI_RANDOM_OBJECT_ID || "0x8";

// ─── Bot configuration ───────────────────────────────────────────────────────
const BOT_PRIVATE_KEY = process.env.BATTLE_BOT_PRIVATE_KEY;
const BOT_MOVE_DELAY_MS = Number(process.env.BATTLE_BOT_MOVE_DELAY_MS ?? 1_500);
const botClient = new SuiClient({ url: SUI_RPC_URL });
const botKeypair = BOT_PRIVATE_KEY
  ? (() => {
      const parsed = decodeSuiPrivateKey(BOT_PRIVATE_KEY);
      if (parsed.schema !== "ED25519") {
        throw new Error("BATTLE_BOT_PRIVATE_KEY must be an ED25519 Sui key");
      }
      return Ed25519Keypair.fromSecretKey(parsed.secretKey);
    })()
  : null;
const BOT_ADDRESS =
  process.env.BATTLE_BOT_ADDRESS?.toLowerCase() ||
  botKeypair?.getPublicKey().toSuiAddress().toLowerCase() ||
  null;
const processedBotTurns = new Set<string>();

// ─── In-memory battle state ────────────────────────────────────────────────────
interface BattleState {
  battleId: string;
  player1: string;
  player2: string;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  turn: number;
  winner: string | null;
  finished?: boolean;
  isBotBattle?: boolean;
  lastMoveMs?: number;
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

    const player1 = parsedJson.player1.toLowerCase();
    const player2 = parsedJson.player2.toLowerCase();
    const winner = normalizeWinner(parsedJson.winner);
    const parsedTurn = Number(parsedJson.turn);

    return {
      battleId: parsedJson.battle_id,
      player1,
      player2,
      player1Moves: parsedJson.player1_moves ?? [],
      player2Moves: parsedJson.player2_moves ?? [],
      player1Growth: Number(parsedJson.player1_growth ?? 0),
      player2Growth: Number(parsedJson.player2_growth ?? 0),
      turn: Number.isFinite(parsedTurn) ? parsedTurn : 0,
      winner,
      finished: !!winner,
      isBotBattle:
        Boolean(parsedJson.is_bot_battle) ||
        (!!BOT_ADDRESS && (player1 === BOT_ADDRESS || player2 === BOT_ADDRESS)),
      lastMoveMs: Number(parsedJson.last_move_ms ?? 0),
    };
  } catch {
    return null;
  }
}

async function hydrateBattleState(
  eventState: BattleState,
): Promise<BattleState> {
  try {
    const object = await botClient.getObject({
      id: eventState.battleId,
      options: { showContent: true },
    });
    const fields = (object.data?.content as any)?.fields;
    if (!fields?.player1 || !fields?.player2) return eventState;

    const winner = normalizeWinner(fields.winner);
    return {
      battleId: eventState.battleId,
      player1: String(fields.player1).toLowerCase(),
      player2: String(fields.player2).toLowerCase(),
      player1Moves: (fields.p1_moves ?? []).map(Number),
      player2Moves: (fields.p2_moves ?? []).map(Number),
      player1Growth: Number(fields.p1_growth ?? 0),
      player2Growth: Number(fields.p2_growth ?? 0),
      turn: Number(fields.turn ?? 0),
      winner,
      finished: Boolean(fields.finished) || !!winner,
      isBotBattle: Boolean(fields.is_bot_battle),
      lastMoveMs: Number(fields.last_move_ms ?? 0),
    };
  } catch (err) {
    console.warn(
      `[relay] could not hydrate battle ${eventState.battleId.slice(0, 8)}...`,
      err,
    );
    return eventState;
  }
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

function chooseBotMove(state: BattleState, botIsPlayer1: boolean): number | null {
  const moves = botIsPlayer1 ? state.player1Moves : state.player2Moves;
  if (!moves.length) return null;

  const botGrowth = botIsPlayer1 ? state.player1Growth : state.player2Growth;
  const opponentGrowth = botIsPlayer1 ? state.player2Growth : state.player1Growth;

  const available = new Set(moves);
  const firstAvailable = (ids: number[]) => ids.find((id) => available.has(id));

  if (botGrowth >= 82) {
    const finisher = firstAvailable([25, 26, 24, 22, 30, 28, 21, 20]);
    if (finisher) return finisher;
  }

  if (opponentGrowth >= 80) {
    const defense = firstAvailable([27, 8, 29, 11, 3, 7, 1, 5]);
    if (defense) return defense;
  }

  return (
    firstAvailable([26, 25, 24, 22, 11, 3, 30, 28, 21, 20, 9, 7, 1, 5, 13, 8]) ??
    moves[Math.floor(Math.random() * moves.length)] ??
    null
  );
}

async function maybeRunBotTurn(state: BattleState) {
  if (!botKeypair || !BOT_ADDRESS || state.winner) return;

  const botIsPlayer1 = state.player1 === BOT_ADDRESS;
  const botIsPlayer2 = state.player2 === BOT_ADDRESS;
  if (!botIsPlayer1 && !botIsPlayer2) return;

  const isBotTurn =
    (botIsPlayer1 && state.turn === 0) || (botIsPlayer2 && state.turn === 1);
  if (!isBotTurn) return;

  const turnKey = [
    state.battleId,
    state.turn,
    state.player1Growth,
    state.player2Growth,
    state.player1Moves.join(","),
    state.player2Moves.join(","),
  ].join(":");
  if (processedBotTurns.has(turnKey)) return;
  processedBotTurns.add(turnKey);

  const moveId = chooseBotMove(state, botIsPlayer1);
  if (!moveId) return;

  setTimeout(async () => {
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::${MODULE}::use_ability_id`,
        arguments: [
          tx.object(state.battleId),
          tx.pure.u8(moveId),
          tx.object(RANDOM_OBJECT_ID),
        ],
      });

      const result = await botClient.signAndExecuteTransaction({
        signer: botKeypair,
        transaction: tx,
        options: { showEffects: true },
      });

      console.log(
        `[bot] battle ${state.battleId.slice(0, 8)}… used move ${moveId}; tx=${result.digest}`,
      );
    } catch (err) {
      processedBotTurns.delete(turnKey);
      console.error("[bot] failed to submit move:", err);
    }
  }, BOT_MOVE_DELAY_MS);
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
      const eventState = parseBattleEvent(event.parsedJson);
      if (!eventState) continue;
      const parsed = await hydrateBattleState(eventState);

      const { battleId } = parsed;
      if (seen.has(battleId)) continue; // already processed newest for this battle
      seen.add(battleId);

      const existing = battles.get(battleId);

      // Skip if nothing changed (check growth, winner, and moves)
      if (
        existing &&
        existing.player1Growth === parsed.player1Growth &&
        existing.player2Growth === parsed.player2Growth &&
        existing.turn === parsed.turn &&
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
      if (parsed.winner) {
        // Track finished battle for leaderboard/stats (only once per battle)
        const alreadyTracked = getBattleByOnChainId(battleId);
        if (!alreadyTracked) {
          trackBattle({
            battleId,
            player1: parsed.player1,
            player2: parsed.player2,
            winner: parsed.winner,
            isBotBattle: parsed.isBotBattle ?? false,
            finishedAt: parsed.lastMoveMs ?? Date.now(),
          });
        }

        if (playerToBattle.get(parsed.player1) === battleId) {
          playerToBattle.delete(parsed.player1);
        }
        if (playerToBattle.get(parsed.player2) === battleId) {
          playerToBattle.delete(parsed.player2);
        }
      } else {
        playerToBattle.set(parsed.player1, battleId);
        playerToBattle.set(parsed.player2, battleId);
      }
      void maybeRunBotTurn(parsed);

      // Broadcast to the Socket.io room for this battle
      if (io) {
        io.to(`battle:${battleId}`).emit("battle_update", parsed);
        console.log(
          `[relay] battle ${battleId.slice(0, 8)}… p1=${parsed.player1Growth} p2=${parsed.player2Growth} turn=${parsed.turn} winner=${parsed.winner ?? "none"}`,
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
        ack({ state: state && !state.winner ? state : null });
      },
    );

    socket.on("disconnect", () => {
      console.log(`[relay] client disconnected: ${socket.id}`);
    });
  });

  // ── REST: health check ──────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      battles: battles.size,
      players: playerToBattle.size,
      bot: { enabled: !!botKeypair, address: BOT_ADDRESS },
    });
  });

  // ── REST: expose bot address so the client can create practice battles ─────
  app.get("/api/battle/bot", (_req, res) => {
    if (!BOT_ADDRESS) {
      return res
        .status(503)
        .json({ error: "Battle bot is not configured on this server" });
    }
    res.json({ address: BOT_ADDRESS });
  });

  // ── REST: get battle state by player address ────────────────────────────────
  app.get("/api/battle/state/:address", (req, res) => {
    const address = req.params.address?.toLowerCase();
    const battleId = playerToBattle.get(address);
    if (!battleId) {
      return res.status(404).json({ error: "No active battle found" });
    }
    const state = battles.get(battleId);
    if (!state || state.winner) {
      return res.status(404).json({ error: "No active battle found" });
    }
    res.json({ state: state ?? null });
  });

  // ── REST: Leaderboard ────────────────────────────────────────────────────────
  app.get("/api/leaderboard", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const entries = getLeaderboard(limit, offset);
    res.json({
      leaderboard: entries,
      total: getTotalPlayers(),
      limit,
      offset,
    });
  });

  // ── REST: Player stats ────────────────────────────────────────────────────────
  app.get("/api/player/:address/stats", (req, res) => {
    const address = req.params.address?.toLowerCase();
    if (!address) return res.status(400).json({ error: "Address required" });

    const stats = getPlayerStatsByAddress(address);
    if (!stats) {
      return res.json({
        address,
        wins: 0,
        losses: 0,
        total_battles: 0,
        current_streak: 0,
        max_win_streak: 0,
        rank_title: "Seedling",
        badges: [],
        win_rate: 0,
        total_bot_wins: 0,
        total_bot_losses: 0,
      });
    }

    res.json({
      address: stats.address,
      wins: stats.wins,
      losses: stats.losses,
      total_battles: stats.total_battles,
      current_streak: stats.current_streak,
      max_win_streak: stats.max_win_streak,
      rank_title: stats.rank_title,
      badges: JSON.parse(stats.badges || "[]"),
      win_rate: +stats.win_rate.toFixed(4),
      total_bot_wins: stats.total_bot_wins,
      total_bot_losses: stats.total_bot_losses,
    });
  });

  // ── REST: Player recent battles ────────────────────────────────────────────────
  app.get("/api/player/:address/battles", (req, res) => {
    const address = req.params.address?.toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (!address) return res.status(400).json({ error: "Address required" });

    const battles = getRecentBattlesByAddress(address, limit);
    res.json({ battles });
  });

  // ── REST: Global recent battles ────────────────────────────────────────────────
  app.get("/api/battles/recent", (_req, res) => {
    const limit = Math.min(Number(_req.query.limit) || 20, 50);
    const battles = getGlobalRecentBattles(limit);
    res.json({ battles });
  });

  // ── REST: Top players endpoint (aliased for leaderboard page) ─────────────────
  app.get("/api/top-players", (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 100);
    const entries = getLeaderboard(limit, 0);
    res.json(entries);
  });

  // ── Start Sui polling loop ──────────────────────────────────────────────────
  console.log(
    `[relay] starting Sui event polling every ${POLL_INTERVAL_MS / 1000}s`,
  );
  pollSuiEvents(); // immediate first poll
  setInterval(pollSuiEvents, POLL_INTERVAL_MS);

  return httpServer;
}
