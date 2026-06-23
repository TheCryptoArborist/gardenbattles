const API_BASE = "";

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

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchPlayerStats(
  address: string,
): Promise<PlayerStats> {
  const res = await fetch(
    `${API_BASE}/api/player/${address.toLowerCase()}/stats`,
  );
  if (!res.ok) throw new Error("Failed to fetch player stats");
  return res.json();
}

export async function fetchLeaderboard(
  limit = 50,
  offset = 0,
): Promise<LeaderboardResponse> {
  const res = await fetch(
    `${API_BASE}/api/leaderboard?limit=${limit}&offset=${offset}`,
  );
  if (!res.ok) throw new Error("Failed to fetch leaderboard");
  return res.json();
}

export async function fetchTopPlayers(limit = 100): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/api/top-players?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch top players");
  return res.json();
}
