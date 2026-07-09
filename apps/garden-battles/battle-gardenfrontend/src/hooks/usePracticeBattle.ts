import { useCallback, useState } from "react";
import type { ActionEntry } from "@/components/BattleLog";
import {
  type PracticeBattle,
  createPracticeBattle,
  playPracticeRound,
} from "@/lib/practiceBattle";

export function usePracticeBattle() {
  const [battleState, setBattleState] = useState<PracticeBattle | null>(null);
  const [actionLog, setActionLog] = useState<ActionEntry[]>([]);

  const startPracticeBattle = useCallback(() => {
    setBattleState(createPracticeBattle());
    setActionLog([]);
  }, []);

  const usePracticeMove = useCallback(
    (moveId: number) => {
      if (!battleState) return;
      const result = playPracticeRound(battleState, moveId);
      setBattleState(result.battle);
      if (result.entries.length > 0) {
        setActionLog((log) => [...log, ...result.entries]);
      }
    },
    [battleState],
  );

  const clearPracticeBattle = useCallback(() => {
    setBattleState(null);
    setActionLog([]);
  }, []);

  return {
    battleState,
    actionLog,
    isPracticeActive: !!battleState,
    startPracticeBattle,
    usePracticeMove,
    clearPracticeBattle,
  };
}
