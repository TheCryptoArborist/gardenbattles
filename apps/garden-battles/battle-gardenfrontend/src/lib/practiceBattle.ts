import type { ActionEntry } from "@/components/BattleLog";
import type { BattleState } from "@/hooks/useSuiWallet";
import { MOVE_LABELS, MOVE_META } from "@/lib/sui-config";

export const PRACTICE_PLAYER_ADDRESS = "practice-player";
export const PRACTICE_BOT_ADDRESS = "practice-garden-bot";
export const PRACTICE_TARGET_GROWTH = 50;

const ATTACK_MOVES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13];
const GROWTH_MOVES = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

type PracticeStatus = {
  blockTurns: number;
  poisonTicks: number;
  poisonDpt: number;
  nextTurnPenalty: number;
};

export type PracticeBattle = BattleState & {
  mode: "practice";
  botMoveHistory: number[];
  playerStatus: PracticeStatus;
  botStatus: PracticeStatus;
};

type MoveOutcome = {
  selfGrowthDelta: number;
  opponentGrowthDelta: number;
  notes: string[];
};

type MoveResolution = {
  selfGrowth: number;
  opponentGrowth: number;
  selfStatus: PracticeStatus;
  opponentStatus: PracticeStatus;
  outcome: MoveOutcome;
};

type PracticeRoundResult = {
  battle: PracticeBattle;
  entries: ActionEntry[];
};

function emptyStatus(): PracticeStatus {
  return {
    blockTurns: 0,
    poisonTicks: 0,
    poisonDpt: 0,
    nextTurnPenalty: 0,
  };
}

function clampGrowth(value: number) {
  return Math.max(0, Math.min(PRACTICE_TARGET_GROWTH, Math.round(value)));
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function drawUnique(pool: number[], count: number, excluded = new Set<number>()) {
  const available = pool.filter((moveId) => !excluded.has(moveId));
  const picked: number[] = [];
  while (picked.length < count && available.length > 0) {
    const index = Math.floor(Math.random() * available.length);
    picked.push(available.splice(index, 1)[0]);
  }
  return picked;
}

export function createPracticeBattle(): PracticeBattle {
  const playerGrowthMoves = drawUnique(GROWTH_MOVES, 2);
  const playerExcluded = new Set(playerGrowthMoves);
  const playerMoves = [
    ...drawUnique(ATTACK_MOVES, 2),
    ...playerGrowthMoves,
  ].sort(() => Math.random() - 0.5);

  const botGrowthMoves = drawUnique(GROWTH_MOVES, 2);
  const botMoves = [
    ...drawUnique(ATTACK_MOVES, 2),
    ...botGrowthMoves,
  ].sort(() => Math.random() - 0.5);

  return {
    battleId: `practice-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    player1: PRACTICE_PLAYER_ADDRESS,
    player2: PRACTICE_BOT_ADDRESS,
    player1Moves: playerMoves.length === 4 ? playerMoves : [...playerMoves, ...drawUnique(GROWTH_MOVES, 4 - playerMoves.length, playerExcluded)],
    player2Moves: botMoves,
    player1Growth: 0,
    player2Growth: 0,
    turn: 0,
    winner: null,
    finished: false,
    isBotBattle: true,
    lastMoveMs: Date.now(),
    mode: "practice",
    botMoveHistory: [],
    playerStatus: emptyStatus(),
    botStatus: emptyStatus(),
  };
}

function applyStartOfTurnStatus(
  growth: number,
  status: PracticeStatus,
  actorLabel: string,
): { growth: number; status: PracticeStatus; notes: string[] } {
  const nextStatus = { ...status };
  const notes: string[] = [];
  let nextGrowth = growth;

  if (nextStatus.nextTurnPenalty > 0) {
    const before = nextGrowth;
    nextGrowth = clampGrowth(nextGrowth - nextStatus.nextTurnPenalty);
    notes.push(`${actorLabel} lost ${before - nextGrowth} delayed growth.`);
    nextStatus.nextTurnPenalty = 0;
  }

  if (nextStatus.poisonTicks > 0) {
    const before = nextGrowth;
    nextGrowth = clampGrowth(nextGrowth - nextStatus.poisonDpt);
    notes.push(`${actorLabel} lost ${before - nextGrowth} poison growth.`);
    nextStatus.poisonTicks -= 1;
    if (nextStatus.poisonTicks === 0) nextStatus.poisonDpt = 0;
  }

  return { growth: nextGrowth, status: nextStatus, notes };
}

function applyDamage(
  damage: number,
  opponentGrowth: number,
  opponentStatus: PracticeStatus,
  targetLabel: string,
): { growth: number; status: PracticeStatus; notes: string[]; applied: number } {
  const nextStatus = { ...opponentStatus };
  if (nextStatus.blockTurns > 0) {
    nextStatus.blockTurns -= 1;
    return {
      growth: opponentGrowth,
      status: nextStatus,
      notes: [`${targetLabel} blocked the hit.`],
      applied: 0,
    };
  }

  const nextGrowth = clampGrowth(opponentGrowth - damage);
  const applied = opponentGrowth - nextGrowth;
  return {
    growth: nextGrowth,
    status: nextStatus,
    notes: applied > 0 ? [`${targetLabel} growth was reduced by ${applied}.`] : [`${targetLabel} had no growth to reduce.`],
    applied,
  };
}

function growSelf(amount: number, selfGrowth: number, actorLabel: string) {
  const nextGrowth = clampGrowth(selfGrowth + amount);
  const applied = nextGrowth - selfGrowth;
  return {
    growth: nextGrowth,
    notes: applied > 0 ? [`${actorLabel} gained +${applied} growth.`] : [`${actorLabel} could not gain more growth.`],
    applied,
  };
}

function resolveMove(
  moveId: number,
  selfGrowth: number,
  opponentGrowth: number,
  selfStatus: PracticeStatus,
  opponentStatus: PracticeStatus,
  actorLabel: string,
  opponentLabel: string,
): MoveResolution {
  const started = applyStartOfTurnStatus(selfGrowth, selfStatus, actorLabel);
  let nextSelfGrowth = started.growth;
  let nextOpponentGrowth = opponentGrowth;
  let nextSelfStatus = started.status;
  let nextOpponentStatus = { ...opponentStatus };
  const notes = [...started.notes];

  const addGrow = (amount: number) => {
    const result = growSelf(amount, nextSelfGrowth, actorLabel);
    nextSelfGrowth = result.growth;
    notes.push(...result.notes);
  };
  const addDamage = (amount: number) => {
    const result = applyDamage(amount, nextOpponentGrowth, nextOpponentStatus, opponentLabel);
    nextOpponentGrowth = result.growth;
    nextOpponentStatus = result.status;
    notes.push(...result.notes);
  };
  const addBlock = () => {
    nextSelfStatus = { ...nextSelfStatus, blockTurns: Math.max(nextSelfStatus.blockTurns, 1) };
    notes.push(`${actorLabel} prepared a block.`);
  };

  switch (moveId) {
    case 1: addDamage(10); break;
    case 2: addDamage(8); break;
    case 3: addDamage(12); break;
    case 4: addDamage(7); break;
    case 5: addDamage(9); break;
    case 6: addDamage(6); break;
    case 7: addDamage(11); break;
    case 8: addDamage(5); addBlock(); break;
    case 9: addDamage(8); addGrow(4); break;
    case 10:
      nextOpponentStatus = { ...nextOpponentStatus, poisonTicks: 2, poisonDpt: 5 };
      notes.push(`${opponentLabel} was poisoned for the next turns.`);
      break;
    case 11:
      if (Math.random() < 0.8) addDamage(15);
      else notes.push(`${actorLabel}'s strike missed.`);
      break;
    case 12:
      if (Math.random() < 0.5) addDamage(10);
      else {
        nextOpponentStatus = { ...nextOpponentStatus, blockTurns: Math.max(nextOpponentStatus.blockTurns, 1) };
        notes.push(`${opponentLabel} gained a block from the pollen cloud.`);
      }
      break;
    case 13:
      addDamage(7);
      nextOpponentStatus = { ...nextOpponentStatus, nextTurnPenalty: 3 };
      notes.push(`${opponentLabel} will lose 3 growth next turn.`);
      break;
    case 20: addGrow(10); break;
    case 21: addGrow(8 + Math.floor(Math.random() * 5)); break;
    case 22: addGrow(15); break;
    case 23:
      addGrow(10 + (Math.random() < 0.2 ? 5 : 0));
      break;
    case 24: addGrow(12 + Math.floor(Math.random() * 7)); break;
    case 25:
      if (Math.random() < 0.9) addGrow(20);
      else notes.push(`${actorLabel}'s power up failed.`);
      break;
    case 26: addGrow(15 + Math.floor(Math.random() * 6)); break;
    case 27: addGrow(10); addBlock(); break;
    case 28: addGrow(12); break;
    case 29:
      addGrow(8);
      if (Math.random() < 0.5) addBlock();
      break;
    case 30: addGrow(10 + Math.floor(Math.random() * 6)); break;
    default:
      notes.push(`${actorLabel} used an unknown move.`);
      break;
  }

  return {
    selfGrowth: nextSelfGrowth,
    opponentGrowth: nextOpponentGrowth,
    selfStatus: nextSelfStatus,
    opponentStatus: nextOpponentStatus,
    outcome: {
      selfGrowthDelta: nextSelfGrowth - selfGrowth,
      opponentGrowthDelta: nextOpponentGrowth - opponentGrowth,
      notes,
    },
  };
}

function expectedGrowth(moveId: number) {
  if (moveId === 9) return 4;
  if (moveId === 20 || moveId === 23 || moveId === 27) return 10;
  if (moveId === 21 || moveId === 29) return 8;
  if (moveId === 22) return 15;
  if (moveId === 24) return 15;
  if (moveId === 25) return 18;
  if (moveId === 26) return 17;
  if (moveId === 28) return 12;
  if (moveId === 30) return 12;
  return 0;
}

function expectedDamage(moveId: number) {
  if (moveId === 1) return 10;
  if (moveId === 2) return 8;
  if (moveId === 3) return 12;
  if (moveId === 4) return 7;
  if (moveId === 5) return 9;
  if (moveId === 6) return 6;
  if (moveId === 7) return 11;
  if (moveId === 8) return 5;
  if (moveId === 9) return 8;
  if (moveId === 11) return 12;
  if (moveId === 12) return 5;
  if (moveId === 13) return 7;
  return 0;
}

function addsBlock(moveId: number) {
  return moveId === 8 || moveId === 12 || moveId === 27 || moveId === 29;
}

function scoreBotMove(moveId: number, battle: PracticeBattle) {
  let score = 0;
  const botBehind = battle.player2Growth < battle.player1Growth;
  const playerNearTarget = battle.player1Growth >= 35;
  const growth = expectedGrowth(moveId);
  const damage = expectedDamage(moveId);

  if (growth > 0 && battle.player2Growth < PRACTICE_TARGET_GROWTH) {
    const usefulGrowth = Math.min(growth, PRACTICE_TARGET_GROWTH - battle.player2Growth);
    score += (botBehind ? 120 : 80) + usefulGrowth;
  }

  if (damage > 0 && battle.player1Growth > 0) {
    const usefulDamage = Math.min(damage, battle.player1Growth);
    score += (playerNearTarget ? 95 : 45) + usefulDamage;
  }

  if (addsBlock(moveId)) {
    score += battle.botStatus.blockTurns > 0 ? 3 : playerNearTarget ? 26 : 12;
  }

  if (moveId === 10 && battle.player1Growth > 0 && battle.playerStatus.poisonTicks === 0) {
    score += playerNearTarget ? 55 : 35;
  }

  const history = battle.botMoveHistory.slice(-4);
  const lastMove = history[history.length - 1];
  const usesInLastFour = history.filter((id) => id === moveId).length;
  if (moveId === lastMove) score -= 90;
  if (usesInLastFour >= 2) score -= 60;

  return Math.max(1, score);
}

function choosePracticeBotMove(battle: PracticeBattle) {
  const scored = battle.player2Moves.map((moveId) => ({
    moveId,
    score: scoreBotMove(moveId, battle),
  }));
  const maxScore = Math.max(...scored.map((item) => item.score));
  let candidates = scored.filter((item) => item.score >= Math.max(1, maxScore - 25));

  if (candidates.length > 1) {
    const lastMove = battle.botMoveHistory[battle.botMoveHistory.length - 1];
    const withoutRepeat = candidates.filter((item) => item.moveId !== lastMove);
    if (withoutRepeat.length > 0) candidates = withoutRepeat;
  }

  if (candidates.length > 1) {
    const recent = battle.botMoveHistory.slice(-4);
    const underLimit = candidates.filter(
      (item) => recent.filter((moveId) => moveId === item.moveId).length < 2,
    );
    if (underLimit.length > 0) candidates = underLimit;
  }

  return randomItem(candidates).moveId;
}

function formatActorMove(moveId: number, actorLabel: string) {
  const effect = MOVE_META[moveId]?.effect;
  if (!effect) return `${actorLabel} used ${MOVE_LABELS[moveId] ?? `Move ${moveId}`}.`;
  return effect
    .replace(/\bYOUR\b/g, actorLabel === "You" ? "your" : "Garden Bot's")
    .replace(/opponent/gi, actorLabel === "You" ? "Garden Bot" : "your tree");
}

function makeEntry(
  actor: ActionEntry["actor"],
  moveId: number,
  prevPlayerGrowth: number,
  nextPlayerGrowth: number,
  prevOpponentGrowth: number,
  nextOpponentGrowth: number,
  details: string[],
  label?: string,
): ActionEntry {
  return {
    id: `${Date.now()}-${actor}-${moveId}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
    actor,
    moveId,
    prevPlayerGrowth,
    nextPlayerGrowth,
    prevOpponentGrowth,
    nextOpponentGrowth,
    details,
    label,
  };
}

function formatDelta(delta: number) {
  if (delta === 0) return "no change";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function playPracticeRound(
  battle: PracticeBattle,
  playerMoveId: number,
): PracticeRoundResult {
  if (battle.finished || battle.winner) {
    return { battle, entries: [] };
  }
  if (!battle.player1Moves.includes(playerMoveId)) {
    throw new Error("That move is not in your Practice Mode hand.");
  }

  const roundStartPlayerGrowth = battle.player1Growth;
  const roundStartBotGrowth = battle.player2Growth;
  const playerResolved = resolveMove(
    playerMoveId,
    battle.player1Growth,
    battle.player2Growth,
    battle.playerStatus,
    battle.botStatus,
    "You",
    "Garden Bot",
  );

  let nextBattle: PracticeBattle = {
    ...battle,
    player1Growth: playerResolved.selfGrowth,
    player2Growth: playerResolved.opponentGrowth,
    playerStatus: playerResolved.selfStatus,
    botStatus: playerResolved.opponentStatus,
    lastMoveMs: Date.now(),
  };

  const playerWon = nextBattle.player1Growth >= PRACTICE_TARGET_GROWTH;
  let botMoveId = 0;
  let botResolved: MoveResolution | null = null;

  if (!playerWon) {
    botMoveId = choosePracticeBotMove(nextBattle);
    botResolved = resolveMove(
      botMoveId,
      nextBattle.player2Growth,
      nextBattle.player1Growth,
      nextBattle.botStatus,
      nextBattle.playerStatus,
      "Garden Bot",
      "Your tree",
    );

    nextBattle = {
      ...nextBattle,
      player1Growth: botResolved.opponentGrowth,
      player2Growth: botResolved.selfGrowth,
      playerStatus: botResolved.opponentStatus,
      botStatus: botResolved.selfStatus,
      botMoveHistory: [...nextBattle.botMoveHistory, botMoveId].slice(-8),
      lastMoveMs: Date.now(),
    };
  }

  const winner =
    nextBattle.player1Growth >= PRACTICE_TARGET_GROWTH
      ? PRACTICE_PLAYER_ADDRESS
      : nextBattle.player2Growth >= PRACTICE_TARGET_GROWTH
        ? PRACTICE_BOT_ADDRESS
        : null;

  nextBattle = {
    ...nextBattle,
    finished: !!winner,
    winner,
  };

  const playerDelta = nextBattle.player1Growth - roundStartPlayerGrowth;
  const botDelta = nextBattle.player2Growth - roundStartBotGrowth;
  const entries: ActionEntry[] = [
    makeEntry(
      "you",
      playerMoveId,
      roundStartPlayerGrowth,
      playerResolved.selfGrowth,
      roundStartBotGrowth,
      playerResolved.opponentGrowth,
      [formatActorMove(playerMoveId, "You"), ...playerResolved.outcome.notes],
    ),
  ];

  if (botResolved && botMoveId) {
    entries.push(
      makeEntry(
        "opponent",
        botMoveId,
        playerResolved.selfGrowth,
        nextBattle.player1Growth,
        playerResolved.opponentGrowth,
        nextBattle.player2Growth,
        [formatActorMove(botMoveId, "Garden Bot"), ...botResolved.outcome.notes],
        MOVE_LABELS[botMoveId] ?? `Garden Bot Move #${botMoveId}`,
      ),
    );
  }

  entries.push(
    makeEntry(
      "round",
      0,
      roundStartPlayerGrowth,
      nextBattle.player1Growth,
      roundStartBotGrowth,
      nextBattle.player2Growth,
      [
        `Round result: You ${nextBattle.player1Growth} / ${PRACTICE_TARGET_GROWTH} - Garden Bot ${nextBattle.player2Growth} / ${PRACTICE_TARGET_GROWTH}`,
        `Your tree: ${roundStartPlayerGrowth} -> ${nextBattle.player1Growth} (${formatDelta(playerDelta)})`,
        `Garden Bot: ${roundStartBotGrowth} -> ${nextBattle.player2Growth} (${formatDelta(botDelta)})`,
        ...(winner
          ? [
              winner === PRACTICE_PLAYER_ADDRESS
                ? "You reached the Practice Mode target first."
                : "Garden Bot reached the Practice Mode target first.",
            ]
          : []),
      ],
      "Round Result",
    ),
  );

  return { battle: nextBattle, entries };
}
