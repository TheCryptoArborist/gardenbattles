import type { ArboristTrialChallenge } from "@shared/arborist-trials";
import { createArboristTrialBattle, playArboristTrialRound } from "./arboristTrials";
import type { ActionEntry } from "@/components/BattleLog";
import { isTrialEngine, type TrialEngine, TRIAL_PORTABLE_START_DATE } from "@shared/trial-engine";

export const trialDraftKey = (wallet: string) => `arborist-trial-unsaved-v1:${wallet.toLowerCase()}`;

// Store only a replay, never a wallet signature or a claimed score.
export function encodeTrialDraft(wallet: string, challengeId: string, fifth: boolean, moves: number[], engine?: TrialEngine) {
  return JSON.stringify({ wallet: wallet.toLowerCase(), challengeId, fifth, moves, engine });
}

export function restoreTrialDraft(raw: string | null, wallet: string, challenge: ArboristTrialChallenge) {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft.wallet !== wallet.toLowerCase() || draft.challengeId !== challenge.id
      || typeof draft.fifth !== "boolean" || !Array.isArray(draft.moves)
      || draft.moves.length === 0 || draft.moves.length > 100
      || !draft.moves.every((move: unknown) => Number.isInteger(move) && Number(move) >= 1 && Number(move) <= 39)) return null;
    if (draft.engine !== undefined && !isTrialEngine(draft.engine)) return null;
    const engines: TrialEngine[] = draft.engine ? [draft.engine] : ["legacy-v8", "legacy-webkit"];
    for (const engine of engines) {
      if (engine !== "portable-v1" && challenge.date > TRIAL_PORTABLE_START_DATE) continue;
      let battle = createArboristTrialBattle(challenge, draft.fifth, engine);
      const entries: ActionEntry[] = [];
      try {
        for (const move of draft.moves) {
          if (battle.finished) throw new Error("moves_after_battle_finished");
          const round = playArboristTrialRound(battle, challenge, move);
          battle = round.battle;
          entries.push(...round.entries);
        }
        if (battle.finished) return { battle, entries };
      } catch { /* Try the other historical browser engine, never a partial win. */ }
    }
    return null;
  } catch {
    return null;
  }
}

export function trialSaveError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : "";
  if (message === "challenge_expired") return "This daily challenge has expired. Its score cannot be saved for today. Return to the daily board for the new challenge.";
  if (message === "nftree_required") return "This wallet no longer has a verified NFTree. The score was not saved.";
  if (message === "nftree_access_unavailable") return "NFTree verification is temporarily unavailable. Your result is still here; try saving again.";
  if (message === "trial_client_update_required") return "This game tab needs the latest update. Your completed result is kept on this device. Reload Arborist Trials in the same wallet browser.";
  if (["moves_after_battle_finished", "invalid_move_sequence", "incomplete_trial"].includes(message)) return "The saved move sequence could not be validated. Your result is kept on this device. Please contact support instead of signing repeatedly.";
  if (message === "request_timeout") return "The server took too long to respond. Your result is still here. Check your connection and retry Sign & Save Score; duplicate saves cannot count twice.";
  if (/reject|denied|cancel/i.test(message)) return "Signature cancelled. Your score is not saved yet. Tap Sign & Save Score when you are ready.";
  return "The server has not confirmed a saved score. Your result is still here; check your connection and try Sign & Save Score again.";
}

export function shouldRetryTrialSave(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : "";
  return message === "request_timeout"
    || message === "nftree_access_unavailable"
    || message === "ranked_attempt_already_used"
    || message === "The ranked Arborist Trial result could not be saved.";
}
