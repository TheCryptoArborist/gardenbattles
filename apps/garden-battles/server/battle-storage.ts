import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "battle-data.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function hasColumn(table: string, column: string): boolean {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).some(
    (row) => row.name === column,
  );
}

// ─── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS battle_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    battle_id TEXT UNIQUE NOT NULL,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    winner TEXT,
    is_bot_battle INTEGER DEFAULT 0,
    transaction_digest TEXT,
    finished_at INTEGER NOT NULL,
    recorded_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS player_stats (
    address TEXT PRIMARY KEY,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    total_battles INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    max_win_streak INTEGER DEFAULT 0,
    last_battle_at INTEGER,
    total_bot_wins INTEGER DEFAULT 0,
    total_bot_losses INTEGER DEFAULT 0,
    rank_title TEXT DEFAULT 'Seedling',
    badges TEXT DEFAULT '[]',
    updated_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );
`);

if (!hasColumn("battle_records", "transaction_digest")) {
  db.exec("ALTER TABLE battle_records ADD COLUMN transaction_digest TEXT");
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_records_transaction_digest
  ON battle_records(transaction_digest)
  WHERE transaction_digest IS NOT NULL;
`);

// ─── Rank Titles ───────────────────────────────────────────────────────────────
function getRankTitle(wins: number): string {
  if (wins >= 100) return "Last Tree Standing";
  if (wins >= 50) return "Canopy Elite";
  if (wins >= 25) return "Grove Champion";
  if (wins >= 10) return "Rooted Contender";
  if (wins >= 5) return "Sapling Scrapper";
  return "Seedling";
}

// ─── Achievement Badges ────────────────────────────────────────────────────────
interface BadgeDef {
  id: string;
  label: string;
  check: (stats: PlayerStatsRow) => boolean;
}

const BADGE_DEFS: BadgeDef[] = [
  { id: "first_blood", label: "First Blood", check: (s) => s.wins >= 1 },
  { id: "hot_streak", label: "Hot Streak", check: (s) => s.max_win_streak >= 5 },
  { id: "undefeated", label: "Undefeated", check: (s) => s.max_win_streak >= 10 },
  { id: "battle_hardened", label: "Battle Hardened", check: (s) => s.total_battles >= 100 },
  { id: "veteran", label: "Veteran", check: (s) => s.wins >= 50 },
  { id: "legend", label: "Legend", check: (s) => s.wins >= 100 },
  { id: "sharp_pruner", label: "Sharp Pruner", check: (s) => s.total_battles >= 10 && s.win_rate >= 0.7 },
  { id: "never_give_up", label: "Never Give Up", check: (s) => s.total_battles >= 50 && s.win_rate < 0.3 },
  { id: "social_butterfly", label: "Social Butterfly", check: (s) => {
    // Count unique opponents
    const row = db.prepare(
      "SELECT COUNT(DISTINCT CASE WHEN player1 = ? THEN player2 WHEN player2 = ? THEN player1 END) as cnt FROM battle_records WHERE (player1 = ? OR player2 = ?) AND winner IS NOT NULL"
    ).get(s.address, s.address, s.address, s.address) as any;
    return row?.cnt >= 10;
  }},
];

function calculateBadges(stats: PlayerStatsRow): string[] {
  return BADGE_DEFS
    .filter((def) => def.check(stats))
    .map((def) => def.id);
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface PlayerStatsRow {
  address: string;
  wins: number;
  losses: number;
  draws: number;
  total_battles: number;
  current_streak: number;
  max_win_streak: number;
  last_battle_at: number | null;
  total_bot_wins: number;
  total_bot_losses: number;
  rank_title: string;
  badges: string;
  win_rate: number;
  updated_at: number;
}

export interface BattleRecordRow {
  id: number;
  battle_id: string;
  player1: string;
  player2: string;
  winner: string | null;
  is_bot_battle: number;
  transaction_digest: string | null;
  finished_at: number;
  recorded_at: number;
}

export type LeaderboardMode = "pvp" | "bot" | "overall";

export interface LeaderboardEntry {
  rank: number;
  address: string;
  wins: number;
  losses: number;
  win_rate: number;
  current_streak: number;
  rank_title: string;
  badges: string[];
  total_battles: number;
  mode: LeaderboardMode;
  last_played: number | null;
  recent_result: "Win" | "Loss" | null;
  ranked: boolean;
}

// ─── Prepared statements ───────────────────────────────────────────────────────
const upsertBattleRecord = db.prepare(`
  INSERT OR IGNORE INTO battle_records (battle_id, player1, player2, winner, is_bot_battle, transaction_digest, finished_at, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const getPlayerStats = db.prepare(
  "SELECT * FROM player_stats WHERE address = ?"
);

const upsertPlayerStats = db.prepare(`
  INSERT INTO player_stats (address, wins, losses, draws, total_battles, current_streak, max_win_streak, last_battle_at, total_bot_wins, total_bot_losses, rank_title, badges, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(address) DO UPDATE SET
    wins = excluded.wins,
    losses = excluded.losses,
    draws = excluded.draws,
    total_battles = excluded.total_battles,
    current_streak = excluded.current_streak,
    max_win_streak = excluded.max_win_streak,
    last_battle_at = excluded.last_battle_at,
    total_bot_wins = excluded.total_bot_wins,
    total_bot_losses = excluded.total_bot_losses,
    rank_title = excluded.rank_title,
    badges = excluded.badges,
    updated_at = excluded.updated_at
`);

const getLeaderboardQuery = db.prepare(`
  SELECT address, wins, losses, total_battles, current_streak, rank_title, badges
  FROM player_stats
  WHERE total_battles > 0
  ORDER BY wins DESC, (CAST(wins AS REAL) / NULLIF(total_battles, 0)) DESC
  LIMIT ? OFFSET ?
`);

const getPlayerCount = db.prepare(
  "SELECT COUNT(*) as cnt FROM player_stats WHERE total_battles > 0"
);

const getRecentBattles = db.prepare(`
  SELECT * FROM battle_records
  WHERE (player1 = ? OR player2 = ?)
  ORDER BY finished_at DESC
  LIMIT ?
`);

const getGlobalRecentBattlesStmt = db.prepare(`
  SELECT * FROM battle_records
  WHERE is_bot_battle = 0
  ORDER BY finished_at DESC
  LIMIT ?
`);

const getBattleByBattleId = db.prepare(
  "SELECT * FROM battle_records WHERE battle_id = ?"
);

const getCompletedBattlesStmt = db.prepare(`
  SELECT * FROM battle_records
  WHERE winner IS NOT NULL
  ORDER BY finished_at DESC, recorded_at DESC
`);

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface TrackBattleInput {
  battleId: string;
  player1: string;
  player2: string;
  winner: string | null;
  isBotBattle: boolean;
  transactionDigest?: string | null;
  finishedAt: number;
}

export function trackBattle(input: TrackBattleInput): void {
  const now = Date.now();

  // Insert battle record (skip if already tracked)
  const result = upsertBattleRecord.run(
    input.battleId,
    input.player1,
    input.player2,
    input.winner || null,
    input.isBotBattle ? 1 : 0,
    input.transactionDigest || null,
    input.finishedAt,
    now,
  );
  if (result.changes === 0) return; // already recorded

  // Update both player stats
  const players = [input.player1, input.player2];
  for (const address of players) {
    const existing = getPlayerStats.get(address) as PlayerStatsRow | undefined;
    const stats = existing
      ? { ...existing }
      : {
          address,
          wins: 0,
          losses: 0,
          draws: 0,
          total_battles: 0,
          current_streak: 0,
          max_win_streak: 0,
          last_battle_at: null,
          total_bot_wins: 0,
          total_bot_losses: 0,
          rank_title: "Seedling",
          badges: "[]",
          win_rate: 0,
          updated_at: 0,
        };

    if (input.isBotBattle) {
      if (input.winner === address) stats.total_bot_wins++;
      else if (input.winner && input.winner !== address) stats.total_bot_losses++;
    } else {
      if (input.winner === address) {
        stats.wins++;
        stats.current_streak = Math.max(0, stats.current_streak) + 1;
        stats.max_win_streak = Math.max(stats.max_win_streak, stats.current_streak);
      } else if (input.winner && input.winner !== address) {
        stats.losses++;
        stats.current_streak = Math.min(0, stats.current_streak) - 1;
      }
      // If winner is null (shouldn't normally happen but just in case): no change to streak
    }

    stats.total_battles = stats.wins + stats.losses + stats.draws + stats.total_bot_wins + stats.total_bot_losses;
    stats.last_battle_at = now;
    stats.win_rate = stats.total_battles > 0 ? stats.wins / stats.total_battles : 0;
    stats.rank_title = getRankTitle(stats.wins);
    stats.updated_at = now;

    // Recalculate badges
    const newBadges = calculateBadges(stats);
    stats.badges = JSON.stringify(newBadges);

    upsertPlayerStats.run(
      stats.address,
      stats.wins,
      stats.losses,
      stats.draws,
      stats.total_battles,
      stats.current_streak,
      stats.max_win_streak,
      stats.last_battle_at,
      stats.total_bot_wins,
      stats.total_bot_losses,
      stats.rank_title,
      stats.badges,
      stats.updated_at,
    );
  }
}

export function getPlayerStatsByAddress(address: string): PlayerStatsRow | null {
  const row = getPlayerStats.get(address.toLowerCase()) as PlayerStatsRow | undefined;
  if (!row) return null;
  row.win_rate = row.total_battles > 0 ? row.wins / row.total_battles : 0;
  row.badges = JSON.stringify(calculateBadges(row));
  return row;
}

interface DerivedLeaderboardStats {
  address: string;
  wins: number;
  losses: number;
  current_streak: number;
  max_win_streak: number;
  last_played: number | null;
  last_win_at: number | null;
  recent_result: "Win" | "Loss" | null;
}

function createDerivedStats(address: string): DerivedLeaderboardStats {
  return {
    address,
    wins: 0,
    losses: 0,
    current_streak: 0,
    max_win_streak: 0,
    last_played: null,
    last_win_at: null,
    recent_result: null,
  };
}

function includeBattleInMode(record: BattleRecordRow, mode: LeaderboardMode): boolean {
  if (mode === "overall") return true;
  if (mode === "bot") return record.is_bot_battle === 1;
  return record.is_bot_battle === 0;
}

function addResult(
  statsByAddress: Map<string, DerivedLeaderboardStats>,
  address: string,
  won: boolean,
  finishedAt: number,
) {
  const normalized = address.toLowerCase();
  const stats = statsByAddress.get(normalized) ?? createDerivedStats(normalized);
  if (won) {
    stats.wins += 1;
    stats.current_streak = Math.max(0, stats.current_streak) + 1;
    stats.max_win_streak = Math.max(stats.max_win_streak, stats.current_streak);
    stats.last_win_at = Math.max(stats.last_win_at ?? 0, finishedAt);
  } else {
    stats.losses += 1;
    stats.current_streak = Math.min(0, stats.current_streak) - 1;
  }
  if (!stats.last_played || finishedAt > stats.last_played) {
    stats.last_played = finishedAt;
    stats.recent_result = won ? "Win" : "Loss";
  }
  statsByAddress.set(normalized, stats);
}

function getDerivedLeaderboard(mode: LeaderboardMode): DerivedLeaderboardStats[] {
  const records = getCompletedBattlesStmt.all() as BattleRecordRow[];
  const statsByAddress = new Map<string, DerivedLeaderboardStats>();

  for (const record of records) {
    if (!record.winner || !includeBattleInMode(record, mode)) continue;
    const winner = record.winner.toLowerCase();
    const player1 = record.player1.toLowerCase();
    const player2 = record.player2.toLowerCase();

    if (record.is_bot_battle === 1) {
      addResult(statsByAddress, player1, winner === player1, record.finished_at);
      continue;
    }

    addResult(statsByAddress, player1, winner === player1, record.finished_at);
    addResult(statsByAddress, player2, winner === player2, record.finished_at);
  }

  return Array.from(statsByAddress.values());
}

export function getLeaderboard(
  limit = 50,
  offset = 0,
  mode: LeaderboardMode = "pvp",
): LeaderboardEntry[] {
  const rows = getDerivedLeaderboard(mode).sort((a, b) => {
    const aTotal = a.wins + a.losses;
    const bTotal = b.wins + b.losses;
    const aRanked = aTotal >= 3 ? 1 : 0;
    const bRanked = bTotal >= 3 ? 1 : 0;
    const aRate = aTotal > 0 ? a.wins / aTotal : 0;
    const bRate = bTotal > 0 ? b.wins / bTotal : 0;

    return (
      bRanked - aRanked ||
      b.wins - a.wins ||
      bRate - aRate ||
      bTotal - aTotal ||
      (b.last_win_at ?? 0) - (a.last_win_at ?? 0)
    );
  });

  return rows.slice(offset, offset + limit).map((row, i) => {
    const totalBattles = row.wins + row.losses;
    const stats: PlayerStatsRow = {
      address: row.address,
      wins: row.wins,
      losses: row.losses,
      draws: 0,
      total_battles: totalBattles,
      current_streak: row.current_streak,
      max_win_streak: row.max_win_streak,
      last_battle_at: row.last_played,
      total_bot_wins: 0,
      total_bot_losses: 0,
      rank_title: getRankTitle(row.wins),
      badges: "[]",
      win_rate: totalBattles > 0 ? row.wins / totalBattles : 0,
      updated_at: row.last_played ?? 0,
    };
    const badges = calculateBadges(stats);

    return {
      rank: offset + i + 1,
      address: row.address,
      wins: row.wins,
      losses: row.losses,
      win_rate: totalBattles > 0 ? +(row.wins / totalBattles).toFixed(4) : 0,
      current_streak: row.current_streak,
      rank_title: stats.rank_title,
      badges,
      total_battles: totalBattles,
      mode,
      last_played: row.last_played,
      recent_result: row.recent_result,
      ranked: totalBattles >= 3,
    };
  });
}

export function getTotalPlayers(mode: LeaderboardMode = "pvp"): number {
  return getDerivedLeaderboard(mode).length;
}

export function getPlayerLeaderboardStats(
  address: string,
  mode: LeaderboardMode = "pvp",
): LeaderboardEntry | null {
  const normalized = address.toLowerCase();
  return (
    getLeaderboard(Number.MAX_SAFE_INTEGER, 0, mode).find(
      (entry) => entry.address === normalized,
    ) ?? null
  );
}

export function getRecentBattlesByAddress(
  address: string,
  limit = 20,
): BattleRecordRow[] {
  return getRecentBattles.all(address.toLowerCase(), address.toLowerCase(), limit) as BattleRecordRow[];
}

export function getGlobalRecentBattles(limit = 20): BattleRecordRow[] {
  return getGlobalRecentBattlesStmt.all(limit) as BattleRecordRow[];
}

export function getBattleByOnChainId(battleId: string): BattleRecordRow | null {
  return (getBattleByBattleId.get(battleId) as BattleRecordRow) ?? null;
}
