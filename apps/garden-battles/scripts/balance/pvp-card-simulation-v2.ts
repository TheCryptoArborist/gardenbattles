type MoveType = "attack" | "growth" | "hybrid";
type Status = {
  block: number;
  reflect: number;
  armorHalf: boolean;
  attackCap: number | null;
  poisonTicks: number;
  poisonDpt: number;
  penalty: number;
};
type Fighter = { growth: number; status: Status; hand: number[]; lastMove: number | null };

const NAMES: Record<number, string> = {
  1: "Wedgebreaker", 2: "Skyreach Saw", 3: "Chainsaw Cyclone", 4: "Rootpiercer",
  5: "Limbfall Slam", 6: "Acorn Barrage", 7: "Log Swing Rampage", 8: "Barklash Shield",
  9: "Root Siphon", 10: "Beetle Blight", 11: "Lightning Crown", 12: "Air Spade Blast",
  13: "Fungal Doom", 14: "Compost Cleanse", 15: "Rootlink Surge", 16: "Pruning Fury",
  17: "Mulch Fortress", 18: "Graft Fusion", 19: "Wildwood Gamble", 20: "Root Revival",
  21: "Solar Bloom", 22: "Rainmaker", 23: "Myco Might", 24: "Canopy Downpour",
  25: "Potassium Power", 26: "Photosynthesis Overdrive", 27: "Ironbark Armor",
  28: "Sap Surge", 29: "Gale Guard", 30: "Shadow Canopy",
  31: "Chainsaw Cataclysm", 32: "Beetle Swarm Blitz", 33: "Lightning Split",
  34: "Ancient Root Awakening", 35: "Canopy Explosion", 36: "Solar Crown Surge",
  37: "Ironwood Fortress", 38: "Rootstorm Siphon", 39: "Arborist Ascension",
};
const ATTACKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 16];
const GROWTHS = [15, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30];
const HYBRIDS = [8, 9, 14, 17, 18, 27, 29];
const ULTIMATE_ATTACKS = [31, 32, 33];
const ULTIMATE_GROWTHS = [34, 35, 36];
const ULTIMATE_HYBRIDS = [37, 38, 39];
const ALL = [...ATTACKS, ...GROWTHS, ...HYBRIDS];
const TYPES = new Map<number, MoveType>([
  ...ATTACKS.map((id) => [id, "attack"] as const),
  ...GROWTHS.map((id) => [id, "growth"] as const),
  ...HYBRIDS.map((id) => [id, "hybrid"] as const),
  ...ULTIMATE_ATTACKS.map((id) => [id, "attack"] as const),
  ...ULTIMATE_GROWTHS.map((id) => [id, "growth"] as const),
  ...ULTIMATE_HYBRIDS.map((id) => [id, "hybrid"] as const),
]);

let seed = 0x6d2b79f5;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(items: T[]) { return items[Math.floor(random() * items.length)]; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
function uniquePick(pool: number[], excluded: number[]) { return pick(pool.filter((id) => !excluded.includes(id))); }
function emptyStatus(): Status {
  return { block: 0, reflect: 0, armorHalf: false, attackCap: null, poisonTicks: 0, poisonDpt: 0, penalty: 0 };
}
function deal(entitled: boolean, draftSelections?: Map<number, number>) {
  const base = [pick(ATTACKS), pick(GROWTHS), pick(HYBRIDS)];
  base.push(uniquePick(ALL, base));
  if (!entitled) return base;
  const draft = [pick(ULTIMATE_ATTACKS), pick(ULTIMATE_GROWTHS), pick(ULTIMATE_HYBRIDS)];
  const selected = chooseDraftCard(draft);
  draftSelections?.set(selected, (draftSelections.get(selected) ?? 0) + 1);
  return [...base, selected];
}

function expectedGrowth(move: number, self: Fighter, opponent: Fighter) {
  const lastType = self.lastMove ? TYPES.get(self.lastMove) : undefined;
  const opponentLastType = opponent.lastMove ? TYPES.get(opponent.lastMove) : undefined;
  const values: Record<number, number> = {
    8: 6, 9: 4, 14: self.status.poisonTicks > 0 || self.status.penalty > 0 ? 14 : 10,
    15: self.growth < opponent.growth ? 12 : 8, 17: self.status.block > 0 ? 10 : 7,
    18: 5, 19: 10.4, 20: 10, 21: 11, 22: opponentLastType === "attack" ? 14 : 10,
    23: opponent.status.block > 0 ? 15 : 10, 24: 14, 25: 12, 26: lastType === "attack" ? 13 : 11,
    27: 7, 28: self.growth <= 10 ? 13 : 10, 29: 8, 30: 8,
    31: 3, 32: 4, 33: 3, 34: self.growth < opponent.growth ? 11 : 10,
    35: 10, 36: 9, 37: 7, 38: 6, 39: 8,
  };
  return values[move] ?? (ATTACKS.includes(move) && opponent.growth === 0 ? 4 : 0);
}
function expectedDamage(move: number, self: Fighter, opponent: Fighter) {
  const opponentLastType = opponent.lastMove ? TYPES.get(opponent.lastMove) : undefined;
  const values: Record<number, number> = {
    1: opponent.status.block > 0 ? 7 : 11,
    2: opponent.growth >= 40 ? 12 : 8,
    3: 12,
    4: 11,
    5: opponentLastType === "growth" ? 12 : 8,
    6: opponent.status.block > 0 ? 6 : 12,
    7: self.growth < opponent.growth ? 13 : 10,
    8: 0,
    9: 6,
    10: opponent.status.poisonTicks > 0 ? 0 : 8,
    11: 12.75,
    12: 10,
    13: 11,
    16: self.growth >= 4 ? 16 : 0,
    18: 6,
    31: 8, 32: opponent.status.poisonTicks > 0 ? 0 : 6, 33: 7.5,
    38: 6,
  };
  return values[move] ?? 0;
}
function defenseValue(move: number, self: Fighter, opponent: Fighter) {
  if (move === 8) return self.status.block > 0 ? 2 : 12;
  if (move === 17) return self.status.block > 0 ? 0 : 8;
  if (move === 27) return self.status.armorHalf ? 1 : 7;
  if (move === 29) return self.status.block > 0 ? 0 : 4;
  if (move === 30) return self.status.attackCap !== null ? 1 : 6;
  if (move === 35 && opponent.status.block > 0) return 5;
  if (move === 36) return self.status.poisonTicks > 0 || self.status.penalty > 0 ? 12 : 0;
  if (move === 37) return self.status.block > 0 ? 2 : 8;
  if (move === 39) return self.status.attackCap !== null ? 1 : 4;
  if (move === 12 && opponent.status.block > 0) return 6;
  return 0;
}
function scoreMove(move: number, self: Fighter, opponent: Fighter, target: number) {
  const growth = Math.min(expectedGrowth(move, self, opponent), Math.max(0, target - self.growth));
  const damage = Math.min(expectedDamage(move, self, opponent), opponent.growth);
  let score = growth * 2.2 + damage * 1.7 + defenseValue(move, self, opponent);
  if (self.growth + growth >= target) score += 1000;
  if (opponent.growth >= target - 15) score += damage * 1.4;
  if (move === 10 && opponent.status.poisonTicks === 0 && opponent.growth > 0) score += 9;
  if (move === 32 && opponent.status.poisonTicks === 0 && opponent.growth > 0) score += 4;
  if (move === 14 && (self.status.poisonTicks > 0 || self.status.penalty > 0)) score += 22;
  if (move === 36 && (self.status.poisonTicks > 0 || self.status.penalty > 0)) score += 22;
  if (move === 20 && self.status.penalty > 0) score += 10;
  if (move === 16) score = self.growth < 4 ? -100 : score - 8.8;
  if (move === 24) score -= Math.min(4, Math.max(0, target - opponent.growth)) * 1.8;
  return score + random() * 3;
}
function chooseDraftCard(candidates: number[]) {
  // Score the permanent fifth-card choice at a representative mid-battle state.
  // At zero Growth, every drain effect is artificially worthless even though the card stays all match.
  const self: Fighter = { growth: 20, status: emptyStatus(), hand: [], lastMove: null };
  const opponent: Fighter = { growth: 20, status: emptyStatus(), hand: [], lastMove: null };
  const scored = candidates.map((move) => ({ move, score: scoreMove(move, self, opponent, 50) + random() * 8 }));
  return scored.reduce((best, candidate) => candidate.score > best.score ? candidate : best).move;
}
function chooseMove(self: Fighter, opponent: Fighter, target: number) {
  const legal = self.hand.filter((move) => move !== self.lastMove);
  return legal.reduce((best, move) => scoreMove(move, self, opponent, target) > scoreMove(best, self, opponent, target) ? move : best);
}

function directDamage(attacker: Fighter, opponent: Fighter, amount: number, options: { piercing?: boolean } = {}) {
  let resolved = amount;
  if (!options.piercing && opponent.status.block > 0) {
    opponent.status.block -= 1;
    if (opponent.status.reflect > 0) {
      attacker.growth = clamp(attacker.growth - opponent.status.reflect);
      opponent.status.reflect = 0;
    }
    return;
  }
  if (opponent.status.attackCap !== null) {
    resolved = Math.min(resolved, opponent.status.attackCap);
    opponent.status.attackCap = null;
  }
  if (opponent.status.armorHalf) {
    resolved = Math.ceil(resolved / 2);
    opponent.status.armorHalf = false;
  }
  opponent.growth = clamp(opponent.growth - resolved);
}
function startTurn(self: Fighter, move: number, totalTurn: number) {
  const naturalGrowth = totalTurn >= 26 ? 3 : totalTurn >= 16 ? 2 : 1;
  self.growth = clamp(self.growth + naturalGrowth);
  if (move === 14 || move === 36) {
    self.status.penalty = 0;
    self.status.poisonTicks = 0;
    self.status.poisonDpt = 0;
    return;
  }
  if (move === 20) self.status.penalty = 0;
  if (self.status.penalty > 0) {
    self.growth = clamp(self.growth - self.status.penalty);
    self.status.penalty = 0;
  }
  if (self.status.poisonTicks > 0) {
    self.growth = clamp(self.growth - self.status.poisonDpt);
    self.status.poisonTicks -= 1;
    if (self.status.poisonTicks === 0) self.status.poisonDpt = 0;
  }
}
function play(move: number, self: Fighter, opponent: Fighter, totalTurn: number) {
  const hadPendingDamage = self.status.poisonTicks > 0 || self.status.penalty > 0;
  startTurn(self, move, totalTurn);
  const grow = (amount: number) => { self.growth = clamp(self.growth + amount); };
  if (ATTACKS.includes(move) && opponent.growth === 0) grow(4);
  const opponentLastType = opponent.lastMove ? TYPES.get(opponent.lastMove) : undefined;
  const selfLastType = self.lastMove ? TYPES.get(self.lastMove) : undefined;
  if (move === 1) {
    if (opponent.status.block > 0) {
      opponent.status.block -= 1;
      opponent.status.reflect = 0;
      opponent.growth = clamp(opponent.growth - 7);
    } else directDamage(self, opponent, 11);
  } else if (move === 2) directDamage(self, opponent, opponent.growth >= 40 ? 12 : 8);
  else if (move === 3) { if (random() < 0.75) directDamage(self, opponent, 16); }
  else if (move === 4) directDamage(self, opponent, 11, { piercing: true });
  else if (move === 5) directDamage(self, opponent, opponentLastType === "growth" ? 12 : 8);
  else if (move === 6) { directDamage(self, opponent, 6); directDamage(self, opponent, 6); }
  else if (move === 7) directDamage(self, opponent, self.growth < opponent.growth ? 13 : 10);
  else if (move === 8) {
    grow(6);
    if (self.status.block === 0) { self.status.block = 1; self.status.reflect = 4; }
  } else if (move === 9) { directDamage(self, opponent, 6); grow(4); }
  else if (move === 10 && opponent.status.poisonTicks === 0) {
    opponent.status.poisonTicks = 2; opponent.status.poisonDpt = 4;
  } else if (move === 11) { if (random() < 0.75) directDamage(self, opponent, 17); }
  else if (move === 12) {
    if (opponent.status.block > 0) { opponent.status.block -= 1; opponent.status.reflect = 0; }
    directDamage(self, opponent, 10, { piercing: true });
  } else if (move === 13) { directDamage(self, opponent, 7); opponent.status.penalty += 4; }
  else if (move === 14) grow(hadPendingDamage ? 14 : 10);
  else if (move === 15) grow(self.growth < opponent.growth ? 12 : 8);
  else if (move === 16 && self.growth >= 4) { self.growth -= 4; directDamage(self, opponent, 16); }
  else if (move === 17) {
    if (self.status.block > 0) grow(10); else { grow(7); self.status.block += 1; }
  } else if (move === 18) { grow(5); directDamage(self, opponent, 5); }
  else if (move === 19) { if (random() < 0.6) grow(20); else self.growth = clamp(self.growth - 4); }
  else if (move === 20) grow(10);
  else if (move === 21) grow(8 + Math.floor(random() * 7));
  else if (move === 22) grow(opponentLastType === "attack" ? 14 : 10);
  else if (move === 23) grow(opponent.status.block > 0 ? 15 : 10);
  else if (move === 24) { grow(14); opponent.growth = clamp(opponent.growth + 3); }
  else if (move === 25) grow(random() < 0.75 ? 15 : 3);
  else if (move === 26) grow(selfLastType === "attack" ? 13 : 11);
  else if (move === 27) { grow(7); self.status.armorHalf = true; }
  else if (move === 28) grow(self.growth <= 10 ? 13 : 10);
  else if (move === 29) { grow(8); if (random() < 0.5) self.status.block += 1; }
  else if (move === 30) { grow(8); self.status.attackCap = 8; }
  else if (move === 31) { grow(3); directDamage(self, opponent, 8); }
  else if (move === 32) {
    grow(4);
    if (opponent.status.poisonTicks === 0) {
      opponent.status.poisonTicks = 2; opponent.status.poisonDpt = 3;
    }
  } else if (move === 33) { grow(3); if (random() < 0.75) directDamage(self, opponent, 10); }
  else if (move === 34) grow(self.growth < opponent.growth ? 11 : 10);
  else if (move === 35) {
    if (opponent.status.block > 0) { opponent.status.block -= 1; opponent.status.reflect = 0; }
    grow(10);
  } else if (move === 36) grow(9);
  else if (move === 37) { grow(7); self.status.block = Math.min(1, self.status.block + 1); }
  else if (move === 38) { grow(6); directDamage(self, opponent, 6); }
  else if (move === 39) { grow(8); self.status.attackCap = 8; }
  self.lastMove = move;
}

type BatchOptions = {
  matches: number;
  target: number;
  entitled: boolean;
  p1Only?: boolean;
  randomStarter: boolean;
  secondPlayerGrowth: number;
};
function runBatch(options: BatchOptions) {
  const uses = new Map<number, number>();
  const draftSelections = new Map<number, number>();
  let p1Wins = 0;
  let p2Wins = 0;
  let totalTurns = 0;
  let stalled = 0;
  let decisionsAtTurnLimit = 0;
  for (let game = 0; game < options.matches; game += 1) {
    const fighters: [Fighter, Fighter] = [
      { growth: 0, status: emptyStatus(), hand: deal(options.entitled || options.p1Only === true, draftSelections), lastMove: null },
      { growth: options.secondPlayerGrowth, status: emptyStatus(), hand: deal(options.entitled, draftSelections), lastMove: null },
    ];
    const starter = options.randomStarter && random() < 0.5 ? 1 : 0;
    let winner = -1;
    let turn = 0;
    const turnLimit = options.target === 50 ? 50 : 65;
    for (; turn < turnLimit; turn += 1) {
      const current = (starter + turn) % 2;
      const move = chooseMove(fighters[current], fighters[1 - current], options.target);
      uses.set(move, (uses.get(move) ?? 0) + 1);
      play(move, fighters[current], fighters[1 - current], turn);
      if (fighters[current].growth >= options.target) { winner = current; turn += 1; break; }
    }
    if (winner < 0 && fighters[0].growth !== fighters[1].growth) {
      winner = fighters[0].growth > fighters[1].growth ? 0 : 1;
      decisionsAtTurnLimit += 1;
    }
    if (winner === 0) p1Wins += 1;
    else if (winner === 1) p2Wins += 1;
    else stalled += 1;
    totalTurns += turn;
  }
  const decisive = p1Wins + p2Wins;
  const totalUses = [...uses.values()].reduce((sum, count) => sum + count, 0);
  const sortedUses = [...uses.entries()].sort((a, b) => b[1] - a[1]);
  const usage = (entries: Array<[number, number]>) => entries
    .map(([move, count]) => `${NAMES[move]} ${(count / totalUses * 100).toFixed(1)}%`).join(", ");
  const totalSelections = [...draftSelections.values()].reduce((sum, count) => sum + count, 0);
  const fifthSelections = totalSelections === 0 ? undefined : [...draftSelections.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([move, count]) => `${NAMES[move]} ${(count / totalSelections * 100).toFixed(1)}%`).join(", ");
  console.log(JSON.stringify({
    target: options.target,
    hand: options.p1Only ? "p1-fifth-vs-standard" : options.entitled ? "fifth-draft" : "standard",
    starter: options.randomStarter ? "random" : "queue-player-first",
    secondPlayerGrowth: options.secondPlayerGrowth,
    averageTurns: Number((totalTurns / options.matches).toFixed(2)),
    p1DecisiveWinRate: Number((p1Wins / decisive * 100).toFixed(2)),
    stalled,
    decisionsAtTurnLimit,
    fifthSelections,
    mostUsed: usage(sortedUses.slice(0, 6)),
    leastUsed: usage(sortedUses.slice(-6).reverse()),
  }));
}

const matches = Number(process.argv[2] ?? 25_000);
for (const target of [50, 75]) {
  for (const entitled of [false, true]) {
    runBatch({ matches, target, entitled, randomStarter: false, secondPlayerGrowth: 0 });
    runBatch({ matches, target, entitled, randomStarter: false, secondPlayerGrowth: 3 });
    runBatch({ matches, target, entitled, randomStarter: true, secondPlayerGrowth: 0 });
  }
  runBatch({ matches, target, entitled: false, p1Only: true, randomStarter: true, secondPlayerGrowth: 0 });
}
