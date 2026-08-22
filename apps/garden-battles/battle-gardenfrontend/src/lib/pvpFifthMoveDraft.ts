export interface FifthMoveDraftState {
  pending: boolean;
  playableMoves: number[];
  candidates: number[];
}

export function getBattleMoveFunction(
  battleVersion: "legacy" | "pvp-v2" | "pvp-v3" | "bot-v2" | undefined,
  draftPending: boolean,
): string {
  if (battleVersion === "pvp-v3" && draftPending) {
    return "use_ability_id_pvp_v3_with_fifth_move";
  }
  if (battleVersion === "bot-v2" && draftPending) {
    return "use_ability_id_ranked_bot_v2_with_fifth_move";
  }
  if (battleVersion === "pvp-v3") return "use_ability_id_pvp_v3";
  if (battleVersion === "pvp-v2") return "use_ability_id_pvp_v2";
  if (battleVersion === "bot-v2") return "use_ability_id_ranked_bot_v2";
  return "use_ability_id";
}

export function getFifthMoveDraftState(
  moves: number[],
  entitled: boolean,
): FifthMoveDraftState {
  if (entitled && moves.length === 7) {
    return {
      pending: true,
      playableMoves: moves.slice(0, 4),
      candidates: moves.slice(4, 7),
    };
  }

  return {
    pending: false,
    playableMoves: moves,
    candidates: [],
  };
}

export function isUnlockedFifthMoveCard(
  moveIndex: number,
  playableMoveCount: number,
  entitled: boolean,
): boolean {
  return entitled && playableMoveCount === 5 && moveIndex === 4;
}
