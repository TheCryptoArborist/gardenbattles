import assert from "node:assert/strict";
import test from "node:test";
import { shuffleTrialHand } from "./trial-engine";
import { getArboristTrialChallenge } from "./arborist-trials";
import { IOS_SEPTEMBER_3_MOVES } from "./trial-recovery-fixture";
import { createArboristTrialBattle, playArboristTrialRound, getCanopyDiagnosisForecast } from "../battle-gardenfrontend/src/lib/arboristTrials";
import { MOVE_META } from "../battle-gardenfrontend/src/lib/sui-config";
import { encodeTrialDraft, restoreTrialDraft } from "../battle-gardenfrontend/src/lib/trialScoreDraft";

test("legacy V8 four-card shuffle preserves native comparison order", () => {
  for (let seed = 0; seed < 500; seed++) {
    const rng = () => { let state = seed; return () => ((state = (Math.imul(state,1664525)+1013904223)>>>0) / 4294967296); };
    const a = rng(), b = rng();
    assert.deepEqual(shuffleTrialHand([3,23,18,13],a,"legacy-v8"), [3,23,18,13].sort(() => b() - .5));
    assert.equal(a(),b(), `Random stream at seed ${seed}`);
  }
});

test("old iPhone draft restores the exact 59-round 50–15 win without trusting a score", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-03T12:00:00Z"));
  const wallet = `0x${"a".repeat(64)}`;
  assert.equal(IOS_SEPTEMBER_3_MOVES.length,59);
  const restored = restoreTrialDraft(encodeTrialDraft(wallet,challenge.id,false,IOS_SEPTEMBER_3_MOVES),wallet,challenge);
  assert.ok(restored);
  assert.equal(restored.battle.trialEngine,"legacy-webkit");
  assert.equal(restored.battle.player1Growth,50);
  assert.equal(restored.battle.player2Growth,15);
  assert.equal(Math.ceil(restored.battle.totalTurns/2),59);
  const updated = encodeTrialDraft(wallet,challenge.id,false,IOS_SEPTEMBER_3_MOVES,restored.battle.trialEngine);
  assert.deepEqual(restoreTrialDraft(updated,wallet,challenge)?.battle.allPlayerMoves,IOS_SEPTEMBER_3_MOVES);
});

test("portable Diagnosis forecasts match actual bot cards beyond eight rounds", () => {
  const challenge = getArboristTrialChallenge(new Date("2026-09-03T12:00:00Z"));
  let battle = createArboristTrialBattle(challenge,false);
  let checked = 0;
  for (const move of IOS_SEPTEMBER_3_MOVES) {
    if (battle.finished) break;
    const forecast = getCanopyDiagnosisForecast(battle,challenge);
    const before = battle.allBotMoves.length;
    battle = playArboristTrialRound(battle,challenge,move).battle;
    if (battle.allBotMoves.length > before) {
      assert.equal(MOVE_META[battle.allBotMoves.at(-1)!].type,forecast);
      checked++;
    }
  }
  assert.ok(checked > 8);
});
