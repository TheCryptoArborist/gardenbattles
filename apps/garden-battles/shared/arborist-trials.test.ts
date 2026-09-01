import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateArboristTrialScore,
  createArboristTrialProofMessage,
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

test("version two schedules all seven challenge types once per week without repeats", () => {
  const challenges = Array.from({ length: 14 }, (_, index) => {
    const date = new Date("2026-09-02T12:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return getArboristTrialChallenge(date);
  });
  assert.equal(new Set(challenges.slice(0, 7).map((challenge) => challenge.title)).size, 7);
  assert.equal(new Set(challenges.slice(7).map((challenge) => challenge.title)).size, 7);
  for (let index = 1; index < challenges.length; index += 1) {
    assert.notEqual(challenges[index].title, challenges[index - 1].title);
  }
  assert.equal(challenges[0].id, "arborist-trial-v2-2026-09-02");
  assert.equal(challenges[1].rule, "canopy_diagnosis");
  assert.equal(challenges[3].rule, "toolbelt_rotation");
  assert.equal(challenges[5].rule, "storm_response");
  assert.equal(challenges[6].rule, "integrated_pest_management");
});

test("ranked proof messages bind the wallet, challenge, and complete move sequence", () => {
  assert.equal(
    createArboristTrialProofMessage(
      "arborist-trial-v1-2026-08-23",
      `0x${"A".repeat(64)}`,
      [22, 5, 15],
    ),
    `Garden Battles Arborist Trial\nChallenge: arborist-trial-v1-2026-08-23\nWallet: 0x${"a".repeat(64)}\nMoves: 22,5,15`,
  );
});

test("winning efficiently and using more cards improves the score", () => {
  const efficient = calculateArboristTrialScore({ won: true, rounds: 10, playerGrowth: 50, botGrowth: 20, uniqueMoves: 5 });
  const slow = calculateArboristTrialScore({ won: true, rounds: 20, playerGrowth: 50, botGrowth: 30, uniqueMoves: 3 });
  const loss = calculateArboristTrialScore({ won: false, rounds: 10, playerGrowth: 40, botGrowth: 50, uniqueMoves: 5 });
  assert.ok(efficient > slow);
  assert.ok(slow > loss);
});

test("specialty points improve a challenge score without replacing the base score", () => {
  const base = calculateArboristTrialScore({ won: true, rounds: 10, playerGrowth: 50, botGrowth: 20, uniqueMoves: 4 });
  const specialty = calculateArboristTrialScore({ won: true, rounds: 10, playerGrowth: 50, botGrowth: 20, uniqueMoves: 4, specialtyBonus: 1_500 });
  assert.equal(specialty - base, 1_500);
});
