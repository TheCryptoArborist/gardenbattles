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
import { insertArboristTrialResult, type ArboristTrialResultRow } from "./battle-storage";
import { IOS_SEPTEMBER_3_MOVES } from "../shared/trial-recovery-fixture";
import { createArboristTrialBattle, playArboristTrialRound, isArboristTrialMoveDisabled } from "../battle-gardenfrontend/src/lib/arboristTrials";

const now = new Date("2026-08-23T12:00:00.000Z");

test("new portable runs save with signed engine metadata across all seven daily rules", async () => {
  for (let day = 3; day < 10; day++) {
    const date = new Date(`2026-09-${String(day).padStart(2,"0")}T12:00:00Z`);
    const challenge = getArboristTrialChallenge(date);
    let battle = createArboristTrialBattle(challenge,false);
    for (let round = 0; round < 100 && !battle.finished; round++) {
      const legal = battle.player1Moves.filter(move => !isArboristTrialMoveDisabled(battle,challenge,move));
      battle = playArboristTrialRound(battle,challenge,legal[round % legal.length]).battle;
    }
    assert.equal(battle.finished,true,challenge.title);
    const keypair = new Ed25519Keypair();
    const wallet = keypair.getPublicKey().toSuiAddress();
    const replayVersion = battle.trialEngine;
    const signature = (await keypair.signPersonalMessage(new TextEncoder().encode(createArboristTrialProofMessage(challenge.id,wallet,battle.allPlayerMoves,replayVersion)))).signature;
    const saved = await submitTodayArboristTrial({wallet,challengeId:challenge.id,playerMoves:battle.allPlayerMoves,replayVersion,signature},date,{hasNftreeAccess:async()=>true});
    assert.equal(saved.status,201,challenge.title);
    assert.ok("result" in saved.body);
    if ("result" in saved.body) {
      assert.equal(saved.body.result.playerGrowth,battle.player1Growth);
      assert.equal(saved.body.result.botGrowth,battle.player2Growth);
    }
  }
});

test("a real iPhone recovery signature saves the complete legacy win exactly once", async () => {
  const keypair = new Ed25519Keypair();
  const wallet = keypair.getPublicKey().toSuiAddress();
  const date = new Date("2026-09-03T12:00:00Z");
  const challenge = getArboristTrialChallenge(date);
  for (const replayVersion of [undefined,"legacy-webkit"] as const) {
    const proof = await keypair.signPersonalMessage(new TextEncoder().encode(createArboristTrialProofMessage(challenge.id,wallet,IOS_SEPTEMBER_3_MOVES,replayVersion)));
    const input = {wallet,challengeId:challenge.id,playerMoves:IOS_SEPTEMBER_3_MOVES,signature:proof.signature,replayVersion};
    const response = await submitTodayArboristTrial(input,date,{hasNftreeAccess:async()=>true});
    assert.equal(response.status,replayVersion ? 409 : 201);
    if (!("result" in response.body)) throw new Error("Missing saved result");
    assert.equal(response.body.result.rounds,59);
    assert.equal(response.body.result.playerGrowth,50);
    assert.equal(response.body.result.botGrowth,15);
    assert.equal(response.body.result.won,true);
    const tampered = await submitTodayArboristTrial({...input,replayVersion:"portable-v1"},date,{hasNftreeAccess:async()=>true});
    assert.equal(tampered.status,401);
  }
});

test("legacy replay cannot be used for new days and signature is still required", async () => {
  const date = new Date("2026-09-04T12:00:00Z");
  const response = await submitTodayArboristTrial({wallet:`0x${"a".repeat(64)}`,challengeId:getArboristTrialChallenge(date).id,playerMoves:[23],replayVersion:"legacy-webkit"},date);
  assert.equal(response.body.reason,"trial_client_update_required");
  const unsigned = await submitTodayArboristTrial({wallet:`0x${"a".repeat(64)}`,challengeId:"arborist-trial-v2-2026-09-03",playerMoves:IOS_SEPTEMBER_3_MOVES},new Date("2026-09-03T12:00:00Z"));
  assert.equal(unsigned.status,401);
});

test("a real signed completed run saves once, updates check-in, and keeps its streak tomorrow", async () => {
  const keypair = new Ed25519Keypair();
  const wallet = keypair.getPublicKey().toSuiAddress();
  const challenge = getArboristTrialChallenge(now);
  const playerMoves = [30, 18, 30, 11, 30, 18, 30, 24];
  const proof = await keypair.signPersonalMessage(new TextEncoder().encode(
    createArboristTrialProofMessage(challenge.id, wallet, playerMoves),
  ));
  const input = { wallet, challengeId: challenge.id, playerMoves, signature: proof.signature };
  const saved = await submitTodayArboristTrial(input, now, { hasNftreeAccess: async () => true });
  assert.equal(saved.status, 201);
  assert.ok("newAchievements" in saved.body);
  if ("newAchievements" in saved.body) {
    assert.deepEqual(saved.body.newAchievements, ["first_checkin", "canopy_conqueror", "toolbelt_tactician", "speed_pruner"]);
    assert.equal(saved.body.result.rank, 1);
  }
  const today = getTodayArboristTrial(wallet, now);
  assert.equal(today.rankedAttemptUsed, true);
  assert.equal(today.checkInStreak, 1);
  assert.equal(today.streak, 1);
  assert.equal(today.result?.won, true);
  const duplicate = await submitTodayArboristTrial(input, now, { hasNftreeAccess: async () => true });
  assert.equal(duplicate.status, 409);
  assert.deepEqual("newAchievements" in duplicate.body && duplicate.body.newAchievements, []);
  assert.deepEqual(getTodayArboristTrial(wallet, now).result, today.result);
  const tomorrow = getTodayArboristTrial(wallet, new Date("2026-08-24T12:00:00Z"));
  assert.equal(tomorrow.rankedAttemptUsed, false);
  assert.equal(tomorrow.streak, 1);
  assert.equal(tomorrow.checkInStreak, 1);
});

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
  assert.equal(response.achievements.length, 8);
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

function insertFixture(wallet: string, date: string, overrides: Partial<ArboristTrialResultRow> = {}) {
  insertArboristTrialResult({
    challenge_id: getArboristTrialChallenge(new Date(`${date}T12:00:00Z`)).id,
    challenge_date: date, wallet, score: 100, won: 1, rounds: 10,
    player_growth: 50, bot_growth: 20, unique_moves: 2,
    completed_at: Date.parse(`${date}T12:00:00Z`), ...overrides,
  });
}

test("personal rank works outside the returned top 25 and ties use stable wallet ordering", () => {
  const date = "2031-01-01";
  const wallets = Array.from({ length: 32 }, (_, i) => `0x${(i + 1000).toString(16).padStart(64, "0")}`);
  // Reverse insertion must not change the deterministic tie order.
  [...wallets].reverse().forEach((wallet) => insertFixture(wallet, date));
  const board = getTodayArboristTrial(wallets[31], new Date(`${date}T12:00:00Z`));
  assert.equal(board.leaderboardTotal, 32);
  assert.equal(board.leaderboard.length, 25);
  assert.equal(board.result?.rank, 32);
  assert.equal(board.leaderboard[0].wallet, wallets[0]);
  assert.equal(board.leaderboard[24].rank, 25);
});

test("30 check-ins count distinct saved days with gaps, not a winning streak", () => {
  const wallet = `0x${"ab".repeat(32)}`;
  for (let i = 0; i < 29; i++) {
    const date = new Date(Date.UTC(2020, 0, 1 + i * 3)).toISOString().slice(0, 10);
    insertFixture(wallet, date, { won: 0 });
  }
  insertFixture(wallet, "2020-01-01", { challenge_id: "old-schedule-duplicate", won: 0 });
  let board = getTodayArboristTrial(wallet, now);
  assert.equal(board.achievements.find((b) => b.id === "thirty_checkins")?.progress, 29);
  insertFixture(wallet, "2020-05-01", { won: 0 });
  board = getTodayArboristTrial(wallet, now);
  assert.equal(board.achievements.find((b) => b.id === "thirty_checkins")?.earned, true);
  assert.equal(board.achievements.find((b) => b.id === "master_arborist")?.earned, false);
  assert.equal(board.achievements.find((b) => b.id === "steady_hands")?.earned, false);
  assert.equal(board.result, null);
});

test("old earned badges survive more than 365 subsequent saved runs", () => {
  const wallet = `0x${"cd".repeat(32)}`;
  insertFixture(wallet, "2019-01-01", { won: 1, unique_moves: 4, rounds: 8 });
  for (let i = 0; i < 366; i++) {
    const date = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    insertFixture(wallet, date, { won: 0 });
  }
  const board = getTodayArboristTrial(wallet, now);
  for (const id of ["canopy_conqueror", "toolbelt_tactician", "speed_pruner", "thirty_checkins"]) {
    assert.equal(board.achievements.find((b) => b.id === id)?.earned, true, id);
  }
});
