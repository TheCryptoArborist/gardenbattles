import {
  calculateArboristTrialScore,
  getArboristTrialChallenge,
  type ArboristTrialResultInput,
} from "../shared/arborist-trials";
import {
  getArboristTrialLeaderboard,
  getArboristTrialResult,
  getArboristTrialWalletHistory,
  insertArboristTrialResult,
  type ArboristTrialResultRow,
} from "./battle-storage";
import { normalizeSuiAddress } from "../shared/tree-power-eligibility";

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
  const history = getArboristTrialWalletHistory(wallet, 365);
  if (history.length === 0) return 0;
  let expected = startingDate;
  let streak = 0;
  for (const row of history) {
    if (row.challenge_date !== expected || row.won !== 1) break;
    streak += 1;
    const previous = new Date(`${expected}T12:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    expected = previous.toISOString().slice(0, 10);
  }
  return streak;
}

export function getTodayArboristTrial(walletInput?: string, now = new Date()) {
  const challenge = getArboristTrialChallenge(now);
  const wallet = walletInput ? normalizeSuiAddress(walletInput) : null;
  const leaderboard = getArboristTrialLeaderboard(challenge.id, 25);
  const result = wallet ? getArboristTrialResult(challenge.id, wallet) : null;
  return {
    challenge,
    rankedAttemptUsed: !!result,
    result: result ? publicResult(result) : null,
    streak: wallet ? calculateStreak(wallet, challenge.date) : 0,
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

export function submitTodayArboristTrial(
  body: Record<string, unknown>,
  now = new Date(),
) {
  const wallet = normalizeSuiAddress(typeof body.wallet === "string" ? body.wallet : null);
  if (!wallet) return { status: 400, body: { ok: false, reason: "valid_wallet_required" } };

  const challenge = getArboristTrialChallenge(now);
  if (body.challengeId !== challenge.id) {
    return { status: 409, body: { ok: false, reason: "challenge_expired" } };
  }

  const rounds = readBoundedInteger(body.rounds, 1, 100);
  const playerGrowth = readBoundedInteger(body.playerGrowth, 0, 100);
  const botGrowth = readBoundedInteger(body.botGrowth, 0, 100);
  const uniqueMoves = readBoundedInteger(body.uniqueMoves, 1, 5);
  const won = body.won === true;
  if (rounds === null || playerGrowth === null || botGrowth === null || uniqueMoves === null) {
    return { status: 400, body: { ok: false, reason: "invalid_trial_result" } };
  }
  if (won && playerGrowth < challenge.targetGrowth) {
    return { status: 400, body: { ok: false, reason: "invalid_winning_growth" } };
  }

  const resultInput: ArboristTrialResultInput = {
    won,
    rounds,
    playerGrowth,
    botGrowth,
    uniqueMoves,
  };
  const row: ArboristTrialResultRow = {
    challenge_id: challenge.id,
    challenge_date: challenge.date,
    wallet,
    score: calculateArboristTrialScore(resultInput),
    won: won ? 1 : 0,
    rounds,
    player_growth: playerGrowth,
    bot_growth: botGrowth,
    unique_moves: uniqueMoves,
    completed_at: now.getTime(),
  };
  const recorded = insertArboristTrialResult(row);
  const saved = getArboristTrialResult(challenge.id, wallet)!;
  return {
    status: recorded ? 201 : 409,
    body: {
      ok: recorded,
      recorded,
      reason: recorded ? undefined : "ranked_attempt_already_used",
      result: publicResult(saved),
      streak: calculateStreak(wallet, challenge.date),
    },
  };
}
