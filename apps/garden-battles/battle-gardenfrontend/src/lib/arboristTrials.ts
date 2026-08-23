import type { ArboristTrialChallenge } from "@shared/arborist-trials";
import {
  PRACTICE_PLAYER_ADDRESS,
  createPracticeBattle,
  type PracticeBattle,
} from "./practiceBattle";

const FIFTH_MOVE_IDS = [31, 32, 33, 34, 35, 36, 37, 38, 39];

export function getDailyTrialFifthMoveId(challenge: ArboristTrialChallenge): number {
  return FIFTH_MOVE_IDS[challenge.seed % FIFTH_MOVE_IDS.length];
}

export function createArboristTrialBattle(
  challenge: ArboristTrialChallenge,
  fifthMoveUnlocked: boolean,
): PracticeBattle {
  return createPracticeBattle({
    seed: challenge.seed,
    mode: "arborist-trial",
    challengeId: challenge.id,
    playerStartGrowth: challenge.playerStartGrowth,
    botStartGrowth: challenge.botStartGrowth,
    bonusMoveId: fifthMoveUnlocked ? getDailyTrialFifthMoveId(challenge) : null,
  });
}

export function getArboristTrialResult(battle: PracticeBattle) {
  return {
    won: battle.winner === PRACTICE_PLAYER_ADDRESS,
    rounds: Math.max(1, Math.ceil(battle.totalTurns / 2)),
    playerGrowth: battle.player1Growth,
    botGrowth: battle.player2Growth,
    uniqueMoves: new Set(battle.allPlayerMoves).size,
  };
}
