import type { ArboristTrialChallenge } from "@shared/arborist-trials";
import { createArboristTrialBattle, playArboristTrialRound } from "./arboristTrials";
import type { ActionEntry } from "@/components/BattleLog";

export const trialDraftKey = (wallet: string) => `arborist-trial-unsaved-v1:${wallet.toLowerCase()}`;

// Store only a replay, never a wallet signature or a claimed score.
export function encodeTrialDraft(wallet: string, challengeId: string, fifth: boolean, moves: number[]) {
  return JSON.stringify({ wallet: wallet.toLowerCase(), challengeId, fifth, moves });
}

export function restoreTrialDraft(raw: string | null, wallet: string, challenge: ArboristTrialChallenge) {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.wallet !== wallet.toLowerCase() || draft.challengeId !== challenge.id
      || typeof draft.fifth !== "boolean" || !Array.isArray(draft.moves)
      || draft.moves.length === 0 || draft.moves.length > 100
      || !draft.moves.every((move: unknown) => Number.isInteger(move) && Number(move) >= 1 && Number(move) <= 39)) return null;
    let battle = createArboristTrialBattle(challenge, draft.fifth);
    const entries: ActionEntry[] = [];
    for (const move of draft.moves) {
      if (battle.finished) return null;
      const round = playArboristTrialRound(battle, challenge, move);
      battle = round.battle;
      entries.push(...round.entries);
    }
    return battle.finished ? { battle, entries } : null;
  } catch {
    return null;
  }
}

export function trialSaveError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "challenge_expired") return "This daily challenge has expired. Its score cannot be saved for today. Return to the daily board for the new challenge.";
  if (message === "nftree_required") return "This wallet no longer has a verified NFTree. The score was not saved.";
  if (message === "nftree_access_unavailable") return "NFTree verification is temporarily unavailable. Your result is still here; try saving again.";
  if (/reject|denied|cancel/i.test(message)) return "Signature cancelled. Your score is not saved yet. Tap Sign & Save Score when you are ready.";
  return "The server has not confirmed a saved score. Your result is still here; check your connection and try Sign & Save Score again.";
}
