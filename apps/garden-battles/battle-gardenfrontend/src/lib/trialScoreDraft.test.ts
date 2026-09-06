import assert from "node:assert/strict";
import test from "node:test";
import { getArboristTrialChallenge } from "@shared/arborist-trials";
import { encodeTrialDraft, restoreTrialDraft, shouldRetryTrialSave, trialDraftKey, trialSaveError } from "./trialScoreDraft";
const challenge = getArboristTrialChallenge(new Date("2026-08-23T12:00:00Z"));
const wallet = `0x${"a".repeat(64)}`;
const moves = [30, 18, 30, 11, 30, 18, 30, 24];
const raw = encodeTrialDraft(wallet, challenge.id, false, moves);
test("a completed unsigned result can be restored without storing a signature", () => {
  const restored = restoreTrialDraft(raw, wallet, challenge);
  assert.equal(restored?.battle.finished, true);
  assert.equal(restored?.battle.player1Growth, 50);
  assert.deepEqual(restored?.battle.allPlayerMoves, moves);
  assert.ok(restored!.entries.length > 0);
  assert.equal(raw.includes("signature"), false);
  assert.equal(trialDraftKey(wallet.toUpperCase()), trialDraftKey(wallet));
});
test("drafts cannot migrate between wallets or daily challenges", () => {
  assert.equal(restoreTrialDraft(raw, `0x${"b".repeat(64)}`, challenge), null);
  assert.equal(restoreTrialDraft(raw, wallet, { ...challenge, id: "another-day" }), null);
});
test("corrupt, incomplete, illegal and post-finish moves are rejected", () => {
  for (const value of [null, "{", "null", encodeTrialDraft(wallet, challenge.id, false, []),
    encodeTrialDraft(wallet, challenge.id, false, [30]), encodeTrialDraft(wallet, challenge.id, false, [30, 30]),
    encodeTrialDraft(wallet, challenge.id, false, [...moves, 30]), encodeTrialDraft(wallet, challenge.id, false, [99])]) {
    assert.equal(restoreTrialDraft(value, wallet, challenge), null);
  }
});
test("save failures distinguish cancelled signatures and expired days", () => {
  assert.match(trialSaveError(new Error("User rejected request")), /Signature cancelled/);
  assert.match(trialSaveError(new Error("challenge_expired")), /expired/);
  assert.match(trialSaveError(new Error("Load failed")), /not confirmed/);
});
test("only transient save failures reuse the approved signature", () => {
  assert.equal(shouldRetryTrialSave(new Error("request_timeout")), true);
  assert.equal(shouldRetryTrialSave(new Error("nftree_access_unavailable")), true);
  assert.equal(shouldRetryTrialSave(new Error("The ranked Arborist Trial result could not be saved.")), true);
  assert.equal(shouldRetryTrialSave(new Error("challenge_expired")), false);
  assert.equal(shouldRetryTrialSave(new Error("wallet_signature_required")), false);
});
