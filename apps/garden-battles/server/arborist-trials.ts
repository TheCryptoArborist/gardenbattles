import {
  calculateArboristTrialScore,
  createArboristTrialProofMessage,
  getArboristTrialChallenge,
  type ArboristTrialChallenge,
  type ArboristTrialResultInput,
} from "../shared/arborist-trials";
import { verifyPersonalMessage } from "@mysten/sui.js/verify";
import {
  createArboristTrialBattle,
  getArboristTrialResult as getReplayedTrialResult,
  getDailyTrialFifthMoveId,
  playArboristTrialRound,
} from "../battle-gardenfrontend/src/lib/arboristTrials";
import {
  getArboristTrialLeaderboard,
  getArboristTrialStanding,
  getArboristTrialCareerHistory,
  getArboristTrialResult,
  getArboristTrialWalletHistory,
  insertArboristTrialResult,
  type ArboristTrialResultRow,
} from "./battle-storage";
import { normalizeSuiAddress } from "../shared/tree-power-eligibility";
import { dailyTrialWinStreak } from "../shared/trial-streak";
import { isTrialEngine, TRIAL_PORTABLE_START_DATE, type TrialEngine } from "../shared/trial-engine";

function publicResult(row: ArboristTrialResultRow, rank?: number) {
  return {
    ...(rank ? { rank } : {}),
    wallet: row.wallet,
    score: row.score,
    won: row.won === 1,
    rounds: row.rounds,
    playerGrowth: row.player_growth,
    botGrowth: row.bot_growth,
    uniqueMoves: row.unique_moves,
    completedAt: row.completed_at,
  };
}

function calculateStreak(wallet: string, startingDate: string): number {
  return dailyTrialWinStreak(getArboristTrialWalletHistory(wallet, 365), startingDate);
}

function calculateCheckInStreak(wallet: string, startingDate: string): number {
  const history = getArboristTrialWalletHistory(wallet, 365);
  if (history.length === 0) return 0;
  let expected = startingDate;
  if (history[0].challenge_date !== expected) {
    const yesterday = new Date(`${startingDate}T12:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    expected = yesterday.toISOString().slice(0, 10);
  }
  let streak = 0;
  for (const row of history) {
    if (row.challenge_date !== expected) break;
    streak += 1;
    const previous = new Date(`${expected}T12:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    expected = previous.toISOString().slice(0, 10);
  }
  return streak;
}

function buildCheckIns(wallet: string | null, startingDate: string) {
  const history = wallet ? getArboristTrialWalletHistory(wallet, 7) : [];
  const byDate = new Map(history.map((row) => [row.challenge_date, row]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${startingDate}T12:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const result = byDate.get(dateKey);
    return {
      date: dateKey,
      completed: !!result,
      won: result?.won === 1,
    };
  });
}

function dayDistance(newer: string, older: string) {
  return Math.round((Date.parse(`${newer}T12:00:00.000Z`) - Date.parse(`${older}T12:00:00.000Z`)) / 86_400_000);
}

function maximumConsecutiveDays(history: ArboristTrialResultRow[], winsOnly: boolean) {
  const qualifying = history.filter((row) => !winsOnly || row.won === 1);
  let maximum = 0;
  let current = 0;
  let previousDate: string | null = null;
  for (const row of qualifying) {
    if (previousDate && dayDistance(previousDate, row.challenge_date) === 1) current += 1;
    else current = 1;
    maximum = Math.max(maximum, current);
    previousDate = row.challenge_date;
  }
  return maximum;
}

function buildAchievements(wallet: string | null) {
  const career = wallet ? getArboristTrialCareerHistory(wallet) : [];
  // A calendar day is one check-in even if an older schedule has multiple IDs.
  const dates = new Set<string>();
  const history = career.filter((row) => {
    if (dates.has(row.challenge_date)) return false;
    dates.add(row.challenge_date);
    return true;
  });
  const wins = history.filter((row) => row.won === 1);
  const checkInRun = maximumConsecutiveDays(history, false);
  const winRun = maximumConsecutiveDays(history, true);
  const definitions = [
    { id: "first_checkin", progress: history.length, target: 1 },
    { id: "canopy_conqueror", progress: wins.length, target: 1 },
    { id: "steady_hands", progress: checkInRun, target: 3 },
    { id: "toolbelt_tactician", progress: history.filter((row) => row.won === 1 && row.unique_moves >= 4).length, target: 1 },
    { id: "speed_pruner", progress: history.filter((row) => row.won === 1 && row.rounds <= 8).length, target: 1 },
    { id: "perfect_week", progress: checkInRun, target: 7 },
    { id: "thirty_checkins", progress: history.length, target: 30 },
    { id: "master_arborist", progress: winRun, target: 30 },
  ];
  return definitions.map((badge) => ({
    ...badge,
    earned: badge.progress >= badge.target,
    progress: Math.min(badge.progress, badge.target),
  }));
}

export function getTodayArboristTrial(walletInput?: string, now = new Date()) {
  const challenge = getArboristTrialChallenge(now);
  const wallet = walletInput ? normalizeSuiAddress(walletInput) : null;
  const leaderboard = getArboristTrialLeaderboard(challenge.id, 25);
  const result = wallet ? getArboristTrialResult(challenge.id, wallet) : null;
  const standing = getArboristTrialStanding(challenge.id, wallet);
  return {
    challenge,
    rankedAttemptUsed: !!result,
    result: result ? publicResult(result, standing.rank) : null,
    leaderboardTotal: standing.total,
    streak: wallet ? calculateStreak(wallet, challenge.date) : 0,
    checkInStreak: wallet ? calculateCheckInStreak(wallet, challenge.date) : 0,
    checkIns: buildCheckIns(wallet, challenge.date),
    achievements: buildAchievements(wallet),
    leaderboard: leaderboard.map((row, index) => publicResult(row, index + 1)),
  };
}

function readBoundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

export type ArboristTrialSubmissionOptions = {
  getFifthMoveUnlocked?: (wallet: string) => Promise<boolean>;
  hasNftreeAccess?: (wallet: string) => Promise<boolean>;
  verifyWalletProof?: (
    message: Uint8Array,
    signature: string,
    wallet: string,
  ) => Promise<boolean>;
};

async function verifyWalletProof(
  message: Uint8Array,
  signature: string,
  wallet: string,
): Promise<boolean> {
  try {
    const publicKey = await verifyPersonalMessage(message, signature);
    return publicKey.toSuiAddress().toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export function replayArboristTrial(
  challenge: ArboristTrialChallenge,
  moves: number[],
  fifthMoveUnlocked: boolean,
  engine?: TrialEngine,
):
  | { ok: true; result: ArboristTrialResultInput }
  | { ok: false; reason: string } {
  let replay = createArboristTrialBattle(challenge, fifthMoveUnlocked, engine);
  try {
    for (let index = 0; index < moves.length; index += 1) {
      const moveId = moves[index];
      if (replay.finished) return { ok: false, reason: "moves_after_battle_finished" };
      replay = playArboristTrialRound(replay, challenge, moveId).battle;
      if (replay.finished && index !== moves.length - 1) {
        return { ok: false, reason: "moves_after_battle_finished" };
      }
    }
  } catch {
    return { ok: false, reason: "invalid_move_sequence" };
  }
  if (!replay.finished) return { ok: false, reason: "incomplete_trial" };
  return { ok: true, result: getReplayedTrialResult(replay, challenge) };
}

export async function submitTodayArboristTrial(
  body: Record<string, unknown>,
  now = new Date(),
  options: ArboristTrialSubmissionOptions = {},
) {
  const wallet = normalizeSuiAddress(typeof body.wallet === "string" ? body.wallet : null);
  if (!wallet) return { status: 400, body: { ok: false, reason: "valid_wallet_required" } };

  const challenge = getArboristTrialChallenge(now);
  if (body.challengeId !== challenge.id) {
    return { status: 409, body: { ok: false, reason: "challenge_expired" } };
  }

  const playerMoves = Array.isArray(body.playerMoves)
    ? body.playerMoves.map((value) => readBoundedInteger(value, 1, 39))
    : [];
  if (
    playerMoves.length < 1 ||
    playerMoves.length > 100 ||
    playerMoves.some((moveId) => moveId === null)
  ) {
    return { status: 400, body: { ok: false, reason: "invalid_trial_result" } };
  }

  const moves = playerMoves as number[];
  const replayVersion = body.replayVersion;
  if (replayVersion !== undefined && !isTrialEngine(replayVersion)) {
    return { status: 400, body: { ok: false, reason: "trial_client_update_required" } };
  }
  // Only pre-fix challenges may use compatibility replays. The signature binds
  // the chosen engine in new clients; old clients retain their original message.
  if (challenge.date > TRIAL_PORTABLE_START_DATE && replayVersion !== "portable-v1") {
    return { status: 409, body: { ok: false, reason: "trial_client_update_required" } };
  }
  const signature = typeof body.signature === "string" ? body.signature : "";
  const message = new TextEncoder().encode(
    createArboristTrialProofMessage(challenge.id, wallet, moves, replayVersion),
  );
  const proofIsValid = await (options.verifyWalletProof ?? verifyWalletProof)(
    message,
    signature,
    wallet,
  );
  if (!proofIsValid) {
    return { status: 401, body: { ok: false, reason: "wallet_signature_required" } };
  }

  const fifthMoveId = getDailyTrialFifthMoveId(challenge);
  const usesFifthMove = moves.some((moveId) => moveId >= 31);
  if (usesFifthMove && moves.some((moveId) => moveId >= 31 && moveId !== fifthMoveId)) {
    return { status: 400, body: { ok: false, reason: "invalid_fifth_move" } };
  }
  if (usesFifthMove) {
    const unlocked = await (options.getFifthMoveUnlocked ?? (async () => false))(wallet);
    if (!unlocked) {
      return { status: 403, body: { ok: false, reason: "fifth_move_not_unlocked" } };
    }
  }

  let replayed = replayArboristTrial(challenge, moves, usesFifthMove, replayVersion ?? "legacy-v8");
  if (!replayed.ok && replayVersion === undefined && challenge.date <= TRIAL_PORTABLE_START_DATE) {
    replayed = replayArboristTrial(challenge, moves, usesFifthMove, "legacy-webkit");
  }
  if (!replayed.ok) {
    return { status: 400, body: { ok: false, reason: replayed.reason } };
  }

  try {
    const hasNftree = await (options.hasNftreeAccess ?? (async () => false))(wallet);
    if (!hasNftree) {
      return { status: 403, body: { ok: false, reason: "nftree_required" } };
    }
  } catch {
    return { status: 503, body: { ok: false, reason: "nftree_access_unavailable" } };
  }

  const resultInput = replayed.result;
  const row: ArboristTrialResultRow = {
    challenge_id: challenge.id,
    challenge_date: challenge.date,
    wallet,
    score: calculateArboristTrialScore(resultInput),
    won: resultInput.won ? 1 : 0,
    rounds: resultInput.rounds,
    player_growth: resultInput.playerGrowth,
    bot_growth: resultInput.botGrowth,
    unique_moves: resultInput.uniqueMoves,
    completed_at: now.getTime(),
  };
  const previousBadges = new Set(buildAchievements(wallet).filter((badge) => badge.earned).map((badge) => badge.id));
  const recorded = insertArboristTrialResult(row);
  const saved = getArboristTrialResult(challenge.id, wallet)!;
  const achievements = buildAchievements(wallet);
  const standing = getArboristTrialStanding(challenge.id, wallet);
  return {
    status: recorded ? 201 : 409,
    body: {
      ok: recorded,
      recorded,
      reason: recorded ? undefined : "ranked_attempt_already_used",
      result: publicResult(saved, standing.rank),
      leaderboardTotal: standing.total,
      achievements,
      newAchievements: recorded ? achievements.filter((badge) => badge.earned && !previousBadges.has(badge.id)).map((badge) => badge.id) : [],
      streak: calculateStreak(wallet, challenge.date),
    },
  };
}
