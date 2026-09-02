import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.GARDEN_BATTLES_DB_PATH
  ? path.resolve(process.env.GARDEN_BATTLES_DB_PATH)
  : process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR, "battle-data.db")
    : path.resolve(__dirname, "..", "battle-data.db");

mkdirSync(path.dirname(DB_PATH), { recursive: true });

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
    battle_version TEXT DEFAULT 'legacy',
    target_growth INTEGER,
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
    rank_title TEXT DEFAULT 'Grove Recruit',
    badges TEXT DEFAULT '[]',
    updated_at INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS pvp_queue_telegram_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_entry_key TEXT UNIQUE NOT NULL,
    queue_id TEXT NOT NULL,
    waiting_wallet TEXT NOT NULL,
    queue_object_version TEXT,
    previous_transaction TEXT,
    entry_fee_mist INTEGER NOT NULL,
    target_growth INTEGER,
    queue_label TEXT,
    queue_type TEXT,
    telegram_message_id TEXT,
    notified_at INTEGER,
    resolved_at INTEGER,
    active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS telegram_alert_destinations (
    chat_id TEXT NOT NULL,
    message_thread_id INTEGER NOT NULL DEFAULT 0,
    chat_title TEXT,
    configured_by TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (chat_id, message_thread_id)
  );

  CREATE TABLE IF NOT EXISTS arborist_trial_results (
    challenge_id TEXT NOT NULL,
    challenge_date TEXT NOT NULL,
    wallet TEXT NOT NULL,
    score INTEGER NOT NULL,
    won INTEGER NOT NULL,
    rounds INTEGER NOT NULL,
    player_growth INTEGER NOT NULL,
    bot_growth INTEGER NOT NULL,
    unique_moves INTEGER NOT NULL,
    completed_at INTEGER NOT NULL,
    PRIMARY KEY (challenge_id, wallet)
  );
`);

if (!hasColumn("battle_records", "transaction_digest")) {
  db.exec("ALTER TABLE battle_records ADD COLUMN transaction_digest TEXT");
}
if (!hasColumn("battle_records", "battle_version")) {
  db.exec("ALTER TABLE battle_records ADD COLUMN battle_version TEXT DEFAULT 'legacy'");
}
if (!hasColumn("battle_records", "target_growth")) {
  db.exec("ALTER TABLE battle_records ADD COLUMN target_growth INTEGER");
}
if (!hasColumn("pvp_queue_telegram_alerts", "target_growth")) {
  db.exec("ALTER TABLE pvp_queue_telegram_alerts ADD COLUMN target_growth INTEGER");
}
if (!hasColumn("pvp_queue_telegram_alerts", "queue_label")) {
  db.exec("ALTER TABLE pvp_queue_telegram_alerts ADD COLUMN queue_label TEXT");
}
if (!hasColumn("pvp_queue_telegram_alerts", "queue_type")) {
  db.exec("ALTER TABLE pvp_queue_telegram_alerts ADD COLUMN queue_type TEXT");
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_battle_records_transaction_digest
  ON battle_records(transaction_digest)
  WHERE transaction_digest IS NOT NULL;
`);

// ─── Rank Titles ───────────────────────────────────────────────────────────────
function getRankTitle(wins: number, totalBattles: number): string {
  if (totalBattles < 3) return "Grove Recruit";
  if (wins >= 100) return "Elderroot Titan";
  if (wins >= 50) return "Canopy Champion";
  if (wins >= 25) return "Grove Striker";
  if (wins >= 10) return "Thorn Challenger";
  return "Rooted Fighter";
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
  battle_version: string | null;
  target_growth: number | null;
  transaction_digest: string | null;
  finished_at: number;
  recorded_at: number;
}

export interface PvpQueueTelegramAlertRow {
  id: number;
  queue_entry_key: string;
  queue_id: string;
  waiting_wallet: string;
  queue_object_version: string | null;
  previous_transaction: string | null;
  entry_fee_mist: number;
  target_growth: number | null;
  queue_label: string | null;
  queue_type: string | null;
  telegram_message_id: string | null;
  notified_at: number | null;
  resolved_at: number | null;
  active: number;
  created_at: number;
  updated_at: number;
}

export interface TelegramAlertDestinationRow {
  chat_id: string;
  message_thread_id: number;
  chat_title: string | null;
  configured_by: string;
  enabled: number;
  created_at: number;
  updated_at: number;
}

export interface EnableTelegramAlertDestinationInput {
  chatId: string;
  messageThreadId?: number | null;
  chatTitle?: string | null;
  configuredBy: string;
}

export interface ArboristTrialResultRow {
  challenge_id: string;
  challenge_date: string;
  wallet: string;
  score: number;
  won: number;
  rounds: number;
  player_growth: number;
  bot_growth: number;
  unique_moves: number;
  completed_at: number;
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
  pvp_target_counts?: {
    quick_50: number;
    standard_75: number;
    legacy_100: number;
  };
}

// ─── Prepared statements ───────────────────────────────────────────────────────
const upsertBattleRecord = db.prepare(`
  INSERT OR IGNORE INTO battle_records (battle_id, player1, player2, winner, is_bot_battle, battle_version, target_growth, transaction_digest, finished_at, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

const getBattleByTransactionDigestStmt = db.prepare(
  "SELECT * FROM battle_records WHERE transaction_digest = ?"
);

const getActivePvpQueueAlertStmt = db.prepare(`
  SELECT * FROM pvp_queue_telegram_alerts
  WHERE queue_id = ? AND active = 1
  ORDER BY updated_at DESC
  LIMIT 1
`);

const getPvpQueueAlertByKeyStmt = db.prepare(`
  SELECT * FROM pvp_queue_telegram_alerts
  WHERE queue_entry_key = ?
`);

const upsertNotifiedPvpQueueAlertStmt = db.prepare(`
  INSERT INTO pvp_queue_telegram_alerts (
    queue_entry_key,
    queue_id,
    waiting_wallet,
    queue_object_version,
    previous_transaction,
    entry_fee_mist,
    target_growth,
    queue_label,
    queue_type,
    telegram_message_id,
    notified_at,
    resolved_at,
    active,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)
  ON CONFLICT(queue_entry_key) DO UPDATE SET
    telegram_message_id = excluded.telegram_message_id,
    notified_at = excluded.notified_at,
    resolved_at = NULL,
    active = 1,
    updated_at = excluded.updated_at
`);

const resolvePvpQueueAlertStmt = db.prepare(`
  UPDATE pvp_queue_telegram_alerts
  SET active = 0,
      resolved_at = COALESCE(resolved_at, ?),
      updated_at = ?
  WHERE queue_entry_key = ? AND active = 1
`);

const resolveActivePvpQueueAlertsStmt = db.prepare(`
  UPDATE pvp_queue_telegram_alerts
  SET active = 0,
      resolved_at = COALESCE(resolved_at, ?),
      updated_at = ?
  WHERE queue_id = ? AND active = 1
`);

const getCompletedBattlesStmt = db.prepare(`
  SELECT * FROM battle_records
  WHERE winner IS NOT NULL
  ORDER BY finished_at ASC, recorded_at ASC
`);

const listTelegramAlertDestinationsStmt = db.prepare(`
  SELECT * FROM telegram_alert_destinations
  WHERE enabled = 1
  ORDER BY created_at ASC
`);

const getTelegramAlertDestinationStmt = db.prepare(`
  SELECT * FROM telegram_alert_destinations
  WHERE chat_id = ? AND message_thread_id = ?
`);

const enableTelegramAlertDestinationStmt = db.prepare(`
  INSERT INTO telegram_alert_destinations (
    chat_id, message_thread_id, chat_title, configured_by,
    enabled, created_at, updated_at
  ) VALUES (?, ?, ?, ?, 1, ?, ?)
  ON CONFLICT(chat_id, message_thread_id) DO UPDATE SET
    chat_title = excluded.chat_title,
    configured_by = excluded.configured_by,
    enabled = 1,
    updated_at = excluded.updated_at
`);

const disableTelegramAlertDestinationStmt = db.prepare(`
  UPDATE telegram_alert_destinations
  SET enabled = 0, updated_at = ?
  WHERE chat_id = ? AND message_thread_id = ?
`);

const getArboristTrialResultStmt = db.prepare(`
  SELECT * FROM arborist_trial_results
  WHERE challenge_id = ? AND wallet = ?
`);

const insertArboristTrialResultStmt = db.prepare(`
  INSERT OR IGNORE INTO arborist_trial_results (
    challenge_id, challenge_date, wallet, score, won, rounds,
    player_growth, bot_growth, unique_moves, completed_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getArboristTrialLeaderboardStmt = db.prepare(`
  SELECT * FROM arborist_trial_results
  WHERE challenge_id = ?
  ORDER BY won DESC, score DESC, rounds ASC, completed_at ASC, wallet ASC
  LIMIT ?
`);

const getArboristTrialWalletHistoryStmt = db.prepare(`
  SELECT * FROM arborist_trial_results
  WHERE wallet = ?
  ORDER BY challenge_date DESC
  LIMIT ?
`);

const getArboristTrialStandingStmt = db.prepare(`
  SELECT rank FROM (
    SELECT wallet, ROW_NUMBER() OVER (
      ORDER BY won DESC, score DESC, rounds ASC, completed_at ASC, wallet ASC
    ) AS rank FROM arborist_trial_results WHERE challenge_id = ?
  ) WHERE wallet = ?
`);
const getArboristTrialParticipantCountStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM arborist_trial_results WHERE challenge_id = ?
`);
const getArboristTrialCareerHistoryStmt = db.prepare(`
  SELECT * FROM arborist_trial_results WHERE wallet = ?
  ORDER BY challenge_date DESC, completed_at ASC
`);

export function getArboristTrialStanding(challengeId: string, wallet: string | null) {
  const standing = wallet ? getArboristTrialStandingStmt.get(challengeId, wallet.toLowerCase()) as { rank: number } | undefined : undefined;
  const { total } = getArboristTrialParticipantCountStmt.get(challengeId) as { total: number };
  return { rank: standing?.rank, total };
}

export function getArboristTrialCareerHistory(wallet: string): ArboristTrialResultRow[] {
  return getArboristTrialCareerHistoryStmt.all(wallet.toLowerCase()) as ArboristTrialResultRow[];
}

const updateBattleFinishedAtByTransactionDigestStmt = db.prepare(`
  UPDATE battle_records
  SET finished_at = ?
  WHERE transaction_digest = ? AND finished_at != ?
`);

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface TrackBattleInput {
  battleId: string;
  player1: string;
  player2: string;
  winner: string | null;
  isBotBattle: boolean;
  battleVersion?: string;
  targetGrowth?: number | null;
  transactionDigest?: string | null;
  finishedAt: number;
}

export interface UpsertPvpQueueTelegramAlertInput {
  queueEntryKey: string;
  queueId: string;
  waitingWallet: string;
  queueObjectVersion?: string | null;
  previousTransaction?: string | null;
  entryFeeMist: number;
  targetGrowth?: number | null;
  queueLabel?: string | null;
  queueType?: string | null;
  telegramMessageId?: string | null;
  notifiedAt: number;
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
    input.battleVersion || "legacy",
    input.targetGrowth ?? (input.isBotBattle ? 50 : null),
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
          rank_title: "Grove Recruit",
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
    stats.rank_title = getRankTitle(stats.wins, stats.total_battles);
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

export function updateBattleFinishedAtByTransactionDigest(
  transactionDigest: string,
  finishedAt: number,
): boolean {
  return (
    updateBattleFinishedAtByTransactionDigestStmt.run(
      finishedAt,
      transactionDigest,
      finishedAt,
    ).changes > 0
  );
}

export function getPlayerStatsByAddress(address: string): PlayerStatsRow | null {
  const row = getPlayerStats.get(address.toLowerCase()) as PlayerStatsRow | undefined;
  if (!row) return null;
  row.win_rate = row.total_battles > 0 ? row.wins / row.total_battles : 0;
  row.rank_title = getRankTitle(row.wins, row.total_battles);
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
  pvp_target_counts: {
    quick_50: number;
    standard_75: number;
    legacy_100: number;
  };
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
    pvp_target_counts: {
      quick_50: 0,
      standard_75: 0,
      legacy_100: 0,
    },
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
  targetGrowth?: number | null,
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
  if (!stats.last_played || finishedAt >= stats.last_played) {
    stats.last_played = finishedAt;
    stats.recent_result = won ? "Win" : "Loss";
  }
  if (targetGrowth === 50) {
    stats.pvp_target_counts.quick_50 += 1;
  } else if (targetGrowth === 75) {
    stats.pvp_target_counts.standard_75 += 1;
  } else if (targetGrowth === 100) {
    stats.pvp_target_counts.legacy_100 += 1;
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

    const pvpTargetGrowth = record.target_growth ?? 100;
    addResult(
      statsByAddress,
      player1,
      winner === player1,
      record.finished_at,
      pvpTargetGrowth,
    );
    addResult(
      statsByAddress,
      player2,
      winner === player2,
      record.finished_at,
      pvpTargetGrowth,
    );
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
      rank_title: getRankTitle(row.wins, totalBattles),
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
      pvp_target_counts: row.pvp_target_counts,
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

export function getBattleByTransactionDigest(
  transactionDigest: string,
): BattleRecordRow | null {
  return (
    (getBattleByTransactionDigestStmt.get(transactionDigest) as BattleRecordRow) ??
    null
  );
}

export function getActivePvpQueueTelegramAlert(
  queueId: string,
): PvpQueueTelegramAlertRow | null {
  return (
    (getActivePvpQueueAlertStmt.get(queueId) as PvpQueueTelegramAlertRow) ?? null
  );
}

export function getPvpQueueTelegramAlertByKey(
  queueEntryKey: string,
): PvpQueueTelegramAlertRow | null {
  return (
    (getPvpQueueAlertByKeyStmt.get(queueEntryKey) as PvpQueueTelegramAlertRow) ??
    null
  );
}

export function upsertNotifiedPvpQueueTelegramAlert(
  input: UpsertPvpQueueTelegramAlertInput,
): void {
  const now = Date.now();
  upsertNotifiedPvpQueueAlertStmt.run(
    input.queueEntryKey,
    input.queueId,
    input.waitingWallet.toLowerCase(),
    input.queueObjectVersion ?? null,
    input.previousTransaction ?? null,
    input.entryFeeMist,
    input.targetGrowth ?? null,
    input.queueLabel ?? null,
    input.queueType ?? null,
    input.telegramMessageId ?? null,
    input.notifiedAt,
    now,
    now,
  );
}

export function resolvePvpQueueTelegramAlert(
  queueEntryKey: string,
  resolvedAt = Date.now(),
): void {
  resolvePvpQueueAlertStmt.run(resolvedAt, resolvedAt, queueEntryKey);
}

export function resolveActivePvpQueueTelegramAlerts(
  queueId: string,
  resolvedAt = Date.now(),
): void {
  resolveActivePvpQueueAlertsStmt.run(resolvedAt, resolvedAt, queueId);
}

export function listTelegramAlertDestinations(): TelegramAlertDestinationRow[] {
  return listTelegramAlertDestinationsStmt.all() as TelegramAlertDestinationRow[];
}

export function getTelegramAlertDestination(
  chatId: string,
  messageThreadId?: number | null,
): TelegramAlertDestinationRow | null {
  return (
    (getTelegramAlertDestinationStmt.get(
      chatId,
      messageThreadId ?? 0,
    ) as TelegramAlertDestinationRow) ?? null
  );
}

export function enableTelegramAlertDestination(
  input: EnableTelegramAlertDestinationInput,
): void {
  const now = Date.now();
  enableTelegramAlertDestinationStmt.run(
    input.chatId,
    input.messageThreadId ?? 0,
    input.chatTitle ?? null,
    input.configuredBy,
    now,
    now,
  );
}

export function disableTelegramAlertDestination(
  chatId: string,
  messageThreadId?: number | null,
): void {
  disableTelegramAlertDestinationStmt.run(
    Date.now(),
    chatId,
    messageThreadId ?? 0,
  );
}

export function getArboristTrialResult(
  challengeId: string,
  wallet: string,
): ArboristTrialResultRow | null {
  return (
    (getArboristTrialResultStmt.get(
      challengeId,
      wallet.toLowerCase(),
    ) as ArboristTrialResultRow) ?? null
  );
}

export function insertArboristTrialResult(input: ArboristTrialResultRow): boolean {
  const result = insertArboristTrialResultStmt.run(
    input.challenge_id,
    input.challenge_date,
    input.wallet.toLowerCase(),
    input.score,
    input.won,
    input.rounds,
    input.player_growth,
    input.bot_growth,
    input.unique_moves,
    input.completed_at,
  );
  return result.changes === 1;
}

export function getArboristTrialLeaderboard(
  challengeId: string,
  limit = 25,
): ArboristTrialResultRow[] {
  return getArboristTrialLeaderboardStmt.all(
    challengeId,
    Math.max(1, Math.min(100, limit)),
  ) as ArboristTrialResultRow[];
}

export function getArboristTrialWalletHistory(
  wallet: string,
  limit = 30,
): ArboristTrialResultRow[] {
  return getArboristTrialWalletHistoryStmt.all(
    wallet.toLowerCase(),
    Math.max(1, Math.min(365, limit)),
  ) as ArboristTrialResultRow[];
}
