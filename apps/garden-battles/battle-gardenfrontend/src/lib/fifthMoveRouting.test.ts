import assert from "node:assert/strict";
import test from "node:test";
import {
  FIFTH_MOVE_CLOCK_OBJECT_ID,
  isUsableFifthMoveProof,
  selectFifthMoveFunction,
  type FifthMoveProof,
} from "./fifthMoveRouting";

const CONFIG_ID =
  "0x90c5264c9da2b340fdc9fbd15ad3f0a181a57afa7ae55b15a3c5dce6b31f45c8";

function proof(overrides: Partial<FifthMoveProof["payload"]> = {}): FifthMoveProof {
  return {
    payload: {
      version: 1,
      domain: [],
      network: [],
      fifth_move_config_id: CONFIG_ID,
      wallet: "0x000000000000000000000000000000000000000000000000000000000000000b",
      qualified: true,
      verified_underlying_tree_raw: "1000000000000",
      threshold_raw: "1000000000000",
      source_bitmap: 5,
      config_version: "2",
      issued_at_ms: "1000000",
      expires_at_ms: "1120000",
      ...overrides,
    },
    signatureBytes: Array.from({ length: 64 }, (_, i) => i),
  };
}

test("qualified valid proof is usable", () => {
  assert.equal(isUsableFifthMoveProof(proof(), CONFIG_ID), true);
});

test("unqualified, unavailable, malformed, and config mismatch proofs are not usable", () => {
  assert.equal(isUsableFifthMoveProof(null, CONFIG_ID), false);
  assert.equal(isUsableFifthMoveProof(proof({ qualified: false }), CONFIG_ID), false);
  assert.equal(isUsableFifthMoveProof({ ...proof(), signatureBytes: [1, 2, 3] }, CONFIG_ID), false);
  assert.equal(isUsableFifthMoveProof(proof({ fifth_move_config_id: "0x1" }), CONFIG_ID), false);
  assert.equal(isUsableFifthMoveProof(proof({ source_bitmap: 0 }), CONFIG_ID), false);
  assert.equal(
    isUsableFifthMoveProof(
      proof({
        verified_underlying_tree_raw: "999999999999",
        threshold_raw: "1000000000000",
      }),
      CONFIG_ID,
    ),
    false,
  );
});

test("PvP direct and kiosk qualified routes pass Clock object 0x6", () => {
  const direct = selectFifthMoveFunction({
    route: "pvp-direct",
    hasUsableProof: true,
    fifthMoveConfigEnabled: true,
  });
  const kiosk = selectFifthMoveFunction({
    route: "pvp-kiosk",
    hasUsableProof: true,
    fifthMoveConfigEnabled: true,
  });

  assert.equal(direct.functionName, "join_queue_v3_with_fifth_move");
  assert.equal(kiosk.functionName, "join_queue_v3_with_fifth_move_from_kiosk");
  assert.equal(direct.clockObjectId, FIFTH_MOVE_CLOCK_OBJECT_ID);
  assert.equal(kiosk.clockObjectId, FIFTH_MOVE_CLOCK_OBJECT_ID);
});

test("ranked bot direct and kiosk qualified routes pass Clock object 0x6", () => {
  const direct = selectFifthMoveFunction({
    route: "ranked-bot-direct",
    hasUsableProof: true,
    fifthMoveConfigEnabled: true,
  });
  const kiosk = selectFifthMoveFunction({
    route: "ranked-bot-kiosk",
    hasUsableProof: true,
    fifthMoveConfigEnabled: true,
  });

  assert.equal(direct.functionName, "create_ranked_bot_battle_v2_with_fifth_move");
  assert.equal(kiosk.functionName, "create_ranked_bot_battle_v2_with_fifth_move_from_kiosk");
  assert.equal(direct.clockObjectId, FIFTH_MOVE_CLOCK_OBJECT_ID);
  assert.equal(kiosk.clockObjectId, FIFTH_MOVE_CLOCK_OBJECT_ID);
});

test("standard fallback routes are selected before submission when proof is absent", () => {
  assert.equal(
    selectFifthMoveFunction({
      route: "pvp-direct",
      hasUsableProof: false,
      fifthMoveConfigEnabled: true,
    }).functionName,
    "join_queue_v3",
  );
  assert.equal(
    selectFifthMoveFunction({
      route: "pvp-kiosk",
      hasUsableProof: false,
      fifthMoveConfigEnabled: true,
    }).functionName,
    "join_queue_v3_from_kiosk",
  );
  assert.equal(
    selectFifthMoveFunction({
      route: "ranked-bot-direct",
      hasUsableProof: false,
      fifthMoveConfigEnabled: true,
    }).functionName,
    "create_ranked_bot_battle_v2_standard",
  );
  assert.equal(
    selectFifthMoveFunction({
      route: "ranked-bot-kiosk",
      hasUsableProof: false,
      fifthMoveConfigEnabled: true,
    }).functionName,
    "create_ranked_bot_battle_v2_standard_from_kiosk",
  );
});

test("ranked bot falls back to legacy bot creation when FifthMoveConfig is not configured", () => {
  assert.equal(
    selectFifthMoveFunction({
      route: "ranked-bot-direct",
      hasUsableProof: false,
      fifthMoveConfigEnabled: false,
    }).functionName,
    "create_bot_battle",
  );
  assert.equal(
    selectFifthMoveFunction({
      route: "ranked-bot-kiosk",
      hasUsableProof: false,
      fifthMoveConfigEnabled: false,
    }).functionName,
    "create_bot_battle_from_kiosk",
  );
});
