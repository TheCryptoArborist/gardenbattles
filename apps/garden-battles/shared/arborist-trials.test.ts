import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateArboristTrialScore,
  getArboristTrialChallenge,
} from "./arborist-trials";

test("the daily challenge is stable throughout a UTC day", () => {
  const morning = getArboristTrialChallenge(new Date("2026-08-23T00:01:00.000Z"));
  const evening = getArboristTrialChallenge(new Date("2026-08-23T23:59:00.000Z"));
  assert.deepEqual(morning, evening);
  assert.equal(morning.id, "arborist-trial-v1-2026-08-23");
  assert.equal(morning.targetGrowth, 50);
  assert.equal(morning.expiresAt, Date.parse("2026-08-24T00:00:00.000Z"));
});

test("daily challenges rotate when the UTC date changes", () => {
  const first = getArboristTrialChallenge(new Date("2026-08-23T12:00:00.000Z"));
  const second = getArboristTrialChallenge(new Date("2026-08-24T12:00:00.000Z"));
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.seed, second.seed);
});

test("winning efficiently and using more cards improves the score", () => {
  const efficient = calculateArboristTrialScore({ won: true, rounds: 10, playerGrowth: 50, botGrowth: 20, uniqueMoves: 5 });
  const slow = calculateArboristTrialScore({ won: true, rounds: 20, playerGrowth: 50, botGrowth: 30, uniqueMoves: 3 });
  const loss = calculateArboristTrialScore({ won: false, rounds: 10, playerGrowth: 40, botGrowth: 50, uniqueMoves: 5 });
  assert.ok(efficient > slow);
  assert.ok(slow > loss);
});
