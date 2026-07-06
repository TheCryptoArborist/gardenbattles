const API_UNAVAILABLE_MESSAGE =
  "Leaderboard backend is not connected on this deployment yet.";

const API_BASE = (import.meta.env.VITE_GARDEN_BATTLES_API_URL || "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchJson<T>(path: string, fallbackMessage: string): Promise<T> {
  let res: Response;

  try {
    res = await fetch(apiUrl(path));
  } catch {
    throw new Error(fallbackMessage);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(API_UNAVAILABLE_MESSAGE);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!res.ok) {
    const errorMessage =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : fallbackMessage;
    throw new Error(errorMessage);
  }

  return data as T;
}

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
  return fetchJson<PlayerStats>(
    `/api/player/${address.toLowerCase()}/stats${params}`,
    "Player stats are temporarily unavailable.",
  );
}

export async function fetchLeaderboard(
  limit = 50,
  offset = 0,
  mode: LeaderboardMode = "pvp",
): Promise<LeaderboardResponse> {
  return fetchJson<LeaderboardResponse>(
    `/api/leaderboard?limit=${limit}&offset=${offset}&mode=${encodeURIComponent(mode)}`,
    "Leaderboard data is temporarily unavailable.",
  );
}

export async function fetchTopPlayers(
  limit = 100,
  mode: LeaderboardMode = "pvp",
): Promise<LeaderboardEntry[]> {
  return fetchJson<LeaderboardEntry[]>(
    `/api/top-players?limit=${limit}&mode=${encodeURIComponent(mode)}`,
    "Leaderboard data is temporarily unavailable.",
  );
}
