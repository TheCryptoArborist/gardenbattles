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
} from "../battle-gardenfrontend/src/lib/arboristTrials";
import { playPracticeRound } from "../battle-gardenfrontend/src/lib/practiceBattle";
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

export type ArboristTrialSubmissionOptions = {
  getFifthMoveUnlocked?: (wallet: string) => Promise<boolean>;
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
):
  | { ok: true; result: ArboristTrialResultInput }
  | { ok: false; reason: string } {
  let replay = createArboristTrialBattle(challenge, fifthMoveUnlocked);
  try {
    for (let index = 0; index < moves.length; index += 1) {
      const moveId = moves[index];
      if (replay.finished) return { ok: false, reason: "moves_after_battle_finished" };
      replay = playPracticeRound(replay, moveId).battle;
      if (replay.finished && index !== moves.length - 1) {
        return { ok: false, reason: "moves_after_battle_finished" };
      }
    }
  } catch {
    return { ok: false, reason: "invalid_move_sequence" };
  }
  if (!replay.finished) return { ok: false, reason: "incomplete_trial" };
  return { ok: true, result: getReplayedTrialResult(replay) };
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
  const signature = typeof body.signature === "string" ? body.signature : "";
  const message = new TextEncoder().encode(
    createArboristTrialProofMessage(challenge.id, wallet, moves),
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

  const replayed = replayArboristTrial(challenge, moves, usesFifthMove);
  if (!replayed.ok) {
    return { status: 400, body: { ok: false, reason: replayed.reason } };
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
