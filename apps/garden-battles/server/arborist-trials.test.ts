import assert from "node:assert/strict";
import test from "node:test";
import { getTodayArboristTrial, submitTodayArboristTrial } from "./arborist-trials";

const now = new Date("2026-08-23T12:00:00.000Z");

test("today endpoint exposes a deterministic empty daily board", () => {
  const response = getTodayArboristTrial(undefined, now);
  assert.equal(response.challenge.id, "arborist-trial-v1-2026-08-23");
  assert.equal(response.rankedAttemptUsed, false);
  assert.equal(response.result, null);
  assert.equal(response.streak, 0);
});

test("ranked submission rejects invalid wallets before writing a result", () => {
  const submission = submitTodayArboristTrial({
    wallet: "not-a-sui-wallet",
    challengeId: "arborist-trial-v1-2026-08-23",
    won: true,
    rounds: 10,
    playerGrowth: 50,
    botGrowth: 20,
    uniqueMoves: 4,
  }, now);
  assert.equal(submission.status, 400);
  assert.deepEqual(submission.body, { ok: false, reason: "valid_wallet_required" });
});

test("ranked submission rejects expired challenge identifiers", () => {
  const submission = submitTodayArboristTrial({
    wallet: `0x${"1".repeat(64)}`,
    challengeId: "arborist-trial-v1-2026-08-22",
    won: true,
    rounds: 10,
    playerGrowth: 50,
    botGrowth: 20,
    uniqueMoves: 4,
  }, now);
  assert.equal(submission.status, 409);
  assert.deepEqual(submission.body, { ok: false, reason: "challenge_expired" });
});
