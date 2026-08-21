import { MOVE_LABELS } from "../../battle-gardenfrontend/src/lib/sui-config";

type Status = { block: number; poisonTicks: number; poisonDpt: number; penalty: number };
type Fighter = { growth: number; status: Status; hand: number[]; lastMove: number | null };

const ATTACKS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 16];
const GROWTHS = [15, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30];
const HYBRIDS = [8, 9, 14, 17, 18, 27, 29];
const ALL = [...ATTACKS, ...GROWTHS, ...HYBRIDS];

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
function uniquePick(pool: number[], excluded: number[]) {
  return pick(pool.filter((move) => !excluded.includes(move)));
}
function deal(entitled: boolean) {
  const base = [pick(ATTACKS), pick(GROWTHS), pick(HYBRIDS)];
  base.push(uniquePick(ALL, base));
  if (!entitled) return base;
  const candidates = [
    uniquePick(ATTACKS, base),
    uniquePick(GROWTHS, base),
    uniquePick(HYBRIDS, base),
  ];
  return [...base, chooseDraftCard(candidates)];
}

function expectedGrowth(move: number, self: Fighter, opponent: Fighter) {
  const values: Record<number, number> = {
    9: 4, 14: 8, 15: self.growth < opponent.growth ? 14 : 7,
    17: 6, 18: 6, 19: 11.2, 20: 10, 21: 10, 22: 15,
    23: 11, 24: 15, 25: 18, 26: 17.5, 27: 10, 28: 12,
    29: 8, 30: 12.5,
  };
  return values[move] ?? 0;
}
function expectedDamage(move: number, self: Fighter) {
  const values: Record<number, number> = {
    1: 10, 2: 8, 3: 12, 4: 7, 5: 9, 6: 6, 7: 11,
    8: 5, 9: 8, 10: 10, 11: 12, 12: 5, 13: 10,
    16: self.growth >= 5 ? 15 : 0, 18: 6,
  };
  return values[move] ?? 0;
}
function addsBlock(move: number) { return [8, 17, 27, 29].includes(move); }
function scoreMove(move: number, self: Fighter, opponent: Fighter, target: number) {
  const growth = Math.min(expectedGrowth(move, self, opponent), Math.max(0, target - self.growth));
  const damage = Math.min(expectedDamage(move, self), opponent.growth);
  let score = growth * 2.2 + damage * 1.7;
  if (self.growth + growth >= target) score += 1000;
  if (opponent.growth >= target - 15) score += damage * 1.5;
  if (addsBlock(move) && self.status.block === 0 && opponent.growth > 0) score += 8;
  if (move === 10 && opponent.status.poisonTicks === 0 && opponent.growth > 0) score += 15;
  if (move === 14 && (self.status.poisonTicks > 0 || self.status.penalty > 0)) score += 18;
  if (move === 16 && self.growth < 5) score = -100;
  return score + random() * 4;
}
function chooseDraftCard(candidates: number[]) {
  const neutral: Fighter = { growth: 20, status: emptyStatus(), hand: [], lastMove: null };
  const opponent: Fighter = { growth: 25, status: emptyStatus(), hand: [], lastMove: null };
  return candidates.reduce((best, move) =>
    scoreMove(move, neutral, opponent, 50) > scoreMove(best, neutral, opponent, 50) ? move : best,
  );
}
function chooseMove(self: Fighter, opponent: Fighter, target: number) {
  const legal = self.hand.filter((move) => move !== self.lastMove);
  return legal.reduce((best, move) =>
    scoreMove(move, self, opponent, target) > scoreMove(best, self, opponent, target) ? move : best,
  );
}
function emptyStatus(): Status { return { block: 0, poisonTicks: 0, poisonDpt: 0, penalty: 0 }; }
function damage(opponent: Fighter, amount: number) {
  if (opponent.status.block > 0) { opponent.status.block -= 1; return; }
  opponent.growth = clamp(opponent.growth - amount);
}
function startTurn(self: Fighter) {
  self.growth = clamp(self.growth - self.status.penalty);
  self.status.penalty = 0;
  if (self.status.poisonTicks > 0) {
    self.growth = clamp(self.growth - self.status.poisonDpt);
    self.status.poisonTicks -= 1;
    if (self.status.poisonTicks === 0) self.status.poisonDpt = 0;
  }
}
function play(move: number, self: Fighter, opponent: Fighter) {
  if (move === 14) Object.assign(self.status, { poisonTicks: 0, poisonDpt: 0, penalty: 0 });
  else startTurn(self);
  const grow = (amount: number) => { self.growth = clamp(self.growth + amount); };
  const block = () => { self.status.block += 1; };
  if (move >= 1 && move <= 7) damage(opponent, [0, 10, 8, 12, 7, 9, 6, 11][move]);
  else if (move === 8) { damage(opponent, 5); block(); }
  else if (move === 9) { damage(opponent, 8); grow(4); }
  else if (move === 10) Object.assign(opponent.status, { poisonTicks: 2, poisonDpt: 5 });
  else if (move === 11) { if (random() >= 0.2) damage(opponent, 15); }
  else if (move === 12) { if (random() >= 0.5) damage(opponent, 10); else opponent.status.block += 1; }
  else if (move === 13) { damage(opponent, 7); opponent.status.penalty += 3; }
  else if (move === 14) { grow(8); Object.assign(self.status, { poisonTicks: 0, poisonDpt: 0, penalty: 0 }); }
  else if (move === 15) grow(self.growth < opponent.growth ? 14 : 7);
  else if (move === 16 && self.growth >= 5) { self.growth -= 5; damage(opponent, 15); }
  else if (move === 17) { grow(6); block(); }
  else if (move === 18) { grow(6); damage(opponent, 6); }
  else if (move === 19) { if (random() < 0.4) self.growth = clamp(self.growth - 5); else grow(22); }
  else if (move === 20) grow(10);
  else if (move === 21) grow(8 + Math.floor(random() * 5));
  else if (move === 22) grow(15);
  else if (move === 23) grow(10 + (random() < 0.2 ? 5 : 0));
  else if (move === 24) grow(12 + Math.floor(random() * 7));
  else if (move === 25) { if (random() >= 0.1) grow(20); }
  else if (move === 26) grow(15 + Math.floor(random() * 6));
  else if (move === 27) { grow(10); self.status.block = 1; }
  else if (move === 28) grow(12);
  else if (move === 29) { grow(8); if (random() >= 0.5) block(); }
  else if (move === 30) grow(10 + Math.floor(random() * 6));
  self.lastMove = move;
}

function runBatch(matches: number, target: number, entitled: boolean, randomStarter: boolean) {
  const uses = new Map<number, number>();
  let p1Wins = 0;
  let totalTurns = 0;
  let stalled = 0;
  for (let game = 0; game < matches; game += 1) {
    const fighters: [Fighter, Fighter] = [
      { growth: 0, status: emptyStatus(), hand: deal(entitled), lastMove: null },
      { growth: 0, status: emptyStatus(), hand: deal(entitled), lastMove: null },
    ];
    const starter = randomStarter && random() < 0.5 ? 1 : 0;
    let winner = -1;
    let turn = 0;
    for (; turn < 120; turn += 1) {
      const current = (starter + turn) % 2;
      const move = chooseMove(fighters[current], fighters[1 - current], target);
      uses.set(move, (uses.get(move) ?? 0) + 1);
      play(move, fighters[current], fighters[1 - current]);
      if (fighters[current].growth >= target) { winner = current; turn += 1; break; }
    }
    if (winner === 0) p1Wins += 1;
    if (winner < 0) stalled += 1;
    totalTurns += turn;
  }
  const totalUses = [...uses.values()].reduce((sum, count) => sum + count, 0);
  const mostUsed = [...uses.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([move, count]) => `${MOVE_LABELS[move]} ${(count / totalUses * 100).toFixed(1)}%`)
    .join(", ");
  console.log(JSON.stringify({
    matches, target, hand: entitled ? "fifth-draft" : "standard",
    starter: randomStarter ? "random" : "queue-player-first",
    averageTurns: Number((totalTurns / matches).toFixed(2)),
    player1WinRate: Number((p1Wins / matches * 100).toFixed(2)),
    stalled,
    mostUsed,
  }));
}

const matches = Number(process.argv[2] ?? 25_000);
for (const target of [50, 75]) {
  runBatch(matches, target, false, false);
  runBatch(matches, target, false, true);
  runBatch(matches, target, true, false);
  runBatch(matches, target, true, true);
}
