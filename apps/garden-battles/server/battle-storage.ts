import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "battle-data.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ────────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS battle_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    battle_id TEXT UNIQUE NOT NULL,
    player1 TEXT NOT NULL,
    player2 TEXT NOT NULL,
    winner TEXT,
    is_bot_battle INTEGER DEFAULT 0,
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
  finished_at: number;
  recorded_at: number;
}

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
}

// ─── Prepared statements ───────────────────────────────────────────────────────
const upsertBattleRecord = db.prepare(`
  INSERT OR IGNORE INTO battle_records (battle_id, player1, player2, winner, is_bot_battle, finished_at, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
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

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface TrackBattleInput {
  battleId: string;
  player1: string;
  player2: string;
  winner: string | null;
  isBotBattle: boolean;
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

export function getLeaderboard(limit = 50, offset = 0): LeaderboardEntry[] {
  const rows = getLeaderboardQuery.all(limit, offset) as any[];
  return rows.map((row, i) => {
    const stats: PlayerStatsRow = { ...row, win_rate: row.total_battles > 0 ? row.wins / row.total_battles : 0, draws: 0, current_streak: row.current_streak ?? 0, max_win_streak: 0, last_battle_at: null, total_bot_wins: 0, total_bot_losses: 0, updated_at: 0, badges: row.badges ?? "[]" };
    const badges = calculateBadges(stats);
    return {
      rank: offset + i + 1,
      address: row.address,
      wins: row.wins,
      losses: row.losses,
      win_rate: row.total_battles > 0 ? +(row.wins / row.total_battles).toFixed(4) : 0,
      current_streak: row.current_streak ?? 0,
      rank_title: row.rank_title ?? "Seedling",
      badges,
      total_battles: row.total_battles,
    };
  });
}

export function getTotalPlayers(): number {
  const row = getPlayerCount.get() as any;
  return row?.cnt ?? 0;
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
