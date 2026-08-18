const API_UNAVAILABLE_MESSAGE =
  "Leaderboard backend is not connected on this deployment yet.";

const API_BASE = ((import.meta.env?.VITE_GARDEN_BATTLES_API_URL ?? "") as string).replace(/\/$/, "");

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

async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
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
      "reason" in data &&
      typeof data.reason === "string"
        ? data.reason
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

export type FifthMoveSource = "suidex-v2" | "suidex-v3" | "moonbags-staking";
export type FifthMoveEligibilityStatus =
  | "qualified"
  | "not-qualified"
  | "verification-incomplete"
  | "unavailable";
export type FifthMoveSourceResult = {
  source: FifthMoveSource;
  status: "qualified-data" | "verified-zero" | "unavailable";
  underlyingTreeRaw?: string;
  underlyingTreeDisplay?: string;
  evidence?: {
    objectIds?: string[];
    poolId?: string;
    positionCount?: number;
  };
  reason?: string;
};
export type FifthMoveEligibilityResponse = {
  wallet: string;
  status: FifthMoveEligibilityStatus;
  thresholdTree: string;
  thresholdRaw: string;
  verifiedUnderlyingTree: string;
  verifiedUnderlyingTreeRaw: string;
  remainingTree?: string;
  remainingTreeRaw?: string;
  sources: FifthMoveSourceResult[];
};

export type FifthMoveAttestationPayload = {
  version: number;
  domain: number[];
  network: number[];
  fifth_move_config_id: string;
  wallet: string;
  qualified: boolean;
  verified_underlying_tree_raw: string;
  threshold_raw: string;
  source_bitmap: number;
  config_version: string;
  issued_at_ms: string;
  expires_at_ms: string;
};

export type FifthMoveAttestationResponse = {
  ok: boolean;
  reason?: string;
  eligibility?: FifthMoveEligibilityResponse;
  attestation: null | {
    payload: FifthMoveAttestationPayload;
    payloadBytes: string;
    signature: string;
    signerPublicKey: string;
    keyId: string;
    expiresAtMs: number;
  };
};

export type NftreeAccessResponse = {
  ok: boolean;
  error?: string;
  nft: null | {
    nftId: string;
    nftType: string;
    location: "wallet";
    imageUrl?: string;
  };
};

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  total: number;
  limit: number;
  offset: number;
  mode: LeaderboardMode;
}

interface BattleRecordSubmitResponse {
  ok: boolean;
  recorded: boolean;
  reason?: string;
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

export async function submitBattleRecord(
  transactionDigest: string,
): Promise<BattleRecordSubmitResponse> {
  return postJson<BattleRecordSubmitResponse>(
    "/api/battle-records/submit",
    { transaction_digest: transactionDigest },
    "Battle result could not be submitted to the leaderboard.",
  );
}

export async function fetchFifthMoveEligibility(
  address: string,
): Promise<FifthMoveEligibilityResponse> {
  return fetchJson<FifthMoveEligibilityResponse>(
    `/api/tree-power/eligibility/${address.toLowerCase()}`,
    "Fifth Move eligibility verification is temporarily unavailable.",
  );
}

export async function fetchNftreeAccess(
  address: string,
): Promise<NftreeAccessResponse> {
  return fetchJson<NftreeAccessResponse>(
    `/api/nftree-access/${address.toLowerCase()}`,
    "NFTree access check is temporarily unavailable.",
  );
}

export async function requestFifthMoveAttestation(
  address: string,
): Promise<FifthMoveAttestationResponse> {
  return postJson<FifthMoveAttestationResponse>(
    "/api/tree-power/fifth-move-attestation",
    { wallet: address.toLowerCase() },
    "Fifth Move proof is temporarily unavailable.",
  );
}
