import {
  MOVE_LABELS,
  MOVE_META,
  type MoveMeta,
  type MoveType,
} from "./sui-config";

export type CardGuideFilter = "all" | MoveType | "tree-power";

export type CardGuideCard = {
  id: number;
  label: string;
  meta: MoveMeta;
  availability: string;
  bestUse: string;
  watchFor: string;
};

function buildBestUse(meta: MoveMeta): string {
  const effect = meta.effect;
  if (/clears pending damage/i.test(effect)) {
    return "Time this before delayed damage resolves to protect your momentum.";
  }
  if (/pierces|removes one block|breaks it/i.test(effect)) {
    return "Best against protected opponents because it can bypass or remove their defense.";
  }
  if (/while behind|10 Growth or below/i.test(effect)) {
    return "Save it for a comeback turn when its conditional value is strongest.";
  }
  if (/after an opponent Attack|after your Attack/i.test(effect)) {
    return "Sequence it after the listed move type to trigger its stronger result.";
  }
  if (/block|shield|halves the next|caps the next/i.test(effect)) {
    return "Use before an expected attack to gain Growth while reducing incoming pressure.";
  }
  if (/poison|next two turns|next turn/i.test(effect)) {
    return "Play early enough for the delayed effect to influence multiple turns.";
  }
  if (meta.type === "attack") {
    return "Use it to slow an opponent who is approaching the Growth target.";
  }
  if (meta.type === "growth") {
    return "Use it to advance your own win condition and force the opponent to respond.";
  }
  return "Use it when you need progress and pressure or protection from the same turn.";
}

function buildWatchFor(meta: MoveMeta): string {
  const effect = meta.effect;
  if (/chance/i.test(effect)) {
    return "Its result is not guaranteed, so keep a reliable backup move available.";
  }
  if (/spends 4 Growth/i.test(effect)) {
    return "You must have enough Growth to pay its cost, and spending Growth can delay your finish.";
  }
  if (/otherwise loses 4/i.test(effect)) {
    return "A failed roll costs Growth; avoid it when a safer card can secure the battle.";
  }
  if (/opponent also gains/i.test(effect)) {
    return "The opponent benefits too, so check whether that extra Growth could put them near victory.";
  }
  if (/while behind|at least 40|10 Growth or below|after an opponent|after your Attack/i.test(effect)) {
    return "Check the board and previous move first; outside its condition the effect is weaker.";
  }
  if (meta.type === "attack") {
    return "Blocks and defensive effects may reduce its value unless the card explicitly pierces them.";
  }
  if (meta.type === "growth") {
    return "Pure Growth may leave you exposed if the opponent is preparing a strong attack.";
  }
  return "Its flexible effect is smaller than some specialized cards, so choose it for timing and utility.";
}

export const CARD_GUIDE_CARDS: CardGuideCard[] = Object.keys(MOVE_LABELS)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => {
    const meta = MOVE_META[id];
    return {
      id,
      label: MOVE_LABELS[id],
      meta,
      availability: meta.fifthExclusive
        ? "Garden Bot and paid PvP when your fifth card is unlocked"
        : "Practice, Garden Bot, and paid PvP",
      bestUse: buildBestUse(meta),
      watchFor: buildWatchFor(meta),
    };
  });

export function filterCardGuideCards(options: {
  query?: string;
  filter?: CardGuideFilter;
  currentHand?: number[];
  currentHandOnly?: boolean;
}): CardGuideCard[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const filter = options.filter ?? "all";
  const currentHand = new Set(options.currentHand ?? []);

  return CARD_GUIDE_CARDS.filter((card) => {
    if (options.currentHandOnly && !currentHand.has(card.id)) return false;
    if (filter === "tree-power" && !card.meta.fifthExclusive) return false;
    if (filter !== "all" && filter !== "tree-power" && card.meta.type !== filter) {
      return false;
    }
    if (!query) return true;

    return [
      card.label,
      card.meta.effect,
      card.meta.type,
      card.meta.draftLane,
      card.availability,
      card.bestUse,
      card.watchFor,
    ].some((value) => value?.toLowerCase().includes(query));
  });
}
