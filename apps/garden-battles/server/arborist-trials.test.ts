import assert from "node:assert/strict";
import test from "node:test";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import {
  createArboristTrialProofMessage,
  getArboristTrialChallenge,
} from "../shared/arborist-trials";
import {
  getTodayArboristTrial,
  replayArboristTrial,
  submitTodayArboristTrial,
} from "./arborist-trials";

const now = new Date("2026-08-23T12:00:00.000Z");

test("today endpoint exposes a deterministic empty daily board", () => {
  const response = getTodayArboristTrial(undefined, now);
  assert.equal(response.challenge.id, "arborist-trial-v1-2026-08-23");
  assert.equal(response.rankedAttemptUsed, false);
  assert.equal(response.result, null);
  assert.equal(response.streak, 0);
  assert.equal(response.checkInStreak, 0);
  assert.equal(response.checkIns.length, 7);
  assert.deepEqual(response.checkIns.at(-1), {
    date: "2026-08-23",
    completed: false,
    won: false,
  });
  assert.equal(response.achievements.length, 7);
  assert.equal(response.achievements.every((badge) => !badge.earned), true);
});

test("ranked submission rejects invalid wallets before writing a result", async () => {
  const submission = await submitTodayArboristTrial({
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

test("ranked submission rejects expired challenge identifiers", async () => {
  const submission = await submitTodayArboristTrial({
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

test("ranked submission requires a wallet signature", async () => {
  const submission = await submitTodayArboristTrial({
    wallet: `0x${"2".repeat(64)}`,
    challengeId: "arborist-trial-v1-2026-08-23",
    playerMoves: [1],
    signature: "not-a-signature",
  }, now);
  assert.equal(submission.status, 401);
  assert.deepEqual(submission.body, { ok: false, reason: "wallet_signature_required" });
});

test("ranked submission accepts a valid proof from the submitting wallet", async () => {
  const keypair = new Ed25519Keypair();
  const wallet = keypair.getPublicKey().toSuiAddress();
  const playerMoves = [24];
  const message = new TextEncoder().encode(
    createArboristTrialProofMessage(
      "arborist-trial-v1-2026-08-23",
      wallet,
      playerMoves,
    ),
  );
  const { signature } = await keypair.signPersonalMessage(message);
  const submission = await submitTodayArboristTrial({
    wallet,
    challengeId: "arborist-trial-v1-2026-08-23",
    playerMoves,
    signature,
  }, now);
  assert.equal(submission.status, 400);
  assert.deepEqual(submission.body, { ok: false, reason: "incomplete_trial" });
});

test("ranked submission rejects a signed but incomplete deterministic replay", async () => {
  const submission = await submitTodayArboristTrial({
    wallet: `0x${"3".repeat(64)}`,
    challengeId: "arborist-trial-v1-2026-08-23",
    playerMoves: [24],
    signature: "injected-valid-proof",
  }, now, {
    verifyWalletProof: async () => true,
  });
  assert.equal(submission.status, 400);
  assert.deepEqual(submission.body, { ok: false, reason: "incomplete_trial" });
});

test("ranked submission rejects a completed result when the wallet has no NFTree", async () => {
  const submission = await submitTodayArboristTrial({
    wallet: `0x${"4".repeat(64)}`,
    challengeId: "arborist-trial-v1-2026-08-23",
    playerMoves: [30, 18, 30, 11, 30, 18, 30, 24],
    signature: "injected-valid-proof",
  }, now, {
    verifyWalletProof: async () => true,
    hasNftreeAccess: async () => false,
  });
  assert.equal(submission.status, 403);
  assert.deepEqual(submission.body, { ok: false, reason: "nftree_required" });
});

test("ranked submission fails closed when NFTree ownership cannot be verified", async () => {
  const submission = await submitTodayArboristTrial({
    wallet: `0x${"5".repeat(64)}`,
    challengeId: "arborist-trial-v1-2026-08-23",
    playerMoves: [30, 18, 30, 11, 30, 18, 30, 24],
    signature: "injected-valid-proof",
  }, now, {
    verifyWalletProof: async () => true,
    hasNftreeAccess: async () => { throw new Error("rpc unavailable"); },
  });
  assert.equal(submission.status, 503);
  assert.deepEqual(submission.body, { ok: false, reason: "nftree_access_unavailable" });
});

test("server replay derives a completed win from the submitted card sequence", () => {
  const replay = replayArboristTrial(
    getArboristTrialChallenge(now),
    [30, 18, 30, 11, 30, 18, 30, 24],
    false,
  );
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.deepEqual(replay.result, {
    won: true,
    rounds: 8,
    playerGrowth: 50,
    botGrowth: 41,
    uniqueMoves: 4,
    specialtyBonus: 0,
    specialtySummary: null,
  });
});
