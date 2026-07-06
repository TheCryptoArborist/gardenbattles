const API_BASE = "";

export type LeaderboardMode = "pvp" | "bot" | "overall";

export interface PlayerStats {
  address: string;
  wins: number;
  losses: number;
  total_battles: number;
  current_streak: number;
  max_win_streak: number;
  rank_title: string;
  badges: string[];
  win_rate: number;
  total_bot_wins: number;
  total_bot_losses: number;
  mode?: LeaderboardMode;
  last_played?: number | null;
  recent_result?: "Win" | "Loss" | null;
  ranked?: boolean;
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
  mode: LeaderboardMode;
  last_played: number | null;
  recent_result: "Win" | "Loss" | null;
  ranked: boolean;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
  mode: LeaderboardMode;
}

export async function fetchPlayerStats(
  address: string,
  mode?: LeaderboardMode,
): Promise<PlayerStats> {
  const params = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const res = await fetch(
    `${API_BASE}/api/player/${address.toLowerCase()}/stats${params}`,
  );
  if (!res.ok) throw new Error("Failed to fetch player stats");
  return res.json();
}

export async function fetchLeaderboard(
  limit = 50,
  offset = 0,
  mode: LeaderboardMode = "pvp",
): Promise<LeaderboardResponse> {
  const res = await fetch(
    `${API_BASE}/api/leaderboard?limit=${limit}&offset=${offset}&mode=${encodeURIComponent(mode)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function fetchTopPlayers(
  limit = 100,
  mode: LeaderboardMode = "pvp",
): Promise<LeaderboardEntry[]> {
  const res = await fetch(
    `${API_BASE}/api/top-players?limit=${limit}&mode=${encodeURIComponent(mode)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch top players");
  return res.json();
}
